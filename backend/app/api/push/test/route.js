import { NextResponse } from 'next/server';
import { sendPushNotification, sendPushToUser } from '@/lib/pushService';
import { getAuthSession } from '@/lib/authMiddleware';
import User from '@/models/User';
import connectDB from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { subscription } = body;

    const payload = {
      title: 'Pet Protocols Alert 🔔',
      body: 'Web Push is active! You will now receive instant updates on your order status and kitchen specials.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/favicon-32x32.png',
      url: '/orders',
      tag: 'test-notification',
      data: {
        url: '/orders',
        timestamp: Date.now(),
      },
    };

    // If a direct subscription object is provided in the body, send to it directly
    if (subscription?.endpoint && subscription?.keys?.p256dh && subscription?.keys?.auth) {
      const result = await sendPushNotification(subscription, payload);
      if (result.success) {
        return NextResponse.json({ success: true, message: 'Test notification sent successfully!' });
      }
      return NextResponse.json({ success: false, message: result.error || 'Failed to send test push' }, { status: 400 });
    }

    // Otherwise, check session user and send to all active subscriptions
    const session = await getAuthSession();
    if (session?.user?.email) {
      await connectDB();
      const user = await User.findOne({ email: session.user.email }).select('_id');
      if (user) {
        const result = await sendPushToUser(user._id, payload);
        if (result.success && result.sentCount > 0) {
          return NextResponse.json({
            success: true,
            message: `Test notification sent to ${result.sentCount} active device(s)!`,
          });
        }
        return NextResponse.json({
          success: false,
          message: 'No active device subscriptions found for this account.',
        }, { status: 404 });
      }
    }

    return NextResponse.json(
      { success: false, message: 'Subscription details or user session required to send test push.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API Push Test] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
