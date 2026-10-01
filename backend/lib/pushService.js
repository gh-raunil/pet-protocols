import webpush from "web-push";
import PushSubscription from "@/models/PushSubscription";
import connectDB from "@/lib/db";

let vapidConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@petprotocols.com";

  if (!publicKey || !privateKey) {
    console.warn("[PushService] VAPID keys not configured in environment.");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.error("[PushService] Failed to initialize web-push VAPID:", err.message);
    return false;
  }
}

/**
 * Send Web Push notification to a single PushSubscription document.
 * Automatically cleans up expired/unregistered subscriptions (410 or 404).
 */
export async function sendPushToSubscription(subscription, payload) {
  if (!ensureVapidConfig()) {
    return { success: false, reason: "VAPID not configured" };
  }

  const subObj = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };

  const payloadString =
    typeof payload === "string" ? payload : JSON.stringify(payload);

  try {
    await webpush.sendNotification(subObj, payloadString);
    return { success: true };
  } catch (error) {
    console.warn(`[PushService] Failed to send push to ${subscription.endpoint}:`, error.statusCode || error.message);

    // If subscription is expired or unsubscribed, delete it from MongoDB
    if (error.statusCode === 410 || error.statusCode === 404) {
      try {
        await connectDB();
        await PushSubscription.deleteOne({ _id: subscription._id });
        console.log(`[PushService] Cleaned up expired push subscription: ${subscription._id}`);
      } catch (dbErr) {
        console.error("[PushService] Error removing expired subscription:", dbErr);
      }
    }

    return { success: false, error: error.message, statusCode: error.statusCode };
  }
}

/**
 * Send Web Push notification to all active devices registered to a specific user.
 */
export async function sendPushToUser(userId, payload) {
  if (!userId) return { success: false, message: "No userId provided" };
  if (!ensureVapidConfig()) return { success: false, message: "VAPID not configured" };

  await connectDB();
  const subscriptions = await PushSubscription.find({ user: userId });
  if (!subscriptions || subscriptions.length === 0) {
    return { success: true, count: 0, message: "No push subscriptions found for user" };
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushToSubscription(sub, payload))
  );

  const successful = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;

  return { success: true, count: successful, total: subscriptions.length };
}

/**
 * Broadcast Web Push notification to all registered subscriptions.
 */
export async function sendPushToAll(payload) {
  if (!ensureVapidConfig()) return { success: false, message: "VAPID not configured" };

  await connectDB();
  const subscriptions = await PushSubscription.find({});
  if (!subscriptions.length) return { success: true, count: 0 };

  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushToSubscription(sub, payload))
  );

  const successful = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;

  return { success: true, count: successful, total: subscriptions.length };
}
