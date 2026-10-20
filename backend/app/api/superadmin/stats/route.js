import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import User from "@/models/User";
import Product from "@/models/Product";
import Category from "@/models/Category";
import Order from "@/models/Order";
import { requireSuperAdmin } from "@/lib/authMiddleware";

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();

    const PlatformSetting = (await import("@/models/PlatformSetting")).default;

    const [
      totalRestaurants,
      activeRestaurants,
      inactiveRestaurants,
      suspendedRestaurants,
      totalAdmins,
      totalCustomers,
      totalProducts,
      totalOrders,
      totalCategories,
      revenueAgg,
      ordersByStatusAgg,
      platformSettings,
    ] = await Promise.all([
      Restaurant.countDocuments({ status: { $ne: "archived" } }),
      Restaurant.countDocuments({ status: "active" }),
      Restaurant.countDocuments({ status: "inactive" }),
      Restaurant.countDocuments({ status: "suspended" }),
      User.countDocuments({ role: { $in: ["restaurant_admin", "admin"] } }),
      User.countDocuments({ role: { $in: ["customer", "user"] } }),
      Product.countDocuments(),
      Order.countDocuments(),
      Category.countDocuments(),
      Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      PlatformSetting.findOne({ key: "global" }).lean(),
    ]);

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;
    const platformFeePercent = platformSettings?.platformFeePercent ?? 5.0;
    const platformRevenue = Math.round((totalRevenue * (platformFeePercent / 100)) * 100) / 100;

    const ordersByStatus = {};
    for (const item of ordersByStatusAgg) {
      if (item._id) ordersByStatus[item._id] = item.count;
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalRestaurants,
        activeRestaurants,
        inactiveRestaurants,
        suspendedRestaurants,
        totalAdmins,
        totalCustomers,
        totalProducts,
        totalOrders,
        totalCategories,
        totalRevenue,
        platformFeePercent,
        platformRevenue,
        ordersByStatus,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
