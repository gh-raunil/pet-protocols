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

import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import InAppNotification from '../models/InAppNotification.js';

/**
 * Send push notification for an Order to the order's customer, respecting customer notification preferences
 */
export async function sendPushForOrder(order, payload, preferenceKey = null) {
  if (!order) return { success: false };
  const userId = order.user?._id || order.user;
  if (!userId) return { success: false, reason: 'Order has no registered user ID' };

  if (preferenceKey) {
    try {
      await connectDB();
      const user = await User.findById(userId).select('notificationPreferences').lean();
      if (user?.notificationPreferences && user.notificationPreferences[preferenceKey] === false) {
        return { success: true, sentCount: 0, reason: `Push suppressed by customer preference: ${preferenceKey}` };
      }
    } catch (prefErr) {
      // Non-blocking fallback
    }
  }

  return sendPushToUser(userId, payload);
}

/**
 * Send push notification strictly to active staff and admins of a specific restaurant.
 * Enforces restaurant-level data isolation: never leaks notifications across restaurants.
 */
export async function sendPushToRestaurantAdmins(restaurantId, payload, options = {}) {
  if (!restaurantId) return { success: false, reason: 'No restaurant ID provided' };

  if (!ensureVapidConfig()) {
    return { success: false, reason: 'VAPID not configured' };
  }

  try {
    await connectDB();

    // Check restaurant-level notification settings if present
    const restDoc = await Restaurant.findById(restaurantId).lean();
    if (restDoc?.notificationSettings) {
      if (restDoc.notificationSettings.channels?.push === false) {
        return { success: true, sentCount: 0, reason: 'Push disabled by restaurant settings' };
      }
      if (options.settingKey && restDoc.notificationSettings[options.settingKey] === false) {
        return { success: true, sentCount: 0, reason: `${options.settingKey} disabled by restaurant settings` };
      }
    }

    // STRICT tenant data isolation: only staff and admins assigned to this specific restaurant
    const staffAndAdmins = await User.find({
      restaurant: restaurantId,
      status: 'active',
      role: { $in: ['restaurant_admin', 'admin', 'staff'] },
    }).select('_id email role');

    if (!staffAndAdmins || staffAndAdmins.length === 0) {
      return { success: true, sentCount: 0, reason: 'No active staff or admins found for restaurant' };
    }

    const adminUserIds = staffAndAdmins.map((u) => u._id);

    const subscriptions = await PushSubscription.find({
      user: { $in: adminUserIds },
      status: 'active',
    });

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sentCount: 0, reason: 'No active push subscriptions for restaurant staff/admins' };
    }

    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPushNotification(sub, payload))
    );

    const sentCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    return { success: true, sentCount, total: subscriptions.length };
  } catch (error) {
    console.error('[PushService] Error sending push to restaurant admins:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * High-level order event dispatcher that coordinates both customer and restaurant notifications.
 * Event types:
 * - 'order_placed': Notifies customer of placement, notifies restaurant admins of new order
 * - 'status_update': Notifies customer of status progression (confirmed, preparing, ready, out_for_delivery, delivered, cancelled)
 * - 'order_cancelled_by_customer': Notifies customer of cancellation, alerts restaurant admins
 */
export async function notifyOrderEvent(order, eventType, extraData = {}) {
  if (!order) return { success: false, reason: 'No order provided' };

  try {
    const orderId = order._id?.toString() || order.id?.toString() || '';
    const orderShortId = orderId ? orderId.slice(-6).toUpperCase() : 'ORDER';
    const restaurantId = order.restaurant?._id?.toString() || order.restaurant?.toString() || '';
    const restaurantName = order.restaurant?.name || 'Kitchen';
    const customerName = order.address?.fullName || order.user?.name || 'Customer';
    const itemCount = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || order.items?.length || 1;
    const totalFormatted = order.totalAmount !== undefined ? `₹${order.totalAmount}` : '';
    const customerUserId = order.user?._id || order.user;

    const notifications = [];

    // ── 1. PERSIST IN-APP NOTIFICATION FOR CUSTOMER ──────────────────────────
    if (customerUserId) {
      try {
        await connectDB();
        const notificationStatus = eventType === 'order_placed' ? 'placed' : (extraData.status || order.status || eventType);
        const oneMinuteAgo = new Date(Date.now() - 60000);
        const existing = await InAppNotification.findOne({
          user: customerUserId,
          order: order._id,
          status: notificationStatus,
          createdAt: { $gte: oneMinuteAgo },
        });

        if (!existing) {
          let inAppTitle = 'Order Update';
          let inAppContent = `Your order #${orderShortId} has an update.`;

          if (eventType === 'order_placed') {
            inAppTitle = 'Order Placed 🍽️';
            inAppContent = `Your order #${orderShortId} has been placed with ${restaurantName} (${totalFormatted}).`;
          } else if (eventType === 'status_update') {
            const st = extraData.status || order.status;
            if (st === 'confirmed') {
              inAppTitle = 'Order Confirmed 👨‍🍳';
              inAppContent = `Your order #${orderShortId} has been confirmed by ${restaurantName}.`;
            } else if (st === 'preparing') {
              inAppTitle = extraData.previousStatus === 'pending' ? 'Order Accepted & Cooking 👨‍🍳' : 'Kitchen is Cooking 🔥';
              inAppContent = `Chef is preparing dishes for order #${orderShortId}.`;
            } else if (st === 'ready') {
              inAppTitle = 'Order Packed & Ready 🍱';
              inAppContent = `Order #${orderShortId} is freshly packed and waiting for delivery handoff.`;
            } else if (st === 'out_for_delivery' || st === 'dispatched') {
              inAppTitle = 'Out for Delivery 🛵';
              inAppContent = `Your food for order #${orderShortId} is on its way to you!`;
            } else if (st === 'delivered') {
              inAppTitle = 'Order Delivered 🎉';
              inAppContent = `Order #${orderShortId} was delivered. Enjoy your meal!`;
            } else if (st === 'cancelled') {
              inAppTitle = 'Order Cancelled ⚠️';
              inAppContent = extraData.reason
                ? `Order #${orderShortId} was cancelled: ${extraData.reason}`
                : `Order #${orderShortId} was cancelled.`;
            }
          } else if (eventType === 'order_cancelled_by_customer') {
            inAppTitle = 'Order Cancelled ❌';
            inAppContent = `Your order #${orderShortId} has been cancelled.`;
          }

          await InAppNotification.create({
            user: customerUserId,
            order: order._id,
            orderId: order.orderId || orderShortId,
            title: inAppTitle,
            content: inAppContent,
            type: 'order',
            status: notificationStatus,
            url: `/order-confirmation?orderId=${orderId}`,
          });
        }
      } catch (inAppErr) {
        console.warn('[PushService] Non-blocking in-app notification error:', inAppErr.message);
      }
    }

    // ── 2. DISPATCH WEB PUSH NOTIFICATIONS ────────────────────────────────────
    if (eventType === 'order_placed') {
      // 1. Customer notification
      const customerPayload = {
        title: 'Order Placed! 🍽️',
        body: `Your order #${orderShortId} has been received by ${restaurantName}.`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon-32x32.png',
        url: `/order-confirmation?orderId=${orderId}`,
        tag: `order-${orderId}`,
        data: {
          orderId,
          status: 'pending',
          url: `/order-confirmation?orderId=${orderId}`,
        },
      };
      notifications.push(sendPushForOrder(order, customerPayload, 'orderUpdates'));

      // 2. Restaurant admin notification
      if (restaurantId) {
        const adminPayload = {
          title: 'New Order Received! 🔔',
          body: `Order #${orderShortId} (${itemCount} item${itemCount > 1 ? 's' : ''} • ${totalFormatted}) placed by ${customerName}.`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/favicon-32x32.png',
          url: `/orders?orderId=${orderId}`,
          tag: `restaurant-order-${orderId}`,
          data: {
            orderId,
            status: 'pending',
            url: `/orders?orderId=${orderId}`,
            type: 'new_order',
          },
        };
        notifications.push(sendPushToRestaurantAdmins(restaurantId, adminPayload, { settingKey: 'restaurantNewOrder' }));
      }
    } else if (eventType === 'status_update') {
      const status = extraData.status || order.status;
      let pushTitle = 'Order Status Update 🔔';
      let pushBody = `Your order #${orderShortId} status is now ${status}.`;
      let preferenceKey = 'orderUpdates';

      switch (status) {
        case 'confirmed':
          pushTitle = 'Order Confirmed! 👨‍🍳';
          pushBody = `Your order #${orderShortId} has been confirmed by ${restaurantName}.`;
          preferenceKey = 'orderUpdates';
          break;
        case 'preparing':
          pushTitle = extraData.previousStatus === 'pending'
            ? 'Order Accepted & Cooking! 👨‍🍳🔥'
            : 'Kitchen is Cooking! 🔥';
          pushBody = extraData.previousStatus === 'pending'
            ? `Your order #${orderShortId} was accepted by ${restaurantName} and the kitchen is cooking.`
            : `Chef is preparing your dishes for order #${orderShortId}.`;
          preferenceKey = 'prepUpdates';
          break;
        case 'ready':
          pushTitle = 'Order Packed & Ready! 🍱';
          pushBody = `Order #${orderShortId} is freshly packed and waiting for delivery handoff.`;
          preferenceKey = 'prepUpdates';
          break;
        case 'out_for_delivery':
        case 'dispatched':
          pushTitle = 'Out for Delivery! 🛵';
          pushBody = `Your food for order #${orderShortId} is on its way to you!`;
          preferenceKey = 'deliveryUpdates';
          break;
        case 'delivered':
          pushTitle = 'Order Delivered! 🎉';
          pushBody = `Order #${orderShortId} has been delivered. Enjoy your feast!`;
          preferenceKey = 'orderUpdates';
          break;
        case 'cancelled':
          pushTitle = 'Order Cancelled ⚠️';
          pushBody = extraData.reason
            ? `Your order #${orderShortId} has been cancelled: ${extraData.reason}`
            : `Your order #${orderShortId} has been cancelled.`;
          preferenceKey = 'cancellationAlerts';
          break;
      }

      const customerPayload = {
        title: pushTitle,
        body: pushBody,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon-32x32.png',
        url: `/order-confirmation?orderId=${orderId}`,
        tag: `order-${orderId}`,
        data: {
          orderId,
          status,
          url: `/order-confirmation?orderId=${orderId}`,
        },
      };
      notifications.push(sendPushForOrder(order, customerPayload, preferenceKey));

      // If status is cancelled by superadmin or external event, also notify restaurant admins
      if (status === 'cancelled' && extraData.notifyRestaurant && restaurantId) {
        const adminPayload = {
          title: 'Order Cancelled ⚠️',
          body: `Order #${orderShortId} was marked cancelled.${extraData.reason ? ` Reason: ${extraData.reason}` : ''}`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/favicon-32x32.png',
          url: `/orders?orderId=${orderId}`,
          tag: `restaurant-order-${orderId}`,
          data: {
            orderId,
            status: 'cancelled',
            url: `/orders?orderId=${orderId}`,
          },
        };
        notifications.push(sendPushToRestaurantAdmins(restaurantId, adminPayload, { settingKey: 'restaurantCancelledOrder' }));
      }
    } else if (eventType === 'order_cancelled_by_customer') {
      // 1. Customer notification
      const customerPayload = {
        title: 'Order Cancelled ❌',
        body: `Your order #${orderShortId} has been cancelled.`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon-32x32.png',
        url: `/orders`,
        tag: `order-${orderId}`,
        data: {
          orderId,
          status: 'cancelled',
          url: '/orders',
        },
      };
      notifications.push(sendPushForOrder(order, customerPayload, 'cancellationAlerts'));

      // 2. Restaurant admin notification
      if (restaurantId) {
        const adminPayload = {
          title: 'Order Cancelled by Customer ⚠️',
          body: `Order #${orderShortId} was cancelled by ${customerName}.${extraData.reason ? ` Reason: ${extraData.reason}` : ''}`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/favicon-32x32.png',
          url: `/orders?orderId=${orderId}`,
          tag: `restaurant-order-${orderId}`,
          data: {
            orderId,
            status: 'cancelled',
            url: `/orders?orderId=${orderId}`,
            type: 'customer_cancellation',
          },
        };
        notifications.push(sendPushToRestaurantAdmins(restaurantId, adminPayload, { settingKey: 'restaurantCancelledOrder' }));
      }
    }

    const results = await Promise.allSettled(notifications);
    return { success: true, count: results.length };
  } catch (err) {
    console.warn('[PushService] Error in notifyOrderEvent:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Broadcast push notification to all active subscribers or filtered audience
 * Supports recipientSelection: 'selected' to prevent accidental platform-wide blasts
 */
export async function broadcastPushNotification(payload, target = 'all', options = {}) {
  if (!ensureVapidConfig()) {
    return { success: false, reason: 'VAPID not configured' };
  }

  try {
    await connectDB();
    const subscriptions = await PushSubscription.find({ status: 'active' }).populate('user').lean();
    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sentCount: 0, total: 0 };
    }

    const { recipientSelection = 'all', recipients = [] } = options;
    const recipientIdStrs = (recipients || []).map((r) => r.toString());

    // If specific recipients were selected, resolve the eligible user IDs
    let targetedUserIds = null;
    if (recipientSelection === 'selected') {
      if (recipientIdStrs.length === 0) {
        // Explicitly selected but empty list -> target nobody (fail-safe against accidental broadcast)
        targetedUserIds = new Set();
      } else if (target === 'restaurants') {
        const staffAndAdmins = await User.find({
          restaurant: { $in: recipientIdStrs },
          status: 'active',
          role: { $in: ['restaurant_admin', 'admin', 'staff'] },
        }).select('_id');
        targetedUserIds = new Set(staffAndAdmins.map((u) => u._id.toString()));
      } else if (target === 'customers') {
        targetedUserIds = new Set(recipientIdStrs);
      } else {
        // target === 'all' with recipientSelection === 'selected':
        // Resolve restaurant staff/admins for any matching restaurant IDs, plus direct user IDs
        const staffAndAdmins = await User.find({
          restaurant: { $in: recipientIdStrs },
          status: 'active',
          role: { $in: ['restaurant_admin', 'admin', 'staff'] },
        }).select('_id');
        const combinedSet = new Set(recipientIdStrs);
        staffAndAdmins.forEach((u) => combinedSet.add(u._id.toString()));
        targetedUserIds = combinedSet;
      }
    }

    const filtered = subscriptions.filter((sub) => {
      // 1. If targeted to specific recipients, ensure user matches
      if (targetedUserIds !== null) {
        if (!sub.user?._id) return false;
        return targetedUserIds.has(sub.user._id.toString());
      }

      // 2. Audience target filter
      if (target === 'all') return true;
      const role = sub.user?.role || 'customer';
      if (target === 'restaurants') {
        return role === 'restaurant_admin' || role === 'admin' || role === 'staff';
      }
      if (target === 'customers') {
        return role === 'customer' || role === 'user' || !sub.user;
      }
      return true;
    });

    const results = await Promise.allSettled(
      filtered.map((sub) => sendPushNotification(sub, payload))
    );

    const sentCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    return { success: true, sentCount, total: filtered.length };
  } catch (error) {
    console.error('[PushService] Error broadcasting push:', error.message);
    return { success: false, error: error.message };
  }
}

