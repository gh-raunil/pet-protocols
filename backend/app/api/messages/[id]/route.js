import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Message from "@/models/Message";
import InAppNotification from "@/models/InAppNotification";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Notification ID is required" }, { status: 400 });
    }

    await connectDB();
    const session = await getServerSession(authOptions);
    let userId = null;

    if (session?.user?.email) {
      const dbUser = await User.findOne({ email: session.user.email.toLowerCase().trim() }).lean();
      if (dbUser) {
        userId = dbUser._id.toString();
      }
    }

    // 1. Check if it's an InAppNotification
    const inApp = await InAppNotification.findById(id);
    if (inApp) {
      if (!userId || inApp.user?.toString() === userId) {
        await InAppNotification.findByIdAndDelete(id);
        return NextResponse.json({ success: true, message: "Notification deleted successfully" });
      }
      return NextResponse.json({ success: false, message: "Unauthorized to delete this notification" }, { status: 403 });
    }

    // 2. Check if it's a broadcast Message
    const message = await Message.findById(id);
    if (message) {
      if (userId) {
        const alreadyDeleted = message.deletedBy?.some((d) => d.recipientId === userId);
        if (!alreadyDeleted) {
          if (!message.deletedBy) message.deletedBy = [];
          message.deletedBy.push({ recipientId: userId, deletedAt: new Date() });
          await message.save();
        }
      }
      return NextResponse.json({ success: true, message: "Notification dismissed successfully" });
    }

    // 3. If ID not found in either collection, return success (already deleted)
    return NextResponse.json({ success: true, message: "Notification removed" });
  } catch (error) {
    console.error("Delete notification error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
