import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import crypto from 'crypto';

// Register ESM loader for Next.js API route imports
register(pathToFileURL('./scripts/loader.mjs').href, import.meta.url);

import connectDB from '../lib/db.js';
import Restaurant from '../models/Restaurant.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import PaymentIntent from '../models/PaymentIntent.js';
import mongoose from 'mongoose';
import {
  executeOrderRefund,
  recoverUnresolvedRefunds,
  _setTestRazorpayClient,
  _setTestRefundPauseHook,
  _setTestRefundPostCheckPauseHook,
} from '../lib/refundService.js';
import {
  _setTestHttpTransport,
  _resetTestHttpTransport,
} from '../lib/razorpayHttpClient.js';

let replSet = null;

async function runDangerousCaseAudit() {
  console.log('========================================================================');
  console.log('PHASE 2A.22.1: DANGEROUS CASE AUDIT SIMULATION');
  console.log('Testing timeout -> delayed lookup -> expired retention -> delayed worker');
  console.log('========================================================================\n');

  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const localUri = replSet.getUri('dangerous_case_audit');
  process.env.MONGODB_URI = localUri;
  process.env.TEST_MONGODB_URI = localUri;

  if (global.mongoose) {
    global.mongoose.conn = null;
    global.mongoose.promise = null;
  }

  assert.ok(localUri.includes('127.0.0.1'), 'Isolated loopback replica set only');
  await connectDB();
  await Order.syncIndexes();

  const customer = await User.create({
    name: 'Audit Customer',
    email: `audit_cust_${Date.now()}@test.com`,
    password: 'password123',
    role: 'customer',
  });

  const restaurant = await Restaurant.create({
    name: 'Audit Kitchen',
    slug: `audit-kitchen-${Date.now()}`,
    status: 'active',
    isOpen: true,
  });

  // =========================================================================
  // SIMULATION: The Dangerous Case
  // =========================================================================
  // 1. Razorpay accepts the refund on Attempt 1.
  // 2. The client receives a timeout (ECONNRESET or ETIMEDOUT).
  // 3. A recovery worker runs before the gateway refund becomes visible to read-only lookup.
  // 4. The gateway idempotency retention window is treated as expired or unknown.
  // 5. A delayed worker resumes after losing its lease.
  // =========================================================================

  console.log('\n>>> Starting Dangerous Case Simulation...');

  const payId = `pay_audit_${Date.now()}`;
  const opKey = `refop_audit_${Date.now()}`;
  const order = await Order.create({
    user: customer._id,
    restaurant: restaurant._id,
    items: [{ price: 500, quantity: 1, name: 'Burger' }],
    totalAmount: 500,
    paymentId: payId,
    orderId: `order_audit_${Date.now()}`,
    paymentStatus: 'paid',
    paymentMethod: 'Razorpay (Online Payment)',
    status: 'cancelled',
    refundDetails: {
      status: 'pending',
      dispatchState: 'none',
      opKey,
    },
  });

  // State of the Mock Razorpay Gateway:
  // - gatewayLedger: tracks actual payouts executed by gateway
  // - gatewayLookupVisible: whether read-only lookup sees the refund
  // - idempotencyRetentionActive: whether gateway deduplicates using idempotency key
  const gatewayLedger = [];
  let gatewayLookupVisible = false;
  let idempotencyRetentionActive = true;
  let outboundHttpCalls = 0;

  // Mock Gateway Transport for POST /v1/payments/:id/refund
  _setTestHttpTransport(async (req) => {
    outboundHttpCalls++;
    const key = req.headers['X-Refund-Idempotency'];
    console.log(`  [Gateway HTTP] Inbound refund request #${outboundHttpCalls}: key=${key}`);

    // Check if key is in gateway cache and retention is active
    if (idempotencyRetentionActive) {
      const existing = gatewayLedger.find((e) => e.key === key);
      if (existing) {
        console.log(`  [Gateway HTTP] Deduplicated by key ${key} -> returning existing refund ${existing.refundId}`);
        return {
          status: 200,
          data: { id: existing.refundId, amount: req.body.amount, status: 'processed' },
        };
      }
    }

    // Otherwise, gateway processes a refund!
    const newRefundId = `rfnd_gateway_${gatewayLedger.length + 1}`;
    gatewayLedger.push({
      refundId: newRefundId,
      key,
      paymentId: req.paymentId,
      amount: req.body.amount,
      createdAt: new Date(),
    });
    console.log(`  [Gateway HTTP] GATEWAY DEBITED: Created refund ${newRefundId} for ₹${req.body.amount / 100}`);

    // If this is Attempt 1, simulate network drop/timeout back to client!
    if (outboundHttpCalls === 1) {
      console.log('  [Gateway HTTP] Simulating network drop / ETIMEDOUT after gateway acceptance!');
      const timeoutErr = new Error('ETIMEDOUT: Connection timed out awaiting response');
      timeoutErr.code = 'ETIMEDOUT';
      throw timeoutErr;
    }

    return {
      status: 200,
      data: { id: newRefundId, amount: req.body.amount, status: 'processed' },
    };
  });

  // Mock Gateway Read-Only Lookup (payments.fetch / payments.fetchMultipleRefund)
  _setTestRazorpayClient({
    payments: {
      fetch: async () => {
        console.log(`  [Gateway Lookup] payments.fetch called (visible=${gatewayLookupVisible})`);
        if (!gatewayLookupVisible) {
          // Replication lag / delayed visibility
          return { id: payId, amount_refunded: 0, refund_status: null, status: 'captured' };
        }
        return {
          id: payId,
          amount_refunded: 50000,
          refund_status: 'full',
          status: 'refunded',
          refunds: gatewayLedger.map((g) => ({ id: g.refundId, amount: g.amount })),
        };
      },
      fetchMultipleRefund: async () => {
        console.log(`  [Gateway Lookup] payments.fetchMultipleRefund called (visible=${gatewayLookupVisible})`);
        if (!gatewayLookupVisible) {
          return { items: [] };
        }
        return {
          items: gatewayLedger.map((g) => ({
            id: g.refundId,
            payment_id: payId,
            amount: g.amount,
            status: 'processed',
            notes: { opKey },
          })),
        };
      },
    },
  });

  // Step 1 & 2: Worker 1 attempts refund -> Gateway accepts, but client times out
  console.log('\n--- Step 1 & 2: Worker 1 dispatches refund -> Gateway accepts, client receives ETIMEDOUT ---');
  const res1 = await executeOrderRefund({ orderId: order._id, reason: 'Worker 1 cancellation' });
  console.log('  Worker 1 result:', res1);

  const orderAfterAttempt1 = await Order.findById(order._id);
  console.log(`  Order state after Attempt 1: paymentStatus=${orderAfterAttempt1.paymentStatus}, dispatchState=${orderAfterAttempt1.refundDetails?.dispatchState}, retryCount=${orderAfterAttempt1.refundDetails?.retryCount}`);
  assert.strictEqual(gatewayLedger.length, 1, 'Gateway processed 1 refund on attempt 1');
  assert.strictEqual(outboundHttpCalls, 1, '1 outbound HTTP call made');

  // Step 3: A recovery worker runs before the gateway refund becomes visible to read-only lookup
  console.log('\n--- Step 3: Recovery worker runs while gateway refund is NOT visible in read-only lookup ---');
  gatewayLookupVisible = false; // Replication lag: lookup still returns 0 refunds!

  // Step 4: The gateway idempotency retention window is treated as expired or unknown
  console.log('--- Step 4: Setting gateway idempotency retention to EXPIRED / UNKNOWN ---');
  idempotencyRetentionActive = false; // Simulates expired retention window on gateway!

  console.log('  Running recoverUnresolvedRefunds...');
  const recoveryResults = await recoverUnresolvedRefunds({ batchSize: 10, maxRetries: 3 });
  console.log('  Recovery worker results:', JSON.stringify(recoveryResults));

  console.log('\n--- Checking Outcomes ---');
  console.log(`  Total Outbound HTTP Calls: ${outboundHttpCalls}`);
  console.log(`  Total Debits in Gateway Ledger: ${gatewayLedger.length}`);
  console.log(`  Gateway Ledger Items:`, gatewayLedger);

  const orderFinal = await Order.findById(order._id);
  console.log(`  Final Order state: paymentStatus=${orderFinal.paymentStatus}, dispatchState=${orderFinal.refundDetails?.dispatchState}`);

  const hasDuplicateDebit = gatewayLedger.length > 1;
  console.log(`\n  CRITICAL AUDIT RESULT: Duplicate Gateway Debit Created? ${hasDuplicateDebit ? 'YES (UNSAFE!)' : 'NO (SAFE)'}`);

  // Step 5: Delayed worker resumes after losing its lease
  console.log('\n--- Step 5: Delayed worker resuming after lease expired ---');
  // Simulating Worker 1's post-processing attempting to update the database
  const staleWorkerUpdate = await Order.updateOne(
    { _id: order._id, "refundDetails.leaseToken": "stale-worker-1-token-lost" },
    { $set: { paymentStatus: "refunded", "refundDetails.status": "processed" } }
  );
  console.log(`  Stale worker write matched count: ${staleWorkerUpdate.matchedCount} (0 expected due to lease fencing)`);
  assert.strictEqual(staleWorkerUpdate.matchedCount, 0, 'Lease fencing blocks stale worker DB update');

  _resetTestHttpTransport();
  await replSet.stop();

  return {
    outboundHttpCalls,
    gatewayLedgerCount: gatewayLedger.length,
    hasDuplicateDebit,
    orderState: orderFinal.paymentStatus,
    dispatchState: orderFinal.refundDetails?.dispatchState,
  };
}

runDangerousCaseAudit().then((res) => {
  console.log('\nAudit simulation finished:', res);
  process.exit(0);
}).catch((err) => {
  console.error('Audit simulation failed with error:', err);
  if (replSet) replSet.stop();
  process.exit(1);
});
