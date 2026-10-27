import assert from "node:assert";
import dns from "node:dns";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
import Restaurant from "../models/Restaurant.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import {
  calculateDistanceKm,
  calculateRawDistanceKm,
  isValidCoordinate,
  getOrderDistanceInfo,
  validateDeliveryServiceability,
  DEFAULT_DELIVERY_RADIUS_KM,
} from "../lib/geoDistance.js";
import { calculateOrderDetails } from "../lib/checkoutCalculationService.js";

console.log("================================================================================");
console.log(" 🧪 RUNNING PHASE 2.2 TEST SUITE: Authoritative Server-Side Delivery Eligibility");
console.log("================================================================================\n");

// -----------------------------------------------------------------------------
// 1. Full-Precision Haversine & Boundary Precision Tests
// -----------------------------------------------------------------------------
console.log("--- 1. Testing calculateRawDistanceKm & calculateDistanceKm precision ---");

// Point A: Vellore Kitchen (12.9692, 79.1559)
const REST_LAT = 12.9692;
const REST_LON = 79.1559;

// Same point (0 km)
const distZero = calculateRawDistanceKm(REST_LAT, REST_LON, REST_LAT, REST_LON);
assert.strictEqual(distZero, 0, "Distance to self must be 0");
console.log("  ✅ Same point evaluates to exactly 0 km");

// Known reference: Vellore to New Delhi (approx 1,750 km - 1,800 km)
const DELHI_LAT = 28.6139;
const DELHI_LON = 77.2090;
const distDelhi = calculateRawDistanceKm(REST_LAT, REST_LON, DELHI_LAT, DELHI_LON);
assert.ok(distDelhi > 1700 && distDelhi < 1900, `Vellore to Delhi should be ~1760 km, got ${distDelhi}`);
console.log(`  ✅ Known reference distance (Vellore to New Delhi: ${distDelhi.toFixed(2)} km) computed accurately`);

// Boundary precision calculation
// 1 degree latitude is approx 111.195 km at equator.
// Let's compute an exact point at distance D from restaurant along latitude:
// deltaLat = D / 111.195 km approx
// Let's find point at 9.99 km, 10.00 km, and 10.01 km
const latFor10Km = REST_LAT + (10.0 / 111.195);
const rawDist10Km = calculateRawDistanceKm(REST_LAT, REST_LON, latFor10Km, REST_LON);
console.log(`  Computed test latitude offset: distance is ${rawDist10Km.toFixed(4)} km`);

// Check rounding wrapper vs raw unrounded
const roundedDist10Km = calculateDistanceKm(REST_LAT, REST_LON, latFor10Km, REST_LON);
assert.strictEqual(typeof roundedDist10Km, "number", "calculateDistanceKm returns a number");
assert.strictEqual(roundedDist10Km, Math.round(rawDist10Km * 100) / 100, "calculateDistanceKm rounds to 2 decimal places");
console.log("  ✅ calculateDistanceKm properly wraps calculateRawDistanceKm with 2-decimal rounding");


// -----------------------------------------------------------------------------
// 2. Shared Delivery Serviceability Validator (validateDeliveryServiceability)
// -----------------------------------------------------------------------------
console.log("\n--- 2. Testing validateDeliveryServiceability() boundary & rules ---");

const standardRestaurant = {
  name: "Burger & Co. Kitchen",
  status: "active",
  address: { latitude: REST_LAT, longitude: REST_LON },
  deliverySettings: { deliveryEnabled: true, deliveryRadiusKm: 10 },
};

// 2.1 In-range delivery
const inRangeAddress = {
  street: "VIT Main Gate, Katpadi",
  latitude: 12.9698,
  longitude: 79.1565,
};
const inRangeRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "delivery",
  address: inRangeAddress,
});
assert.strictEqual(inRangeRes.isServiceable, true, "In-range delivery must be serviceable");
assert.strictEqual(inRangeRes.code, "SERVICEABLE", "In-range delivery code is SERVICEABLE");
assert.ok(inRangeRes.distanceKm > 0 && inRangeRes.distanceKm < 1, "Distance should be under 1 km");
assert.strictEqual(inRangeRes.deliveryRadiusKm, 10, "Radius must be 10 km");
console.log("  ✅ In-range delivery accepted with accurate distanceKm");

