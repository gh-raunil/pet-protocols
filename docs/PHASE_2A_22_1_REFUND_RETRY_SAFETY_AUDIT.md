# Phase 2A.22.1 — Refund Retry Safety and Idempotency Retention Audit

**Status:** READ-ONLY AUDIT COMPLETE  
**Execution Context:** Local source code inspection; isolated replica set simulation (`test_dangerous_case_audit.mjs`); official Razorpay documentation verification  
**Production Verdict:** **STRICTLY BLOCKED — RELEASE FORBIDDEN — AUTOMATED RECOVERY DISABLED**  
**Date:** October 15, 2026  
**Auditor:** Antigravity AI Engineering  

---

## 1. Executive Verdict & Core Findings

### Release Verdict: PRODUCTION BLOCKED (CRITICAL VULNERABILITY VERIFIED)

A focused audit of `backend/lib/razorpayHttpClient.js`, `backend/lib/refundService.js`, and `backend/app/api/payment/verify/route.js`, combined with isolated simulation of the "dangerous case", has revealed a critical safety gap in `refundService.js`:

1. **Uncertain Outcomes Left in `refund_pending` in `refundService.js`:**
   When an outbound refund request in `backend/lib/refundService.js` encounters a read timeout (`ETIMEDOUT`), connection reset (`ECONNRESET`), or HTTP 5xx server error, and immediate post-error gateway lookup does not find the refund (due to replication lag or gateway delay), lines 727–748 transition the order to:
   - `paymentStatus: "refund_pending"`
   - `refundDetails.status: "pending"`
   - `refundDetails.dispatchState: "prepared"`
2. **Automated Recovery Redispatch Vulnerability:**
   Because the order remains in `refund_pending` with status `pending`, the automated recovery worker (`recoverUnresolvedRefunds`) picks up the order. If the gateway refund is still not visible on the read replica during the recovery worker's pre-check, the recovery worker issues a **second outbound HTTP POST request** to Razorpay.
3. **Gateway Idempotency Retention is UNVERIFIED:**
   Razorpay's official documentation for `X-Refund-Idempotency` on `POST /v1/payments/:id/refund` **does not publish or guarantee any idempotency retention period (TTL)**. The claimed 24–48-hour retention window is **UNVERIFIED**. If Razorpay's internal key cache has expired, or if the gateway treats the key as expired/unknown, the gateway accepts the second request and issues a **second refund debit**, resulting in a double payout.
4. **Dangerous Case Simulation Confirmed Double Debit:**
   In our isolated simulation test (`backend/scripts/test_dangerous_case_audit.mjs`), simulating a timeout followed by read lag and an expired gateway retention window resulted in **2 outbound HTTP calls and 2 debits in the gateway ledger** for the same logical order.
5. **Contrast with `verify/route.js`:**
   In `backend/app/api/payment/verify/route.js`, any non-200 outcome (including timeouts, resets, and 5xx) immediately transitions the PaymentIntent to `status: "reconciliation_required"` and `dispatchState: "quarantined"`, preventing any further outbound dispatch. `refundService.js` must be updated to mirror this quarantine behavior.

---

## 2. Retry Decision Table across All Failure Outcomes

Below is the exhaustive classification of every failure scenario across both dispatch paths:

| Failure / Error Condition | Route / Entry Point | Client Classification (`razorpayHttpClient.js`) | Local DB State Written | Read-Only Lookup First on Retry? | Can Another Outbound Dispatch Occur? | Key & Payload Stability | Safety Assessment |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **HTTP 400 (Bad Request - Format / Param)** | `refundService.js` | `badRequest: true`, `definitiveError: true` (L268) | `paymentStatus: "refund_pending"`, `dispatchState: "prepared"` (L731) | **Yes** (L377) | **Yes** (Recovery worker / retry if retryCount < 3) | Same key, same body | ⚠️ **DANGEROUS**: Format errors should not be blindly retried. |
| **HTTP 400 (Payload Mismatch)** | `refundService.js` | `badRequest: true`, `payloadMismatch: true`, `definitiveError: true` (L280) | `paymentStatus: "reconciliation_required"`, `dispatchState: "quarantined"` (L642) | N/A | **NO** (Strictly blocked across all routes) | Key quarantined | ✅ **SAFE** |
| **HTTP 400 (Any)** | `verify/route.js` | Caught / classified | `status: "reconciliation_required"`, `dispatchState: "quarantined"` (L427) | N/A | **NO** (Strictly blocked) | Key quarantined | ✅ **SAFE** |
| **HTTP 409 (Conflict - Key in progress)** | `refundService.js` | `conflict: true`, `inProgress: true`, `uncertain: true` (L254) | `paymentStatus: "reconciliation_required"`, `dispatchState: "quarantined"` (L615) | N/A | **NO** (Strictly blocked) | Key quarantined | ✅ **SAFE** |
| **HTTP 409 (Conflict - Key in progress)** | `verify/route.js` | Caught / classified | `status: "reconciliation_required"`, `dispatchState: "quarantined"` (L427) | N/A | **NO** (Strictly blocked) | Key quarantined | ✅ **SAFE** |
| **HTTP 429 (Rate Limit)** | `refundService.js` | `clientError: true`, `definitiveError: true` (L302) | `paymentStatus: "refund_pending"`, `dispatchState: "prepared"` (L731) | **Yes** (L377) | **Yes** (Recovery worker) | Same key, same body | ⚠️ **UNSAFE**: 429 is treated as 4xx client error, falling through to `refund_pending`. |
| **HTTP 429 (Rate Limit)** | `verify/route.js` | Caught / classified | `status: "reconciliation_required"`, `dispatchState: "quarantined"` (L427) | N/A | **NO** (Strictly blocked) | Key quarantined | ✅ **SAFE** |
| **HTTP 5xx (Server Error: 500, 502, 503, 504)** | `refundService.js` | `gatewayError: true`, `uncertain: true` (L289) | `paymentStatus: "refund_pending"`, `dispatchState: "prepared"` (L731) | **Yes** (L377) | **Yes** (Recovery worker / retry) | Same key, same body | 🚨 **CRITICAL HAZARD**: If gateway processed refund despite 5xx, retry can double-refund if retention expires. |
| **HTTP 5xx (Server Error)** | `verify/route.js` | Caught / classified | `status: "reconciliation_required"`, `dispatchState: "quarantined"` (L427) | N/A | **NO** (Strictly blocked) | Key quarantined | ✅ **SAFE** |
| **Connection Reset (`ECONNRESET`)** | `refundService.js` | `networkError: true`, `uncertain: true`, `isConnReset: true` (L315) | `paymentStatus: "refund_pending"`, `dispatchState: "prepared"` (L731) | **Yes** (L377) | **Yes** (Recovery worker / retry) | Same key, same body | 🚨 **CRITICAL HAZARD**: Outcome uncertain; retry can duplicate debit if lookup lags and retention expires. |
| **Connection Reset (`ECONNRESET`)** | `verify/route.js` | Caught / classified | `status: "reconciliation_required"`, `dispatchState: "quarantined"` (L427) | N/A | **NO** (Strictly blocked) | Key quarantined | ✅ **SAFE** |
| **Read Timeout (`ETIMEDOUT` / `AbortError`)** | `refundService.js` | `networkError: true`, `uncertain: true`, `isTimeout: true` (L314) | `paymentStatus: "refund_pending"`, `dispatchState: "prepared"` (L731) | **Yes** (L377) | **Yes** (Recovery worker / retry) | Same key, same body | 🚨 **CRITICAL HAZARD**: Gateway accepted refund; client timed out; retry issues second call. |
| **Read Timeout (`ETIMEDOUT` / `AbortError`)** | `verify/route.js` | Caught / classified | `status: "reconciliation_required"`, `dispatchState: "quarantined"` (L427) | N/A | **NO** (Strictly blocked) | Key quarantined | ✅ **SAFE** |
| **Process Crash Before Outbound Dispatch** | `refundService.js` | N/A (Node process terminated) | Journaled in MongoDB: `dispatchState: "dispatching"`, `status: "processing"` | **Yes** (L377) | **NO** (L427 triggers: `isPreviousStatusProcessing && !isFullyRefunded` -> **ABORTS & QUARANTINES**) | Same key preserved | ✅ **SAFE** (Protected by line 427 takeover abort) |
| **Process Crash Before Outbound Dispatch** | `verify/route.js` | N/A (Process terminated) | Journaled in MongoDB: `dispatchState: "dispatching"`, `status: "refund_pending"` | **Yes** (Pre-check L312) | **NO** (Order creation fails, verified safe) | Same key preserved | ✅ **SAFE** |
| **Process Crash After Gateway Acceptance Before DB Commit** | `refundService.js` | N/A (Process terminated) | In DB: `status: "processing"`, `dispatchState: "dispatching"`. On Gateway: `status: "processed"` | **Yes** (L377) | **NO** (`isFullyRefunded: true` -> reconciles to `confirmed` with 0 calls) | Reconciled | ✅ **SAFE** |
| **Process Crash After Gateway Acceptance Before DB Commit** | `verify/route.js` | N/A (Process terminated) | In DB: `status: "refund_pending"`. On Gateway: `status: "processed"` | **Yes** (Pre-check L312) | **NO** (Detects existing refund -> reconciles to `confirmed` with 0 calls) | Reconciled | ✅ **SAFE** |

