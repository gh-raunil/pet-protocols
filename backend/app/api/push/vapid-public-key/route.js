import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/pushService';

export async function GET() {
  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    return NextResponse.json(
      { success: false, message: 'VAPID public key not configured' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    publicKey,
  });
}
