# Phase 2A.16 — Refund Dispatch Safety Audit & Remediation Plan

**Document Identifier:** AUDIT-SEC-043  
**Target System:** Pet Protocols Multi-Restaurant Ordering Platform  
**Audit Scope:** Refund Dispatch Paths, Stale-Worker Concurrency Race, Superadmin Manual Endpoint Bypass  
**Audit Type:** Source-Code Analysis & Isolated Empirical Verification  
**Audit Date:** October 15, 2026  
**Production Verdict:** **STRICT BLOCK** (Automated recovery and manual refund redispatch remain prohibited)

---

## 1. Executive Summary

This audit independently investigated the Pet Protocols refund subsystem following the Phase 2A.15 SOP correction. The audit focused on two primary financial risks:
1. **The Stale-Worker Outbound Gateway Race:** The scenario where a worker process experiences an event-loop pause, garbage collection stall, or network socket delay immediately after passing its database lease check, loses its lease to a concurrent worker or recovery task, and subsequently resumes to issue an unauthorized external HTTP request to Razorpay.
2. **The Manual Superadmin Refund Endpoint Bypass:** The mechanism in [`backend/app/api/superadmin/orders/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/superadmin/orders/route.js) where invoking `{ action: "refund" }` on an order already marked `paymentStatus: "reconciliation_required"` bypasses takeover protection and dispatches a duplicate external refund.

### Summary of Audit Findings

| ID | Finding | Severity | Evidence |
| :--- | :--- | :---: | :--- |
| **FIND-01** | **Outbound Gateway Race (Stale-Worker Leak)**: Database lease fencing protects MongoDB records but has zero control over external HTTP requests. A paused worker that resumes past line 405 dispatches to Razorpay regardless of expired lease state. | **CRITICAL** | [`backend/lib/refundService.js:405–435`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L405-L435) |
| **FIND-02** | **Manual Superadmin Bypass of Takeover Defense**: When an order is in `reconciliation_required`, `isPreviousStatusProcessing` evaluates to `false`. Takeover defense at line 327 is bypassed; if gateway shows 0 refunds, it proceeds directly to line 421 and calls `razorpay.payments.refund(...)`. | **CRITICAL** | **Empirically Confirmed** in isolated replica set test; [`refundService.js:275, 327`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L275) |
| **FIND-03** | **Cancellation Routes Treat `reconciliation_required` as Refund-Eligible**: All three cancellation routes (`superadmin/orders`, `restaurant/orders`, and customer `orders`) explicitly include `'reconciliation_required'` in `isRefundEligible` and invoke `executeOrderRefund`. | **HIGH** | [`superadmin/orders/route.js:140, 179`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/superadmin/orders/route.js#L140), [`restaurant/orders/route.js:209`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/restaurant/orders/route.js#L209), [`orders/route.js:409`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/orders/route.js#L409) |
| **FIND-04** | **Unfenced Direct Gateway Refund in Checkout Verify**: When a restaurant is suspended/inactive, `payment/verify/route.js` issues direct `razorpay.payments.refund(...)` on `PaymentIntent` without lease fencing, without `opKey`, and without recovery worker coverage. | **HIGH** | [`backend/app/api/payment/verify/route.js:233–265`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/verify/route.js#L233-L265) |
| **FIND-05** | **Absence of Gateway-Side Refund Idempotency**: Razorpay API `POST /v1/payments/:id/refund` does not support idempotency keys. The official Node.js SDK strictly filters out non-whitelisted headers (`getValidHeaders`). Neither `receipt` nor `notes` provides deduplication. | **CRITICAL** | [`backend/node_modules/razorpay/dist/api.js:16–31`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/node_modules/razorpay/dist/api.js#L16-L31), SDK types |

---

## 2. Comprehensive Trace of Every Refund-Dispatch Path

The codebase contains **six distinct dispatch paths** capable of triggering `razorpay.payments.refund(...)`. Five route through `executeOrderRefund`, while one bypasses the refund service entirely.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           PET PROTOCOLS REFUND DISPATCH PATHS                     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [Path 1] POST /api/payment/verify (Direct PaymentIntent refund on suspended rest)│
│          └──> Bypasses refundService! Unfenced direct call at line 233           │
│                                                                                  │
│ [Path 2] PATCH /api/superadmin/orders (action: "refund")                         │
│          └──> executeOrderRefund({ initiatedBy: "superadmin" })                  │
│                                                                                  │
│ [Path 3] PATCH /api/superadmin/orders (status: "cancelled")                      │
│          └──> executeOrderRefund({ initiatedBy: "superadmin" })                  │
│                                                                                  │
│ [Path 4] PATCH /api/restaurant/orders (status: "cancelled")                      │
│          └──> executeOrderRefund({ initiatedBy: "restaurant" })                  │
│                                                                                  │
│ [Path 5] PATCH /api/orders (status: "cancelled" by customer)                     │
│          └──> executeOrderRefund({ initiatedBy: "customer" })                    │
│                                                                                  │
│ [Path 6] GET / POST /api/cron/refund-recovery (recoverUnresolvedRefunds)          │
│          └──> executeOrderRefund({ initiatedBy: "recovery_worker" })             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Path 1: Direct Inline Refund on Suspended/Inactive Restaurant
- **Source File & Lines:** [`backend/app/api/payment/verify/route.js:203–276`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/verify/route.js#L203-L276)
- **Entry Point & Authorization:** `POST /api/payment/verify` invoked by customer checkout flow. Session user authenticated.
- **Entity Targeted:** `PaymentIntent` document (`lockedIntent`), **not** `Order`.
- **Accepted States:** `PaymentIntent.status === 'locked'` (transitioned from `processing`).
- **Lease Acquisition & Fencing:** **NONE.** No lease token, lease generation, or lock expiry timestamp exists on `PaymentIntent`.
- **Operation Key (`opKey`):** **NONE.** Payload notes only include `reason`, `razorpay_order_id`, and `restaurant`.
- **Gateway Reconciliation Pre-Check:** **NONE.** Does not call `getGatewayRefundsAndPayment`.
- **Exact Dispatch Point:** Line 233: `await razorpay.payments.refund(razorpay_payment_id, { amount: lockedIntent.amountPaise, notes: ... })`.
- **Error & Recovery Behavior:** If the call fails, line 263 sets `lockedIntent.status = 'refund_pending'` and records error message. However, [`recoverUnresolvedRefunds()`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L630-L650) only queries the `Order` collection (`Order.find(...)`); it **never inspects `PaymentIntent`**. Any failed refund here is permanently orphaned.
- **Stale-Worker Race:** If the client retries `payment/verify` after a network timeout, a concurrent thread could re-invoke `payments.refund` if the intent locking check experiences a window race.

---

### Path 2: Superadmin Direct Action Refund (`action: "refund"`)
- **Source File & Lines:** [`backend/app/api/superadmin/orders/route.js:92–105`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/superadmin/orders/route.js#L92-L105)
- **Entry Point & Authorization:** `PATCH /api/superadmin/orders` requiring `superadmin` role via `requireSuperAdmin()`.
- **Accepted States:** Any order found by `orderId`. Handed to `executeOrderRefund`.
- **Lease Acquisition:** Atomic conditional update via `Order.findOneAndUpdate` ([`refundService.js:174–205`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L174-L205)).
  - Line 178 includes `"reconciliation_required"` in the `$in` list:
    `{ "refundDetails.status": { $in: ["none", "pending", "failed", "reconciliation_required", null] } }`
  - Consequently, an order in `reconciliation_required` **immediately acquires a new processing lease**.
- **Takeover Defense Defect:**
  - Line 275: `const isPreviousStatusProcessing = order.refundDetails?.status === "processing";`
  - For an order in `reconciliation_required`, `status` is `"reconciliation_required"`, so `isPreviousStatusProcessing` is **`false`**.
  - Line 327: `if (isPreviousStatusProcessing && !isFullyRefunded)` **does not trigger**.
  - If Razorpay currently shows 0 refunds, the function drops through to line 405.
- **Fencing Pre-Check:** Line 405 checks if `Order.findOne({ _id, "refundDetails.leaseToken": leaseToken })` matches. Because the superadmin call just acquired this lease, pre-check succeeds.
- **Exact Dispatch Point:** Line 421: `await razorpay.payments.refund(lockedOrder.paymentId, { amount: amountPaise, notes: ... })`.
- **Stale-Worker Race:** If Worker A was previously stalled between line 405 and line 421, Worker B set `reconciliation_required`, and a Superadmin now calls `action: "refund"`, **two outbound HTTP requests will hit Razorpay**.

---

### Path 3: Superadmin Order Cancellation (`status: "cancelled"`)
- **Source File & Lines:** [`backend/app/api/superadmin/orders/route.js:129–198`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/superadmin/orders/route.js#L129-L198)
- **Entry Point & Authorization:** `PATCH /api/superadmin/orders` with `{ orderId, status: "cancelled" }`. Requires `superadmin` role.
- **Accepted States:** Order status cannot be `delivered`. Lines 139–141 and 178–180 evaluate eligibility:
  ```javascript
  const isRefundEligible =
    ['paid', 'refund_pending', 'reconciliation_required'].includes(order.paymentStatus) &&
    (order.paymentMethod?.toLowerCase().includes("razorpay") || order.paymentMethod?.toLowerCase().includes("online"));
  ```
- **Flaw:** Explicitly considers `paymentStatus: "reconciliation_required"` as eligible for automatic refund dispatch during cancellation. Invokes `executeOrderRefund({ initiatedBy: "superadmin" })`, reproducing the exact bypass in Path 2.

---

### Path 4: Restaurant Admin Order Cancellation (`status: "cancelled"`)
- **Source File & Lines:** [`backend/app/api/restaurant/orders/route.js:202–228`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/restaurant/orders/route.js#L202-L228)
- **Entry Point & Authorization:** `PATCH /api/restaurant/orders` with `{ orderId, status: "cancelled" }`. Requires `restaurant_admin` role scoped to `order.restaurant`.
- **Accepted States:** Order status must not be `delivered`. Lines 208–210 evaluate eligibility:
  ```javascript
  const isRefundEligible =
    ['paid', 'refund_pending', 'reconciliation_required'].includes(order.paymentStatus) &&
    (order.paymentMethod?.toLowerCase().includes("razorpay") || order.paymentMethod?.toLowerCase().includes("online"));
  ```
- **Flaw:** A restaurant admin cancelling an order where an earlier refund attempt timed out will invoke `executeOrderRefund({ initiatedBy: "restaurant" })`, triggering the same takeover defense bypass.

---

### Path 5: Customer Order Self-Cancellation (`status: "cancelled"`)
- **Source File & Lines:** [`backend/app/api/orders/route.js:408–487`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/orders/route.js#L408-L487)
- **Entry Point & Authorization:** `PATCH /api/orders` with `{ orderId, reason }`. Requires order owner session. Subject to restaurant cancellation window.
- **Accepted States:** Order status must be `pending` (or previously interrupted cancellation). Lines 408–410 evaluate eligibility:
  ```javascript
  const isRefundEligible =
    ['paid', 'refund_pending', 'reconciliation_required'].includes(order.paymentStatus) &&
    (order.paymentMethod?.toLowerCase().includes('razorpay') || order.paymentMethod?.toLowerCase().includes('online'));
  ```
- **Flaw:** If an order was previously marked `reconciliation_required`, a customer cancelling the order invokes `executeOrderRefund({ initiatedBy: 'customer' })`, bypassing takeover protection.

---

### Path 6: Automated Recovery Worker (`recoverUnresolvedRefunds`)
- **Source File & Lines:** [`backend/lib/refundService.js:625–689`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L625-L689)
- **Entry Point & Authorization:** Invoked via `POST /api/cron/refund-recovery` authenticated by `CRON_SECRET` Bearer token.
- **Accepted States:** Orders where `refundDetails.status === "processing"` with expired lease (>30s), OR `paymentStatus === "refund_pending"` with `retryCount < maxRetries`.
- **Takeover Defense Behavior:**
  - When taking over an expired `processing` lease, `isPreviousStatusProcessing` is `true`.
  - Gateway reconciliation runs at line 279.
  - If Razorpay returns 0 refunds, line 327 triggers:
    ```javascript
    if (isPreviousStatusProcessing && !isFullyRefunded) {
      throw new Error("Takeover aborted: previous refund attempt was in-flight at lease expiry. Queued for safe reconciliation.");
    }
    ```
  - Caught at line 370; transitions database to `reconciliation_required`.
  - Recovery worker **does not** dispatch to Razorpay.
- **The Stale-Worker Race:**
  - What happens to Worker A (the worker that held the lease originally)?
  - If Worker A passed the pre-check at line 405 and was delayed (e.g. paused garbage collection, event loop lag, or network socket queue), Recovery Worker B took over the expired lease in MongoDB and set `reconciliation_required`.
  - When Worker A resumes, it is already past line 405. It executes line 421: `razorpay.payments.refund(...)`.
  - At line 435, Worker A attempts fenced save: `Order.updateOne({ _id, "refundDetails.leaseToken": leaseToken })`. This update returns `matchedCount: 0` because Worker B changed `leaseToken`.
  - **The Database was protected, but Razorpay debited the money.**
  - Now the order is stuck in `reconciliation_required`. If an admin or cancellation path fires (Paths 2–5), Path 2 executes and debits Razorpay a second time.

---

## 3. Isolated Empirical Reproduction of Manual Endpoint Bypass

An isolated verification test was conducted using a dedicated, local-only in-memory MongoDB replica set (`mongodb-memory-server` on `127.0.0.1`) and a mocked Razorpay gateway.

### Test Configuration
- **Isolation:** Loopback only (`127.0.0.1`). Zero connection to Atlas, `.env.local`, or port 4000.
- **Gateway:** Mocked Razorpay client logging all calls to `fetch`, `fetchMultipleRefund`, and `payments.refund`.
- **Initial Fixture State:**
  - `Order.paymentStatus`: `"reconciliation_required"`
  - `Order.refundDetails.status`: `"reconciliation_required"`
  - `Order.refundDetails.requiresManualReconciliation`: `true`
  - `Order.refundDetails.opKey`: `"refop_ORD_REPRO_001"`
  - `Order.status`: `"cancelled"`
  - `Order.paymentId`: `"pay_test_repro_123"`
  - Razorpay Gateway State: `amount_refunded: 0`, `refunds: []` (simulating missing/in-flight initial attempt)

### Test Execution Output
```
--- REPRODUCING SUPERADMIN MANUAL REFUND BYPASS ON RECONCILIATION_REQUIRED ---
[Order Created] ID: 6ad0a947c9a38fac4c09b4eb, paymentStatus: reconciliation_required, refundDetails.status: reconciliation_required
Initial Razorpay refund call count: 0

Dispatching PATCH /api/superadmin/orders with:
{
  "orderId": "6ad0a947c9a38fac4c09b4eb",
  "action": "refund",
  "notes": "Superadmin manual retry attempt"
}

Response Status: 200
Response Body: {
  "success": true,
  "refund": {
    "success": true,
    "refundId": "rfnd_mock_1792059719341",
    "status": "processed",
    "message": "Refund of ₹500 processed successfully (Refund ID: rfnd_mock_1792059719341)."
  },
  "order": {
    "paymentStatus": "refunded",
    "refundDetails": {
      "status": "processed",
      "refundId": "rfnd_mock_1792059719341",
      "requiresManualReconciliation": false
    }
  }
}
Post-request Razorpay refund call count: 1
Updated Order paymentStatus: refunded
Updated Order refundDetails.status: processed

>>> CONFIRMED VULNERABILITY: action: "refund" BYPASSED reconciliation_required and called razorpay.payments.refund()!
```

### Root Cause Analysis of the Bypass
1. **Line 161 (Eligibility Check):**
   `if (!["paid", "refund_pending", "reconciliation_required"].includes(order.paymentStatus))`
   `reconciliation_required` is explicitly allowed to proceed.
2. **Line 178 (Lease Acquisition):**
   `{ "refundDetails.status": { $in: ["none", "pending", "failed", "reconciliation_required", null] } }`
   `reconciliation_required` is immediately eligible to acquire a new leaseToken, overwriting the quarantine state.
3. **Line 275 (Takeover Flag Formulation):**
   `const isPreviousStatusProcessing = order.refundDetails?.status === "processing";`
   Because `status` was `"reconciliation_required"` prior to lease acquisition, `isPreviousStatusProcessing` is evaluated as `false`.
4. **Line 327 (Takeover Defense Gate):**
   `if (isPreviousStatusProcessing && !isFullyRefunded)`
   Because `isPreviousStatusProcessing` is `false`, this defensive abort **never triggers**.
5. **Line 421 (Unfenced Gateway Call):**
   `executeOrderRefund` proceeds to execute `razorpay.payments.refund(...)`.

---

## 4. Defensible Duplicate-Dispatch Prevention Analysis

### 4.1 Razorpay SDK & API Limitations
A code audit of the installed Razorpay Node.js SDK (`node_modules/razorpay` v2.9.6) was conducted:
1. **SDK Type Inspection ([`node_modules/razorpay/dist/types/refunds.d.ts:4–21`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/node_modules/razorpay/dist/types/refunds.d.ts#L4-L21)):**
   ```typescript
   interface RazorpayRefundBaseRequestBody {
       amount?: number;
       speed?: 'normal' | 'optimum';
       notes?: IMap<string | number>;
       receipt?: string | null;
   }
   ```
   No `idempotency_key` or `idempotencyKey` field exists in the refund request body.
2. **SDK Header Filtering ([`node_modules/razorpay/dist/api.js:16–31`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/node_modules/razorpay/dist/api.js#L16-L31)):**
   ```javascript
   var allowedHeaders = {
     "X-Razorpay-Account": "",
     "Content-Type": "application/json"
   };
   function getValidHeaders(headers) {
     var result = {};
     if (!isNonNullObject(headers)) return result;
     return Object.keys(headers).reduce(function (result, headerName) {
       if (allowedHeaders.hasOwnProperty(headerName)) {
         result[headerName] = headers[headerName];
       }
       return result;
     }, result);
   }
   ```
   The SDK explicitly filters out and drops any header other than `X-Razorpay-Account` and `Content-Type`. Custom idempotency headers passed by client code are silently discarded.
3. **Gateway API Contract:**
   Unlike RazorpayX Payouts (`X-Payout-Idempotency`) or Order creation (`/v1/orders`), Razorpay's Core Payment Refund API (`POST /v1/payments/:id/refund`) **does not provide native idempotency deduplication**.
   - `notes`: Arbitrary key-value metadata for display in the merchant dashboard. The gateway does **not** enforce uniqueness on `notes.opKey`.
   - `receipt`: An optional internal tracking string. Razorpay does **not** reject multiple refunds sharing the same `receipt`.
   - Each HTTP POST generates a new `rfnd_...` entity and debits the merchant balance until the captured payment amount is exhausted.

### 4.2 Separation of Three Distinct Guarantees

Architectural clarity requires separating three guarantees that are frequently conflated:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        THREE DISTINCT FINANCIAL GUARANTEES                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. DATABASE WRITE FENCING (Internal State)                                            │
│    - What it does: Prevents two workers from overwriting MongoDB with conflicting data. │
│    - Implementation: Atomic findOneAndUpdate with leaseToken and leaseGeneration.      │
│    - LIMITATION: CANNOT PREVENT OUTBOUND NETWORK CALLS. A worker past line 405 still   │
│      sends an HTTP packet to Razorpay even if its lease in MongoDB was revoked.        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. GATEWAY-SIDE REQUEST DEDUPLICATION (External Gateway)                               │
│    - What it does: Gateway recognizes a retried HTTP request and returns the existing  │
│      refund without debiting merchant funds a second time.                             │
│    - Implementation: HTTP Idempotency-Key header or gateway transaction identifier.     │
│    - REALITY: RAZORPAY DOES NOT SUPPORT THIS FOR PAYMENT REFUNDS.                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. RECONCILIATION OF UNCERTAIN GATEWAY OUTCOMES (Observation)                          │
│    - What it does: Queries gateway API after the fact to verify whether a refund landed.│
│    - Implementation: fetchMultipleRefund / payment.fetch matching on notes.opKey.      │
│    - LIMITATION: Read-only observation cannot prevent a delayed in-flight worker from   │
│      delivering its packet AFTER the reconciliation check completes.                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 The Fundamental Concurrency Vulnerability
Because Guarantee #2 does not exist in the Razorpay refund API, and Guarantee #1 cannot stop an in-flight network packet, **no software-only client lock, database lease, or pre-request check can guarantee exactly-once external execution if an in-flight worker pauses**.

---

## 5. Prioritized Remediation Plan

To eliminate duplicate financial debits while operating within Razorpay's API constraints, the following remediation plan must be implemented before staging or production readiness can be considered.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               REMEDIATION ROADMAP                                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Backend Hard Guards (Block all redispatch on reconciliation_required)   │
│ PHASE 2: Comprehensive Test Suite (Reproduction, regression, crash-recovery)     │
│ PHASE 3: Superadmin UI Decoupling (Reconcile-only mutation, dual-control)        │
│ PHASE 4: Payment Intent Refactoring (Unify checkout refund with refundService)   │
│ PHASE 5: Architectural Preconditions (Outbound gateway proxy or Stripe migration)│
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Immediate Backend Hard State Guards
1. **Quarantine `reconciliation_required` from Lease Acquisition:**
   - In [`backend/lib/refundService.js:178`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L178), **remove** `"reconciliation_required"` from `$or -> refundDetails.status -> $in`.
   - Add explicit pre-guard at line 149:
     ```javascript
     if (order.paymentStatus === "reconciliation_required" || order.refundDetails?.status === "reconciliation_required") {
       return {
         success: false,
         status: "reconciliation_required",
         requiresManualReconciliation: true,
         message: "Order is in reconciliation_required state. Redispatch is prohibited. Manual reconciliation required.",
       };
     }
     ```
2. **Hard-Block Direct Superadmin Refund Redispatch:**
   - In [`backend/app/api/superadmin/orders/route.js:92`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/superadmin/orders/route.js#L92):
     ```javascript
     if (action === "refund") {
       if (order.paymentStatus === "reconciliation_required" || order.refundDetails?.status === "reconciliation_required") {
         return NextResponse.json({
           success: false,
           message: "Order requires manual reconciliation. Direct refund redispatch is prohibited to prevent duplicate payouts.",
         }, { status: 400 });
       }
       ...
     ```
3. **Purge `reconciliation_required` from All Cancellation Routes:**
   - In `backend/app/api/superadmin/orders/route.js:140, 179`: Remove `'reconciliation_required'` from `isRefundEligible`.
   - In `backend/app/api/restaurant/orders/route.js:209`: Remove `'reconciliation_required'` from `isRefundEligible`.
   - In `backend/app/api/orders/route.js:409`: Remove `'reconciliation_required'` from `isRefundEligible`.
   - If an order in `reconciliation_required` is cancelled, cancel the items and restore inventory, but **never invoke `executeOrderRefund`**.

### Phase 2: Required Concurrency and Crash-Recovery Tests
Add dedicated tests to `backend/scripts/test_p1_refund_suite.mjs`:
- **Test 11 (Superadmin Bypass Regression):** Verify `PATCH /api/superadmin/orders` with `{ action: "refund" }` on an order in `reconciliation_required` returns HTTP 400 and calls `razorpay.payments.refund` **0 times**.
- **Test 12 (Cancellation Route Fencing):** Verify that Superadmin cancel, Restaurant cancel, and Customer cancel on an order in `reconciliation_required` restore stock but make **0 calls to `razorpay.payments.refund`**.
- **Test 13 (Direct Invocation Guard):** Verify that direct invocation of `executeOrderRefund({ orderId })` on a `reconciliation_required` order returns `{ success: false, status: "reconciliation_required" }` without contacting the gateway.

### Phase 3: Operational & UI Controls (Reconcile-Only Mutation)
1. **Disable Redispatch UI:** Ensure no button exists in `frontend-superadmin` that triggers `action: "refund"` on uncertain orders.
2. **Implement Reconcile-Only Mutation:** Provide a dedicated Superadmin action `{ action: "reconcile_refund", refundId: "rfnd_..." }` that:
   - Validates the provided `refundId` matches Razorpay records for that `paymentId`.
   - Sets `paymentStatus: "refunded"`, `refundDetails.status: "processed"`, `refundDetails.refundId: refundId`.
   - **Makes zero outbound calls to `razorpay.payments.refund`**.
3. **Dual-Custody Sign-Off:** Require two separate admin identities (Superadmin + Finance Lead) before clearing a `reconciliation_required` flag.

### Phase 4: Refactor Checkout Inactive-Restaurant Refund (`PaymentIntent`)
1. Refactor [`backend/app/api/payment/verify/route.js:233`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/verify/route.js#L233) to route through a dedicated, lease-fenced `executePaymentIntentRefund` function.
2. Assign deterministic `opKey` on `PaymentIntent`.
3. Include `PaymentIntent` in `recoverUnresolvedRefunds` scanning.

### Phase 5: Preconditions Before Production Unblock
Production readiness remains **BLOCKED** until all of the following are certified:
1. All Phase 1 backend state guards implemented and verified with 100% test pass rate in isolated replica set.
2. Webhook delivery registered and monitored in production Razorpay Dashboard.
3. Recurring scheduler deployed and monitored with alerting on recovery anomalies.
4. Business decision resolved on payment gateway idempotency (see Section 6).

---

## 6. Unresolved Architectural & Business Decisions

1. **Gateway Idempotency Limitation (Razorpay vs. Alternative Providers):**
   - Razorpay's API does not support native idempotency keys on payment refunds.
   - *Option A:* Build a custom outbound gateway proxy that maintains an internal persistent ledger of outbound requests before forwarding to Razorpay.
   - *Option B:* Migrate payment processing to a gateway that supports native HTTP idempotency headers (e.g. Stripe `Idempotency-Key`).
   - *Option C:* Accept that uncertain refunds can **never** be retried automatically or via single-click manual dispatch; require manual bank transfers or manual dashboard reconciliation for all edge-case timeouts.
2. **Multi-Restaurant Payment Split Risk:**
   - When a customer purchases from multiple restaurants in a single checkout, Razorpay records a single aggregate `paymentId`.
   - Webhook events lacking sub-order notes force sibling sub-orders into quarantine.
   - Engineering must determine whether to route multi-restaurant checkouts as separate individual Razorpay payment transactions or maintain current quarantine rules.
3. **RBAC & Finance Role Implementation:**
   - Current permissions collapse into the root `superadmin` role.
   - The platform requires an explicit `finance_admin` role with audit logging before live reconciliation operations are permitted.

---

## 7. Source Files Inspected & Verified

- [`backend/lib/refundService.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js) (Lines 140–450, 625–689)
- [`backend/app/api/superadmin/orders/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/superadmin/orders/route.js) (Lines 66–198)
- [`backend/app/api/restaurant/orders/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/restaurant/orders/route.js) (Lines 195–235)
- [`backend/app/api/orders/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/orders/route.js) (Lines 380–490)
- [`backend/app/api/payment/verify/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/verify/route.js) (Lines 200–276)
- [`backend/app/api/cron/refund-recovery/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/cron/refund-recovery/route.js) (Lines 1–90)
- [`backend/models/Order.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/models/Order.js) (Lines 38–165)
- [`backend/node_modules/razorpay/dist/resources/payments.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/node_modules/razorpay/dist/resources/payments.js) (Lines 115–165)
- [`backend/node_modules/razorpay/dist/types/refunds.d.ts`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/node_modules/razorpay/dist/types/refunds.d.ts) (Lines 1–70)
- [`backend/node_modules/razorpay/dist/api.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/node_modules/razorpay/dist/api.js) (Lines 16–35)
