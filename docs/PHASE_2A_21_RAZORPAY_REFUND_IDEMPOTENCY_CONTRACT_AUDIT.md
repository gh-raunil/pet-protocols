# Phase 2A.21 — Razorpay Refund Idempotency Contract Verification Audit

**Status:** COMPLETE (READ-ONLY INVESTIGATION)  
**Execution Context:** Independent contract investigation; authoritative Razorpay documentation inspection; local SDK code audit  
**Production Verdict:** **BLOCKED** (Production release remains blocked; automated recovery scheduler remains strictly disabled)  
**Date:** 2026-10-15  

---

## 1. Executive Verdict & Summary

### Verdict: PRODUCTION RELEASE BLOCKED — AUTOMATED RECOVERY DISABLED

Following a rigorous investigation of current, authoritative Razorpay API documentation and the official Node.js SDK source code (`razorpay` npm v2.9.8), the operational status of payment refunds is evaluated as follows:

1. **Official Gateway Support Confirmed:**  
   Razorpay officially supports caller-supplied idempotency keys on the standard payment refund endpoint (`POST /v1/payments/:id/refund`) via the custom HTTP header **`X-Refund-Idempotency`**.
2. **Current SDK Inability Verified:**  
   The official `razorpay` Node.js SDK package (`razorpay.payments.refund()`) **does not expose any parameter or option to pass custom HTTP headers**. Furthermore, the SDK's internal client actively filters and strips any custom headers, only permitting `X-Razorpay-Account` and `Content-Type`. Passing operation keys inside `notes: { opKey }` (as currently done in [`backend/lib/refundService.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L455-L463) and [`backend/app/api/payment/verify/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/verify/route.js#L331-L340)) only records descriptive metadata on the refund entity and **does NOT trigger gateway-level deduplication**.
3. **Key Retention Period (TTL) is Unverified & Undocumented:**  
   Authoritative Razorpay documentation defines key syntax, collision behavior, and concurrency conflicts, but **does not publish an official retention window (TTL)**. Relying on the gateway to deduplicate retried refunds beyond transient network retries (e.g. across multiple days) is unverified and unsafe.
4. **Direct HTTP Alone Does Not Solve Distributed Worker Hazards:**  
   Replacing the SDK with a direct HTTP client that passes `X-Refund-Idempotency` is necessary, but **not sufficient on its own** to guarantee exactly-once execution. A distributed client remains vulnerable to worker crashes, garbage collection pauses, delayed process resumption, and network partitions.
5. **Mandatory Operational Posture:**  
   Until a direct HTTP client and durable single-dispatcher architecture are implemented and verified, **automated redispatch must remain permanently DISABLED**, and production release remains **STRICTLY BLOCKED**. All uncertain outcomes must continue to be quarantined in `reconciliation_required` and resolved exclusively via verified webhooks and read-only reconciliation.

---

## 2. Task 1 — Authoritative Gateway Contract Verification

### A. Authoritative Documentation Sources & Canonical URLs

Authoritative documentation was retrieved and verified directly from Razorpay's API documentation portal:

