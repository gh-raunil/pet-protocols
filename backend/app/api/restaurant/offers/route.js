import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Offer from "@/models/Offer";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

// GET — List offers for the logged-in restaurant
export async function GET() {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const offers = await Offer.find({ restaurant: restaurantId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, offers });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Create a new offer for the logged-in restaurant only
export async function POST(request) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId, user } = auth;
    const body = await request.json();
    const {
      title,
      description,
      discountType = "percentage",
      discountValue = 0,
      minOrder = 0,
      code = "",
      startDate,
      endDate,
      isActive = true,
      image = "",
    } = body;

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json(
        { success: false, message: "Offer title and description are required." },
        { status: 400 }
      );
    }

    await connectDB();

    const newOffer = await Offer.create({
      title: title.trim(),
      description: description.trim(),
      restaurant: restaurantId, // Strictly enforced: restaurant admin cannot specify another restaurant
      discountType,
      discountValue: Number(discountValue) || 0,
      minOrder: Number(minOrder) || 0,
      code: code ? code.trim().toUpperCase() : "",
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      isActive: Boolean(isActive),
      image: image || "",
      createdBy: user._id,
      creatorRole: "restaurant_admin",
    });

    return NextResponse.json({
      success: true,
      message: "Offer created successfully!",
      offer: newOffer,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
