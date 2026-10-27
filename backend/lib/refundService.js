import crypto from "crypto";
import connectDB from "./db.js";
import Order from "../models/Order.js";
import PaymentIntent from "../models/PaymentIntent.js";
import Razorpay from "razorpay";
import { deductStockForOrder } from "./inventoryService.js";
import {
  razorpayHttpClient,
  computePayloadFingerprint,
  generateRefundIdempotencyKey,
  _setTestHttpTransport as _setClientTestHttpTransport,
  _resetTestHttpTransport as _resetClientTestHttpTransport,
} from "./razorpayHttpClient.js";

let _testRazorpayClient = null;
let _testRefundPauseHook = null;
let _testRefundPostCheckPauseHook = null;

export function _setTestRazorpayClient(client) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security] Razorpay test client hook is forbidden in production environment.');
  }
  _testRazorpayClient = client;
}

export function _setTestHttpTransport(fn) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security] HTTP transport test hook is forbidden in production environment.');
  }
  _setClientTestHttpTransport(fn);
}

export function _resetTestHttpTransport() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security] HTTP transport reset test hook is forbidden in production environment.');
  }
  _resetClientTestHttpTransport();
}

export function _setTestRefundPauseHook(fn) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security] Refund pause test hook is forbidden in production environment.');
  }
  _testRefundPauseHook = fn;
}

export function _setTestRefundPostCheckPauseHook(fn) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security] Refund post-check pause test hook is forbidden in production environment.');
  }
  _testRefundPostCheckPauseHook = fn;
}

