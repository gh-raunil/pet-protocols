import { NextResponse } from 'next/server';
import { processDueScheduledMessages } from '@/lib/scheduledMessagesService';

async function handleCronTrigger(request) {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.warn('[ScheduledCron] CRON_SECRET is not configured in environment variables.');
      return NextResponse.json(
        { success: false, message: 'Cron service misconfigured: authorization secret is required.' },
        { status: 500 }
      );
    }

    // Verify exact expected Authorization header (Bearer <CRON_SECRET>)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
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

export async function GET(request) {
  return handleCronTrigger(request);
}

export async function POST(request) {
  return handleCronTrigger(request);
}