---

## 3. Authoritative Retention Evidence & Explicit UNVERIFIED Status

### A. Official Documentation Inspection for `X-Refund-Idempotency`

Authoritative Razorpay developer documentation was inspected for standard payment refunds:
- **Canonical API Reference:** `https://razorpay.com/docs/api/refunds/`
- **Normal Refunds (Idempotent Request):** `https://razorpay.com/docs/api/refunds/#create-a-normal-refund-idempotent-request`
- **Instant Refunds (Idempotent Request):** `https://razorpay.com/docs/api/refunds/#create-an-instant-refund-idempotent-request`
- **LLM/Markdown Reference Source:** `https://razorpay.com/docs/build/llm-docs/api/refunds/normal-refunds-idempotent.md`

### B. Exact Official Passages on `X-Refund-Idempotency`

The official documentation contains the following exact specifications:
> *"To make a normal refund request idempotent, add the header `X-Refund-Idempotency` to the request and pass an idempotency key against it."*
> *"The idempotency key must be at least 10 character long and can contain alphabets, numbers, hyphens and underscores only. For example, `550e8400-e29b-41d4-a716-446655440000`."*
> *"When retrying a request, the request body must be the same as the first request for idempotency to work. A different payload will be rejected as a `BAD_REQUEST`."*
> *"If a request is received while a prior request is still being processed, the system will return a 409 Conflict status code. You may retry the request upon receiving this response."*

### C. Status of the "24–48 Hours" Retention Claim: **UNVERIFIED**

> [!CAUTION]
> **RETENTION STATUS: UNVERIFIED**  
> Nowhere in the official documentation for Razorpay Payment Gateway refunds (`POST /v1/payments/:id/refund`) is a retention duration of 24 hours, 48 hours, or any specific TTL mentioned.
> 
> The 24–48-hour retention claim was an external assumption imported from general payment gateway conventions (e.g., Stripe documents 24 hours; Razorpay payout links configure expiration hours). It is **NOT** a documented guarantee of Razorpay's retail payment refund endpoint.
> 
> Razorpay describes idempotency as a mechanism for transient retry during network downtimes (*"due to network downtimes, you may not get a response from our servers"*). **No TTL guarantee exists.** Assuming that Razorpay will deduplicate requests hours or days later is completely unfounded and unsafe.

### D. Distinction: Payment Gateway Refunds vs RazorpayX Payouts

- **Standard Payment Refunds (`POST /v1/payments/:id/refund`):**
  - Header: `X-Refund-Idempotency`
  - Scope: Reverses customer payments.
  - Retention: **Undocumented / UNVERIFIED**.
- **RazorpayX Business Banking Payouts (`POST /v1/payouts`):**
  - Header: `X-Payout-Idempotency`
  - Scope: Vendor payouts and fund transfers.
  - Requirement: Mandatory since March 15, 2025.
  - Retention: Documented separately under RazorpayX banking rules.

---

## 4. Durable Operation Identity & Index Analysis

