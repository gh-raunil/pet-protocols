import crypto from 'crypto';
import connectDB from './db.js';
import NotificationOutbox from '../models/NotificationOutbox.js';
import Order from '../models/Order.js';
import InAppNotification from '../models/InAppNotification.js';
import {
  sendPushForOrder,
  sendPushToRestaurantAdmins,
} from './pushService.js';

let _testPushDispatcher = null;
export function _setTestPushDispatcher(fn) {
  _testPushDispatcher = fn;
}

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;
const DEFAULT_LEASE_DURATION_MS = 30000;
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Persists a notification event to the durable outbox idempotently.
 * Supports an optional MongoDB session for replica set transactions.
 */
export async function enqueueNotificationEvent(eventData, { session = null } = {}) {
  if (!eventData || !eventData.eventId || !eventData.eventType || !eventData.recipient || !eventData.payload) {
    throw new Error('Invalid notification event data. eventId, eventType, recipient, and payload are required.');
  }

  await connectDB();

  const options = {
    upsert: true,
    returnDocument: 'after',
    setDefaultsOnInsert: true,
  };
  if (session) {
    options.session = session;
  }

  const existingOrCreated = await NotificationOutbox.findOneAndUpdate(
    { eventId: eventData.eventId },
    {
      $setOnInsert: {
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        order: eventData.order || null,
        orderId: eventData.orderId || '',
        restaurant: eventData.restaurant || null,
        recipient: eventData.recipient,
        channel: eventData.channel || 'all',
        payload: {
          title: eventData.payload.title,
          body: eventData.payload.body,
          icon: eventData.payload.icon || '/icons/icon-192x192.png',
          badge: eventData.payload.badge || '/icons/badge-96x96.png',
          url: eventData.payload.url || '/',
          tag: eventData.payload.tag || '',
          data: eventData.payload.data || {},
        },
        status: 'pending',
        attemptCount: 0,
        maxAttempts: eventData.maxAttempts || DEFAULT_MAX_ATTEMPTS,
        nextRetryAt: eventData.nextRetryAt || new Date(),
      },
    },
    options
  );

  return existingOrCreated;
}

/**
 * Enqueues canonical outbox events corresponding to high-level order events.
 * Maps order transitions directly into durable outbox records.
 */
