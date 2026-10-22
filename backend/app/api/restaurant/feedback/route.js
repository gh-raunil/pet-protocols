import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Feedback, { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES } from "@/models/Feedback";
import Order from "@/models/Order";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import mongoose from "mongoose";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

/**
 * GET /api/restaurant/feedback
 * List feedback for the authenticated restaurant with server-side pagination, filters, and aggregate statistics.
 */
export async function GET(request) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const ratingParam = searchParams.get("rating");
    const hasComplaintParam = searchParams.get("hasComplaint");
    const complaintStatusParam = searchParams.get("complaintStatus");
    const hasResponseParam = searchParams.get("hasResponse");
    const searchQuery = (searchParams.get("search") || "").trim();
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");

    const restaurantObjId = new mongoose.Types.ObjectId(restaurantId);

    // Build base query strictly isolated to authenticated restaurant
    let filter = { restaurant: restaurantObjId };

    // Rating filter
    if (ratingParam && ratingParam !== "all") {
      const parsedRating = parseInt(ratingParam, 10);
      if (parsedRating >= 1 && parsedRating <= 5) {
        filter.rating = parsedRating;
      }
    }

    // Complaint filter
    if (hasComplaintParam === "true") {
      filter["complaint.hasComplaint"] = true;
    } else if (hasComplaintParam === "false") {
      filter["complaint.hasComplaint"] = false;
    }

    // Complaint status filter
    if (complaintStatusParam && complaintStatusParam !== "all" && COMPLAINT_STATUSES.includes(complaintStatusParam)) {
      filter["complaint.hasComplaint"] = true;
      filter["complaint.status"] = complaintStatusParam;
    }

    // Response status filter
    if (hasResponseParam === "true") {
      filter["response.message"] = { $ne: null, $exists: true };
    } else if (hasResponseParam === "false") {
      filter.$or = [
        { "response.message": null },
        { "response.message": { $exists: false } },
        { "response.message": "" },
      ];
    }

    // Date range filter
    if (dateFromParam || dateToParam) {
      filter.createdAt = {};
      if (dateFromParam && /^\d{4}-\d{2}-\d{2}$/.test(dateFromParam)) {
        const [y, m, d] = dateFromParam.split("-").map(Number);
        filter.createdAt.$gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      }
      if (dateToParam && /^\d{4}-\d{2}-\d{2}$/.test(dateToParam)) {
        const [y, m, d] = dateToParam.split("-").map(Number);
        filter.createdAt.$lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      }
      if (Object.keys(filter.createdAt).length === 0) {
        delete filter.createdAt;
      }
    }

    // Search query filter (orderId or comment snippet)
    if (searchQuery) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const cleanSearch = escapeRegex(searchQuery);
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { orderIdString: { $regex: cleanSearch, $options: "i" } },
          { comment: { $regex: cleanSearch, $options: "i" } },
          { "complaint.description": { $regex: cleanSearch, $options: "i" } },
        ],
      });
    }

    // Aggregate statistics across this restaurant's entire feedback collection (non-paginated)
    const statsAgg = await Feedback.aggregate([
      { $match: { restaurant: restaurantObjId } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          star1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
          star2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          star3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          star4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          star5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          unresolvedComplaints: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$complaint.hasComplaint", true] },
                    { $in: ["$complaint.status", ["open", "under_review"]] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          totalComplaints: {
            $sum: {
              $cond: [{ $eq: ["$complaint.hasComplaint", true] }, 1, 0],
            },
          },
          awaitingResponse: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$response.message", null] },
                    { $not: ["$response.message"] },
                    { $eq: ["$response.message", ""] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          avgFoodQuality: { $avg: "$categoryRatings.foodQuality" },
          avgPackaging: { $avg: "$categoryRatings.packaging" },
          avgDelivery: { $avg: "$categoryRatings.delivery" },
          avgService: { $avg: "$categoryRatings.service" },
        },
      },
    ]);

    const statsRaw = statsAgg[0] || {
      totalReviews: 0,
      avgRating: 0,
      star1: 0,
      star2: 0,
      star3: 0,
      star4: 0,
      star5: 0,
      unresolvedComplaints: 0,
      totalComplaints: 0,
      awaitingResponse: 0,
      avgFoodQuality: null,
      avgPackaging: null,
      avgDelivery: null,
      avgService: null,
    };

    const stats = {
      totalReviews: statsRaw.totalReviews,
      averageRating: statsRaw.totalReviews > 0 ? Number(statsRaw.avgRating.toFixed(1)) : 0,
      ratingDistribution: {
        5: statsRaw.star5,
        4: statsRaw.star4,
        3: statsRaw.star3,
        2: statsRaw.star2,
        1: statsRaw.star1,
      },
      unresolvedComplaints: statsRaw.unresolvedComplaints,
      totalComplaints: statsRaw.totalComplaints,
      awaitingResponse: statsRaw.awaitingResponse,
      categoryAverages: {
        foodQuality: statsRaw.avgFoodQuality ? Number(statsRaw.avgFoodQuality.toFixed(1)) : null,
        packaging: statsRaw.avgPackaging ? Number(statsRaw.avgPackaging.toFixed(1)) : null,
        delivery: statsRaw.avgDelivery ? Number(statsRaw.avgDelivery.toFixed(1)) : null,
        service: statsRaw.avgService ? Number(statsRaw.avgService.toFixed(1)) : null,
      },
    };

    // Total count for current filter
    const totalMatching = await Feedback.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalMatching / limit));
    const skip = (page - 1) * limit;

    // Fetch paginated feedback records
    const feedbackDocs = await Feedback.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customer", "name")
      .populate({
        path: "order",
        select: "orderId totalAmount items status orderType createdAt",
      })
      .lean();

    // Map to safe restaurant DTOs respecting anonymity
    const sanitizedFeedback = feedbackDocs.map((doc) => {
      const isAnon = Boolean(doc.isAnonymous);
      let customerData = null;

      if (isAnon) {
        customerData = {
          name: "Anonymous Diner",
          isAnonymous: true,
        };
      } else {
        customerData = {
          name: doc.customer?.name || "Customer",
          isAnonymous: false,
        };
      }

      return {
        _id: doc._id,
        order: doc.order
          ? {
              _id: doc.order._id,
              orderId: doc.order.orderId || doc.orderIdString,
              totalAmount: doc.order.totalAmount,
              status: doc.order.status,
              orderType: doc.order.orderType,
              itemsCount: Array.isArray(doc.order.items) ? doc.order.items.length : 0,
              itemsSummary: Array.isArray(doc.order.items)
                ? doc.order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")
                : "",
              createdAt: doc.order.createdAt,
            }
          : {
              orderId: doc.orderIdString || "N/A",
            },
        orderIdString: doc.orderIdString || "",
        customer: customerData,
        rating: doc.rating,
        categoryRatings: doc.categoryRatings || {},
        comment: doc.comment || "",
        isAnonymous: isAnon,
        complaint: doc.complaint?.hasComplaint ? doc.complaint : { hasComplaint: false },
        response: doc.response?.message ? doc.response : null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    return NextResponse.json(
      {
        success: true,
        feedback: sanitizedFeedback,
        stats,
        pagination: {
          page,
          limit,
          totalMatching,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error listing restaurant feedback:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to list feedback" },
      { status: 500 }
    );
  }
}
