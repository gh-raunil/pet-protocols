import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { requireSuperAdmin } from "@/lib/authMiddleware";

// GET — List all platform support inquiries, tickets, and order issues
export async function GET(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    // Orders with customer notes or support logs
    const query = {
      $or: [
        { notes: { $exists: true, $ne: "" } },
        { status: "cancelled" },
      ],
    };

    if (search) {
      const regex = new RegExp(search, "i");
      query.$and = [
        {
          $or: [
            { orderId: regex },
            { notes: regex },
            { "address.fullName": regex },
            { "address.phone": regex },
          ],
        },
      ];
    }

    const tickets = await Order.find(query)
      .populate("restaurant", "name slug phone")
      .populate("user", "name email phone")
      .sort({ updatedAt: -1 })
      .limit(60)
      .lean();

    return NextResponse.json({
      success: true,
      tickets: tickets.map((t) => ({
        id: t._id,
        orderId: t.orderId,
        restaurantName: t.restaurant?.name || "Unknown Kitchen",
        restaurantId: t.restaurant?._id,
        customerName: t.address?.fullName || t.user?.name || "Customer",
        customerPhone: t.address?.phone || t.user?.phone || "",
        customerEmail: t.user?.email || "",
        totalAmount: t.totalAmount,
        status: t.status,
        notes: t.notes || "",
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total: tickets.length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Superadmin respond / resolve support ticket
export async function POST(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { orderId, resolutionNote } = body;

    if (!orderId || !resolutionNote?.trim()) {
      return NextResponse.json(
        { success: false, message: "Order ID and resolution note are required." },
        { status: 400 }
      );
    }

    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    const timestamp = new Date().toLocaleTimeString();
    const noteEntry = `[Superadmin Helpdesk ${timestamp}]: ${resolutionNote.trim()}`;
    order.notes = order.notes ? `${order.notes} | ${noteEntry}` : noteEntry;
    await order.save();

    return NextResponse.json({
      success: true,
      message: "Support resolution note saved.",
      notes: order.notes,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
