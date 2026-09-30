import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import Product from "@/models/Product";

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { targetType, targetId, rating, reviewText } = body; // targetType: 'restaurant' | 'product'

    if (!targetType || !targetId || !rating) {
      return NextResponse.json(
        { success: false, message: "Target type, target ID, and rating value (1-5) are required." },
        { status: 400 }
      );
    }

    const numericRating = Math.max(1, Math.min(5, Number(rating)));

    if (targetType === "restaurant") {
      const restaurant = await Restaurant.findById(targetId);
      if (!restaurant) {
        return NextResponse.json({ success: false, message: "Restaurant not found." }, { status: 404 });
      }

      const currentNum = restaurant.numRatings || 1;
      const currentAvg = restaurant.rating || 4.8;
      const newNum = currentNum + 1;
      const newAvg = Number((((currentAvg * currentNum) + numericRating) / newNum).toFixed(1));

      restaurant.rating = newAvg;
      restaurant.numRatings = newNum;
      await restaurant.save();

      return NextResponse.json({
        success: true,
        message: "Restaurant rating submitted successfully!",
        rating: newAvg,
        numRatings: newNum,
      });
    }

    if (targetType === "product") {
      const product = await Product.findById(targetId);
      if (!product) {
        return NextResponse.json({ success: false, message: "Dish/Product not found." }, { status: 404 });
      }

      const currentNum = product.numRatings || 1;
      const currentAvg = product.rating || 4.8;
      const newNum = currentNum + 1;
      const newAvg = Number((((currentAvg * currentNum) + numericRating) / newNum).toFixed(1));

      product.rating = newAvg;
      product.numRatings = newNum;
      await product.save();

      return NextResponse.json({
        success: true,
        message: "Dish rating submitted successfully!",
        rating: newAvg,
        numRatings: newNum,
      });
    }

    return NextResponse.json({ success: false, message: "Invalid target type." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
