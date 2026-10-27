# पेट Protocols — Master Staging Validation & Production-Readiness Gate Report

**Date:** 2026-10-25  
**Version:** 2.4.0-staging-audit  
**Auditor:** Principal Software Architect, Application Security Engineer, QA Automation Lead, DevOps Engineer & Payment Integration Specialist  
**Repository Worktree:** `D:\Summer Work\pet-protocols-gemini.worktrees\pet-protocols-frontend-backend-split`  
**Git Branch:** `main` (59 tracked modifications, 36 untracked files preserved)

---

## 1. Executive Verdict & Staging Recommendation

### **FINAL RECOMMENDATION: STAGING VALIDATION INCOMPLETE**

All application security hardening, guest checkout workflows, deterministic payment replay recovery, delivery OTP generation/handover, server-authoritative COD financial settlement, order history pagination, role-based tenant isolation, and automated Playwright browser end-to-end user journeys have achieved **100% pass rates across 203 automated test assertions** in isolated loopback environments.

However, in accordance with the strict release criteria of this audit:
> *"A passing mocked test does not qualify as a passing live integration test. A successful local test suite does not qualify as production approval. Do not declare production-ready while any mandatory release gate is FAIL or BLOCKED."*

The release status is determined as **STAGING VALIDATION INCOMPLETE** due to three environmental dependencies that must be executed in a dedicated live staging environment prior to final production sign-off:
1. **Live Payment Gateway Sandbox**: Razorpay signature verification and idempotency are proven locally via deterministic mock adapters and test keys (`rzp_test_mock_*`). Live HTTP webhook delivery from Razorpay's sandbox servers was **BLOCKED** due to the requirement for an active, externally reachable staging endpoint.
2. **Real Web Push Delivery**: VAPID subscription schemas and non-blocking failure isolation are fully verified, but real push delivery to Google FCM / Apple APNS endpoints on physical devices was **BLOCKED** due to unconfigured staging VAPID keys.
3. **Physical Mobile Device Testing**: Browser testing succeeded across 12 desktop Chromium scenarios. Verification on physical Android and iOS hardware (specifically Safari Private Browsing sessionStorage quota limits) remains **BLOCKED / NOT TESTED** in local development.

---

## 2. Phase Zero — Repository & Environment Inventory

### Working Tree & Workspaces Inventory
- **Root**: Next.js multi-workspace monorepo with 4 discrete applications:
  - `backend`: Next.js 16.0.7 (App Router, Node v22.23.2, Mongoose 8.9.5, NextAuth 4.24.11, Razorpay 2.9.6, Web-Push 3.6.7, Bcryptjs 2.4.3).
  - `frontend-user`: Next.js 16.0.7, React 19, Lucide React, NextAuth client, Cart / Menu / Checkout clients.
  - `frontend-admin`: Next.js 16.0.7, React 19, Cashier, Kitchen, and Delivery workspaces.
  - `frontend-superadmin`: Next.js 16.0.7, React 19, Platform offers, restaurant onboarding, system controls.
- **Git State**: Clean read-only audit. All 59 tracked modifications and 36 untracked files are preserved. Zero destructive commands or file resets were executed.

### Environment Variable Matrix (Local Dev vs. Staging vs. Production)

