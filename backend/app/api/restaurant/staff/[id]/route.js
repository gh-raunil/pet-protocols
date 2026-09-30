import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { derivePermissions } from "../route";

// PUT — Update an existing staff member
export async function PUT(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const { restaurantId } = auth;
    const body = await request.json();

    await connectDB();

    // Verify staff belongs to this restaurant and is not superadmin
    const staff = await User.findOne({
      _id: id,
      restaurant: restaurantId,
      role: { $in: ["staff", "restaurant_admin"] },
    });

    if (!staff) {
      return NextResponse.json(
        { success: false, message: "Staff member not found or unauthorized." },
        { status: 404 }
      );
    }

    if (body.name !== undefined) staff.name = body.name.trim();
    if (body.phone !== undefined) staff.phone = String(body.phone || "").trim();

    if (body.staffRoles !== undefined && Array.isArray(body.staffRoles)) {
      const roles = body.staffRoles.length > 0 ? body.staffRoles : ["Kitchen"];
      staff.staffRoles = roles;
      staff.staffRole = roles.join(", ");
      staff.roleTitle = roles.join(" • ");
      if (body.permissions === undefined) {
        staff.permissions = derivePermissions(roles);
      }
    } else if (body.staffRole !== undefined) {
      staff.staffRole = body.staffRole;
      staff.staffRoles = [body.staffRole];
      staff.roleTitle = body.staffRole;
      if (body.permissions === undefined) {
        staff.permissions = derivePermissions([body.staffRole]);
      }
    }

    if (body.permissions !== undefined && Array.isArray(body.permissions)) {
      staff.permissions = body.permissions;
    }
    if (body.status !== undefined) staff.status = body.status;

    // Optional password reset
    if (body.password && body.password.trim().length >= 6) {
      staff.password = await bcrypt.hash(body.password.trim(), 10);
    }

    // SECURITY: Ensure role remains safe (never escalate to superadmin)
    if (staff.role !== "restaurant_admin") {
      staff.role = "staff";
    }

    await staff.save();

    const sanitized = staff.toObject();
    delete sanitized.password;

    return NextResponse.json({
      success: true,
      message: "Staff member updated successfully!",
      staff: sanitized,
    });
  } catch (error) {
    console.error("Update staff error:", error);
    return NextResponse.json({ success: false, message: error.message, error: error.message }, { status: 500 });
  }
}

// DELETE — Remove a staff member
export async function DELETE(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const { restaurantId, user } = auth;

    // Prevent restaurant admin from deleting themselves
    if (String(user._id) === String(id)) {
      return NextResponse.json(
        { success: false, message: "You cannot delete your own primary administrator account." },
        { status: 400 }
      );
    }

    await connectDB();

    const deleted = await User.findOneAndDelete({
      _id: id,
      restaurant: restaurantId,
      role: "staff", // Only staff can be deleted this way
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Staff member not found or cannot be removed." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Staff member removed successfully!",
    });
  } catch (error) {
    console.error("Delete staff error:", error);
    return NextResponse.json({ success: false, message: error.message, error: error.message }, { status: 500 });
  }
}
