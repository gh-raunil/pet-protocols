import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { sendPushToUser } from "@/lib/pushService";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

/**
 * POST / PUT — Delivery Order Assignment & Manager Self-Delivery
 *
 * Implements:
 * - Rule A: Manager assigns eligible active delivery person.
 * - Rule C: Manager selects "Deliver This Order Myself".
 * - Tenant isolation: scoped strictly to authenticated restaurant.
 * - Concurrency guard against conflicting assignments.
 */
export async function POST(request, { params }) {
  return handleAssignment(request, params);
}

export async function PUT(request, { params }) {
  return handleAssignment(request, params);
}

async function handleAssignment(request, params) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "orders_update" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const resolvedParams = params ? await params : {};
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    // Role check: Only restaurant_admin or staff with Manager role can assign delivery personnel
    const isLeadAdmin = auth.isAdmin || auth.user?.role === "restaurant_admin" || auth.user?.role === "admin";
    const userRoles = Array.isArray(auth.staffRoles) ? auth.staffRoles : (auth.user?.staffRoles || []);
    const isManager = isLeadAdmin || userRoles.includes("Manager");

    if (!isManager) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only restaurant managers or admins can assign delivery personnel." },
        { status: 403 }
      );
    }

    await connectDB();

    const order = await Order.findOne({ _id: id, restaurant: restaurantId });
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found or does not belong to your restaurant." },
        { status: 404 }
      );
    }

    const isPickup = typeof order.isPickupOrder === "function" ? order.isPickupOrder() : order.orderType === "pickup";
    if (isPickup) {
      return NextResponse.json(
        { success: false, message: "Pickup orders do not require delivery assignment." },
        { status: 400 }
      );
    }

    if (["delivered", "cancelled"].includes(order.status)) {
      return NextResponse.json(
        { success: false, message: `Cannot assign delivery person to an order that is already ${order.status}.` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { deliveryStaffId, selfDelivery, note = "" } = body;

    const assignerInfo = {
      id: auth.user?._id,
      name: auth.user?.name || "Manager",
      role: auth.user?.role || "restaurant_admin",
    };

    const now = new Date();

    // =========================================================================
    // CASE 1: Manager Self-Delivery ("Deliver This Order Myself" - Rule C)
    // =========================================================================
    if (selfDelivery === true) {
      const updateDoc = {
        $set: {
          assignedDeliveryStaff: {
            id: auth.user._id,
            name: `${auth.user.name || "Manager"} (Self-Delivery)`,
            phone: auth.user.phone || "",
            email: auth.user.email || "",
            assignedAt: now,
          },
          deliveryAssignmentMode: "manager_self_delivery",
          assignmentStatus: "accepted",
          assignedBy: assignerInfo,
        },
        $push: {
          statusHistory: {
            status: order.status,
            changedAt: now,
            changedBy: {
              userId: auth.user?._id,
              role: auth.user?.role || "restaurant_admin",
              name: auth.user?.name || "Manager",
            },
            note: note.trim() || `Manager ${assignerInfo.name} assigned self for direct delivery (manager-self-delivery mode).`,
          },
        },
        $inc: { __v: 1 },
      };

      const updated = await Order.findOneAndUpdate(
        { _id: order._id, restaurant: restaurantId, status: { $nin: ["delivered", "cancelled"] } },
        updateDoc,
        { returnDocument: "after" }
      );

      if (!updated) {
        return NextResponse.json(
          { success: false, conflict: true, message: "Order was concurrently modified or cancelled. Please reload." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Order successfully assigned for manager self-delivery.",
        assignmentMode: "manager_self_delivery",
        order: updated,
      });
    }

    // =========================================================================
    // CASE 2: Staff Assignment (Rule A)
    // =========================================================================
    if (!deliveryStaffId) {
      return NextResponse.json(
        { success: false, message: "Delivery staff ID or selfDelivery flag is required." },
        { status: 400 }
      );
    }

    // Tenant isolation & driver eligibility validation
    const candidateStaff = await User.findOne({
      _id: deliveryStaffId,
      restaurant: restaurantId,
      role: "staff",
    });

    if (!candidateStaff) {
      // Check if user exists in another restaurant for clear security rejection
      const crossRestaurantCheck = await User.findOne({ _id: deliveryStaffId });
      if (crossRestaurantCheck && String(crossRestaurantCheck.restaurant) !== String(restaurantId)) {
        return NextResponse.json(
          { success: false, message: "Selected staff member belongs to a different restaurant. Access denied." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, message: "Selected staff member not found in this restaurant." },
        { status: 404 }
      );
    }

    // Check delivery role
    const staffRolesList = Array.isArray(candidateStaff.staffRoles) && candidateStaff.staffRoles.length > 0
      ? candidateStaff.staffRoles
      : (candidateStaff.staffRole ? [candidateStaff.staffRole] : []);

    if (!staffRolesList.includes("Delivery")) {
      return NextResponse.json(
        { success: false, message: `Staff member ${candidateStaff.name} does not have the 'Delivery' role assigned.` },
        { status: 400 }
      );
    }

    // Check active account status
    if (candidateStaff.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot assign order to staff member ${candidateStaff.name}. Account status is '${candidateStaff.status}'. Only active accounts can receive assignments.`,
        },
        { status: 400 }
      );
    }

    // Atomic assignment update
    const updateDoc = {
      $set: {
        assignedDeliveryStaff: {
          id: candidateStaff._id,
          name: candidateStaff.name,
          phone: candidateStaff.phone || "",
          email: candidateStaff.email || "",
          assignedAt: now,
        },
        deliveryAssignmentMode: "staff",
        assignmentStatus: "assigned",
        assignedBy: assignerInfo,
      },
      $push: {
        statusHistory: {
          status: order.status,
          changedAt: now,
          changedBy: {
            userId: auth.user?._id,
            role: auth.user?.role || "restaurant_admin",
            name: auth.user?.name || "Manager",
          },
          note: note.trim() || `Assigned to delivery staff ${candidateStaff.name} (${candidateStaff.phone || "No phone"}) by manager ${assignerInfo.name}.`,
        },
      },
      $inc: { __v: 1 },
    };

    const updated = await Order.findOneAndUpdate(
      { _id: order._id, restaurant: restaurantId, status: { $nin: ["delivered", "cancelled"] } },
      updateDoc,
      { returnDocument: "after" }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, conflict: true, message: "Order was concurrently modified or cancelled. Please reload." },
        { status: 409 }
      );
    }

    // Trigger push notification to assigned delivery driver
    try {
      sendPushToUser(candidateStaff._id.toString(), {
        title: "New Delivery Assigned! 🛵",
        body: `Order #${updated.orderId || updated._id.toString().slice(-6).toUpperCase()} has been assigned to you by manager ${assignerInfo.name}.`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-96x96.png",
        url: "/delivery",
        data: { url: "/delivery", type: "order_assigned", orderId: updated._id.toString() },
      });
    } catch (pushErr) {
      console.warn("[Delivery Assignment Push Warning]", pushErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Order successfully assigned to ${candidateStaff.name}.`,
      assignmentMode: "staff",
      order: updated,
    });
  } catch (error) {
    console.error("[Delivery Assignment Error]", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process delivery assignment." },
      { status: 500 }
    );
  }
}
