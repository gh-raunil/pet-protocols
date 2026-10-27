import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import PaymentIntent from '../models/PaymentIntent.js';
import Order from '../models/Order.js';
import {
  executePaymentIntentRefund,
  reconcilePaymentIntentRefund,
  reconcilePaymentIntent,
  recoverUnresolvedRefunds,
  _setTestRazorpayClient as _setTestRazorpayClient_service,
  _setTestHttpTransport as _setTestHttpTransport_service,
  _resetTestHttpTransport as _resetTestHttpTransport_service,
  _setTestRefundPauseHook as _setTestRefundPauseHook_service,
  _setTestRefundPostCheckPauseHook as _setTestRefundPostCheckPauseHook_service,
} from '../lib/refundService.js';
import {
  _setTestRazorpayClient as _setTestRazorpayClient_verify,
} from '../app/api/payment/verify/route.js';
import {
  _setTestCronSecret,
  _resetRecoveryLock,
} from '../app/api/cron/refund-recovery/route.js';
import {
  _setTestWebhookSecret,
} from '../app/api/payment/webhook/route.js';
import {
  _setTestHttpTransport as _setTestHttpTransport_client,
  _resetTestHttpTransport as _resetTestHttpTransport_client,
} from '../lib/razorpayHttpClient.js';

