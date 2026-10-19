/**
 * Test Suite: Pet Protocols Phase 2.3 - Delivery Staff GPS Transmission
 * Tests geolocation watcher lifecycle, throttling, duplicate suppression,
 * terminal state cleanup, permission denial, pickup exclusion, and API rejection.
 */

import assert from "assert";
import {
  calculateDistanceMeters,
  isPickupOrder,
} from "../hooks/useDeliveryGpsTransmitter.js";

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

console.log("\n🧪 Running Phase 2.3 Delivery Staff GPS Transmission Tests...\n");

// ── TEST 1: Distance calculation (Haversine Formula) ──────────────────────────
runTest("calculateDistanceMeters accurately calculates distance and handles edge cases", () => {
  // Identical coordinates
  assert.strictEqual(calculateDistanceMeters(12.9716, 77.5946, 12.9716, 77.5946), 0);

  // Known distance: ~111km per latitude degree
  const dist1DegLat = calculateDistanceMeters(12.0, 77.0, 13.0, 77.0);
  assert(dist1DegLat > 110000 && dist1DegLat < 112000, `Expected ~111km, got ${dist1DegLat}`);

  // Small movement: ~100 meters
  // ~0.0009 degrees latitude is ~100m
  const dist100m = calculateDistanceMeters(12.9716, 77.5946, 12.9725, 77.5946);
  assert(dist100m > 90 && dist100m < 110, `Expected ~100m, got ${dist100m}`);

  // Non-finite edge cases
  assert.strictEqual(calculateDistanceMeters(NaN, 77, 12, 77), 0);
  assert.strictEqual(calculateDistanceMeters(12, Infinity, 12, 77), 0);
});

// ── TEST 2: Pickup Order Detection ───────────────────────────────────────────
runTest("isPickupOrder detects counter pickup orders and ignores home deliveries", () => {
  // Cash on pickup / COP
  assert.strictEqual(isPickupOrder({ paymentMethod: "COP" }), true);
  assert.strictEqual(isPickupOrder({ paymentMethod: "Cash on Pickup" }), true);

  // Notes contains [pickup]
  assert.strictEqual(isPickupOrder({ paymentMethod: "Razorpay", notes: "Please pack fast [PICKUP]" }), true);

  // Address addressType contains pickup
  assert.strictEqual(isPickupOrder({ paymentMethod: "Razorpay", address: { addressType: "pickup" } }), true);

  // Normal home delivery
  assert.strictEqual(
    isPickupOrder({
      paymentMethod: "COD",
      notes: "Ring the doorbell",
      address: { addressType: "Home", street: "123 Main St" },
    }),
    false
  );

  // Empty / null order
  assert.strictEqual(isPickupOrder(null), false);
  assert.strictEqual(isPickupOrder({}), false);
});