### A. Stable Operation Key Derivation
- `idempotencyKey` is derived deterministically:
  - For Orders: `refkey_ord_${order._id.toString()}` via `generateRefundIdempotencyKey("ord", order._id)` ([backend/lib/refundService.js:211](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L211)).
  - For PaymentIntents: `refkey_pi_${lockedIntent._id.toString()}` via `generateRefundIdempotencyKey("pi", lockedIntent._id)` ([backend/app/api/payment/verify/route.js:268](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/verify/route.js#L268)).
- Because `_id` is an immutable, unique 24-character hexadecimal ObjectId, the key is deterministic across all workers and retries.

### B. Payload Consistency & Fingerprint Enforcement
- Both `refundService.js` (lines 219–250) and `verify/route.js` (lines 278–286) compute a SHA-256 hash using `computePayloadFingerprint()`:
  - Hashes `amount`, `currency`, `speed`, `receipt`, and stable notes (`opKey`, `orderId`, `paymentIntentId`).
- If an existing order has a stored `requestFingerprint` and an incoming request payload differs, [backend/lib/refundService.js:229](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L229) immediately quarantines the order as `reconciliation_required` without hitting the network, preventing Razorpay's HTTP 400 `idempotency_error`.

### C. Multi-Restaurant Sub-Order Attribution
- Each sub-order in a multi-restaurant checkout possesses its own distinct `Order` document with a unique `_id`.
- Therefore, each sub-order generates an independent `idempotencyKey` (`refkey_ord_subOrderA_id` vs `refkey_ord_subOrderB_id`) and independent `opKey`.
- Sub-order refunds can be dispatched, reconciled, or quarantined independently without key collision.

### D. Analysis of Unique Partial Indexes (Single Collection vs Cross-Collection)
- **Can MongoDB enforce uniqueness across collections?**
  **NO.** MongoDB indexes are strictly collection-scoped (`orders` vs `paymentintents`). A database index cannot enforce uniqueness across both collections.
- **Why Cross-Collection Collisions Cannot Occur:**
  The implementation enforces disjoint key namespaces:
  - Orders: prefix `refkey_ord_`
  - PaymentIntents: prefix `refkey_pi_`
  Since no Order can have prefix `refkey_pi_` and no PaymentIntent can have prefix `refkey_ord_`, collisions between Orders and PaymentIntents are mathematically impossible.
- **Is a Single-Collection Unique Partial Index Necessary?**
  - Within `orders`: `{ "refundDetails.idempotencyKey": 1 }, { unique: true, sparse: true }`
  - While deterministic key generation using `order._id` already guarantees single-document uniqueness, adding this index in production is a recommended **defense-in-depth invariant** against accidental programmatic key overwrite or data duplication.
  - Per safety constraints, **no remote indexes or migrations were applied**.

---

## 5. Test of the Dangerous Case: Simulation & Results

### A. Test Configuration
An isolated test script ([backend/scripts/test_dangerous_case_audit.mjs](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/scripts/test_dangerous_case_audit.mjs)) was executed against an isolated in-memory replica set (`mongodb-memory-server`) to simulate the exact 5-step hazard:
1. Worker 1 dispatches refund; Razorpay processes and commits refund #1.
2. The network connection drops; Worker 1 receives `ETIMEDOUT`.
3. Post-error lookup and subsequent recovery worker lookup simulate replication lag (`gatewayLookupVisible = false`).
4. Gateway idempotency retention is treated as expired/unknown (`idempotencyRetentionActive = false`).
5. A delayed worker resumes after lease expiry.

### B. Execution Output & Verification

```text
========================================================================
PHASE 2A.22.1: DANGEROUS CASE AUDIT SIMULATION
Testing timeout -> delayed lookup -> expired retention -> delayed worker
========================================================================

>>> Starting Dangerous Case Simulation...

--- Step 1 & 2: Worker 1 dispatches refund -> Gateway accepts, client receives ETIMEDOUT ---
  [Gateway HTTP] Inbound refund request #1: key=refkey_ord_6ad1197f0bb5353033b2c473
  [Gateway HTTP] GATEWAY DEBITED: Created refund rfnd_gateway_1 for ₹500
  [Gateway HTTP] Simulating network drop / ETIMEDOUT after gateway acceptance!
  [Gateway Lookup] payments.fetch called (visible=false)
  [Gateway Lookup] payments.fetchMultipleRefund called (visible=false)
  Worker 1 result: {
    success: false,
    status: 'refund_pending',
    error: 'ETIMEDOUT: Connection timed out awaiting response',
    message: 'Refund failed: ... State preserved as refund_pending for safe reconciliation.'
  }
  Order state after Attempt 1: paymentStatus=refund_pending, dispatchState=prepared, retryCount=1

--- Step 3: Recovery worker runs while gateway refund is NOT visible in read-only lookup ---
--- Step 4: Setting gateway idempotency retention to EXPIRED / UNKNOWN ---
  Running recoverUnresolvedRefunds...
  [Gateway Lookup] payments.fetch called (visible=false)
  [Gateway Lookup] payments.fetchMultipleRefund called (visible=false)
  [Gateway HTTP] Inbound refund request #2: key=refkey_ord_6ad1197f0bb5353033b2c473
  [Gateway HTTP] GATEWAY DEBITED: Created refund rfnd_gateway_2 for ₹500
  Recovery worker results: {"scanned":1,"recovered":1,"reconciled":0,"aborted":0,"failed":0,"results":[{"orderId":"6ad1197f0bb5353033b2c473","paymentStatus":"refund_pending","resultStatus":"processed","success":true,"reconciled":false,"message":"Refund of ₹500 processed successfully (Refund ID: rfnd_gateway_2)."}]}

--- Checking Outcomes ---
  Total Outbound HTTP Calls: 2
  Total Debits in Gateway Ledger: 2
  Gateway Ledger Items: [
    { refundId: 'rfnd_gateway_1', key: 'refkey_ord_6ad1197f0bb5353033b2c473', amount: 50000 },
    { refundId: 'rfnd_gateway_2', key: 'refkey_ord_6ad1197f0bb5353033b2c473', amount: 50000 }
  ]
  Final Order state: paymentStatus=refunded, dispatchState=confirmed

  CRITICAL AUDIT RESULT: Duplicate Gateway Debit Created? YES (UNSAFE!)

--- Step 5: Delayed worker resuming after lease expired ---
  Stale worker write matched count: 0 (0 expected due to lease fencing)
```

### C. Analysis of Why the Duplicate Debit Occurred
1. **Status Set to `pending` Instead of Quarantined:**
   In [backend/lib/refundService.js:731](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L731), when `executeOrderRefund` encounters a timeout, it transitions the order to `paymentStatus: "refund_pending"` and `refundDetails.status: "pending"`.
2. **Takeover Defense Bypassed:**
   In [backend/lib/refundService.js:427](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L427), the takeover defense checks:
   ```javascript
   if (isPreviousStatusProcessing && !isFullyRefunded) {
     throw new Error("Takeover aborted: previous refund attempt was in-flight at lease expiry. Queued for safe reconciliation.");
   }
   ```
   Because line 732 changed the status from `processing` to `pending`, `isPreviousStatusProcessing` evaluated to `false`.
3. **Recovery Worker Query Matches `pending`:**
   In [backend/lib/refundService.js:838](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L838), the recovery worker query explicitly selects `{ paymentStatus: "refund_pending", "refundDetails.status": { $ne: "processing" }, "refundDetails.retryCount": { $lt: maxRetries } }`.
4. **Second Outbound Call Dispatched:**
   The recovery worker acquired a new lease and called `executeRefund`. Because lookup had replication lag and gateway retention was unverified/expired, Razorpay executed a second refund.

---

## 6. Required Architectural Fixes (Phase 2A.22.2 Roadmap)

Before any production release or automated recovery can be enabled, the following remediations are required:

### Fix 1: Strict Quarantine of All Uncertain Outcomes in `refundService.js`
In `backend/lib/refundService.js`, lines 727–748 must be changed:
- When `executeRefund` returns `uncertain: true` (timeouts, connection resets, 5xx server errors), and post-error reconciliation does NOT verify the refund on the gateway, the order **MUST transition to `reconciliation_required`** with `dispatchState: "quarantined"` and `requiresManualReconciliation: true` (exactly as done in `verify/route.js`).
- It must **NEVER** set `dispatchState: "prepared"` or `refundDetails.status: "pending"` on an uncertain gateway outcome.

### Fix 2: HTTP 429 Classification
In `backend/lib/razorpayHttpClient.js`, HTTP 429 must be explicitly classified as `rateLimit: true`, `uncertain: true`, and quarantined rather than treated as a generic 4xx `definitiveError`.

### Fix 3: Automated Recovery Scheduler Permanently Disabled
The automated refund recovery scheduler (`/api/cron/refund-recovery`) must remain **permanently disabled (`CRON_REFUND_RECOVERY_ENABLED=false`)**. Quarantined operations must only be resolved via:
1. Verified inbound webhooks (`refund.processed`).
2. Read-only Superadmin reconciliation (`action: "reconcile_refund"`).

---

## 7. Compliance with Safety Constraints

- [x] All uncommitted working tree changes preserved.
- [x] No source code modified during this audit.
- [x] No `git commit`, `git add`, `git push`, or deployments executed.
- [x] Isolated local in-memory replica set and mocked gateway transport only.
- [x] Zero network traffic to port 4000, production environment, or MongoDB Atlas.
- [x] Automated recovery scheduler remains **DISABLED**.
- [x] Production deployment remains **STRICTLY BLOCKED**.
