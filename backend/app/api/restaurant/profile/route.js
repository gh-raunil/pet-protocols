import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Restaurant from "@/models/Restaurant";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET() {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();
    const user = await User.findOne({ email: auth.session.user.email }).select("-password");
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const restaurant = auth.restaurant || (await Restaurant.findById(user.restaurant));

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        image: user.image || "",
        role: user.role,
        roleTitle: user.roleTitle || "Branch Operations Lead",
        restaurantName: restaurant?.name || "",
        restaurantSlug: restaurant?.slug || "",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { name, phone, image, roleTitle } = body;

    await connectDB();
    const user = await User.findOne({ email: auth.session.user.email });
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    if (name) user.name = name.trim();
    if (typeof phone === "string") user.phone = phone.trim();
    if (typeof image === "string") user.image = image.trim();
    if (roleTitle) user.roleTitle = roleTitle.trim();

    await user.save();

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        image: user.image,
        role: user.role,
        roleTitle: user.roleTitle,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