// ==============================================================================
// Safe Test Environment Configuration
// ==============================================================================
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mock_test_db';

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
      if (typeof value === 'object' && value !== null) {
        if (value.$ne && docId === (value.$ne?.toString?.() || value.$ne)) return false;
        if (value.$in) {
          const inList = value.$in.map((v) => v?.toString?.() || v);
          if (!inList.includes(docId)) return false;
        }
      } else if (docId !== (value?.toString?.() || value)) {
        return false;
      }
    } else if (key === 'status') {
      if (typeof value === 'object' && value !== null) {
        if (value.$in && !value.$in.includes(doc.status)) return false;
        if (value.$nin && value.$nin.includes(doc.status)) return false;
        if (value.$ne && doc.status === value.$ne) return false;
      } else if (doc.status !== value) {
        return false;
      }
    } else if (key === 'paymentStatus') {
      if (typeof value === 'object' && value !== null) {
        if (value.$in && !value.$in.includes(doc.paymentStatus)) return false;
        if (value.$nin && value.$nin.includes(doc.paymentStatus)) return false;
        if (value.$ne && doc.paymentStatus === value.$ne) return false;
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

PaymentIntent.countDocuments = async function (filter) {
  if (!filter) return mockPaymentIntents.size;
  let count = 0;
  for (const doc of mockPaymentIntents.values()) {
    if (matchFilter(doc, filter)) count++;
  }
  return count;
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

function resetMocks() {
  mockPaymentIntents.clear();
  mockOrders.clear();
  _setTestRazorpayClient_service(null);
  _setTestRefundPauseHook_service(null);
  _setTestRefundPostCheckPauseHook_service(null);
  _resetTestHttpTransport_service();
  _resetTestHttpTransport_client();
  _setTestRazorpayClient_verify(null);
  _setTestCronSecret(null);
  _resetRecoveryLock();
  _setTestWebhookSecret(null);
}

// ==============================================================================
// TASK 1: AUD-242-01 — Guard Production Test Hooks
// ==============================================================================

test('AUD-242-01: Production test hooks reject invocations when NODE_ENV === "production"', async () => {
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';

    // 1. refundService hooks
    assert.throws(
      () => _setTestRazorpayClient_service({}),
      /forbidden in production environment/
    );
    assert.throws(
      () => _setTestHttpTransport_service(() => {}),
      /forbidden in production environment/
    );
    assert.throws(
      () => _resetTestHttpTransport_service(),
      /forbidden in production environment/
    );
    assert.throws(
      () => _setTestRefundPauseHook_service(() => {}),
      /forbidden in production environment/
    );
    assert.throws(
      () => _setTestRefundPostCheckPauseHook_service(() => {}),
      /forbidden in production environment/
    );

    // 2. payment/verify route hook
    assert.throws(
      () => _setTestRazorpayClient_verify({}),
      /forbidden in production environment/
    );

    // 3. razorpayHttpClient hooks
    assert.throws(
      () => _setTestHttpTransport_client(() => {}),
      /forbidden in production environment/
    );
    assert.throws(
      () => _resetTestHttpTransport_client(),
      /forbidden in production environment/
    );

    // 4. cron route hooks
    assert.throws(
      () => _setTestCronSecret('secret'),
      /forbidden in production environment/
    );
    assert.throws(
      () => _resetRecoveryLock(),
      /forbidden in production environment/
    );

    // 5. webhook route hook
    assert.throws(
      () => _setTestWebhookSecret('secret'),
      /forbidden in production environment/
    );
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});

test('AUD-242-01: Test hooks remain fully functional in NODE_ENV === "test"', async () => {
  assert.strictEqual(process.env.NODE_ENV, 'test');

  // Verify all hooks can be set and reset without error in test environment
  assert.doesNotThrow(() => _setTestRazorpayClient_service({ dummy: true }));
  assert.doesNotThrow(() => _setTestRazorpayClient_service(null));

  assert.doesNotThrow(() => _setTestHttpTransport_service(() => {}));
  assert.doesNotThrow(() => _resetTestHttpTransport_service());

  assert.doesNotThrow(() => _setTestRefundPauseHook_service(() => {}));
  assert.doesNotThrow(() => _setTestRefundPauseHook_service(null));

  assert.doesNotThrow(() => _setTestRefundPostCheckPauseHook_service(() => {}));
  assert.doesNotThrow(() => _setTestRefundPostCheckPauseHook_service(null));

  assert.doesNotThrow(() => _setTestRazorpayClient_verify({ dummy: true }));
  assert.doesNotThrow(() => _setTestRazorpayClient_verify(null));

  assert.doesNotThrow(() => _setTestHttpTransport_client(() => {}));
  assert.doesNotThrow(() => _resetTestHttpTransport_client());

  assert.doesNotThrow(() => _setTestCronSecret('test_secret'));
  assert.doesNotThrow(() => _setTestCronSecret(null));

  assert.doesNotThrow(() => _resetRecoveryLock());

  assert.doesNotThrow(() => _setTestWebhookSecret('test_webhook_secret'));
  assert.doesNotThrow(() => _setTestWebhookSecret(null));
});

// ==============================================================================
// TASK 2: AUD-242-02 — Eliminate Quarantine Polling and Batch Starvation
// ==============================================================================

test('AUD-242-02: Quarantined and manual-reconciliation intents are excluded from automated recovery and do not starve pending refunds', async () => {
  resetMocks();

  // Populate 10 quarantined intents (e.g. timeout / ambiguity / manual review)
  for (let i = 1; i <= 10; i++) {
    const qId = `66f20000000000000000000${i}`;
    mockPaymentIntents.set(qId, {
      _id: qId,
      razorpayOrderId: `order_quarantine_${i}`,
      razorpayPaymentId: `pay_quarantine_${i}`,
      amount: 100 * i,
      amountPaise: 10000 * i,
      currency: 'INR',
      status: i % 2 === 0 ? 'reconciliation_required' : 'refund_pending',
      createdOrders: [],
      refundDetails: {
        dispatchState: 'quarantined',
        status: 'reconciliation_required',
        requiresManualReconciliation: true,
        retryCount: 3,
        error: `Quarantined record ${i}`,
      },
    });
  }

  // Populate 2 genuinely eligible refund_pending intents
  const eligible1Id = '66f200000000000000000091';
  mockPaymentIntents.set(eligible1Id, {
    _id: eligible1Id,
    razorpayOrderId: 'order_elig_091',
    razorpayPaymentId: 'pay_elig_091',
    amount: 500,
    amountPaise: 50000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'failed',
      status: 'pending',
      requiresManualReconciliation: false,
      retryCount: 0,
    },
  });

  const eligible2Id = '66f200000000000000000092';
  mockPaymentIntents.set(eligible2Id, {
    _id: eligible2Id,
    razorpayOrderId: 'order_elig_092',
    razorpayPaymentId: 'pay_elig_092',
    amount: 700,
    amountPaise: 70000,
    currency: 'INR',
    status: 'refund_pending',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'failed',
      status: 'pending',
      requiresManualReconciliation: false,
      retryCount: 1,
    },
  });

  let gatewayRefundCalls = [];
  const mockGateway = {
    payments: {
      fetch: async (payId) => ({
        id: payId,
        currency: 'INR',
        amount_refunded: 0,
        status: 'captured',
      }),
      fetchMultipleRefund: async () => ({ items: [] }),
      refund: async (payId, payload) => {
        gatewayRefundCalls.push({ payId, amount: payload.amount });
        return {
          id: `rfnd_${payId}`,
          payment_id: payId,
          amount: payload.amount,
          currency: 'INR',
          status: 'processed',
        };
      },
    },
  };
  _setTestRazorpayClient_service(mockGateway);

  // Execute automated recovery with batchSize = 5
  // If quarantined records were included, they would take all 5 slots and starve eligible intents!
  const report = await recoverUnresolvedRefunds({ batchSize: 5 });

  // 1. Quarantined intents were excluded from ordinary recovery candidates
  assert.strictEqual(report.intentsScanned, 2, 'Only the 2 eligible intents should be scanned; 10 quarantined intents must be excluded');
  assert.strictEqual(report.recovered, 2, 'Both eligible intents must recover successfully');
  assert.strictEqual(report.quarantinedIntentsPendingReview, 10, 'All 10 quarantined intents remain tracked for operational visibility');

  // 2. Gateway was called ONLY for the 2 eligible intents, never for quarantined records
  assert.strictEqual(gatewayRefundCalls.length, 2);
  assert.deepStrictEqual(
    gatewayRefundCalls.map((c) => c.payId).sort(),
    ['pay_elig_091', 'pay_elig_092']
  );

  // 3. Repeated cron run does not query gateway for quarantined records
  gatewayRefundCalls = [];
  const repeatReport = await recoverUnresolvedRefunds({ batchSize: 5 });
  assert.strictEqual(repeatReport.intentsScanned, 0, 'No more pending intents to scan');
  assert.strictEqual(gatewayRefundCalls.length, 0, 'Zero gateway queries for quarantined records during ordinary cron runs');
  assert.strictEqual(repeatReport.quarantinedIntentsPendingReview, 10, 'Quarantined review count remains visible');
});

// ==============================================================================
// TASK 3: AUD-242-03 — Fix Ambiguous Refund Attribution
// ==============================================================================

test('AUD-242-03: Single uniquely attributable refund without notes reconciles when amount matches', async () => {
  resetMocks();

  const piId = '66f300000000000000000001';
  mockPaymentIntents.set(piId, {
    _id: piId,
    razorpayOrderId: 'order_pi_attr_001',
    razorpayPaymentId: 'pay_pi_attr_001',
    amount: 450,
    amountPaise: 45000,
    currency: 'INR',
    status: 'reconciliation_required',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'quarantined',
      status: 'reconciliation_required',
      requiresManualReconciliation: true,
    },
  });

  const mockGateway = {
    payments: {
      fetch: async () => ({
        id: 'pay_pi_attr_001',
        currency: 'INR',
        amount_refunded: 45000,
        status: 'refunded',
        refund_status: 'full',
      }),
      fetchMultipleRefund: async () => ({
        items: [
          {
            id: 'rfnd_single_unique_001',
            payment_id: 'pay_pi_attr_001',
            amount: 45000,
            currency: 'INR',
            status: 'processed',
            notes: {}, // No notes, but unique single refund matching payment and amount
          },
        ],
      }),
    },
  };
  _setTestRazorpayClient_service(mockGateway);

  const res = await reconcilePaymentIntentRefund({ paymentIntentId: piId });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.reconciled, true);
  assert.strictEqual(res.refundId, 'rfnd_single_unique_001');

  const updated = mockPaymentIntents.get(piId);
  assert.strictEqual(updated.status, 'refunded');
  assert.strictEqual(updated.refundDetails.status, 'processed');
  assert.strictEqual(updated.refundDetails.dispatchState, 'confirmed');
});

