import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_FRONTEND_DIR = path.resolve(__dirname, "..");

const trackerPath = path.join(USER_FRONTEND_DIR, "components/orders/OrderStatusTracker.js");
assert.ok(fs.existsSync(trackerPath), "OrderStatusTracker.js must exist");
const trackerCode = fs.readFileSync(trackerPath, "utf-8");

console.log("=== Testing OrderStatusTracker Delivery Handover OTP Contracts ===");

// Test 1: Status normalization & state flags
assert.ok(
  trackerCode.includes('normalizedStatus = status?.toLowerCase()?.trim() || "pending"'),
  "Must robustly normalize status string to lowercase and trimmed"
);
assert.ok(
  trackerCode.includes('isOutForDelivery = normalizedStatus === "out_for_delivery"'),
  "Must compute isOutForDelivery from normalized status"
);
assert.ok(
  trackerCode.includes('isDelivered = normalizedStatus === "delivered"'),
  "Must compute isDelivered from normalized status"
);
console.log("✓ PASS: Normalized status state flags");

// Test 2: Unconditional display of OTP card for all active delivery orders
assert.ok(
  trackerCode.includes("!isPickup && orderId && !isCancelled && !isFailed"),
  "Must render OTP card for all active delivery orders regardless of pre-dispatch status"
);
console.log("✓ PASS: OTP card rendered for all active delivery orders");

// Test 3: Standby state for pending/preparing stages
assert.ok(
  trackerCode.includes("Active Upon Dispatch"),
  "Must display 'Active Upon Dispatch' badge during pre-dispatch standby"
);
assert.ok(
  trackerCode.includes("••••"),
  "Must display masked 4-digit preview during pre-dispatch standby"
);
assert.ok(
  trackerCode.includes("Your secure 4-digit code will appear here once your food order is picked up and out for delivery"),
  "Must display helpful explanatory copy during pre-dispatch standby"
);
console.log("✓ PASS: Pre-dispatch standby state displays helpful masked preview and instructions");

// Test 4: Active state when out for delivery
assert.ok(
  trackerCode.includes("Proof of Handover"),
  "Must display 'Proof of Handover' badge when out for delivery"
);
assert.ok(
  trackerCode.includes("otpData.otpCode"),
  "Must display live 4-digit OTP code when out for delivery"
);
assert.ok(
  trackerCode.includes("handleCopyCode"),
  "Must provide click-to-copy handler for the handover code"
);
assert.ok(
  trackerCode.includes("handleReissueOtp"),
  "Must provide reissue handler for customer"
);
assert.ok(
  trackerCode.includes("reissueCooldown"),
  "Must enforce reissue cooldown countdown"
);
console.log("✓ PASS: Active state displays 4-digit code with copy & reissue");

// Test 5: Completed handover state when delivered
assert.ok(
  trackerCode.includes("Handover OTP Verified & Package Delivered"),
  "Must display verified completion banner once delivered"
);
console.log("✓ PASS: Completed handover banner displayed once delivered");

// Test 6: Backend fetch reacts to out_for_delivery transitions
assert.ok(
  trackerCode.includes("fetchHandoverOtp"),
  "Must define fetchHandoverOtp callback"
);
assert.ok(
  trackerCode.includes("/api/orders/${orderId}/handover-otp"),
  "Must fetch from the authoritative customer handover OTP endpoint"
);
console.log("✓ PASS: fetchHandoverOtp endpoint contract verified");

console.log("🎉 ALL ORDER STATUS TRACKER OTP TESTS PASSED!");
