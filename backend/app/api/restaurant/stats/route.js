import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET() {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurant, restaurantId } = auth;
    await connectDB();

    const [totalProducts, totalOrders, orders, recentOrders] = await Promise.all([
      Product.countDocuments({ restaurant: restaurantId }),
      Order.countDocuments({ restaurant: restaurantId }),
      Order.find({ restaurant: restaurantId, status: { $ne: "cancelled" } }).select("totalAmount"),
      Order.find({ restaurant: restaurantId }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    return NextResponse.json({
      success: true,
      stats: {
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        restaurantStatus: restaurant.status,
        totalProducts,
        totalOrders,
        totalRevenue,
      },
      recentOrders,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
