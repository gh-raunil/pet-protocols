import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { processOutboxBatch } from '@/lib/notificationOutboxService';

let _testCronSecret = null;
let _isWorkerRunning = false;

export function _setTestCronSecret(secret) {
  _testCronSecret = secret;
}

export function _resetWorkerLock() {
  _isWorkerRunning = false;
}

function getCronSecret() {
  if (_testCronSecret !== null) return _testCronSecret;
  return process.env.CRON_SECRET || null;
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

async function handleOutboxTrigger(request) {
  const secret = getCronSecret();

  if (!secret) {
    console.warn('[NotificationOutboxCron] CRON_SECRET is not configured in environment variables.');
    return NextResponse.json(
      { success: false, message: 'Cron service misconfigured: authorization secret is required.' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized: missing Bearer token.' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7).trim();
  if (!safeCompare(token, secret)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized: invalid cron authorization token.' },
      { status: 401 }
    );
  }

  if (_isWorkerRunning) {
    return NextResponse.json({
      success: true,
      message: 'Notification outbox worker cycle already running. Skipping overlapping execution.',
      skipped: true,
    });
  }

  _isWorkerRunning = true;
  try {
    const { searchParams } = new URL(request.url);
    const batchSize = Math.min(Number(searchParams.get('limit')) || 25, 100);

    const stats = await processOutboxBatch({ batchSize });

    return NextResponse.json({
      success: true,
      message: `Processed ${stats.claimedCount} notification outbox event(s).`,
      stats,
    });
  } catch (err) {
    console.error('[NotificationOutboxCron] Error processing outbox cycle:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  } finally {
    _isWorkerRunning = false;
  }
}

export async function GET(request) {
  return handleOutboxTrigger(request);
}

export async function POST(request) {
  return handleOutboxTrigger(request);
}