export function getRazorpayClient() {
  if (_testRazorpayClient) return _testRazorpayClient;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

/**
 * Fetch authoritative refunds and payment details from Razorpay using supported SDK methods.
 */
async function getGatewayRefundsAndPayment(razorpay, paymentId) {
  let paymentEntity = null;
  let refundsList = [];
  let fetchError = null;

  if (typeof razorpay.payments?.fetch === "function") {
    try {
      paymentEntity = await razorpay.payments.fetch(paymentId);
    } catch (e) {
      console.warn("[RefundService] payments.fetch warning:", e.message);
      fetchError = e;
    }
  }

  if (typeof razorpay.payments?.fetchMultipleRefund === "function") {
    try {
      const resp = await razorpay.payments.fetchMultipleRefund(paymentId);
      if (Array.isArray(resp?.items)) {
        refundsList = resp.items;
      } else if (Array.isArray(resp)) {
        refundsList = resp;
      }
    } catch (e) {
      console.warn("[RefundService] fetchMultipleRefund warning:", e.message);
      if (!fetchError) fetchError = e;
    }
  }

  // Fallback to embedded refunds in paymentEntity if fetchMultipleRefund returned nothing
  if (refundsList.length === 0 && paymentEntity) {
    if (Array.isArray(paymentEntity.refunds)) {
      refundsList = paymentEntity.refunds;
    } else if (Array.isArray(paymentEntity.refunds?.items)) {
      refundsList = paymentEntity.refunds.items;
    }
  }

  if (fetchError && !paymentEntity && refundsList.length === 0) {
    throw fetchError;
  }

  return { paymentEntity, refundsList };
}

/**
 * Reconcile PaymentIntent document status based on order refund state.
 */
export async function reconcilePaymentIntent(lockedOrder, refundId, refundStatus, reason, error = null) {
  try {
    let intent = null;

    // 1. Authoritative relationship: check if lockedOrder._id is recorded in createdOrders
    if (lockedOrder._id) {
      intent = await PaymentIntent.findOne({ createdOrders: lockedOrder._id });
    }

    // 2. Gateway identifier fallbacks: only if not found by direct relation
    if (!intent) {
      const candidates = [];
      // Only query razorpayPaymentId if lockedOrder.paymentId is a real gateway payment ID
      if (
        lockedOrder.paymentId &&
        typeof lockedOrder.paymentId === "string" &&
        lockedOrder.paymentId.startsWith("pay_")
      ) {
        candidates.push({ razorpayPaymentId: lockedOrder.paymentId });
      }

      // Only query razorpayOrderId if lockedOrder.orderId is a real gateway order ID (not internal ORD_...)
      if (
        lockedOrder.orderId &&
        typeof lockedOrder.orderId === "string" &&
        lockedOrder.orderId.startsWith("order_")
      ) {
        candidates.push({ razorpayOrderId: lockedOrder.orderId });
      }

      if (candidates.length > 0) {
        intent = await PaymentIntent.findOne({ $or: candidates });
      }
    }

    if (intent) {
      if (intent.status === "refunded" && refundStatus !== "processed") {
        return; // Already confirmed refunded, do not overwrite with failure or uncertain state!
      }

      const siblingOrders = await Order.find({ _id: { $in: intent.createdOrders } });
      const allRefunded = siblingOrders.length > 0 && siblingOrders.every((o) => o.paymentStatus === "refunded");

      let intentStatus;
      if (allRefunded) {
        intentStatus = "refunded";
      } else if (refundStatus === "reconciliation_required") {
        intentStatus = "reconciliation_required";
      } else {
        intentStatus = "refund_pending";
      }

      intent.status = intentStatus;
      intent.refundDetails = {
        ...intent.refundDetails?.toObject?.(),
        refundId: refundId || intent.refundDetails?.refundId || null,
        status: refundStatus,
        dispatchState: refundStatus === "processed" ? "confirmed" : refundStatus === "reconciliation_required" ? "quarantined" : "dispatching",
        amount: intent.amount || lockedOrder.totalAmount,
        reason,
        error: error || null,
        processedAt: refundStatus === "processed" ? new Date() : null,
        lastAttemptAt: new Date(),
        requiresManualReconciliation: refundStatus === "reconciliation_required",
      };
      await intent.save();
    }
  } catch (intentErr) {
    console.warn("[RefundService] PaymentIntent reconciliation warning:", intentErr.message);
  }
}

/**
 * Execute a crash-safe, idempotent Razorpay refund for a paid order.
 * 
 * Hardened Architecture (Phase 2A.7):
 * 1. Checks current order payment status; rejects un-paid orders.
 * 2. Idempotent: Checks if refund has already processed; returns existing refundId without calling gateway.
 * 3. Atomic Lease Acquisition & Fencing:
 *    - Acquires lock with unique `leaseToken`, increments `leaseGeneration`.
 *    - Recovers abandoned locks where `status === 'processing'` and `lastAttemptAt < lockExpiry` (30s TTL).
 * 4. Deterministic Operation Identifier:
 *    - Reuses existing `order.refundDetails.opKey` or generates deterministic `refop_${order._id}`.
 *    - Passes opKey in Razorpay refund notes.
 * 5. Gateway Reconciliation Prior to Retry:
 *    - If recovering an abandoned lock, retry, or reconciliation_required state:
 *      Queries `razorpay.payments.fetch(paymentId)` to inspect authoritative `amount_refunded`.
 *      - If already refunded: Updates order directly to 'refunded' / 'processed' without calling refund API.
 *      - If confirmed 0 refunded: Safe to proceed with refund call.
 *      - If fetch fails: Marks `reconciliation_required` with `requiresManualReconciliation: true`.
 *        Never issues a blind duplicate refund!
 * 6. Fenced Gateway Execution:
 *    - Asserts active `leaseToken` before and after gateway invocation.
 *    - Stale or superseded workers cannot overwrite newer worker state.
 * 7. Post-Error Reconciliation:
 *    - If gateway call throws a timeout/network error, immediately attempts to reconcile via fetch.
 * 8. State Preservation:
 *    - Distinguishes 'processed', 'refund_pending', 'reconciliation_required', and 'failed'.
 */
export async function executeOrderRefund({ orderId, reason = "Order cancelled", initiatedBy = "system" }) {
  await connectDB();

  const order = await Order.findById(orderId);
  if (!order) {
    return { success: false, message: "Order not found" };
  }

  // 1. Idempotency Check: Was refund already durably completed?
  if (order.paymentStatus === "refunded" || order.refundDetails?.status === "processed") {
    return {
      success: true,
      alreadyRefunded: true,
      refundId: order.refundDetails?.refundId,
      message: "Refund already processed for this order.",
    };
  }

  // 1b. Safety Guard: Reject new refund dispatch if previous outcome remains uncertain (reconciliation_required)
  if (
    order.paymentStatus === "reconciliation_required" ||
    order.refundDetails?.status === "reconciliation_required" ||
    order.refundDetails?.dispatchState === "quarantined" ||
    order.refundDetails?.requiresManualReconciliation
  ) {
    return {
      success: false,
      status: "reconciliation_required",
      requiresManualReconciliation: true,
      message: "Order is in reconciliation_required state. Redispatch is prohibited. Manual reconciliation required.",
    };
  }

  // 2. Eligibility Check: Only paid orders or orders in retry require a gateway refund
  if (!["paid", "refund_pending"].includes(order.paymentStatus)) {
    return {
      success: false,
      notApplicable: true,
      message: `Order payment status '${order.paymentStatus}' does not require gateway refund.`,
    };
  }

  // 3. Prepare Stable Idempotency Key & Request Fingerprint (SEC-05 / Phase 2A.22)
  const amountPaise = Math.round(order.totalAmount * 100);
  const idempotencyKey = order.refundDetails?.idempotencyKey || generateRefundIdempotencyKey("ord", order._id);
  const opKey = order.refundDetails?.opKey || `refop_${order._id.toString()}`;
  const refundNotes = {
    opKey,
    orderId: order.orderId || order._id.toString(),
    reason: order.refundDetails?.reason || reason,
    initiatedBy: order.refundDetails?.initiatedBy || initiatedBy,
  };
  const refundPayload = {
    amount: amountPaise,
    currency: "INR",
    speed: "normal",
    notes: refundNotes,
    receipt: order.orderId || order._id.toString(),
  };
  const requestFingerprint = computePayloadFingerprint(refundPayload);

  // If a previous request fingerprint exists and differs, payload has mutated with same key -> quarantine immediately!
  if (order.refundDetails?.requestFingerprint && order.refundDetails.requestFingerprint !== requestFingerprint) {
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          paymentStatus: "reconciliation_required",
          "refundDetails.status": "reconciliation_required",
          "refundDetails.dispatchState": "quarantined",
          "refundDetails.error": "Payload mismatch: Attempted refund with modified parameters for existing idempotency key.",
          "refundDetails.requiresManualReconciliation": true,
          "refundDetails.lastAttemptAt": new Date(),
        },
      }
    );
    await reconcilePaymentIntent(order, null, "reconciliation_required", reason, "Payload mismatch for existing idempotency key");
    return {
      success: false,
      status: "reconciliation_required",
      requiresManualReconciliation: true,
      message: "Refund payload altered for existing idempotency key. Operation quarantined to prevent duplicate or corrupted refund.",
    };
  }

  // 4. Atomic Lease Acquisition & Fencing with Durable Journaling
  const lockExpiry = new Date(Date.now() - 30000); // 30-second lease TTL
  const leaseToken = crypto.randomUUID();

  const lockedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: { $in: ["paid", "refund_pending"] },
      "refundDetails.requiresManualReconciliation": { $ne: true },
      "refundDetails.dispatchState": { $ne: "quarantined" },
      $or: [
        { "refundDetails.status": { $in: ["none", "pending", "failed", null] } },
        { "refundDetails.status": { $exists: false } },
        {
          "refundDetails.status": "processing",
          $or: [
            { "refundDetails.lastAttemptAt": { $lt: lockExpiry } },
            { "refundDetails.lastAttemptAt": null },
            { "refundDetails.lastAttemptAt": { $exists: false } },
          ],
        },
      ],
    },
    {
      $set: {
        "refundDetails.status": "processing",
        "refundDetails.dispatchState": "dispatching",
        "refundDetails.leaseToken": leaseToken,
        "refundDetails.opKey": opKey,
        "refundDetails.idempotencyKey": idempotencyKey,
        "refundDetails.paymentId": order.paymentId,
        "refundDetails.amountPaise": amountPaise,
        "refundDetails.currency": "INR",
        "refundDetails.requestFingerprint": requestFingerprint,
        "refundDetails.initiatedBy": order.refundDetails?.initiatedBy || initiatedBy,
        "refundDetails.reason": order.refundDetails?.reason || reason,
        "refundDetails.lastAttemptAt": new Date(),
      },
      $inc: {
        "refundDetails.leaseGeneration": 1,
        "refundDetails.retryCount": 1,
      },
    },
    { returnDocument: "after" }
  );

  if (!lockedOrder) {
    const fresh = await Order.findById(order._id);
    if (fresh?.paymentStatus === "refunded" || fresh?.refundDetails?.status === "processed") {
      return {
        success: true,
        alreadyRefunded: true,
        refundId: fresh.refundDetails?.refundId,
        message: "Refund already processed for this order.",
      };
    }
    if (
      fresh?.paymentStatus === "reconciliation_required" ||
      fresh?.refundDetails?.status === "reconciliation_required" ||
      fresh?.refundDetails?.requiresManualReconciliation
    ) {
      return {
        success: false,
        status: "reconciliation_required",
        requiresManualReconciliation: true,
        message: "Order is in reconciliation_required state. Redispatch is prohibited. Manual reconciliation required.",
      };
    }
    return {
      success: false,
      inProgress: true,
      message: "Refund is currently processing by another worker.",
    };
  }

  // 4. Validate paymentId
  if (!lockedOrder.paymentId) {
    await Order.updateOne(
      { _id: order._id, "refundDetails.leaseToken": leaseToken },
      {
        $set: {
          paymentStatus: "reconciliation_required",
          "refundDetails.status": "failed",
          "refundDetails.error": "Order has no paymentId recorded for online refund.",
          "refundDetails.requiresManualReconciliation": true,
        },
      }
    );
    return {
      success: false,
      status: "failed",
      requiresManualReconciliation: true,
      message: "Order has no paymentId recorded for online refund.",
    };
  }

  // 5. Gateway client configuration check
  const razorpay = getRazorpayClient();
  if (!razorpay) {
    await Order.updateOne(
      { _id: order._id, "refundDetails.leaseToken": leaseToken },
      {
        $set: {
          paymentStatus: "refund_pending",
          "refundDetails.status": "pending",
          "refundDetails.error": "Payment gateway client not configured",
        },
      }
    );
    return {
      success: false,
      status: "refund_pending",
      message: "Razorpay client not configured on server. Marked refund_pending.",
    };
  }

  // 6. Reconciliation Prior to Uncertain Retry (Requirement 4 & 5)
  // If recovering an abandoned processing lock or retrying an existing attempt, check gateway first!
  const isRecoveredAttempt =
    order.refundDetails?.status === "processing" ||
    (order.refundDetails?.retryCount || 0) > 0 ||
    order.paymentStatus === "refund_pending";

  const isPreviousStatusProcessing = order.refundDetails?.status === "processing";

  if (isRecoveredAttempt) {
    try {
      const { paymentEntity, refundsList } = await getGatewayRefundsAndPayment(razorpay, lockedOrder.paymentId);

      // Check if other sub-orders share this paymentId (multi-restaurant checkout)
      const siblingCount = await Order.countDocuments({
        paymentId: lockedOrder.paymentId,
        _id: { $ne: lockedOrder._id },
      });

      // Specific refund check: look for refund matching this order's opKey, refundId, or notes.orderId
      const specificRefund = refundsList.find((r) =>
        r?.id === lockedOrder.refundDetails?.refundId ||
        r?.notes?.opKey === opKey ||
        r?.notes?.orderId === (lockedOrder.orderId || lockedOrder._id.toString())
      );

      let isFullyRefunded = false;
      let reconciledRefundId = null;

      if (specificRefund) {
        isFullyRefunded = true;
        reconciledRefundId = specificRefund.id;
      } else if (siblingCount === 0) {
        // Single order payment: safe to inspect payment-level refund amounts
        if (
          paymentEntity &&
          ((paymentEntity.amount_refunded && paymentEntity.amount_refunded >= amountPaise) ||
            paymentEntity.refund_status === "full" ||
            paymentEntity.status === "refunded")
        ) {
          isFullyRefunded = true;
          reconciledRefundId =
            refundsList?.[0]?.id ||
            paymentEntity?.refunds?.[0]?.id ||
            paymentEntity?.refundId ||
            lockedOrder.refundDetails?.refundId ||
            `rfnd_reconciled_${Date.now()}`;
        }
      } else if (siblingCount > 0 && ((paymentEntity?.amount_refunded && paymentEntity.amount_refunded > 0) || refundsList.length > 0)) {
        // Multi-restaurant payment with refunded amount, but specific refund record for THIS order is unconfirmed
        throw new Error(
          `Multi-order payment has aggregate refund, but specific refund for order ${lockedOrder._id} is unverified.`
        );
      }

      // Conservative Takeover Defense:
      // If taking over an expired 'processing' lease, and gateway shows NO matching refund:
      // The previous worker may still be in-flight or paused immediately before call.
      // Gateway does not support refund idempotency keys; speculative retry could double-refund.
      if (isPreviousStatusProcessing && !isFullyRefunded) {
        throw new Error(
          "Takeover aborted: previous refund attempt was in-flight at lease expiry. Queued for safe reconciliation."
        );
      }

      if (isFullyRefunded) {
        // Gateway ALREADY executed the refund!
        const updateRes = await Order.updateOne(
          { _id: order._id, "refundDetails.leaseToken": leaseToken },
          {
            $set: {
              paymentStatus: "refunded",
              "refundDetails.status": "processed",
              "refundDetails.dispatchState": "confirmed",
              "refundDetails.refundId": reconciledRefundId,
              "refundDetails.amount": lockedOrder.totalAmount,
              "refundDetails.processedAt": new Date(),
              "refundDetails.reconciled": true,
              "refundDetails.error": null,
              "refundDetails.requiresManualReconciliation": false,
            },
          }
        );

        if (updateRes.matchedCount === 0) {
          return {
            success: false,
            aborted: true,
            message: "Worker lease superseded during refund reconciliation.",
          };
        }

        await reconcilePaymentIntent(lockedOrder, reconciledRefundId, "processed", reason);

        return {
          success: true,
          reconciled: true,
          alreadyRefunded: true,
          refundId: reconciledRefundId,
          status: "processed",
          message: `Refund of ₹${lockedOrder.totalAmount} verified via gateway reconciliation (Refund ID: ${reconciledRefundId}).`,
        };
      }
    } catch (fetchErr) {
      const errMsg = fetchErr?.message || fetchErr?.error?.description || String(fetchErr);
      // Gateway reconciliation failed or takeover aborted: outcome is uncertain!
      // Never assume failure: transition to reconciliation_required and do NOT issue duplicate refund
      await Order.updateOne(
        { _id: order._id, "refundDetails.leaseToken": leaseToken },
        {
          $set: {
            paymentStatus: "reconciliation_required",
            "refundDetails.status": "reconciliation_required",
            "refundDetails.dispatchState": "quarantined",
            "refundDetails.error": errMsg,
            "refundDetails.requiresManualReconciliation": true,
            "refundDetails.lastAttemptAt": new Date(),
          },
        }
      );

      await reconcilePaymentIntent(lockedOrder, null, "reconciliation_required", reason, errMsg);

      return {
        success: false,
        status: "reconciliation_required",
        requiresManualReconciliation: true,
        error: errMsg,
        message: errMsg.includes("Takeover aborted")
          ? errMsg
          : `Unable to verify existing gateway refund state: ${errMsg}. Queued for manual reconciliation.`,
      };
    }
  }

  // 7. Fencing Pre-Check and Deterministic Concurrency Hook before calling Gateway
  if (typeof _testRefundPauseHook === "function") {
    await _testRefundPauseHook({ orderId: lockedOrder._id, leaseToken });
  }

  const preCheck = await Order.findOne({ _id: order._id, "refundDetails.leaseToken": leaseToken });
  if (!preCheck) {
    return {
      success: false,
      aborted: true,
      message: "Worker lease expired or superseded during pause before gateway refund call.",
    };
  }

  // Deterministic post-check pause hook (simulates thread pause/freeze AFTER lease check succeeds, BEFORE external HTTP dispatch)
  if (typeof _testRefundPostCheckPauseHook === "function") {
    await _testRefundPostCheckPauseHook({ orderId: lockedOrder._id, leaseToken });
  }

  // 8. Execute Gateway Refund with Authoritative Amount and Deterministic Idempotency Key
  let refundRes;
  let refundId;
  let refundStatus;

  if (_testRazorpayClient && typeof _testRazorpayClient.payments?.refund === "function") {
    // Adapter for test mock client
    try {
      const rawRes = await _testRazorpayClient.payments.refund(
        lockedOrder.paymentId,
        {
          amount: amountPaise,
          speed: "normal",
          receipt: lockedOrder.orderId || lockedOrder._id.toString(),
          notes: refundNotes,
        },
        {
          headers: {
            "X-Refund-Idempotency": idempotencyKey,
          },
        }
      );
      refundId = rawRes?.id || `rfnd_${Date.now()}`;
      refundStatus = rawRes?.status || "processed";
      refundRes = { success: true, refundId, status: refundStatus, refund: rawRes };
    } catch (mockErr) {
      refundRes = {
        success: false,
        uncertain: true,
        error: mockErr.message,
      };
    }
  } else {
    // Direct HTTP dispatch via RazorpayHttpClient
    refundRes = await razorpayHttpClient.executeRefund({
      paymentId: lockedOrder.paymentId,
      amountPaise,
      idempotencyKey,
      notes: refundNotes,
      speed: "normal",
      receipt: lockedOrder.orderId || lockedOrder._id.toString(),
    });
    refundId = refundRes.refundId;
    refundStatus = refundRes.status;
  }

  // Handle Response from Gateway
  if (refundRes.success) {
    const finalRefundId = refundId || `rfnd_${Date.now()}`;
    const finalRefundStatus = refundStatus || "processed";

    // Fenced save: ensure worker still owns lease
    const saveRes = await Order.updateOne(
      { _id: order._id, "refundDetails.leaseToken": leaseToken },
      {
        $set: {
          paymentStatus: "refunded",
          "refundDetails.status": "processed",
          "refundDetails.dispatchState": "confirmed",
          "refundDetails.refundId": finalRefundId,
          "refundDetails.gatewayStatus": finalRefundStatus,
          "refundDetails.amount": lockedOrder.totalAmount,
          "refundDetails.processedAt": new Date(),
          "refundDetails.error": null,
          "refundDetails.requiresManualReconciliation": false,
        },
      }
    );

    if (saveRes.matchedCount === 0) {
      return {
        success: false,
        aborted: true,
        message: "Worker lease superseded during gateway response processing.",
      };
    }

    await reconcilePaymentIntent(lockedOrder, finalRefundId, finalRefundStatus, reason);

    return {
      success: true,
      refundId: finalRefundId,
      status: "processed",
      message: `Refund of ₹${lockedOrder.totalAmount} processed successfully (Refund ID: ${finalRefundId}).`,
    };
  }

  // 9. Post-Error Reconciliation for Uncertain / Timeout / Gateway 5xx / 429 / 409 Outcomes:
  // Before marking failed or quarantined, verify whether the refund actually completed at the gateway.
  let reconciledSuccess = false;
  let reconciledRefundId = null;

  try {
    const { paymentEntity: postEntity, refundsList: postRefunds } = await getGatewayRefundsAndPayment(razorpay, lockedOrder.paymentId);
    const siblingCount = await Order.countDocuments({
      paymentId: lockedOrder.paymentId,
      _id: { $ne: lockedOrder._id },
    });

    const specificRefund = postRefunds.find((r) =>
      r?.id === lockedOrder.refundDetails?.refundId ||
      r?.notes?.opKey === opKey ||
      r?.notes?.orderId === (lockedOrder.orderId || lockedOrder._id.toString())
    );

    if (specificRefund) {
      reconciledSuccess = true;
      reconciledRefundId = specificRefund.id;
    } else if (siblingCount === 0) {
      if (
        postEntity &&
        ((postEntity.amount_refunded && postEntity.amount_refunded >= amountPaise) ||
          postEntity.refund_status === "full" ||
          postEntity.status === "refunded")
      ) {
        reconciledSuccess = true;
        reconciledRefundId = postRefunds?.[0]?.id || postEntity.refunds?.[0]?.id || `rfnd_reconciled_${Date.now()}`;
      }
    }
  } catch (postReconErr) {
    console.warn(`[RefundService] Warning during post-error reconciliation check for order ${order._id}:`, postReconErr.message);
  }

  if (reconciledSuccess) {
    await Order.updateOne(
      { _id: order._id, "refundDetails.leaseToken": leaseToken },
      {
        $set: {
          paymentStatus: "refunded",
          "refundDetails.status": "processed",
          "refundDetails.dispatchState": "confirmed",
          "refundDetails.refundId": reconciledRefundId,
          "refundDetails.amount": lockedOrder.totalAmount,
          "refundDetails.processedAt": new Date(),
          "refundDetails.reconciled": true,
          "refundDetails.error": null,
          "refundDetails.requiresManualReconciliation": false,
        },
      }
    );

    await reconcilePaymentIntent(lockedOrder, reconciledRefundId, "processed", reason);

    return {
      success: true,
      reconciled: true,
      refundId: reconciledRefundId,
      status: "processed",
      message: `Refund completed (verified via post-error reconciliation).`,
    };
  }

  // 10. Uncertain / Unverified Gateway Outcome: Atomically quarantine operation
  // Do not overwrite an already confirmed refund with a failure or uncertain state.
  await Order.updateOne(
    {
      _id: order._id,
      "refundDetails.leaseToken": leaseToken,
      paymentStatus: { $ne: "refunded" },
      "refundDetails.dispatchState": { $ne: "confirmed" },
    },
    {
      $set: {
        paymentStatus: "reconciliation_required",
        "refundDetails.status": "reconciliation_required",
        "refundDetails.dispatchState": "quarantined",
        "refundDetails.error": refundRes.error,
        "refundDetails.requiresManualReconciliation": true,
        "refundDetails.lastAttemptAt": new Date(),
      },
    }
  );

  await reconcilePaymentIntent(lockedOrder, null, "reconciliation_required", reason, refundRes.error);

  return {
    success: false,
    status: "reconciliation_required",
    requiresManualReconciliation: true,
    error: refundRes.error,
    message: `Refund outcome uncertain: ${refundRes.error}. Operation quarantined as reconciliation_required to prevent duplicate dispatch.`,
  };
}

