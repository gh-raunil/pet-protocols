# Phase 2A.22.2 — Critical Refund Retry-Safety Remediation Report

**Date:** October 16, 2026  
**Status:** COMPLETED — PRODUCTION BLOCKED — CRON SCHEDULER DISABLED (`CRON_REFUND_RECOVERY_ENABLED=false`)  
**Scope:** Strict Remediation of Dangerous Refund Retry Path & Verification via Isolated Test Suites  

---

## Executive Summary

During Phase 2A.22.1, an audit revealed a dangerous vulnerability in `backend/lib/refundService.js`: when a refund dispatch failed due to an uncertain outcome (such as network timeout `ETIMEDOUT`, connection reset `ECONNRESET`, gateway HTTP 5xx, or HTTP 429), the code fell back to setting `paymentStatus: "refund_pending"` and `"refundDetails.status": "pending"`. 

Because the status was reset to `"pending"`, the takeover-abort defense was bypassed, and the automated recovery worker (`recoverUnresolvedRefunds`) scanned the order for automatic redispatch. If the gateway's read-only lookup had replication lag or delayed visibility (`amount_refunded: 0` or empty refunds array), the recovery worker dispatched a second outbound refund request (`POST /v1/payments/:id/refund`). When gateway idempotency key retention was expired or unverified, this resulted in a **duplicate debit** against the merchant account.

**Remediation implemented in Phase 2A.22.2:**
1. **Conservative Quarantine:** Any uncertain outcome (timeouts, connection resets, HTTP 500/502/503/504, HTTP 429, in-progress 409, or unverified 400 payload mismatch) where gateway acceptance cannot be definitively ruled out is immediately and atomically quarantined into `paymentStatus: "reconciliation_required"`, `refundDetails.dispatchState: "quarantined"`, and `refundDetails.requiresManualReconciliation: true`.
2. **Strict Inconclusive Gateway Lookup:** If post-error read-only lookup returns no matching refund or fails, it is treated strictly as **inconclusive** (not proof that the refund was never debited). The operation remains quarantined.
3. **Prohibition of Automatic Redispatch:** The recovery worker (`recoverUnresolvedRefunds`), cron endpoints, customer cancellation, kitchen cancellation, superadmin cancellation, and direct `executeOrderRefund` calls are strictly prohibited from re-dispatching quarantined operations.
4. **Idempotency Stability:** Preserved the original idempotency key, operation key, payment ID, exact amount, currency (`INR`), and request fingerprint. No recovery path can generate a new idempotency key for an existing logical refund.
5. **Safe Resolution:** Only verified read-only reconciliation (`reconcileOrderRefund` / `reconcilePaymentIntentRefund`) or authoritative Razorpay webhooks (`refund.processed`) can transition a quarantined operation to `refunded` / `confirmed`, with **strictly zero** outbound calls to the refund dispatch endpoint.
6. **Already-Confirmed Protection:** Conditional database updates prevent already confirmed (`refunded` / `confirmed`) orders or PaymentIntents from being downgraded or mutated by failed retries, timeouts, or race conditions.

---

## 1. Files Changed

