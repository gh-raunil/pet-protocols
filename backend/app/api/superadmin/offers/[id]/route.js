import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Offer from "@/models/Offer";
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
    const offer = await Offer.findById(id);
    if (!offer) {
      return NextResponse.json({ success: false, message: "Offer not found." }, { status: 404 });
    }

    if (body.title !== undefined) offer.title = body.title.trim();
    if (body.description !== undefined) offer.description = body.description.trim();
    if (body.restaurantId !== undefined) offer.restaurant = body.restaurantId || null;
    if (body.discountType !== undefined) offer.discountType = body.discountType === "flat" ? "flat" : "percentage";
    if (body.discountValue !== undefined) offer.discountValue = Math.max(0, Number(body.discountValue) || 0);
    if (body.minOrder !== undefined) offer.minOrder = Math.max(0, Number(body.minOrder) || 0);
    if (body.code !== undefined) offer.code = body.code ? body.code.trim().toUpperCase() : "";
    if (body.startDate !== undefined) offer.startDate = body.startDate ? new Date(body.startDate) : new Date(Date.now() - 60000);
    if (body.endDate !== undefined) offer.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.isActive !== undefined) offer.isActive = Boolean(body.isActive);
    if (body.image !== undefined) offer.image = body.image;
    if (body.targetType !== undefined) offer.targetType = ["all", "category", "products"].includes(body.targetType) ? body.targetType : "all";
    if (body.targetCategory !== undefined) offer.targetCategory = body.targetCategory ? body.targetCategory.trim() : "";
    if (body.targetProducts !== undefined) offer.targetProducts = Array.isArray(body.targetProducts) ? body.targetProducts : [];
    if (body.applyMode !== undefined) offer.applyMode = body.applyMode === "automatic" ? "automatic" : "coupon";

    await offer.save();

    const populatedOffer = await Offer.findById(offer._id)
      .populate("restaurant", "name slug cuisineType")
      .populate("targetProducts", "name price image category")
      .populate("createdBy", "name email")
      .lean();

    return NextResponse.json({
      success: true,
      message: "Offer updated successfully!",
      offer: populatedOffer || offer,
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

    const offer = await Offer.findByIdAndDelete(id);
    if (!offer) {
      return NextResponse.json({ success: false, message: "Offer not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Offer deleted successfully!",
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
