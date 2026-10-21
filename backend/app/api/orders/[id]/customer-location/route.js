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

export async function PATCH(request, { params }) {
  try {
    const session = await resolveSession();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const resolvedParams = params ? await params : {};
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    const accuracy = typeof body.accuracy === "number" && isFinite(body.accuracy) ? body.accuracy : null;

    if (isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90 || isNaN(lng) || !isFinite(lng) || lng < -180 || lng > 180) {
      return NextResponse.json({
        success: false,
        message: "Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.",
      }, { status: 400 });
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
    if (["superadmin", "restaurant_admin", "staff"].includes(session.user.role)) {
      query = orderIdentifierFilter;
    } else {
      const dbUser = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!dbUser) {
        return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
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

    const order = await Order.findOne(query);
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found or unauthorized." }, { status: 404 });
    }

    const now = new Date();
    const customerLocation = {
      latitude: lat,
      longitude: lng,
      accuracy,
      updatedAt: now,
    };

    const setFields = { customerLocation };
    if (order.address && (order.address.latitude === null || order.address.latitude === undefined)) {
      setFields["address.latitude"] = lat;
      setFields["address.longitude"] = lng;
    }

    await Order.updateOne({ _id: order._id }, { $set: setFields });

    return NextResponse.json({
      success: true,
      message: "Customer live location shared with delivery partner.",
      customerLocation: order.customerLocation,
      destination: {
        latitude: order.address?.latitude,
        longitude: order.address?.longitude,
      },
    });
  } catch (error) {
    console.error("Customer location update error:", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

// Support POST as well for browser clients/sendBeacon
export async function POST(request, context) {
  return PATCH(request, context);
}
