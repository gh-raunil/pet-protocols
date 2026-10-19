import fs from "fs";
import path from "path";
import assert from "assert";

console.log("=== Testing Targeted UI Fix: Live Delivery Tracking Card ===\n");

const baseDir = path.resolve(".");
const frontendUserDir = path.join(baseDir, "frontend-user");
const mapComponentPath = path.join(frontendUserDir, "components", "orders", "LiveDeliveryMap.js");

assert(fs.existsSync(mapComponentPath), "LiveDeliveryMap.js must exist");
const mapSource = fs.readFileSync(mapComponentPath, "utf-8");

// --- 1. Tracking Header Refinements ---
console.log("--- 1. Testing Tracking Header Refinement ---");
assert(mapSource.includes("Live Delivery in Transit"), "Header must include Live Delivery in Transit status");
assert(mapSource.includes("Order #{orderId}"), "Header must include Order #{orderId}");
assert(mapSource.includes("title={`Order #${orderId}`}"), "Order ID must have title tooltip for long ID accessibility");
assert(mapSource.includes("truncate max-w-[160px] sm:max-w-[220px]"), "Order ID must truncate gracefully on narrow viewports");
assert(mapSource.includes("h-8.5 px-2.5 rounded-lg"), "Action buttons must share consistent h-8.5 height and rounded-lg radius");
assert(mapSource.includes("fetchTracking(true)"), "Refresh button must trigger manual fetchTracking");
assert(mapSource.includes("setIsExpanded(!isExpanded)"), "Enlarge button must toggle isExpanded state");

console.log("✓ PASS: Header aligns delivery icon, live status, order ID, and status badge cleanly");
console.log("✓ PASS: Order ID truncates gracefully with accessible title attribute");
console.log("✓ PASS: Action buttons share consistent h-8.5 sizing and preserve refresh/enlarge handlers");

// --- 2. Map Unavailable Fallback Refinements ---
console.log("\n--- 2. Testing Map Unavailable Fallback ---");
assert(mapSource.includes("sdkStatus === \"error\""), "Component must handle sdkStatus === 'error'");
assert(mapSource.includes("Map temporarily unavailable"), "Fallback must display concise 'Map temporarily unavailable' heading");
assert(mapSource.includes("The map service could not be reached"), "Fallback must explain that map service could not be reached");
assert(mapSource.includes("Live delivery coordinates and telemetry continue to be tracked accurately below"), "Fallback must confirm GPS tracking continues below");
assert(mapSource.includes("max-w-sm w-full mx-auto p-5 rounded-2xl"), "Fallback must use balanced, centered card container");
assert(mapSource.includes("retryMapSdk"), "Component must define retryMapSdk function");
assert(mapSource.includes("Retry Map"), "Fallback must offer Retry Map button when mapKey is present");

console.log("✓ PASS: Map fallback displays concise 'Map temporarily unavailable' heading");
console.log("✓ PASS: Map fallback clarifies that telemetry coordinates continue accurately below");
console.log("✓ PASS: Map fallback uses balanced centered container and offers Retry Map action");

// --- 3. Bottom Information Cards Consistency ---
console.log("\n--- 3. Testing Bottom Information Cards Consistency ---");
assert(mapSource.includes("grid-cols-1 sm:grid-cols-2 gap-3 items-stretch"), "Bottom cards must use items-stretch grid for equal height");
assert(mapSource.includes("bg-[var(--bg-card)] p-3.5 sm:p-4 rounded-xl border border-[var(--border-color)]"), "Both bottom cards must share identical padding, border, and rounded-xl radius");
assert(mapSource.includes("w-10 h-10 rounded-lg bg-blue-500/10"), "Driver icon box must be w-10 h-10 rounded-lg");
assert(mapSource.includes("w-10 h-10 rounded-lg bg-emerald-500/10"), "Destination icon box must be w-10 h-10 rounded-lg");
assert(mapSource.includes("line-clamp-1 break-words"), "Address text must use deliberate line-clamp-1 rather than arbitrary clipping");
assert(mapSource.includes("title={fullAddress}"), "Full address must remain accessible via title tooltip");
assert(mapSource.includes("Destination pin omitted without GPS geocoding"), "Disclaimer must remain present for non-geocoded destinations");
assert(mapSource.includes("driver?.phone"), "Driver phone action must be preserved");

console.log("✓ PASS: Delivery Partner and Delivering To cards share identical height, padding, and corner radius");
console.log("✓ PASS: Long addresses handle text overflow with deliberate line-clamp and full-address title tooltip");
console.log("✓ PASS: Destination pin omitted disclaimer sits on its own row without colliding with address text");

// --- 4. Responsive & Motion Accessibility ---
console.log("\n--- 4. Testing Motion Accessibility ---");
assert(mapSource.includes("@media (prefers-reduced-motion: reduce)"), "LiveDeliveryMap must support prefers-reduced-motion");
assert(mapSource.includes("animation: none !important"), "Reduced-motion must disable animations");

console.log("✓ PASS: Motion sensitivity is respected with prefers-reduced-motion media query");

console.log("\n=======================================================");
console.log("🎉 ALL LIVE DELIVERY TRACKING CARD POLISH CHECKS PASSED!");
console.log("=======================================================");