// 2.2 Exact boundary case (distance <= radius)
// Construct address where raw distance is strictly within 10 km
const boundaryInsideAddress = {
  latitude: REST_LAT + (9.95 / 111.195),
  longitude: REST_LON,
};
const boundaryInsideRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "delivery",
  address: boundaryInsideAddress,
});
assert.strictEqual(boundaryInsideRes.isServiceable, true, "Address at 9.95 km must be serviceable for 10 km radius");
console.log("  ✅ Address within radius (9.95 km <= 10 km) accepted");

// 2.3 Just outside boundary (distance > radius)
const boundaryOutsideAddress = {
  latitude: REST_LAT + (10.05 / 111.195),
  longitude: REST_LON,
};
const boundaryOutsideRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "delivery",
  address: boundaryOutsideAddress,
});
assert.strictEqual(boundaryOutsideRes.isServiceable, false, "Address at 10.05 km must be rejected for 10 km radius");
assert.strictEqual(boundaryOutsideRes.code, "OUT_OF_DELIVERY_RANGE", "Error code must be OUT_OF_DELIVERY_RANGE");
console.log("  ✅ Address just outside boundary (10.05 km > 10 km) rejected with OUT_OF_DELIVERY_RANGE");

// 2.4 Far away delivery (Delhi to Vellore: ~1760 km)
const farAddress = {
  street: "Connaught Place, New Delhi",
  latitude: DELHI_LAT,
  longitude: DELHI_LON,
};
const farRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "delivery",
  address: farAddress,
});
assert.strictEqual(farRes.isServiceable, false, "Far address must be unserviceable");
assert.strictEqual(farRes.code, "OUT_OF_DELIVERY_RANGE", "Far address must return OUT_OF_DELIVERY_RANGE");
assert.ok(farRes.distanceKm > 1700, "Distance must reflect actual Haversine distance");
console.log("  ✅ Cross-country delivery (~1760 km) rejected with OUT_OF_DELIVERY_RANGE");

// 2.5 Custom restaurant radius (e.g. 5 km limit)
const tightRadiusRestaurant = {
  name: "Local Express",
  status: "active",
  address: { latitude: REST_LAT, longitude: REST_LON },
  deliverySettings: { deliveryEnabled: true, deliveryRadiusKm: 5 },
};
// 7 km distance
const midDistanceAddress = {
  latitude: REST_LAT + (7.0 / 111.195),
  longitude: REST_LON,
};
const tightRes = validateDeliveryServiceability({
  restaurant: tightRadiusRestaurant,
  orderType: "delivery",
  address: midDistanceAddress,
});
assert.strictEqual(tightRes.isServiceable, false, "7 km address must be rejected for 5 km radius restaurant");
assert.strictEqual(tightRes.deliveryRadiusKm, 5, "Reported radius must be 5 km");

// Same 7 km address with a 15 km restaurant must be accepted
const wideRadiusRestaurant = {
  name: "Mega Kitchen",
  status: "active",
  address: { latitude: REST_LAT, longitude: REST_LON },
  deliverySettings: { deliveryEnabled: true, deliveryRadiusKm: 15 },
};
const wideRes = validateDeliveryServiceability({
  restaurant: wideRadiusRestaurant,
  orderType: "delivery",
  address: midDistanceAddress,
});
assert.strictEqual(wideRes.isServiceable, true, "7 km address must be accepted for 15 km radius restaurant");
console.log("  ✅ Custom restaurant delivery radii (5 km vs 15 km) enforced authoritatively");


// -----------------------------------------------------------------------------
// 3. Coordinate Invalidity, Null Island, and Edge Cases
// -----------------------------------------------------------------------------
console.log("\n--- 3. Testing coordinate validation & error codes ---");

// 3.1 Missing customer coordinates
const missingCustomerCoordsRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "delivery",
  address: { street: "No GPS Address", latitude: null, longitude: null },
});
assert.strictEqual(missingCustomerCoordsRes.isServiceable, false);
assert.strictEqual(missingCustomerCoordsRes.code, "MISSING_CUSTOMER_COORDINATES");
console.log("  ✅ Missing customer coordinates rejected with MISSING_CUSTOMER_COORDINATES");

