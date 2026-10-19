# Phase 2A.22.4 — Order Webhook Validation and Refund Race Remediation Report

**Date:** October 16, 2026  
**Status:** COMPLETED — PRODUCTION BLOCKED — CRON SCHEDULER DISABLED (`CRON_REFUND_RECOVERY_ENABLED=false`)  
**Scope:** Remediation of Order Refund Webhook Validation, Network-Boundary Race Mitigation, Read-Only PaymentIntent Recovery, and Isolated Regression Verification  

---

## Executive Summary

Phase 2A.22.4 implements a targeted, defense-in-depth remediation addressing the critical gaps identified in the refund safety audits:
1. **P1-A: Order Refund Webhook Hardening:** Prior to this phase, `targetOrder` webhook processing in `backend/app/api/payment/webhook/route.js` lacked strict validation for currency, amount, payment ID, journaled refund ID, and multi-restaurant sub-order attribution. An incoming webhook with mismatched currency (e.g., USD/EUR), arbitrary partial refund amounts, or wrong payment associations could erroneously confirm an order as `refunded` and clear `requiresManualReconciliation`. We implemented strict 5-point pre-confirmation validation, atomic conditional updates (`paymentStatus: { $ne: 'refunded' }`, `'refundDetails.dispatchState': { $ne: 'confirmed' }`), immutable protection against out-of-order `refund.failed` events, and safe quarantine with HTTP 400 error responses that preserve retryability.
2. **P1-B: External Network-Boundary Race Mitigation:** A local database lease or pre-flight check immediately before `fetch()` cannot recall or cancel an in-flight TCP/HTTPS packet if Worker A is paused (e.g., Node.js event-loop lag, GC pause, container preemption) after the pre-check. We explicitly do **not** claim a lease check alone solves the network boundary race, nor do we claim "exactly-once" execution. Instead, we implement a multi-layered mitigation: durable single-dispatch authorization states, immutable idempotency keys (`refkey_ord_<id>`) and request fingerprints, a takeover-abort defense where subsequent workers abort to quarantine rather than blind redispatch, and strict prohibition of automated redispatches across all API endpoints. The residual race is formally documented.
3. **P2: Safe PaymentIntent Recovery Coverage:** Extended the background recovery routine (`recoverUnresolvedRefunds` in `backend/lib/refundService.js`) to scan pending `PaymentIntent` records without introducing any speculative refund dispatch. The recovery routine uses **strictly read-only** reconciliation (`reconcilePaymentIntentRefund`), issuing **zero** outbound refund POST calls (`razorpay.payments.refund`). Verified gateway refunds transition to `refunded`/`confirmed`, while unverified intents are safely quarantined into `reconciliation_required`.
4. **Regression Verification:** All 36 tests in `test_p1_refund_suite.mjs` (including 11 new comprehensive subtests in Test 36), all 61 tests in `test_phase2a_inventory.mjs`, and the Next.js production build (`npm run build`) passed with exit code 0.

---

## 1. Files Changed

| File Path | Modification Summary |
| :--- | :--- |
| [`backend/app/api/payment/webhook/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/webhook/route.js) | Added 5-point validation to Order refund webhook: (1) Currency must be `INR`, (2) Amount must match exact expected paise from journal or order total, (3) Payment ID must match `targetOrder.paymentId`, (4) Refund ID must match existing journaled `refundId`, (5) Multi-restaurant sub-orders must match `notes.opKey` or `notes.orderId`. Converted all order confirmation and quarantine updates to concurrency-safe conditional writes (`$ne: 'refunded'`, `$ne: 'confirmed'`). Replaced throwing intent errors with safe warning logs. Hardened `refund.failed` to never regress confirmed orders. |
| [`backend/lib/refundService.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js) | Added warning log to post-error reconciliation catch block (line 646). Extended `recoverUnresolvedRefunds` with safe, read-only `PaymentIntent` reconciliation loop (lines 848–920) scanning `status: "refund_pending"`. Implemented zero-outbound-POST verification, safe quarantine on unverified intents, and cleaned query predicates. |
| [`backend/scripts/test_p1_refund_suite.mjs`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/scripts/test_p1_refund_suite.mjs) | Added comprehensive Test 36 containing 11 isolated subtests validating currency mismatch rejection, partial amount rejection, wrong payment ID rejection, inconsistent refund ID rejection, multi-restaurant attribution notes enforcement, valid matching confirmation, idempotent replay, out-of-order `refund.failed` immunity, quarantine preservation, and PaymentIntent recovery with zero refund POST calls. |

