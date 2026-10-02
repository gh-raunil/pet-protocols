import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const DEFAULT_PREFERENCES = {
  orderUpdates: true,
  prepUpdates: true,
  deliveryUpdates: true,
  cancellationAlerts: true,
  promotions: true,
};

// GET — Retrieve customer notification preferences
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: true, preferences: DEFAULT_PREFERENCES, isGuest: true });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email.toLowerCase().trim() })
      .select('notificationPreferences')
      .lean();

    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...(user?.notificationPreferences || {}),
    };

    return NextResponse.json({ success: true, preferences, isGuest: false });
  } catch (error) {
    console.error('[API User Preferences GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT — Update customer notification preferences
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { preferences } = body;

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ success: false, message: 'Invalid preferences payload' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email.toLowerCase().trim() });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    user.notificationPreferences = {
      ...DEFAULT_PREFERENCES,
      ...(user.notificationPreferences?.toObject?.() || user.notificationPreferences || {}),
      orderUpdates: preferences.orderUpdates !== undefined ? Boolean(preferences.orderUpdates) : true,
      prepUpdates: preferences.prepUpdates !== undefined ? Boolean(preferences.prepUpdates) : true,
      deliveryUpdates: preferences.deliveryUpdates !== undefined ? Boolean(preferences.deliveryUpdates) : true,
      cancellationAlerts: preferences.cancellationAlerts !== undefined ? Boolean(preferences.cancellationAlerts) : true,
      promotions: preferences.promotions !== undefined ? Boolean(preferences.promotions) : true,
    };

    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Notification preferences saved',
      preferences: user.notificationPreferences,
    });
  } catch (error) {
    console.error('[API User Preferences PUT] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
