import connectDB from '@/lib/db';
import Message from '@/models/Message';
import { broadcastPushNotification } from '@/lib/pushService';

let lastCheckTime = 0;
const MIN_CHECK_INTERVAL_MS = 15000; // Throttle opportunistic checks to once every 15s

/**
 * Checks for any scheduled messages whose scheduledFor time has arrived.
 * Atomically marks them as 'sent' and dispatches their push notifications.
 * Can be called by cron or opportunistically on API traffic.
 */
export async function processDueScheduledMessages(force = false) {
  const nowMs = Date.now();
  if (!force && nowMs - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
    return { success: true, processed: 0, throttled: true };
  }
  lastCheckTime = nowMs;

  try {
    await connectDB();
    const now = new Date();

    const dueMessages = await Message.find({
      status: 'scheduled',
      scheduledFor: { $lte: now },
    });

    if (!dueMessages || dueMessages.length === 0) {
      return { success: true, processed: 0 };
    }

    const processed = [];

    for (const msg of dueMessages) {
      // Atomic status transition to avoid race condition/duplicate dispatch
      const updated = await Message.findOneAndUpdate(
        { _id: msg._id, status: 'scheduled' },
        { $set: { status: 'sent', sentAt: new Date() } },
        { new: true }
      );

      if (updated) {
        broadcastPushNotification(
          {
            title: `📢 ${updated.title.trim()}`,
            body: updated.content.trim().slice(0, 140),
            icon: '/icons/icon-192x192.png',
            badge: '/icons/favicon-32x32.png',
            data: {
              url: updated.recipientType === 'restaurants' ? '/updates' : '/notifications',
              type: 'superadmin_broadcast',
              messageId: updated._id.toString(),
            },
          },
          updated.recipientType,
          {
            recipientSelection: updated.recipientSelection,
            recipients: updated.recipientSelection === 'selected' ? updated.recipients : [],
          }
        ).catch((err) => console.warn('[ScheduledCron] Push broadcast warning:', err.message));

        processed.push(updated._id);
      }
    }

    return {
      success: true,
      processed: processed.length,
      messageIds: processed,
    };
  } catch (error) {
    console.error('[ScheduledCron] Error processing scheduled messages:', error);
    return { success: false, error: error.message };
  }
}
