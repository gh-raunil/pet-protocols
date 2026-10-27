import assert from "node:assert";
import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import {
  isValidCoordinate,
  calculateDistanceKm,
  getOrderDistanceInfo,
  DEFAULT_DELIVERY_RADIUS_KM,
} from "../lib/geoDistance.js";

console.log("================================================================================");
console.log(" 🧪 RUNNING PHASE 2.1 TEST SUITE: Location Data Hygiene & Schema Standardization");
console.log("================================================================================\n");

// -----------------------------------------------------------------------------
// 1. isValidCoordinate Utility Tests
// -----------------------------------------------------------------------------
console.log("--- 1. Testing isValidCoordinate() coordinate validator ---");

// Valid coordinates
assert.strictEqual(isValidCoordinate(12.9698, 79.1550), true, "Valid Vellore coordinates should be accepted");
assert.strictEqual(isValidCoordinate("12.9698", "79.1550"), true, "Valid numeric strings should be accepted");
assert.strictEqual(isValidCoordinate(0.001, -0.001), true, "Small non-zero coordinates should be accepted");
assert.strictEqual(isValidCoordinate(-90, -180), true, "Boundary coordinates should be accepted");
assert.strictEqual(isValidCoordinate(90, 180), true, "Boundary coordinates should be accepted");
console.log("  ✅ Valid coordinates properly accepted");

// Null Island (0, 0) rejection
assert.strictEqual(isValidCoordinate(0, 0), false, "(0, 0) Null Island must be rejected");
assert.strictEqual(isValidCoordinate("0", "0"), false, "('0', '0') Null Island string must be rejected");
assert.strictEqual(isValidCoordinate(0.0, 0.0), false, "(0.0, 0.0) must be rejected");
console.log("  ✅ (0, 0) Null Island explicitly rejected");

// Null / Undefined / Empty
assert.strictEqual(isValidCoordinate(null, null), false, "null coordinates must be rejected");
assert.strictEqual(isValidCoordinate(undefined, undefined), false, "undefined coordinates must be rejected");
assert.strictEqual(isValidCoordinate(null, 79.155), false, "null latitude must be rejected");
assert.strictEqual(isValidCoordinate(12.9698, null), false, "null longitude must be rejected");
assert.strictEqual(isValidCoordinate("", ""), false, "Empty strings must be rejected");
assert.strictEqual(isValidCoordinate("   ", "79.155"), false, "Whitespace latitude must be rejected");
console.log("  ✅ null, undefined, and empty string coordinates rejected");

// Non-numeric & non-finite
assert.strictEqual(isValidCoordinate("abc", 79.155), false, "NaN string must be rejected");
assert.strictEqual(isValidCoordinate(NaN, 79.155), false, "NaN must be rejected");
assert.strictEqual(isValidCoordinate(Infinity, 79.155), false, "Infinity must be rejected");
assert.strictEqual(isValidCoordinate(12.9698, -Infinity), false, "-Infinity must be rejected");
console.log("  ✅ Non-numeric and non-finite values rejected");

// Out-of-range latitude (> 90 or < -90)
assert.strictEqual(isValidCoordinate(90.1, 79.155), false, "Latitude > 90 must be rejected");
assert.strictEqual(isValidCoordinate(-90.1, 79.155), false, "Latitude < -90 must be rejected");

// Out-of-range longitude (> 180 or < -180)
assert.strictEqual(isValidCoordinate(12.9698, 180.1), false, "Longitude > 180 must be rejected");
assert.strictEqual(isValidCoordinate(12.9698, -180.1), false, "Longitude < -180 must be rejected");
console.log("  ✅ Out-of-range latitudes and longitudes rejected");


// -----------------------------------------------------------------------------
// 2. Haversine calculateDistanceKm Tests
// -----------------------------------------------------------------------------
console.log("\n--- 2. Testing calculateDistanceKm() Haversine accuracy ---");

// Same location
const zeroDist = calculateDistanceKm(12.9698, 79.1550, 12.9698, 79.1550);
assert.strictEqual(zeroDist, 0, "Distance between identical coordinates must be 0 km");

// Known distance benchmark: VIT Vellore (12.9692, 79.1559) to nearby customer (12.9750, 79.1650) ~1.18 km
const vitDist = calculateDistanceKm(12.9692, 79.1559, 12.9750, 79.1650);
assert.strictEqual(vitDist, 1.18, `Expected distance ~1.18 km, got ${vitDist}`);

