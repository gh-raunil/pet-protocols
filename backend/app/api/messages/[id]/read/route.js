import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Message from "@/models/Message";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await connectDB();

    const session = await getServerSession(authOptions);
    let recipientId = null;
    let userRole = session?.user?.role;

    if (session?.user?.email) {
      const dbUser = await User.findOne({ email: session.user.email.toLowerCase().trim() }).lean();
      if (dbUser) {
        if (dbUser.role === "restaurant_admin" || dbUser.role === "admin") {
          recipientId = dbUser.restaurant ? dbUser.restaurant.toString() : (body.recipientId || dbUser._id.toString());
        } else {
          // For customers: strictly use authenticated MongoDB user ID, never client-supplied ID
          recipientId = dbUser._id.toString();
        }
      }
    }

    if (!recipientId) {
      recipientId = body.recipientId || "anonymous";
    }

    const message = await Message.findById(id);
    if (!message) {
      return NextResponse.json({ success: false, message: "Message not found" }, { status: 404 });
    }

    // Authorization check: customers cannot mark restaurant-only messages
    if ((userRole === "customer" || userRole === "user") && message.recipientType === "restaurants") {
      return NextResponse.json(
        { success: false, message: "Unauthorized to access this message." },
        { status: 403 }
      );
    }

    const alreadyRead = message.readBy?.some((r) => r.recipientId === recipientId);
    if (!alreadyRead) {
      message.readBy.push({
        recipientId,
        readAt: new Date(),
      });
      await message.save();
    }

    return NextResponse.json({
      success: true,
      message: "Marked as read",
      recipientId,
    });
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

