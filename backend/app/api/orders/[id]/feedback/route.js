import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import Feedback, { COMPLAINT_CATEGORIES } from "@/models/Feedback";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enqueueNotificationEvent } from "@/lib/notificationOutboxService";

let _getServerSession = getServerSession;
export function _setTestGetServerSession(fn) {
  _getServerSession = fn;
}

async function resolveSession() {
  try {
    return await _getServerSession(authOptions);
  } catch {
    return null;
  }
}

/**
 * Helper to resolve order and verify customer ownership.
 */
async function resolveAndAuthorizeCustomerOrder(orderParamId, sessionUser) {
  if (!sessionUser || !sessionUser.email) {
    return { error: "Authentication required", status: 401 };
  }

  const dbUser = await User.findOne({ email: sessionUser.email.toLowerCase().trim() });
  if (!dbUser) {
    return { error: "User not found", status: 404 };
  }

  const isObjectId = orderParamId.length === 24 && /^[0-9a-fA-F]{24}$/.test(orderParamId);
  const orderIdentifierFilter = {
    $or: [{ orderId: orderParamId }, ...(isObjectId ? [{ _id: orderParamId }] : [])],
  };

  const order = await Order.findOne(orderIdentifierFilter);
  if (!order) {
    return { error: "Order not found", status: 404 };
  }

  // Check ownership
  const isOwnerUser = order.user && order.user.toString() === dbUser._id.toString();
  const isOwnerPhone = Boolean(dbUser.phone && order.address?.phone && order.address.phone.trim() === dbUser.phone.trim());

  if (!isOwnerUser && !isOwnerPhone && sessionUser.role !== "superadmin") {
    // Non-leaky 404 to avoid leaking whether the order exists to another customer
    return { error: "Order not found", status: 404 };
  }

  return { dbUser, order };
}

/**
 * POST /api/orders/[id]/feedback
 * Submit customer feedback, rating, optional category ratings, and optional complaint.
 */