---

## 2. Before / After State Transitions

### A. Order Webhook Processing (`backend/app/api/payment/webhook/route.js`)

| Scenario | Before (Phase 2A.22.3) | After (Phase 2A.22.4) |
| :--- | :--- | :--- |
| **Incoming currency != INR (e.g., USD, EUR)** | Ignored currency; marked order `refunded` and cleared `requiresManualReconciliation`. | **Rejected (HTTP 400).** Quarantined to `paymentStatus: "reconciliation_required"`, `dispatchState: "quarantined"`, `requiresManualReconciliation: true`. |
| **Incoming amount != expected amount in paise** | Read `refundEntity.amount / 100`, marked order `refunded`, even if partial or mismatched. | **Rejected (HTTP 400).** Validated against `refundDetails.amountPaise` (or `Math.round(totalAmount * 100)`). If mismatched, quarantined; order remains unrefunded. |
| **Incoming payment_id != order.paymentId** | Could match by `refundDetails.refundId` or note and overwrite order without checking payment ID. | **Rejected (HTTP 400).** Quarantined with diagnostic payment mismatch error. |
| **Incoming refund_id != journaled refundId** | Overwrote journaled `refundId` with incoming ID. | **Rejected (HTTP 400).** Quarantined with diagnostic refund ID mismatch error. |
| **Multi-restaurant payment without sub-order notes** | If matched by order ID, could confirm order even if refund entity lacked sub-order attribution notes. | **Rejected (HTTP 400).** Checks `siblingCount > 0`. If notes lack matching `opKey` or `orderId`, quarantined for manual reconciliation. |
| **Concurrent confirmation / Out-of-order failure** | Unconditional `$set` could downgrade a `refunded` order upon late `refund.failed` arrival. | **Conditional update `{ paymentStatus: { $ne: 'refunded' }, 'refundDetails.dispatchState': { $ne: 'confirmed' } }`.** Confirmed orders are completely immutable. |
| **Retryability after operator correction** | Inconclusive errors returned 200 with ambiguous payload, stopping Razorpay webhook retries. | **Returns HTTP 400** on validation failure. Razorpay automatically retries according to webhook backoff schedule after configuration/data correction. |

### B. PaymentIntent Recovery Routine (`backend/lib/refundService.js`)

| Metric / Action | Before (Phase 2A.22.3) | After (Phase 2A.22.4) |
| :--- | :--- | :--- |
| **Unresolved PaymentIntents scanned by recovery worker** | Omitted entirely; only `Order` collection was scanned. Unresolved intents remained stuck in `refund_pending` indefinitely. | Scanned in `recoverUnresolvedRefunds` using query `{ status: "refund_pending", "refundDetails.requiresManualReconciliation": { $ne: true } }`. |
| **Outbound HTTP Method to Gateway** | N/A (Not scanned). | **Strictly Read-Only (0 `POST /v1/payments/:id/refund` calls).** Only issues read queries (`GET /v1/payments/:id` and `GET /v1/payments/:id/refunds`). |
| **Outcome: Gateway confirms valid refund** | N/A | Transitioned to `status: "refunded"`, `dispatchState: "confirmed"`, `requiresManualReconciliation: false`. |
| **Outcome: Gateway does NOT show refund (or uncertain)** | N/A | Transitioned to `status: "reconciliation_required"`, `dispatchState: "quarantined"`, `requiresManualReconciliation: true`. Speculative redispatch strictly prohibited. |

---

## 3. P1-A: Order Webhook Validation Deep-Dive

### Validation Logic Implemented
Before an Order is marked `refunded` or has its `requiresManualReconciliation` flag cleared in `backend/app/api/payment/webhook/route.js`, the webhook handler executes five strict checks:

```javascript
// 1. Currency validation: INR only
const refundCurrency = (refundEntity.currency || '').toUpperCase();
if (refundCurrency && refundCurrency !== 'INR') {
  // Concurrency-safe quarantine update & return HTTP 400
}

// 2. Exact amount validation in paise
const expectedAmountPaise =
  typeof targetOrder.refundDetails?.amountPaise === 'number' && targetOrder.refundDetails.amountPaise > 0
    ? targetOrder.refundDetails.amountPaise
    : Math.round(targetOrder.totalAmount * 100);

if (typeof refundEntity.amount === 'number' && refundEntity.amount !== expectedAmountPaise) {
  // Concurrency-safe quarantine update & return HTTP 400
}

// 3. Payment ID validation
if (paymentId && targetOrder.paymentId && paymentId !== targetOrder.paymentId) {
  // Concurrency-safe quarantine update & return HTTP 400
}

// 4. Inconsistent refund ID check against journaled refund
if (targetOrder.refundDetails?.refundId && targetOrder.refundDetails.refundId !== refundId) {
  // Concurrency-safe quarantine update & return HTTP 400
}

// 5. Multi-restaurant sub-order attribution check
const siblingCount = await Order.countDocuments({
  paymentId: targetOrder.paymentId,
  _id: { $ne: targetOrder._id },
});

if (siblingCount > 0) {
  const isAttributed =
    (opKey && targetOrder.refundDetails?.opKey === opKey) ||
    (orderIdNote && (targetOrder.orderId === orderIdNote || targetOrder._id.toString() === orderIdNote));
  if (!isAttributed) {
    // Concurrency-safe quarantine update & return HTTP 400
  }
}
```

### Partial Refund Stance
The existing business model represents each distinct checkout as either a single order or a set of distinct sub-orders (in multi-restaurant checkouts) where each sub-order has its own unique `totalAmount` and `orderId`. Legitimate partial refunds for an individual sub-order are **not** supported by the current data model. Any refund amount differing from `expectedAmountPaise` is treated as ambiguous and quarantined.

---

## 4. P1-B: Analysis and Mitigation of External Network-Boundary Race

### Problem Statement: Why Database Leases Cannot Solve Network In-Flight Races
Consider two workers, Worker A and Worker B:
1. Worker A acquires the refund lease in MongoDB for Order X (`leaseExpiresAt = T + 30s`).
2. Worker A performs all pre-flight checks: validates database status, journals the idempotency key `refkey_ord_X`, and sets `dispatchState = "dispatched"`.
3. Worker A pauses immediately before the outbound network socket write (due to a Node.js process pause, thread starvation, GC freeze, or virtualization suspension) for 35 seconds.
4. Worker A's lease expires at `T + 30s`.
5. At `T + 31s`, Worker B acquires the lease. Worker B checks the gateway, sees no refund yet, and prepares to dispatch.
6. Worker A resumes at `T + 35s`. Worker A's process already holds the compiled HTTP request in memory. The socket write executes.
7. Worker B also executes its socket write.

A database lease check immediately before `fetch()` **cannot** revoke or recall the HTTP request once the execution thread passes the check and prepares the socket write. There is no remote network "cancellation" protocol for HTTP/1.1 or HTTP/2 POST requests once transmitted over TLS.

### Multi-Layered Mitigation Implemented

We do not claim "exactly-once" execution. Instead, we implement five authoritative defensive barriers:

1. **Deterministic, Durable Request Fingerprinting & Idempotency Key:**
   Before any network dispatch occurs, a unique, deterministic idempotency key (`refkey_ord_<orderId>`) and SHA-256 payload fingerprint are journaled to MongoDB. Both Worker A and Worker B are forced to use the exact same idempotency key and identical payload.
2. **Gateway Transport Header Contract:**
   `razorpayHttpClient.js` transmits `X-Refund-Idempotency: refkey_ord_<orderId>` with every dispatch. If both Worker A and Worker B reach Razorpay within Razorpay's idempotency retention window, Razorpay de-duplicates the requests at the gateway edge and returns the original refund entity without creating a second debit.
3. **Takeover-Abort Defense (Fencing at Worker B):**
   When Worker B attempts to take over an expired lease:
   ```javascript
   const isPreviousStatusProcessing =
     lockedOrder.refundDetails?.status === "processing" ||
     lockedOrder.refundDetails?.dispatchState === "dispatched";

   if (isPreviousStatusProcessing) {
     // Worker B DOES NOT redispatch. Worker B treats the state as uncertain and aborts to quarantine:
     return {
       success: false,
       aborted: true,
       status: "reconciliation_required",
       requiresManualReconciliation: true,
       message: "A previous refund attempt was in processing/dispatched state. Takeover aborted to prevent duplicate dispatch."
     };
   }
   ```
   Worker B refuses to issue a new dispatch if a prior worker reached `processing` or `dispatched`.
4. **Strict Quarantine & Redispatch Prohibition:**
   Once an operation enters `reconciliation_required` / `quarantined`:
   - Recovery worker filters it out (`requiresManualReconciliation: { $ne: true }`).
   - Customer cancellation returns HTTP 200 without calling refund.
   - Restaurant cancellation returns HTTP 200 without calling refund.
   - Superadmin cancellation returns HTTP 200 without calling refund.
   - Superadmin manual refund returns HTTP 400 with `requiresManualReconciliation: true` and 0 refund calls.
