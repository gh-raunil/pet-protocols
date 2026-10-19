import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

export async function PUT(request, { params }) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "orders_update" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId, user } = auth;
    const resolvedParams = params ? await params : {};
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    const body = await request.json();
    const { latitude, longitude, accuracy, heading, speed, recordedAt: rawRecordedAt } = body || {};

    // Validate incoming coordinate payload before any DB write
    const valResult = (Order.validateLocationPayload || Order.schema.statics.validateLocationPayload)({
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      recordedAt: rawRecordedAt,
    });

    if (!valResult.isValid) {
      return NextResponse.json({
        success: false,
        message: valResult.message || "Invalid location payload.",
        reason: valResult.reason,
      }, { status: 400 });
    }

    const validLocation = valResult.data;
    const clientRecordedAt = validLocation.recordedAt;
    const serverReceiptAt = new Date();

    await connectDB();

    // Query order by Mongo ObjectId or business orderId
    const isObjectId = id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
    const orderIdentityFilter = isObjectId
      ? { $or: [{ _id: id }, { orderId: id }] }
      : { orderId: id };

    const order = await Order.findOne(orderIdentityFilter);

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found or does not belong to your restaurant." },
        { status: 404 }
      );
    }

    // Multi-tenant boundary: order must strictly belong to the authenticated staff's restaurant
    const orderRestId = order.restaurant?._id ? order.restaurant._id.toString() : order.restaurant.toString();
    if (orderRestId !== restaurantId.toString()) {
      return NextResponse.json(
        { success: false, message: "Order not found or does not belong to your restaurant." },
        { status: 404 }
      );
    }

    // Delivery staff authorization check:
    // If a specific driver is assigned, only that driver, a manager, or restaurant admin can update location
    const isAssignedDriver = order.assignedDeliveryStaff?.id &&
      order.assignedDeliveryStaff.id.toString() === user._id.toString();
    const isManagerOrAdmin = ["restaurant_admin", "admin", "superadmin"].includes(user.role) ||
      (Array.isArray(user.staffRoles) && user.staffRoles.includes("Manager"));

    if (order.assignedDeliveryStaff?.id && !isAssignedDriver && !isManagerOrAdmin) {
      return NextResponse.json({
        success: false,
        message: "You are not the currently assigned delivery staff for this order.",
      }, { status: 403 });
    }

    // Pickup orders never support GPS delivery tracking
    if (typeof order.isPickupOrder === "function" && order.isPickupOrder()) {
      return NextResponse.json({
        success: false,
        message: "Pickup orders do not support GPS delivery tracking.",
      }, { status: 400 });
    }

    // Order must be actively out for delivery
    if (order.status !== "out_for_delivery") {
      return NextResponse.json({
        success: false,
        message: `Location updates are only accepted while order is 'out_for_delivery' (current status: '${order.status}').`,
      }, { status: 400 });
    }

    // If driver is not assigned yet, assign the reporting staff member
    if (!order.assignedDeliveryStaff?.id) {
      order.assignedDeliveryStaff = {
        id: user._id,
        name: user.name || "Delivery Staff",
        phone: user.phone || "",
        email: user.email || "",
        assignedAt: new Date(),
      };
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            assignedDeliveryStaff: order.assignedDeliveryStaff,
          },
        }
      );
    }

    // Auto-heal / activate tracking session if order is actively out for delivery
    if (!order.deliveryTracking?.isLive) {
      if (typeof order.startDeliveryTracking === "function") {
        order.startDeliveryTracking({
          userId: user._id,
          role: user.role,
          name: user.name || "Delivery Staff",
        });
      } else {
        order.deliveryTracking = order.deliveryTracking || {};
        order.deliveryTracking.isLive = true;
        order.deliveryTracking.startedAt = order.deliveryTracking.startedAt || new Date();
      }
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            "deliveryTracking.isLive": true,
            "deliveryTracking.startedAt": order.deliveryTracking.startedAt || new Date(),
          },
        }
      );
    }

    // Quick reject if incoming recordedAt is older than or equal to current snapshot
    if (
      order.deliveryTracking?.currentLocation?.recordedAt &&
      clientRecordedAt.getTime() <= new Date(order.deliveryTracking.currentLocation.recordedAt).getTime()
    ) {
      return NextResponse.json({
        success: false,
        reason: "stale_timestamp",
        message: "Stale location update received with older timestamp than current location.",
      }, { status: 400 });
    }

    // ── ATOMIC COMPARE-AND-SET PERSISTENCE ──
    // Guarantees atomic serializability at database level:
    // 1. Order and restaurant identity match
    // 2. Status remains strictly 'out_for_delivery'
    // 3. deliveryTracking.isLive remains strictly true
    // 4. Stored recordedAt is older than incoming recordedAt (newer wins, stale/duplicate rejected)
    // 5. Staff member remains authorized (not reassigned to another driver concurrently)
    const targetRestId = order.restaurant?._id || order.restaurant;
    const atomicConditions = [
      { _id: order._id },
      { restaurant: targetRestId },
      { status: "out_for_delivery" },
      { "deliveryTracking.isLive": true },
      {
        $or: [
          { "deliveryTracking.currentLocation": null },
          { "deliveryTracking.currentLocation.recordedAt": null },
          { "deliveryTracking.currentLocation.recordedAt": { $exists: false } },
          { "deliveryTracking.currentLocation.recordedAt": { $lt: clientRecordedAt } },
        ],
      },
    ];

    if (!isManagerOrAdmin) {
      if (order.assignedDeliveryStaff?.id) {
        atomicConditions.push({ "assignedDeliveryStaff.id": order.assignedDeliveryStaff.id });
      } else {
        atomicConditions.push({
          $or: [
            { "assignedDeliveryStaff.id": null },
            { "assignedDeliveryStaff.id": { $exists: false } },
            { "assignedDeliveryStaff.id": user._id },
          ],
        });
      }
    }

    const updateDoc = {
      $set: {
        "deliveryTracking.currentLocation": {
          latitude: validLocation.latitude,
          longitude: validLocation.longitude,
          accuracy: validLocation.accuracy,
          heading: validLocation.heading,
          speed: validLocation.speed,
          recordedAt: clientRecordedAt,
        },
        "deliveryTracking.lastUpdatedAt": serverReceiptAt,
      },
    };

    // Auto-associate staff member to delivery if not already assigned
    if (!order.assignedDeliveryStaff?.id && user.role === "staff") {
      updateDoc.$set["assignedDeliveryStaff"] = {
        id: user._id,
        name: user.name || "Delivery Staff",
        phone: user.phone || "",
        email: user.email || "",
        assignedAt: serverReceiptAt,
      };
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { $and: atomicConditions },
      updateDoc,
      { returnDocument: "after" }
    );

    if (!updatedOrder) {
      // Diagnostic check: inspect why the conditional update did not match
      const latestOrder = await Order.findById(order._id);
      if (!latestOrder) {
        return NextResponse.json(
          { success: false, message: "Order not found or does not belong to your restaurant." },
          { status: 404 }
        );
      }

      const latestIsAssigned = latestOrder.assignedDeliveryStaff?.id &&
        latestOrder.assignedDeliveryStaff.id.toString() === user._id.toString();
      if (latestOrder.assignedDeliveryStaff?.id && !latestIsAssigned && !isManagerOrAdmin) {
        return NextResponse.json({
          success: false,
          message: "You are not the currently assigned delivery staff for this order.",
        }, { status: 403 });
      }

      if (latestOrder.status !== "out_for_delivery") {
        return NextResponse.json({
          success: false,
          message: `Location updates are only accepted while order is 'out_for_delivery' (current status: '${latestOrder.status}').`,
        }, { status: 400 });
      }

      if (!latestOrder.deliveryTracking?.isLive) {
        return NextResponse.json({
          success: false,
          message: "Delivery tracking session is not active for this order.",
        }, { status: 400 });
      }

      if (
        latestOrder.deliveryTracking?.currentLocation?.recordedAt &&
        clientRecordedAt.getTime() <= new Date(latestOrder.deliveryTracking.currentLocation.recordedAt).getTime()
      ) {
        return NextResponse.json({
          success: false,
          reason: "stale_timestamp",
          message: "Stale location update received with older timestamp than current location.",
        }, { status: 400 });
      }

      return NextResponse.json({
        success: false,
        reason: "concurrency_conflict",
        message: "Concurrent location update rejected.",
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      orderId: updatedOrder.orderId,
      status: updatedOrder.status,
      isLive: true,
      recordedAt: updatedOrder.deliveryTracking.currentLocation.recordedAt,
      lastUpdatedAt: updatedOrder.deliveryTracking.lastUpdatedAt,
    });
  } catch (error) {
    console.error("Staff location ingestion error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request, context) {
  return PUT(request, context);
}
