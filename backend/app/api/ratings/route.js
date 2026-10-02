import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import Product from "@/models/Product";

// GET — Fetch reviews for a product or restaurant
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("targetType");
    const targetId = searchParams.get("targetId");

    if (!targetType || !targetId) {
      return NextResponse.json(
        { success: false, message: "targetType and targetId are required." },
        { status: 400 }
      );
    }

    if (targetType === "product") {
      const product = await Product.findById(targetId).select("name rating numRatings reviews");
      if (!product) {
        return NextResponse.json({ success: false, message: "Product not found." }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        rating: product.rating || 4.8,
        numRatings: product.numRatings || 12,
        reviews: product.reviews || [],
      });
    }

    if (targetType === "restaurant") {
      const restaurant = await Restaurant.findById(targetId).select("name rating numRatings");
      if (!restaurant) {
        return NextResponse.json({ success: false, message: "Restaurant not found." }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        rating: restaurant.rating || 4.8,
        numRatings: restaurant.numRatings || 28,
        reviews: [],
      });
    }

    return NextResponse.json({ success: false, message: "Invalid target type." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Submit a new rating & review
export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { targetType, targetId, rating, reviewText, userName } = body;

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

      if (!product.reviews) {
        product.reviews = [];
      }

      const newReview = {
        userName: String(userName || "Verified Foodie").trim(),
        rating: numericRating,
        comment: String(reviewText || "").trim(),
        createdAt: new Date(),
      };
      product.reviews.unshift(newReview);

      await product.save();

      return NextResponse.json({
        success: true,
        message: "Thank you! Your rating and feedback were submitted successfully.",
        rating: newAvg,
        numRatings: newNum,
        reviews: product.reviews,
      });
    }

    return NextResponse.json({ success: false, message: "Invalid target type." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
