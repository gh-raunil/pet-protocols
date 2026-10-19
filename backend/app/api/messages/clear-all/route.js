import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Message from "@/models/Message";
import InAppNotification from "@/models/InAppNotification";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function clearAllNotifications(request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    let userId = null;

    if (session?.user?.email) {
      const dbUser = await User.findOne({ email: session.user.email.toLowerCase().trim() }).lean();
      if (dbUser) {
        userId = dbUser._id.toString();
      }
    }

    if (!userId) {
      return NextResponse.json({ success: true, message: "Cleared locally" });
    }

    // 1. Delete all personal InAppNotification entries for this user
    await InAppNotification.deleteMany({ user: userId });

    // 2. Mark active broadcast messages as deleted for this recipient
    const now = new Date();
    await Message.updateMany(
      {
        status: "sent",
        recipientType: { $in: ["all", "customers"] },
        "deletedBy.recipientId": { $ne: userId },
      },
      {
        $push: { deletedBy: { recipientId: userId, deletedAt: now } },
      }
    );

    return NextResponse.json({
      success: true,
      message: "All notifications cleared successfully.",
    });
  } catch (error) {
    console.error("Clear all notifications error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  return clearAllNotifications(request);
}

export async function DELETE(request) {
  return clearAllNotifications(request);
}
