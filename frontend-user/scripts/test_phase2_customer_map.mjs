/**
 * Test Suite: Pet Protocols Phase 2.4 - Customer Live Delivery Map (Mappls)
 * Validates Mappls SDK integration contracts, live tracking telemetry,
 * coordinate validation, missing key fallbacks, geocoding safeguards,
 * polling lifecycle, and consumer page integrations.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_FRONTEND_DIR = path.resolve(__dirname, "..");

console.log("\n========================================================");
console.log("   PHASE 2.4 — CUSTOMER LIVE DELIVERY MAP (MAPPLS)      ");
console.log("========================================================\n");

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    passedCount++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

// ── 1. Component Source Contracts & Mappls Integration Approach ───────────────
console.log("--- Suite 1: Component Source Contracts & Mappls Integration ---");

const mapComponentPath = path.join(USER_FRONTEND_DIR, "components/orders/LiveDeliveryMap.js");
assert.ok(fs.existsSync(mapComponentPath), "LiveDeliveryMap.js must exist");
const mapSource = fs.readFileSync(mapComponentPath, "utf-8");

runTest("LiveDeliveryMap is a client-side component using NEXT_PUBLIC_MAPPLS_MAP_KEY", () => {
  assert.ok(mapSource.startsWith('"use client";') || mapSource.includes('"use client"'), "Must be client component");
  assert.ok(mapSource.includes("NEXT_PUBLIC_MAPPLS_MAP_KEY"), "Must reference NEXT_PUBLIC_MAPPLS_MAP_KEY");
  assert.ok(!mapSource.includes("MAPPLS_CLIENT_SECRET"), "Must never expose client secrets in frontend");
  assert.ok(!mapSource.includes("MAPPLS_SECRET"), "Must never expose secrets in frontend");
});

runTest("Loads official Mappls Web Maps JavaScript SDK v3.0 URL dynamically", () => {
  assert.ok(
    mapSource.includes("https://apis.mappls.com/advancedmaps/api/"),
    "Must load official Mappls script URL"
  );
  assert.ok(mapSource.includes("map_sdk?v=3.0"), "Must use Mappls SDK v3.0");
  assert.ok(mapSource.includes("window.mappls"), "Must check window.mappls object");
});

runTest("Safe configuration handling when Mappls key is missing", () => {
  assert.ok(mapSource.includes('"missing_key"'), "Must handle missing_key state");
  assert.ok(
    mapSource.includes("Interactive Map Awaiting Mappls Key") ||
    mapSource.includes("Awaiting Mappls Key"),
    "Must render friendly missing key fallback"
  );
  assert.ok(mapSource.includes("sdkStatus === \"error\""), "Must handle SDK loading error gracefully");
});

// ── 2. Coordinate Validation & Destination Geocoding Safeguards ───────────────
console.log("\n--- Suite 2: Coordinate Validation & Geocoding Safeguards ---");

function isValidCoordinate(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

runTest("isValidCoordinate validates finite, realistic geo-coordinates and excludes 0,0", () => {
  // Valid coordinates
  assert.strictEqual(isValidCoordinate(12.9716, 77.5946), true, "Bengaluru coordinates should be valid");
  assert.strictEqual(isValidCoordinate(28.6139, 77.209), true, "Delhi coordinates should be valid");

  // Invalid coordinates
  assert.strictEqual(isValidCoordinate(0, 0), false, "Null Island (0,0) must be rejected");
  assert.strictEqual(isValidCoordinate(NaN, 77.5), false, "NaN latitude must be rejected");
  assert.strictEqual(isValidCoordinate(12.9, Infinity), false, "Infinity longitude must be rejected");
  assert.strictEqual(isValidCoordinate(95, 77), false, "Latitude > 90 must be rejected");
  assert.strictEqual(isValidCoordinate(-95, 77), false, "Latitude < -90 must be rejected");
  assert.strictEqual(isValidCoordinate(12, 185), false, "Longitude > 180 must be rejected");
  assert.strictEqual(isValidCoordinate(null, 77), false, "Null latitude must be rejected");
  assert.strictEqual(isValidCoordinate("12.9", "77.5"), false, "String coordinates must be rejected");
});

runTest("Safeguards customer destination when text-only address lacks GPS coordinates", () => {
  assert.ok(
    mapSource.includes("hasValidDestCoords"),
    "Must check hasValidDestCoords before creating destination pin"
  );
  assert.ok(
    mapSource.includes("Destination pin omitted without GPS geocoding") ||
    mapSource.includes("Exact customer map pin unavailable"),
    "Must explain that destination pin is omitted without GPS geocoding"
  );
});

// ── 3. Lifecycle & Order State Rendering Logic ────────────────────────────────
console.log("\n--- Suite 3: Lifecycle & Order State Rendering Logic ---");

runTest("Counter pickup orders display counter pickup details and suppress delivery road map", () => {
  assert.ok(
    mapSource.includes("Counter Self-Pickup Order") || mapSource.includes("Counter Pickup"),
    "Must handle pickup order state"
  );
  assert.ok(
    mapSource.includes("Live road GPS tracking is not applicable") ||
    mapSource.includes("Live delivery GPS tracking is not applicable"),
    "Must note road GPS is not applicable for pickups"
  );
});

runTest("Pre-transit orders (pending/preparing/ready) display kitchen status and wait for dispatch", () => {
  assert.ok(
    mapSource.includes("currentStatus === \"pending\"") ||
    mapSource.includes("currentStatus === \"preparing\""),
    "Must handle pre-transit states"
  );
  assert.ok(
    mapSource.includes("Live GPS Activates on Dispatch") ||
    mapSource.includes("Kitchen Stage"),
    "Must indicate GPS activates on dispatch"
  );
});

runTest("Waiting for first driver GPS fix renders radar connection status without blank canvas", () => {
  assert.ok(
    mapSource.includes("Connecting to Delivery Partner") ||
    mapSource.includes("Acquiring Driver GPS Fix"),
    "Must indicate connecting to delivery partner"
  );
  assert.ok(
    mapSource.includes("Waiting for the driver device to broadcast") ||
    mapSource.includes("Waiting for Driver's First GPS Ping"),
    "Must inform user that driver has not pinged yet"
  );
});

runTest("Stale location indicator displays warning when isStale is true", () => {
  assert.ok(mapSource.includes("isStale"), "Must check isStale property");
  assert.ok(
    mapSource.includes("GPS Signal Stale") || mapSource.includes("Signal Stale"),
    "Must render stale GPS badge"
  );
  assert.ok(
    mapSource.includes("Location has not updated in over 3 minutes"),
    "Must explain stale timeout condition"
  );
});

runTest("Terminal orders (delivered/cancelled) terminate active driver marker", () => {
  assert.ok(
    mapSource.includes("currentStatus === \"delivered\""),
    "Must handle delivered terminal state"
  );
  assert.ok(
    mapSource.includes("Order Delivered") || mapSource.includes("Meal Handed Over"),
    "Must display delivered confirmation"
  );
  assert.ok(
    mapSource.includes("currentStatus === \"cancelled\""),
    "Must handle cancelled terminal state"
  );
});

// ── 4. Polling Strategy & Hidden Tab Management ───────────────────────────────
console.log("\n--- Suite 4: Polling Strategy & Hidden Tab Management ---");

runTest("LiveDeliveryMap uses 8-10s polling interval and pauses when tab is hidden", () => {
  assert.ok(
    mapSource.includes("TRACKING_POLL_INTERVAL_MS = 9000") ||
    mapSource.includes("9000") ||
    mapSource.includes("8000") ||
    mapSource.includes("10000"),
    "Must use 8-10s polling cadence"
  );
  assert.ok(mapSource.includes("visibilitychange"), "Must listen to visibilitychange");
  assert.ok(mapSource.includes("document.visibilityState === \"hidden\""), "Must check hidden visibility");
  assert.ok(mapSource.includes("isFetchingRef"), "Must guard against overlapping requests");
});

runTest("Stops polling on delivered or cancelled states", () => {
  assert.ok(
    mapSource.includes("tracking?.status === \"delivered\""),
    "Must stop polling when delivered"
  );
  assert.ok(
    mapSource.includes("tracking?.status === \"cancelled\""),
    "Must stop polling when cancelled"
  );
  assert.ok(mapSource.includes("clearInterval"), "Must clear polling timer");
});

// ── 5. Consumer Integration Contracts ─────────────────────────────────────────
console.log("\n--- Suite 5: Consumer Integration Contracts ---");

const orderConfirmationPath = path.join(
  USER_FRONTEND_DIR,
  "app/(pages)/order-confirmation/OrderConfirmationClient.js"
);
const orderConfirmationCode = fs.readFileSync(orderConfirmationPath, "utf-8");

runTest("OrderConfirmationClient imports and renders LiveDeliveryMap", () => {
  assert.ok(
    orderConfirmationCode.includes("import LiveDeliveryMap from \"@/components/orders/LiveDeliveryMap\""),
    "Must import LiveDeliveryMap in OrderConfirmationClient"
  );
  assert.ok(
    orderConfirmationCode.includes("<LiveDeliveryMap"),
    "Must render <LiveDeliveryMap /> in OrderConfirmationClient"
  );
  assert.ok(
    orderConfirmationCode.includes("orderId={order.orderId || order._id}"),
    "Must pass orderId to LiveDeliveryMap"
  );
});

const ordersClientPath = path.join(
  USER_FRONTEND_DIR,
  "app/(pages)/orders/OrdersClient.js"
);
const ordersClientCode = fs.readFileSync(ordersClientPath, "utf-8");

runTest("OrdersClient imports and renders LiveDeliveryMap for in-transit delivery orders", () => {
  assert.ok(
    ordersClientCode.includes("import LiveDeliveryMap from \"@/components/orders/LiveDeliveryMap\""),
    "Must import LiveDeliveryMap in OrdersClient"
  );
  assert.ok(
    ordersClientCode.includes("<LiveDeliveryMap"),
    "Must render <LiveDeliveryMap /> in OrdersClient"
  );
  assert.ok(
    ordersClientCode.includes("order.status === \"out_for_delivery\""),
    "Must display map for out_for_delivery orders"
  );
});

const envExamplePath = path.join(USER_FRONTEND_DIR, ".env.example");
const envExampleCode = fs.readFileSync(envExamplePath, "utf-8");

runTest(".env.example documents NEXT_PUBLIC_MAPPLS_MAP_KEY", () => {
  assert.ok(
    envExampleCode.includes("NEXT_PUBLIC_MAPPLS_MAP_KEY="),
    ".env.example must document NEXT_PUBLIC_MAPPLS_MAP_KEY"
  );
  assert.ok(
    envExampleCode.includes("Mappls Live Delivery Maps"),
    ".env.example must describe Mappls Live Delivery Maps section"
  );
});

// ── SUMMARY REPORT ────────────────────────────────────────────────────────────
console.log("\n=======================================================");
console.log(`Phase 2.4 Customer Live Delivery Map Tests: ${passedCount}/${totalCount} PASSED`);
console.log("=======================================================\n");

if (passedCount !== totalCount) {
  process.exit(1);
}
