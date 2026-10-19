# Phase 2A.20 — Final Refund Dispatch Architecture Audit

**Status:** COMPLETE (READ-ONLY AUDIT)  
**Execution Context:** Local isolated replica set (`mongodb-memory-server` on `127.0.0.1`), mocked Razorpay gateway clients only  
**Production Verdict:** **BLOCKED** (Production deployment and automated recovery scheduler remain strictly disabled)  
**Date:** 2026-10-15  

---

## 1. Executive Verdict & Summary

### Verdict: BLOCKED FOR PRODUCTION / STAGING-ONLY CANDIDATE

The Phase 2A.19 remediation successfully closed the critical correctness gaps identified in Phase 2A.18:
1. **Currency and Attribution Verification:** [`backend/lib/refundService.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L739-L912) now strictly requires `INR` currency on both fetched payments and refunds, verifies `payment_id` equality, validates exact paise amounts, enforces sub-order attribution notes (`opKey`/`orderId`) for multi-restaurant splits, and executes exactly **zero** outbound calls to `payments.refund`.
2. **PaymentIntent Refund Lifecycle:** [`backend/models/PaymentIntent.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/models/PaymentIntent.js#L66-L78), [`backend/app/api/payment/verify/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/verify/route.js#L262-L373), and [`backend/app/api/payment/webhook/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/webhook/route.js#L129-L251) now track deterministic operation keys (`opKey`), handle orderless refunds via webhooks with duplicate replay protection and out-of-order defenses, quarantine ambiguous events into `reconciliation_required`, and block any redispatch of uncertain intents.
3. **Quarantine Invariance Across All Entry Points:** All three cancellation routes (Customer, Restaurant Admin, Superadmin), Superadmin direct refunds, and the background recovery worker strictly reject dispatching refunds for orders or intents in `reconciliation_required`.

### Fundamental Limiting Factor: The External-Request Stale Worker Race
Despite these database protections, **production release remains BLOCKED**. 

As conclusively proven by Test 7B in [`backend/scripts/test_p1_refund_suite.mjs`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/scripts/test_p1_refund_suite.mjs#L904-L990), **database write fencing cannot cancel an external HTTP request already sent across the network**. When a worker process experiences an event-loop stall, network freeze, or garbage collection pause *after* passing its final database lease check but *before* invoking `razorpay.payments.refund()`, a second worker can acquire the expired lease, observe zero refunds at the gateway, and abort into `reconciliation_required`. When Worker A resumes, it dispatches an external HTTP request to Razorpay. Although Worker A's subsequent database write is fenced (`matchedCount === 0`), **the external monetary refund has already been executed by Razorpay**.

Furthermore, while Razorpay's REST API supports the `X-Refund-Idempotency` header, the official `razorpay` Node.js SDK wrapper (`razorpay.payments.refund`) does **not** expose a slot to pass custom HTTP headers. 

Until either direct HTTP dispatch with `X-Refund-Idempotency` is implemented or an out-of-process dedicated single-dispatcher architecture is deployed, **automated redispatch must remain permanently disabled**, and production must remain **BLOCKED**.

---

## 2. Verified Findings with Exact Source References

### A. Central Refund Service (`backend/lib/refundService.js`)

| Line Reference | Verified Behavior | Correctness Evaluation |
| :--- | :--- | :--- |
| **Line 167–179** | Central Guard: Rejects any order where `paymentStatus === "reconciliation_required"`, `refundDetails.status === "reconciliation_required"`, or `requiresManualReconciliation === true`. | **VERIFIED.** Immediate abort before lease acquisition or gateway calls. |
| **Line 190–228** | Atomic Lease Acquisition: Sets `status = "processing"`, generates random UUID `leaseToken`, increments `leaseGeneration` and `retryCount`, with 30s TTL (`lockExpiry`). | **VERIFIED.** Prevents concurrent local or distributed execution on active leases. |
| **Line 304–366** | Pre-Check Gateway Reconciliation: If recovering an expired lease or retry, queries gateway `getGatewayRefundsAndPayment`. If previous status was `"processing"` and gateway shows no refund, it aborts as unsafe takeover into `reconciliation_required`. | **VERIFIED.** Prevents speculative double-refunding when previous in-flight status is unknown. |
| **Line 434–446** | Pre-Gateway Fencing Check: Re-reads database with `leaseToken` immediately before invoking the gateway. Aborts if lease was superseded during pre-check. | **VERIFIED.** Evicts workers whose lease expired during gateway reconciliation. |
| **Line 448–452** | Test Post-Check Pause Hook (`_testRefundPostCheckPauseHook`): Simulates worker thread stall after line 446 passes. | **VERIFIED.** Accurately reproduces post-check race condition. |
| **Line 455–463** | External Dispatch Call Site: `razorpay.payments.refund(lockedOrder.paymentId, { amount, notes })`. | **VERIFIED.** Passes `opKey`, `orderId`, `reason`, `initiatedBy` in `notes`. Note: Does NOT pass HTTP header `X-Refund-Idempotency`. |
| **Line 468–491** | Post-Gateway Fenced Write: Updates order to `refunded` conditioned on `refundDetails.leaseToken == leaseToken`. Returns `aborted: true` if `matchedCount === 0`. | **VERIFIED.** Fences database state from stale workers; cannot fence the outbound HTTP request at line 455. |
| **Line 504–563** | Post-Error Reconciliation: If gateway call throws, re-queries gateway to check if request landed before timing out. Transitions to `refunded` if confirmed. | **VERIFIED.** Prevents duplicate payout on timeout when gateway actually succeeded. |
| **Line 565–586** | Uncertain Timeout Quarantine: If post-error reconciliation cannot verify refund, persists `paymentStatus: "refund_pending"` with error details. | **VERIFIED.** Preserves state for recovery or manual verification. |
| **Line 663–730** | Recovery Worker (`recoverUnresolvedRefunds`): Queries expired processing leases (`> 30s`) and `refund_pending` orders with `retryCount < maxRetries`. Strictly excludes `reconciliation_required`. | **VERIFIED.** Bounded batch size, safe retry limits, zero dispatch for quarantined orders. |
| **Line 739–912** | Order Reconciliation (`reconcileOrderRefund`): Validates `paymentEntity.currency === "INR"`, `matchedRefund.currency === "INR"`, `matchedRefund.payment_id === order.paymentId`, `matchedRefund.amount === amountPaise`, and sub-order attribution for siblings (`notes.opKey === opKey || notes.orderId === ...`). Sets `reconciled: true`. | **VERIFIED.** Exactly 0 calls to `razorpay.payments.refund`. Mismatches return errors without modifying DB. |
| **Line 919–1060** | PaymentIntent Reconciliation (`reconcilePaymentIntentRefund`): Safe, read-only reconciliation of orderless payment intents. Same currency, amount, and payment ID validations. | **VERIFIED.** Strictly read-only against gateway. |

---

### B. PaymentIntent Lifecycle (`backend/models/PaymentIntent.js` & `backend/app/api/payment/verify/route.js`)

| Line Reference | Verified Behavior | Correctness Evaluation |
| :--- | :--- | :--- |
| **`PaymentIntent.js` L66–78** | Schema Definition: `refundDetails` contains `opKey`, `refundId`, `status`, `gatewayStatus`, `amount`, `reason`, `error`, `retryCount`, `processedAt`, `lastAttemptAt`, `reconciled`, `requiresManualReconciliation`. | **VERIFIED.** Schema tracks operational identifiers and reconciliation state. |
| **`verify/route.js` L97–119** | Pre-Verification Guard: Rejects verify attempt if `status === 'reconciliation_required'` or `requiresManualReconciliation === true` with HTTP 400: *"Refund redispatch is prohibited to prevent duplicate payouts."* | **VERIFIED.** Prohibits re-entering verification for uncertain payments. |
| **`verify/route.js` L186–221** | Concurrency Lock: Excludes `refundDetails.requiresManualReconciliation: true` and `refundDetails.status: "reconciliation_required"`. | **VERIFIED.** Prevents competing verification requests from acquiring lock. |
| **`verify/route.js` L262–273** | Durable Intent State: Sets `status = 'refund_pending'` and records deterministic `opKey = refop_pi_<id>` before calling refund API. | **VERIFIED.** Preserves intent state and operational identity. |
| **`verify/route.js` L274–320** | Gateway Pre-Check: Checks if gateway already refunded payment (`amount_refunded >= amountPaise`). Marks `refunded` with `reconciled: true` if already executed. | **VERIFIED.** Prevents duplicate payout if refund previously landed. |
| **`verify/route.js` L321–349** | External Dispatch Call Site: `razorpay.payments.refund(razorpay_payment_id, { amount, notes: { opKey, paymentIntentId, razorpay_order_id, reason, restaurant } })`. | **VERIFIED.** Forwards `opKey` and `paymentIntentId` in notes. |
| **`verify/route.js` L350–374** | Safe Error Quarantine: Catches `refundErr`, sets `status = 'reconciliation_required'` and `requiresManualReconciliation: true`. | **VERIFIED.** Uncertain outcome is quarantined; never redispatched automatically. |

---

### C. Webhook Handling (`backend/app/api/payment/webhook/route.js`)

| Line Reference | Verified Behavior | Correctness Evaluation |
| :--- | :--- | :--- |
| **Line 20–48** | Authentication: Validates `x-razorpay-signature` against HMAC-SHA256 of raw request body (`request.text()`). Rejects missing/invalid signatures with HTTP 400. | **VERIFIED.** Cryptographically sound verification before JSON parsing. |
| **Line 72–128** | `refund.processed` Order Matching: Matches by `notes.opKey`, `notes.orderId`, `refundId`, or `paymentId`. Quarantines ambiguous multi-order payments into `reconciliation_required`. | **VERIFIED.** Deterministic matching; protects multi-restaurant payments. |
| **Line 129–251** | `refund.processed` PaymentIntent Fallback: If `!targetOrder`, searches `PaymentIntent` via `opKey`, `paymentIntentId`, `razorpay_order_id`, `refundId`, or `paymentId`. Validates `INR` currency and exact paise amount. Idempotent check returns HTTP 200 (`idempotent: true`) on replay. Transitions to `refunded` with `reconciled: true`. | **VERIFIED.** Closes the Phase 2A.18 orderless refund gap cleanly. |
| **Line 253–276** | `refund.processed` Order Idempotency: Replay check returns HTTP 200 (`alreadyProcessed: true`) without redundant updates. | **VERIFIED.** Fully idempotent. |
| **Line 308–327** | `refund.failed` Order Matching: Matches order via `opKey`, `orderId`, `refundId`, or `paymentId`. | **VERIFIED.** Consistent attribution hierarchy. |
| **Line 328–391** | `refund.failed` PaymentIntent Fallback: Matches intent. Out-of-order check prevents regressing already `refunded` intents (returns HTTP 200 `ignored: true`). Otherwise sets `reconciliation_required` with `requiresManualReconciliation: true`. | **VERIFIED.** Prevents out-of-order failure events from corrupting successful refunds. |
| **Line 393–418** | `refund.failed` Order Out-of-Order Defense: Never regresses an order that is already marked `refunded`. Otherwise marks `reconciliation_required`. | **VERIFIED.** State machine monotonicity preserved. |

---

### D. Order Cancellation Routes

| Route | Verified Guard Lines | Behavior on `reconciliation_required` Order |
| :--- | :--- | :--- |
| **Customer Cancellation** (`backend/app/api/orders/route.js`) | Lines 408–415, 472–494 | Rejects refund eligibility (`isRefundEligible` is false). Returns HTTP 200 with `requiresManualReconciliation: true` and **0 calls** to `executeOrderRefund`. |
| **Restaurant Cancellation** (`backend/app/api/restaurant/orders/route.js`) | Lines 222–248 | Rejects refund eligibility. Returns HTTP 200 with `requiresManualReconciliation: true` and **0 calls** to `executeOrderRefund`. |
| **Superadmin Orders** (`backend/app/api/superadmin/orders/route.js`) | Lines 92–116 (`action: "refund"`), Lines 204–232 (`status: "cancelled"`) | Action `refund` rejects with HTTP 400 (*"Order requires manual reconciliation. Direct refund redispatch is prohibited"*). Cancellation rejects refund eligibility with **0 calls** to `executeOrderRefund`. |

---

## 3. Complete Refund-Dispatch Call Graph

```
                                  [ INCOMING REQUEST / CRON ]
                                               │
         ┌──────────────────┬──────────────────┼──────────────────┬──────────────────┐
         │                  │                  │                  │                  │
    [Customer]        [Restaurant]       [Superadmin]      [Recovery Cron]   [Payment Verify]
POST /api/orders    PUT /api/restaurant/ POST /api/superadmin/ GET /api/cron/  POST /api/payment/
   (action: cancel)      orders             orders        refund-recovery       verify
         │           (status: cancel)   (action: refund /         │                  │
         │                  │            status: cancel)          │                  │
         │                  │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼                  │
 ┌─────────────────────────────────────────────────────────────┐  │                  │
 │                      ROUTE GUARDS                           │  │                  │
 │  - Is order.paymentStatus == "reconciliation_required"?    │  │                  │
 │  - If YES: REJECT / SET MESSAGE; DO NOT DISPATCH           │  │                  │
 └──────────────────────────────┬──────────────────────────────┘  │                  │
                                │                                 │                  │
                                │ Eligible orders only            │                  │
                                ▼                                 │                  │
               ┌─────────────────────────────────┐                │                  │
               │      recoverUnresolvedRefunds   │◄───────────────┘                  │
               │  - status: "processing" (>30s)  │                                   │
               │  - status: "refund_pending"     │                                   │
               │  - retryCount < maxRetries      │                                   │
               │  - EXCLUDES: recon_required     │                                   │
               └────────────────┬────────────────┘                                   │
                                │                                                    │
                                ▼                                                    │
               ┌─────────────────────────────────┐                                   │
               │       executeOrderRefund        │                                   │
               │  (backend/lib/refundService.js) │                                   │
               └────────────────┬────────────────┘                                   │
                                │                                                    │
    ┌───────────────────────────┴───────────────────────────┐                        │
    │ 1. Central Guard: paymentStatus == recon_required?    │                        │
    │    --> ABORT (0 calls)                                │                        │
    │ 2. Atomic Lease Lock (findOneAndUpdate, TTL: 30s)     │                        │
    │ 3. Pre-check Gateway Reconciliation (fetch/fetchMult) │                        │
    │    --> If prior in-flight status unknown:             │                        │
    │        ABORT to reconciliation_required               │                        │
    │ 4. Pre-Gateway Lease Fencing Check                    │                        │
    │    --> If lease lost during pre-check: ABORT          │                        │
    └───────────────────────────┬───────────────────────────┘                        │
                                │                                                    │
                                ▼                                                    │
        =================================================                            │
        CALL SITE 1: backend/lib/refundService.js:455                                │
        razorpay.payments.refund(lockedOrder.paymentId, {                            │
          amount: amountPaise,                                                       │
          notes: { opKey, orderId, reason, initiatedBy }                             │
        })                                                                           │
        =================================================                            │
                                │                                                    │
    ┌───────────────────────────┴───────────────────────────┐                        │
    │ 5. Post-Gateway Fenced Save                           │                        │
    │    - updateOne({ leaseToken: leaseToken })            │                        │
    │    - If matchedCount == 0:                            │                        │
    │      Lease superseded! DB fenced, but external        │                        │
    │      HTTP request already dispatched to Razorpay!     │                        │
    │ 6. Post-Error Reconciliation (on throw)               │                        │
    │    - Check if refund actually succeeded on gateway    │                        │
    │    - If unconfirmed: quarantine as refund_pending     │                        │
    └───────────────────────────────────────────────────────┘                        │
                                                                                     │
                                                                                     ▼
                                                            ┌─────────────────────────────────┐
                                                            │ Step 5: Kitchen Suspended/Inact │
                                                            │ (backend/app/api/payment/verify)│
                                                            └────────────────┬────────────────┘
                                                                             │
                                                                ┌────────────┴────────────┐
                                                                │ 1. Intent Guard:        │
                                                                │    recon_required?      │
                                                                │    --> ABORT (0 calls)  │
                                                                │ 2. Save opKey & durable │
                                                                │    refund_pending state │
                                                                │ 3. Gateway Pre-Check    │
                                                                │    (fetch payment)      │
                                                                │    --> If refunded:     │
                                                                │        mark refunded    │
                                                                └────────────┬────────────┘
                                                                             │
                                                            =================================
                                                            CALL SITE 2: verify/route.js:331
                                                            razorpay.payments.refund(
                                                              razorpay_payment_id,
                                                              { amount, notes: { opKey... } }
                                                            )
                                                            =================================
                                                                             │
                                                                ┌────────────┴────────────┐
                                                                │ 4. If success: mark     │
                                                                │    intent "refunded"    │
                                                                │ 5. If throws: mark      │
                                                                │    intent recon_required│
                                                                └─────────────────────────┘
```

---

## 4. Race Analysis & Reproduction Evidence

### Exact Mechanics of the Stale-Worker Race

```
Timeline (T)    Worker A (executeOrderRefund)           Worker B / Cron Takeover                Razorpay Gateway
────────────    ─────────────────────────────           ────────────────────────                ────────────────
T0              Acquires leaseToken_A (TTL=30s)
T1              Pre-check: 0 refunds found
T2              Pre-check fencing check passes
T3              WORKER A STALLS (GC/Freeze/I/O)
T3 + 31s        [Lease expires on MongoDB]
T3 + 32s                                                Acquires leaseToken_B
T3 + 33s                                                Pre-check: 0 refunds found
T3 + 34s                                                Conservatively aborts:
                                                        order -> reconciliation_required
T3 + 35s        WORKER A RESUMES EXECUTION!
                Pre-check already passed in memory.
T3 + 36s        Sends HTTP POST to Razorpay ───────────────────────────────────────────────────► DISPATCHES REFUND!
                                                                                                Refund ID: rfnd_A
                                                                                                Amount: Deducted
T3 + 37s        Attempts DB update:
                updateOne({ leaseToken: leaseToken_A })
                MATCHED COUNT = 0 (token_A != token_B).
                Worker A DB write FENCED!
```

### Isolated Reproduction: Test 7B Evidence
In [`backend/scripts/test_p1_refund_suite.mjs`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/scripts/test_p1_refund_suite.mjs#L904-L990), Test 7B programmatically reproduces this exact boundary condition using `_setTestRefundPostCheckPauseHook`:
1. Worker A acquires lease and successfully evaluates `preCheck`.
2. Hook fires: Worker A is paused immediately before calling `razorpay.payments.refund`.
3. Test advances database clock by 31 seconds (`lastAttemptAt = now - 31000`).
4. Worker B invokes `executeOrderRefund`, finds an expired processing lease with 0 gateway refunds, and aborts into `reconciliation_required`.
5. Worker A resumes and executes `razorpay.payments.refund`.
6. **Observed Results:**
   - Gateway mock recorded `gatewayCalls.refund === 1` (Worker A sent the external refund request).
   - Worker A database write failed (`matchedCount === 0`); Worker A returned `aborted: true, message: "Worker lease superseded during gateway response processing."`.
   - Order document in database remained in `reconciliation_required` without Worker A's `refundId`.

### Architectural Proof
**Database conditional writes protect database state; they do NOT protect network transport.**  
Once an external HTTP call has been dispatched, no database fencing, lease token, or version counter can prevent the remote payment gateway from processing the request. Claiming that database leasing prevents double-refunding is technically incorrect whenever the payment gateway does not enforce idempotent request deduplication.

---

## 5. Architectural Options Evaluation

| Option | Core Mechanism | What It Guarantees | What It CANNOT Guarantee | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **1. Existing DB Lease & Fencing** | Optimistic locking on Order document with `leaseToken` and 30s TTL. | Prevents concurrent workers from writing to MongoDB simultaneously. Rejects redispatch on uncertain orders. | Cannot stop a stale worker from sending an HTTP request across the network after pausing past its final pre-check. | **INSUFFICIENT ALONE** |
| **2. Strict Single Dispatcher (No Redispatch)** | Single designated dispatcher queue with durable dispatch journals; zero automated redispatch on timeout. | Prevents competing workers from racing. Quarantines all timeouts for read-only reconciliation. | Does not prevent a stalled single worker from issuing a delayed request if it pauses and resumes. | **RECOMMENDED POLICY (BASELINE)** |
| **3. Dedicated Outbound Refund Proxy** | Specialized internal service with exclusive, centralized network access to Razorpay API. | Centralizes in-flight request tracking across the cluster. Enforces single-flight concurrency at the network egress. | If the proxy itself experiences an internal network timeout with Razorpay, it faces the identical two-army uncertainty problem. | **HIGH COMPLEXITY; PARTIAL BENEFIT** |
| **4. Gateway-Supported Idempotency (`X-Refund-Idempotency`)** | Include `X-Refund-Idempotency: <UUID>` header in `POST /v1/payments/:id/refund`. | Gateway-enforced deduplication: gateway guarantees that identical idempotency keys return existing refund records without duplicate charge. | Official `razorpay` Node.js SDK wrapper **does not expose** custom HTTP headers. Requires direct `fetch`/`axios` implementation. | **REQUIRED FOR FULL SAFETY (DIRECT HTTP ONLY)** |

### Authoritative Gateway Analysis: Razorpay Refund Idempotency
- **REST API Capabilities:** Razorpay's API natively supports normal and instant refund idempotency via the `X-Refund-Idempotency` header. Keys must be $\ge 10$ characters (alphanumeric, hyphens, underscores). Retries with the same key and identical body return the existing refund object; retries while still in-flight return HTTP 409 Conflict.
- **Node.js SDK Limitation:** The high-level SDK method `razorpay.payments.refund(paymentId, { amount, notes })` only serializes JSON request bodies. Passing custom HTTP headers is not supported by the method signature.
- **Synthesized Architectural Recommendation:**
  1. **Phase 1 (Immediate - Active in Codebase):** Enforce Option 2 (Strict Single-Dispatcher Policy). Never automatically redispatch uncertain refunds. All timeouts quarantine into `reconciliation_required`. Schedulers remain disabled. Reconcile strictly via read-only endpoints (`reconcileOrderRefund` / `reconcilePaymentIntentRefund`) and authenticated webhooks.
  2. **Phase 2 (Target Architecture):** Replace the high-level `razorpay.payments.refund` call with a direct HTTP client (e.g. native `fetch` with Basic Auth) that transmits `X-Refund-Idempotency: <durable_opKey>`. This pairs client-side write fencing with authoritative gateway-level request deduplication.

---

## 6. PaymentIntent & Webhook Audit (Task 4)

### Verification of Audit Criteria
1. **Crash Recovery & Discoverability:**
   - Before dispatching a refund at `verify/route.js:263`, `lockedIntent.status` is durably committed to `"refund_pending"` with `opKey`.
   - If the node crashes during `razorpay.payments.refund`, the record in MongoDB has `status: "refund_pending"`.
   - When the client retries `POST /api/payment/verify`, lines 97–119 inspect `status` and `requiresManualReconciliation`, rejecting retry with HTTP 400 and preventing double dispatch.
   - The intent is discoverable and reconcilable via `reconcilePaymentIntentRefund` or incoming webhooks.
2. **Raw Request Body Authentication:**
   - Webhook endpoint (`webhook/route.js:20`) extracts `rawBody = await request.text()` before JSON parsing.
   - Computes `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')` and validates `x-razorpay-signature`.
3. **Event Attribution Hierarchy:**
   - Webhooks search orders first by `opKey`, then `orderId`, then `refundId`, then `paymentId`.
   - If no order is found, falls back to `PaymentIntent` via `opKey`, `paymentIntentId`, `razorpay_order_id`, `refundId`, or `paymentId`.
4. **Duplicate & Out-of-Order Safety:**
   - Duplicate `refund.processed` webhooks return HTTP 200 with `idempotent: true` and execute no database mutations.
   - Out-of-order `refund.failed` events arriving after `refund.processed` check `targetOrder.paymentStatus === 'refunded'` (or `targetIntent.status === 'refunded'`) and return HTTP 200 with `ignored: true`, completely preserving the completed refund status.
5. **Amount and Currency Validation:**
   - Webhook checks `refundEntity.currency === 'INR'` and `refundEntity.amount === intent.amountPaise`. Mismatches quarantine to `reconciliation_required`.
6. **Ambiguity Quarantine:**
   - If a multi-order or multi-intent payment receives a refund lacking specific `opKey` notes, all matching entities are quarantined into `reconciliation_required` with `requiresManualReconciliation = true`.
7. **Read-Only Reconciliation Guarantee:**
   - Neither `reconcileOrderRefund` nor `reconcilePaymentIntentRefund` contains any call site to `razorpay.payments.refund`. Both functions are strictly read-only (`fetch` and `fetchMultipleRefund`).

### Missing Tests & Identified Coverage Gaps
1. **PaymentIntent Crash Injection Test:** While Order crash recovery is extensively covered in Test 8, there is no automated test injecting a process crash between `PaymentIntent` lock acquisition in `verify/route.js` and gateway completion.
2. **PaymentIntent Stale-Worker Pause Hook:** Unlike `executeOrderRefund` (which has `_testRefundPostCheckPauseHook`), `payment/verify/route.js` does not have a deterministic post-check pause hook to simulate a suspended kitchen verify worker pausing past pre-check.
3. **Multi-Restaurant Partial Verification Rollback Test:** If Kitchen 1 is suspended, Kitchen 2 is active, and the customer paid online, verifying the PaymentIntent refund workflow when multiple sub-orders exist in `calcResult.orders`.

---

## 7. Explicit Production Release Gates

To safely transition from **BLOCKED** to **PRODUCTION APPROVED**, the platform must satisfy the following verifiable gates:

- [ ] **Gate 1: Direct HTTP Gateway Idempotency Implementation**
  - Replace `razorpay.payments.refund()` in `backend/lib/refundService.js` and `backend/app/api/payment/verify/route.js` with direct HTTP calls sending the `X-Refund-Idempotency` header populated with `opKey`.
  - Validate in mock tests that gateway returns HTTP 409 or duplicate refund representations on identical idempotency keys without duplicate dispatches.
- [ ] **Gate 2: PaymentIntent Verification Pause Hook & Test Coverage**
  - Add deterministic test hooks in `backend/app/api/payment/verify/route.js` and add Test 21 covering PaymentIntent crash injection and pause-after-precheck races.
- [ ] **Gate 3: Automated Recovery Scheduler Policy Formalization**
  - Retain automated cron redispatch in **DISABLED** state (`CRON_SECRET` unconfigured for recovery, or worker restricted to read-only reconciliation scanning).
  - Verify that the recovery worker never executes outbound `payments.refund` without explicit human-in-the-loop authorization.
- [ ] **Gate 4: Multi-Tenant Superadmin Dashboard for PaymentIntent Reconciliation**
  - Expose an administrative UI view for orphan `PaymentIntent` records in `reconciliation_required` state, allowing superadmins to trigger `reconcilePaymentIntentRefund` directly from the dashboard.
- [ ] **Gate 5: End-to-End Staging Run on Ephemeral Multi-Node Cluster**
  - Execute full test suite against a multi-instance backend container pool with real network latency simulation to ensure distributed lease TTLs and lock acquisitions hold under multi-process load.

---

### Audit Sign-Off
- **Auditor:** Independent Safety Agent (Antigravity AI)
- **Status:** READ-ONLY COMPLETED
- **File Output:** [`docs/PHASE_2A_20_FINAL_REFUND_DISPATCH_ARCHITECTURE_AUDIT.md`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/docs/PHASE_2A_20_FINAL_REFUND_DISPATCH_ARCHITECTURE_AUDIT.md)
- **Production Status:** **STRICTLY BLOCKED**