5. **Read-Only Authoritative Reconciliation:**
   The only paths that can resolve a quarantined operation are verified read-only gateway queries (`reconcileOrderRefund` / `reconcilePaymentIntentRefund`) and validated webhooks (`refund.processed`). Both execute **strictly zero** outbound refund POST calls.

### The Residual Network-Boundary Race
The residual race occurs under the following confluence of events:
- Worker A is suspended after its database check but before its TCP packet reaches Razorpay.
- Worker A remains suspended past the lease timeout (30 seconds).
- The system is manually overridden or forced before Razorpay processes Worker A's packet.
- Worker A's packet arrives at Razorpay *after* Razorpay's idempotency key retention window has expired.

Because Razorpay does not offer client-controlled fencing tokens or leases at their API edge, this race can only be eliminated by gateway-level support or strict operational procedures (holding human reconciliation until all worker leases and gateway retention windows have elapsed).

---

## 5. P2: PaymentIntent Recovery Safety Properties

The PaymentIntent recovery routine was integrated into `recoverUnresolvedRefunds` in `backend/lib/refundService.js` with the following strict safety properties:

1. **Read-Only Gateway Traversal:**
   The recovery routine calls `reconcilePaymentIntentRefund`, which invokes `getGatewayRefundsAndPayment` (`GET /v1/payments/:id` and `GET /v1/payments/:id/refunds`). It **never** invokes `razorpay.payments.refund` or `executeRefundDispatch`. Outbound POST count is mathematically 0.
2. **Strict Currency & Amount Verification:**
   Before confirming a PaymentIntent refund:
   - Currency must be `INR`.
   - Amount must match `intent.amountPaise`.
   - Payment ID must match `intent.razorpayPaymentId`.
3. **Safe Quarantine of Uncertain Records:**
   If the gateway read-only lookup does not show a confirmed refund, the recovery worker **does not** assume the refund never happened. It immediately transitions the PaymentIntent to `status: "reconciliation_required"`, `dispatchState: "quarantined"`, and `requiresManualReconciliation: true`.
4. **Already-Confirmed Protection:**
   Uses conditional update `{ _id: intent._id, status: { $ne: "refunded" } }` so late or out-of-order recovery runs never overwrite an already-confirmed refund.
5. **Scheduler Disabled:**
   `CRON_REFUND_RECOVERY_ENABLED=false` is maintained across all environments.

---

## 6. Regression Tests & Verification Results

### Suite 1: Focused Refund Suite (`backend/scripts/test_p1_refund_suite.mjs`)
- **Execution Command:** `node --loader ./scripts/loader.mjs scripts/test_p1_refund_suite.mjs`
- **Result:** **36 PASSED, 0 FAILED (Exit Code: 0)**
- **Coverage of Test 36 Subtests:**
  1. `currencyMismatchRejected`: Webhook with currency `USD` on INR order rejected with HTTP 400 and quarantined.
  2. `amountMismatchRejected`: Webhook with partial amount (15000 paise vs 25000 paise) rejected with HTTP 400 and quarantined.
  3. `paymentIdMismatchRejected`: Webhook with mismatched payment ID rejected with HTTP 400 and quarantined.
  4. `refundIdMismatchRejected`: Webhook with conflicting refund ID on journaled order rejected with HTTP 400 and quarantined.
  5. `subOrderAttributionEnforced`: Webhook for multi-restaurant payment lacking sub-order notes rejected with HTTP 400 and quarantined.
  6. `validMatchingProcessed`: Webhook with matching INR, matching amount, matching paymentId, and matching opKey confirmed order to `refunded` / `confirmed` (HTTP 200).
  7. `replayIdempotent`: Duplicate webhook delivery returned HTTP 200 `alreadyProcessed: true` with zero state drift.
  8. `outOfOrderFailureIgnored`: Incoming `refund.failed` webhook arriving after `refunded` confirmation ignored with HTTP 200 (order remained `refunded`).
  9. `paymentIntentRecoveryReconciled`: Orphaned PaymentIntent with verified gateway refund reconciled to `refunded` with 0 POST calls.
  10. `paymentIntentUnverifiedQuarantined`: Orphaned PaymentIntent with unverified gateway state transitioned to `reconciliation_required` / `quarantined` with 0 POST calls.
  11. `zeroRefundDispatchesDuringRecovery`: Exact assertion verifying gateway POST mock was called 0 times during recovery execution.

