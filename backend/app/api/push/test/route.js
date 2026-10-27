import { NextResponse } from 'next/server';
import { sendPushNotification, sendPushToUser } from '@/lib/pushService';
import { getAuthSession } from '@/lib/authMiddleware';
import User from '@/models/User';
import PushSubscription from '@/models/PushSubscription';
import connectDB from '@/lib/db';
import { validatePushEndpoint, sanitizePushLog } from '@/lib/pushEndpointValidator';
import { checkPushTestRateLimit } from '@/lib/rateLimit';

// Test hooks for isolated security and unit testing
let testSession = undefined;
let testPushSender = null;

export function _setTestSession(session) {
  testSession = session;
}

export function _setTestPushSender(senderFn) {
  testPushSender = senderFn;
}

export function _resetTestHooks() {
  testSession = undefined;
  testPushSender = null;
}

// Authorized roles permitted to trigger push notification tests
const AUTHORIZED_ROLES = ['superadmin', 'admin', 'restaurant_admin', 'staff', 'customer', 'user'];

export async function POST(req) {
  try {
    // 1. Enforce Authentication — Session is mandatory
    const session = testSession !== undefined ? testSession : await getAuthSession();
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required to send test push notifications.' },
        { status: 401 }
      );
    }

    // 2. Enforce Authorization & Account Status
    await connectDB();
    const user = await User.findOne({ email: session.user.email.toLowerCase().trim() }).select('_id role status');
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Authenticated user account not found.' },
        { status: 401 }
      );
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, message: 'Account is inactive or suspended.' },
        { status: 403 }
      );
    }

    if (!AUTHORIZED_ROLES.includes(user.role)) {
      return NextResponse.json(
        { success: false, message: 'Access denied: Role unauthorized for test push notifications.' },
        { status: 403 }
      );
    }

    // 3. Rate Limiting — Guard against push service abuse and endpoint probing
    const rateLimitRes = await checkPushTestRateLimit(user._id.toString(), req);
    if (!rateLimitRes.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Rate limit exceeded. Please wait ${rateLimitRes.resetInSeconds} seconds before requesting another test notification.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimitRes.resetInSeconds) },
        }
      );
    }

    // 4. Parse and Validate Request Payload
    let body = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    const { subscription } = body;

    const payload = {
      title: 'पेट Protocols Alert 🔔',
      body: 'Web Push is active! You will now receive instant updates on your order status and kitchen specials.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-96x96.png',
      url: '/orders',
      tag: 'test-notification',
      data: {
        url: '/orders',
        timestamp: Date.now(),
      },
    };

    // 5. Direct Subscription in Body: Strict SSRF & Ownership Validation
    if (subscription) {
      if (
        typeof subscription !== 'object' ||
        !subscription.endpoint ||
        typeof subscription.endpoint !== 'string' ||
        !subscription.keys?.p256dh ||
        !subscription.keys?.auth
      ) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid subscription object. Endpoint and cryptographic keys (p256dh, auth) are required.',
          },
          { status: 400 }
        );
      }

      // Strict SSRF validation: scheme, port, embedded credentials, provider allowlist, DNS & IP range checks
      const validation = await validatePushEndpoint(subscription.endpoint);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid push subscription endpoint: ${validation.error}`,
          },
          { status: 400 }
        );
      }

      // Multi-tenant Subscription Boundary: If endpoint is already in DB, verify user ownership
      try {
        const existingSub = await PushSubscription.findOne({ endpoint: subscription.endpoint }).select('user');
        if (
          existingSub &&
          existingSub.user &&
          existingSub.user.toString() !== user._id.toString() &&
          user.role !== 'superadmin' &&
          user.role !== 'admin'
        ) {
          return NextResponse.json(
            { success: false, message: 'Access denied: Subscription belongs to another user account.' },
            { status: 403 }
          );
        }
      } catch (_) {}

      // Dispatch test push with timeout (using test sender if provided)
      const sender = testPushSender || sendPushNotification;
      const result = await sender(subscription, payload, { timeout: 8000 });

      if (result.success) {
        return NextResponse.json({ success: true, message: 'Test notification sent successfully!' });
      }

      return NextResponse.json(
        { success: false, message: result.error || result.reason || 'Failed to send test push' },
        { status: 400 }
      );
    }

    // 6. No Direct Subscription: Dispatch to Authenticated User's Active Subscriptions
    const senderToUser = testPushSender ? (uid, p) => testPushSender({ user: uid }, p) : sendPushToUser;
    const result = await senderToUser(user._id, payload, { timeout: 8000 });

    if (result.success && result.sentCount > 0) {
      return NextResponse.json({
        success: true,
        message: `Test notification sent to ${result.sentCount} active device(s)!`,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'No active device subscriptions found for this account.',
      },
      { status: 404 }
    );
  } catch (error) {
    // Scrub sensitive tokens and keys from logs
    console.error('[API Push Test] Error:', error.message);
    return NextResponse.json(
      { success: false, message: 'An internal error occurred while processing test notification.' },
      { status: 500 }
    );
  }
}
