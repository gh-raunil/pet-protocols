import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { recoverUnresolvedRefunds } from '@/lib/refundService';

let _testCronSecret = null;
let _isRecoveryRunning = false;

export function _setTestCronSecret(secret) {
  _testCronSecret = secret;
}

export function _resetRecoveryLock() {
  _isRecoveryRunning = false;
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

async function handleRecoveryTrigger(request) {
  const secret = getCronSecret();

  if (!secret) {
    console.warn('[RefundRecoveryCron] CRON_SECRET is not configured in environment variables.');
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

  // Prevent overlapping recovery runs within the local Node.js process
  // Note: This in-memory lock is process-local and does NOT act as a distributed lock.
  // Cross-instance safety for individual orders is provided by database-level atomic lease acquisition.
  if (_isRecoveryRunning) {
    return NextResponse.json(
      {
        success: false,
        inProgress: true,
        message: 'A refund recovery run is already in progress.',
      },
      { status: 409 }
    );
  }

  _isRecoveryRunning = true;

  try {
    let batchSize = 10;
    let maxRetries = 3;

    if (request.method === 'POST') {
      try {
        const text = await request.text();
        if (text) {
          const body = JSON.parse(text);
          if (typeof body.batchSize === 'number') batchSize = body.batchSize;
          if (typeof body.maxRetries === 'number') maxRetries = body.maxRetries;
        }
      } catch {
        // Fallback to query params or defaults if JSON parse fails
      }
    }

    try {
      const url = new URL(request.url);
      const qBatch = url.searchParams.get('batchSize');
      const qRetries = url.searchParams.get('maxRetries');
      if (qBatch && !isNaN(Number(qBatch))) batchSize = Number(qBatch);
      if (qRetries && !isNaN(Number(qRetries))) maxRetries = Number(qRetries);
    } catch {}

    // Bounded batch size (1 to 50) and maxRetries (1 to 5)
    batchSize = Math.max(1, Math.min(50, Math.floor(batchSize)));
    maxRetries = Math.max(1, Math.min(5, Math.floor(maxRetries)));

    const report = await recoverUnresolvedRefunds({ batchSize, maxRetries });

    // Minimal summary with counts and redacted identifiers; never expose customer details or secrets
    const sanitizedResults = (report.results || []).map((r) => ({
      orderId: r.orderId ? `${r.orderId.substring(0, 6)}...` : undefined,
      resultStatus: r.resultStatus || (r.success ? 'processed' : 'failed'),
      success: Boolean(r.success),
      reconciled: Boolean(r.reconciled),
      error: r.error ? 'Reconciliation error (redacted)' : undefined,
    }));

    return NextResponse.json({
      success: true,
      scanned: report.scanned,
      recovered: report.recovered,
      reconciled: report.reconciled,
      aborted: report.aborted,
      failed: report.failed,
      results: sanitizedResults,
    });
  } catch (error) {
    console.error('[RefundRecoveryCron] Unhandled execution error:', error.message);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error during refund recovery execution.',
      },
      { status: 500 }
    );
  } finally {
    _isRecoveryRunning = false;
  }
}

export async function GET(request) {
  return handleRecoveryTrigger(request);
}

export async function POST(request) {
  return handleRecoveryTrigger(request);
}