/**
 * Release an active refund lease safely with lease token verification.
 */
export async function releaseRefundLease(orderId, leaseToken) {
  await connectDB();
  return await Order.updateOne(
    { _id: orderId, "refundDetails.leaseToken": leaseToken },
    {
      $set: {
        "refundDetails.status": "pending",
        "refundDetails.leaseToken": null,
      },
    }
  );
}

/**
 * Safe, crash-resilient, idempotent refund execution for a PaymentIntent without orders.
 * (e.g., checkout failure during verification where payment was captured but restaurant inactive/unserviceable).
 *
 * Hardened Architecture:
 * 1. Idempotency Check: Returns alreadyRefunded if status === 'refunded' or refundDetails.status === 'processed'.
 * 2. Quarantine Guard: Rejects redispatch if in 'reconciliation_required' or 'quarantined' state.
 * 3. Eligibility Check: Verifies status is 'refund_pending' and createdOrders is empty.
 * 4. Payment & Amount Validation: Checks razorpayPaymentId and amountPaise.
 * 5. Deterministic OpKey & Request Fingerprint: Quarantines on payload mutation for existing idempotency key.
 * 6. Atomic Lease Acquisition: 30s TTL lock with unique leaseToken and leaseGeneration increment.
 * 7. Gateway Reconciliation Prior to Retry:
 *    - Reconciles without calling refund API if gateway already completed refund.
 *    - Takeover Defense: Aborts and quarantines if taking over an in-flight 'dispatching' lease and gateway shows 0 refund.
 * 8. Fenced Execution: Validates leaseToken before and after gateway invocation.
 * 9. Post-Error Reconciliation: Checks gateway state immediately if dispatch throws an uncertain error.
 */
