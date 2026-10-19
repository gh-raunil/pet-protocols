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
  _testRazorpayClient = client;
}

export function _setTestHttpTransport(fn) {
  _setClientTestHttpTransport(fn);
}

export function _resetTestHttpTransport() {
  _resetClientTestHttpTransport();
}

export function _setTestRefundPauseHook(fn) {
  _testRefundPauseHook = fn;
}

export function _setTestRefundPostCheckPauseHook(fn) {
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
async function reconcilePaymentIntent(lockedOrder, refundId, refundStatus, reason, error = null) {
  try {
    const intent = await PaymentIntent.findOne({
      $or: [
        { razorpayOrderId: lockedOrder.orderId },
        { razorpayPaymentId: lockedOrder.paymentId },
        { createdOrders: lockedOrder._id },
      ],
    });

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
        amount: lockedOrder.totalAmount,
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

  // PaymentIntent recovery (P2):
  // Strictly read-only gateway reconciliation. Never issues speculative refund POST calls.
  // Quarantines unresolved in-flight intents and recovers verified gateway refunds.
  const intentQuery = {
    status: "refund_pending",
    "refundDetails.status": { $nin: ["processed", "reconciliation_required"] },
    "refundDetails.dispatchState": { $nin: ["confirmed", "quarantined"] },
    "refundDetails.requiresManualReconciliation": { $ne: true },
    $or: [
      { "refundDetails.lastAttemptAt": { $lt: lockExpiry } },
      { "refundDetails.lastAttemptAt": null },
      { "refundDetails.lastAttemptAt": { $exists: false } },
    ],
  };

  const candidateIntents = await PaymentIntent.find(intentQuery).limit(batchSize);

  for (const intent of candidateIntents) {
    const maskedPiId = `${intent._id.toString().substring(0, 6)}...`;
    try {
      const reconRes = await reconcilePaymentIntentRefund({
        paymentIntentId: intent._id,
        initiatedBy: "recovery_worker",
      });

      if (reconRes.success && reconRes.reconciled) {
        reconciled++;
        results.push({
          type: "payment_intent",
          paymentIntentId: intent._id.toString(),
          success: true,
          reconciled: true,
          status: "refunded",
          message: reconRes.message,
        });
      } else {
        // Gateway does not confirm refund:
        // Transition to reconciliation_required / quarantined to prevent re-verification races
        await PaymentIntent.updateOne(
          { _id: intent._id, status: "refund_pending" },
          {
            $set: {
              status: "reconciliation_required",
              "refundDetails.status": "reconciliation_required",
              "refundDetails.dispatchState": "quarantined",
              "refundDetails.requiresManualReconciliation": true,
              "refundDetails.error": "Automated recovery: No matching gateway refund found for pending PaymentIntent. Quarantined for manual review.",
              "refundDetails.lastAttemptAt": new Date(),
            },
          }
        );
        aborted++;
        results.push({
          type: "payment_intent",
          paymentIntentId: intent._id.toString(),
          success: false,
          reconciled: false,
          status: "reconciliation_required",
          requiresManualReconciliation: true,
          message: reconRes.message || "PaymentIntent unverified at gateway; safely quarantined.",
        });
      }
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

  return {
    scanned: orders.length + candidateIntents.length,
    ordersScanned: orders.length,
    intentsScanned: candidateIntents.length,
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
    const matchingRefunds = refundsList.filter((r) =>
      r?.notes?.opKey === opKey ||
      r?.notes?.paymentIntentId === intent._id.toString() ||
      r?.notes?.razorpay_order_id === intent.razorpayOrderId
    );

    if (matchingRefunds.length > 1) {
      return {
        success: false,
        message: `Gateway verification failed: Multiple ambiguous refunds found for PaymentIntent ${intent._id}.`,
      };
    } else if (matchingRefunds.length === 1) {
      matchedRefund = matchingRefunds[0];
    } else if (
      (paymentEntity.amount_refunded && paymentEntity.amount_refunded >= amountPaise) ||
      paymentEntity.refund_status === "full" ||
      paymentEntity.status === "refunded"
    ) {
      matchedRefund = refundsList[0] || {
        id: paymentEntity.refundId || `rfnd_reconciled_${Date.now()}`,
        amount: paymentEntity.amount_refunded || amountPaise,
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

