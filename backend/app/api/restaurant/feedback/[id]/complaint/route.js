import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Feedback, { COMPLAINT_STATUSES } from "@/models/Feedback";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

/**
 * PATCH /api/restaurant/feedback/[id]/complaint
 * Update complaint resolution workflow (open -> under_review -> resolved).
 */
export async function PATCH(request, { params }) {
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

    // Strict tenant isolation
    if (feedback.restaurant.toString() !== restaurantId.toString()) {
      return NextResponse.json(
        { success: false, message: "Access denied. Feedback belongs to a different restaurant." },
        { status: 403 }
      );
    }

    if (!feedback.complaint || !feedback.complaint.hasComplaint) {
      return NextResponse.json(
        { success: false, message: "This feedback entry does not have an active complaint." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { status, resolutionNotes } = body;

    if (!status || !COMPLAINT_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid complaint status. Allowed values: ${COMPLAINT_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const previousStatus = feedback.complaint.status;
    feedback.complaint.status = status;

    if (typeof resolutionNotes === "string") {
      feedback.complaint.resolutionNotes = resolutionNotes.trim().slice(0, 2000);
    }

    if (status === "resolved") {
      feedback.complaint.resolvedAt = new Date();
      feedback.complaint.resolvedBy = {
        id: staffUser._id,
        name: staffUser.name || "Restaurant Staff",
        role: staffUser.role || "staff",
      };
    } else {
      // Reopening or moving to under_review clears resolvedAt unless already resolved
      if (previousStatus === "resolved") {
        feedback.complaint.resolvedAt = null;
        feedback.complaint.resolvedBy = null;
      }
    }

    feedback.auditHistory.push({
      action: "complaint_status_changed",
      performedBy: {
        id: staffUser._id,
        name: staffUser.name || "Restaurant Staff",
        role: staffUser.role || "staff",
      },
      note: `Complaint status changed from '${previousStatus}' to '${status}'. ${
        resolutionNotes ? `Notes: ${resolutionNotes.trim().slice(0, 100)}` : ""
      }`,
      performedAt: new Date(),
    });

    await feedback.save();

    return NextResponse.json(
      {
        success: true,
        message: `Complaint marked as ${status.replace("_", " ")}`,
        complaint: feedback.complaint,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating complaint status:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update complaint status" },
      { status: 500 }
    );
  }
}
