import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const { subscription, userAgent = "" } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { success: false, message: "Valid PushSubscription object required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user is logged in via NextAuth session
    const session = await getServerSession(authOptions);
    let userId = null;
    if (session?.user?.email) {
      const user = await User.findOne({ email: session.user.email });
      if (user) userId = user._id;
    }

    // Upsert subscription by endpoint
    const updated = await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        user: userId,
        userAgent,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Push notification subscription saved successfully",
      id: updated._id,
    });
  } catch (error) {
    console.error("[Push API] Subscribe error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