| Documentation Section | Canonical URL | Verified API Endpoint |
| :--- | :--- | :--- |
| **Normal Refunds (Idempotent Request)** | [`https://razorpay.com/docs/api/refunds/#create-a-normal-refund-idempotent-request`](https://razorpay.com/docs/api/refunds/#create-a-normal-refund-idempotent-request) | `POST /v1/payments/:id/refund` |
| **Instant Refunds (Idempotent Request)** | [`https://razorpay.com/docs/api/refunds/#create-an-instant-refund-idempotent-request`](https://razorpay.com/docs/api/refunds/#create-an-instant-refund-idempotent-request) | `POST /v1/payments/:id/refund` |
| **Refunds API Reference & Schema** | [`https://razorpay.com/docs/api/refunds/`](https://razorpay.com/docs/api/refunds/) | `POST /v1/payments/:id/refund` |
| **LLM / Developer Markdown Source** | [`https://razorpay.com/docs/build/llm-docs/api/refunds/normal-refunds-idempotent.md`](https://razorpay.com/docs/build/llm-docs/api/refunds/normal-refunds-idempotent.md) | `POST /v1/payments/:id/refund` |

---

### B. Distinction: Standard Payment Gateway Refunds vs RazorpayX Payouts

A critical distinction exists between Razorpay's retail Payment Gateway (PG) and its business banking platform (RazorpayX):

* **Razorpay Payment Gateway Refunds (`POST /v1/payments/:id/refund`):**  
  * **Header Name:** `X-Refund-Idempotency`  
  * **Entity:** `refund`  
  * **Purpose:** Reversing captured customer payments back to the original funding source (Card, UPI, Netbanking).
* **RazorpayX Business Banking Payouts (`POST /v1/payouts`):**  
  * **Header Name:** `X-Payout-Idempotency`  
  * **Entity:** `payout`  
  * **Purpose:** Disbursing funds from a current account to vendors or bank accounts.

> [!CAUTION]
> **Do not infer refund idempotency support from RazorpayX documentation.** Sending `X-Payout-Idempotency` to `POST /v1/payments/:id/refund` is ignored by the Payment Gateway, completely defeating deduplication. Standard payment refunds strictly require `X-Refund-Idempotency`.

---

### C. Confirmed vs Unverified Gateway Capabilities

| Capability / Behavior | Status | Official Documentation Passages & Contract Specifications |
| :--- | :---: | :--- |
| **Caller-Supplied Key Support** | **CONFIRMED** | *"To make a normal refund request idempotent, add the header `X-Refund-Idempotency` to the request and pass an idempotency key against it."* |
| **Exact Header Name** | **CONFIRMED** | `X-Refund-Idempotency` |
| **Key Length & Allowed Characters** | **CONFIRMED** | *"The idempotency key must be at least 10 character long and can contain alphabets, numbers, hyphens and underscores only. For example, `550e8400-e29b-41d4-a716-446655440000`."*<br>Failing this returns HTTP 400: *"The idempotency key must be at least 10 characters long"* or *"The idempotency key must only contain alphanumeric characters, underscores, and hyphens"*. |
| **Identical Payload Deduplication** | **CONFIRMED** | *"When retrying a transaction using the same idempotency key without risk of double-refund or duplication... Razorpay will recognize the duplicate request and return the original response/status rather than processing a second refund."* |
| **Mismatched Payload Behavior** | **CONFIRMED** | *"When retrying a request, the request body must be the same as the first request for idempotency to work. A different payload will be rejected as a `BAD_REQUEST`."*<br>Error: HTTP 400 `BAD_REQUEST_ERROR` / HTTP 409: *"Different request with the same idempotency key has already been processed."* |
| **Payload Hash Verification** | **CONFIRMED** | Error documentation confirms internal hashing: *"Internal server error - Failed to parse request body: The server failed to parse the request body to generate the request hash."* |
| **In-Flight Concurrent Requests** | **CONFIRMED** | *"If a request is received while a prior request is still being processed, the system will return a 409 Conflict status code. You may retry the request upon receiving this response."*<br>Error description: *"Another request with the same idempotency key is still in progress. A refund request with the same idempotency key is currently being processed and has not yet returned a response."* |
| **Key Scope** | **PARTIALLY CONFIRMED** | Scoped to the authenticated merchant account and payment ID. Documented error: *"Merchant id not found in authentication: The request contains an idempotency key but the merchant authentication is invalid or missing."* Whether keys are globally unique per merchant or per-payment is **not formally defined**. |
| **Key Retention Period (TTL)** | **UNVERIFIED** | **No official retention period is documented.** Razorpay docs state idempotency is intended for transient network retries (*"due to network downtimes, you may not get a response from our servers"*). No TTL (e.g., 24 hours, 7 days, permanent) is guaranteed in official gateway documentation. |
| **Timeout Recovery Contract** | **CONFIRMED** | Re-sending the identical request with the same `X-Refund-Idempotency` header after a network timeout safely returns the completed refund record (if successful) or HTTP 409 (if still processing), preventing duplicate debit. |

---

### D. Official Request Example

```bash
curl -u [YOUR_KEY_ID]:[YOUR_KEY_SECRET] \
  -X POST https://api.razorpay.com/v1/payments/pay_29QQoUBi66xm2f/refund \
  -H "Content-Type: application/json" \
  -H "X-Refund-Idempotency: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "amount": 500100,
    "speed": "normal",
    "receipt": "Receipt No. 31",
    "notes": {
      "opKey": "refop_ord_603d2f1b4f1c2b001f8a9e01",
      "reason": "customer_cancellation"
    }
  }'
```

---

## 3. Local SDK Source Code Audit (`razorpay` npm v2.9.8)

An inspection of the local `node_modules/razorpay` package confirms that the official SDK cannot engage Razorpay's refund idempotency mechanism:

### 1. `razorpay.payments.refund()` Ignores Custom Headers
In [`backend/node_modules/razorpay/dist/resources/payments.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/node_modules/razorpay/dist/resources/payments.js#L122-L132):
```javascript
refund: function refund(paymentId) {
  var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var callback = arguments.length > 2 ? arguments[2] : undefined;
  if (!paymentId) {
    throw new Error('`payment_id` is mandatory');
  }
  return api.post({
    url: "".concat(BASE_URL, "/").concat(paymentId, "/refund"),
    data: params
  }, callback);
}
```
* The method signature only accepts `(paymentId, params, callback)`.
* `params` is serialized strictly into `data` (the JSON body). There is no parameter slot for custom request headers.

### 2. Client-Level Headers Are Hardcoded & Stripped
In [`backend/node_modules/razorpay/dist/api.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/node_modules/razorpay/dist/api.js#L16-L31):
```javascript
var allowedHeaders = {
  "X-Razorpay-Account": "",
  "Content-Type": "application/json"
};
function getValidHeaders(headers) {
  var result = {};
  if (!isNonNullObject(headers)) {
    return result;
  }
  return Object.keys(headers).reduce(function (result, headerName) {
    if (allowedHeaders.hasOwnProperty(headerName)) {
      result[headerName] = headers[headerName];
    }
    return result;
  }, result);
}
```
* Even if custom headers are passed to the `Razorpay` constructor options, `getValidHeaders()` explicitly drops all headers that are not `X-Razorpay-Account` or `Content-Type`.
* `api.post()` accepts `{ url, data }` and does not accept per-request headers.

### 3. Conclusion on Current Codebase
The existing calls in [`backend/lib/refundService.js:455`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L455) and [`backend/app/api/payment/verify/route.js:331`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/verify/route.js#L331) do **NOT** send `X-Refund-Idempotency`. Their reliance on `notes.opKey` provides database-level attribution and webhook matching, but **offers zero deduplication protection at Razorpay's gateway**.

---

## 4. Task 2 — Architectural Comparison of Integration Options

| Strategy | Gateway Deduplication Guarantee | Application-Tier Guarantee | Vulnerability / Limitations | Recommended Use |
| :--- | :--- | :--- | :--- | :--- |
| **Option 1: Existing Razorpay Node.js SDK Calls** | **NONE.** Header is stripped and unsupported. | Weak. Database lease fencing protects DB state, but cannot stop in-flight or retried HTTP requests. | • High risk of double payouts on network retry.<br>• Stale delayed workers execute duplicates.<br>• `notes.opKey` is purely informational metadata. | **REJECTED.** Unsafe for production redispatch. |
| **Option 2: Direct HTTP Client with `X-Refund-Idempotency`** | **STRONG** (for transient retries). Gateway maps identical requests to the initial transaction; rejects concurrent attempts with 409. | None without transactional journaling. | • Does not solve caller crashes or database update failures.<br>• Unretried timed-out requests remain uncertain.<br>• Gateway key retention period is undocumented.<br>• Payload mutation yields HTTP 400. | **REQUIRED COMPONENT**, but insufficient in isolation. |
| **Option 3: Durable Single-Dispatcher with Quarantine** | **MAXIMAL** when paired with Option 2 direct HTTP client. | **MAXIMAL.** Only one dispatcher process handles an order's refund at any time; deterministic keys generated and journaled prior to network I/O. | • Uncertain outcomes require asynchronous resolution (webhooks or manual Superadmin SOP).<br>• Cannot provide instant synchronous confirmation if gateway times out. | **STRONGLY RECOMMENDED ARCHITECTURE.** |
| **Option 4: Batch Refunds (CSV/XLSX)** | High (processed sequentially in Razorpay's backend queue). | Not real-time. Minimum 70-minute processing delay. | • Incompatible with instant customer cancellations, order verification failures, or automated checkout rollback. | **REJECTED** for transaction lifecycle management. |

---

## 5. Detailed Breakdown: Why Direct HTTP Alone Is Insufficient

A direct HTTP client sending `X-Refund-Idempotency` solves the **immediate network retry problem**, but does not eliminate the distributed systems hazards of payment gateways:

```
[ Worker A ]                           [ Razorpay Gateway ]                  [ MongoDB ]
     │                                          │                                 │
     ├─ 1. Passes Lease Check ──────────────────┼─────────────────────────────────┤
     │                                          │                                 │
     ├─ 2. Issues HTTP POST (Idempotency Key) ─►│                                 │
     │     (HTTP request in transit...)         │                                 │
     │                                          ├─ 3. Processes Refund (₹500)     │
     │                                          │                                 │
     X 4. WORKER CRASHES / NETWORK TIMES OUT    │                                 │
     (Response lost; worker never writes DB)    │                                 │
                                                │                                 │
[ Worker B / Recovery ]                         │                                 │
     │                                          │                                 │
     ├─ 5. Takes over expired lease ────────────┼─────────────────────────────────┤
     │                                          │                                 │
     ? 6. What should Worker B do?              │                                 │
```

1. **If Worker B generates a NEW idempotency key:**  
   Razorpay treats it as a second independent refund and debits the merchant account twice.
2. **If Worker B re-uses the persisted idempotency key:**  
   Razorpay returns the existing refund record. However, if Worker B was triggered 48 hours later and Razorpay's undocumented key retention has expired, Razorpay may process a duplicate refund.
3. **The Delayed Worker Problem (Test 7B Race):**  
   If Worker A was not dead, but merely paused (e.g. event-loop freeze or long GC pause), Worker B might query the gateway *before* Worker A's paused request hits Razorpay. Worker B sees 0 refunds. If Worker B then dispatches, two requests with either different keys or colliding keys fly across the network.

**Conclusion:** Direct HTTP with `X-Refund-Idempotency` protects against *network retransmissions*, but **system safety fundamentally requires quarantining all uncertain outcomes into `reconciliation_required` and resolving them through read-only reconciliation or verified webhooks**.

---

## 6. Task 3 — Concrete Safe Release Design & Safety Criteria

To achieve production safety without making unsupported "exactly-once" claims, the architecture must adhere to five mandatory rules:

### Rule 1 — Zero Blind Redispatch
* When an external refund request encounters a network drop, timeout, or HTTP 5xx error, the refund service must **NEVER** immediately re-issue a refund request or attempt automated redispatch.
* The order or payment intent must be immediately transitioned to:
  ```json
  {
    "paymentStatus": "reconciliation_required",
    "refundDetails.status": "reconciliation_required",
    "refundDetails.requiresManualReconciliation": true
  }
  ```
* Automated cron recovery workers must strictly query `status: { $ne: "reconciliation_required" }`.

### Rule 2 — Strictly Read-Only Reconciliation
* Quarantined orders can only be cleared by [`reconcileOrderRefund`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L739-L912) or [`reconcilePaymentIntentRefund`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L919-L1060).
* Reconciliation queries `GET /v1/payments/:id/refunds` and validates:
  1. `refund.payment_id === expectedPaymentId`
  2. `refund.amount === expectedAmountPaise`
  3. `refund.currency === "INR"`
  4. Sibling multi-order attribution: `refund.notes.opKey === expectedOpKey || refund.notes.orderId === expectedOrderId`
* Under no circumstances does reconciliation call `POST /v1/payments/:id/refund`.

### Rule 3 — Asynchronous Webhook Resolution & Monotonicity
* Inbound webhooks (`refund.processed` / `refund.failed`) are cryptographically verified using HMAC-SHA256 over raw request text.
* Replay events are acknowledged with HTTP 200 without executing duplicate state changes.
* State transitions are strictly monotonic: an order or payment intent in `refunded` can never be regressed to `failed` or `reconciliation_required` by delayed out-of-order webhook deliveries.

### Rule 4 — UI Retry Action Lockout
* The User, Restaurant Admin, and Superadmin frontends must inspect `requiresManualReconciliation` and `paymentStatus === "reconciliation_required"`.
* When true, all cancellation, retry, and refund buttons must be **disabled and hidden**.
* The UI must display an explicit status badge:  
  `"Manual Reconciliation Required — Automatic refund redispatch disabled to prevent duplicate payments."`
* The Superadmin order panel must offer only two actions for quarantined orders:
  1. **"Run Read-Only Reconciliation"** (triggers read-only gateway inspection).
  2. **"Mark as Reconciled"** (manual administrative override per SOP).
  * No "Retry Refund" or "Force Refund" button may exist.

### Rule 5 — Durable Journaling of Gateway Dispatch Keys
* When migrating to direct HTTP calls, the deterministic idempotency key (`idempotencyKey`) must be generated and persisted to MongoDB in state `processing` **before** the HTTP request is initiated.
* If a retry occurs, the exact same persisted `idempotencyKey` and identical payload body must be reused, preventing payload mismatch errors (`BAD_REQUEST_ERROR`) and duplicate debits.

---

## 7. Remaining Operational & Architectural Decisions

Before moving to implementation, the following decisions must be formalized:

1. **HTTP Client Implementation Approach:**  
   * *Decision:* Create a standalone, lightweight wrapper `RazorpayHttpClient` in `backend/lib/razorpayHttpClient.js` using Node.js native `fetch` or `axios` with HTTP Basic Authentication (`key_id:key_secret`).  
   * *Action:* Replace SDK refund calls with `RazorpayHttpClient.createRefund({ paymentId, amount, idempotencyKey, notes, speed })`.
2. **Key Generation Strategy:**  
   * *Decision:* Standardize on Version 4 UUIDs prefixed with entity type and database ID, e.g., `ref_ord_<mongoId>_<epoch>` or standard RFC 4122 UUID v4 (`550e8400-e29b-41d4-a716-446655440000`). Key must satisfy Razorpay's constraint: $\ge 10$ characters, `[a-zA-Z0-9_-]`.
3. **Superadmin Manual Reconciliation SOP Integration:**  
   * *Decision:* Formalize the operational protocol in [`docs/SUPERADMIN_REFUND_RECONCILIATION_SOP.md`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/docs/SUPERADMIN_REFUND_RECONCILIATION_SOP.md) as the required procedure whenever an order remains in `reconciliation_required` for more than 15 minutes without webhook resolution.
4. **Automated Recovery Scheduler Posture:**  
   * *Decision:* Keep [`backend/app/api/cron/refund-recovery/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/cron/refund-recovery/route.js) permanently disabled in production until direct HTTP idempotency and single-dispatcher queuing are certified.

---

## 8. Recommended Next Implementation Phase (Phase 2A.22)

Phase 2A.22 should implement the low-level HTTP transport and journaling layer:

1. **`backend/lib/razorpayHttpClient.js`**: Implement direct HTTP client using native `fetch` with Basic Auth and explicit `X-Refund-Idempotency` header forwarding.
2. **Schema Update**: Add `refundDetails.idempotencyKey` to `Order` and `PaymentIntent` schemas.
3. **Refactor Call Sites**: Update [`backend/lib/refundService.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js) and [`backend/app/api/payment/verify/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/verify/route.js) to dispatch via `RazorpayHttpClient` using the persisted key.
4. **Unit & Staging Simulation**: Add mock tests in `test_p1_refund_suite.mjs` verifying that retried HTTP calls transmit the identical `X-Refund-Idempotency` header and that HTTP 409 Conflict is handled gracefully without duplicate payouts.

---

## 9. Production Release Gates

Production release is currently **BLOCKED**. The following gates must all pass before production deployment can be authorized:

* [x] **Gate 1: Gateway Contract Verification (Phase 2A.21)** — Authoritative support for `X-Refund-Idempotency` verified; SDK limitation documented.
* [ ] **Gate 2: Direct HTTP Client Implementation (Phase 2A.22)** — Native client with `X-Refund-Idempotency` implemented and unit tested.
* [ ] **Gate 3: Durable Dispatch Journaling (Phase 2A.22)** — Idempotency key persisted before external network I/O.
* [ ] **Gate 4: UI Retry Action Lockout (Phase 2A.23)** — Verified lockout across User, Restaurant, and Superadmin frontends.
* [ ] **Gate 5: End-to-End Simulation Suite** — 100% pass rate on `test_p1_refund_suite.mjs` including crash recovery, stale worker pauses, duplicate webhooks, and out-of-order events.
* [ ] **Gate 6: Superadmin Operations Sign-Off** — Superadmin SOP approved for manual reconciliation.

**CURRENT STATUS: PRODUCTION BLOCKED. AUTOMATED RECOVERY DISABLED.**
