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
      .populate("targetProducts", "name price image category")
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
      targetType = "all",
      targetCategory = "",
      targetProducts = [],
      applyMode = "coupon",
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
      discountType: discountType === "flat" ? "flat" : "percentage",
      discountValue: Math.max(0, Number(discountValue) || 0),
      minOrder: Math.max(0, Number(minOrder) || 0),
      code: code ? code.trim().toUpperCase() : "",
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 60000),
      endDate: endDate ? new Date(endDate) : null,
      isActive: Boolean(isActive),
      image: image || "",
      targetType: ["all", "category", "products"].includes(targetType) ? targetType : "all",
      targetCategory: targetCategory ? targetCategory.trim() : "",
      targetProducts: Array.isArray(targetProducts) ? targetProducts : [],
      applyMode: applyMode === "automatic" ? "automatic" : "coupon",
      createdBy: auth.user._id,
      creatorRole: "superadmin",
    });

    const populatedOffer = await Offer.findById(newOffer._id)
      .populate("restaurant", "name slug cuisineType")
      .populate("targetProducts", "name price image category")
      .populate("createdBy", "name email")
      .lean();

    return NextResponse.json({
      success: true,
      message: "Offer created successfully by Super Admin!",
      offer: populatedOffer || newOffer,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
