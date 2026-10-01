import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import PushSubscription from '@/models/PushSubscription';

export async function POST(req) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { success: false, message: 'Subscription endpoint is required.' },
        { status: 400 }
      );
    }

    await connectDB();

    await PushSubscription.deleteOne({ endpoint });

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed successfully',
    });
  } catch (error) {
    console.error('[API Push Unsubscribe] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
