import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

// GET — List all staff members for the authenticated restaurant
export async function GET() {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const staffList = await User.find({
      restaurant: restaurantId,
      role: { $in: ["staff", "restaurant_admin"] },
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, staff: staffList });
  } catch (error) {
    console.error("Get staff error:", error);
    return NextResponse.json({ success: false, message: error.message, error: error.message }, { status: 500 });
  }
}

export const ROLE_PERMISSIONS_MAP = {
  Manager: ["orders_view", "orders_update", "products_view", "products_manage", "customers_view", "dashboard_view"],
  Kitchen: ["orders_view", "orders_update"],
  Cashier: ["orders_view", "orders_update", "customers_view"],
  Delivery: ["orders_view", "orders_update"],
  Inventory: ["products_view", "products_manage"],
  Support: ["orders_view", "customers_view"],
};

export function derivePermissions(roles = [], customPermissions = []) {
  const permSet = new Set(Array.isArray(customPermissions) ? customPermissions : []);
  roles.forEach((r) => {
    const perms = ROLE_PERMISSIONS_MAP[r] || [];
    perms.forEach((p) => permSet.add(p));
  });
  if (permSet.size === 0) {
    permSet.add("orders_view");
    permSet.add("orders_update");
  }
  return Array.from(permSet);
}

// POST — Create a new staff member for this restaurant
export async function POST(request) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const body = await request.json();
    const {
      name,
      email,
      phone = "",
      staffRole,
      staffRoles = [],
      permissions = [],
      password = "TempPassword@123",
      status = "active",
    } = body;

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { success: false, message: "Staff name and email are required." },
        { status: 400 }
      );
    }

    // Normalize multiple roles
    const assignedRoles = Array.isArray(staffRoles) && staffRoles.length > 0
      ? staffRoles
      : (staffRole ? [staffRole] : ["Kitchen"]);

    const primaryRole = assignedRoles.join(", ");
    const derivedPermissions = derivePermissions(assignedRoles, permissions);

    await connectDB();

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "A user with this email address already exists." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password || "TempPassword@123", 10);

    // SECURITY: Strictly assign role to 'staff' and restaurant to current restaurantId
    // Restaurant admin can NEVER create a superadmin
    const newStaff = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password: hashedPassword,
      role: "staff",
      staffRole: primaryRole,
      staffRoles: assignedRoles,
      roleTitle: assignedRoles.join(" • "),
      permissions: derivedPermissions,
      restaurant: restaurantId,
      status: status || "active",
    });

    const sanitized = newStaff.toObject();
    delete sanitized.password;

    return NextResponse.json({
      success: true,
      message: "Staff member added successfully!",
      staff: sanitized,
    });
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json({ success: false, message: error.message, error: error.message }, { status: 500 });
  }
}