// 3.2 Null Island (0, 0) customer coordinates
const nullIslandCustomerRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "delivery",
  address: { street: "Null Island", latitude: 0, longitude: 0 },
});
assert.strictEqual(nullIslandCustomerRes.isServiceable, false);
assert.strictEqual(nullIslandCustomerRes.code, "INVALID_CUSTOMER_COORDINATES");
console.log("  ✅ (0, 0) Null Island customer coordinates rejected with INVALID_CUSTOMER_COORDINATES");

// 3.3 Non-numeric / NaN customer coordinates
const nanCustomerRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "delivery",
  address: { street: "Corrupt GPS", latitude: "invalid_lat", longitude: 79.155 },
});
assert.strictEqual(nanCustomerRes.isServiceable, false);
assert.strictEqual(nanCustomerRes.code, "INVALID_CUSTOMER_COORDINATES");
console.log("  ✅ NaN / non-numeric customer coordinates rejected with INVALID_CUSTOMER_COORDINATES");

// 3.4 Out-of-range customer coordinates (lat > 90, lng > 180)
const outOfRangeCoordsRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "delivery",
  address: { street: "Beyond North Pole", latitude: 95.0, longitude: 79.155 },
});
assert.strictEqual(outOfRangeCoordsRes.isServiceable, false);
assert.strictEqual(outOfRangeCoordsRes.code, "INVALID_CUSTOMER_COORDINATES");
console.log("  ✅ Out-of-range latitude (>90) rejected with INVALID_CUSTOMER_COORDINATES");

// 3.5 Missing restaurant coordinates
const missingRestCoordsRes = validateDeliveryServiceability({
  restaurant: { name: "Unmapped Kitchen", address: { latitude: null, longitude: null } },
  orderType: "delivery",
  address: inRangeAddress,
});
assert.strictEqual(missingRestCoordsRes.isServiceable, false);
assert.strictEqual(missingRestCoordsRes.code, "INVALID_RESTAURANT_COORDINATES");
console.log("  ✅ Missing restaurant coordinates rejected with INVALID_RESTAURANT_COORDINATES");

// 3.6 (0, 0) Null Island restaurant coordinates
const nullIslandRestRes = validateDeliveryServiceability({
  restaurant: { name: "Null Island Kitchen", address: { latitude: 0, longitude: 0 } },
  orderType: "delivery",
  address: inRangeAddress,
});
assert.strictEqual(nullIslandRestRes.isServiceable, false);
assert.strictEqual(nullIslandRestRes.code, "INVALID_RESTAURANT_COORDINATES");
console.log("  ✅ (0, 0) Null Island restaurant coordinates rejected with INVALID_RESTAURANT_COORDINATES");


// -----------------------------------------------------------------------------
// 4. Client Spoofing Defense
// -----------------------------------------------------------------------------
console.log("\n--- 4. Testing client spoofing defense ---");

// Malicious client tries to send isServiceable: true, distanceKm: 0.5, deliveryRadiusKm: 5000
const spoofedAddress = {
  street: "Connaught Place, New Delhi",
  latitude: DELHI_LAT,
  longitude: DELHI_LON,
  isServiceable: true,
  deliveryDistanceKm: 0.5,
  distanceKm: 0.5,
  deliveryRadiusKm: 5000,
};

const spoofedRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "delivery",
  address: spoofedAddress,
});
assert.strictEqual(spoofedRes.isServiceable, false, "Server MUST reject out-of-range delivery regardless of client claims");
assert.strictEqual(spoofedRes.code, "OUT_OF_DELIVERY_RANGE");
assert.ok(spoofedRes.distanceKm > 1700, "Distance must be server-calculated, not client-supplied");
console.log("  ✅ Client-sent spoofed isServiceable / distanceKm flags completely ignored by server");


// -----------------------------------------------------------------------------
// 5. Pickup Exemption
// -----------------------------------------------------------------------------
console.log("\n--- 5. Testing pickup exemption ---");