export async function executePaymentIntentRefund({
  paymentIntentId,
  reason = "PaymentIntent refund",
  initiatedBy = "system",
}) {
  await connectDB();

  const intent = await PaymentIntent.findById(paymentIntentId);
  if (!intent) {
    return { success: false, message: "PaymentIntent not found" };
  }

  // 1. Idempotency Check
  if (intent.status === "refunded" || intent.refundDetails?.status === "processed") {
    return {
      success: true,
      alreadyRefunded: true,
      refundId: intent.refundDetails?.refundId,
      message: "PaymentIntent refund already processed.",
    };
  }

  // 2. Quarantine Guard: Redispatch is prohibited for ambiguous / quarantined records
  if (
    intent.status === "reconciliation_required" ||
    intent.refundDetails?.status === "reconciliation_required" ||
    intent.refundDetails?.dispatchState === "quarantined" ||
    intent.refundDetails?.requiresManualReconciliation
  ) {
    return {
      success: false,
      status: "reconciliation_required",
      requiresManualReconciliation: true,
      message: "PaymentIntent is in reconciliation_required state. Redispatch is prohibited. Manual reconciliation required.",
    };
  }

  // 3. Eligibility Check
  if (intent.status !== "refund_pending") {
    return {
      success: false,
      notApplicable: true,
      message: `PaymentIntent status '${intent.status}' does not require gateway refund.`,
    };
  }

  if (Array.isArray(intent.createdOrders) && intent.createdOrders.length > 0) {
    return {
      success: false,
      notApplicable: true,
      message: "PaymentIntent has associated Order documents. Refund must be processed via Order refund recovery.",
    };
  }

  // 4. Validate paymentId and amountPaise
  const paymentId = intent.razorpayPaymentId || intent.refundDetails?.paymentId;
  if (!paymentId) {
    await PaymentIntent.updateOne(
      { _id: intent._id },
      {
        $set: {
          status: "reconciliation_required",
          "refundDetails.status": "failed",
          "refundDetails.dispatchState": "quarantined",
          "refundDetails.error": "PaymentIntent has no razorpayPaymentId recorded for online refund.",
          "refundDetails.requiresManualReconciliation": true,
          "refundDetails.lastAttemptAt": new Date(),
        },
      }
    );
    return {
      success: false,
      status: "reconciliation_required",
      requiresManualReconciliation: true,
      message: "PaymentIntent has no razorpayPaymentId recorded for online refund.",
    };
  }

  const amountPaise = intent.amountPaise || Math.round((intent.amount || 0) * 100);
  if (!amountPaise || amountPaise <= 0) {
    return { success: false, message: "PaymentIntent has invalid refund amount." };
  }

  // 5. Stable Idempotency Key & Request Fingerprint
  const idempotencyKey = intent.refundDetails?.idempotencyKey || generateRefundIdempotencyKey("pi", intent._id);
  const opKey = intent.refundDetails?.opKey || `refop_pi_${intent._id.toString()}`;
  const refundNotes = {
    opKey,
    paymentIntentId: intent._id.toString(),
    razorpayOrderId: intent.razorpayOrderId || "",
    reason: intent.refundDetails?.reason || reason,
    initiatedBy: intent.refundDetails?.initiatedBy || initiatedBy,
  };
  const refundPayload = {
    amount: amountPaise,
    currency: intent.currency || "INR",
    speed: "normal",
    notes: refundNotes,
    receipt: intent.razorpayOrderId || intent._id.toString(),
  };
  const requestFingerprint = computePayloadFingerprint(refundPayload);

  if (intent.refundDetails?.requestFingerprint && intent.refundDetails.requestFingerprint !== requestFingerprint) {
    await PaymentIntent.updateOne(
      { _id: intent._id },
      {
        $set: {
          status: "reconciliation_required",
          "refundDetails.status": "reconciliation_required",
          "refundDetails.dispatchState": "quarantined",
          "refundDetails.error": "Payload mismatch: Attempted refund with modified parameters for existing idempotency key.",
          "refundDetails.requiresManualReconciliation": true,
          "refundDetails.lastAttemptAt": new Date(),
        },
      }
    );
    return {
      success: false,
      status: "reconciliation_required",
      requiresManualReconciliation: true,
      message: "Refund payload altered for existing idempotency key. Operation quarantined to prevent duplicate or corrupted refund.",
    };
  }

  // 6. Atomic Lease Acquisition & Fencing
  const lockExpiry = new Date(Date.now() - 30000); // 30-second TTL
  const leaseToken = crypto.randomUUID();

  const lockedIntent = await PaymentIntent.findOneAndUpdate(
    {
      _id: intent._id,
      status: "refund_pending",
      "refundDetails.requiresManualReconciliation": { $ne: true },
      "refundDetails.dispatchState": { $ne: "quarantined" },
      $or: [
        { "refundDetails.status": { $in: ["none", "pending", "failed", null] } },
        { "refundDetails.status": { $exists: false } },
        {
          "refundDetails.status": { $in: ["processing", "refund_pending"] },
          $or: [
            { "refundDetails.lastAttemptAt": { $lt: lockExpiry } },
            { "refundDetails.lastAttemptAt": null },
            { "refundDetails.lastAttemptAt": { $exists: false } },
          ],
        },
      ],
    },
    {
      $set: {
        status: "refund_pending",
        "refundDetails.status": "processing",
        "refundDetails.dispatchState": "dispatching",
        "refundDetails.leaseToken": leaseToken,
        "refundDetails.opKey": opKey,
        "refundDetails.idempotencyKey": idempotencyKey,
        "refundDetails.paymentId": paymentId,
        "refundDetails.amountPaise": amountPaise,
        "refundDetails.currency": intent.currency || "INR",
        "refundDetails.requestFingerprint": requestFingerprint,
        "refundDetails.initiatedBy": intent.refundDetails?.initiatedBy || initiatedBy,
        "refundDetails.reason": intent.refundDetails?.reason || reason,
        "refundDetails.lastAttemptAt": new Date(),
      },
      $inc: {
        "refundDetails.leaseGeneration": 1,
        "refundDetails.retryCount": 1,
      },
    },
    { returnDocument: "after" }
  );

  if (!lockedIntent) {
    const fresh = await PaymentIntent.findById(intent._id);
    if (fresh?.status === "refunded" || fresh?.refundDetails?.status === "processed") {
      return {
        success: true,
        alreadyRefunded: true,
        refundId: fresh.refundDetails?.refundId,
        message: "PaymentIntent refund already processed.",
      };
    }
    if (
      fresh?.status === "reconciliation_required" ||
      fresh?.refundDetails?.status === "reconciliation_required" ||
      fresh?.refundDetails?.requiresManualReconciliation
    ) {
      return {
        success: false,
        status: "reconciliation_required",
        requiresManualReconciliation: true,
        message: "PaymentIntent is in reconciliation_required state. Redispatch is prohibited. Manual reconciliation required.",
      };
    }
    return {
      success: false,
      inProgress: true,
      message: "PaymentIntent refund is currently processing by another worker.",
    };
  }

  // 7. Gateway Client Check
  const razorpay = getRazorpayClient();
  if (!razorpay) {
    await PaymentIntent.updateOne(
      { _id: intent._id, "refundDetails.leaseToken": leaseToken },
      {
        $set: {
          status: "refund_pending",
          "refundDetails.status": "pending",
          "refundDetails.dispatchState": "failed",
          "refundDetails.error": "Payment gateway client not configured",
          "refundDetails.leaseToken": null,
        },
      }
    );
    return {
      success: false,
      status: "refund_pending",
      message: "Razorpay client not configured on server. Marked refund_pending.",
    };
  }

  // 8. Gateway Reconciliation Prior to Retry & Takeover Defense
  const isRecoveredAttempt =
    intent.refundDetails?.status === "processing" ||
    intent.refundDetails?.dispatchState === "dispatching" ||
    (intent.refundDetails?.retryCount || 0) > 0 ||
    intent.status === "refund_pending";

  const isPreviousDispatching =
    intent.refundDetails?.dispatchState === "dispatching" ||
    intent.refundDetails?.status === "processing";

  if (isRecoveredAttempt) {
    try {
      const { paymentEntity, refundsList } = await getGatewayRefundsAndPayment(razorpay, paymentId);

      const specificRefund = refundsList.find((r) =>
        r?.id === lockedIntent.refundDetails?.refundId ||
        r?.notes?.opKey === opKey ||
        r?.notes?.paymentIntentId === lockedIntent._id.toString() ||
        r?.notes?.razorpay_order_id === lockedIntent.razorpayOrderId
      );

      let isFullyRefunded = false;
      let reconciledRefundId = null;

      if (specificRefund) {
        isFullyRefunded = true;
        reconciledRefundId = specificRefund.id;
      } else if (refundsList.length > 1) {
        // Multiple refunds on gateway without notes: ambiguous!
        throw new Error(
          `Multiple refunds found on gateway for payment ${paymentId} without matching notes. Quarantine required.`
        );
      } else if (
        refundsList.length === 1 &&
        refundsList[0].amount === amountPaise &&
        ((paymentEntity.amount_refunded && paymentEntity.amount_refunded >= amountPaise) ||
          paymentEntity.refund_status === "full" ||
          paymentEntity.status === "refunded")
      ) {
        isFullyRefunded = true;
        reconciledRefundId = refundsList[0].id;
      } else if (
        refundsList.length === 0 &&
        paymentEntity &&
        paymentEntity.amount_refunded === amountPaise &&
        (paymentEntity.refund_status === "full" || paymentEntity.status === "refunded")
      ) {
        isFullyRefunded = true;
        reconciledRefundId = paymentEntity.refundId || `rfnd_reconciled_${Date.now()}`;
      }

      // Conservative Takeover Defense:
      // If taking over an expired lease where previous state was in-flight dispatching, and gateway shows NO matching refund:
      if (isPreviousDispatching && !isFullyRefunded) {
        throw new Error(
          "Takeover aborted: previous PaymentIntent refund attempt was in-flight at lease expiry. Queued for safe reconciliation."
        );
      }

      if (isFullyRefunded) {
        // Gateway already executed the refund! Reconcile directly without duplicate call
        const updateRes = await PaymentIntent.updateOne(
          { _id: intent._id, "refundDetails.leaseToken": leaseToken },
          {
            $set: {
              status: "refunded",
              "refundDetails.status": "processed",
              "refundDetails.dispatchState": "confirmed",
              "refundDetails.refundId": reconciledRefundId,
              "refundDetails.amount": lockedIntent.amount,
              "refundDetails.processedAt": new Date(),
              "refundDetails.reconciled": true,
              "refundDetails.error": null,
              "refundDetails.requiresManualReconciliation": false,
              "refundDetails.leaseToken": null,
            },
          }
        );

        if (updateRes.matchedCount === 0) {
          return {
            success: false,
            aborted: true,
            message: "Worker lease superseded during PaymentIntent refund reconciliation.",
          };
        }

        return {
          success: true,
          reconciled: true,
          alreadyRefunded: true,
          refundId: reconciledRefundId,
          status: "processed",
          message: `PaymentIntent refund of ₹${lockedIntent.amount} verified via gateway reconciliation (Refund ID: ${reconciledRefundId}).`,
        };
      }
    } catch (fetchErr) {
      const errMsg = fetchErr?.message || fetchErr?.error?.description || String(fetchErr);
      await PaymentIntent.updateOne(
        { _id: intent._id, "refundDetails.leaseToken": leaseToken },
        {
          $set: {
            status: "reconciliation_required",
            "refundDetails.status": "reconciliation_required",
            "refundDetails.dispatchState": "quarantined",
            "refundDetails.error": errMsg,
            "refundDetails.requiresManualReconciliation": true,
            "refundDetails.lastAttemptAt": new Date(),
            "refundDetails.leaseToken": null,
          },
        }
      );

      return {
        success: false,
        status: "reconciliation_required",
        requiresManualReconciliation: true,
        error: errMsg,
        message: errMsg.includes("Takeover aborted")
          ? errMsg
          : `Unable to verify existing gateway refund state: ${errMsg}. Queued for manual reconciliation.`,
      };
    }
  }

  // 9. Fencing Pre-Check before calling Gateway
  if (typeof _testRefundPauseHook === "function") {
    await _testRefundPauseHook({ paymentIntentId: lockedIntent._id, leaseToken });
  }

  const preCheck = await PaymentIntent.findOne({ _id: intent._id, "refundDetails.leaseToken": leaseToken });
  if (!preCheck) {
    return {
      success: false,
      aborted: true,
      message: "Worker lease expired or superseded during pause before gateway refund call.",
    };
  }

  if (typeof _testRefundPostCheckPauseHook === "function") {
    await _testRefundPostCheckPauseHook({ paymentIntentId: lockedIntent._id, leaseToken });
  }

  // 10. Execute Gateway Refund
  let refundRes;
  let refundId;
  let refundStatus;

  if (_testRazorpayClient && typeof _testRazorpayClient.payments?.refund === "function") {
    try {
      const rawRes = await _testRazorpayClient.payments.refund(
        paymentId,
        {
          amount: amountPaise,
          speed: "normal",
          receipt: lockedIntent.razorpayOrderId || lockedIntent._id.toString(),
          notes: refundNotes,
        },
        {
          headers: {
            "X-Refund-Idempotency": idempotencyKey,
          },
        }
      );
      refundId = rawRes?.id || `rfnd_${Date.now()}`;
      refundStatus = rawRes?.status || "processed";
      refundRes = { success: true, refundId, status: refundStatus, refund: rawRes };
    } catch (mockErr) {
      refundRes = {
        success: false,
        uncertain: true,
        error: mockErr.message,
      };
    }
  } else {
    refundRes = await razorpayHttpClient.executeRefund({
      paymentId,
      amountPaise,
      idempotencyKey,
      notes: refundNotes,
      speed: "normal",
      receipt: lockedIntent.razorpayOrderId || lockedIntent._id.toString(),
    });
    refundId = refundRes.refundId;
    refundStatus = refundRes.status;
  }

  // 11. Handle Response
  if (refundRes.success) {
    const finalRefundId = refundId || `rfnd_${Date.now()}`;
    const finalRefundStatus = refundStatus || "processed";

    const saveRes = await PaymentIntent.updateOne(
      { _id: intent._id, "refundDetails.leaseToken": leaseToken },
      {
        $set: {
          status: "refunded",
          "refundDetails.status": "processed",
          "refundDetails.dispatchState": "confirmed",
          "refundDetails.refundId": finalRefundId,
          "refundDetails.gatewayStatus": finalRefundStatus,
          "refundDetails.amount": lockedIntent.amount,
          "refundDetails.processedAt": new Date(),
          "refundDetails.error": null,
          "refundDetails.requiresManualReconciliation": false,
          "refundDetails.leaseToken": null,
        },
      }
    );

    if (saveRes.matchedCount === 0) {
      return {
        success: false,
        aborted: true,
        message: "Worker lease superseded during gateway response processing.",
      };
    }

    return {
      success: true,
      refundId: finalRefundId,
      status: "processed",
      message: `PaymentIntent refund of ₹${lockedIntent.amount} processed successfully (Refund ID: ${finalRefundId}).`,
    };
  }

  // 12. Post-Error Reconciliation
  let reconciledSuccess = false;
  let reconciledRefundId = null;

  try {
    const { paymentEntity: postEntity, refundsList: postRefunds } = await getGatewayRefundsAndPayment(razorpay, paymentId);
    const specificRefund = postRefunds.find((r) =>
      r?.id === lockedIntent.refundDetails?.refundId ||
      r?.notes?.opKey === opKey ||
      r?.notes?.paymentIntentId === lockedIntent._id.toString() ||
      r?.notes?.razorpay_order_id === lockedIntent.razorpayOrderId
    );

    if (specificRefund) {
      reconciledSuccess = true;
      reconciledRefundId = specificRefund.id;
    } else if (
      postEntity &&
      ((postEntity.amount_refunded && postEntity.amount_refunded >= amountPaise) ||
        postEntity.refund_status === "full" ||
        postEntity.status === "refunded")
    ) {
      reconciledSuccess = true;
      reconciledRefundId = postRefunds?.[0]?.id || postEntity?.refunds?.[0]?.id || `rfnd_reconciled_${Date.now()}`;
    }
  } catch (postReconErr) {
    console.warn(`[RefundService] Warning during post-error reconciliation check for PaymentIntent ${intent._id}:`, postReconErr.message);
  }

  if (reconciledSuccess) {
    await PaymentIntent.updateOne(
      { _id: intent._id, "refundDetails.leaseToken": leaseToken },
      {
        $set: {
          status: "refunded",
          "refundDetails.status": "processed",
          "refundDetails.dispatchState": "confirmed",
          "refundDetails.refundId": reconciledRefundId,
          "refundDetails.gatewayStatus": "processed",
          "refundDetails.amount": lockedIntent.amount,
          "refundDetails.processedAt": new Date(),
          "refundDetails.reconciled": true,
          "refundDetails.error": null,
          "refundDetails.requiresManualReconciliation": false,
          "refundDetails.leaseToken": null,
        },
      }
    );
    return {
      success: true,
      reconciled: true,
      refundId: reconciledRefundId,
      status: "processed",
      message: `Refund completed on gateway despite client communication error (Reconciled Refund ID: ${reconciledRefundId}).`,
    };
  }

  const isUncertain = refundRes.uncertain || refundRes.code === "GATEWAY_TIMEOUT" || refundRes.statusCode >= 500;
  const errorMsg = refundRes.error || "Refund execution failed";

  if (isUncertain) {
    await PaymentIntent.updateOne(
      { _id: intent._id, "refundDetails.leaseToken": leaseToken },
      {
        $set: {
          status: "reconciliation_required",
          "refundDetails.status": "reconciliation_required",
          "refundDetails.dispatchState": "quarantined",
          "refundDetails.gatewayStatus": "uncertain",
          "refundDetails.error": errorMsg,
          "refundDetails.requiresManualReconciliation": true,
          "refundDetails.lastAttemptAt": new Date(),
          "refundDetails.leaseToken": null,
        },
      }
    );
    return {
      success: false,
      status: "reconciliation_required",
      requiresManualReconciliation: true,
      message: `Gateway refund returned uncertain outcome: ${errorMsg}. Queued for manual reconciliation.`,
    };
  }

  await PaymentIntent.updateOne(
    { _id: intent._id, "refundDetails.leaseToken": leaseToken },
    {
      $set: {
        status: "refund_pending",
        "refundDetails.status": "failed",
        "refundDetails.dispatchState": "failed",
        "refundDetails.gatewayStatus": "failed",
        "refundDetails.error": errorMsg,
        "refundDetails.lastAttemptAt": new Date(),
        "refundDetails.leaseToken": null,
      },
    }
  );
  return {
    success: false,
    status: "failed",
    message: `Refund execution failed: ${errorMsg}`,
  };
}