export async function enqueueOrderEvents(order, eventType, extraData = {}, { session = null } = {}) {
  if (!order) return [];

  await connectDB();

  const orderId = (order._id || order.id || '').toString();
  const orderShortId = orderId ? orderId.slice(-6).toUpperCase() : 'ORDER';
  const restaurantId = (order.restaurant?._id || order.restaurant || '').toString();
  const restaurantName = order.restaurant?.name || 'Kitchen';
  const customerName = order.address?.fullName || order.user?.name || 'Customer';
  const itemCount = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || order.items?.length || 1;
  const totalFormatted = order.totalAmount !== undefined ? `₹${order.totalAmount}` : '';
  const customerUserId = order.user?._id || order.user || null;

  const events = [];

  if (eventType === 'order_placed') {
    // 1. Customer Order Placed Event
    if (customerUserId) {
      events.push({
        eventId: `outbox_${orderId}_order_placed_cust`,
        eventType: 'order_placed',
        order: order._id,
        orderId: order.orderId || orderShortId,
        restaurant: order.restaurant?._id || order.restaurant,
        recipient: {
          type: 'customer',
          id: customerUserId,
          preferenceKey: 'orderUpdates',
        },
        channel: 'all',
        payload: {
          title: 'Order Placed! 🍽️',
          body: `Your order #${orderShortId} has been received by ${restaurantName}.`,
          url: `/order-confirmation?orderId=${orderId}`,
          tag: `order-${orderId}`,
          data: { orderId, status: 'pending', type: 'order_placed' },
        },
      });
    }

    // 2. Restaurant Admin New Order Event
    if (restaurantId) {
      const deliveryArea = [order.address?.street, order.address?.city].filter(Boolean).join(', ');
      const recipientDisplay = order.address?.recipientName || order.address?.fullName || customerName;

      events.push({
        eventId: `outbox_${orderId}_order_placed_admin`,
        eventType: 'order_placed',
        order: order._id,
        orderId: order.orderId || orderShortId,
        restaurant: order.restaurant?._id || order.restaurant,
        recipient: {
          type: 'restaurant_admins',
          id: null,
          preferenceKey: 'restaurantNewOrder',
        },
        channel: 'web_push',
        payload: {
          title: 'New Order Received! 🔔',
          body: `Order #${orderShortId} (${itemCount} item${itemCount > 1 ? 's' : ''} • ${totalFormatted}) placed by ${customerName}.`,
          url: `/orders?orderId=${orderId}`,
          tag: `restaurant-order-${orderId}`,
          data: {
            orderId,
            status: 'pending',
            type: 'new_order',
            deliveryPayload: {
              title: 'New Delivery Dispatch Order! 🛵',
              body: `Order #${orderShortId} (${itemCount} item${itemCount > 1 ? 's' : ''} • ${totalFormatted}) to ${deliveryArea || recipientDisplay} is ready for dispatch.`,
              url: `/delivery`,
              tag: `restaurant-order-delivery-${orderId}`,
              data: { orderId, status: 'pending', type: 'new_delivery_order' },
            },
          },
        },
      });
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

    if (customerUserId) {
      events.push({
        eventId: `outbox_${orderId}_status_${status}_cust`,
        eventType: 'status_update',
        order: order._id,
        orderId: order.orderId || orderShortId,
        restaurant: order.restaurant?._id || order.restaurant,
        recipient: {
          type: 'customer',
          id: customerUserId,
          preferenceKey,
        },
        channel: 'all',
        payload: {
          title: pushTitle,
          body: pushBody,
          url: `/order-confirmation?orderId=${orderId}`,
          tag: `order-${orderId}`,
          data: { orderId, status, type: 'status_update' },
        },
      });
    }

    // Restaurant notifications on terminal states
    if (status === 'delivered' && restaurantId) {
      const handlerName = order.codPaymentHandler?.name || order.assignedDeliveryStaff?.name || 'Delivery Partner';
      const isCodOrder =
        String(order.paymentMethod || '').toLowerCase().includes('cod') ||
        String(order.paymentMethod || '').toLowerCase().includes('cash');
      const codAmount = order.codPaymentHandler?.amount || order.totalAmount || 0;
      const codSuffix = isCodOrder ? ` • Cash Collected: ₹${codAmount}` : ' • Paid Online';

      events.push({
        eventId: `outbox_${orderId}_delivered_admin`,
        eventType: 'status_update',
        order: order._id,
        orderId: order.orderId || orderShortId,
        restaurant: order.restaurant?._id || order.restaurant,
        recipient: {
          type: 'restaurant_admins',
          id: null,
          preferenceKey: 'restaurantNewOrder',
        },
        channel: 'web_push',
        payload: {
          title: 'Order Delivered! 🎉',
          body: `Order #${orderShortId} was marked delivered by ${handlerName}${codSuffix}.`,
          url: `/delivery`,
          tag: `restaurant-order-delivered-${orderId}`,
          data: { orderId, status: 'delivered', type: 'order_delivered' },
        },
      });
    }

    if (status === 'cancelled' && extraData.notifyRestaurant && restaurantId) {
      events.push({
        eventId: `outbox_${orderId}_cancelled_admin`,
        eventType: 'status_update',
        order: order._id,
        orderId: order.orderId || orderShortId,
        restaurant: order.restaurant?._id || order.restaurant,
        recipient: {
          type: 'restaurant_admins',
          id: null,
          preferenceKey: 'restaurantCancelledOrder',
        },
        channel: 'web_push',
        payload: {
          title: 'Order Cancelled ⚠️',
          body: `Order #${orderShortId} was marked cancelled.${extraData.reason ? ` Reason: ${extraData.reason}` : ''}`,
          url: `/orders?orderId=${orderId}`,
          tag: `restaurant-order-${orderId}`,
          data: { orderId, status: 'cancelled', type: 'order_cancelled' },
        },
      });
    }
  }

  const enqueuedRecords = [];
  for (const ev of events) {
    try {
      const record = await enqueueNotificationEvent(ev, { session });
      enqueuedRecords.push(record);
    } catch (err) {
      console.warn('[NotificationOutbox] Error enqueuing event:', ev.eventId, err.message);
    }
  }

  return enqueuedRecords;
}

/**
 * Claims a single eligible outbox event using atomic lease update.
 * Prevents worker race conditions and duplicate dispatches.
 */
export async function claimNextOutboxEvent({ workerId, leaseDurationMs = DEFAULT_LEASE_DURATION_MS } = {}) {
  await connectDB();

  const now = new Date();
  const leaseId = workerId || crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

  const query = {
    status: { $in: ['pending', 'failed', 'processing'] },
    nextRetryAt: { $lte: now },
    attemptCount: { $lt: DEFAULT_MAX_ATTEMPTS },
    $or: [
      { status: { $in: ['pending', 'failed'] }, leaseExpiresAt: null },
      { leaseExpiresAt: { $lt: now } },
    ],
  };

  const update = {
    $set: {
      status: 'processing',
      leaseToken: leaseId,
      leaseExpiresAt,
      lastAttemptAt: now,
    },
    $inc: { attemptCount: 1 },
  };

  return await NotificationOutbox.findOneAndUpdate(query, update, {
    returnDocument: 'after',
    sort: { nextRetryAt: 1, createdAt: 1 },
  });
}

/**
 * Dispatches a claimed outbox event to push and in-app mechanisms.
 */
export async function dispatchClaimedEvent(event, { pushDispatcher = null } = {}) {
  const dispatcher = pushDispatcher || _testPushDispatcher;

  try {
    let result = { success: true };

    if (dispatcher) {
      result = await dispatcher(event);
    } else {
      // 1. Deliver In-App notification if applicable
      if ((event.channel === 'all' || event.channel === 'in_app') && event.recipient?.id) {
        try {
          const oneMinuteAgo = new Date(Date.now() - 60000);
          const existingInApp = await InAppNotification.findOne({
            user: event.recipient.id,
            order: event.order,
            status: event.payload?.data?.status || event.eventType,
            createdAt: { $gte: oneMinuteAgo },
          });

          if (!existingInApp) {
            await InAppNotification.create({
              user: event.recipient.id,
              order: event.order,
              orderId: event.orderId,
              title: event.payload.title,
              content: event.payload.body,
              type: 'order',
              status: event.payload?.data?.status || event.eventType,
              url: event.payload.url || '/',
            });
          }
        } catch (inAppErr) {
          console.warn('[NotificationOutbox] Non-blocking in-app write failure:', inAppErr.message);
        }
      }

      // 2. Deliver Web Push notification
      if (event.channel === 'all' || event.channel === 'web_push') {
        if (event.recipient?.type === 'customer' && event.order) {
          const orderDoc = await Order.findById(event.order).lean();
          if (orderDoc) {
            result = await sendPushForOrder(orderDoc, event.payload, event.recipient.preferenceKey);
          }
        } else if (event.recipient?.type === 'restaurant_admins' && event.restaurant) {
          const deliveryPayload = event.payload?.data?.deliveryPayload || null;
          result = await sendPushToRestaurantAdmins(event.restaurant, event.payload, {
            settingKey: event.recipient.preferenceKey,
            deliveryPayload,
          });
        }
      }
    }

    if (result && result.success !== false) {
      // Successful delivery
      event.status = 'delivered';
      event.leaseToken = null;
      event.leaseExpiresAt = null;
      event.deliveryDetails = {
        sentCount: result.sentCount || 1,
        targetCount: result.total || 1,
        deliveredAt: new Date(),
        responseStatusCode: 200,
      };
      await event.save();
      return { success: true, eventId: event.eventId, status: 'delivered' };
    }

    // Handled non-retryable subscription missing/expired conditions
    if (result && result.reason && (result.reason.includes('No active push subscriptions') || result.reason.includes('VAPID not configured'))) {
      event.status = 'delivered';
      event.leaseToken = null;
      event.leaseExpiresAt = null;
      event.deliveryDetails = {
        sentCount: 0,
        targetCount: 0,
        deliveredAt: new Date(),
        responseStatusCode: 200,
      };
      await event.save();
      return { success: true, eventId: event.eventId, status: 'delivered', reason: result.reason };
    }

    throw new Error(result?.error || result?.reason || 'External push delivery returned failure');
  } catch (err) {
    const isPermanent = event.attemptCount >= (event.maxAttempts || DEFAULT_MAX_ATTEMPTS);
    const backoffMs = Math.min(BASE_BACKOFF_MS * Math.pow(2, Math.max(0, event.attemptCount - 1)), MAX_BACKOFF_MS) + Math.floor(Math.random() * 500);

    event.status = isPermanent ? 'dead_letter' : 'failed';
    event.leaseToken = null;
    event.leaseExpiresAt = null;
    event.nextRetryAt = new Date(Date.now() + backoffMs);
    event.errorDetails = {
      message: err.message || 'Unknown delivery failure',
      statusCode: err.statusCode || 500,
      lastErrorAt: new Date(),
      permanent: isPermanent,
    };

    await event.save();
    return { success: false, eventId: event.eventId, status: event.status, error: err.message };
  }
}

/**
 * Worker execution cycle: claims and processes a batch of outbox events.
 */
export async function processOutboxBatch({
  batchSize = 20,
  workerId = null,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  pushDispatcher = null,
} = {}) {
  await connectDB();

  const id = workerId || `worker_${process.pid}_${crypto.randomUUID().slice(0, 8)}`;
  const results = [];
  let claimedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let deadLetterCount = 0;

  for (let i = 0; i < batchSize; i++) {
    const claimed = await claimNextOutboxEvent({ workerId: id, leaseDurationMs });
    if (!claimed) {
      break; // No more eligible events ready for processing
    }

    claimedCount++;
    const dispatchResult = await dispatchClaimedEvent(claimed, { pushDispatcher });
    results.push(dispatchResult);

    if (dispatchResult.status === 'delivered') {
      successCount++;
    } else if (dispatchResult.status === 'dead_letter') {
      deadLetterCount++;
    } else {
      failedCount++;
    }
  }

  return {
    workerId: id,
    claimedCount,
    successCount,
    failedCount,
    deadLetterCount,
    results,
  };
}
