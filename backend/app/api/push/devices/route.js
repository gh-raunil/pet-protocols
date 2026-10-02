import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import PushSubscription from '@/models/PushSubscription';
import User from '@/models/User';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function parseDeviceFromUserAgent(ua = '') {
  const lower = ua.toLowerCase();
  let browser = 'Browser';
  let os = 'Device';

  if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('edg')) browser = 'Edge';
  else if (lower.includes('chrome')) browser = 'Chrome';
  else if (lower.includes('safari')) browser = 'Safari';

  if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('macintosh') || lower.includes('mac os')) os = 'macOS';
  else if (lower.includes('linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

// GET — List active registered push devices for authenticated user
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email.toLowerCase().trim() }).select('_id');
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const subscriptions = await PushSubscription.find({ user: user._id, status: 'active' })
      .sort({ lastUsed: -1, createdAt: -1 })
      .lean();

    const devices = subscriptions.map((sub) => ({
      id: sub._id.toString(),
      deviceLabel: sub.deviceLabel || parseDeviceFromUserAgent(sub.userAgent),
      userAgent: sub.userAgent || '',
      lastUsed: sub.lastUsed || sub.updatedAt,
      createdAt: sub.createdAt,
      status: sub.status,
    }));

    return NextResponse.json({ success: true, devices });
  } catch (error) {
    console.error('[API Push Devices GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — Revoke a specific device subscription
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const deviceId = searchParams.get('id') || body.deviceId;

    if (!deviceId) {
      return NextResponse.json({ success: false, message: 'Device ID is required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email.toLowerCase().trim() }).select('_id');
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const result = await PushSubscription.deleteOne({ _id: deviceId, user: user._id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Device not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Device subscription revoked successfully',
    });
  } catch (error) {
    console.error('[API Push Devices DELETE] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
