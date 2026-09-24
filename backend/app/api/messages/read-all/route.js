import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Message from "@/models/Message";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: "Authentication required to mark all notifications as read." },
        { status: 401 }
      );
    }

    const dbUser = await User.findOne({ email: session.user.email.toLowerCase().trim() }).lean();
    if (!dbUser) {
      return NextResponse.json(
        { success: false, message: "User account not found." },
        { status: 404 }
      );
    }

    const userId = dbUser._id.toString();
    let userObjectId = null;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (e) {}
    const userMatch = userObjectId ? [userId, userObjectId] : [userId];

    const now = new Date();

    const andConditions = [
      { status: "sent" },
      { sentAt: { $lte: now } },
      {
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      },
      { recipientType: { $in: ["all", "customers"] } },
      {
        $or: [{ recipientSelection: "all" }, { recipients: { $in: userMatch } }],
      },
      { "readBy.recipientId": { $ne: userId } },
    ];

    const result = await Message.updateMany(
      { $and: andConditions },
      { $push: { readBy: { recipientId: userId, readAt: now } } }
    );

    return NextResponse.json({
      success: true,
      message: "All customer notifications marked as read.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all read error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