test('AUD-242-03: Multiple partial refunds without notes must NOT accept refundsList[0] (strictly quarantine)', async () => {
  resetMocks();

  const piId = '66f300000000000000000002';
  mockPaymentIntents.set(piId, {
    _id: piId,
    razorpayOrderId: 'order_pi_attr_002',
    razorpayPaymentId: 'pay_pi_attr_002',
    amount: 1000,
    amountPaise: 100000,
    currency: 'INR',
    status: 'reconciliation_required',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'quarantined',
      status: 'reconciliation_required',
      requiresManualReconciliation: true,
    },
  });

  // Gateway has 2 partial refunds (e.g. 60000 and 40000 paise).
  // Total refunded is 100000, but without notes, attributing either one to this operation is ambiguous!
  const mockGateway = {
    payments: {
      fetch: async () => ({
        id: 'pay_pi_attr_002',
        currency: 'INR',
        amount_refunded: 100000,
        status: 'refunded',
        refund_status: 'full',
      }),
      fetchMultipleRefund: async () => ({
        items: [
          {
            id: 'rfnd_part_a',
            payment_id: 'pay_pi_attr_002',
            amount: 60000,
            currency: 'INR',
            status: 'processed',
          },
          {
            id: 'rfnd_part_b',
            payment_id: 'pay_pi_attr_002',
            amount: 40000,
            currency: 'INR',
            status: 'processed',
          },
        ],
      }),
    },
  };
  _setTestRazorpayClient_service(mockGateway);

  const res = await reconcilePaymentIntentRefund({ paymentIntentId: piId });
  assert.strictEqual(res.success, false, 'Multiple refunds without notes must NEVER pick refundsList[0]');
  assert.match(res.message, /Multiple partial\/unattributed refunds/);

  const intent = mockPaymentIntents.get(piId);
  assert.strictEqual(intent.status, 'reconciliation_required', 'Must remain quarantined');
});

