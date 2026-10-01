import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import { requireSuperAdmin } from "@/lib/authMiddleware";

// GET — List all platform customers with order statistics
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

    const query = {
      role: { $in: ["customer", "user"] },
    };

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    const customers = await User.find(query)
      .select("name email phone status addresses image createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // Fetch order aggregation for each customer
    const userIds = customers.map((c) => c._id);
    const orderAggregates = await Order.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: "$user",
          totalOrders: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [{ $ne: ["$status", "cancelled"] }, "$totalAmount", 0],
            },
          },
          lastOrderDate: { $max: "$createdAt" },
        },
      },
    ]);

    const statsMap = {};
    for (const agg of orderAggregates) {
      statsMap[agg._id.toString()] = {
        totalOrders: agg.totalOrders || 0,
        totalSpent: agg.totalSpent || 0,
        lastOrderDate: agg.lastOrderDate || null,
      };
    }

    const enrichedCustomers = customers.map((c) => {
      const userStats = statsMap[c._id.toString()] || {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null,
      };
      return {
        ...c,
        totalOrders: userStats.totalOrders,
        totalSpent: userStats.totalSpent,
        lastOrderDate: userStats.lastOrderDate,
        addressesCount: Array.isArray(c.addresses) ? c.addresses.length : 0,
      };
    });

    return NextResponse.json({
      success: true,
      customers: enrichedCustomers,
      total: enrichedCustomers.length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH — Update customer status (active / suspended)
export async function PATCH(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { customerId, status } = body;

    if (!customerId || !["active", "suspended"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid customer ID or status." },
        { status: 400 }
      );
    }

    await connectDB();

    const customer = await User.findById(customerId);
    if (!customer) {
      return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });
    }

    customer.status = status;
    await customer.save();

    return NextResponse.json({
      success: true,
      message: `Customer ${status === "active" ? "activated" : "suspended"} successfully.`,
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        status: customer.status,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
