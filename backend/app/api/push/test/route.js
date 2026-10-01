import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendPushToSubscription, sendPushToUser } from "@/lib/pushService";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { endpoint } = body;

    await connectDB();

    const payload = {
      title: "Pet Protocols — Push Enabled! 🔔",
      body: "You will now receive live order tracking alerts, kitchen preparation updates, and special deals.",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/favicon-32x32.png",
      data: {
        url: "/orders",
        timestamp: Date.now(),
      },
      tag: "pet-protocols-test",
    };

    // If a specific endpoint was sent, send directly to that subscription
    if (endpoint) {
      const sub = await PushSubscription.findOne({ endpoint });
      if (sub) {
        const result = await sendPushToSubscription(sub, payload);
        return NextResponse.json({
          success: result.success,
          message: result.success ? "Test push notification sent successfully!" : "Failed to send test push.",
          result,
        });
      }
    }

    // Otherwise, check session user
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const user = await User.findOne({ email: session.user.email });
      if (user) {
        const result = await sendPushToUser(user._id, payload);
        return NextResponse.json({
          success: result.success,
          message: `Sent test push notification to ${result.count} registered device(s).`,
          result,
        });
      }
    }

    return NextResponse.json(
      { success: false, message: "No active push subscription found to test" },
      { status: 404 }
    );
  } catch (error) {
    console.error("[Push API] Test push error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