/**
 * Release an active PaymentIntent refund lease safely with lease token verification.
 */
export async function releasePaymentIntentRefundLease(paymentIntentId, leaseToken) {
  await connectDB();
  return await PaymentIntent.updateOne(
    { _id: paymentIntentId, "refundDetails.leaseToken": leaseToken },
    {
      $set: {
        "refundDetails.status": "pending",
        "refundDetails.dispatchState": "failed",
        "refundDetails.leaseToken": null,
      },
    }
  );
}

/**
 * Retry failed inventory deduction for an order whose payment was captured.
 */
export async function retryFailedDeduction({ orderId, initiatedBy = "staff" }) {
  await connectDB();

  const order = await Order.findById(orderId);
  if (!order) {
    return { success: false, message: "Order not found" };
  }

  if (order.stockDeducted) {
    return { success: true, alreadyDeducted: true, message: "Inventory is already deducted for this order." };
  }

  const deductRes = await deductStockForOrder(order._id);
  if (deductRes.success) {
    await Order.findByIdAndUpdate(order._id, {
      inventoryStatus: "deducted",
      notes: `${order.notes || ""} [INVENTORY RESOLVED by ${initiatedBy} at ${new Date().toISOString()}]`.trim(),
    });

    // Check if PaymentIntent was in reconciliation_required and all orders now deducted
    try {
      const intent = await PaymentIntent.findOne({ createdOrders: order._id });
      if (intent && intent.status === "reconciliation_required") {
        const siblings = await Order.find({ _id: { $in: intent.createdOrders } });
        const allDeducted = siblings.every((o) => o.stockDeducted);
        if (allDeducted) {
          intent.status = "verified";
          await intent.save();
        }
      }
    } catch (_) {}

    return {
      success: true,
      message: "Inventory stock successfully deducted on retry.",
    };
  }

  await Order.findByIdAndUpdate(order._id, {
    inventoryStatus: "failed",
    notes: `${order.notes || ""} [RETRY FAILED: ${deductRes.message || "Insufficient stock"}]`.trim(),
  });

  return {
    success: false,
    insufficientStock: deductRes.insufficientStock,
    missingRequirements: deductRes.missingRequirements,
    message: deductRes.message || "Insufficient stock to complete deduction.",
  };
}

