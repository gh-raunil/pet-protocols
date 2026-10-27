import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import PaymentIntent from '../models/PaymentIntent.js';
import Order from '../models/Order.js';
import {
  executePaymentIntentRefund,
  reconcilePaymentIntentRefund,
  recoverUnresolvedRefunds,
  releasePaymentIntentRefundLease,
  _setTestRazorpayClient,
  _setTestRefundPauseHook,
} from '../lib/refundService.js';

// ==============================================================================
// Test Harness: In-Memory Store & Mock Infrastructure (Zero Network / DB Side Effects)
// ==============================================================================

// Set safe loopback test environment variable before importing connectDB
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mock_test_db';

// Ensure mongoose connection state is marked connected so connectDB() does not attempt network I/O
global.mongoose = { conn: { readyState: 1 }, promise: Promise.resolve({ readyState: 1 }) };
if (!mongoose.connection) {
  mongoose.connection = {};
}
mongoose.connection.readyState = 1;

let mockPaymentIntents = new Map();
let mockOrders = new Map();

function clone(obj) {
  if (!obj) return obj;
  const c = JSON.parse(JSON.stringify(obj));
  c.save = async function () {
    const id = c._id?.toString?.() || c._id;
    if (mockPaymentIntents.has(id)) mockPaymentIntents.set(id, clone(c));
    if (mockOrders.has(id)) mockOrders.set(id, clone(c));
    return c;
  };
  return c;
}

function matchFilter(doc, filter) {
  if (!doc) return false;
  for (const [key, value] of Object.entries(filter)) {
    if (key === '_id') {
      const docId = doc._id?.toString?.() || doc._id;
      const targetId = value?.toString?.() || value;
      if (docId !== targetId) return false;
    } else if (key === 'status') {
      if (typeof value === 'object' && value !== null) {
        if (value.$in && !value.$in.includes(doc.status)) return false;
        if (value.$nin && value.$nin.includes(doc.status)) return false;
        if (value.$ne && doc.status === value.$ne) return false;
      } else if (doc.status !== value) {
        return false;
      }
    } else if (key === 'paymentStatus') {
      if (typeof value === 'object' && value.$in) {
        if (!value.$in.includes(doc.paymentStatus)) return false;
      } else if (typeof value === 'object' && value.$nin) {
        if (value.$nin.includes(doc.paymentStatus)) return false;
      } else if (doc.paymentStatus !== value) {
        return false;
      }
    } else if (key === 'createdOrders') {
      const orders = (doc.createdOrders || []).map((o) => (o?.toString?.() || o));
      if (typeof value === 'object' && value !== null) {
        if (value.$size !== undefined && orders.length !== value.$size) return false;
        if (value.$exists !== undefined && (doc.createdOrders !== undefined) !== value.$exists) return false;
      } else {
        const target = value?.toString?.() || value;
        if (!orders.includes(target)) return false;
      }
    } else if (key === '$and') {
      const andMatched = value.every((subFilter) => matchFilter(doc, subFilter));
      if (!andMatched) return false;
    } else if (key === '$or') {
      const orMatched = value.some((subFilter) => matchFilter(doc, subFilter));
      if (!orMatched) return false;
    } else if (key.startsWith('refundDetails.')) {
      const subKey = key.replace('refundDetails.', '');
      const actualVal = doc.refundDetails?.[subKey];
      if (typeof value === 'object' && value !== null) {
        if (value.$ne !== undefined && actualVal === value.$ne) return false;
        if (value.$nin !== undefined && value.$nin.includes(actualVal)) return false;
        if (value.$in !== undefined && !value.$in.includes(actualVal)) return false;
        if (value.$lt !== undefined) {
          if (typeof value.$lt === 'number') {
            if (actualVal === undefined || actualVal === null || actualVal >= value.$lt) return false;
          } else {
            if (!actualVal || new Date(actualVal).getTime() >= new Date(value.$lt).getTime()) return false;
          }
        }
        if (value.$exists !== undefined) {
          const exists = actualVal !== undefined;
          if (exists !== value.$exists) return false;
        }
      } else if (actualVal !== value) {
        return false;
      }
    } else {
      if (typeof value === 'object' && value !== null) {
        if (value.$ne !== undefined && doc[key] === value.$ne) return false;
        if (value.$nin !== undefined && value.$nin.includes(doc[key])) return false;
        if (value.$in !== undefined && !value.$in.includes(doc[key])) return false;
      } else if (doc[key] !== value) {
        return false;
      }
    }
  }
  return true;
}

