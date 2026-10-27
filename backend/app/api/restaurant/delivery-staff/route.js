import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

/**
 * GET — List Delivery Personnel for Authenticated Restaurant
 *
 * Enforces:
 * - Authenticated restaurant admin or staff with Manager role.
 * - Strict restaurant tenant scoping.
 * - Returns delivery personnel (staff with 'Delivery' role).
 * - Distinguishes active and inactive/suspended accounts.
 * - Annotates each person with active delivery workload count.
 */
export async function GET() {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "orders_view" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    // Query all delivery staff for this restaurant (both active and inactive)
    const deliveryUsers = await User.find({
      restaurant: restaurantId,
      role: "staff",
      $or: [
        { staffRoles: "Delivery" },
        { staffRole: "Delivery" },
      ],
    })
      .select("name email phone status roleTitle staffRole staffRoles createdAt updatedAt")
      .sort({ status: 1, name: 1 })
      .lean();

    const staffIds = deliveryUsers.map((u) => u._id);

    // Compute active workload for each delivery staff member in this restaurant
    // Active deliveries are orders in 'ready' or 'out_for_delivery' assigned to this driver
    const activeOrdersSummary = await Order.aggregate([
      {
        $match: {
          restaurant: restaurantId,
          status: { $in: ["ready", "out_for_delivery"] },
          "assignedDeliveryStaff.id": { $in: staffIds },
        },
      },
      {
        $group: {
          _id: "$assignedDeliveryStaff.id",
          activeCount: { $sum: 1 },
          inTransitCount: {
            $sum: { $cond: [{ $eq: ["$status", "out_for_delivery"] }, 1, 0] },
          },
          readyCount: {
            $sum: { $cond: [{ $eq: ["$status", "ready"] }, 1, 0] },
          },
        },
      },
    ]);

    const workloadMap = new Map();
    activeOrdersSummary.forEach((item) => {
      workloadMap.set(String(item._id), {
        activeCount: item.activeCount || 0,
        inTransitCount: item.inTransitCount || 0,
        readyCount: item.readyCount || 0,
      });
    });

    const deliveryStaff = deliveryUsers.map((u) => {
      const workload = workloadMap.get(String(u._id)) || {
        activeCount: 0,
        inTransitCount: 0,
        readyCount: 0,
      };

      const isActive = u.status === "active";
      const isEligibleForAssignment = isActive;

      return {
        _id: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        status: u.status || "active",
        isActive,
        isEligibleForAssignment,
        roleTitle: u.roleTitle || "Delivery Boy",
        staffRoles: u.staffRoles || (u.staffRole ? [u.staffRole] : ["Delivery"]),
        activeDeliveries: workload.activeCount,
        inTransitDeliveries: workload.inTransitCount,
        readyDeliveries: workload.readyCount,
        availabilityNote: isActive
          ? workload.activeCount === 0
            ? "Available (0 active tasks)"
            : `Busy (${workload.activeCount} active task${workload.activeCount === 1 ? "" : "s"})`
          : `Account ${u.status || "inactive"} (Not eligible for assignment)`,
      };
    });

    return NextResponse.json({
      success: true,
      deliveryStaff,
      totalCount: deliveryStaff.length,
      activeCount: deliveryStaff.filter((d) => d.isActive).length,
      inactiveCount: deliveryStaff.filter((d) => !d.isActive).length,
    });
  } catch (error) {
    console.error("[Get Delivery Staff Error]", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch delivery staff." },
      { status: 500 }
    );
  }
}