test('AUD-242-03: Reconcile rejects orphan PaymentIntent when sibling Orders exist for payment', async () => {
  resetMocks();

  const piId = '66f300000000000000000003';
  const sharedPayId = 'pay_sibling_order_003';

  mockPaymentIntents.set(piId, {
    _id: piId,
    razorpayOrderId: 'order_pi_attr_003',
    razorpayPaymentId: sharedPayId,
    amount: 500,
    amountPaise: 50000,
    currency: 'INR',
    status: 'reconciliation_required',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'quarantined',
      status: 'reconciliation_required',
      requiresManualReconciliation: true,
    },
  });

  // Add an Order sharing this paymentId
  mockOrders.set('66f300000000000000000099', {
    _id: '66f300000000000000000099',
    orderId: 'ORD_SIB_99',
    paymentId: sharedPayId,
    totalAmount: 500,
    paymentStatus: 'paid',
  });

  const res = await reconcilePaymentIntentRefund({ paymentIntentId: piId });
  assert.strictEqual(res.success, false);
  assert.match(res.message, /associated Order record\(s\); reconciliation must proceed via order reconciliation/);
});

test('AUD-242-03: Exact metadata/opKey match resolves even with multiple refunds on gateway', async () => {
  resetMocks();

  const piId = '66f300000000000000000004';
  const opKey = `refop_pi_${piId}`;

  mockPaymentIntents.set(piId, {
    _id: piId,
    razorpayOrderId: 'order_multi_gw_004',
    razorpayPaymentId: 'pay_multi_gw_004',
    amount: 300,
    amountPaise: 30000,
    currency: 'INR',
    status: 'reconciliation_required',
    createdOrders: [],
    refundDetails: {
      opKey,
      dispatchState: 'quarantined',
      status: 'reconciliation_required',
      requiresManualReconciliation: true,
    },
  });

  const mockGateway = {
    payments: {
      fetch: async () => ({
        id: 'pay_multi_gw_004',
        currency: 'INR',
        amount_refunded: 70000,
        status: 'captured',
      }),
      fetchMultipleRefund: async () => ({
        items: [
          {
            id: 'rfnd_unrelated_001',
            payment_id: 'pay_multi_gw_004',
            amount: 40000,
            currency: 'INR',
            status: 'processed',
            notes: { opKey: 'refop_other' },
          },
          {
            id: 'rfnd_exact_match_004',
            payment_id: 'pay_multi_gw_004',
            amount: 30000,
            currency: 'INR',
            status: 'processed',
            notes: { opKey }, // Exact opKey match!
          },
        ],
      }),
    },
  };
  _setTestRazorpayClient_service(mockGateway);

  const res = await reconcilePaymentIntentRefund({ paymentIntentId: piId });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.refundId, 'rfnd_exact_match_004');
  assert.strictEqual(mockPaymentIntents.get(piId).status, 'refunded');
});