function applyUpdate(doc, update) {
  if (update.$set) {
    for (const [key, val] of Object.entries(update.$set)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let curr = doc;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = val;
      } else {
        doc[key] = val;
      }
    }
  }
  if (update.$inc) {
    for (const [key, val] of Object.entries(update.$inc)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let curr = doc;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = (curr[parts[parts.length - 1]] || 0) + val;
      } else {
        doc[key] = (doc[key] || 0) + val;
      }
    }
  }
}

// Attach model stubs
PaymentIntent.findById = async function (id) {
  const doc = mockPaymentIntents.get(id?.toString?.() || id);
  return doc ? clone(doc) : null;
};

PaymentIntent.findOne = async function (filter) {
  for (const doc of mockPaymentIntents.values()) {
    if (matchFilter(doc, filter)) return clone(doc);
  }
  return null;
};

PaymentIntent.find = function (filter) {
  const matched = [];
  for (const doc of mockPaymentIntents.values()) {
    if (matchFilter(doc, filter)) matched.push(clone(doc));
  }
  return {
    limit: function (limitCount) {
      return Promise.resolve(matched.slice(0, limitCount));
    },
    then: function (resolve) {
      return Promise.resolve(matched).then(resolve);
    },
  };
};

PaymentIntent.findOneAndUpdate = async function (filter, update) {
  for (const [id, doc] of mockPaymentIntents.entries()) {
    if (matchFilter(doc, filter)) {
      applyUpdate(doc, update);
      mockPaymentIntents.set(id, doc);
      return clone(doc);
    }
  }
  return null;
};

PaymentIntent.updateOne = async function (filter, update) {
  for (const [id, doc] of mockPaymentIntents.entries()) {
    if (matchFilter(doc, filter)) {
      applyUpdate(doc, update);
      mockPaymentIntents.set(id, doc);
      return { matchedCount: 1, modifiedCount: 1 };
    }
  }
  return { matchedCount: 0, modifiedCount: 0 };
};

Order.findById = async function (id) {
  const doc = mockOrders.get(id?.toString?.() || id);
  return doc ? clone(doc) : null;
};

Order.findOne = async function (filter) {
  for (const doc of mockOrders.values()) {
    if (matchFilter(doc, filter)) return clone(doc);
  }
  return null;
};

Order.find = function (filter) {
  const matched = [];
  for (const doc of mockOrders.values()) {
    if (matchFilter(doc, filter)) matched.push(clone(doc));
  }
  return {
    limit: function (limitCount) {
      return Promise.resolve(matched.slice(0, limitCount));
    },
    then: function (resolve) {
      return Promise.resolve(matched).then(resolve);
    },
  };
};

Order.findOneAndUpdate = async function (filter, update) {
  for (const [id, doc] of mockOrders.entries()) {
    if (matchFilter(doc, filter)) {
      applyUpdate(doc, update);
      mockOrders.set(id, doc);
      return clone(doc);
    }
  }
  return null;
};

Order.updateOne = async function (filter, update) {
  for (const [id, doc] of mockOrders.entries()) {
    if (matchFilter(doc, filter)) {
      applyUpdate(doc, update);
      mockOrders.set(id, doc);
      return { matchedCount: 1, modifiedCount: 1 };
    }
  }
  return { matchedCount: 0, modifiedCount: 0 };
};

Order.countDocuments = async function (filter) {
  if (!filter) return mockOrders.size;
  let count = 0;
  for (const doc of mockOrders.values()) {
    if (matchFilter(doc, filter)) count++;
  }
  return count;
};

PaymentIntent.countDocuments = async function (filter) {
  if (!filter) return mockPaymentIntents.size;
  let count = 0;
  for (const doc of mockPaymentIntents.values()) {
    if (matchFilter(doc, filter)) count++;
  }
  return count;
};

function resetMocks() {
  mockPaymentIntents.clear();
  mockOrders.clear();
  _setTestRazorpayClient(null);
  _setTestRefundPauseHook(null);
}

// ==============================================================================
// TEST SUITE: Phase 2.4.2 PaymentIntent Refund Recovery Remediation
// ==============================================================================

