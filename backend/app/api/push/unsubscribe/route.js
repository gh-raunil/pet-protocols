import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";

export async function POST(request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { success: false, message: "Subscription endpoint required" },
        { status: 400 }
      );
    }

    await connectDB();
    await PushSubscription.deleteOne({ endpoint });

    return NextResponse.json({
      success: true,
      message: "Push notification subscription removed successfully",
    });
  } catch (error) {
    console.error("[Push API] Unsubscribe error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
