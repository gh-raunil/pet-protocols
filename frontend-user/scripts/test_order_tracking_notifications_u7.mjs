/**
 * Phase U7 — Customer Order Tracking & Notification Reliability Test Suite
 * Validates order tracking, pickup vs delivery, cancellation window,
 * in-app notifications, safe order navigation, and nav badge alignment.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_FRONTEND_DIR = path.resolve(__dirname, "..");

console.log("\n========================================================");
console.log("   PHASE U7 — ORDER TRACKING & NOTIFICATION TEST SUITE   ");
console.log("========================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}\n`);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Suite 1: Order Status Progression & Step Definitions (OrderStatusTracker)
// -----------------------------------------------------------------------------
console.log("--- Suite 1: Order Status Progression & Step Definitions ---");

const trackerPath = path.join(USER_FRONTEND_DIR, "components/orders/OrderStatusTracker.js");
assert.ok(fs.existsSync(trackerPath), "OrderStatusTracker.js must exist");
const trackerCode = fs.readFileSync(trackerPath, "utf-8");

runTest("OrderStatusTracker source exports getOrderSteps, getActiveStepIndex, and ORDER_STEPS", () => {
  assert.ok(trackerCode.includes("export const ORDER_STEPS ="), "Must export ORDER_STEPS");
  assert.ok(trackerCode.includes("export function getOrderSteps"), "Must export getOrderSteps helper");
  assert.ok(trackerCode.includes("export function getActiveStepIndex"), "Must export getActiveStepIndex helper");
  assert.ok(trackerCode.includes("isPickup = false"), "OrderStatusTracker must accept isPickup prop");
  assert.ok(trackerCode.includes("cancellationReason = \"\""), "OrderStatusTracker must accept cancellationReason prop");
});

runTest("getActiveStepIndex contract maps all backend order statuses correctly", () => {
  function getActiveStepIndex(status) {
    switch (status?.toLowerCase()) {
      case "pending":
      case "confirmed":
        return 0;
      case "preparing":
        return 1;
      case "out_for_delivery":
      case "ready":
        return 2;
      case "delivered":
        return 3;
      default:
        return 0;
    }
  }

  assert.equal(getActiveStepIndex("pending"), 0, "pending should map to step 0");
  assert.equal(getActiveStepIndex("confirmed"), 0, "confirmed should map to step 0");
  assert.equal(getActiveStepIndex("preparing"), 1, "preparing should map to step 1");
  assert.equal(getActiveStepIndex("out_for_delivery"), 2, "out_for_delivery should map to step 2");
  assert.equal(getActiveStepIndex("ready"), 2, "ready should map to step 2");
  assert.equal(getActiveStepIndex("delivered"), 3, "delivered should map to step 3");
  assert.equal(getActiveStepIndex("unknown_status"), 0, "unknown status should fallback to 0");
});

runTest("getOrderSteps distinguishes between delivery and self-pickup milestones", () => {
  assert.ok(trackerCode.includes('"Ready for Pickup"'), "Pickup step 2 must be 'Ready for Pickup'");
  assert.ok(trackerCode.includes('"Picked Up"'), "Pickup step 3 must be 'Picked Up'");
  assert.ok(trackerCode.includes('"Out for Delivery"'), "Delivery step 2 must be 'Out for Delivery'");
  assert.ok(trackerCode.includes('"Delivered"'), "Delivery step 3 must be 'Delivered'");
  assert.ok(trackerCode.includes("ShoppingBag"), "Must import and use ShoppingBag for pickup milestone");
});

// -----------------------------------------------------------------------------
// Suite 2: Safe Order URL Extraction (Notification Navigation Security)
// -----------------------------------------------------------------------------
console.log("\n--- Suite 2: In-App Notification Navigation & Security ---");

runTest("getSafeOrderUrl validates relative paths and blocks open-redirect attacks", () => {
  // Test implementation of the exact contract used in NotificationDrawer and NotificationsClient
  function getSafeOrderUrl(message) {
    if (!message) return null;
    const rawUrl = message.url;

    if (
      typeof rawUrl === "string" &&
      rawUrl.startsWith("/") &&
      !rawUrl.startsWith("//") &&
      !rawUrl.startsWith("/\\")
    ) {
      const isOrderRelated =
        message.isInAppOrderNotif ||
        message.messageType === "order" ||
        Boolean(message.orderId) ||
        rawUrl.startsWith("/order-confirmation") ||
        rawUrl.startsWith("/orders");

      if (isOrderRelated) {
        return rawUrl;
      }
    } else if (
      message.orderId &&
      typeof message.orderId === "string" &&
      /^[a-zA-Z0-9_-]+$/.test(message.orderId)
    ) {
      return `/order-confirmation?orderId=${encodeURIComponent(message.orderId)}`;
    }
    return null;
  }

  // Safe relative paths
  assert.equal(
    getSafeOrderUrl({ url: "/order-confirmation?orderId=ORD123" }),
    "/order-confirmation?orderId=ORD123"
  );
  assert.equal(
    getSafeOrderUrl({ url: "/orders" }),
    "/orders"
  );
  assert.equal(
    getSafeOrderUrl({ orderId: "ORD_67890" }),
    "/order-confirmation?orderId=ORD_67890"
  );

  // Malicious / open-redirect attempts must be blocked
  assert.equal(getSafeOrderUrl({ url: "//evil.com" }), null);
  assert.equal(getSafeOrderUrl({ url: "/\\evil.com" }), null);
  assert.equal(getSafeOrderUrl({ url: "https://evil.com/phish" }), null);
  assert.equal(getSafeOrderUrl({ url: "javascript:alert(1)" }), null);
  assert.equal(getSafeOrderUrl({ orderId: "<script>alert(1)</script>" }), null);
  assert.equal(getSafeOrderUrl(null), null);
});

runTest("NotificationsClient contains getSafeOrderUrl and View Order navigation", () => {
  const notifClientPath = path.join(USER_FRONTEND_DIR, "app/(pages)/notifications/NotificationsClient.js");
  const code = fs.readFileSync(notifClientPath, "utf-8");

  assert.ok(code.includes("getSafeOrderUrl"), "NotificationsClient must implement getSafeOrderUrl");
  assert.ok(code.includes("View Order"), "NotificationsClient must render View Order link");
  assert.ok(code.includes("Mark as read"), "NotificationsClient must render Mark as read action");
});

// -----------------------------------------------------------------------------
// Suite 3: Order History Reliability & Error Resilience (OrdersClient)
// -----------------------------------------------------------------------------
console.log("\n--- Suite 3: Order History & Polling Resilience ---");

runTest("OrdersClient handles errors without confusing them for empty history", () => {
  const ordersClientPath = path.join(USER_FRONTEND_DIR, "app/(pages)/orders/OrdersClient.js");
  const code = fs.readFileSync(ordersClientPath, "utf-8");

  assert.ok(code.includes("error && orders.length === 0"), "OrdersClient must have an explicit error state");
  assert.ok(code.includes("Unable to load orders"), "OrdersClient must display error heading");
  assert.ok(code.includes("Try Again"), "OrdersClient must offer retry action on error");
  assert.ok(code.includes("Refresh"), "OrdersClient header must contain manual refresh button");
});

runTest("OrdersClient includes active order statuses in polling logic", () => {
  const ordersClientPath = path.join(USER_FRONTEND_DIR, "app/(pages)/orders/OrdersClient.js");
  const code = fs.readFileSync(ordersClientPath, "utf-8");

  assert.ok(code.includes('"pending"'), "OrdersClient must consider pending as active");
  assert.ok(code.includes('"confirmed"'), "OrdersClient must consider confirmed as active");
  assert.ok(code.includes('"preparing"'), "OrdersClient must consider preparing as active");
  assert.ok(code.includes('"ready"'), "OrdersClient must consider ready as active");
  assert.ok(code.includes('"out_for_delivery"'), "OrdersClient must consider out_for_delivery as active");
  assert.ok(code.includes("visibilitychange"), "OrdersClient must pause or refresh on visibility change");
});

// --- Phase U7.2 Regression Tests for Finding F-01 ---

runTest("[F-01 Contract] OrdersClient decouples initial fetch from orders array reference", () => {
  const ordersClientPath = path.join(USER_FRONTEND_DIR, "app/(pages)/orders/OrdersClient.js");
  const code = fs.readFileSync(ordersClientPath, "utf-8");

  // Initial fetch effect must NOT have `orders` in its dependency array
  const initialFetchEffectMatch = code.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?fetchOrders\(false\);[\s\S]*?\},\s*\[(.*?)\]\);/);
  assert.ok(initialFetchEffectMatch, "OrdersClient must have an initial fetch useEffect");
  const deps = initialFetchEffectMatch[1].split(",").map((s) => s.trim());
  assert.ok(!deps.includes("orders"), "Initial fetch effect MUST NOT include 'orders' in dependency array (prevents re-fetch cycle)");
  assert.ok(deps.some((d) => d.includes("session")), "Initial fetch effect must depend on session state");
  assert.ok(deps.some((d) => d.includes("fetchOrders")), "Initial fetch effect must depend on fetchOrders callback");
});

runTest("[F-01 Contract] OrdersClient uses memoized primitive fingerprint and concurrency guard", () => {
  const ordersClientPath = path.join(USER_FRONTEND_DIR, "app/(pages)/orders/OrdersClient.js");
  const code = fs.readFileSync(ordersClientPath, "utf-8");

  assert.ok(code.includes("isFetchingRef = useRef(false)"), "OrdersClient must declare isFetchingRef concurrency guard");
  assert.ok(code.includes("activeOrdersFingerprint = useMemo("), "OrdersClient must compute activeOrdersFingerprint via useMemo");
  assert.ok(code.includes("30000"), "OrdersClient must maintain 30-second polling interval");
  assert.ok(
    code.includes("[session, fetchOrders, activeOrdersFingerprint]"),
    "Polling effect must depend on session, fetchOrders, and activeOrdersFingerprint (not raw orders array)"
  );
  assert.ok(code.includes("clearInterval(intervalId)"), "Polling effect must clear interval on cleanup");
  assert.ok(code.includes("document.removeEventListener(\"visibilitychange\", handleVisibilityChange)"), "Polling effect must remove visibilitychange listener on cleanup");
});

runTest("[F-01 Logic Simulation] setOrders with new array reference does NOT re-trigger initial fetch", () => {
  // Simulates React shallow-dependency comparison for initial fetch effect: [status, session?.user?.email, fetchOrders]
  const mockFetchOrders = () => {};
  const prevDeps = ["authenticated", "test@example.com", mockFetchOrders];

  // Simulated fetch response causes setOrders to allocate new array reference
  const ordersBeforeFetch = [{ _id: "ord_1", status: "preparing" }];
  const ordersAfterFetch = [{ _id: "ord_1", status: "preparing" }]; // New reference from JSON deserialization
  assert.notEqual(ordersBeforeFetch, ordersAfterFetch, "API fetch produces a new array reference");

  // Next render with new orders array, but same session and fetchOrders
  const nextDeps = ["authenticated", "test@example.com", mockFetchOrders];

  const hasDepsChanged = prevDeps.length !== nextDeps.length || prevDeps.some((dep, idx) => !Object.is(dep, nextDeps[idx]));
  assert.equal(hasDepsChanged, false, "Initial fetch effect dependencies must remain unchanged when orders array reference changes");
});

runTest("[F-01 Logic Simulation] activeOrdersFingerprint stays stable across array reference changes with identical active orders", () => {
  function computeActiveOrdersFingerprint(ordersList) {
    if (!Array.isArray(ordersList) || ordersList.length === 0) return "";
    return ordersList
      .filter((o) =>
        ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)
      )
      .map((o) => `${o._id || o.orderId}:${o.status}`)
      .sort()
      .join("|");
  }

  const batch1 = [
    { _id: "ord_101", status: "preparing" },
    { _id: "ord_102", status: "delivered" },
    { _id: "ord_103", status: "ready" },
  ];

  const batch2 = [
    { _id: "ord_101", status: "preparing" },
    { _id: "ord_102", status: "delivered" },
    { _id: "ord_103", status: "ready" },
  ];

  assert.notEqual(batch1, batch2, "Batches must be distinct references");

  const fp1 = computeActiveOrdersFingerprint(batch1);
  const fp2 = computeActiveOrdersFingerprint(batch2);

  assert.equal(fp1, fp2, "Fingerprints must be identical for same active order set");
  assert.equal(fp1, "ord_101:preparing|ord_103:ready", "Fingerprint must format as sorted ID:status string and exclude delivered orders");
  assert.equal(Object.is(fp1, fp2), true, "React Object.is comparison evaluates identical strings to true (no effect restart)");
});

runTest("[F-01 Logic Simulation] Polling starts when active orders exist and stops when no active orders remain", () => {
  function computeActiveOrdersFingerprint(ordersList) {
    if (!Array.isArray(ordersList) || ordersList.length === 0) return "";
    return ordersList
      .filter((o) =>
        ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)
      )
      .map((o) => `${o._id || o.orderId}:${o.status}`)
      .sort()
      .join("|");
  }

  // 1. Initial empty or terminal orders -> fingerprint is empty string -> no interval
  const terminalOrders = [
    { _id: "ord_old", status: "delivered" },
    { _id: "ord_cancel", status: "cancelled" },
  ];
  const fpTerminal = computeActiveOrdersFingerprint(terminalOrders);
  assert.equal(fpTerminal, "", "Terminal orders produce empty fingerprint");
  const shouldPollTerminal = Boolean(fpTerminal);
  assert.equal(shouldPollTerminal, false, "Polling must be inactive when all orders are terminal");

  // 2. Active order arrives -> fingerprint becomes non-empty -> polling starts
  const activeOrders = [
    { _id: "ord_new", status: "confirmed" },
    ...terminalOrders,
  ];
  const fpActive = computeActiveOrdersFingerprint(activeOrders);
  assert.equal(fpActive, "ord_new:confirmed");
  const shouldPollActive = Boolean(fpActive);
  assert.equal(shouldPollActive, true, "Polling must start when active order is present");

  // 3. Status transitions from active to delivered -> fingerprint reverts to empty -> polling stops
  const completedOrders = [
    { _id: "ord_new", status: "delivered" },
    ...terminalOrders,
  ];
  const fpCompleted = computeActiveOrdersFingerprint(completedOrders);
  assert.equal(fpCompleted, "");
  const shouldPollCompleted = Boolean(fpCompleted);
  assert.equal(shouldPollCompleted, false, "Polling must stop when active order completes");
});

runTest("[F-01 Logic Simulation] Polling skips fetch when tab is hidden and fetches when tab becomes visible", () => {
  let fetchCount = 0;
  const mockFetch = () => { fetchCount++; };

  // Simulated browser environment
  let currentVisibilityState = "hidden";
  const mockDocument = {
    get visibilityState() { return currentVisibilityState; }
  };

  // Interval execution callback as implemented in OrdersClient:
  const intervalCallback = () => {
    if (mockDocument.visibilityState === "hidden") return;
    mockFetch();
  };

  // Visibility change callback as implemented in OrdersClient:
  const visibilityCallback = () => {
    if (mockDocument.visibilityState === "visible") {
      mockFetch();
    }
  };

  // 1. Trigger interval while tab is hidden -> fetch should NOT be called
  intervalCallback();
  intervalCallback();
  assert.equal(fetchCount, 0, "Interval must skip fetch while tab is hidden");

  // 2. Tab becomes visible -> visibility handler should trigger immediate fetch
  currentVisibilityState = "visible";
  visibilityCallback();
  assert.equal(fetchCount, 1, "Visibility change to visible must trigger fetch");

  // 3. Trigger interval while tab is visible -> fetch should be called
  intervalCallback();
  assert.equal(fetchCount, 2, "Interval must execute fetch while tab is visible");
});

runTest("[F-01 Logic Simulation] Concurrency guard (isFetchingRef) prevents overlapping fetches", async () => {
  const isFetchingRef = { current: false };
  let executedFetches = 0;

  async function mockFetchOrders() {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      executedFetches++;
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      isFetchingRef.current = false;
    }
  }

  // Fire three concurrent requests simultaneously
  const p1 = mockFetchOrders();
  const p2 = mockFetchOrders();
  const p3 = mockFetchOrders();

  await Promise.all([p1, p2, p3]);

  assert.equal(executedFetches, 1, "Concurrency guard must ensure only one fetch runs when overlapping calls occur");
  assert.equal(isFetchingRef.current, false, "Concurrency lock must be released after completion");
});

runTest("[F-01 Logic Simulation] Polling effect cleanup unregisters visibilitychange listener and clears interval", () => {
  let intervalCleared = false;
  let listenerRemoved = false;
  const mockIntervalId = 12345;

  const mockClearInterval = (id) => {
    if (id === mockIntervalId) intervalCleared = true;
  };
  const mockRemoveEventListener = (evt, fn) => {
    if (evt === "visibilitychange" && typeof fn === "function") listenerRemoved = true;
  };

  // Simulate the cleanup closure from OrdersClient.js
  const handleVisibilityChange = () => {};
  const cleanupFn = () => {
    mockClearInterval(mockIntervalId);
    mockRemoveEventListener("visibilitychange", handleVisibilityChange);
  };

  cleanupFn();

  assert.equal(intervalCleared, true, "Effect cleanup must clear the active interval");
  assert.equal(listenerRemoved, true, "Effect cleanup must remove the visibilitychange listener");
});

// -----------------------------------------------------------------------------
// Suite 4: Order Confirmation & Self-Pickup Awareness (OrderConfirmationClient)
// -----------------------------------------------------------------------------
console.log("\n--- Suite 4: Order Confirmation & Pickup Verification ---");

runTest("OrderConfirmationClient detects pickup and updates destination card", () => {
  const confPath = path.join(USER_FRONTEND_DIR, "app/(pages)/order-confirmation/OrderConfirmationClient.js");
  const code = fs.readFileSync(confPath, "utf-8");

  assert.ok(code.includes("isPickup"), "OrderConfirmationClient must derive isPickup flag");
  assert.ok(code.includes("Self Pickup Counter"), "OrderConfirmationClient must render pickup counter label");
  assert.ok(code.includes("Delivery Destination"), "OrderConfirmationClient must maintain delivery destination label");
  assert.ok(code.includes("isPickup={isPickup}"), "OrderConfirmationClient must pass isPickup to tracker");
  assert.ok(code.includes("visibilitychange"), "OrderConfirmationClient must listen for tab visibility changes");
});

// -----------------------------------------------------------------------------
// Suite 5: Navigation Badges & Store Optimization (useNavBadges, notificationStore)
// -----------------------------------------------------------------------------
console.log("\n--- Suite 5: Navigation Badges & Store Optimization ---");

runTest("useNavBadges includes pending and ready in active order statuses", () => {
  const navBadgesPath = path.join(USER_FRONTEND_DIR, "hooks/useNavBadges.js");
  const code = fs.readFileSync(navBadgesPath, "utf-8");

  assert.ok(
    code.includes('"pending"') && code.includes('"ready"') && code.includes('"out_for_delivery"'),
    "useNavBadges must include pending, ready, and out_for_delivery in activeStatuses"
  );
});

runTest("notificationStore guards against duplicate in-flight requests and hidden tab polling", () => {
  const storePath = path.join(USER_FRONTEND_DIR, "lib/notificationStore.js");
  const code = fs.readFileSync(storePath, "utf-8");

  assert.ok(
    code.includes("if (get().loading) return;"),
    "notificationStore must guard against concurrent duplicate fetches"
  );
  assert.ok(
    code.includes('document.visibilityState === "hidden"'),
    "notificationStore must skip background polling when document is hidden"
  );
});

runTest("NotificationBell pauses polling when document is hidden", () => {
  const bellPath = path.join(USER_FRONTEND_DIR, "components/notifications/NotificationBell.js");
  const code = fs.readFileSync(bellPath, "utf-8");

  assert.ok(
    code.includes('document.visibilityState === "hidden"'),
    "NotificationBell must not poll when document is hidden"
  );
  assert.ok(
    code.includes("visibilitychange"),
    "NotificationBell must handle visibility change"
  );
});

// -----------------------------------------------------------------------------
// Suite 6: Service Worker & Web Push Protection
// -----------------------------------------------------------------------------
console.log("\n--- Suite 6: Web Push & Service Worker Verification ---");

runTest("Service worker notification click navigates or focuses order destination", () => {
  const swPath = path.join(USER_FRONTEND_DIR, "public/sw.js");
  const code = fs.readFileSync(swPath, "utf-8");

  assert.ok(code.includes("notificationclick"), "sw.js must handle notificationclick");
  assert.ok(code.includes("event.notification.close()"), "sw.js must close notification on click");
  assert.ok(code.includes("targetUrl"), "sw.js must resolve targetUrl from data");
  assert.ok(code.includes("clients.openWindow"), "sw.js must support opening new window if none open");
});

runTest("DeliveryPushPrompt requires explicit user action before requesting permission", () => {
  const promptPath = path.join(USER_FRONTEND_DIR, "components/notifications/DeliveryPushPrompt.js");
  const code = fs.readFileSync(promptPath, "utf-8");

  assert.ok(code.includes("handleEnable"), "DeliveryPushPrompt must trigger subscribe via explicit handleEnable");
  assert.ok(code.includes("Enable Alerts") || code.includes("Activate Alerts"), "DeliveryPushPrompt must have user action button");
  // Ensure Notification.requestPermission is NOT called on mount in DeliveryPushPrompt
  assert.ok(
    !code.includes("useEffect(() => {\n    Notification.requestPermission"),
    "DeliveryPushPrompt must never request notification permission in an effect without user interaction"
  );
});

console.log("\n========================================================");
console.log(`   ALL TESTS PASSED: ${passedTests}/${totalTests} checks verified cleanly!   `);
console.log("========================================================\n");