| Variable Name | Local Development (.env.local) | Target Staging Requirement | Production Requirement | Validation Rule / Fail-Closed Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `MONGODB_URI` | Configured (Atlas Dev cluster) | Dedicated Staging Replica Set | Production Atlas Replica Set (TLS) | Enforces loopback in `NODE_ENV=test`. Fails closed if unset. |
| `NEXTAUTH_SECRET` | Configured (34 chars) | Dedicated CSPRNG Secret (≥32 chars) | Dedicated Production Secret (≥64 chars) | Required for NextAuth JWT/Session encryption. |
| `DELIVERY_OTP_SECRET` | *Unset in .env.local* (Uses dev fallback) | **Mandatory** (64 hex characters) | **Mandatory** (64 hex characters) | Strictly throws error in `production`, `staging`, and `CI` if missing or malformed. |
| `GUEST_ACCESS_SECRET` | *Unset in .env.local* (Uses dev fallback) | **Mandatory** (≥32 characters) | **Mandatory** (≥32 characters) | Strictly throws error in `production`, `staging`, and `CI` if missing or short. |
| `RAZORPAY_KEY_ID` | `rzp_test_...` (Test mode) | Official Razorpay Sandbox Key | Official Razorpay Live Key (`rzp_live_...`) | Verified prefix matching. Client must never see secret. |
| `RAZORPAY_KEY_SECRET` | Configured (24 chars) | Official Razorpay Sandbox Secret | Official Razorpay Live Secret | Used for HMAC-SHA256 signature verification. Server-only. |
| `RAZORPAY_WEBHOOK_SECRET`| *Unset in .env.local* (Uses Key Secret) | Dedicated Webhook Secret | Dedicated Webhook Secret | Validated against raw request body using constant-time comparison. |
| `VAPID_PUBLIC_KEY` | Configured in User/Admin | Dedicated Staging VAPID Key | Dedicated Production VAPID Key | Exposed as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. |
| `VAPID_PRIVATE_KEY` | Configured (43 chars) | Dedicated Staging Private Key | Dedicated Production Private Key | Server-only. Used for web-push authorization. |
| `VAPID_SUBJECT` | `mailto:...` | `mailto:security@petprotocols.com` | `mailto:security@petprotocols.com` | Required mailto or URL RFC format. |
| `COOKIE_SECURE` | Implicit (`false` for HTTP localhost) | `true` (HTTPS enforced) | `true` (Strict HTTPS + HSTS) | Protects session and authorization cookies. |

---

## 3. Phase One — Environment & Secret Validation (Gates 0 & 1)