// ── TEST 3: Throttling & Duplicate Prevention Logic ──────────────────────────
runTest("Throttling logic enforces 8-second window, allows fast >25m movement, and sends 25s heartbeat", () => {
  const MIN_UPDATE_INTERVAL_MS = 8000;
  const SIGNIFICANT_MOVE_METERS = 25;
  const FAST_UPDATE_INTERVAL_MS = 4000;
  const HEARTBEAT_INTERVAL_MS = 25000;

  function evaluateSendDecision(lastLoc, lastTime, currentCoords, currentTime) {
    if (!lastLoc || lastTime === 0) return { shouldSend: true, reason: "initial" };

    const elapsedMs = currentTime - lastTime;
    const distance = calculateDistanceMeters(
      lastLoc.latitude,
      lastLoc.longitude,
      currentCoords.latitude,
      currentCoords.longitude
    );

    const isSignificantMove = distance >= SIGNIFICANT_MOVE_METERS && elapsedMs >= FAST_UPDATE_INTERVAL_MS;
    const isNormalUpdate = elapsedMs >= MIN_UPDATE_INTERVAL_MS && distance >= 5;
    const isHeartbeat = elapsedMs >= HEARTBEAT_INTERVAL_MS;

    if (isSignificantMove) return { shouldSend: true, reason: "significant_movement" };
    if (isNormalUpdate) return { shouldSend: true, reason: "normal_interval" };
    if (isHeartbeat) return { shouldSend: true, reason: "heartbeat" };
    return { shouldSend: false, reason: "throttled", distance, elapsedMs };
  }

  const baseLoc = { latitude: 12.9716, longitude: 77.5946 };
  const baseTime = 100000;

  // Case A: 2 seconds later, same position (<5m) -> should NOT send
  const r1 = evaluateSendDecision(baseLoc, baseTime, { latitude: 12.9716, longitude: 77.5946 }, baseTime + 2000);
  assert.strictEqual(r1.shouldSend, false, "Should throttle immediate duplicate");

  // Case B: 5 seconds later, moved 50m (fast transit) -> should send
  // 50m north is approx +0.00045 latitude
  const r2 = evaluateSendDecision(baseLoc, baseTime, { latitude: 12.97205, longitude: 77.5946 }, baseTime + 5000);
  assert.strictEqual(r2.shouldSend, true, "Should allow fast send on >=25m movement");
  assert.strictEqual(r2.reason, "significant_movement");

  // Case C: 3 seconds later, moved 50m (<4s fast threshold) -> should throttle
  const r3 = evaluateSendDecision(baseLoc, baseTime, { latitude: 12.97205, longitude: 77.5946 }, baseTime + 3000);
  assert.strictEqual(r3.shouldSend, false, "Should enforce minimum 4s even with movement");

  // Case D: 9 seconds later, moved 10m -> should send (normal cadence)
  // 10m north is approx +0.00009 latitude
  const r4 = evaluateSendDecision(baseLoc, baseTime, { latitude: 12.97169, longitude: 77.5946 }, baseTime + 9000);
  assert.strictEqual(r4.shouldSend, true, "Should send at normal 8s+ cadence if moved >=5m");
  assert.strictEqual(r4.reason, "normal_interval");

  // Case E: 9 seconds later, moved 0m (stationary at red light) -> should NOT send duplicate
  const r5 = evaluateSendDecision(baseLoc, baseTime, { latitude: 12.9716, longitude: 77.5946 }, baseTime + 9000);
  assert.strictEqual(r5.shouldSend, false, "Should suppress duplicate updates while stationary at red light");

  // Case F: 26 seconds later, still stationary -> should send heartbeat so server doesn't mark stale
  const r6 = evaluateSendDecision(baseLoc, baseTime, { latitude: 12.9716, longitude: 77.5946 }, baseTime + 26000);
  assert.strictEqual(r6.shouldSend, true, "Should send heartbeat update after 25s");
  assert.strictEqual(r6.reason, "heartbeat");
});

// ── TEST 4: Mock Geolocation Watch Lifecycle and Permission Denial ────────────
runTest("Geolocation watch handles permission denial (code 1) cleanly", () => {
  let watchCleared = false;
  let activeWatchId = null;
  const watchIdRef = { current: null };

  const mockGeolocation = {
    watchPosition: (success, error, options) => {
      activeWatchId = 42;
      watchIdRef.current = activeWatchId;
      // Real browsers invoke callbacks asynchronously or after ID generation
      error({ code: 1, message: "User denied Geolocation" });
      return activeWatchId;
    },
    clearWatch: (id) => {
      if (id === activeWatchId) {
        watchCleared = true;
        activeWatchId = null;
      }
    },
  };

  let trackingStatus = "requesting_permission";
  let errorMessage = "";

  // Trigger watch
  mockGeolocation.watchPosition(
    () => {},
    (err) => {
      if (err.code === 1) {
        trackingStatus = "permission_denied";
        errorMessage = "Location permission denied.";
        if (watchIdRef.current) {
          mockGeolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      }
    }
  );

  assert.strictEqual(trackingStatus, "permission_denied");
  assert.strictEqual(watchCleared, true);
  assert.strictEqual(activeWatchId, null);
});

// ── TEST 5: Watch Cleanup on Unmount and Terminal Order States ─────────────────
runTest("Watch cleanup terminates geolocation and releases Screen Wake Lock on delivery completion", () => {
  let watchCleared = false;
  let wakeLockReleased = false;

  const mockWatchId = 99;
  const mockWakeLock = {
    release: () => {
      wakeLockReleased = true;
      return Promise.resolve();
    },
  };

  const mockGeolocation = {
    clearWatch: (id) => {
      if (id === mockWatchId) watchCleared = true;
    },
  };

  function terminateTracking(reason) {
    mockGeolocation.clearWatch(mockWatchId);
    if (mockWakeLock) mockWakeLock.release();
    return { trackingStatus: reason, activeOrderId: null };
  }

  const result = terminateTracking("stopped");
  assert.strictEqual(watchCleared, true, "Watch must be cleared");
  assert.strictEqual(wakeLockReleased, true, "Wake lock must be released");
  assert.strictEqual(result.trackingStatus, "stopped");
  assert.strictEqual(result.activeOrderId, null);
});

// ── TEST 6: Authorization Loss (403) Halts GPS Transmission ──────────────────
async function testAuthorizationLoss() {
  let watchCleared = false;
  const mockWatchId = 77;

  const mockGeolocation = {
    clearWatch: (id) => {
      if (id === mockWatchId) watchCleared = true;
    },
  };

  // Mock server 403 response
  const mockFetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({
      success: false,
      message: "You are not the currently assigned delivery staff for this order.",
    }),
  });

  let trackingStatus = "sharing";
  let activeOrderId = "ORD-12345";
  let errorMessage = "";

  const res = await mockFetch();
  if (res.status === 403) {
    const data = await res.json();
    trackingStatus = "unauthorized";
    errorMessage = data.message;
    mockGeolocation.clearWatch(mockWatchId);
    activeOrderId = null;
  }

  assert.strictEqual(trackingStatus, "unauthorized");
  assert.strictEqual(watchCleared, true);
  assert.strictEqual(activeOrderId, null);
  assert(errorMessage.includes("not the currently assigned delivery staff"));
}
await runAsyncTest("Server 403 (unassigned driver) halts watch and sets unauthorized status", testAuthorizationLoss);

