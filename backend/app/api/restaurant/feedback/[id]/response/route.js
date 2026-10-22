import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Feedback from "@/models/Feedback";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { enqueueNotificationEvent } from "@/lib/notificationOutboxService";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

/**
 * POST /api/restaurant/feedback/[id]/response
 * Post or update an official restaurant response to a customer review.
 */
export async function POST(request, { params }) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId, user: staffUser } = auth;
    const resolvedParams = params ? await params : {};
    const { id: feedbackId } = resolvedParams;

    if (!feedbackId || !/^[0-9a-fA-F]{24}$/.test(feedbackId)) {
      return NextResponse.json({ success: false, message: "Valid Feedback ID is required" }, { status: 400 });
    }

    await connectDB();

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return NextResponse.json({ success: false, message: "Feedback record not found" }, { status: 404 });
    }

    // Strict tenant isolation: must belong to the authenticated staff's restaurant
    if (feedback.restaurant.toString() !== restaurantId.toString()) {
      return NextResponse.json(
        { success: false, message: "Access denied. Feedback belongs to a different restaurant." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { message } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, message: "Response message is required and cannot be empty" },
        { status: 400 }
      );
    }

    const cleanMessage = message.trim().slice(0, 2000);
    const isUpdate = Boolean(feedback.response?.message);

    feedback.response = {
      message: cleanMessage,
      respondedAt: feedback.response?.respondedAt || new Date(),
      respondedBy: {
        id: staffUser._id,
        name: staffUser.name || "Restaurant Staff",
        role: staffUser.role || "staff",
      },
      updatedAt: new Date(),
    };

    feedback.auditHistory.push({
      action: isUpdate ? "restaurant_response_updated" : "restaurant_response_posted",
      performedBy: {
        id: staffUser._id,
        name: staffUser.name || "Restaurant Staff",
        role: staffUser.role || "staff",
      },
      note: isUpdate ? "Updated restaurant response" : "Posted initial restaurant response",
      performedAt: new Date(),
    });

    await feedback.save();

    // Enqueue customer notification via durable outbox (non-blocking)
    try {
      if (feedback.customer) {
        await enqueueNotificationEvent({
          eventId: `fb_resp_${feedback._id.toString()}_${Date.now()}`,
          eventType: "restaurant_feedback_responded",
          order: feedback.order,
          orderId: feedback.orderIdString || "",
          restaurant: feedback.restaurant,
          recipient: {
            type: "customer",
            id: feedback.customer,
          },
          channel: "all",
          payload: {
            title: `Restaurant Replied to Your Review`,
            body: cleanMessage.length > 100 ? `${cleanMessage.slice(0, 97)}...` : cleanMessage,
            url: `/orders`,
            data: {
              feedbackId: feedback._id.toString(),
              orderId: feedback.orderIdString || "",
            },
          },
        });
      }
    } catch (notifyErr) {
      console.warn("Response notification outbox enqueue skipped:", notifyErr?.message);
    }

    return NextResponse.json(
      {
        success: true,
        message: isUpdate ? "Response updated successfully" : "Response posted successfully",
        response: feedback.response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error submitting restaurant response:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit response" },
      { status: 500 }
    );
  }
}
