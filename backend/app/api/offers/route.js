import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Offer from "@/models/Offer";
import Restaurant from "@/models/Restaurant";

// GET — List active customer-facing offers
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurant");

    const now = new Date();
    const query = {
      isActive: true,
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gt: now } }],
    };

    if (restaurantId && restaurantId !== "all") {
      query.$or = [
        { restaurant: null }, // platform-wide
        { restaurant: restaurantId }, // restaurant specific
      ];
    }

    const offers = await Offer.find(query)
      .populate("restaurant", "name slug image cuisineType rating phone whatsappNumber address")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      offers: offers || [],
      count: offers?.length || 0,
    });
  } catch (error) {
    console.error("Offers GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
