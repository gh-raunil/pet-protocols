import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

      let session = null;
      try {
        session = await getServerSession(authOptions);
      } catch (e) {
        // Public submission allowed
      }

      const deleteToken = crypto.randomUUID();
      const newReview = {
        user: session?.user?.id || null,
        deleteToken,
        userName: String(session?.user?.name || userName || "Verified Foodie").trim().slice(0, 80),
        rating: numericRating,
        comment: String(reviewText || "").trim().slice(0, 1000),
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
        numRatings: count,
        reviews: product.reviews,
        reviewId: newReview._id?.toString(),
        deleteToken,
      });
    }

    return NextResponse.json({ success: false, message: "Invalid target type." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit rating", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE — Delete a customer review (Authorized to author, restaurant owner, or superadmin)
export async function DELETE(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    let targetType = searchParams.get("targetType") || "product";
    let targetId = searchParams.get("targetId");
    let reviewId = searchParams.get("reviewId");
    let deleteToken = searchParams.get("deleteToken");
    let reviewerName = searchParams.get("reviewerName");

    // Also support JSON body if query parameters are missing
    if (!targetId || !reviewId) {
      try {
        const body = await request.json();
        targetType = body.targetType || targetType;
        targetId = body.targetId || targetId;
        reviewId = body.reviewId || reviewId;
        deleteToken = body.deleteToken || deleteToken;
        reviewerName = body.reviewerName || reviewerName;
      } catch (e) {
        // Body is optional
      }
    }

    if (!targetId || !reviewId) {
      return NextResponse.json(
        { success: false, message: "Both targetId and reviewId are required to delete a review." },
        { status: 400 }
      );
    }

    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch (e) {
      // Unauthenticated caller
    }

    if (targetType === "product") {
      const product = await Product.findById(targetId);
      if (!product) {
        return NextResponse.json({ success: false, message: "Dish/Product not found." }, { status: 404 });
      }

      const reviewToDelete = (product.reviews || []).find(
        (r) => r._id?.toString() === reviewId.toString() || r.id?.toString() === reviewId.toString()
      );

      if (!reviewToDelete) {
        return NextResponse.json(
          { success: false, message: "Review not found or already deleted." },
          { status: 404 }
        );
      }

      // Authorization verification
      const isSuperAdmin = session?.user?.role === "admin";
      const isRestaurantOwner =
        ["restaurant_admin", "staff"].includes(session?.user?.role) &&
        session?.user?.restaurantId?.toString() === product.restaurant?.toString();
      const isReviewAuthorUser =
        session?.user?.id && reviewToDelete.user && reviewToDelete.user.toString() === session.user.id.toString();
      const isTokenMatch =
        deleteToken && reviewToDelete.deleteToken && String(deleteToken) === String(reviewToDelete.deleteToken);
      // Legacy review fallback (for reviews created before deleteToken existed):
      const isLegacyAuthorMatch =
        !reviewToDelete.deleteToken && !reviewToDelete.user &&
        reviewerName && String(reviewerName).trim().toLowerCase() === String(reviewToDelete.userName).trim().toLowerCase();

      if (!isSuperAdmin && !isRestaurantOwner && !isReviewAuthorUser && !isTokenMatch && !isLegacyAuthorMatch) {
        return NextResponse.json(
          { success: false, message: "You are not authorized to delete this review." },
          { status: 403 }
        );
      }

      product.reviews = product.reviews.filter(
        (r) => r._id?.toString() !== reviewId.toString() && r.id?.toString() !== reviewId.toString()
      );

      // Recompute rating & numRatings
      const count = product.reviews.length;
      if (count === 0) {
        product.rating = null;
        product.numRatings = 0;
      } else {
        const totalStars = product.reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
        product.rating = Number((totalStars / count).toFixed(1));
        product.numRatings = count;
      }

      await product.save();

      return NextResponse.json({
        success: true,
        message: "Review deleted successfully.",
        rating: product.rating,
        numRatings: product.numRatings,
        reviews: product.reviews,
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid target type for review deletion." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete review", error: error.message },
      { status: 500 }
    );
  }
}
