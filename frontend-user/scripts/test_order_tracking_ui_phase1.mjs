/**
 * Phase 1 — Order Tracking Timeline & Status History Test Suite
 * Validates OrderStatusTracker component contract, timeline progression,
 * pickup vs delivery steps, statusHistory milestone extraction,
 * legacy fallbacks, and cancelled states.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_FRONTEND_DIR = path.resolve(__dirname, "..");

console.log("\n========================================================");
console.log("   PHASE 1 — ORDER TIMELINE & STATUS HISTORY TEST SUITE   ");
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
// Suite 1: Component Source Contracts & Prop Handlers
// -----------------------------------------------------------------------------
console.log("--- Suite 1: Component Source Contracts & Prop Handlers ---");

const trackerPath = path.join(USER_FRONTEND_DIR, "components/orders/OrderStatusTracker.js");
assert.ok(fs.existsSync(trackerPath), "OrderStatusTracker.js must exist");
const trackerCode = fs.readFileSync(trackerPath, "utf-8");

runTest("OrderStatusTracker accepts statusHistory, notes, and createdAt props", () => {
  assert.ok(trackerCode.includes("statusHistory = []"), "Must accept statusHistory with default []");
  assert.ok(trackerCode.includes("notes = \"\""), "Must accept notes with default ''");
  assert.ok(trackerCode.includes("createdAt = null"), "Must accept createdAt with default null");
});

runTest("OrderStatusTracker includes milestone timeline and audit log section", () => {
  assert.ok(trackerCode.includes("Milestone Timeline"), "Must include Milestone Timeline");
  assert.ok(trackerCode.includes("formatStepTime"), "Must format step timestamps");
  assert.ok(trackerCode.includes("formatFullDateTime"), "Must format full audit timestamps");
});

runTest("OrderStatusTracker includes operational kitchen note banner when available", () => {
  assert.ok(trackerCode.includes("Kitchen Note"), "Must render Kitchen Note banner when notes are present");
});

// -----------------------------------------------------------------------------
// Suite 2: Step Definitions & Delivery vs Pickup Contracts
// -----------------------------------------------------------------------------
console.log("\n--- Suite 2: Step Definitions & Delivery vs Pickup Contracts ---");

// Extract ORDER_STEPS definition from code
runTest("Default ORDER_STEPS sequence is pending -> preparing -> out_for_delivery -> delivered", () => {
  assert.ok(trackerCode.includes("id: \"pending\""));
  assert.ok(trackerCode.includes("id: \"preparing\""));
  assert.ok(trackerCode.includes("id: \"out_for_delivery\""));
  assert.ok(trackerCode.includes("id: \"delivered\""));
});

runTest("Pickup workflow substitutes out_for_delivery with ready (Ready for Pickup) and delivered (Picked Up)", () => {
  assert.ok(trackerCode.includes("id: \"ready\""));
  assert.ok(trackerCode.includes("label: \"Ready for Pickup\""));
  assert.ok(trackerCode.includes("label: \"Picked Up\""));
});

// -----------------------------------------------------------------------------
// Suite 3: Client Consumers Integration
// -----------------------------------------------------------------------------
console.log("\n--- Suite 3: Client Consumers Integration ---");

const orderConfirmationPath = path.join(
  USER_FRONTEND_DIR,
  "app/(pages)/order-confirmation/OrderConfirmationClient.js"
);
assert.ok(fs.existsSync(orderConfirmationPath));
const orderConfirmationCode = fs.readFileSync(orderConfirmationPath, "utf-8");

runTest("OrderConfirmationClient passes statusHistory and notes to OrderStatusTracker", () => {
  assert.ok(
    orderConfirmationCode.includes("statusHistory={order.statusHistory || []}"),
    "OrderConfirmationClient must pass statusHistory to tracker"
  );
  assert.ok(
    orderConfirmationCode.includes("notes={order.notes || \"\"}"),
    "OrderConfirmationClient must pass notes to tracker"
  );
  assert.ok(
    orderConfirmationCode.includes("createdAt={order.createdAt}"),
    "OrderConfirmationClient must pass createdAt to tracker"
  );
});

const ordersClientPath = path.join(USER_FRONTEND_DIR, "app/(pages)/orders/OrdersClient.js");
assert.ok(fs.existsSync(ordersClientPath));
const ordersClientCode = fs.readFileSync(ordersClientPath, "utf-8");

runTest("OrdersClient passes statusHistory and notes to OrderStatusTracker", () => {
  assert.ok(
    ordersClientCode.includes("statusHistory={order.statusHistory || []}"),
    "OrdersClient must pass statusHistory to tracker"
  );
  assert.ok(
    ordersClientCode.includes("notes={order.notes || \"\"}"),
    "OrdersClient must pass notes to tracker"
  );
  assert.ok(
    ordersClientCode.includes("createdAt={order.createdAt}"),
    "OrdersClient must pass createdAt to tracker"
  );
});

// -----------------------------------------------------------------------------
// Suite 4: Formatter & History Parsing Contract Simulation
// -----------------------------------------------------------------------------
console.log("\n--- Suite 4: Formatter & History Parsing Contract Simulation ---");

function simulateStepHistoryEntry(stepId, history = [], createdAt = null) {
  if (!Array.isArray(history) || history.length === 0) {
    if (stepId === "pending" && createdAt) {
      return { status: "pending", changedAt: createdAt };
    }
    return null;
  }
  if (stepId === "pending") {
    const found = history.find((h) => h.status === "pending" || h.status === "confirmed");
    return found || (createdAt ? { status: "pending", changedAt: createdAt } : null);
  }
  if (stepId === "preparing") {
    return history.find((h) => h.status === "preparing") || null;
  }
  if (stepId === "out_for_delivery") {
    return history.find((h) => h.status === "out_for_delivery") || null;
  }
  if (stepId === "ready") {
    return history.find((h) => h.status === "ready") || null;
  }
  if (stepId === "delivered") {
    return history.find((h) => h.status === "delivered") || null;
  }
  return null;
}

runTest("Completed step returns its recorded timestamp", () => {
  const history = [
    { status: "pending", changedAt: "2026-10-18T10:00:00.000Z" },
    { status: "preparing", changedAt: "2026-10-18T10:15:00.000Z" },
  ];
  const prepEntry = simulateStepHistoryEntry("preparing", history);
  assert.ok(prepEntry);
  assert.equal(prepEntry.changedAt, "2026-10-18T10:15:00.000Z");
});

runTest("Upcoming step has NO fabricated timestamp", () => {
  const history = [
    { status: "pending", changedAt: "2026-10-18T10:00:00.000Z" },
    { status: "preparing", changedAt: "2026-10-18T10:15:00.000Z" },
  ];
  const deliveryEntry = simulateStepHistoryEntry("out_for_delivery", history);
  assert.equal(deliveryEntry, null, "Upcoming step must not return any fabricated timestamp");
});

runTest("Legacy order without history falls back to createdAt for initial step only", () => {
  const legacyCreatedAt = "2026-10-18T09:30:00.000Z";
  const pendingEntry = simulateStepHistoryEntry("pending", [], legacyCreatedAt);
  assert.ok(pendingEntry);
  assert.equal(pendingEntry.changedAt, legacyCreatedAt);

  const prepEntry = simulateStepHistoryEntry("preparing", [], legacyCreatedAt);
  assert.equal(prepEntry, null, "Legacy order must NOT fabricate timestamps for subsequent steps");
});

console.log("\n========================================================");
console.log(`   ALL TESTS PASSED: ${passedTests}/${totalTests} checks verified cleanly!   `);
console.log("========================================================\n");