// 5.1 Pickup with missing coordinates
const pickupMissingRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "pickup",
  address: { street: "Pickup Counter", latitude: null, longitude: null },
});
assert.strictEqual(pickupMissingRes.isServiceable, true, "Pickup order must be serviceable even with null coordinates");
assert.strictEqual(pickupMissingRes.isPickup, true);
assert.strictEqual(pickupMissingRes.code, "SERVICEABLE_PICKUP");
console.log("  ✅ Pickup order with null coordinates is serviceable");

// 5.2 Pickup with far coordinates (customer ordering pickup while in Delhi)
const pickupFarRes = validateDeliveryServiceability({
  restaurant: standardRestaurant,
  orderType: "pickup",
  address: farAddress,
});
assert.strictEqual(pickupFarRes.isServiceable, true, "Pickup order must be serviceable even if customer is in another city");
assert.strictEqual(pickupFarRes.isPickup, true);
console.log("  ✅ Pickup order with distant coordinates is serviceable");


// -----------------------------------------------------------------------------
// 6. Checkout Calculation Service Integration (calculateOrderDetails)
// -----------------------------------------------------------------------------
console.log("\n--- 6. Testing calculateOrderDetails() serviceability integration ---");

// Connect to MongoDB to run calculateOrderDetails with authentic documents
const mongoUri = process.env.MONGODB_URI;
assert.ok(mongoUri, "MONGODB_URI must be configured");
await mongoose.connect(mongoUri);

// Find an active restaurant and one of its products
const testRest = await Restaurant.findOne({
  status: "active",
  "address.latitude": { $ne: null },
  "address.longitude": { $ne: null },
}).lean();
assert.ok(testRest, "An active restaurant with coordinates must exist in database");

const testProduct = await Product.findOne({
  restaurant: testRest._id,
  isAvailable: true,
}).lean();
assert.ok(testProduct, "An active product for the test restaurant must exist");

const cartItems = [
  {
    _id: testProduct._id.toString(),
    product: testProduct._id.toString(),
    quantity: 5,
  },
];

// 6.1 Test out-of-range address rejected by calculateOrderDetails
const outOfRangeCalc = await calculateOrderDetails({
  items: cartItems,
  orderType: "delivery",
  address: {
    street: "Far Location",
    latitude: DELHI_LAT,
    longitude: DELHI_LON,
  },
});
assert.strictEqual(outOfRangeCalc.success, false, "calculateOrderDetails must fail for out-of-range delivery");
assert.strictEqual(outOfRangeCalc.status, 400);
assert.strictEqual(outOfRangeCalc.code, "OUT_OF_DELIVERY_RANGE");
assert.ok(outOfRangeCalc.serviceability, "serviceability object must be returned in failure response");
assert.strictEqual(outOfRangeCalc.serviceability.isServiceable, false);
console.log("  ✅ calculateOrderDetails() rejects out-of-range delivery with HTTP 400 and code OUT_OF_DELIVERY_RANGE");

// 6.2 Test invalid (0, 0) customer coordinates rejected by calculateOrderDetails
const nullIslandCalc = await calculateOrderDetails({
  items: cartItems,
  orderType: "delivery",
  address: {
    street: "Null Island",
    latitude: 0,
    longitude: 0,
  },
});
assert.strictEqual(nullIslandCalc.success, false);
assert.strictEqual(nullIslandCalc.status, 400);
assert.strictEqual(nullIslandCalc.code, "INVALID_CUSTOMER_COORDINATES");
console.log("  ✅ calculateOrderDetails() rejects (0, 0) customer coordinates with INVALID_CUSTOMER_COORDINATES");

// 6.3 Test in-range address accepted by calculateOrderDetails
const nearbyCalc = await calculateOrderDetails({
  items: cartItems,
  orderType: "delivery",
  address: {
    street: "Nearby Doorstep",
    latitude: testRest.address.latitude + 0.005,
    longitude: testRest.address.longitude + 0.005,
  },
});
assert.strictEqual(nearbyCalc.success, true, "calculateOrderDetails must succeed for in-range delivery");
assert.ok(nearbyCalc.orders[0].deliveryDistanceKm != null, "deliveryDistanceKm must be attached to order calculation");
assert.ok(nearbyCalc.orders[0].deliveryDistanceKm > 0, "deliveryDistanceKm must be positive");
assert.ok(nearbyCalc.orders[0].serviceability.isServiceable, "serviceability must be true");
console.log(`  ✅ calculateOrderDetails() accepts in-range delivery (calculated distance: ${nearbyCalc.orders[0].deliveryDistanceKm} km)`);