/**
 * Automated recovery worker for expired processing leases and unresolved refunds.
 * Bounded by maxRetries to avoid infinite loops, with safe identifier redaction.
 */
export async function recoverUnresolvedRefunds({ batchSize = 10, maxRetries = 3 } = {}) {
  await connectDB();
  const lockExpiry = new Date(Date.now() - 30000); // 30-second TTL

  const query = {
    paymentStatus: { $nin: ["refunded", "reconciliation_required"] },
    "refundDetails.status": { $nin: ["processed", "reconciliation_required"] },
    "refundDetails.dispatchState": { $nin: ["confirmed", "quarantined"] },
    "refundDetails.requiresManualReconciliation": { $ne: true },
    $or: [
      {
        "refundDetails.status": "processing",
        $or: [
          { "refundDetails.lastAttemptAt": { $lt: lockExpiry } },
          { "refundDetails.lastAttemptAt": null },
        ],
      },
      {
        paymentStatus: "refund_pending",
        "refundDetails.status": { $ne: "processing" },
        "refundDetails.retryCount": { $lt: maxRetries },
      },
    ],
  };

  const orders = await Order.find(query).limit(batchSize);
  const results = [];
  let recovered = 0;
  let reconciled = 0;
  let aborted = 0;
  let failed = 0;

  for (const order of orders) {
    const maskedId = `${order._id.toString().substring(0, 6)}...`;
    try {
      const res = await executeOrderRefund({
        orderId: order._id,
        reason: "Automated recovery of unresolved refund",
        initiatedBy: "recovery_worker",
      });

      if (res.success && res.reconciled) reconciled++;
      else if (res.success) recovered++;
      else if (res.aborted || res.requiresManualReconciliation || res.status === "reconciliation_required") aborted++;
      else failed++;

      results.push({
        orderId: order._id.toString(),
        paymentStatus: order.paymentStatus,
        resultStatus: res.status || (res.success ? "processed" : "failed"),
        success: res.success || false,
        reconciled: res.reconciled || false,
        message: res.message,
      });
    } catch (err) {
      failed++;
      console.error(`[RecoveryWorker] Error recovering order ${maskedId}:`, err.message);
      results.push({
        orderId: order._id.toString(),
        error: err.message,
      });
    }
  }

  // PaymentIntent recovery (Phase 2.4.2 & 2.4.3):
  // 1. Candidate selection: Inspects genuinely eligible PaymentIntents without orders where refund is pending.
  //    Excludes 'reconciliation_required' and 'requiresManualReconciliation: true' to eliminate batch starvation.
  // 2. Operational visibility: Counts quarantined records and includes in report so operators have full visibility.
  // 3. Eligible refund_pending records:
  //    Enforces retry bounds and expired leases, checks gateway before calling refund, protects against duplicate dispatch.
  const intentQuery = {
    status: { $nin: ["refunded", "reconciliation_required"] },
    "refundDetails.status": { $nin: ["processed", "reconciliation_required"] },
    "refundDetails.dispatchState": { $nin: ["confirmed", "quarantined"] },
    "refundDetails.requiresManualReconciliation": { $ne: true },
    $and: [
      {
        $or: [
          { createdOrders: { $size: 0 } },
          { createdOrders: { $exists: false } },
          { createdOrders: null },
        ],
      },
      {
        $or: [
          {
            "refundDetails.status": "processing",
            $or: [
              { "refundDetails.lastAttemptAt": { $lt: lockExpiry } },
              { "refundDetails.lastAttemptAt": null },
            ],
          },
          {
            status: "refund_pending",
            "refundDetails.status": { $ne: "processing" },
            "refundDetails.retryCount": { $lt: maxRetries },
          },
        ],
      },
    ],
  };

  const candidateIntents = await PaymentIntent.find(intentQuery).limit(batchSize);

  for (const intent of candidateIntents) {
    const maskedPiId = `${intent._id.toString().substring(0, 6)}...`;
    try {
      const res = await executePaymentIntentRefund({
        paymentIntentId: intent._id,
        reason: "Automated recovery of unresolved PaymentIntent refund",
        initiatedBy: "recovery_worker",
      });

      if (res.success && res.reconciled) reconciled++;
      else if (res.success) recovered++;
      else if (res.aborted || res.requiresManualReconciliation || res.status === "reconciliation_required") aborted++;
      else failed++;

      results.push({
        type: "payment_intent",
        paymentIntentId: intent._id.toString(),
        paymentStatus: intent.status,
        resultStatus: res.status || (res.success ? "processed" : "failed"),
        success: res.success || false,
        reconciled: res.reconciled || false,
        message: res.message,
      });
    } catch (err) {
      failed++;
      console.error(`[RecoveryWorker] Error recovering PaymentIntent ${maskedPiId}:`, err.message);
      results.push({
        type: "payment_intent",
        paymentIntentId: intent._id.toString(),
        error: err.message,
      });
    }
  }

  let quarantinedOrdersCount = 0;
  let quarantinedIntentsCount = 0;
  try {
    if (typeof Order.countDocuments === "function") {
      quarantinedOrdersCount = await Order.countDocuments({
        $or: [
          { paymentStatus: "reconciliation_required" },
          { "refundDetails.status": "reconciliation_required" },
          { "refundDetails.dispatchState": "quarantined" },
          { "refundDetails.requiresManualReconciliation": true },
        ],
      });
    }
    if (typeof PaymentIntent.countDocuments === "function") {
      quarantinedIntentsCount = await PaymentIntent.countDocuments({
        $or: [
          { status: "reconciliation_required" },
          { "refundDetails.status": "reconciliation_required" },
          { "refundDetails.dispatchState": "quarantined" },
          { "refundDetails.requiresManualReconciliation": true },
        ],
      });
    }
  } catch (_countErr) {
    // Non-fatal if countDocuments fails in limited test mock environments
  }

  return {
    scanned: orders.length + candidateIntents.length,
    ordersScanned: orders.length,
    intentsScanned: candidateIntents.length,
    quarantinedOrdersPendingReview: quarantinedOrdersCount,
    quarantinedIntentsPendingReview: quarantinedIntentsCount,
    recovered,
    reconciled,
    aborted,
    failed,
    results,
  };
}

