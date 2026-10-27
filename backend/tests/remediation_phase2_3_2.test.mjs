import assert from "node:assert/strict";
import dns from "node:dns";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

import connectDB from "../lib/db.js";
import Restaurant from "../models/Restaurant.js";
import Product from "../models/Product.js";
import { GET as getRestaurantsRoute } from "../app/api/restaurants/route.js";
import { validateDeliveryServiceability, calculateRawDistanceKm } from "../lib/geoDistance.js";
import { getRestaurantPickupCapability, areAllRestaurantsPickupEnabled } from "../../frontend-user/lib/pickupHelper.js";
import { useLocationStore, SUGGESTED_LOCATIONS } from "../../frontend-user/lib/locationStore.js";

async function runRemediationTests() {
  console.log("=".repeat(80));
  console.log(" 🧪 RUNNING PHASE 2.3.2 REMEDIATION REGRESSION TEST SUITE");
  console.log("=".repeat(80));

  await connectDB();

  // ══════════════════════════════════════════════════════════════════════════
  // TEST SUITE 1: Fix 3 — Partial & Malformed Coordinate Validation in GET /api/restaurants
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- 1. Testing GET /api/restaurants Coordinate Parameter Handling ---");

  // Helper to call route handler
  async function callRestaurantsApi(queryString = "") {
    const req = new Request(`http://localhost:3000/api/restaurants${queryString ? `?${queryString}` : ""}`);
    const res = await getRestaurantsRoute(req);
    const body = await res.json();
    return { status: res.status, body };
  }

  // 1.1 No location supplied (default browsing)
  const noLocRes = await callRestaurantsApi();
  assert.equal(noLocRes.status, 200, "No location must return HTTP 200");
  assert.equal(noLocRes.body.success, true);
  assert.equal(noLocRes.body.customerCoordinates, undefined, "No customerCoordinates in default browsing");
  assert.ok(Array.isArray(noLocRes.body.restaurants), "Must return restaurants array");
  console.log("  ✅ Case 1.1: No coordinates returns HTTP 200 default browsing mode");

  // 1.2 Latitude only (missing longitude)
  const latOnlyRes = await callRestaurantsApi("lat=28.6139");
  assert.equal(latOnlyRes.status, 400, "Latitude-only must return HTTP 400");
  assert.equal(latOnlyRes.body.code, "INVALID_COORDINATES");
  assert.equal(latOnlyRes.body.error, "Both latitude and longitude must be provided together.");
  console.log("  ✅ Case 1.2: Latitude-only (?lat=...) returns HTTP 400 INVALID_COORDINATES");

  // 1.3 Longitude only (missing latitude)
  const lngOnlyRes = await callRestaurantsApi("lng=77.2090");
  assert.equal(lngOnlyRes.status, 400, "Longitude-only must return HTTP 400");
  assert.equal(lngOnlyRes.body.code, "INVALID_COORDINATES");
  assert.equal(lngOnlyRes.body.error, "Both latitude and longitude must be provided together.");
  console.log("  ✅ Case 1.3: Longitude-only (?lng=...) returns HTTP 400 INVALID_COORDINATES");

  // 1.4 Alias combination: latitude + lng
  const aliasRes1 = await callRestaurantsApi("latitude=28.6139&lng=77.2090");
  assert.equal(aliasRes1.status, 200, "latitude + lng alias pair must return HTTP 200");
  assert.equal(aliasRes1.body.customerCoordinates.latitude, 28.6139);
  assert.equal(aliasRes1.body.customerCoordinates.longitude, 77.2090);
  console.log("  ✅ Case 1.4: Alias pair (?latitude=...&lng=...) accepted successfully");

  // 1.5 Alias combination: lat + longitude
  const aliasRes2 = await callRestaurantsApi("lat=28.6139&longitude=77.2090");
  assert.equal(aliasRes2.status, 200, "lat + longitude alias pair must return HTTP 200");
  assert.equal(aliasRes2.body.customerCoordinates.latitude, 28.6139);
  assert.equal(aliasRes2.body.customerCoordinates.longitude, 77.2090);
  console.log("  ✅ Case 1.5: Alias pair (?lat=...&longitude=...) accepted successfully");

  // 1.6 Empty string values (?lat=&lng=)
  const emptyCoordsRes = await callRestaurantsApi("lat=&lng=");
  assert.equal(emptyCoordsRes.status, 400, "Empty coordinates must return HTTP 400");
  assert.equal(emptyCoordsRes.body.code, "INVALID_COORDINATES");
  console.log("  ✅ Case 1.6: Empty coordinates (?lat=&lng=) rejected with HTTP 400");

  // 1.7 Non-numeric values (?lat=abc&lng=def)
  const nonNumericRes = await callRestaurantsApi("lat=abc&lng=def");
  assert.equal(nonNumericRes.status, 400, "Non-numeric coordinates must return HTTP 400");
  assert.equal(nonNumericRes.body.code, "INVALID_COORDINATES");
  console.log("  ✅ Case 1.7: Non-numeric coordinates (?lat=abc&lng=def) rejected with HTTP 400");

  // 1.8 Null Island (0, 0)
  const nullIslandRes = await callRestaurantsApi("lat=0&lng=0");
  assert.equal(nullIslandRes.status, 400, "Null Island (0,0) must return HTTP 400");
  assert.equal(nullIslandRes.body.code, "INVALID_COORDINATES");
  console.log("  ✅ Case 1.8: Null Island coordinates (0, 0) rejected with HTTP 400");

  // 1.9 Out-of-bounds latitude (95, 77)
  const outOfBoundsRes = await callRestaurantsApi("lat=95&lng=77");
  assert.equal(outOfBoundsRes.status, 400, "Out-of-bounds coordinates must return HTTP 400");
  assert.equal(outOfBoundsRes.body.code, "INVALID_COORDINATES");
  console.log("  ✅ Case 1.9: Out-of-bounds coordinates rejected with HTTP 400");

  // ══════════════════════════════════════════════════════════════════════════
  // TEST SUITE 2: Fix 1 — Async Race Condition Prevention in locationStore
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- 2. Testing locationStore evaluateServiceability Async Race Conditions ---");

  // Mock global fetch to simulate out-of-order async resolutions
  const originalFetch = global.fetch;

  let resolveRequestA = null;
  let resolveRequestB = null;

  global.fetch = async (url) => {
    const parsedUrl = new URL(url, "http://localhost:3000");
    const lat = parsedUrl.searchParams.get("lat");
    const lng = parsedUrl.searchParams.get("lng");

    if (lat === "10" && lng === "10") {
      // Request A (starts first, will resolve last)
      return new Promise((resolve) => {
        resolveRequestA = () => {
          resolve({
            json: async () => ({
              success: true,
              isAnyRestaurantServiceable: false,
              serviceableCount: 0,
              restaurants: [
                {
                  _id: "rest_a",
                  name: "Kitchen A",
                  serviceability: { isServiceable: false, reason: "Outside delivery area" },
                },
              ],
            }),
          });
        };
      });
    }

    if (lat === "20" && lng === "20") {
      // Request B (starts second, will resolve first)
      return new Promise((resolve) => {
        resolveRequestB = () => {
          resolve({
            json: async () => ({
              success: true,
              isAnyRestaurantServiceable: true,
              serviceableCount: 1,
              restaurants: [
                {
                  _id: "rest_b",
                  name: "Kitchen B",
                  serviceability: { isServiceable: true, distanceKm: 2.5 },
                },
              ],
            }),
          });
        };
      });
    }

    return originalFetch(url);
  };

  // Launch Request A (Location 10, 10)
  const promiseA = useLocationStore.getState().evaluateServiceability(10, 10);
  assert.equal(useLocationStore.getState().isEvaluating, true, "Store must be evaluating after Request A starts");
  const reqAId = useLocationStore.getState().lastRequestId;

  // Immediately launch Request B (Location 20, 20)
  const promiseB = useLocationStore.getState().evaluateServiceability(20, 20);
  assert.equal(useLocationStore.getState().isEvaluating, true, "Store must still be evaluating after Request B starts");
  const reqBId = useLocationStore.getState().lastRequestId;
  assert.ok(reqBId > reqAId, "Request B must have a higher request ID than Request A");

  // Resolve Request B FIRST
  resolveRequestB();
  await promiseB;

  assert.equal(useLocationStore.getState().isEvaluating, false, "isEvaluating must be false after Request B resolves");
  assert.equal(useLocationStore.getState().status, "available", "Status must be 'available' from Request B");
  const servB = useLocationStore.getState().getRestaurantServiceability("rest_b");
  assert.equal(servB?.isServiceable, true, "Serviceability must contain Kitchen B");

  // Now resolve Request A LAST (stale response)
  resolveRequestA();
  await promiseA;

  // Crucial check: Late Request A must NOT overwrite store state!
  assert.equal(useLocationStore.getState().status, "available", "Late Request A must NOT overwrite status to unavailable");
  assert.equal(useLocationStore.getState().isEvaluating, false, "isEvaluating must remain false");
  assert.equal(
    useLocationStore.getState().getRestaurantServiceability("rest_a"),
    null,
    "Stale results from Kitchen A must NOT be committed to store"
  );
  assert.equal(
    useLocationStore.getState().getRestaurantServiceability("rest_b")?.isServiceable,
    true,
    "Active results from Kitchen B must remain intact"
  );
  console.log("  ✅ Race condition prevented: Request A (started 1st, ended 2nd) discarded; Request B state preserved");

  // Restore global fetch
  global.fetch = originalFetch;

  // ══════════════════════════════════════════════════════════════════════════
  // TEST SUITE 3: Fix 2 — Clear Stale Serviceability on Approximate Preset Selection
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- 3. Testing Stale Serviceability Clearing for Approximate Presets ---");

  // Step 1: Set a state with verified serviceability
  useLocationStore.setState({
    restaurantsServiceability: { rest_123: { isServiceable: true, distanceKm: 1.2 } },
    status: "available",
    statusMessage: "1 partner kitchen delivers to your exact location.",
  });
  assert.equal(useLocationStore.getState().getRestaurantServiceability("rest_123")?.isServiceable, true);

  // Step 2: Customer selects a preset city (Delhi NCR)
  const delhiPreset = SUGGESTED_LOCATIONS.find((l) => l.name.includes("Delhi"));
  assert.ok(delhiPreset, "Delhi preset exists");
  await useLocationStore.getState().selectLocation(delhiPreset);

  // Verification: Serviceability dictionary MUST be cleared!
  assert.deepEqual(
    useLocationStore.getState().restaurantsServiceability,
    {},
    "restaurantsServiceability must be cleared when approximate city is selected"
  );
  assert.equal(
    useLocationStore.getState().getRestaurantServiceability("rest_123"),
    null,
    "getRestaurantServiceability must return null for previous kitchen"
  );
  assert.equal(useLocationStore.getState().status, "city_selected");
  assert.equal(useLocationStore.getState().locationDetails.hasExactCoordinates, false);
  console.log("  ✅ Exact location -> approximate preset: stale serviceability dictionary cleared completely");

  // ══════════════════════════════════════════════════════════════════════════
  // TEST SUITE 4: Fix 5 — Restaurant Pickup Capability Helper
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- 4. Testing Restaurant Pickup Capability Helper ---");

  // 4.1 Fully enabled restaurant
  const enabledRest = {
    name: "Gourmet Paws",
    deliverySettings: { pickupEnabled: true, deliveryEnabled: true },
    orderTypes: { pickup: true, delivery: true },
  };
  const capEnabled = getRestaurantPickupCapability(enabledRest);
  assert.equal(capEnabled.isSupported, true, "Pickup should be supported when both flags are true");
  assert.equal(capEnabled.isUnknown, false);
  console.log("  ✅ Fully enabled restaurant: pickup supported");

  // 4.2 Explicitly disabled via deliverySettings.pickupEnabled = false
  const disabledRest1 = {
    name: "Cloud Kitchen Only",
    deliverySettings: { pickupEnabled: false, deliveryEnabled: true },
    orderTypes: { pickup: true, delivery: true },
  };
  const capDisabled1 = getRestaurantPickupCapability(disabledRest1);
  assert.equal(capDisabled1.isSupported, false, "Pickup must be unsupported when pickupEnabled is false");
  assert.ok(capDisabled1.reason.includes("does not offer self-pickup"));
  console.log("  ✅ deliverySettings.pickupEnabled: false correctly marked unsupported");

  // 4.3 Explicitly disabled via orderTypes.pickup = false
  const disabledRest2 = {
    name: "Delivery Express",
    deliverySettings: { pickupEnabled: true, deliveryEnabled: true },
    orderTypes: { pickup: false, delivery: true },
  };
  const capDisabled2 = getRestaurantPickupCapability(disabledRest2);
  assert.equal(capDisabled2.isSupported, false, "Pickup must be unsupported when orderTypes.pickup is false");
  console.log("  ✅ orderTypes.pickup: false correctly marked unsupported");

  // 4.4 Unknown capability (missing or non-object)
  const unknownRest = { name: "Mystery Kitchen" };
  const capUnknown = getRestaurantPickupCapability(unknownRest);
  assert.equal(capUnknown.isSupported, false, "Unknown capability must default to not claiming supported");
  assert.equal(capUnknown.isUnknown, true, "isUnknown flag must be true");
  console.log("  ✅ Unknown capability handled safely without false claims");

  // 4.5 Multi-restaurant cart check
  const multiCap = areAllRestaurantsPickupEnabled([enabledRest, disabledRest1]);
  assert.equal(multiCap.isSupported, false, "Cart with any pickup-disabled restaurant must disable pickup");
  console.log("  ✅ Multi-restaurant cart: unsupported kitchen correctly blocks order pickup");

  // ══════════════════════════════════════════════════════════════════════════
  // TEST SUITE 5: Additional Verification — Exact Radius Boundary Check
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n--- 5. Testing Authoritative Delivery Radius Boundary Precision ---");

  const REST_LAT = 12.9716;
  const REST_LNG = 77.5946;
  const RADIUS_KM = 10;

  const boundaryRestaurant = {
    name: "Boundary Kitchen",
    status: "active",
    address: { latitude: REST_LAT, longitude: REST_LNG },
    deliverySettings: { deliveryEnabled: true, pickupEnabled: true, deliveryRadiusKm: RADIUS_KM },
    orderTypes: { delivery: true, pickup: true },
  };

  // Convert distance to delta latitude (1 deg lat ~ 111.195 km)
  // Inside: exactly 9.999 km (< 10 km)
  const latInside = REST_LAT + 9.999 / 111.195;
  const servInside = validateDeliveryServiceability({
    restaurant: boundaryRestaurant,
    orderType: "delivery",
    address: { latitude: latInside, longitude: REST_LNG },
  });
  assert.equal(servInside.isServiceable, true, "Point at 9.999 km must be serviceable for 10 km radius");
  console.log("  ✅ Exact distance 9.999 km (< 10 km radius): serviceable");

  // Outside: 10.001 km (> 10 km)
  const latOutside = REST_LAT + 10.001 / 111.195;
  const servOutside = validateDeliveryServiceability({
    restaurant: boundaryRestaurant,
    orderType: "delivery",
    address: { latitude: latOutside, longitude: REST_LNG },
  });
  assert.equal(servOutside.isServiceable, false, "Point at 10.001 km must be rejected for 10 km radius");
  assert.equal(servOutside.code, "OUT_OF_DELIVERY_RANGE");
  console.log("  ✅ Exact distance 10.001 km (> 10 km radius): rejected with OUT_OF_DELIVERY_RANGE");

  // Far outside: 10.05 km (> 10 km)
  const latFarOutside = REST_LAT + 10.05 / 111.195;
  const servFarOutside = validateDeliveryServiceability({
    restaurant: boundaryRestaurant,
    orderType: "delivery",
    address: { latitude: latFarOutside, longitude: REST_LNG },
  });
  assert.equal(servFarOutside.isServiceable, false);
  assert.equal(servFarOutside.code, "OUT_OF_DELIVERY_RANGE");
  console.log("  ✅ Exact distance 10.050 km (> 10 km radius): rejected with OUT_OF_DELIVERY_RANGE");

  console.log("\n" + "=".repeat(80));
  console.log(" 🎉 ALL PHASE 2.3.2 REMEDIATION REGRESSION TESTS PASSED (100%)");
  console.log("=".repeat(80));
}

runRemediationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Remediation Test Suite failed:", err);
    process.exit(1);
  });
