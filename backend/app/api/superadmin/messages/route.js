import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Message from "@/models/Message";
import Restaurant from "@/models/Restaurant";
import User from "@/models/User";
import { requireSuperAdmin } from "@/lib/authMiddleware";

// GET — List messages with filters & metrics
export async function GET(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "sent";
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "all";
    const priority = searchParams.get("priority") || "all";

    const query = {};
    if (status !== "all") {
      if (status === "disabled") {
        query.status = { $in: ["disabled", "expired", "cancelled"] };
      } else {
        query.status = status;
      }
    }
    if (type !== "all") {
      query.messageType = type;
    }
    if (priority !== "all") {
      query.priority = priority;
    }
    if (search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { content: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const [messages, sentCount, scheduledCount, draftCount, disabledCount] = await Promise.all([
      Message.find(query).sort({ createdAt: -1 }).populate("createdBy", "name email").lean(),
      Message.countDocuments({ status: "sent" }),
      Message.countDocuments({ status: "scheduled" }),
      Message.countDocuments({ status: "draft" }),
      Message.countDocuments({ status: { $in: ["disabled", "expired", "cancelled"] } }),
    ]);

    // Format messages with recipient count and read metrics
    const totalRestaurantsCount = await Restaurant.countDocuments({ status: "active" });
    const totalCustomersCount = await User.countDocuments({ role: "customer" });

    const enriched = messages.map((m) => {
      let recipientCount = 0;
      if (m.recipientSelection === "all") {
        if (m.recipientType === "all") recipientCount = totalRestaurantsCount + totalCustomersCount;
        else if (m.recipientType === "restaurants") recipientCount = totalRestaurantsCount;
        else if (m.recipientType === "customers") recipientCount = totalCustomersCount;
      } else {
        recipientCount = m.recipients?.length || 0;
      }

      return {
        ...m,
        recipientCount,
        readCount: m.readBy?.length || 0,
      };
    });

    return NextResponse.json({
      success: true,
      messages: enriched,
      stats: {
        sentCount,
        scheduledCount,
        draftCount,
        disabledCount,
        total: sentCount + scheduledCount + draftCount + disabledCount,
      },
    });
  } catch (error) {
    console.error("Superadmin messages GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Create a new message (send now / schedule / draft)
export async function POST(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      title,
      content,
      messageType = "general",
      priority = "normal",
      recipientType = "restaurants",
      recipientSelection = "all",
      recipients = [],
      status = "sent",
      scheduledFor = null,
      expiresAt = null,
    } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { success: false, message: "Title and content are required." },
        { status: 400 }
      );
    }

    await connectDB();

    const recipientModel = recipientType === "customers" ? "User" : "Restaurant";

    const newMessage = await Message.create({
      title: title.trim(),
      content: content.trim(),
      messageType,
      priority,
      recipientType,
      recipientSelection,
      recipients: recipientSelection === "selected" ? recipients : [],
      recipientModel,
      status,
      scheduledFor: status === "scheduled" && scheduledFor ? new Date(scheduledFor) : null,
      sentAt: status === "sent" ? new Date() : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: auth.user._id,
    });

    return NextResponse.json({
      success: true,
      message:
        status === "sent"
          ? "Message broadcasted successfully!"
          : status === "scheduled"
          ? "Message scheduled successfully!"
          : "Message saved as draft.",
      data: newMessage,
    });
  } catch (error) {
    console.error("Superadmin messages POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