test('PI-REC-01: Eligible PaymentIntent refund recovery via recoverUnresolvedRefunds', async () => {
  resetMocks();

  const piId = '66f100000000000000000001';
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_elig_001',
    razorpayPaymentId: 'pay_elig_001',
    amount: 750,
    amountPaise: 75000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'failed',
      status: 'pending',
      retryCount: 0,
      requiresManualReconciliation: false,
    },
  };
  mockPaymentIntents.set(piId, pi);

  let gatewayRefundCalled = false;
  const mockGateway = {
    payments: {
      fetch: async (payId) => ({
        id: payId,
        amount: 75000,
        currency: 'INR',
        amount_refunded: 0,
        status: 'captured',
      }),
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async (payId, payload) => {
        gatewayRefundCalled = true;
        return {
          id: 'rfnd_gw_success_001',
          payment_id: payId,
          amount: payload.amount,
          currency: 'INR',
          status: 'processed',
        };
      },
    },
  };
  _setTestRazorpayClient(mockGateway);

  const report = await recoverUnresolvedRefunds({ batchSize: 10, maxRetries: 3 });

  assert.strictEqual(report.recovered, 1, 'Should mark 1 PaymentIntent recovered');
  assert.strictEqual(gatewayRefundCalled, true, 'Gateway refund API should have been called');

  const updatedPi = mockPaymentIntents.get(piId);
  assert.strictEqual(updatedPi.status, 'refunded', 'PaymentIntent status should be refunded');
  assert.strictEqual(updatedPi.refundDetails.dispatchState, 'confirmed');
  assert.strictEqual(updatedPi.refundDetails.status, 'processed');
  assert.strictEqual(updatedPi.refundDetails.refundId, 'rfnd_gw_success_001');
  assert.strictEqual(updatedPi.refundDetails.leaseToken, null, 'Lease token should be cleared');
});

test('PI-REC-02: Checkout failure where no Order document exists', async () => {
  resetMocks();

  const piId = '66f100000000000000000002';
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_no_order_002',
    razorpayPaymentId: 'pay_no_order_002',
    amount: 1200,
    amountPaise: 120000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [], // No Order persisted due to verification failure
    refundDetails: {
      opKey: 'refop_pi_checkout_fail',
      idempotencyKey: 'idemp_key_002',
      dispatchState: 'failed',
      status: 'pending',
      reason: 'restaurant_inactive',
      retryCount: 0,
      requiresManualReconciliation: false,
    },
  };
  mockPaymentIntents.set(piId, pi);

  const mockGateway = {
    payments: {
      fetch: async (payId) => ({
        id: payId,
        amount: 120000,
        currency: 'INR',
        amount_refunded: 0,
      }),
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async (payId, payload) => ({
        id: 'rfnd_no_order_success',
        payment_id: payId,
        amount: payload.amount,
        status: 'processed',
      }),
    },
  };
  _setTestRazorpayClient(mockGateway);

  const result = await executePaymentIntentRefund({
    paymentIntentId: piId,
    reason: 'Restaurant inactive checkout failure',
    initiatedBy: 'checkout_verifier',
  });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.refundId, 'rfnd_no_order_success');

  const updatedPi = mockPaymentIntents.get(piId);
  assert.strictEqual(updatedPi.status, 'refunded');
  assert.strictEqual(updatedPi.refundDetails.dispatchState, 'confirmed');
});

test('PI-REC-03: Already-completed refund records are idempotent and no-op gateway', async () => {
  resetMocks();

  const piId = '66f100000000000000000003';
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_already_refunded_003',
    razorpayPaymentId: 'pay_already_refunded_003',
    amount: 450,
    amountPaise: 45000,
    status: 'refunded',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'confirmed',
      status: 'processed',
      refundId: 'rfnd_already_done_003',
      requiresManualReconciliation: false,
    },
  };
  mockPaymentIntents.set(piId, pi);

  let gatewayCalls = 0;
  const mockGateway = {
    payments: {
      fetch: async () => { gatewayCalls++; },
      refund: async () => { gatewayCalls++; },
    },
  };
  _setTestRazorpayClient(mockGateway);

  // Direct execute check
  const directResult = await executePaymentIntentRefund({ paymentIntentId: piId });
  assert.strictEqual(directResult.success, true);
  assert.strictEqual(directResult.alreadyRefunded, true);
  assert.strictEqual(directResult.refundId, 'rfnd_already_done_003');
  assert.strictEqual(gatewayCalls, 0, 'Gateway must NOT be called for already-refunded intent');

  // Recovery cron check
  const recoveryReport = await recoverUnresolvedRefunds({ batchSize: 10 });
  assert.strictEqual(recoveryReport.intentsScanned, 0, 'Already-refunded intent should not be scanned as candidate');
  assert.strictEqual(gatewayCalls, 0);
});

