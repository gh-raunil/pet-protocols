import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Message from '@/models/Message';
import { broadcastPushNotification } from '@/lib/pushService';

export async function GET(request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, fail closed if CRON_SECRET is not configured
    if (!cronSecret && isProduction) {
      return NextResponse.json(
        { success: false, message: 'Cron service misconfigured: authorization secret is required.' },
        { status: 500 }
      );
    }

    // Verify exact expected Authorization header (Bearer <CRON_SECRET>)
    const authHeader = request.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: invalid or missing cron authorization token.' },
        { status: 401 }
      );
    }

    await connectDB();
    const now = new Date();

    const dueMessages = await Message.find({
      status: 'scheduled',
      scheduledFor: { $lte: now },
    });

    if (!dueMessages || dueMessages.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No scheduled messages due.' });
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

    return NextResponse.json({
      success: true,
      processed: processed.length,
      messageIds: processed,
    });
  } catch (error) {
    console.error('[ScheduledCron] Error processing scheduled messages:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
