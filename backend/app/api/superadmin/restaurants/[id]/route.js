import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
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
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return NextResponse.json({ success: false, message: "Restaurant not found" }, { status: 404 });
    }

    // Update fields
    if (body.status !== undefined) restaurant.status = body.status;
    if (body.name !== undefined) restaurant.name = body.name;
    if (body.description !== undefined) restaurant.description = body.description;
    if (body.phone !== undefined) restaurant.phone = body.phone;
    if (body.whatsappNumber !== undefined) restaurant.whatsappNumber = body.whatsappNumber;
    if (body.email !== undefined) restaurant.email = body.email;
    if (body.address !== undefined) restaurant.address = body.address;
    if (body.cuisineType !== undefined) restaurant.cuisineType = body.cuisineType;
    if (body.rating !== undefined) restaurant.rating = body.rating;
    if (body.image !== undefined) restaurant.image = body.image;
    if (body.bannerImage !== undefined) restaurant.bannerImage = body.bannerImage;

    await restaurant.save();

    return NextResponse.json({
      success: true,
      message: `Restaurant updated successfully (Status: ${restaurant.status})`,
      restaurant,
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

    const restaurant = await Restaurant.findByIdAndDelete(id);
    if (!restaurant) {
      return NextResponse.json({ success: false, message: "Restaurant not found" }, { status: 404 });
    }

    // Also suspend or remove associated admins
    await User.updateMany(
      { restaurant: id },
      { status: "suspended" }
    );

    return NextResponse.json({
      success: true,
      message: "Restaurant deleted and associated admins deactivated.",
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
