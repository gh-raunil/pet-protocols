import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import PushSubscription from '@/models/PushSubscription';
import { getAuthSession } from '@/lib/authMiddleware';

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch (e) {}

    const { endpoint, allDevices } = body;

    await connectDB();

    let session = null;
    try {
      session = await getAuthSession();
    } catch (e) {}

    const userId = session?.user?.id || session?.user?._id;

    if (endpoint) {
      await PushSubscription.deleteMany({ endpoint });
    }

    if (allDevices && userId) {
      await PushSubscription.deleteMany({ user: userId });
    }

    if (!endpoint && !userId) {
      return NextResponse.json(
        { success: false, message: 'Subscription endpoint or authenticated session is required.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed successfully',
    });
  } catch (error) {
    console.error('[API Push Unsubscribe] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