/**
 * Safe, verified reconciliation of an order refund.
 * Strictly read-only against the payment gateway (never dispatches razorpay.payments.refund).
 * Validates paymentId, authoritative gateway refund amount, and sub-order attribution notes.
 * Does NOT trust unverified refundId shortcuts.
 */
export async function reconcileOrderRefund({ orderId, refundId = null, initiatedBy = "superadmin" }) {
  await connectDB();
  const order = await Order.findById(orderId);
  if (!order) {
    return { success: false, message: "Order not found." };
  }

  if (order.paymentStatus === "refunded" && order.refundDetails?.status === "processed") {
    return {
      success: true,
      alreadyRefunded: true,
      refundId: order.refundDetails?.refundId,
      message: "Order is already marked refunded.",
    };
  }

  if (!order.paymentId) {
    return {
      success: false,
      message: "Order has no paymentId recorded for reconciliation.",
    };
  }

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return {
      success: false,
      message: "Payment gateway client not configured.",
    };
  }

  const amountPaise = Math.round(order.totalAmount * 100);
  const opKey = order.refundDetails?.opKey || `refop_${order._id.toString()}`;

  // Fetch gateway records (Payment & Refunds)
  const { paymentEntity, refundsList } = await getGatewayRefundsAndPayment(razorpay, order.paymentId);

  // Validation: Fetched payment exists and currency is INR
  if (!paymentEntity) {
    return {
      success: false,
      message: `Gateway verification failed: Payment '${order.paymentId}' was not found on payment gateway.`,
    };
  }

  if (!paymentEntity.currency || paymentEntity.currency.toUpperCase() !== "INR") {
    return {
      success: false,
      message: `Gateway verification failed: Fetched payment currency '${paymentEntity.currency || "MISSING"}' is invalid (expected 'INR').`,
    };
  }

  // Check if other sub-orders share this paymentId
  const siblingCount = await Order.countDocuments({
    paymentId: order.paymentId,
    _id: { $ne: order._id },
  });

  let matchedRefund = null;

  if (refundId) {
    // Look for this specific refundId in gateway refundsList
    matchedRefund = refundsList.find((r) => r?.id === refundId);
    if (!matchedRefund) {
      return {
        success: false,
        message: `Gateway verification failed: Refund ID '${refundId}' was not found for payment '${order.paymentId}'.`,
      };
    }
  } else {
    // Search among all refunds for this payment for one matching this order's opKey or orderId
    const matchingRefunds = refundsList.filter((r) =>
      r?.notes?.opKey === opKey ||
      r?.notes?.orderId === (order.orderId || order._id.toString())
    );

    if (matchingRefunds.length > 1) {
      return {
        success: false,
        message: `Gateway verification failed: Multiple ambiguous refunds found for order ${order._id}.`,
      };
    } else if (matchingRefunds.length === 1) {
      matchedRefund = matchingRefunds[0];
    } else if (siblingCount === 0) {
      // Single order payment: check if full refund exists on payment entity
      if (
        (paymentEntity.amount_refunded && paymentEntity.amount_refunded >= amountPaise) ||
        paymentEntity.refund_status === "full" ||
        paymentEntity.status === "refunded"
      ) {
        matchedRefund = refundsList[0] || {
          id: paymentEntity.refundId || `rfnd_reconciled_${Date.now()}`,
          amount: paymentEntity.amount_refunded || amountPaise,
          currency: paymentEntity.currency || "INR",
          payment_id: paymentEntity.id || order.paymentId,
        };
      }
    }
  }

  if (!matchedRefund) {
    return {
      success: false,
      message: "Gateway verification failed: No matching refund found on payment gateway for this order.",
    };
  }

  // Validation: Refund belongs to the expected payment
  if (matchedRefund.payment_id && matchedRefund.payment_id !== order.paymentId) {
    return {
      success: false,
      message: `Gateway verification failed: Refund '${matchedRefund.id}' belongs to payment '${matchedRefund.payment_id}', expected '${order.paymentId}'.`,
    };
  }

  // Validation: Refund currency is INR
  if (!matchedRefund.currency || matchedRefund.currency.toUpperCase() !== "INR") {
    return {
      success: false,
      message: `Gateway verification failed: Refund currency '${matchedRefund.currency || "MISSING"}' is invalid (expected 'INR').`,
    };
  }

  // Validation: Refund amount strictly matches expected order amount
  if (typeof matchedRefund.amount !== "number" || matchedRefund.amount !== amountPaise) {
    return {
      success: false,
      message: `Gateway verification failed: Refund amount (${matchedRefund.amount ?? "MISSING"} paise) does not match order amount (${amountPaise} paise).`,
    };
  }

  // Validation: Reliable attribution to this order/sub-order
  if (siblingCount > 0) {
    const isAttributed =
      matchedRefund.notes?.opKey === opKey ||
      matchedRefund.notes?.orderId === (order.orderId || order._id.toString());
    if (!isAttributed) {
      return {
        success: false,
        message: `Gateway verification failed: Refund '${matchedRefund.id || "unknown"}' lacks sub-order attribution notes for order ${order._id}.`,
      };
    }
  }

  // Update order to refunded state — ZERO OUTBOUND CALLS TO razorpay.payments.refund
  const resolvedRefundId = matchedRefund.id || refundId;
  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        paymentStatus: "refunded",
        "refundDetails.status": "processed",
        "refundDetails.dispatchState": "confirmed",
        "refundDetails.gatewayStatus": matchedRefund.status || "processed",
        "refundDetails.refundId": resolvedRefundId,
        "refundDetails.amount": order.totalAmount,
        "refundDetails.processedAt": new Date(),
        "refundDetails.reconciled": true,
        "refundDetails.error": null,
        "refundDetails.requiresManualReconciliation": false,
        "refundDetails.initiatedBy": initiatedBy,
      },
    }
  );

  await reconcilePaymentIntent(order, resolvedRefundId, "processed", "Superadmin manual reconciliation");

  return {
    success: true,
    reconciled: true,
    refundId: resolvedRefundId,
    status: "processed",
    message: `Order refund successfully reconciled against gateway refund ${resolvedRefundId}.`,
  };
}