export async function POST(request, { params }) {
  try {
    const session = await resolveSession();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const resolvedParams = params ? await params : {};
    const { id: orderParamId } = resolvedParams;

    if (!orderParamId) {
      return NextResponse.json({ success: false, message: "Order ID is required" }, { status: 400 });
    }

    await connectDB();

    const authResult = await resolveAndAuthorizeCustomerOrder(orderParamId, session.user);
    if (authResult.error) {
      return NextResponse.json({ success: false, message: authResult.error }, { status: authResult.status });
    }

    const { dbUser, order } = authResult;

    // Strict completed-order eligibility check
    if (order.status !== "delivered") {
      return NextResponse.json(
        {
          success: false,
          message: `Feedback can only be submitted for completed orders. Current order status: ${order.status}`,
        },
        { status: 400 }
      );
    }

    // Check if feedback already exists before insertion
    const existingFeedback = await Feedback.findOne({ order: order._id });
    if (existingFeedback) {
      return NextResponse.json(
        {
          success: false,
          message: "Feedback has already been submitted for this order.",
          feedbackId: existingFeedback._id,
        },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      rating,
      categoryRatings,
      comment,
      isAnonymous = false,
      complaint,
    } = body;

    // Validate overall rating
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, message: "Rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    // Validate category ratings if supplied
    const validatedCategoryRatings = {};
    if (categoryRatings && typeof categoryRatings === "object") {
      const allowedCategories = ["foodQuality", "packaging", "delivery", "service"];
      for (const cat of allowedCategories) {
        if (categoryRatings[cat] !== undefined && categoryRatings[cat] !== null) {
          const val = Number(categoryRatings[cat]);
          if (!Number.isInteger(val) || val < 1 || val > 5) {
            return NextResponse.json(
              { success: false, message: `Category rating for '${cat}' must be an integer between 1 and 5` },
              { status: 400 }
            );
          }
          validatedCategoryRatings[cat] = val;
        }
      }
    }

    // Validate comment length
    const cleanComment = typeof comment === "string" ? comment.trim().slice(0, 2000) : "";

    // Validate complaint if supplied
    const validatedComplaint = {
      hasComplaint: false,
      category: null,
      description: "",
      status: "open",
    };

    if (complaint && complaint.hasComplaint) {
      if (!complaint.category || !COMPLAINT_CATEGORIES.includes(complaint.category)) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid complaint category. Must be one of: ${COMPLAINT_CATEGORIES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      validatedComplaint.hasComplaint = true;
      validatedComplaint.category = complaint.category;
      validatedComplaint.description = typeof complaint.description === "string" ? complaint.description.trim().slice(0, 2000) : "";
    }

    try {
      const newFeedback = await Feedback.create({
        order: order._id,
        orderIdString: order.orderId || order._id.toString(),
        customer: dbUser._id,
        restaurant: order.restaurant,
        rating,
        categoryRatings: validatedCategoryRatings,
        comment: cleanComment,
        isAnonymous: Boolean(isAnonymous),
        complaint: validatedComplaint,
        auditHistory: [
          {
            action: "feedback_created",
            performedBy: {
              id: dbUser._id,
              name: dbUser.name || "Customer",
              role: "customer",
            },
            note: validatedComplaint.hasComplaint ? `Complaint filed: ${validatedComplaint.category}` : "Review submitted",
          },
        ],
      });

      // Non-blocking notification outbox event
      try {
        const eventId = `fb_sub_${newFeedback._id.toString()}`;
        await enqueueNotificationEvent({
          eventId,
          eventType: validatedComplaint.hasComplaint ? "customer_complaint_raised" : "customer_feedback_submitted",
          order: order._id,
          orderId: order.orderId || "",
          restaurant: order.restaurant,
          recipient: {
            type: "restaurant_admins",
          },
          channel: "all",
          payload: {
            title: validatedComplaint.hasComplaint
              ? `New Order Complaint: #${order.orderId || order._id}`
              : `New Customer Review: ${rating}★ for #${order.orderId || order._id}`,
            body: validatedComplaint.hasComplaint
              ? `A customer raised a ${validatedComplaint.category.replace(/_/g, " ")} complaint.`
              : cleanComment || `Order received a ${rating} star rating.`,
            url: `/feedback?orderId=${order.orderId || order._id}`,
            data: {
              feedbackId: newFeedback._id.toString(),
              orderId: order.orderId || "",
              rating,
              hasComplaint: validatedComplaint.hasComplaint,
            },
          },
        });
      } catch (notifyErr) {
        // Notification failure must never block feedback persistence
        console.warn("Feedback outbox enqueue skipped or failed:", notifyErr?.message);
      }

      return NextResponse.json(
        {
          success: true,
          message: "Feedback submitted successfully",
          feedback: newFeedback.toCustomerDTO(dbUser._id),
        },
        { status: 201 }
      );
    } catch (insertErr) {
      if (insertErr.code === 11000) {
        return NextResponse.json(
          {
            success: false,
            message: "Feedback has already been submitted for this order.",
          },
          { status: 409 }
        );
      }
      throw insertErr;
    }
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/[id]/feedback
 * Fetch feedback for a specific order.
 */
export async function GET(request, { params }) {
  try {
    const session = await resolveSession();
    const resolvedParams = params ? await params : {};
    const { id: orderParamId } = resolvedParams;

    if (!orderParamId) {
      return NextResponse.json({ success: false, message: "Order ID is required" }, { status: 400 });
    }

    await connectDB();

    const isObjectId = orderParamId.length === 24 && /^[0-9a-fA-F]{24}$/.test(orderParamId);
    const order = await Order.findOne({
      $or: [{ orderId: orderParamId }, ...(isObjectId ? [{ _id: orderParamId }] : [])],
    });

    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    const feedback = await Feedback.findOne({ order: order._id })
      .populate("customer", "name")
      .populate("restaurant", "name");

    if (!feedback) {
      return NextResponse.json(
        { success: true, feedback: null, message: "No feedback found for this order" },
        { status: 200 }
      );
    }

    let viewerUserId = null;
    if (session?.user?.email) {
      const dbUser = await User.findOne({ email: session.user.email.toLowerCase().trim() });
      if (dbUser) viewerUserId = dbUser._id;
    }

    return NextResponse.json(
      {
        success: true,
        feedback: feedback.toCustomerDTO(viewerUserId),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching order feedback:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orders/[id]/feedback
 * Update an existing review (rating, comment, categoryRatings, anonymity).
 */
export async function PUT(request, { params }) {
  try {
    const session = await resolveSession();
    if (!session || !session.user) {
      return NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    }

    const resolvedParams = params ? await params : {};
    const { id: orderParamId } = resolvedParams;

    if (!orderParamId) {
      return NextResponse.json({ success: false, message: "Order ID is required" }, { status: 400 });
    }

    await connectDB();

    const authResult = await resolveAndAuthorizeCustomerOrder(orderParamId, session.user);
    if (authResult.error) {
      return NextResponse.json({ success: false, message: authResult.error }, { status: authResult.status });
    }

    const { dbUser, order } = authResult;

    const feedback = await Feedback.findOne({ order: order._id });
    if (!feedback) {
      return NextResponse.json({ success: false, message: "Feedback record not found" }, { status: 404 });
    }

    // Verify feedback was submitted by this user
    if (feedback.customer.toString() !== dbUser._id.toString()) {
      return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { rating, categoryRatings, comment, isAnonymous } = body;

    if (rating !== undefined) {
      if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json(
          { success: false, message: "Rating must be an integer between 1 and 5" },
          { status: 400 }
        );
      }
      feedback.rating = rating;
    }

    if (categoryRatings && typeof categoryRatings === "object") {
      const allowedCategories = ["foodQuality", "packaging", "delivery", "service"];
      const updatedCatRatings = { ...(feedback.categoryRatings?.toObject?.() || feedback.categoryRatings || {}) };
      for (const cat of allowedCategories) {
        if (categoryRatings[cat] !== undefined) {
          const val = Number(categoryRatings[cat]);
          if (!Number.isInteger(val) || val < 1 || val > 5) {
            return NextResponse.json(
              { success: false, message: `Category rating for '${cat}' must be an integer between 1 and 5` },
              { status: 400 }
            );
          }
          updatedCatRatings[cat] = val;
        }
      }
      feedback.categoryRatings = updatedCatRatings;
    }

    if (comment !== undefined) {
      feedback.comment = typeof comment === "string" ? comment.trim().slice(0, 2000) : "";
    }

    if (isAnonymous !== undefined) {
      feedback.isAnonymous = Boolean(isAnonymous);
    }

    feedback.auditHistory.push({
      action: "feedback_updated_by_customer",
      performedBy: {
        id: dbUser._id,
        name: dbUser.name || "Customer",
        role: "customer",
      },
      note: "Customer updated rating or review text",
    });

    await feedback.save();

    return NextResponse.json(
      {
        success: true,
        message: "Feedback updated successfully",
        feedback: feedback.toCustomerDTO(dbUser._id),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating order feedback:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update feedback" },
      { status: 500 }
    );
  }
}
