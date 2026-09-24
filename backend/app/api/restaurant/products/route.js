import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

// GET — List products belonging to this restaurant
export async function GET(request) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    let filter = { restaurant: restaurantId };
    if (category && category !== "All") filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Create a product for this restaurant
export async function POST(request) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const body = await request.json();

    const { name, description, price, image, category, type = "veg", isAvailable = true, isFeatured = false } = body;

    if (!name || !price || !category) {
      return NextResponse.json(
        { success: false, message: "Product name, price, and category are required." },
        { status: 400 }
      );
    }

    await connectDB();

    const product = await Product.create({
      restaurant: restaurantId,
      name: name.trim(),
      description: description || "",
      price: Number(price),
      image: image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
      category,
      type,
      isAvailable: isAvailable !== false,
      isFeatured: !!isFeatured,
    });

    return NextResponse.json({ success: true, message: "Product created successfully!", product }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