test('AUD-242-03: Single refund amount mismatch or foreign notes are rejected', async () => {
  resetMocks();

  const piId = '66f300000000000000000005';
  mockPaymentIntents.set(piId, {
    _id: piId,
    razorpayOrderId: 'order_mismatch_005',
    razorpayPaymentId: 'pay_mismatch_005',
    amount: 500,
    amountPaise: 50000,
    currency: 'INR',
    status: 'reconciliation_required',
    createdOrders: [],
    refundDetails: {
      dispatchState: 'quarantined',
      status: 'reconciliation_required',
      requiresManualReconciliation: true,
    },
  });

  // Single refund on gateway, but amount is 30000 paise (not 50000)
  const mockGatewayAmountMismatch = {
    payments: {
      fetch: async () => ({
        id: 'pay_mismatch_005',
        currency: 'INR',
        amount_refunded: 30000,
        status: 'captured',
      }),
      fetchMultipleRefund: async () => ({
        items: [
          {
            id: 'rfnd_wrong_amt',
            payment_id: 'pay_mismatch_005',
            amount: 30000,
            currency: 'INR',
            status: 'processed',
          },
        ],
      }),
    },
  };
  _setTestRazorpayClient_service(mockGatewayAmountMismatch);

  const resMismatch = await reconcilePaymentIntentRefund({ paymentIntentId: piId });
  assert.strictEqual(resMismatch.success, false);
  assert.match(resMismatch.message, /does not match PaymentIntent amount/);

  // Single refund on gateway, but has foreign notes attributing it to another order
  const mockGatewayForeignNotes = {
    payments: {
      fetch: async () => ({
        id: 'pay_mismatch_005',
        currency: 'INR',
        amount_refunded: 50000,
        status: 'refunded',
      }),
      fetchMultipleRefund: async () => ({
        items: [
          {
            id: 'rfnd_foreign',
            payment_id: 'pay_mismatch_005',
            amount: 50000,
            currency: 'INR',
            status: 'processed',
            notes: { orderId: 'ORD_SOMEONE_ELSE' },
          },
        ],
      }),
    },
  };
  _setTestRazorpayClient_service(mockGatewayForeignNotes);

  const resForeign = await reconcilePaymentIntentRefund({ paymentIntentId: piId });
  assert.strictEqual(resForeign.success, false);
  assert.match(resForeign.message, /notes attributing it to a different operation/);
});