// Invalid input returns null
assert.strictEqual(calculateDistanceKm(null, 79.155, 12.975, 79.165), null, "Invalid lat1 must return null");
assert.strictEqual(calculateDistanceKm(0, 0, 12.975, 79.165), null, "Null island lat1/lon1 must return null");
assert.strictEqual(calculateDistanceKm(12.9692, 79.1559, 0, 0), null, "Null island lat2/lon2 must return null");
console.log("  ✅ Haversine distance accuracy and invalid-coordinate handling verified");


// -----------------------------------------------------------------------------
// 3. Fallback Removal in getOrderDistanceInfo() Tests
// -----------------------------------------------------------------------------
console.log("\n--- 3. Testing getOrderDistanceInfo() without fallback injection ---");

// Scenario A: Restaurant coordinates are missing (null) while customer coordinates are in Vellore (~12.97)
const orderWithMissingRestCoords = {
  address: { latitude: 12.973, longitude: 79.159 },
  restaurant: {
    address: { street: "Unknown Street", city: "Vellore", latitude: null, longitude: null },
    deliverySettings: { deliveryRadiusKm: 10 },
  },
};
const infoA = getOrderDistanceInfo(orderWithMissingRestCoords);
assert.strictEqual(infoA.restCoords, null, "Restaurant coords must be null (NO fallback injected)");
assert.strictEqual(infoA.distanceKm, null, "Distance must be null when restaurant coords are missing");
assert.strictEqual(infoA.hasValidDistance, false, "hasValidDistance must be false");
assert.strictEqual(infoA.isServiceable, false, "Delivery must NOT be serviceable without valid restaurant coords");
console.log("  ✅ No fallback coordinates injected when restaurant coords are null");

// Scenario B: Restaurant coordinates are (0, 0)
const orderWithZeroRestCoords = {
  address: { latitude: 12.973, longitude: 79.159 },
  restaurant: {
    address: { street: "Null Island Diner", latitude: 0, longitude: 0 },
    deliverySettings: { deliveryRadiusKm: 10 },
  },
};
const infoB = getOrderDistanceInfo(orderWithZeroRestCoords);
assert.strictEqual(infoB.restCoords, null, "Restaurant coords must be null when (0, 0)");
assert.strictEqual(infoB.distanceKm, null, "Distance must be null for (0, 0)");
assert.strictEqual(infoB.hasValidDistance, false, "hasValidDistance must be false for (0, 0)");
assert.strictEqual(infoB.isServiceable, false, "Delivery must NOT be serviceable for (0, 0)");
console.log("  ✅ (0, 0) Null Island restaurant coordinates rejected without fallback injection");

// Scenario C: Customer coordinates are missing
const orderWithMissingCustCoords = {
  address: { street: "123 Main St", latitude: null, longitude: null },
  restaurant: {
    address: { latitude: 12.9698, longitude: 79.1550 },
    deliverySettings: { deliveryRadiusKm: 10 },
  },
};
const infoC = getOrderDistanceInfo(orderWithMissingCustCoords);
assert.strictEqual(infoC.distanceKm, null, "Distance must be null when customer coordinates are missing");
assert.strictEqual(infoC.hasValidDistance, false, "hasValidDistance must be false");
assert.strictEqual(infoC.isServiceable, false, "Order must NOT be serviceable when destination is unknown");
console.log("  ✅ Missing customer coordinates produce unserviceable result");

// Scenario D: Valid within-range delivery order
const validNearbyOrder = {
  address: { latitude: 12.9750, longitude: 79.1650 },
  restaurant: {
    address: { latitude: 12.9692, longitude: 79.1559 },
    deliverySettings: { deliveryRadiusKm: 10 },
  },
};
const infoD = getOrderDistanceInfo(validNearbyOrder);
assert.strictEqual(infoD.distanceKm, 1.18, "Distance must be 1.18 km");
assert.strictEqual(infoD.isOutOfRange, false, "Nearby order must not be out of range");
assert.strictEqual(infoD.hasValidDistance, true, "hasValidDistance must be true");
assert.strictEqual(infoD.isServiceable, true, "Order must be serviceable");
console.log("  ✅ Valid nearby order correctly evaluated as serviceable");

