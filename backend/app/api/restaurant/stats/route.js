import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET(request) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurant, restaurantId } = auth;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date"); // optional YYYY-MM-DD
    const searchQuery = (searchParams.get("search") || "").trim();

    // Determine today's range (00:00:00 to 23:59:59.999 local/UTC)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // If dateParam is provided, parse it
    let selectedStart = todayStart;
    let selectedEnd = todayEnd;
    let isCustomDate = false;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [year, month, day] = dateParam.split("-").map(Number);
      selectedStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      selectedEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
      isCustomDate = true;
    }

    // Queries
    const [
      totalProducts,
      totalOrders,
      allNonCancelledOrders,
      todayNonCancelledOrders,
      todayOrdersCount,
      selectedNonCancelledOrders,
      selectedOrdersCount,
    ] = await Promise.all([
      Product.countDocuments({ restaurant: restaurantId }),
      Order.countDocuments({ restaurant: restaurantId }),
      Order.find({ restaurant: restaurantId, status: { $ne: "cancelled" } }).select("totalAmount"),
      Order.find({
        restaurant: restaurantId,
        status: { $ne: "cancelled" },
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }).select("totalAmount"),
      Order.countDocuments({
        restaurant: restaurantId,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
      Order.find({
        restaurant: restaurantId,
        status: { $ne: "cancelled" },
        createdAt: { $gte: selectedStart, $lte: selectedEnd },
      }).select("totalAmount"),
      Order.countDocuments({
        restaurant: restaurantId,
        createdAt: { $gte: selectedStart, $lte: selectedEnd },
      }),
    ]);

    const totalRevenue = allNonCancelledOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const todayRevenue = todayNonCancelledOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const selectedDateRevenue = selectedNonCancelledOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Fetch recent orders for selected date (or today)
    let recentQuery = {
      restaurant: restaurantId,
    };

    if (!searchQuery) {
      recentQuery.createdAt = { $gte: selectedStart, $lte: selectedEnd };
    } else {
      // If searching, check selected date first or search broadly
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

      recentQuery.$or = orConditions;
      if (isCustomDate) {
        recentQuery.createdAt = { $gte: selectedStart, $lte: selectedEnd };
      }
    }

    let recentOrders = await Order.find(recentQuery)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    // Fallback: If searching by orderId or customer and 0 results found in filtered date, search across all dates
    if (recentOrders.length === 0 && searchQuery && recentQuery.createdAt) {
      const fallbackQuery = { ...recentQuery };
      delete fallbackQuery.createdAt;
      recentOrders = await Order.find(fallbackQuery)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .lean();
    }

    // Fallback: If no orders exist on today yet, and it's not a custom date filter, show the 5 most recent orders
    if (recentOrders.length === 0 && !isCustomDate && !searchQuery) {
      recentOrders = await Order.find({ restaurant: restaurantId })
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
    }

    return NextResponse.json({
      success: true,
      stats: {
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        restaurantStatus: restaurant.status,
        restaurantCreatedAt: restaurant.createdAt || null,
        totalProducts,
        totalOrders,
        totalRevenue,
        todayOrders: todayOrdersCount,
        todayRevenue,
        selectedDateOrders: selectedOrdersCount,
        selectedDateRevenue,
        selectedDate: dateParam || todayStart.toISOString().split("T")[0],
      },
      recentOrders,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
