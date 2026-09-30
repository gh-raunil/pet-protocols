import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { restoreStockForOrder } from "@/lib/inventoryService";

// GET — List orders for this restaurant
export async function GET(request) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true, requiredPermission: "orders_view" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurant, restaurantId } = auth;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const dateParam = searchParams.get("date"); // YYYY-MM-DD or 'all'
    const searchQuery = (searchParams.get("search") || "").trim();

    let filter = { restaurant: restaurantId };
    if (status && status !== "all") {
      filter.status = status;
    }

    if (dateParam && dateParam !== "all" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [year, month, day] = dateParam.split("-").map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    if (searchQuery) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const stripped = searchQuery.replace(/^#/, "").trim();
      const cleanId = stripped.replace(/^PET-/i, "").replace(/^ORD_/i, "").trim();

      const orConditions = [
        { "address.fullName": { $regex: escapeRegex(searchQuery), $options: "i" } },
        { "address.phone": { $regex: escapeRegex(stripped), $options: "i" } },
        { orderId: { $regex: escapeRegex(stripped), $options: "i" } },
      ];

      if (cleanId) {
        orConditions.push({ orderId: { $regex: escapeRegex(cleanId), $options: "i" } });
        orConditions.push({
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: escapeRegex(cleanId),
              options: "i",
            },
          },
        });
      }

      filter.$or = orConditions;
    }

    let orders = await Order.find(filter)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    // Fallback: If searching by orderId or customer and 0 results found in filtered date range, search across all dates
    if (orders.length === 0 && searchQuery && filter.createdAt) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.createdAt;
      orders = await Order.find(fallbackFilter)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .lean();
    }

    return NextResponse.json({
      success: true,
      orders,
      restaurantCreatedAt: restaurant?.createdAt || null,
      restaurantName: restaurant?.name || "",
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT — Update order status (scoped to restaurant)
export async function PUT(request) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true, requiredPermission: "orders_update" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const body = await request.json();
    const { orderId, status, paymentStatus, notes, assignedDeliveryStaff, codPaymentHandler } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    if (!status && !paymentStatus && notes === undefined && !assignedDeliveryStaff && !codPaymentHandler) {
      return NextResponse.json({ success: false, message: "At least one field must be provided." }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findOne({ _id: orderId, restaurant: restaurantId });
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found or does not belong to your restaurant." },
        { status: 404 }
      );
    }

    if (status) {
      order.status = status;
      if (status === "cancelled") {
        await restoreStockForOrder(order);
      }
    }
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (typeof notes === "string") order.notes = notes;
    if (assignedDeliveryStaff) {
      order.assignedDeliveryStaff = {
        id: assignedDeliveryStaff.id || auth.user?._id,
        name: assignedDeliveryStaff.name || auth.user?.name || "Delivery Staff",
        phone: assignedDeliveryStaff.phone || auth.user?.phone || "",
        email: assignedDeliveryStaff.email || auth.user?.email || "",
        assignedAt: new Date(),
      };
    }
    if (codPaymentHandler) {
      order.codPaymentHandler = {
        id: codPaymentHandler.id || auth.user?._id,
        name: codPaymentHandler.name || auth.user?.name || "Staff",
        phone: codPaymentHandler.phone || auth.user?.phone || "",
        collected: codPaymentHandler.collected !== undefined ? codPaymentHandler.collected : true,
        collectedAt: new Date(),
      };
      if (codPaymentHandler.collected) {
        order.paymentStatus = "paid";
      }
    }
    await order.save();

    return NextResponse.json({
      success: true,
      message: `Order updated successfully`,
      order,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
