import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import User from "@/models/User";
import { requireSuperAdmin } from "@/lib/authMiddleware";
import { isValidCoordinate } from "@/lib/geoDistance";

export async function GET(request, { params }) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    await connectDB();

    const restaurant = await Restaurant.findById(id).lean();
    if (!restaurant) {
      return NextResponse.json({ success: false, message: "Restaurant not found" }, { status: 404 });
    }

    const Product = (await import("@/models/Product")).default;
    const [adminCount, productCount, branchAdmins] = await Promise.all([
      User.countDocuments({ restaurant: id, role: { $in: ["restaurant_admin", "admin"] } }),
      Product.countDocuments({ restaurant: id }),
      User.find({ restaurant: id, role: { $in: ["restaurant_admin", "admin"] } })
        .select("-password -visiblePassword")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      restaurant: {
        ...restaurant,
        adminCount,
        productCount,
        admins: branchAdmins,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

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
    if (body.status !== undefined && ["active", "inactive", "suspended", "archived"].includes(body.status)) {
      if (body.status === "active") {
        const targetLat = body.address?.latitude !== undefined ? body.address.latitude : restaurant.address?.latitude;
        const targetLng = body.address?.longitude !== undefined ? body.address.longitude : restaurant.address?.longitude;
        const deliveryActive =
          (restaurant.deliverySettings?.deliveryEnabled !== false) &&
          (restaurant.orderTypes?.delivery !== false);

        if (deliveryActive && !isValidCoordinate(targetLat, targetLng)) {
          return NextResponse.json(
            {
              success: false,
              message: "Cannot activate restaurant for delivery: valid geographical coordinates (latitude and longitude) are required. Please set coordinates before activating.",
            },
            { status: 400 }
          );
        }
      }
      restaurant.status = body.status;
    }
    if (body.name !== undefined) restaurant.name = String(body.name).trim();
    if (body.description !== undefined) restaurant.description = String(body.description).trim();
    if (body.phone !== undefined) restaurant.phone = String(body.phone).trim();
    if (body.whatsappNumber !== undefined) restaurant.whatsappNumber = String(body.whatsappNumber).trim();
    if (body.email !== undefined) restaurant.email = String(body.email).toLowerCase().trim();
    if (body.address !== undefined) restaurant.address = body.address;
    if (body.cuisineType !== undefined) {
      restaurant.cuisineType = Array.isArray(body.cuisineType)
        ? body.cuisineType
        : String(body.cuisineType).split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (body.rating !== undefined) {
      restaurant.rating = body.rating === null || body.rating === "" ? null : Number(body.rating);
    }
    if (body.numRatings !== undefined) {
      restaurant.numRatings = Math.max(0, Number(body.numRatings) || 0);
    }
    if (body.bannerImage !== undefined) restaurant.bannerImage = body.bannerImage;
    if (body.enabledFeatures !== undefined && Array.isArray(body.enabledFeatures)) {
      restaurant.enabledFeatures = body.enabledFeatures;
    }

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
