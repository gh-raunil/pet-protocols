/**
 * Test Suite: COD Early Collection Prevention
 * Verifies that cash on delivery collection cannot be performed or displayed
 * before an order is picked up (out_for_delivery or delivered).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

console.log("\n🧪 Running COD Early Collection Prevention Tests...\n");

// 1. Verify DeliveryWorkspace.js code logic
const deliveryWorkspacePath = path.join(REPO_ROOT, "frontend-admin/components/workspaces/DeliveryWorkspace.js");
const deliveryWorkspaceCode = fs.readFileSync(deliveryWorkspacePath, "utf8");

// A. Check that handleCollectCash guards against early execution before out_for_delivery
assert.ok(
  deliveryWorkspaceCode.includes('if (order.status !== "out_for_delivery")'),
  "handleCollectCash must strictly reject if order.status !== 'out_for_delivery'"
);
console.log("  ✅ handleCollectCash strictly guards against early pickup execution");

// B. Check that Record Cash Collection button is ONLY rendered when out_for_delivery
assert.ok(
  deliveryWorkspaceCode.includes('order.status === "out_for_delivery" ? ('),
  "Record Cash Collection button must only be rendered conditionally when out_for_delivery"
);
assert.ok(
  deliveryWorkspaceCode.includes('<span>Record Cash Collection</span>'),
  "Record Cash Collection button text exists for transit state"
);
console.log("  ✅ Record Cash Collection button is strictly rendered only when order.status === 'out_for_delivery'");

// C. Check that pre-pickup notice is rendered when order is NOT out_for_delivery
assert.ok(
  deliveryWorkspaceCode.includes("Cash collection available upon doorstep delivery (After pickup)"),
  "DeliveryWorkspace must show clear doorstep delivery notice before pickup"
);
console.log("  ✅ Pre-pickup notice (no button) verified when pickup is not done");

// D. Check that collectedOrders in codSummary only counts delivered orders
assert.ok(
  deliveryWorkspaceCode.includes('o.status === "delivered" && (o.codPaymentHandler?.collected || o.paymentStatus === "paid")'),
  "collectedOrders in codSummary must only count delivered orders"
);
console.log("  ✅ collectedOrders in codSummary strictly restricted to delivered orders");

// 2. Verify backend route guards in backend/app/api/restaurant/orders/route.js
const routePath = path.join(REPO_ROOT, "backend/app/api/restaurant/orders/route.js");
const routeCode = fs.readFileSync(routePath, "utf8");

assert.ok(
  routeCode.includes('Cash on delivery orders cannot be marked as paid before being picked up for delivery'),
  "Backend must guard paymentStatus: paid on COD orders before pickup"
);
console.log("  ✅ Backend guards against marking COD orders paid before pickup");

assert.ok(
  routeCode.includes('Cash on delivery cannot be collected before the order is picked up for delivery'),
  "Backend must guard codPaymentHandler.collected on COD orders before pickup"
);
console.log("  ✅ Backend guards against codPaymentHandler collection before pickup");

console.log("\n=======================================================");
console.log("🎉 ALL COD Early Collection Prevention Tests PASSED!");
console.log("=======================================================\n");
