import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Product from '@/models/Product'
import Order from '@/models/Order'
import User from '@/models/User'

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !["admin", "restaurant_admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectDB();

    const isSuperAdmin = session.user.role === "superadmin";
    const userRestaurantId = session.user.restaurantId || session.user.restaurant;

    if (!isSuperAdmin) {
      const Restaurant = (await import("@/models/Restaurant")).default;
      const restDoc = await Restaurant.findById(userRestaurantId).select("status").lean();
      if (restDoc && restDoc.status === "suspended") {
        return NextResponse.json(
          { success: false, message: "Restaurant branch is suspended. Operations are disabled." },
          { status: 403 }
        );
      }
    }

    const productQuery = isSuperAdmin ? {} : { restaurant: userRestaurantId };
    const orderQuery = isSuperAdmin ? {} : { restaurant: userRestaurantId };
    const userQuery = isSuperAdmin
      ? {}
      : { restaurant: userRestaurantId, role: { $in: ["admin", "restaurant_admin", "staff"] } };

    const revenueMatch = isSuperAdmin
      ? { status: { $ne: "cancelled" } }
      : { restaurant: userRestaurantId, status: { $ne: "cancelled" } };

    const [totalProducts, totalOrders, totalUsers, revenueAgg] = await Promise.all([
      Product.countDocuments(productQuery),
      Order.countDocuments(orderQuery),
      User.countDocuments(userQuery),
      Order.aggregate([
        { $match: revenueMatch },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts,
        totalOrders,
        totalUsers,
        totalRevenue,
      },
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}