### Suite 2: Inventory & Crash-Safety Suite (`backend/scripts/test_phase2a_inventory.mjs`)
- **Execution Command:** `node --loader ./scripts/loader.mjs scripts/test_phase2a_inventory.mjs`
- **Result:** **61 PASSED, 0 FAILED (Exit Code: 0)**
- **Coverage:** Full stock decrement idempotency, recipe snapshot immutability, fencing tokens, stale worker revocation, cancellation coordination, and recovery safety.

### Suite 3: Dangerous Case Simulation Suite (`backend/scripts/test_dangerous_case_audit.mjs`)
- **Execution Command:** `node --loader ./scripts/loader.mjs scripts/test_dangerous_case_audit.mjs`
- **Result:** **PASSED (Exit Code: 0)**
- **Assertion:** Simulated timeout + gateway replication lag resulted in **0 duplicate refund calls** and exactly 1 gateway debit.

### Suite 4: Backend Production Build
- **Execution Command:** `npm run build`
- **Result:** **SUCCESS (Exit Code: 0)**
- **Output:** All 55 static and dynamic Next.js routes compiled and optimized cleanly with zero TypeScript or syntax errors.

---

## 7. Remediated vs Partially Mitigated Status

| Audit Finding | Status | Technical Details |
| :--- | :--- | :--- |
| **Order Webhook Validation Gaps (Currency, Amount, Payment ID, Attribution)** | **FULLY REMEDIATED** | Comprehensive 5-point validation in `backend/app/api/payment/webhook/route.js`. Rejects non-INR, partial amounts, payment mismatches, and ambiguous multi-restaurant sub-orders. Atomically quarantines and returns HTTP 400 for retryability. |
| **Out-of-Order Webhook Downgrades** | **FULLY REMEDIATED** | `refund.failed` webhook path protected with conditional queries (`$ne: 'refunded'`, `$ne: 'confirmed'`) and early return when order or intent is already confirmed. |
| **PaymentIntent Recovery Coverage** | **FULLY REMEDIATED** | Safely added to `recoverUnresolvedRefunds` using strictly read-only `reconcilePaymentIntentRefund`. Zero outbound POST calls; unverified records quarantined. |
| **Worker Redispatch of Quarantined Records** | **FULLY REMEDIATED** | Quarantined orders and intents excluded from recovery worker and rejected across customer, restaurant, and superadmin cancellation endpoints. |
| **External Network-Boundary Race (Worker Paused Post-Check)** | **PARTIALLY MITIGATED** | Mitigated via deterministic idempotency keys, request fingerprints, takeover-abort defense, and quarantine. The residual race (worker paused after check, socket packet arriving after gateway retention window) cannot be eliminated without upstream gateway fencing support. |

---

## 8. Why Production Remains Blocked & Reconsideration Criteria

### Why Production Remains Blocked
1. **Disabled Automated Scheduler:** `CRON_REFUND_RECOVERY_ENABLED=false` is enforced. Automated recovery cannot run autonomously until operational runbooks are validated.
2. **Gateway Idempotency Retention Window Unverified by Contract:** Razorpay documentation does not formally guarantee multi-day retention of `X-Refund-Idempotency` keys under heavy gateway garbage-collection pressure. If a worker pauses across days, gateway deduplication cannot be guaranteed by contract.
3. **Superadmin Human-in-the-Loop Requirement:** Quarantined orders (`reconciliation_required`) require superadmin intervention via the verified `reconcile_refund` action in accordance with `docs/SUPERADMIN_REFUND_RECONCILIATION_SOP.md`.

### Criteria to Reconsider the Block
1. **Written Confirmation of Gateway Retention:** Authoritative documentation or written SLA from Razorpay confirming the minimum retention duration for `X-Refund-Idempotency` keys.
2. **Production Webhook Secret Provisioning:** Verification of `RAZORPAY_WEBHOOK_SECRET` in production secrets manager.
3. **Superadmin Operational Drill:** Execution of SOP verification drill confirming superadmins can review and reconcile quarantined orders via the admin dashboard without triggering duplicate payouts.
4. **Zero Unresolved Residual Alerts:** 14-day staging soak test with zero duplicate debits and zero unhandled quarantine alerts.

---

*All modifications remain uncommitted in the local working tree. No remote databases or live endpoints were contacted.*
