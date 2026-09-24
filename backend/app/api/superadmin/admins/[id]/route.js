import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { requireSuperAdmin } from "@/lib/authMiddleware";

export async function PUT(request, { params }) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json();

    await connectDB();
    const admin = await User.findById(id).populate("restaurant", "name slug");
    if (!admin) {
      return NextResponse.json({ success: false, message: "Admin user not found" }, { status: 404 });
    }

    if (admin.role === "superadmin") {
      return NextResponse.json(
        { success: false, message: "Super Admin account cannot be modified via this endpoint." },
        { status: 403 }
      );
    }

    if (body.role !== undefined) {
      if (body.role === "superadmin") {
        return NextResponse.json(
          { success: false, message: "Cannot assign SUPERADMIN role via this endpoint." },
          { status: 400 }
        );
      }
      admin.role = "restaurant_admin";
    }
    if (body.status !== undefined) admin.status = body.status;
    if (body.name !== undefined) admin.name = body.name;

    await admin.save();

    return NextResponse.json({
      success: true,
      message: `Admin ${admin.name} status updated to ${admin.status}`,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
        restaurant: admin.restaurant,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    await connectDB();

    const targetAdmin = await User.findById(id);
    if (!targetAdmin) {
      return NextResponse.json({ success: false, message: "Admin user not found" }, { status: 404 });
    }

    if (targetAdmin.role === "superadmin") {
      return NextResponse.json(
        { success: false, message: "Super Admin account cannot be deleted via this endpoint." },
        { status: 403 }
      );
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: "Admin account removed successfully.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
