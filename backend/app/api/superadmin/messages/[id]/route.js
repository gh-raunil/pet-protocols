import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Message from "@/models/Message";
import { requireSuperAdmin } from "@/lib/authMiddleware";

// PUT — Edit message or cancel scheduled message
export async function PUT(request, { params }) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error, error: auth.error }, { status: auth.status });
    }

    const resolvedParams = params ? await params : {};
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ success: false, message: "Message ID is required" }, { status: 400 });
    }

    const body = await request.json();
    await connectDB();

    // If cancelling scheduled message
    if (body.action === "cancel") {
      const updated = await Message.findByIdAndUpdate(
        id,
        { $set: { status: "cancelled" } },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json({ success: false, message: "Message not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: "Scheduled message cancelled.",
        data: updated,
      });
    }

    // If disabling an active message
    if (body.action === "disable") {
      const updated = await Message.findByIdAndUpdate(
        id,
        { $set: { status: "disabled" } },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json({ success: false, message: "Message not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: "Message disabled and moved to Expired/Disabled.",
        data: updated,
      });
    }

    // If re-enabling a disabled message
    if (body.action === "enable") {
      const updated = await Message.findByIdAndUpdate(
        id,
        { $set: { status: "sent" } },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json({ success: false, message: "Message not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: "Message re-enabled and restored to Sent.",
        data: updated,
      });
    }

    // If publishing/sending a draft or scheduled message now
    if (body.action === "send_now") {
      const updated = await Message.findByIdAndUpdate(
        id,
        { $set: { status: "sent", sentAt: new Date() } },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json({ success: false, message: "Message not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: "Message dispatched immediately.",
        data: updated,
      });
    }

    // General edit
    const updateFields = {};
    if (body.title) updateFields.title = body.title.trim();
    if (body.content) updateFields.content = body.content.trim();
    if (body.messageType) updateFields.messageType = body.messageType;
    if (body.priority) updateFields.priority = body.priority;
    if (body.recipientType) updateFields.recipientType = body.recipientType;
    if (body.recipientSelection) updateFields.recipientSelection = body.recipientSelection;
    if (body.recipients) updateFields.recipients = body.recipients;
    if (body.status) updateFields.status = body.status;
    if (body.scheduledFor) updateFields.scheduledFor = new Date(body.scheduledFor);
    if (body.expiresAt !== undefined) {
      updateFields.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }

    const updated = await Message.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
    if (!updated) {
      return NextResponse.json({ success: false, message: "Message not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Message updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("Superadmin message PUT error:", error);
    return NextResponse.json({
      success: false,
      message: error.message || "Failed to update message",
      error: error.message
    }, { status: 500 });
  }
}

// DELETE — Delete a message
export async function DELETE(request, { params }) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error, error: auth.error }, { status: auth.status });
    }

    const resolvedParams = params ? await params : {};
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ success: false, message: "Message ID is required" }, { status: 400 });
    }

    await connectDB();
    const deleted = await Message.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ success: false, message: "Message not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Message deleted successfully.",
    });
  } catch (error) {
    console.error("Superadmin message DELETE error:", error);
    return NextResponse.json({
      success: false,
      message: error.message || "Failed to delete message",
      error: error.message
    }, { status: 500 });
  }
}
