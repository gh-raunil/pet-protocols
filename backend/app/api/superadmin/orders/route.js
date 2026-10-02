import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { requireSuperAdmin } from "@/lib/authMiddleware";
import { notifyOrderEvent } from "@/lib/pushService";

// GET — List all platform orders across all restaurants
export async function GET(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const restaurantId = searchParams.get("restaurantId")?.trim() || "";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const query = {};

    if (restaurantId && restaurantId !== "all") {
      query.restaurant = restaurantId;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { orderId: regex },
        { "address.fullName": regex },
        { "address.phone": regex },
      ];
    }

    const orders = await Order.find(query)
      .populate("restaurant", "name slug phone")
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      orders,
      total: orders.length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH — Superadmin update order status or resolution notes
export async function PATCH(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { orderId, status, notes } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Order ID is required." },
        { status: 400 }
      );
    }

    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    const previousStatus = order.status;
    if (status && ["pending", "preparing", "out_for_delivery", "delivered", "cancelled"].includes(status)) {
      order.status = status;
    }

    if (notes !== undefined) {
      order.notes = notes;
    }

    await order.save();

    if (status && status !== previousStatus) {
      notifyOrderEvent(order, 'status_update', { status, reason: notes, notifyRestaurant: true }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: "Order updated successfully by Super Admin.",
      order,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