test('PI-REC-04: Concurrent recovery attempts - atomic lease fencing prevents duplicate dispatch', async () => {
  resetMocks();

  const piId = '66f100000000000000000004';
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_concurrent_004',
    razorpayPaymentId: 'pay_concurrent_004',
    amount: 990,
    amountPaise: 99000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'failed',
      status: 'pending',
      retryCount: 0,
      requiresManualReconciliation: false,
    },
  };
  mockPaymentIntents.set(piId, pi);

  let activeRefunds = 0;
  let maxConcurrentRefunds = 0;

  const mockGateway = {
    payments: {
      fetch: async () => ({ amount_refunded: 0, currency: 'INR' }),
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async () => {
        activeRefunds++;
        maxConcurrentRefunds = Math.max(maxConcurrentRefunds, activeRefunds);
        await new Promise((r) => setTimeout(r, 20));
        activeRefunds--;
        return { id: 'rfnd_concurrent_win', status: 'processed' };
      },
    },
  };
  _setTestRazorpayClient(mockGateway);

  // Worker 1 and Worker 2 invoke concurrently
  const [res1, res2] = await Promise.all([
    executePaymentIntentRefund({ paymentIntentId: piId, initiatedBy: 'worker_1' }),
    executePaymentIntentRefund({ paymentIntentId: piId, initiatedBy: 'worker_2' }),
  ]);

  assert.strictEqual(maxConcurrentRefunds, 1, 'Only ONE worker can execute refund at a time');

  const successes = [res1, res2].filter((r) => r.success && !r.alreadyRefunded);
  const inProgressOrAborted = [res1, res2].filter((r) => r.inProgress || r.aborted || r.alreadyRefunded);

  assert.strictEqual(successes.length, 1, 'Exactly one worker must succeed in dispatching refund');
  assert.strictEqual(inProgressOrAborted.length, 1, 'Second worker must be prevented by lease fencing');
});

test('PI-REC-05: Expired lease takeover defense - in-flight dispatching quarantines instead of double-refunding', async () => {
  resetMocks();

  const piId = '66f100000000000000000005';
  const sixtySecondsAgo = new Date(Date.now() - 60000);

  // Simulate an interrupted dispatch where server crashed while calling Razorpay
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_takeover_005',
    razorpayPaymentId: 'pay_takeover_005',
    amount: 800,
    amountPaise: 80000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'dispatching', // was in-flight!
      status: 'processing',
      lastAttemptAt: sixtySecondsAgo, // lease expired (>30s)
      retryCount: 1,
      requiresManualReconciliation: false,
    },
  };
  mockPaymentIntents.set(piId, pi);

  let refundDispatched = false;
  const mockGateway = {
    payments: {
      fetch: async () => ({
        id: 'pay_takeover_005',
        currency: 'INR',
        amount_refunded: 0, // Gateway shows NO refund yet (outcome ambiguous/in-flight)
      }),
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async () => {
        refundDispatched = true;
        return { id: 'rfnd_bad_duplicate', status: 'processed' };
      },
    },
  };
  _setTestRazorpayClient(mockGateway);

  const report = await recoverUnresolvedRefunds({ batchSize: 10 });

  assert.strictEqual(refundDispatched, false, 'Takeover defense MUST NOT dispatch speculative duplicate refund!');
  assert.strictEqual(report.aborted, 1, 'Attempt should be counted as aborted');

  const updatedPi = mockPaymentIntents.get(piId);
  assert.strictEqual(updatedPi.status, 'reconciliation_required', 'Must quarantine to reconciliation_required');
  assert.strictEqual(updatedPi.refundDetails.dispatchState, 'quarantined');
  assert.strictEqual(updatedPi.refundDetails.requiresManualReconciliation, true);
  assert.match(updatedPi.refundDetails.error, /Takeover aborted/);
});

