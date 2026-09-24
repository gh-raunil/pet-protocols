import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import User from "@/models/User";
import Product from "@/models/Product";
import Order from "@/models/Order";
import { requireSuperAdmin } from "@/lib/authMiddleware";

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();

    const [
      totalRestaurants,
      activeRestaurants,
      suspendedRestaurants,
      totalAdmins,
      totalCustomers,
      totalProducts,
      totalOrders,
      orders,
    ] = await Promise.all([
      Restaurant.countDocuments(),
      Restaurant.countDocuments({ status: "active" }),
      Restaurant.countDocuments({ status: "suspended" }),
      User.countDocuments({ role: { $in: ["restaurant_admin", "admin"] } }),
      User.countDocuments({ role: { $in: ["customer", "user"] } }),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.find({ status: { $ne: "cancelled" } }).select("totalAmount status createdAt"),
    ]);

    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalRestaurants,
        activeRestaurants,
        suspendedRestaurants,
        totalAdmins,
        totalCustomers,
        totalProducts,
        totalOrders,
        totalRevenue,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