| File Path | Description of Changes |
| :--- | :--- |
| [`backend/lib/razorpayHttpClient.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/razorpayHttpClient.js) | Classified HTTP 429 explicitly as rate-limited and uncertain (`rateLimited: true, uncertain: true, statusCode: 429`). Classified HTTP 400 payload mismatch as uncertain and quarantined (`uncertain: true, payloadMismatch: true`). Sanitized error outputs without logging secrets or credentials. |
| [`backend/lib/refundService.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js) | Overhauled post-error handling (lines 612–748). Quarantined uncertain outcomes to `reconciliation_required` (`dispatchState: "quarantined"`, `requiresManualReconciliation: true`). Applied conditional query `{ paymentStatus: { $ne: "refunded" }, "refundDetails.dispatchState": { $ne: "confirmed" } }` to protect already-confirmed records. Excluded quarantined states in `recoverUnresolvedRefunds`. Protected already-confirmed PaymentIntents in `reconcilePaymentIntent`. |
| [`backend/app/api/payment/webhook/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/webhook/route.js) | Updated webhook refund handler to atomically set `refundDetails.dispatchState = "confirmed"` when a valid, matching `refund.processed` webhook resolves an order or PaymentIntent from quarantined state. |
| [`backend/scripts/test_p1_refund_suite.mjs`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/scripts/test_p1_refund_suite.mjs) | Updated Tests 1, 4, 22, 25, 28 to assert `reconciliation_required` and quarantined status upon timeout/error. Added Test 35 implementing all 10 isolated regression test requirements from Section 5. |
| [`backend/scripts/test_phase2a_inventory.mjs`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/scripts/test_phase2a_inventory.mjs) | Updated Tests 33, 40, and 55 to assert `reconciliation_required` and quarantine behavior upon refund timeout/error. |
| [`backend/scripts/test_dangerous_case_audit.mjs`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/scripts/test_dangerous_case_audit.mjs) | Verified the dangerous scenario simulation: confirmed that duplicate gateway debits are strictly blocked (0 duplicate calls, 1 gateway debit). |

---

## 2. Root Cause and Exact Fix

### Root Cause
In Phase 2A.22, the post-error catch and evaluation block in `executeOrderRefund` (lines 727–748) handled unresolved errors by updating the order with:
```javascript
// DANGEROUS CODE (Phase 2A.22)
await Order.updateOne(
  { _id: order._id, "refundDetails.leaseToken": leaseToken },
  {
    $set: {
      paymentStatus: "refund_pending",
      "refundDetails.status": "pending",
      "refundDetails.dispatchState": "prepared",
      "refundDetails.error": refundRes.error,
    },
  }
);
```
This created three catastrophic failure modes:
1. **Takeover-Guard Bypass:** `executeOrderRefund` lease acquisition checked `isPreviousStatusProcessing = lockedOrder.refundDetails?.status === "processing"`. Because the error handler had reverted the status to `"pending"`, `isPreviousStatusProcessing` evaluated to `false`, allowing takeover without aborting.
2. **Recovery Worker Redispatch:** `recoverUnresolvedRefunds` searched for `{ paymentStatus: "refund_pending" }`. The uncertain order matched this query and was immediately scheduled for a second dispatch attempt.
3. **Visibility Lag Vulnerability:** If the read-only lookup (`payments.fetch` / `fetchMultipleRefund`) executed before the gateway's ledger replicated the refund, the lookup returned 0 refunds. The recovery worker concluded that no refund was dispatched, and issued a second `POST /v1/payments/:id/refund`. If Razorpay's key retention had lapsed or was unverified, Razorpay executed a **second refund debit**.

### Exact Fix
1. **Atomic Quarantine on Uncertain Failure:**
   When `refundRes.success` is false or an exception is caught, `executeOrderRefund` executes a read-only reconciliation check against the gateway (`getGatewayRefundsAndPayment`).
   - If gateway reconciliation verifies the refund: the order is confirmed as `paymentStatus: "refunded"`, `dispatchState: "confirmed"`, `status: "processed"`.
   - If gateway lookup returns no matching refund or errors out: **the result is treated as inconclusive**. The order is atomically updated with:
     ```javascript
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
     ```
2. **Recovery Worker Exclusion:**
   `recoverUnresolvedRefunds` query filters out quarantined orders:
   ```javascript
   const orders = await Order.find({
     paymentStatus: { $in: ["paid", "refund_pending"], $nin: ["refunded", "reconciliation_required"] },
     "refundDetails.requiresManualReconciliation": { $ne: true },
     "refundDetails.dispatchState": { $nin: ["confirmed", "quarantined"] },
     ...
   });
   ```
3. **API Entry Point Enforcement:**
   Every entry point that can invoke `executeOrderRefund` (customer PATCH, restaurant PUT, superadmin PATCH, cron POST/GET, and verify POST) checks `isRefundRecon` or rejects orders with `requiresManualReconciliation: true` or `paymentStatus: "reconciliation_required"`. Direct redispatch returns HTTP 400 with `requiresManualReconciliation: true` and issues 0 outbound requests.
4. **Idempotency Stability:**
   The stable idempotency key (`refkey_ord_<id>`), operation key (`refop_<id>`), and payload fingerprint are journaled durably in MongoDB prior to outbound dispatch and remain unchanged across all quarantine and reconciliation cycles.

---

## 3. Before/After Retry Decision Table

| Failure Class / Gateway Outcome | Before (Phase 2A.22) | After (Phase 2A.22.2 Remediation) | Outbound Retries Allowed? |
| :--- | :--- | :--- | :--- |
| **Client Timeout (`ETIMEDOUT`)** | Set `refund_pending` / `prepared`; recovery worker redispatched if gateway lookup was delayed | Atomically quarantined as `reconciliation_required` (`dispatchState: "quarantined"`); read-only lookup treated as inconclusive | **0 (STRICTLY PROHIBITED)** |
| **Connection Reset (`ECONNRESET`)** | Set `refund_pending` / `prepared`; recovery worker redispatched | Atomically quarantined as `reconciliation_required` (`dispatchState: "quarantined"`) | **0 (STRICTLY PROHIBITED)** |
| **HTTP 500 Internal Server Error** | Set `refund_pending` / `prepared`; eligible for worker redispatch | Atomically quarantined as `reconciliation_required` (`dispatchState: "quarantined"`) | **0 (STRICTLY PROHIBITED)** |
| **HTTP 502 / 503 / 504 Gateway Error** | Set `refund_pending` / `prepared`; eligible for worker redispatch | Atomically quarantined as `reconciliation_required` (`dispatchState: "quarantined"`) | **0 (STRICTLY PROHIBITED)** |
| **HTTP 429 Rate Limit Exceeded** | Treated as general failure; reverted to retryable state | Explicitly classified as rate-limited & uncertain; quarantined as `reconciliation_required` | **0 (STRICTLY PROHIBITED)** |
| **HTTP 409 In-Progress Conflict** | Quarantined, but recovery worker had potential race | Atomically quarantined; recovery worker strictly excludes quarantined records | **0 (STRICTLY PROHIBITED)** |
| **HTTP 400 Payload Mismatch** | Flagged mismatch; potential unquarantined retry if key reused | Atomically quarantined; pre-flight and gateway mismatches quarantined immediately | **0 (STRICTLY PROHIBITED)** |
| **HTTP 400 Definite Client Error** | Marked failed | Marked failed with `definitiveError: true`; redispatch blocked | **0 (PROHIBITED)** |
| **Delayed Visibility in Gateway Lookup** | Missing refund treated as "safe to dispatch another refund" | Missing refund treated as **inconclusive**; operation remains quarantined | **0 (STRICTLY PROHIBITED)** |
| **Time Advanced Beyond Retention (72h)** | Recovery worker scanned and redispatched under assumption key deduplicated | Recovery worker skips quarantined records regardless of elapsed time | **0 (STRICTLY PROHIBITED)** |
| **Read-Only Reconciliation Request** | Executed read-only fetch | Executed read-only fetch; zero calls to `POST /v1/payments/:id/refund` | **0 (PROHIBITED)** |
| **Valid Matching Webhook (`refund.processed`)** | Updated order without confirming `dispatchState` | Transitions to `refunded`, `status: "processed"`, `dispatchState: "confirmed"`, 0 refund calls | **0 (PROHIBITED)** |

---

## 4. Test Evidence and Verification

### Test Suite Results

All tests were executed against isolated in-memory MongoDB replica sets on `127.0.0.1` with mocked network transports. No connection to Atlas, development port 4000, or live gateway credentials was made.

#### 1. Focused P1 Refund Suite (`test_p1_refund_suite.mjs`)
**Command:**
```powershell
node --experimental-loader ./scripts/loader.mjs scripts/test_p1_refund_suite.mjs
```
**Result:** **35 PASSED, 0 FAILED (35/35 — 100% PASS)**  
**Exit Code:** 0  

Summary of Key Scenarios Verified in P1 Suite:
- **Test 1:** Cancellation API timeout quarantined as `reconciliation_required` with inventory restored.
- **Test 4:** Cancellation retry blocked on quarantined orders (HTTP 400); resolved cleanly via read-only reconciliation.
- **Test 21:** Basic Auth, `X-Refund-Idempotency` header, and exact amount/currency validation.
- **Test 22:** Stable key and byte-for-byte identical body preserved across retries; duplicate dispatch blocked.
- **Test 23:** Concurrent workers deduplicated safely; exactly 1 external dispatch executed.
- **Test 24:** Stale worker evicted by lease pre-check; 0 external dispatches occurred.
- **Test 25:** Gateway acceptance followed by timeout recovered cleanly via read-only reconciliation (0 duplicate refunds).
- **Test 26:** HTTP 409 conflict quarantined operation safely without generating a new key.
- **Test 27:** Gateway 400 mismatch and local payload fingerprint mismatch both quarantined safely.
- **Test 28:** HTTP 502 and ECONNRESET treated as uncertain `reconciliation_required` with stable keys preserved.
- **Test 31:** Multi-restaurant sub-orders independently attributed with distinct keys and amounts.
- **Test 32:** PaymentIntent refund dispatch and webhook reconciliation verified.
- **Test 33:** Read-only reconciliation verified with strictly 0 outbound refund dispatches.
- **Test 34:** Quarantined records completely blocked from refund redispatch across all 6 paths (0 calls).
- **Test 35 (Phase 2A.22.2 Isolated Regression Suite — All 10 Requirements):**
  1. Gateway mock accepts refund (1 debit recorded in gateway ledger).
  2. Client receives `ETIMEDOUT` / `ECONNRESET`.
  3. Immediate read-only lookup returns no refund (delayed visibility).
  4. Recovery worker attempts to process unresolved operations.
  5. Asserted: **0 second refund requests sent**, gateway debits remain strictly 1, operation remains quarantined.
  6. Advanced simulated time 72 hours beyond assumed idempotency retention: asserted **0 automatic redispatches**.
  7. Repeated across failure classes: HTTP 500, 502, 503, 504, 429, and 409 all quarantined with 0 redispatches.
  8. Verified that valid matching webhook and read-only reconciliation resolve operation with 0 outbound calls.
  9. Verified that already-confirmed refunds remain confirmed and cannot be overwritten.
  10. Verified that PaymentIntent path follows the exact same quarantine and zero-redispatch policy.

#### 2. Inventory & Crash-Safe Deduction Suite (`test_phase2a_inventory.mjs`)
**Command:**
```powershell
node --experimental-loader ./scripts/loader.mjs scripts/test_phase2a_inventory.mjs
```
**Result:** **61 PASSED, 0 FAILED (61/61 — 100% PASS)**  
**Exit Code:** 0  

Verified:
- Test 33: Refund failure quarantines as `reconciliation_required`, redispatch blocked, reconciliation succeeds.
- Test 40: Restaurant admin and superadmin cancellation endpoints truthfully report pending/quarantined refund.
- Test 55: Refund timeout, `reconciliation_required` quarantine, safe reconciliation, and duplicate defense.

#### 3. Dangerous Case Audit Simulation (`test_dangerous_case_audit.mjs`)
**Command:**
```powershell
node --experimental-loader ./scripts/loader.mjs scripts/test_dangerous_case_audit.mjs
```
**Result:**
```text
Total Outbound HTTP Calls: 1
Total Debits in Gateway Ledger: 1
CRITICAL AUDIT RESULT: Duplicate Gateway Debit Created? NO (SAFE)
Stale worker write matched count: 0 (0 expected due to lease fencing)
```

#### 4. Backend Next.js Production Build
**Command:**
```powershell
npm run build
```
**Result:**
```text
▲ Next.js 16.2.6 (Turbopack)
✓ Compiled successfully in 7.0s
✓ Finished TypeScript in 142ms
✓ Generating static pages using 15 workers (55/55) in 305ms
Exit Code: 0
```
All 55 backend routes compiled with 0 TypeScript and 0 build errors.

---

## 5. Remaining Stale-Worker and External-Network Risks

1. **Pre-Lease-Expiry In-Flight Dispatches:**
   If Worker A dispatches an HTTP request to Razorpay, and the Razorpay network/server pauses for >30 seconds before responding, Worker A's lease expires in MongoDB. When Worker A eventually receives a response:
   - Worker A's subsequent database write is fenced (`matchedCount: 0`) and rejected.
   - The takeover worker or recovery worker does NOT dispatch a duplicate refund because the operation is either in `reconciliation_required` or protected by lease fencing.
   - However, the external debit was executed by Worker A. A subsequent read-only reconciliation or webhook will safely reconcile this single refund to `confirmed`.
2. **Gateway Clock Skew / Replication Lag:**
   Razorpay's internal read replicas may exhibit seconds or minutes of visibility delay for refunds created on primary nodes. Under Phase 2A.22.2, a delayed visibility response is treated as **inconclusive** and never triggers a redispatch. The operation waits in quarantine until either an authoritative webhook arrives or superadmin triggers read-only reconciliation.
3. **External Gateway Idempotency Retention Limits:**
   Because Razorpay documentation does not publish a guaranteed retention duration for `X-Refund-Idempotency` headers, any automated redispatch after a time lapse is unsafe. By strictly quarantining uncertain operations and requiring manual or webhook reconciliation without outbound re-dispatch, the risk of gateway retention expiry causing a duplicate refund is eliminated.

---

## 6. Confirmation and Operating Status

- **Uncertain Outcomes Cannot Be Redispatched:** Confirmed across all 6 application entry points and recovery workers.
- **Scheduler Status:** `CRON_REFUND_RECOVERY_ENABLED=false` remains enforced; scheduler is disabled.
- **Production Status:** **BLOCKED**. Exactly-once execution is not claimed.
- **Git State:** All modifications remain uncommitted, unstaged, and unpushed.

---

*Report prepared autonomously under Phase 2A.22.2 constraints.*
