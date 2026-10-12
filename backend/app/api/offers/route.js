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
    const andConditions = [
      { isActive: true },
      {
        $or: [
          { startDate: null },
          { startDate: { $exists: false } },
          { startDate: { $lte: now } },
        ],
      },
      {
        $or: [
          { endDate: null },
          { endDate: { $exists: false } },
          { endDate: { $gt: now } },
        ],
      },
    ];

    if (restaurantId && restaurantId !== "all") {
      andConditions.push({
        $or: [
          { restaurant: null },
          { restaurant: { $exists: false } },
          { restaurant: restaurantId },
        ],
      });
    }

    const query = { $and: andConditions };

    const offers = await Offer.find(query)
      .populate("restaurant", "name slug image cuisineType rating phone whatsappNumber address")
      .populate("targetProducts", "name price image category")
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