test('PI-REC-06: Ambiguous gateway outcomes requiring reconciliation (reconciliation_required never redispatched)', async () => {
  resetMocks();

  const piId = '66f100000000000000000006';
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_ambig_006',
    razorpayPaymentId: 'pay_ambig_006',
    amount: 500,
    amountPaise: 50000,
    currency: 'INR',
    status: 'reconciliation_required',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'quarantined',
      status: 'reconciliation_required',
      requiresManualReconciliation: true,
      error: 'Gateway 504 timeout during previous verify',
    },
  };
  mockPaymentIntents.set(piId, pi);

  let refundPostCalled = false;
  const mockGateway = {
    payments: {
      fetch: async () => ({
        id: 'pay_ambig_006',
        currency: 'INR',
        amount_refunded: 0,
      }),
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async () => {
        refundPostCalled = true;
      },
    },
  };
  _setTestRazorpayClient(mockGateway);

  // Direct execute rejection check
  const directRes = await executePaymentIntentRefund({ paymentIntentId: piId });
  assert.strictEqual(directRes.success, false);
  assert.strictEqual(directRes.status, 'reconciliation_required');
  assert.strictEqual(directRes.requiresManualReconciliation, true);

  // Deliberate read-only reconciliation check
  const reconRes = await reconcilePaymentIntentRefund({ paymentIntentId: piId });
  assert.strictEqual(reconRes.success, false);
  assert.match(reconRes.message, /Gateway verification failed/);

  // Recovery cron check: quarantined intents are excluded from automated batch candidates to prevent starvation
  const report = await recoverUnresolvedRefunds({ batchSize: 10 });
  assert.strictEqual(refundPostCalled, false, 'Quarantined record must NEVER trigger POST refund call');
  assert.strictEqual(report.intentsScanned, 0, 'Quarantined record is excluded from automated candidate query');
  assert.strictEqual(report.quarantinedIntentsPendingReview, 1, 'Quarantined record is tracked in review visibility metrics');

  const updatedPi = mockPaymentIntents.get(piId);
  assert.strictEqual(updatedPi.status, 'reconciliation_required', 'Must remain quarantined when gateway shows 0 refund');
});

test('PI-REC-07: Gateway success followed by database persistence failure - reconciles without duplicate refund', async () => {
  resetMocks();

  const piId = '66f100000000000000000007';
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_crash_after_gw_007',
    razorpayPaymentId: 'pay_crash_after_gw_007',
    amount: 600,
    amountPaise: 60000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [],
    refundDetails: {
      opKey: 'refop_pi_007',
      dispatchState: 'failed',
      status: 'pending',
      retryCount: 1,
      requiresManualReconciliation: false,
    },
  };
  mockPaymentIntents.set(piId, pi);

  let newRefundCreated = false;
  const mockGateway = {
    payments: {
      fetch: async () => ({
        id: 'pay_crash_after_gw_007',
        currency: 'INR',
        amount_refunded: 60000, // Gateway shows payment was already refunded!
        refund_status: 'full',
      }),
      fetchMultipleRefund: async () => ({
        items: [
          {
            id: 'rfnd_already_at_gateway_007',
            payment_id: 'pay_crash_after_gw_007',
            amount: 60000,
            currency: 'INR',
            notes: { opKey: 'refop_pi_007' },
          },
        ],
      }),
      refund: async () => {
        newRefundCreated = true;
      },
    },
  };
  _setTestRazorpayClient(mockGateway);

  const report = await recoverUnresolvedRefunds({ batchSize: 10 });

  assert.strictEqual(report.reconciled, 1, 'Should reconcile without creating a new refund');
  assert.strictEqual(newRefundCreated, false, 'Must NOT issue a new refund POST call');

  const updatedPi = mockPaymentIntents.get(piId);
  assert.strictEqual(updatedPi.status, 'refunded');
  assert.strictEqual(updatedPi.refundDetails.dispatchState, 'confirmed');
  assert.strictEqual(updatedPi.refundDetails.status, 'processed');
  assert.strictEqual(updatedPi.refundDetails.refundId, 'rfnd_already_at_gateway_007');
  assert.strictEqual(updatedPi.refundDetails.reconciled, true);
});