/**
 * Safe, verified reconciliation of a PaymentIntent refund (for intents without orders).
 * Strictly read-only against the payment gateway (never dispatches razorpay.payments.refund).
 * Validates currency, amount, paymentId, and status.
 */
export async function reconcilePaymentIntentRefund({ paymentIntentId, refundId = null, initiatedBy = "superadmin" }) {
  await connectDB();
  const intent = await PaymentIntent.findById(paymentIntentId);
  if (!intent) {
    return { success: false, message: "PaymentIntent not found." };
  }

  if (intent.status === "refunded" && intent.refundDetails?.status === "processed") {
    return {
      success: true,
      alreadyRefunded: true,
      refundId: intent.refundDetails?.refundId,
      message: "PaymentIntent is already marked refunded.",
    };
  }

  if (!intent.razorpayPaymentId) {
    return {
      success: false,
      message: "PaymentIntent has no razorpayPaymentId recorded for reconciliation.",
    };
  }

  // Phase 2.4.3 (AUD-242-03 & AUD-242-04): Safety & Attribution guards
  // 1. If PaymentIntent has createdOrders, reconciliation must proceed through Order reconciliation
  if (intent.createdOrders && intent.createdOrders.length > 0) {
    return {
      success: false,
      message: "PaymentIntent has associated orders; reconciliation must proceed via order reconciliation.",
    };
  }

  // 2. Sibling Order check: If any Order in database shares this paymentId, reject orphan intent reconciliation
  let siblingOrderCount = 0;
  if (typeof Order.countDocuments === "function") {
    siblingOrderCount = await Order.countDocuments({
      paymentId: intent.razorpayPaymentId,
    });
  }
  if (siblingOrderCount > 0) {
    return {
      success: false,
      message: `Gateway payment '${intent.razorpayPaymentId}' has ${siblingOrderCount} associated Order record(s); reconciliation must proceed via order reconciliation.`,
    };
  }

  // 3. Sibling PaymentIntent check: If another PaymentIntent shares this razorpayPaymentId, require manual review
  let siblingIntentCount = 0;
  if (typeof PaymentIntent.countDocuments === "function") {
    siblingIntentCount = await PaymentIntent.countDocuments({
      razorpayPaymentId: intent.razorpayPaymentId,
      _id: { $ne: intent._id },
    });
  }
  if (siblingIntentCount > 0) {
    return {
      success: false,
      message: `Gateway payment '${intent.razorpayPaymentId}' is associated with multiple PaymentIntents; manual reconciliation required.`,
    };
  }

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return {
      success: false,
      message: "Payment gateway client not configured.",
    };
  }

  const amountPaise = intent.amountPaise;
  const opKey = intent.refundDetails?.opKey || `refop_pi_${intent._id.toString()}`;

  const { paymentEntity, refundsList } = await getGatewayRefundsAndPayment(razorpay, intent.razorpayPaymentId);

  if (!paymentEntity) {
    return {
      success: false,
      message: `Gateway verification failed: Payment '${intent.razorpayPaymentId}' was not found on payment gateway.`,
    };
  }

  if (!paymentEntity.currency || paymentEntity.currency.toUpperCase() !== "INR") {
    return {
      success: false,
      message: `Gateway verification failed: Fetched payment currency '${paymentEntity.currency || "MISSING"}' is invalid (expected 'INR').`,
    };
  }

  let matchedRefund = null;

  if (refundId) {
    matchedRefund = refundsList.find((r) => r?.id === refundId);
    if (!matchedRefund) {
      return {
        success: false,
        message: `Gateway verification failed: Refund ID '${refundId}' was not found for payment '${intent.razorpayPaymentId}'.`,
      };
    }
  } else {
    // Exact operation-key or metadata match
    const matchingRefunds = refundsList.filter((r) =>
      r?.notes?.opKey === opKey ||
      r?.notes?.paymentIntentId === intent._id.toString() ||
      r?.notes?.razorpay_order_id === intent.razorpayOrderId
    );

    if (matchingRefunds.length > 1) {
      return {
        success: false,
        message: `Gateway verification failed: Multiple ambiguous refunds match PaymentIntent metadata for ${intent._id}.`,
      };
    } else if (matchingRefunds.length === 1) {
      matchedRefund = matchingRefunds[0];
    } else if (refundsList.length > 1) {
      // Multiple refunds exist on gateway without matching notes: never pick refundsList[0]!
      return {
        success: false,
        message: `Gateway verification failed: Multiple partial/unattributed refunds (${refundsList.length}) found for payment '${intent.razorpayPaymentId}'. Manual reconciliation required.`,
      };
    } else if (refundsList.length === 1) {
      // Exactly ONE refund on gateway for this payment: verify amount and attribution safety
      const singleRefund = refundsList[0];
      const hasForeignNotes =
        (singleRefund.notes?.opKey && singleRefund.notes.opKey !== opKey) ||
        Boolean(singleRefund.notes?.orderId) ||
        (singleRefund.notes?.paymentIntentId && singleRefund.notes.paymentIntentId !== intent._id.toString());

      if (hasForeignNotes) {
        return {
          success: false,
          message: `Gateway verification failed: Single refund '${singleRefund.id}' has notes attributing it to a different operation.`,
        };
      }

      if (typeof singleRefund.amount === "number" && singleRefund.amount === amountPaise) {
        matchedRefund = singleRefund;
      } else {
        return {
          success: false,
          message: `Gateway verification failed: Single refund '${singleRefund.id}' amount (${singleRefund.amount} paise) does not match PaymentIntent amount (${amountPaise} paise).`,
        };
      }
    } else if (
      paymentEntity &&
      paymentEntity.amount_refunded === amountPaise &&
      (paymentEntity.refund_status === "full" || paymentEntity.status === "refunded")
    ) {
      matchedRefund = {
        id: paymentEntity.refundId || `rfnd_reconciled_${Date.now()}`,
        amount: paymentEntity.amount_refunded,
        currency: paymentEntity.currency || "INR",
        payment_id: paymentEntity.id || intent.razorpayPaymentId,
      };
    }
  }

  if (!matchedRefund) {
    return {
      success: false,
      message: "Gateway verification failed: No matching refund found on payment gateway for this PaymentIntent.",
    };
  }

  if (matchedRefund.payment_id && matchedRefund.payment_id !== intent.razorpayPaymentId) {
    return {
      success: false,
      message: `Gateway verification failed: Refund '${matchedRefund.id}' belongs to payment '${matchedRefund.payment_id}', expected '${intent.razorpayPaymentId}'.`,
    };
  }

  if (!matchedRefund.currency || matchedRefund.currency.toUpperCase() !== "INR") {
    return {
      success: false,
      message: `Gateway verification failed: Refund currency '${matchedRefund.currency || "MISSING"}' is invalid (expected 'INR').`,
    };
  }

  if (typeof matchedRefund.amount !== "number" || matchedRefund.amount !== amountPaise) {
    return {
      success: false,
      message: `Gateway verification failed: Refund amount (${matchedRefund.amount ?? "MISSING"} paise) does not match PaymentIntent amount (${amountPaise} paise).`,
    };
  }

  const resolvedRefundId = matchedRefund.id || refundId;
  await PaymentIntent.updateOne(
    { _id: intent._id },
    {
      $set: {
        status: "refunded",
        "refundDetails.status": "processed",
        "refundDetails.dispatchState": "confirmed",
        "refundDetails.gatewayStatus": matchedRefund.status || "processed",
        "refundDetails.refundId": resolvedRefundId,
        "refundDetails.amount": intent.amount,
        "refundDetails.processedAt": new Date(),
        "refundDetails.reconciled": true,
        "refundDetails.error": null,
        "refundDetails.requiresManualReconciliation": false,
        "refundDetails.leaseToken": null,
      },
    }
  );

  return {
    success: true,
    reconciled: true,
    refundId: resolvedRefundId,
    status: "processed",
    message: `PaymentIntent refund successfully reconciled against gateway refund ${resolvedRefundId}.`,
  };
}

