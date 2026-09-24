import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Offer from "@/models/Offer";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

// PUT — Update an offer owned by the logged-in restaurant
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
    const offer = await Offer.findOne({ _id: id, restaurant: restaurantId });
    if (!offer) {
      return NextResponse.json(
        { success: false, message: "Offer not found or unauthorized." },
        { status: 404 }
      );
    }

    if (body.title !== undefined) offer.title = body.title.trim();
    if (body.description !== undefined) offer.description = body.description.trim();
    if (body.discountType !== undefined) offer.discountType = body.discountType;
    if (body.discountValue !== undefined) offer.discountValue = Number(body.discountValue) || 0;
    if (body.minOrder !== undefined) offer.minOrder = Number(body.minOrder) || 0;
    if (body.code !== undefined) offer.code = body.code ? body.code.trim().toUpperCase() : "";
    if (body.startDate !== undefined) offer.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) offer.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.isActive !== undefined) offer.isActive = Boolean(body.isActive);
    if (body.image !== undefined) offer.image = body.image;

    await offer.save();

    return NextResponse.json({
      success: true,
      message: "Offer updated successfully!",
      offer,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — Remove an offer owned by the logged-in restaurant
export async function DELETE(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const { restaurantId } = auth;

    await connectDB();
    const offer = await Offer.findOneAndDelete({ _id: id, restaurant: restaurantId });
    if (!offer) {
      return NextResponse.json(
        { success: false, message: "Offer not found or unauthorized." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Offer deleted successfully!",
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
