import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

// GET — Fetch restaurant profile
export async function GET() {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, message: "Restaurant not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, restaurant });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT — Update restaurant profile
export async function PUT(request) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const body = await request.json();

    await connectDB();

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, message: "Restaurant not found." }, { status: 404 });
    }

    if (body.name !== undefined) restaurant.name = body.name.trim();
    if (body.description !== undefined) restaurant.description = body.description;
    if (body.phone !== undefined) restaurant.phone = String(body.phone || '').trim();
    if (body.whatsappNumber !== undefined) {
      const cleanWa = String(body.whatsappNumber || '').trim();
      if (cleanWa && !/^[+]?[\d\s\-()]{7,20}$/.test(cleanWa)) {
        return NextResponse.json(
          { success: false, message: "Please provide a valid WhatsApp phone number (7-20 digits) or leave it empty." },
          { status: 400 }
        );
      }
      restaurant.whatsappNumber = cleanWa;
    }
    if (body.email !== undefined) restaurant.email = body.email;
    if (body.address !== undefined) restaurant.address = body.address;
    if (body.cuisineType !== undefined) {
      restaurant.cuisineType = Array.isArray(body.cuisineType)
        ? body.cuisineType
        : [body.cuisineType];
    }
    if (body.openingHours !== undefined) restaurant.openingHours = body.openingHours;
    if (body.image !== undefined) restaurant.image = body.image;
    if (body.bannerImage !== undefined) restaurant.bannerImage = body.bannerImage;

    await restaurant.save();

    return NextResponse.json({
      success: true,
      message: "Restaurant profile updated successfully!",
      restaurant,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
