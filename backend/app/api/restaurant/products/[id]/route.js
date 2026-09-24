import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function PUT(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;
    const body = await request.json();

    await connectDB();

    // Ensure product belongs to this restaurant
    const product = await Product.findOne({ _id: id, restaurant: restaurantId });
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found or not owned by your restaurant." },
        { status: 404 }
      );
    }

    if (body.name !== undefined) product.name = body.name.trim();
    if (body.description !== undefined) product.description = body.description;
    if (body.price !== undefined) product.price = Number(body.price);
    if (body.image !== undefined) product.image = body.image;
    if (body.category !== undefined) product.category = body.category;
    if (body.type !== undefined) product.type = body.type;
    if (body.isAvailable !== undefined) product.isAvailable = Boolean(body.isAvailable);
    if (body.isFeatured !== undefined) product.isFeatured = Boolean(body.isFeatured);

    await product.save();

    return NextResponse.json({ success: true, message: "Product updated successfully!", product });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;

    await connectDB();

    const product = await Product.findOneAndDelete({ _id: id, restaurant: restaurantId });
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found or not owned by your restaurant." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Product deleted successfully!" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
