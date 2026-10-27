import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import PushSubscription from '@/models/PushSubscription';
import User from '@/models/User';
import { getAuthSession } from '@/lib/authMiddleware';
import { validatePushEndpoint } from '@/lib/pushEndpointValidator';
import { checkPushSubscribeRateLimit } from '@/lib/rateLimit';

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

    // SSRF Prevention: Enforce strict URL and provider policy on subscription endpoints
    const validation = await validatePushEndpoint(subscription.endpoint);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: `Invalid push subscription endpoint: ${validation.error}` },
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

    // Rate Limiting Protection (User: 10/5m, IP: 15/5m)
    const rateLimit = await checkPushSubscribeRateLimit(userId ? userId.toString() : null, req);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: `Too many push subscription attempts. Please wait ${rateLimit.resetInSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetInSeconds),
          },
        }
      );
    }

    const updateFields = {
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      userAgent: userAgent || '',
      status: 'active',
      lastUsed: new Date(),
    };

    if (body.deviceLabel) {
      updateFields.deviceLabel = body.deviceLabel;
    }

    if (userId) {
      updateFields.user = userId;
    }

    // Upsert the subscription
    const updatedSub = await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { $set: updateFields },
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
