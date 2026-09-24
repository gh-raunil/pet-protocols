import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import Product from "@/models/Product";

// GET — List active restaurants for public browsing
export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    let filter = { status: "active" };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { cuisineType: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const restaurants = await Restaurant.find(filter).sort({ rating: -1, createdAt: -1 }).lean();

    // Attach product count to each restaurant
    const enriched = await Promise.all(
      restaurants.map(async (r) => {
        const productCount = await Product.countDocuments({ restaurant: r._id, isAvailable: true });
        return {
          ...r,
          productCount,
        };
      })
    );

    return NextResponse.json({ success: true, restaurants: enriched });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
