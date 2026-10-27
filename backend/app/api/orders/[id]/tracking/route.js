import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  hashGuestAccessToken,
  extractGuestAccessToken,
  buildGuestOrderQuery,
} from "@/lib/guestAccessService";

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
    const guestToken = extractGuestAccessToken(request);

    if (!session?.user && !guestToken) {
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
    if (session?.user?.role === "superadmin") {
      query = orderIdentifierFilter;
    } else if (session?.user?.role === "restaurant_admin" || session?.user?.role === "staff") {
      const restId = (session.user.restaurantId || session.user.restaurant)?.toString();
      if (!restId) {
        return NextResponse.json(
          { success: false, message: "Access denied: staff account is not assigned to an active restaurant." },
          { status: 403 }
        );
      }
      query = {
        $and: [
          orderIdentifierFilter,
          { restaurant: restId },
        ],
      };
    } else if (session?.user) {
      // Customer: strictly enforce ownership via verified customer user ID.
      // Phone matching against guest orders is strictly removed to prevent account spoofing.
      const dbUser = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!dbUser) {
        return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
      }

      let customerOwnership;
      if (guestToken) {
        customerOwnership = {
          $or: [
            { user: dbUser._id },
            buildGuestOrderQuery(hashGuestAccessToken(guestToken)),
          ],
        };
      } else {
        customerOwnership = { user: dbUser._id };
      }

      query = {
        $and: [
          orderIdentifierFilter,
          customerOwnership,
        ],
      };
    } else {
      // Guest: authorized strictly via validated guest access token
      query = {
        $and: [
          orderIdentifierFilter,
          buildGuestOrderQuery(hashGuestAccessToken(guestToken)),
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

    // Expose coordinates when order is actively in out_for_delivery and real coordinates are present
    const isActivelyDelivering =
      !isPickup &&
      order.status === "out_for_delivery" &&
      hasCoordinates;

    const now = Date.now();
    const lastUpdateDate = tracking.lastUpdatedAt || tracking.currentLocation?.recordedAt;
    const lastUpdatedMs = lastUpdateDate ? new Date(lastUpdateDate).getTime() : null;
    const isStale = Boolean(lastUpdatedMs && (now - lastUpdatedMs > 180 * 1000)); // 180 seconds threshold

    // Driver / Delivery staff display information
    let driverInfo = null;
    if (order.assignedDeliveryStaff?.name) {
      driverInfo = {
        id: order.assignedDeliveryStaff.id || null,
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
      assignedDeliveryStaff: driverInfo,
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
                  latitude: order.restaurant.address.latitude ?? null,
                  longitude: order.restaurant.address.longitude ?? null,
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
