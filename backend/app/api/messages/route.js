import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Message from "@/models/Message";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import InAppNotification from "@/models/InAppNotification";

// GET — Secure recipient endpoint for active notifications
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const requestedTarget = searchParams.get("target"); // 'restaurants' | 'customers'

    // Verify session for role and secure recipient identification
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    let userId = null;
    let restaurantId = null;

    if (session?.user?.email) {
      const dbUser = await User.findOne({ email: session.user.email.toLowerCase().trim() }).lean();
      if (dbUser) {
        userId = dbUser._id.toString();
        restaurantId = dbUser.restaurant ? dbUser.restaurant.toString() : session.user.restaurantId;
      }
    }

    // Determine target audience
    let target = requestedTarget === "restaurants" ? "restaurants" : "customers";

    const now = new Date();

    // Base query conditions: status must be sent (or scheduled time has arrived), not expired
    const andConditions = [
      {
        $or: [
          { status: "sent", $or: [{ sentAt: null }, { sentAt: { $lte: now } }] },
          { status: "scheduled", scheduledFor: { $lte: now } },
        ],
      },
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      },
    ];

    if (target === "restaurants") {
      // Must be intended for restaurants or all ecosystem
      andConditions.push({ recipientType: { $in: ["all", "restaurants"] } });

      const effectiveRestaurantId = restaurantId || searchParams.get("restaurantId");
      if (effectiveRestaurantId) {
        let restObjectId = null;
        try {
          restObjectId = new mongoose.Types.ObjectId(effectiveRestaurantId);
        } catch (e) {}
        const restMatch = restObjectId ? [effectiveRestaurantId, restObjectId] : [effectiveRestaurantId];

        andConditions.push({
          $or: [
            { recipientSelection: "all" },
            { recipients: { $in: restMatch } },
          ],
        });
      } else {
        andConditions.push({ recipientSelection: "all" });
      }
    } else {
      // Customer notifications: strictly recipientType 'all' or 'customers' (NEVER 'restaurants')
      andConditions.push({ recipientType: { $in: ["all", "customers"] } });

      if (userId) {
        let userObjectId = null;
        try {
          userObjectId = new mongoose.Types.ObjectId(userId);
        } catch (e) {}
        const userMatch = userObjectId ? [userId, userObjectId] : [userId];

        // Authenticated customer: can see broadcasts to all customers OR messages targeting their specific userId
        andConditions.push({
          $or: [
            { recipientSelection: "all" },
            { recipients: { $in: userMatch } },
          ],
        });
      } else {
        // Unauthenticated visitor: only public broadcasts to all customers
        andConditions.push({ recipientSelection: "all" });
      }
    }

    const query = { $and: andConditions };

    const messages = await Message.find(query)
      .sort({ priority: -1, sentAt: -1, createdAt: -1 })
      .limit(50)
      .lean();

    // Determine current recipient identifier for read tracking
    const currentRecipientId = target === "restaurants"
      ? (restaurantId || userId || "partner")
      : (userId || null);

    const formattedMessages = messages.map((m) => {
      const isRead = currentRecipientId
        ? (m.readBy || []).some((r) => r.recipientId === currentRecipientId.toString())
        : false;

      return {
        _id: m._id,
        id: m._id.toString(),
        title: m.title,
        content: m.content,
        summary: m.content,
        messageType: m.messageType,
        tag: m.messageType?.toUpperCase() || "ANNOUNCEMENT",
        priority: m.priority || "normal",
        sentAt: m.sentAt,
        date: m.sentAt
          ? new Date(m.sentAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Recent",
        readBy: m.readBy || [],
        isRead,
        recipientType: m.recipientType,
        recipientSelection: m.recipientSelection,
      };
    });

    // If customer is authenticated, also retrieve in-app order notifications
    let combinedMessages = formattedMessages;
    if (target === "customers" && userId) {
      try {
        const orderNotifs = await InAppNotification.find({ user: userId })
          .sort({ createdAt: -1 })
          .limit(40)
          .lean();

        const formattedOrderNotifs = orderNotifs.map((n) => ({
          _id: n._id,
          id: n._id.toString(),
          title: n.title,
          content: n.content,
          summary: n.content,
          messageType: n.type || "order",
          tag: "ORDER UPDATE",
          priority: "normal",
          sentAt: n.createdAt,
          date: n.createdAt
            ? new Date(n.createdAt).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Recent",
          isRead: Boolean(n.isRead),
          recipientType: "customers",
          orderId: n.orderId,
          url: n.url,
          status: n.status,
          isInAppOrderNotif: true,
        }));

        combinedMessages = [...formattedOrderNotifs, ...formattedMessages].sort((a, b) => {
          const dateA = new Date(a.sentAt || 0).getTime();
          const dateB = new Date(b.sentAt || 0).getTime();
          return dateB - dateA;
        });
      } catch (err) {
        console.warn("[Messages GET] Error loading order notifications:", err.message);
      }
    }

    const unreadCount = combinedMessages.filter((m) => !m.isRead).length;

    return NextResponse.json({
      success: true,
      messages: combinedMessages,
      unreadCount,
    });
  } catch (error) {
    console.error("Messages recipient GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