test('PI-REC-08: Retry behavior after a confirmed gateway failure', async () => {
  resetMocks();

  const piId = '66f100000000000000000008';
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_retry_008',
    razorpayPaymentId: 'pay_retry_008',
    amount: 300,
    amountPaise: 30000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'failed',
      status: 'failed',
      retryCount: 1, // retry count 1 of 3
      requiresManualReconciliation: false,
    },
  };
  mockPaymentIntents.set(piId, pi);

  const mockGateway = {
    payments: {
      fetch: async () => ({ amount_refunded: 0, currency: 'INR' }),
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async () => ({
        id: 'rfnd_retry_success_008',
        status: 'processed',
      }),
    },
  };
  _setTestRazorpayClient(mockGateway);

  const res = await executePaymentIntentRefund({
    paymentIntentId: piId,
    reason: 'Retry after temporary failure',
    initiatedBy: 'recovery_worker',
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.refundId, 'rfnd_retry_success_008');

  const updatedPi = mockPaymentIntents.get(piId);
  assert.strictEqual(updatedPi.status, 'refunded');
  assert.strictEqual(updatedPi.refundDetails.retryCount, 2);
  assert.strictEqual(updatedPi.refundDetails.status, 'processed');
});

test('PI-REC-09: Repeated cron execution without duplicate dispatch (Application Idempotency)', async () => {
  resetMocks();

  const piId = '66f100000000000000000009';
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_repeated_cron_009',
    razorpayPaymentId: 'pay_repeated_cron_009',
    amount: 400,
    amountPaise: 40000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'failed',
      status: 'pending',
      retryCount: 0,
      requiresManualReconciliation: false,
    },
  };
  mockPaymentIntents.set(piId, pi);

  let gatewayRefundCalls = 0;
  const mockGateway = {
    payments: {
      fetch: async () => ({ amount_refunded: 0, currency: 'INR' }),
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async () => {
        gatewayRefundCalls++;
        return { id: 'rfnd_cron_009', status: 'processed' };
      },
    },
  };
  _setTestRazorpayClient(mockGateway);

  // Run 1: Recovers the intent
  const report1 = await recoverUnresolvedRefunds({ batchSize: 10 });
  assert.strictEqual(report1.recovered, 1);
  assert.strictEqual(gatewayRefundCalls, 1);

  // Run 2: Immediately re-execute recovery
  const report2 = await recoverUnresolvedRefunds({ batchSize: 10 });
  assert.strictEqual(report2.recovered, 0, 'Second run must recover 0 items');
  assert.strictEqual(report2.intentsScanned, 0, 'No candidate intents should match');
  assert.strictEqual(gatewayRefundCalls, 1, 'Gateway refund API must NOT be called a second time');
});

test('PI-REC-10: Existing Order recovery regression behavior is preserved alongside PaymentIntents', async () => {
  resetMocks();

  // Create 1 pending Order
  const orderId = '66f200000000000000000010';
  const order = {
    _id: orderId,
    orderId: 'ORD_TEST_010',
    paymentId: 'pay_order_010',
    totalAmount: 350,
    paymentStatus: 'refund_pending',
    refundDetails: {
      dispatchState: 'failed',
      status: 'pending',
      retryCount: 0,
      requiresManualReconciliation: false,
    },
  };
  mockOrders.set(orderId, order);

  // Create 1 pending PaymentIntent
  const piId = '66f100000000000000000010';
  const pi = {
    _id: piId,
    razorpayOrderId: 'order_pi_010',
    razorpayPaymentId: 'pay_pi_010',
    amount: 550,
    amountPaise: 55000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'failed',
      status: 'pending',
      retryCount: 0,
      requiresManualReconciliation: false,
    },
  };
  mockPaymentIntents.set(piId, pi);

  let orderRefunded = false;
  let piRefunded = false;

  const mockGateway = {
    payments: {
      fetch: async () => ({ amount_refunded: 0, currency: 'INR' }),
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async (payId) => {
        if (payId === 'pay_order_010') orderRefunded = true;
        if (payId === 'pay_pi_010') piRefunded = true;
        return { id: `rfnd_${payId}`, status: 'processed' };
      },
    },
  };
  _setTestRazorpayClient(mockGateway);

  const report = await recoverUnresolvedRefunds({ batchSize: 10 });

  assert.strictEqual(report.ordersScanned, 1, 'Should scan 1 order');
  assert.strictEqual(report.intentsScanned, 1, 'Should scan 1 PaymentIntent');
  assert.strictEqual(report.recovered, 2, 'Should recover both Order and PaymentIntent');
  assert.strictEqual(orderRefunded, true, 'Order refund must be processed');
  assert.strictEqual(piRefunded, true, 'PaymentIntent refund must be processed');

  const updatedOrder = mockOrders.get(orderId);
  assert.strictEqual(updatedOrder.paymentStatus, 'refunded');

  const updatedPi = mockPaymentIntents.get(piId);
  assert.strictEqual(updatedPi.status, 'refunded');
});