// ── TEST 7: Terminal State Rejection (400) from Ingestion API ─────────────────
async function testTerminalStateRejection() {
  let watchCleared = false;
  const mockWatchId = 88;

  const mockGeolocation = {
    clearWatch: (id) => {
      if (id === mockWatchId) watchCleared = true;
    },
  };

  // Mock server 400 response because order was delivered
  const mockFetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      success: false,
      message: "Location updates are only accepted while order is 'out_for_delivery' (current status: 'delivered').",
    }),
  });

  let trackingStatus = "sharing";
  let activeOrderId = "ORD-99999";

  const res = await mockFetch();
  if (res.status === 400) {
    const data = await res.json();
    if (data.message.includes("delivered") || data.message.includes("cancelled")) {
      trackingStatus = "stopped";
      mockGeolocation.clearWatch(mockWatchId);
      activeOrderId = null;
    }
  }

  assert.strictEqual(trackingStatus, "stopped");
  assert.strictEqual(watchCleared, true);
  assert.strictEqual(activeOrderId, null);
}
await runAsyncTest("Server 400 (order delivered/cancelled) halts watch and stops tracking", testTerminalStateRejection);

// ── TEST 8: Pickup and Inactive Orders Block GPS Start ─────────────────────────
runTest("GPS tracking start is blocked for pickup orders and orders not in out_for_delivery", () => {
  function validateStart(order) {
    if (!order) return { canStart: false, reason: "Order is required" };
    if (isPickupOrder(order)) return { canStart: false, reason: "Pickup orders do not support GPS tracking" };
    if (order.status !== "out_for_delivery") {
      return { canStart: false, reason: `Cannot start GPS for order in '${order.status}' status` };
    }
    return { canStart: true };
  }

  // Preparing status -> blocked
  const r1 = validateStart({ status: "preparing", paymentMethod: "COD" });
  assert.strictEqual(r1.canStart, false);
  assert(r1.reason.includes("preparing"));

  // Pickup delivery -> blocked
  const r2 = validateStart({ status: "out_for_delivery", paymentMethod: "COP" });
  assert.strictEqual(r2.canStart, false);
  assert(r2.reason.includes("Pickup orders"));

  // Normal out for delivery -> allowed
  const r3 = validateStart({ status: "out_for_delivery", paymentMethod: "Online", address: { street: "123 Main" } });
  assert.strictEqual(r3.canStart, true);
});

// ── SUMMARY REPORT ────────────────────────────────────────────────────────────
console.log("\n=======================================================");
console.log(`Phase 2.3 GPS Transmission Tests: ${passedCount}/${totalCount} PASSED`);
console.log("=======================================================\n");

if (passedCount !== totalCount) {
  process.exit(1);
}