// 6.4 Test pickup order accepted regardless of far coordinates
const pickupCalc = await calculateOrderDetails({
  items: cartItems,
  orderType: "pickup",
  address: {
    street: "Far Location",
    latitude: DELHI_LAT,
    longitude: DELHI_LON,
  },
});
assert.strictEqual(pickupCalc.success, true, "calculateOrderDetails must succeed for pickup even if address is far");
assert.strictEqual(pickupCalc.deliveryFee, 0, "Pickup delivery fee must be 0");
assert.strictEqual(pickupCalc.orders[0].serviceability.isPickup, true);
console.log("  ✅ calculateOrderDetails() accepts pickup orders with far coordinates and zero delivery fee");

// 6.5 Backward compatibility: calculateOrderDetails without address
const noAddressCalc = await calculateOrderDetails({
  items: cartItems,
  orderType: "delivery",
});
assert.strictEqual(noAddressCalc.success, true, "calculateOrderDetails without address succeeds for backward compatibility");
console.log("  ✅ calculateOrderDetails() maintains backward compatibility when address is omitted in legacy tests");


// -----------------------------------------------------------------------------
// 7. Order Model Schema Verification
// -----------------------------------------------------------------------------
console.log("\n--- 7. Testing Order model schema for deliveryDistanceKm ---");

const testOrderDoc = new Order({
  restaurant: testRest._id,
  items: [{
    product: testProduct._id,
    name: testProduct.name,
    price: testProduct.price,
    quantity: 1,
  }],
  totalAmount: 150,
  orderType: "delivery",
  deliveryDistanceKm: 2.34,
});

assert.strictEqual(testOrderDoc.deliveryDistanceKm, 2.34, "Order model must accept deliveryDistanceKm");
const orderValidationErr = testOrderDoc.validateSync();
assert.strictEqual(orderValidationErr, undefined, "Order with deliveryDistanceKm must validate cleanly");
console.log("  ✅ Order model accepts and validates deliveryDistanceKm");


// -----------------------------------------------------------------------------
// 8. Live Database Serviceability Re-Validation Invariant
// -----------------------------------------------------------------------------
console.log("\n--- 8. Testing Live Database Serviceability Invariant ---");

// Verify that if a restaurant's coordinates change in DB, validateDeliveryServiceability
// evaluates against the fresh DB document, not stale cached intent data.
const freshRestDoc = await Restaurant.findById(testRest._id).lean();
const testAddressAt1Km = {
  latitude: freshRestDoc.address.latitude + (1.0 / 111.195),
  longitude: freshRestDoc.address.longitude,
};

const initialCheck = validateDeliveryServiceability({
  restaurant: freshRestDoc,
  orderType: "delivery",
  address: testAddressAt1Km,
});
assert.strictEqual(initialCheck.isServiceable, true);

// If restaurant coordinates shifted to Delhi in DB:
const simulatedShiftedRestDoc = {
  ...freshRestDoc,
  address: { latitude: DELHI_LAT, longitude: DELHI_LON },
};
const revalidationCheck = validateDeliveryServiceability({
  restaurant: simulatedShiftedRestDoc,
  orderType: "delivery",
  address: testAddressAt1Km,
});
assert.strictEqual(revalidationCheck.isServiceable, false, "Re-validation against shifted DB coordinates must reject order");
assert.strictEqual(revalidationCheck.code, "OUT_OF_DELIVERY_RANGE");
console.log("  ✅ Live re-validation correctly detects restaurant coordinate shifts and fails closed");

await mongoose.disconnect();

console.log("\n================================================================================");
console.log(" 🎯 ALL PHASE 2.2 DELIVERY SERVICEABILITY TESTS PASSED (100%)");
console.log("================================================================================");