// Scenario E: Pickup order override
const pickupOrderMissingCoords = {
  orderType: "pickup",
  address: { street: "Counter Pickup", latitude: null, longitude: null },
  restaurant: {
    address: { latitude: 12.9692, longitude: 79.1559 },
    deliverySettings: { deliveryRadiusKm: 10 },
  },
};
const infoE = getOrderDistanceInfo(pickupOrderMissingCoords);
assert.strictEqual(infoE.isServiceable, true, "Pickup orders are always serviceable regardless of customer coordinates");
console.log("  ✅ Pickup order override preserved");


// -----------------------------------------------------------------------------
// 4. Restaurant Mongoose Schema Defaults & Validation Tests
// -----------------------------------------------------------------------------
console.log("\n--- 4. Testing Restaurant model schema defaults & validation ---");

// Test 4.1: Default coordinates must be null, not 0
const draftRest = new Restaurant({
  name: "Draft Kitchen",
  slug: "draft-kitchen",
  status: "inactive",
});
assert.strictEqual(draftRest.address.latitude, null, "Restaurant address.latitude default must be null (not 0)");
assert.strictEqual(draftRest.address.longitude, null, "Restaurant address.longitude default must be null (not 0)");
console.log("  ✅ Default restaurant coordinates are null, not 0");

// Test 4.2: Draft / Inactive restaurant with null coordinates validates cleanly
const draftValidationError = draftRest.validateSync();
assert.strictEqual(draftValidationError, undefined, "Inactive/draft restaurant must validate with null coordinates");
console.log("  ✅ Inactive/draft restaurant saved with null coordinates without error");

// Test 4.3: Active delivery restaurant with null coordinates MUST fail validation
const activeRestWithoutCoords = new Restaurant({
  name: "Unmapped Active Kitchen",
  slug: "unmapped-active-kitchen",
  status: "active",
  deliverySettings: { deliveryEnabled: true },
  orderTypes: { delivery: true },
});
const activeErr = activeRestWithoutCoords.validateSync();
assert.ok(activeErr, "Active delivery restaurant without coordinates must fail validation");
assert.ok(activeErr.errors["address.latitude"], "Validation error on address.latitude expected");
assert.ok(activeErr.errors["address.longitude"], "Validation error on address.longitude expected");
console.log("  ✅ Active delivery restaurant with null coordinates rejected by pre-validate hook");

// Test 4.4: Active delivery restaurant with (0, 0) coordinates MUST fail validation
const activeRestZeroCoords = new Restaurant({
  name: "Null Island Active Kitchen",
  slug: "null-island-active-kitchen",
  status: "active",
  address: { latitude: 0, longitude: 0 },
  deliverySettings: { deliveryEnabled: true },
  orderTypes: { delivery: true },
});
const zeroErr = activeRestZeroCoords.validateSync();
assert.ok(zeroErr, "Active delivery restaurant with (0, 0) coordinates must fail validation");
assert.ok(zeroErr.errors["address.latitude"], "Validation error on address.latitude expected for (0, 0)");
console.log("  ✅ Active delivery restaurant with (0, 0) coordinates rejected by pre-validate hook");

// Test 4.5: Active delivery restaurant with valid coordinates validates cleanly
const activeValidRest = new Restaurant({
  name: "Valid Active Kitchen",
  slug: "valid-active-kitchen",
  status: "active",
  address: {
    street: "123 Vellore Road",
    city: "Vellore",
    state: "Tamil Nadu",
    pincode: "632014",
    latitude: 12.9698,
    longitude: 79.1550,
  },
  deliverySettings: { deliveryEnabled: true },
  orderTypes: { delivery: true },
});
const validErr = activeValidRest.validateSync();
assert.strictEqual(validErr, undefined, "Active restaurant with valid coordinates must validate cleanly");
console.log("  ✅ Active restaurant with valid coordinates validates successfully");

// Test 4.6: Out of range coordinates fail field-level validation
const outOfRangeRest = new Restaurant({
  name: "Out of Range Kitchen",
  slug: "out-of-range-kitchen",
  status: "inactive",
  address: {
    latitude: 195.5, // > 90
    longitude: 79.1550,
  },
});
const outOfRangeErr = outOfRangeRest.validateSync();
assert.ok(outOfRangeErr, "Out-of-range latitude must fail validation");
assert.ok(outOfRangeErr.errors["address.latitude"], "Field error on address.latitude expected");
console.log("  ✅ Out-of-range latitude (> 90) rejected by field-level validator");

console.log("\n================================================================================");
console.log("🎉 ALL TESTS PASSED! Phase 2.1 Location Data Hygiene & Schema Standardization Verified");
console.log("================================================================================\n");

process.exit(0);
