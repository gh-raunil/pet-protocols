import { NextResponse } from 'next/server';
import { processDueScheduledMessages } from '@/lib/scheduledMessagesService';

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

    const result = await processDueScheduledMessages(true);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ScheduledCron] Error processing scheduled messages:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
