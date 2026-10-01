import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import connectDB from './db.js';

let isVapidConfigured = false;

function ensureVapidConfig() {
  if (isVapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@petprotocols.com';

  if (!publicKey || !privateKey) {
    console.warn('[PushService] VAPID credentials not fully configured in environment variables.');
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isVapidConfigured = true;
    return true;
  } catch (error) {
    console.error('[PushService] Failed to initialize VAPID details:', error.message);
    return false;
  }
}

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Send push notification to a single PushSubscription document or object
 */
export async function sendPushNotification(subscription, payload) {
  if (!ensureVapidConfig()) {
    return { success: false, reason: 'VAPID not configured' };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  try {
    const response = await webpush.sendNotification(pushSubscription, payloadString, {
      TTL: 60 * 60 * 24, // 24 hours
    });
    return { success: true, statusCode: response.statusCode };
  } catch (error) {
    console.warn(`[PushService] Failed to send push to ${subscription.endpoint?.slice(0, 30)}...:`, error.statusCode || error.message);

    // If subscription is expired or gone (410 or 404), clean it up from MongoDB
    if (error.statusCode === 404 || error.statusCode === 410) {
      try {
        await connectDB();
        await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
        console.log(`[PushService] Cleaned up expired/unsubscribed push subscription: ${subscription.endpoint?.slice(0, 30)}`);
      } catch (dbErr) {
        console.error('[PushService] Error removing expired subscription:', dbErr.message);
      }
    }

    return { success: false, error: error.message, statusCode: error.statusCode };
  }
}

/**
 * Send push notification to all active devices registered to a specific user
 */
export async function sendPushToUser(userId, payload) {
  if (!userId) return { success: false, reason: 'No user ID provided' };

  try {
    await connectDB();
    const subscriptions = await PushSubscription.find({
      user: userId,
      status: 'active',
    });

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, reason: 'No active push subscriptions for user' };
    }

    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPushNotification(sub, payload))
    );

    return {
      success: true,
      sentCount: results.filter((r) => r.status === 'fulfilled' && r.value.success).length,
      total: subscriptions.length,
    };
  } catch (error) {
    console.error('[PushService] Error sending push to user:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification for an Order to the order's customer
 */
export async function sendPushForOrder(order, payload) {
  if (!order) return { success: false };
  const userId = order.user?._id || order.user;
  if (!userId) return { success: false, reason: 'Order has no registered user ID' };

  return sendPushToUser(userId, payload);
}
