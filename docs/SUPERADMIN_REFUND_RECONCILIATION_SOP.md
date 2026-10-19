# Standard Operating Procedure (SOP): Handling `reconciliation_required` Refunds

**Document Identifier:** SOP-OPS-042  
**Target System:** Pet Protocols Multi-Restaurant Ordering Platform  
**Applies To:** Platform Superadmin Operations  
**Status:** DRAFT / STRICT SAFETY REVISION  
**Effective Date:** October 15, 2026  
**Production Verdict:** BLOCKED (Automated recovery & uncertain manual redispatch prohibited)

---

## 1. Purpose and Scope

### 1.1 What is `reconciliation_required`?
In Pet Protocols, an order enters `paymentStatus: "reconciliation_required"` (with `refundDetails.requiresManualReconciliation = true`) whenever the system detects an **ambiguous or uncertain refund state** that cannot be automatically resolved without risking financial loss (duplicate payouts) or data corruption.

Specific code triggers:
1. **Takeover of In-Flight Processing Lease:** An automated recovery worker took over an expired 30-second processing lease, but gateway reconciliation reported **0 refunds**. Because a paused worker or in-flight HTTP request may still be executing, the takeover worker aborted rather than issuing a speculative duplicate refund ([`backend/lib/refundService.js:327–331`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L327-L331)).
2. **Ambiguous Multi-Restaurant Payment:** A payment covering multiple kitchen sub-orders received an external refund or webhook event lacking distinct operation key notes (`notes.opKey` or `notes.orderId`). The system refused to guess which kitchen was refunded and quarantined all un-refunded sibling orders ([`backend/app/api/payment/webhook/route.js:107–126`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/webhook/route.js#L107-L126)).
3. **Gateway Communication Uncertainty:** A call to `razorpay.payments.fetchMultipleRefund` timed out or returned an unexpected network error during reconciliation ([`backend/lib/refundService.js:370–397`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L370-L397)).
4. **Missing Payment Identification:** An order marked `paid` lacks a valid gateway `paymentId` ([`backend/lib/refundService.js:220–238`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L220-L238)).
5. **Gateway Rejection Notice:** Razorpay delivered a `refund.failed` webhook event indicating upstream gateway failure ([`backend/app/api/payment/webhook/route.js:232–238`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/webhook/route.js#L232-L238)).

### 1.2 State Distinctions: Pending vs. Confirmed vs. Reconciliation Required
| Payment Status | System Meaning | Automated Action Allowed? | Manual Redispatch Allowed? |
| :--- | :--- | :---: | :---: |
| `refund_pending` | Initial refund attempt encountered a recoverable transient error; order has remaining retries (`retryCount < 3`). | **YES** (by recovery worker) | **NO** (Scheduler managed) |
| `reconciliation_required` | Outcome is ambiguous, conflicting, or halted due to takeover defense. **Never automatically retried.** | **NO** | **STRICTLY PROHIBITED** while uncertainty persists |
| `refunded` | Gateway refund is authoritatively confirmed and recorded in database with valid `refundId`. | **NO** (Terminal state) | **NO** (Already resolved) |

---

## 2. Authorized Personnel & Role Realities

### 2.1 Supported Codebase Roles
Inspection of [`backend/models/User.js:65–69`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/models/User.js#L65-L69) and [`backend/lib/authMiddleware.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/authMiddleware.js) confirms the following roles exist:
- `superadmin`: Full platform-level access across all restaurants, orders, and payment endpoints.
- `restaurant_admin`: Scoped strictly to an individual restaurant branch.
- `staff`: Kitchen display, cashier, or delivery dispatch.
- `customer` / `user`: Storefront end-user.

### 2.2 Operational Authorization Rule
- **Only users authenticated with the `superadmin` role are authorized to investigate `reconciliation_required` orders.**
- Restaurant admins, branch managers, and kitchen staff have **zero authorization** to resolve or trigger refund operations.

### 2.3 Verification of the Manual Refund Endpoint (`PATCH /api/superadmin/orders`)
Source code inspection of [`backend/app/api/superadmin/orders/route.js:92–105`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/superadmin/orders/route.js#L92-L105) and [`backend/lib/refundService.js:264–429`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L264-L429) confirms the actual behavior:
1. **Authorization:** The endpoint enforces `requireSuperAdmin` via `backend/lib/authMiddleware.js`.
2. **Current Code Action:** When called with `{ orderId, action: "refund" }`, it directly invokes `executeOrderRefund({ orderId, reason, initiatedBy: "superadmin" })`.
3. **CRITICAL DEFECT — Bypasses Takeover Protection on `reconciliation_required` Orders:**
   - In `executeOrderRefund`, line 275 evaluates:
     `const isPreviousStatusProcessing = order.refundDetails?.status === "processing";`
   - For an order in `reconciliation_required`, `order.refundDetails.status` is `"reconciliation_required"` (not `"processing"`). Therefore, `isPreviousStatusProcessing` evaluates to **`false`**.
   - If the Razorpay dashboard or API currently returns 0 refunds (e.g. because an in-flight worker's request has not landed yet), line 327 takeover defense (`if (isPreviousStatusProcessing && !isFullyRefunded)`) **does NOT trigger**.
   - The execution passes down to line 421: `razorpay.payments.refund(...)` and **dispatches a live refund to Razorpay**.
4. **OPERATIONAL DIRECTIVE:**
   - **The `PATCH /api/superadmin/orders` endpoint is UNSAFE for orders in `reconciliation_required`.**
   - **Operators MUST NEVER invoke `PATCH /api/superadmin/orders` with `action: "refund"` on a `reconciliation_required` order while its original outcome remains uncertain.** Doing so directly causes duplicate external debits whenever an earlier request lands late.

> [!WARNING]
> **Implementation Gap — Missing Granular Finance Role & Dual Authorization:**  
> The codebase does **not** support a specialized `finance_admin` or `auditor` role. All administrative permissions collapse into the monolithic root `superadmin` role. There is no dual-custody ("four-eyes") approval mechanism in code. Granular RBAC and mandatory dual-authorization remain open engineering requirements.

---

## 3. Investigation Workflow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STEP 1: GATHER DATABASE EVIDENCE                     │
│  Extract: Order ID, paymentId, restaurant, totalAmount, opKey,         │
│           retryCount, lastAttemptAt, leaseToken, error message.        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│         STEP 2: ENFORCE UNCERTAINTY POLICY (NO TIME-BASED RETRY)       │
│  Elapsed time does NOT prove an in-flight worker cannot resume.        │
│  A zero-refund dashboard reading is NOT proof of safety.               │
│  Do NOT dispatch a second refund based on timeouts or empty snapshot.  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             STEP 3: INSPECT RAZORPAY MERCHANT DASHBOARD                │
│  1. Search paymentId in Razorpay Dashboard.                            │
│  2. Review "Refunds" list under payment entity.                        │
│  3. Verify refund amounts, notes.opKey, and notes.orderId.             │
│  4. Check Webhook Delivery logs for refund.processed / refund.failed.  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   STEP 4: EXECUTE DECISION PATH                        │
│       (A: Match Found | B: Zero/Uncertain | C: Ambiguous | D: Incident)│
└────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Gather Internal Evidence
Access the order record via MongoDB query or Superadmin API (`GET /api/superadmin/orders?search=<orderId>`). Record:
- **Order ID:** `order.orderId` (e.g. `ORD_...`) and internal `_id`
- **Payment ID:** `order.paymentId` (e.g. `pay_...`)
- **Restaurant / Kitchen:** `order.restaurant.name`
- **Refund Amount:** Exact amount in INR (`order.totalAmount`) and paise (`order.totalAmount * 100`)
- **Operation Key:** `order.refundDetails.opKey` (e.g. `refop_<order._id>`)
- **Current State:** `order.paymentStatus`, `order.refundDetails.status`, `order.refundDetails.error`
- **Timestamps:** `order.createdAt`, `order.refundDetails.lastAttemptAt`

### Step 2: Enforce the Uncertain-Outcome Policy (Anti-Redispatch Doctrine)
> [!CRITICAL]
> **STRICT PROHIBITION ON TIME-BASED OR SNAPSHOT-BASED REDISPATCH:**
> 1. **Elapsed Time Proves Nothing:** A 15-minute, 1-hour, or any other fixed waiting period does **not** prove that an in-flight worker thread, garbage collection pause, network socket retry, or gateway queue has terminated.
> 2. **Snapshot Emptiness Proves Nothing:** A dashboard showing zero refunds at one moment is **not** sufficient evidence that a second refund is safe. If a worker paused after its lease check or an outbound HTTP request was delayed in transit, the gateway may process the original request after your inspection.
> 3. **Never Redispatch Under Uncertainty:** Do **not** authorize, trigger, or execute a second refund dispatch solely because a timeout elapsed or no refund is currently visible.

### Step 3: Inspect Razorpay Merchant Dashboard & Webhook Logs
1. Log into the official **Razorpay Merchant Dashboard** (ensure production mode vs test mode matches the target environment).
2. Navigate to **Transactions** -> **Payments**.
3. Search for the exact `paymentId` recorded in Step 1.
4. Verify:
   - **Payment Status:** Must be `captured`.
   - **Captured Amount:** Total amount paid by customer.
   - **Amount Refunded:** Total aggregate paise refunded to date.
   - **Refunds Tab:** Inspect every individual refund entity (`rfnd_...`).
   - **Refund Notes:** Click each refund to inspect its metadata (`notes.opKey`, `notes.orderId`).
5. Navigate to **Settings** -> **Webhooks** -> View Recent Deliveries:
   - Filter by `payment_id` or event `refund.processed` / `refund.failed`.
   - Verify whether webhooks failed, timed out, or returned 4xx/5xx responses.

---

## 4. Decision Paths

### Path A: Reliable Gateway Refund Match Confirmed
**Condition:** Razorpay Dashboard shows an existing refund entity that is **reliably and unambiguously matched** to this sub-order:
- **For Single-Order Payments:** Matched by exact `notes.opKey`, `notes.orderId`, or verified 1:1 payment amount when no other sub-orders share `paymentId`.
- **For Multi-Restaurant Payments:** **MUST match `notes.opKey` or `notes.orderId`**. NEVER infer a sub-order refund from an aggregate payment total or unannotated partial amount.

**Action:** **DO NOT ISSUE ANOTHER REFUND.**
**Resolution:**
1. Copy the Gateway Refund ID (e.g., `rfnd_XYZ123456789`).
2. Confirm the refund amount matches `order.totalAmount`.
3. Reconcile the internal database record without invoking gateway APIs:
   - Align `paymentStatus = "refunded"`
   - Set `refundDetails.status = "processed"`
   - Set `refundDetails.refundId = "rfnd_XYZ..."`
   - Set `refundDetails.amount = order.totalAmount`
   - Set `refundDetails.reconciled = true`
   - Set `refundDetails.requiresManualReconciliation = false`
   - Set `refundDetails.error = null`
4. Record the resolution in the Superadmin reconciliation audit ledger.

---

### Path B: Zero Refunds or Uncertain Dispatch Outcome — Freeze & Escalate
**Condition:** Razorpay Dashboard shows zero refunds or an unconfirmed state, but an earlier refund attempt was initiated and its outcome remains unverified (e.g. takeover worker aborted on expired lease, background worker state is unknown, network timeout occurred).

**Action:** **STRICT PROHIBITION ON REDISPATCH. FREEZE AND ESCALATE.**
- **DO NOT** use `PATCH /api/superadmin/orders` with `action: "refund"`.
- **DO NOT** trigger a manual refund via the Razorpay Dashboard.
- Neither elapsed time nor a zero-refund snapshot proves that the original request will not land.

**Resolution:**
1. **Leave Order Blocked:** Keep order in `paymentStatus: "reconciliation_required"` and `refundDetails.requiresManualReconciliation = true`.
2. **Assemble Evidence Packet:**
   - Internal Order ID and internal MongoDB `_id`
   - Payment ID (`pay_...`)
   - Kitchen / Sub-Order identifier
   - Exact refund amount (INR and paise)
   - Operation Key (`opKey`)
   - Timestamp of last attempt (`lastAttemptAt`)
   - Error trace from `refundDetails.error`
3. **Escalate to Engineering & Finance:**
   - Engineering On-Call must inspect application server logs (PM2 / container / host logs) around `lastAttemptAt` to verify whether the worker process crashed, threw an unhandled exception before calling Razorpay, or hung at the network layer.
   - If server logs prove definitively that no outbound HTTP request was ever sent to Razorpay (e.g. process terminated before reaching line 421), Finance and Engineering leads may authorize an extraordinary manual gateway refund.
   - **If uncertainty cannot be resolved safely, leave the case blocked for authorized engineering and finance review.** Never dispatch speculatively.

---

### Path C: Conflicting Amounts, Multi-Restaurant Ambiguity, or Gateway Lookup Failure
**Condition:** Razorpay shows aggregate partial refunds, but notes do not attribute them to specific sub-orders; OR payment amounts do not balance; OR the Razorpay API/Dashboard is unreachable.

**Action:** **STOP IMMEDIATELY AND ESCALATE.**
- **Never infer a sub-order refund from an aggregate payment total.**
- **Resolution:**
  1. Do **not** issue a manual refund.
  2. Do **not** mark the order `refunded`.
  3. Leave the order in `reconciliation_required`.
  4. Escalate to the Lead System Architect and Finance Director with the incident evidence packet.

---

### Path D: Duplicate Gateway Refunds Detected
**Condition:** Razorpay Dashboard shows two or more refunds for the same sub-order (e.g., two ₹300 refunds on a single order).

**Action:** **FINANCIAL INCIDENT DECLARATION.**
**Resolution:**
1. Flag order as `INCIDENT: DUPLICATE_REFUND_ISSUED`.
2. Capture full audit screenshots of Razorpay transaction history.
3. Notify Finance Operations of merchant balance loss.
4. Contact customer support to determine whether customer bank reversal or clawback is required.

---

## 5. Audit Trail & Record Keeping

Whenever a Superadmin reviews or resolves a `reconciliation_required` order, the following evidence packet must be logged:

1. **Operator Identity:** Email address and User ID of the reviewing Superadmin.
2. **Review Timestamp:** Exact ISO-8601 timestamp of investigation.
3. **Internal Identifiers:** Order ID, Payment ID, Operation Key (`opKey`).
4. **Gateway Evidence:** Razorpay Refund ID (`rfnd_...`), Razorpay Payment Status, Screenshot of Dashboard refunds tab.
5. **Resolution Justification:** Clear explanation of whether Path A, B, C, or D was taken.

> [!WARNING]
> **Implementation Gap — Missing Dedicated Audit Log Table:**  
> The codebase currently updates `Order.refundDetails` directly and logs generic `initiatedBy: "superadmin"`. It does **not** persist the reviewing admin's specific email address, does **not** store evidence attachments, and lacks an immutable, append-only `PaymentAuditLog` collection. Operators must maintain an external incident log until database audit tables are implemented.

---

## 6. Customer Communication Templates

When customers inquire regarding orders in `reconciliation_required`, staff must use strictly non-committal, factual wording. **Never promise a specific delivery time (e.g., "within 2 hours") until the gateway outcome is confirmed.**

### Approved Template: Order Cancellation Under Investigation
> *"Thank you for contacting Pet Protocols Support. Your cancellation request for Order `[ORDER_ID]` has been received and your items have been cancelled. Our billing team is currently verifying the payment transaction with our banking gateway to ensure your refund is processed correctly. You will receive an automated confirmation email as soon as the gateway reconciliation is complete. We appreciate your patience while we confirm this with the bank."*

### Approved Template: Refund Confirmed
> *"We have confirmed that refund `[REFUND_ID]` for the amount of ₹`[AMOUNT]` was successfully processed with our payment partner. Depending on your bank's processing cycles, the credit will reflect in your original payment method within 5 to 7 business days."*

---

## 7. Current Behavior vs. Future Requirements

To maintain architectural integrity, current code capabilities must be strictly separated from operational guidance, unresolved risks, and future engineering requirements.

### 7.1 Code-Verified Behavior
1. **Document Lease Fencing:**
   - Atomic conditional update (`Order.updateOne({ _id, "refundDetails.leaseToken": leaseToken })`) prevents concurrent database record corruption between competing workers ([`backend/lib/refundService.js:435–450`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L435-L450)).
2. **Conservative Takeover Defense:**
   - If an automated worker attempts to take over an expired lease with status `"processing"` and the gateway returns 0 refunds, it aborts and marks the order `reconciliation_required` ([`backend/lib/refundService.js:327–331`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js#L327-L331)).
3. **Webhook Quarantine on Ambiguous Attribution:**
   - If an aggregate refund arrives on a multi-restaurant payment without unambiguous `notes.opKey` or `notes.orderId`, the webhook flags all un-refunded sibling orders as `reconciliation_required` ([`backend/app/api/payment/webhook/route.js:107–126`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/webhook/route.js#L107-L126)).
4. **Superadmin Order Route (`PATCH /api/superadmin/orders`):**
   - Requires authenticated `superadmin` session.
   - Calls `executeOrderRefund({ orderId, initiatedBy: "superadmin" })`.
   - **Does NOT protect `reconciliation_required` orders:** Because `status` is not `"processing"`, takeover defense is bypassed; if gateway shows 0 refunds, it will issue a second live gateway refund.

### 7.2 Operator Guidance (Operational Rules)
1. **Never Redispatch on Time or Snapshot:** Elapsed time or a zero-refund snapshot never justifies issuing another refund.
2. **Reconcile Without Calling Gateway:** When an existing refund is confirmed at Razorpay, update the database record directly. Never call a refund API endpoint to reconcile.
3. **Never Infer Sub-Order Attribution:** On multi-restaurant payments, never attribute an aggregate payment refund to a sub-order without matching `notes.opKey` or `notes.orderId`.
4. **Maintain External Audit Records:** Log all operator actions, user IDs, and evidence externally until database audit logging is built.

### 7.3 Unresolved Risks (The Outbound Gateway Race)
> [!CRITICAL]
> **DATABASE LEASE FENCING DOES NOT PREVENT OUTBOUND GATEWAY CALLS:**  
> Database lease fencing is purely internal to MongoDB. It guarantees that a stale worker cannot overwrite the database document after its lease expires. However, **MongoDB lease fencing has no control over outbound HTTP requests.**  
> If Worker A acquires a lease, passes the lease check at line 405, and pauses (due to an event-loop stall, container freeze, or socket delay), Worker B can take over the lease in MongoDB. When Worker A unfreezes, its execution resumes at line 421 and **dispatches an HTTP POST to Razorpay**. Because the Razorpay refund API does not support native idempotency keys, Razorpay executes the refund. If Worker B or an operator also dispatches a refund, **a duplicate payout occurs**.

### 7.4 Future Engineering Requirements Before Production Unblock
Automated online customer refunds and automated recovery must **remain blocked** in production until the following engineering requirements are fulfilled:

1. **Defensible External Gateway Idempotency:**
   - Either Razorpay provides official support for refund idempotency headers, OR card/UPI refund processing is routed through a payment processor supporting native `Idempotency-Key` headers (e.g. Stripe).
2. **Scheduler Deployment with Active Monitoring:**
   - Connect `POST /api/cron/refund-recovery` to an external scheduler (e.g. AWS EventBridge or Vercel Cron) with automated alerting on non-200 responses.
3. **Active Database Unique Index on Operation Key:**
   - Deploy partial unique index `{ "refundDetails.opKey": 1 }` with `{ unique: true, partialFilterExpression: { "refundDetails.opKey": { $type: "string" } } }` on production MongoDB replica set.
4. **Registered Webhook Subscriptions:**
   - Verify `https://<domain>/api/payment/webhook` is active in Razorpay Merchant Dashboard for `refund.processed` and `refund.failed` with `RAZORPAY_WEBHOOK_SECRET`.
5. **Superadmin Reconciliation Portal with Dual Authorization:**
   - Implement dedicated UI queue for `reconciliation_required` orders requiring dual sign-off (Superadmin + Finance Lead) and immutable database audit trail before any status transition.

---

## 8. Summary Matrix: Capabilities, Gaps, and Operator Constraints

| Area | Code-Verified Current Capability | Implementation Gap / Unresolved Risk | Operator Constraint |
| :--- | :--- | :--- | :--- |
| **RBAC Roles** | Supported roles: `superadmin`, `restaurant_admin`, `staff`, `customer` ([`User.js:67`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/models/User.js#L67)). | **No dedicated `finance_admin` role exists.** All permissions collapse into root superadmin. | Only authenticated `superadmin` may investigate. Dual sign-off must be coordinated manually. |
| **Manual Refund API** | `PATCH /api/superadmin/orders` accepts `{ action: "refund" }` ([`orders/route.js:92`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/superadmin/orders/route.js#L92)). | **UNSAFE for `reconciliation_required`:** Bypasses takeover defense; executes second live refund if gateway shows 0 refunds. | **STRICTLY PROHIBITED** from calling this endpoint on `reconciliation_required` orders. |
| **Audit Logging** | `Order.refundDetails` records `refundId`, `status`, `amount`, `lastAttemptAt`, and generic `initiatedBy: "superadmin"`. | **Lacks append-only audit trail.** Does not persist reviewing admin ID, operator email, review notes, or gateway screenshots. | Operators must manually record investigation evidence in external ledger. |
| **Fencing & Safety** | Document lease fencing prevents DB record overwrite by stale workers. Takeover aborts on 0 gateway refunds. | **Does not prevent outbound HTTP requests.** Razorpay lacks refund idempotency keys. Outbound gateway race remains open. | Never dispatch a second refund based on elapsed time or zero-refund dashboard snapshot. |
| **Recovery Scheduler** | Route `/api/cron/refund-recovery` supports GET and POST with constant-time Bearer token authentication. | **No scheduler is running.** Zero cron triggers exist in repository or hosting environment. | Automated recovery remains inactive until scheduler infrastructure is provisioned. |

---

## 9. Source Files Inspected

- [`backend/models/User.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/models/User.js) (Role enums, staff fields, address schemas)
- [`backend/models/Order.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/models/Order.js) (`refundDetails` schema, payment statuses, indexes)
- [`backend/lib/refundService.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/refundService.js) (`executeOrderRefund`, lease fencing, takeover defense, recovery worker)
- [`backend/app/api/superadmin/orders/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/superadmin/orders/route.js) (Superadmin GET listing and PATCH refund action)
- [`backend/app/api/cron/refund-recovery/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/cron/refund-recovery/route.js) (Cron endpoint, GET/POST dispatcher, timing-safe authentication)
- [`backend/app/api/payment/webhook/route.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/app/api/payment/webhook/route.js) (Webhook signature verification, multi-restaurant attribution)
- [`frontend-superadmin/components/orders/OrdersManager.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/frontend-superadmin/components/orders/OrdersManager.js) (Superadmin UI order listing and modal controls)
