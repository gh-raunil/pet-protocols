import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

let _getServerSession = getServerSession;
export function _setTestGetServerSession(fn) {
  _getServerSession = fn;
}

async function resolveSession() {
  try {
    return await _getServerSession(authOptions);
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  try {
    const session = await resolveSession();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params ? await params : {};
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    await connectDB();

    const isObjectId = id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
    const orderIdentifierFilter = {
      $or: [
        { orderId: id },
        ...(isObjectId ? [{ _id: id }] : []),
      ],
    };

    let query = {};
    if (session.user.role === "superadmin") {
      query = orderIdentifierFilter;
    } else if (session.user.role === "restaurant_admin" || session.user.role === "staff") {
      const restId = (session.user.restaurantId || session.user.restaurant)?.toString();
      query = {
        $and: [
          orderIdentifierFilter,
          { restaurant: restId },
        ],
      };
    } else {
      // Customer: strictly enforce ownership via customer user ID or verified phone number
      const dbUser = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!dbUser) {
        return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
      }

      query = {
        $and: [
          orderIdentifierFilter,
          {
            $or: [
              { user: dbUser._id },
              ...(dbUser.phone ? [{ "address.phone": dbUser.phone }] : []),
            ],
          },
        ],
      };
    }

    const order = await Order.findOne(query)
      .populate("restaurant", "name slug phone address")
      .populate("user", "name email");

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found or unauthorized." },
        { status: 404 }
      );
    }

    const isPickup = typeof order.isPickupOrder === "function" ? order.isPickupOrder() : false;
    const tracking = order.deliveryTracking || {};
    const hasCoordinates = Boolean(
      tracking.currentLocation &&
      typeof tracking.currentLocation.latitude === "number" &&
      typeof tracking.currentLocation.longitude === "number"
    );

    // Rule: Never expose coordinates unless order is in out_for_delivery with an active live session and real coordinates
    const isActivelyDelivering =
      !isPickup &&
      order.status === "out_for_delivery" &&
      Boolean(tracking.isLive) &&
      hasCoordinates;

    const now = Date.now();
    const lastUpdateDate = tracking.lastUpdatedAt || tracking.currentLocation?.recordedAt;
    const lastUpdatedMs = lastUpdateDate ? new Date(lastUpdateDate).getTime() : null;
    const isStale = Boolean(lastUpdatedMs && (now - lastUpdatedMs > 180 * 1000)); // 180 seconds threshold

    // Driver display information for transit
    let driverInfo = null;
    if (order.status === "out_for_delivery" && order.assignedDeliveryStaff?.name) {
      driverInfo = {
        name: order.assignedDeliveryStaff.name,
        phone: order.assignedDeliveryStaff.phone || null,
      };
    }

    // Coordinates are strictly null unless actively out for delivery
    let locationData = null;
    if (isActivelyDelivering) {
      locationData = {
        latitude: tracking.currentLocation.latitude,
        longitude: tracking.currentLocation.longitude,
        accuracy: tracking.currentLocation.accuracy ?? null,
        heading: tracking.currentLocation.heading ?? null,
        speed: tracking.currentLocation.speed ?? null,
        recordedAt: tracking.currentLocation.recordedAt || tracking.lastUpdatedAt,
      };
    }

    const destinationCoords = {
      fullName: order.address?.fullName || "",
      phone: order.address?.phone || "",
      street: order.address?.street || "",
      city: order.address?.city || "",
      state: order.address?.state || "",
      pincode: order.address?.pincode || "",
      latitude: typeof order.address?.latitude === "number" ? order.address.latitude : null,
      longitude: typeof order.address?.longitude === "number" ? order.address.longitude : null,
      recipientName: order.address?.recipientName || null,
      recipientPhone: order.address?.recipientPhone || null,
      isDifferentRecipient: Boolean(order.address?.isDifferentRecipient),
    };

    const customerLocationData = order.customerLocation && typeof order.customerLocation.latitude === "number"
      ? {
          latitude: order.customerLocation.latitude,
          longitude: order.customerLocation.longitude,
          accuracy: order.customerLocation.accuracy ?? null,
          updatedAt: order.customerLocation.updatedAt || null,
        }
      : null;

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      status: order.status,
      isPickup,
      isLive: isActivelyDelivering,
      isStale: isActivelyDelivering ? isStale : false,
      location: locationData,
      driver: driverInfo,
      startedAt: tracking.startedAt || null,
      endedAt: tracking.endedAt || null,
      lastUpdatedAt: tracking.lastUpdatedAt || null,
      destination: destinationCoords,
      customerLocation: customerLocationData,
      restaurant: order.restaurant
        ? {
            name: order.restaurant.name || "",
            phone: order.restaurant.phone || "",
            address: order.restaurant.address
              ? {
                  street: order.restaurant.address.street || "",
                  city: order.restaurant.address.city || "",
                  state: order.restaurant.address.state || "",
                  pincode: order.restaurant.address.pincode || "",
                  latitude: order.restaurant.address.latitude || 0,
                  longitude: order.restaurant.address.longitude || 0,
                }
              : null,
          }
        : null,
    });
  } catch (error) {
    console.error("Customer tracking read error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