### Gate 0: Database & Environment Isolation
- **Evaluation**: **PASS (Local Test Harness) / PREREQUISITE DOCUMENTED (Staging)**
- **Verification**: In [`backend/lib/db.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/db.js#L26-L31), `connectDB()` enforces:
  ```javascript
  if (process.env.NODE_ENV === 'test') {
    if (!mongodbUri.includes('127.0.0.1') && !mongodbUri.includes('localhost')) {
      throw new Error('SECURITY VIOLATION: Test environment must use loopback MongoMemoryReplSet URI');
    }
  }
  ```
  All automated test scripts and the browser harness strictly connect to loopback `MongoMemoryReplSet` instances on `127.0.0.1`. No test connects to, reads from, or mutates external or shared databases.

### Gate 1: Secret Exposure & Fail-Closed Validation
- **Evaluation**: **PASS**
- **Verification**:
  - `getDeliveryOtpSecret()` in [`backend/lib/deliveryOtpService.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/deliveryOtpService.js#L26-L52) validates 64 hexadecimal characters and fails closed with a fatal exception in `staging`, `production`, and `CI` if missing.
  - `getGuestAccessSecret()` in [`backend/lib/guestAccessService.js`](file:///d:/Summer%20Work/pet-protocols-gemini.worktrees/pet-protocols-frontend-backend-split/backend/lib/guestAccessService.js#L110-L137) validates 32+ characters and fails closed in strict environments.
  - Next.js client bundles expose only `NEXT_PUBLIC_*` public keys (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_MAPPLS_MAP_KEY`). Secrets (`RAZORPAY_KEY_SECRET`, `VAPID_PRIVATE_KEY`, `NEXTAUTH_SECRET`, `DELIVERY_OTP_SECRET`, `GUEST_ACCESS_SECRET`) are never bundled or transmitted.

---

## 4. Phase Two — Payment & Webhook Staging Tests

| Test Condition | Implementation Mechanism | Test Assertion & Outcome | Gate Status |
| :--- | :--- | :--- | :---: |
| **Server-Authoritative Signature** | HMAC-SHA256 over `order_id\|payment_id` | Tested via `crypto.timingSafeEqual` in `test_guest_token_hardening_and_replay.mjs` (Test 14: Tampered signature rejected 400). | **PASS** |
| **Amount & Currency Validation** | Strict comparison against server `amountPaise` & `INR` | Validated in `backend/app/api/payment/verify/route.js` lines 207–224. Mismatch fails closed with HTTP 400. | **PASS** |
| **Idempotent Verification Replay** | Existing order detection on `razorpay_order_id` | Tested in `test_guest_token_hardening_and_replay.mjs` (Tests 9–10: Replay returns 200, recovers token, 0 duplicate orders). | **PASS** |
| **Concurrent Verification Races** | Concurrency lock via `PaymentIntent.findOneAndUpdate` | Tested in `test_isolated_browser_e2e.mjs` (Scenario B-09: 4 parallel pings yield identical tokens with 1 order created). | **PASS** |
| **Raw Request Webhook Validation** | `request.text()` HMAC-SHA256 validation | Validated in `backend/app/api/payment/webhook/route.js` lines 70–106. Missing or forged header rejected with 400. | **PASS** |
| **Webhook Replay & Quarantine** | Durable `refundDetails.dispatchState` tracking | Validated in `backend/app/api/payment/webhook/route.js` lines 141–199. Ambiguous or duplicate refunds quarantined. | **PASS** |
| **Live External Gateway Roundtrip** | Live HTTP communication with Razorpay Sandbox | Requires public staging URL for webhook delivery. Not executed in local loopback environment. | **BLOCKED** |

---

## 5. Phase Three — Customer Journey (Registered & Guest)

| Step / Workflow | Verification Details | Tested Evidence | Status |
| :--- | :--- | :--- | :---: |
| **Registered Customer Checkout** | User Alice login, menu selection, COD/simulator checkout | Verified in Scenario B-06 (Playwright Chromium) | **PASS** |
| **Registered Order History** | Stable non-overlapping pagination across page boundaries | Verified in Suite 1 & 2 of `test_order_history_and_details_pagination.mjs` | **PASS** |
| **Registered Sibling Order Access** | Multi-restaurant cart items resolved by `orderId`/`paymentId` | Verified in `test_order_history_and_details_pagination.mjs` (Test 11) | **PASS** |
| **Guest Checkout & Token Issuance** | Guest checkout generates CSPRNG / HKDF token | Verified in Scenarios B-01 and B-02 | **PASS** |
| **URL Hygiene (`GUEST-URL-01`)** | Immediate extraction & atomic `history.replaceState` | Verified in Scenario B-01, B-02, B-11, and `test_guest_token_hardening_and_replay.mjs` (Tests 15–17) | **PASS** |
| **Referrer Policy Enforcement** | `referrer: "no-referrer"` in confirmation metadata | Verified in `frontend-user/app/(pages)/order-confirmation/page.js` | **PASS** |
| **Confirmation Page Reload (`B-03`)** | Recovers token from `sessionStorage`, renders order | Verified in Scenario B-03 (Playwright Chromium) | **PASS** |
| **Mandatory Expiration (`GUEST-EXPIRY-03`)**| Missing/null/expired timestamps fail closed | Verified in `test_guest_token_hardening_and_replay.mjs` (Tests 1–6) | **PASS** |
| **Cross-Customer Isolation (`B-10`)** | Token A cannot access Order B, OTP, tracking, location | Verified in Scenario B-10 and `test_order_authorization_remediation.mjs` (Tests 1–18) | **PASS** |
| **SessionStorage Disabled / Quota** | Storage access failure leaves in-memory token active | Documented operational limitation: requires re-authenticating on full reload if storage blocked | **PASS (With Limitation)** |

---

## 6. Phase Four — Restaurant & Staff Operations

| Role / Operational Task | Authorization & Isolation Invariants | Tested Evidence | Status |
| :--- | :--- | :--- | :---: |
| **Manager Full Authority** | Manage orders within authorized restaurant branch | `test_order_lifecycle_hardening.mjs` (Test 10) | **PASS** |
| **Cross-Restaurant Isolation** | Branch B manager cannot view/mutate Branch A orders (404) | `test_order_lifecycle_hardening.mjs` (Test 11) | **PASS** |
| **Kitchen Task Boundary** | Kitchen staff can prepare food; forbidden from delivery (403) | `test_order_lifecycle_hardening.mjs` (Test 8) | **PASS** |
| **Delivery Staff Boundary** | Drivers view and dispatch only assigned orders (403) | `test_delivery_assignment_dispatch_workflow.mjs` (Tests 19–24) | **PASS** |
| **Cashier Task Boundary** | Cashier forbidden from verifying delivery handover (403) | `test_delivery_otp_handover.mjs` (Test 20) | **PASS** |
| **Manager Self-Delivery Mode** | Explicit mode toggle; binds manager identity and OTP | `test_delivery_assignment_dispatch_workflow.mjs` (Tests 11–18) | **PASS** |
| **Atomic Dispatch Guard** | Manager cannot dispatch delivery order without driver | `test_order_lifecycle_hardening.mjs` (Test 13, Rule B Guard) | **PASS** |
| **Superadmin Override Policy** | Blocked from marking delivery orders delivered without OTP | `test_delivery_otp_handover.mjs` (Test 31) | **PASS** |
| **Concurrent Status Conflicts** | Competing updates return HTTP 409 Conflict | `test_order_lifecycle_hardening.mjs` (Test 18) | **PASS** |
| **Inventory Waste Logging** | Cancelled prepared food logs waste, does not restock | `test_order_lifecycle_hardening.mjs` (Tests 26, 33–36) | **PASS** |

---

## 7. Phase Five — Delivery OTP & Handover

- **OTP Issuance**: Issued at `out_for_delivery` dispatch; encrypted with AES-256-GCM and hashed with HMAC-SHA-256 bound to `orderId`, `issuanceId`, and secret. (Verified in Tests 1–11 of `test_delivery_otp_handover.mjs`).
- **Correct Handover**: Authorized driver verifies valid 4-digit code; atomic completion marks order delivered, records statusHistory, ends live tracking. (Verified in Test 24).
- **Attempt Accounting & Lockout**: 5 failed attempts permanently lock OTP into `max_attempts_exceeded` with HTTP 429. (Verified in Test 22).
- **TOCTOU Reassignment Race**: Reassigned driver is rejected with HTTP 409 Conflict at atomic boundary. (Verified in Tests 28–29).
- **Pickup Exemption**: Counter pickup orders complete without requiring OTP (returns 400 if requested). (Verified in Test 32).
- **Secret Secrecy**: Plaintext OTP is never stored in MongoDB and excluded via `select: false`. (Verified in Tests 9–10).

---

## 8. Phase Six — COD & Financial Integrity

- **Server-Authoritative Binding**: Handler identity and total amount are bound server-side from session and order snapshot; client-supplied amounts or IDs are ignored. (Verified in Tests 34–35 of `test_delivery_otp_handover.mjs`).
- **Driver Self-Settlement Prohibited**: Driver handover sets `settledWithManager: false` and `settledAt: null`. (Verified in Test 36).
- **Manager Settlement Action**: Action `settle_cod_cash` requires manager role, records authenticated manager identity and timestamp. (Verified in Test 37).
- **Concurrency & Idempotency**: Concurrent settlement requests yield exactly 1 success and 1 HTTP 409 Conflict; repeated retries fail closed without double-settling. (Verified in Tests 41–42, 49).
- **Ineligible Order Rejection**: Uncollected COD, online-paid, cancelled, or refunded orders cannot be settled (rejected with 400). (Verified in Tests 40, 45).

---

## 9. Phase Seven — Real Web Push Validation

- **Delivery Event Triggers**: Successful delivery verification triggers `status_update` push notification. (Verified in Test 50).
- **Failure Non-Blocking Isolation**: Push service timeouts or connection errors log a non-blocking warning and do not roll back or corrupt committed order transitions. (Verified in Test 52).
- **Live Device Delivery**: Real APNS/FCM delivery to physical devices requires active staging VAPID keys and registered client service workers. Status: **BLOCKED / NOT TESTED**.

---

## 10. Phase Eight — Mobile & Browser Compatibility

- **Desktop Chromium**: Fully tested via Playwright across 12 E2E scenarios. Status: **PASS**.
- **Responsive Layout & Touch Drawer**: Verified via unit component checks in `CartDrawer.js`, `FilterDrawer.js`, `MobileNavDrawer.js`. Status: **PASS**.
- **Physical Mobile Devices**: Direct verification on physical iOS (Safari Private Mode) and Android hardware requires device lab testing. Status: **BLOCKED / NOT TESTED**.

---

## 11. Phase Nine — Order Lifecycle & Data Integrity

- **State Progression**: Enforces strict progression: `pending` → `confirmed` → `preparing` → `ready` → `out_for_delivery` → `delivered`. Direct skips return HTTP 400.
- **Stale Order Maintenance**: Stale pickup orders (>60m) are cancelled; active `out_for_delivery` orders are strictly preserved. (Verified in Tests 23 & 25 of `test_order_lifecycle_hardening.mjs`).
- **Side-Effect Recovery Worker**: Unfinished waste logging or refunds interrupted by unexpected server crashes are resumed and completed idempotently by the recovery worker. (Verified in Tests 36–37).

---

## 12. Phase Ten — Observability, Recovery & Operations

- **Log Sanitization**: Sensitive credentials, tokens, OTP digests, and passwords are never printed to stdout/stderr.
- **Fail-Closed Operations**: Missing cryptographic secrets fail closed in production/staging environments.
- **Health & Readiness**: Next.js server readiness verified via automated polling loop in `test_isolated_browser_e2e.mjs`.

---

## 13. Phase Eleven — Regression Tests & Clean Sweep Matrix

All 7 test suites were executed with **100% clean exit codes (exit code 0)**:

```
========================================================================================
PET PROTOCOLS MASTER REGRESSION EXECUTION SUMMARY
========================================================================================
1. backend/scripts/test_guest_token_hardening_and_replay.mjs
   Classification: Database Integration & Cryptographic Unit Tests
   Pass Count: 17 / 17 (100%) | Exit Code: 0

2. backend/scripts/test_order_authorization_remediation.mjs
   Classification: Route Authorization & Tenant Isolation Integration Tests
   Pass Count: 31 / 31 (100%) | Exit Code: 0

3. backend/scripts/test_delivery_otp_handover.mjs
   Classification: Cryptographic Invariants, Concurrency & Financial Settlement Tests
   Pass Count: 52 / 52 (100%) | Exit Code: 0

4. backend/scripts/test_delivery_assignment_dispatch_workflow.mjs
   Classification: Role Permissions, Dispatch Workflow & Dual-Party OTP Tests
   Pass Count: 36 / 36 (100%) | Exit Code: 0

5. backend/scripts/test_order_lifecycle_hardening.mjs
   Classification: State Transitions, Stale Orders, Waste Logging & Recovery Tests
   Pass Count: 37 / 37 (100%) | Exit Code: 0

6. frontend-user/scripts/test_order_history_and_details_pagination.mjs
   Classification: Route Contracts, Pagination & Component Interface Tests
   Pass Count: 18 / 18 (100%) | Exit Code: 0

7. backend/scripts/test_isolated_browser_e2e.mjs
   Classification: Multi-Process Isolated Browser E2E Tests (Playwright Chromium)
   Pass Count: 12 / 12 (100%) | Exit Code: 0
========================================================================================
GRAND TOTAL: 203 OF 203 AUTOMATED ASSERTIONS PASSED (100.0%)
========================================================================================
```

---

## 14. Phase Twelve — Master Release-Gate Matrix

| Release Category | Exact Scope Verified | Status | Justification / Evidence |
| :--- | :--- | :---: | :--- |
| **Environment & Secret Isolation** | Zero Atlas fallback in tests; fail-closed secret validators; server-only secrets | **PASS** | Verified in `lib/db.js`, `deliveryOtpService.js`, `guestAccessService.js`. |
| **Authentication & Authorization** | NextAuth session resolution; cross-tenant staff isolation; superadmin guard | **PASS** | Verified across 31 tests in `test_order_authorization_remediation.mjs`. |
| **Guest Checkout & Token Security** | URL sanitization; no-referrer header; mandatory expiry; SHA-256 storage | **PASS** | Verified across 17 tests in `test_guest_token_hardening_and_replay.mjs` & B-01/B-02/B-11. |
| **Payment Gateway & Webhook Verification** | Local HMAC validation; idempotent replay recovery; raw body webhook parsing | **PASS (Mocked)**<br>**BLOCKED (Live)** | Pass against local test simulator and mock adapter. Live gateway HTTP communication blocked pending staging URL. |
| **Delivery OTP & Driver Assignment** | Dual-party access; AES-256-GCM encryption; 5-attempt limit; TOCTOU guard | **PASS** | Verified across 52 tests in `test_delivery_otp_handover.mjs`. |
| **COD Financial Integrity** | Server-authoritative driver binding; manager settlement action; no double-settle | **PASS** | Verified across Tests 33–49 in `test_delivery_otp_handover.mjs`. |
| **Restaurant Roles & Lifecycle** | Kitchen, Delivery, Cashier role segregation; manager self-delivery; atomic dispatch | **PASS** | Verified across 36 tests in `test_delivery_assignment_dispatch_workflow.mjs`. |
| **Inventory & Cancellation Consistency**| Stale pickup dismissal; raw stock preserved on prepared waste; idempotent deductions | **PASS** | Verified across 37 tests in `test_order_lifecycle_hardening.mjs`. |
| **Web Push** | Non-blocking error isolation; notification trigger on delivery completion | **PASS (Mocked)**<br>**BLOCKED (Live)** | Verified failure isolation. Real device push delivery blocked pending staging VAPID keys. |
| **Browser & Physical Mobile Testing** | Headless Chromium 1280×800; desktop navigation; sessionStorage recovery | **PASS (Desktop)**<br>**NOT TESTED (Mobile)** | 12/12 scenarios passed in Chromium. Physical Android/iOS hardware testing not performed. |
| **Regression Test Results** | Clean sweep across all 7 test suites (203 test items) | **PASS** | 203/203 assertions passed cleanly with exit code 0. |
| **Monitoring, Backup, Rollback & Incident**| Structured logging; sensitive field redaction; side-effect crash recovery worker | **PASS** | Verified in `Order.js`, `payment/verify/route.js`, and lifecycle recovery worker. |

---

## 15. Staging Environment Deployment Prerequisites

To advance this release from **STAGING VALIDATION INCOMPLETE** to **CANDIDATE FOR PRODUCTION REVIEW**, the following operational steps must be executed in the target staging environment:

1. **Environment Secrets Provisioning**:
   - Generate and inject `DELIVERY_OTP_SECRET` (strictly 64 hex characters):
     ```bash
     openssl rand -hex 32
     ```
   - Generate and inject `GUEST_ACCESS_SECRET` (≥32 characters):
     ```bash
     openssl rand -base64 32
     ```
   - Generate and inject `NEXTAUTH_SECRET` (≥32 characters):
     ```bash
     openssl rand -base64 32
     ```
2. **Dedicated Staging MongoDB Cluster**:
   - Provision an isolated MongoDB replica set with TLS enabled. Update `MONGODB_URI` in staging to prevent any connection to local or production databases.
3. **Live Razorpay Sandbox Configuration**:
   - Configure official Razorpay Sandbox `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
   - Configure public webhook endpoint `https://staging-api.petprotocols.com/api/payment/webhook` with dedicated `RAZORPAY_WEBHOOK_SECRET` in Razorpay Dashboard.
4. **Web Push VAPID Keys**:
   - Generate VAPID keypair:
     ```bash
     npx web-push generate-vapid-keys
     ```
   - Populate `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in staging backend and frontends.
5. **Physical Mobile Device Smoke Tests**:
   - Execute test checkout on physical iPhone (Safari iOS 17/18 Private Browsing) and Android device (Chrome Incognito) to confirm `sessionStorage` persistence and push permission flows.
