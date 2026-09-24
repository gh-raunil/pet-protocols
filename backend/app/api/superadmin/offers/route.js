import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Offer from "@/models/Offer";
import { requireSuperAdmin } from "@/lib/authMiddleware";

// GET — Super Admin list all offers (platform-wide + all restaurants)
export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();
    const offers = await Offer.find()
      .populate("restaurant", "name slug cuisineType")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, offers });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Super Admin create offer (can be platform-wide or restaurant-specific)
export async function POST(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      title,
      description,
      restaurantId = null,
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
      restaurant: restaurantId || null,
      discountType,
      discountValue: Number(discountValue) || 0,
      minOrder: Number(minOrder) || 0,
      code: code ? code.trim().toUpperCase() : "",
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      isActive: Boolean(isActive),
      image: image || "",
      createdBy: auth.user._id,
      creatorRole: "superadmin",
    });

    return NextResponse.json({
      success: true,
      message: "Offer created successfully by Super Admin!",
      offer: newOffer,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