// ==============================================================================
// TASK 4: AUD-242-04 — Correct Order Identifier Semantics
// ==============================================================================

test('AUD-242-04: reconcilePaymentIntent associates via createdOrders array first and preserves intent amount in multi-order checkouts', async () => {
  resetMocks();

  const piId = '66f400000000000000000001';
  const order1Id = '66f400000000000000000011';
  const order2Id = '66f400000000000000000012';

  // Multi-order checkout: PaymentIntent total is 1200 (Order 1 is 700, Order 2 is 500)
  mockPaymentIntents.set(piId, {
    _id: piId,
    razorpayOrderId: 'order_multi_split_gw',
    razorpayPaymentId: 'pay_multi_split_gw',
    amount: 1200,
    amountPaise: 120000,
    currency: 'INR',
    status: 'paid',
    createdOrders: [order1Id, order2Id],
  });

  const lockedOrder1 = {
    _id: order1Id,
    orderId: 'ORD_INTERNAL_1', // Internal order identifier, NOT gateway order_id
    paymentId: 'pay_multi_split_gw',
    totalAmount: 700,
    paymentStatus: 'refunded',
  };
  const lockedOrder2 = {
    _id: order2Id,
    orderId: 'ORD_INTERNAL_2',
    paymentId: 'pay_multi_split_gw',
    totalAmount: 500,
    paymentStatus: 'paid', // not refunded yet
  };
  mockOrders.set(order1Id, lockedOrder1);
  mockOrders.set(order2Id, lockedOrder2);

  // 1. Reconcile lockedOrder1 (first sub-order)
  await reconcilePaymentIntent(lockedOrder1, 'rfnd_order1_001', 'processed', 'Automated test recovery');

  let updatedPi = mockPaymentIntents.get(piId);
  assert.ok(updatedPi, 'PaymentIntent must be located via createdOrders array');
  assert.strictEqual(updatedPi.status, 'refund_pending', 'When one sub-order remains unrefunded, PaymentIntent status must be refund_pending');
  assert.strictEqual(updatedPi.refundDetails.amount, 1200, 'Must preserve PaymentIntent total amount (1200), not overwrite with sub-order total (700)');

  // 2. Reconcile lockedOrder2 (second sub-order now refunded)
  lockedOrder2.paymentStatus = 'refunded';
  await reconcilePaymentIntent(lockedOrder2, 'rfnd_order2_002', 'processed', 'Automated test recovery');

  updatedPi = mockPaymentIntents.get(piId);
  assert.strictEqual(updatedPi.status, 'refunded', 'When all sub-orders are refunded, PaymentIntent status transitions to refunded');
  assert.strictEqual(updatedPi.refundDetails.amount, 1200, 'Must still preserve PaymentIntent total amount (1200)');
});

test('AUD-242-04: Nonmatching internal order IDs are not conflated with Razorpay gateway order IDs', async () => {
  resetMocks();

  const piId = '66f400000000000000000002';
  mockPaymentIntents.set(piId, {
    _id: piId,
    razorpayOrderId: 'order_real_gw_002',
    razorpayPaymentId: 'pay_real_gw_002',
    amount: 600,
    status: 'paid',
    createdOrders: [],
  });

  // Order with internal orderId 'ORD_99999' and mock paymentId 'PAY_MOCK_123'
  // Neither starts with 'order_' or 'pay_'
  const internalOrder = {
    _id: '66f400000000000000000099',
    orderId: 'ORD_99999',
    paymentId: 'PAY_MOCK_123',
    totalAmount: 600,
  };

  await reconcilePaymentIntent(internalOrder, 'rfnd_mock_999', 'processed', 'Internal recovery');

  // Should NOT update piId because internal strings must not match razorpayOrderId/PaymentId
  const pi = mockPaymentIntents.get(piId);
  assert.strictEqual(pi.status, 'paid', 'PaymentIntent should NOT be updated by non-matching internal IDs');
});
