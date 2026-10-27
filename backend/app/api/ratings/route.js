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

    if (!targetType && !targetId) {
      // Global ratings and reviews showcase for home page
      const productsWithReviews = await Product.find({ "reviews.0": { $exists: true } })
        .select("name reviews")
        .lean();

      let allReviews = [];
      for (const p of productsWithReviews) {
        if (Array.isArray(p.reviews)) {
          for (const r of p.reviews) {
            allReviews.push({
              _id: r._id,
              productName: p.name,
              rating: r.rating || 5,
              comment: r.comment || "",
              review: r.comment || "",
              userName: r.userName || "Verified Foodie",
              createdAt: r.createdAt || new Date(),
            });
          }
        }
      }

      if (allReviews.length > 0) {
        allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      return NextResponse.json({
        success: true,
        ratings: allReviews.slice(0, 10),
      });
    }

    if (!targetType || !targetId) {
      return NextResponse.json(
        { success: false, message: "Both targetType and targetId are required when querying a specific target." },
        { status: 400 }
      );
    }

    if (targetType === "product") {
      const product = await Product.findById(targetId).select("name rating numRatings reviews");
      if (!product) {
        return NextResponse.json({ success: false, message: "Product not found." }, { status: 404 });
      }
      const reviews = product.reviews || [];
      const hasReviews = reviews.length > 0;
      const computedRating = hasReviews
        ? Number((reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1))
        : (typeof product.rating === "number" ? product.rating : null);
      const computedNumRatings = hasReviews ? reviews.length : (product.numRatings || 0);

      return NextResponse.json({
        success: true,
        rating: computedRating,
        numRatings: computedNumRatings,
        reviews: reviews,
      });
    }

    if (targetType === "restaurant") {
      const restaurant = await Restaurant.findById(targetId).select("name rating numRatings");
      if (!restaurant) {
        return NextResponse.json({ success: false, message: "Restaurant not found." }, { status: 404 });
      }
      const hasRatings = typeof restaurant.rating === "number" && (restaurant.numRatings || 0) > 0;
      return NextResponse.json({
        success: true,
        rating: hasRatings ? restaurant.rating : null,
        numRatings: restaurant.numRatings || 0,
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

      const currentNum = restaurant.numRatings || 0;
      const currentAvg = typeof restaurant.rating === "number" && currentNum > 0 ? restaurant.rating : null;
      const newNum = currentNum + 1;
      const newAvg = currentAvg === null
        ? numericRating
        : Number((((currentAvg * currentNum) + numericRating) / newNum).toFixed(1));

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

      const totalStars = product.reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
      const count = product.reviews.length;
      const newAvg = Number((totalStars / count).toFixed(1));

      product.rating = newAvg;
      product.numRatings = count;

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
