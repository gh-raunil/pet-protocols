import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import PushSubscription from '@/models/PushSubscription';
import User from '@/models/User';
import { getAuthSession } from '@/lib/authMiddleware';

export async function POST(req) {
  try {
    const body = await req.json();
    const { subscription, userAgent } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { success: false, message: 'Invalid push subscription payload. Endpoint and keys are required.' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user is authenticated
    let userId = null;
    try {
      const session = await getAuthSession();
      if (session?.user?.email) {
        const user = await User.findOne({ email: session.user.email }).select('_id');
        if (user) {
          userId = user._id;
        }
      }
    } catch (e) {
      // Unauthenticated / guest subscription is permitted
    }

    // Upsert the subscription
    const updatedSub = await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          user: userId,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
          userAgent: userAgent || '',
          status: 'active',
          lastUsed: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Push subscription registered successfully',
      id: updatedSub._id,
    });
  } catch (error) {
    console.error('[API Push Subscribe] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
