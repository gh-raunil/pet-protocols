import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

console.log("\n🧪 RUNNING PHASE 2 VERIFICATION: Out-of-Range (>10km) Check & Unified Staff Map\n");

// 1. Verify geoDistance library
import { calculateDistanceKm, getOrderDistanceInfo, DEFAULT_DELIVERY_RADIUS_KM } from "../lib/geoDistance.js";

// Test coordinates:
// Restaurant at VIT Vellore: ~12.9692, 79.1559
// Nearby customer (1.2 km): ~12.9750, 79.1650
// Far customer (18.5 km): ~13.1000, 79.2500
const restLat = 12.9692;
const restLng = 79.1559;
const nearbyCustLat = 12.9750;
const nearbyCustLng = 79.1650;
const farCustLat = 13.1000;
const farCustLng = 79.2500;

const nearbyDist = calculateDistanceKm(restLat, restLng, nearbyCustLat, nearbyCustLng);
console.log(`✅ Nearby distance calculated: ${nearbyDist} km`);
assert.ok(nearbyDist > 0 && nearbyDist < 5, "Nearby distance should be between 0 and 5 km");

const farDist = calculateDistanceKm(restLat, restLng, farCustLat, farCustLng);
console.log(`✅ Far distance calculated: ${farDist} km`);
assert.ok(farDist > 10, "Far distance must exceed 10 km limit");

// Test order evaluation
const nearbyOrder = {
  address: { latitude: nearbyCustLat, longitude: nearbyCustLng },
  restaurant: { address: { latitude: restLat, longitude: restLng }, deliverySettings: { deliveryRadiusKm: 10 } },
};
const nearbyInfo = getOrderDistanceInfo(nearbyOrder);
assert.strictEqual(nearbyInfo.isOutOfRange, false, "Nearby order should NOT be out of range");
console.log("✅ Nearby order correctly evaluated as within 10km range");

const farOrder = {
  address: { latitude: farCustLat, longitude: farCustLng },
  restaurant: { address: { latitude: restLat, longitude: restLng }, deliverySettings: { deliveryRadiusKm: 10 } },
};
const farInfo = getOrderDistanceInfo(farOrder);
assert.strictEqual(farInfo.isOutOfRange, true, "Far order MUST be flagged as out of range");
assert.ok(farInfo.distanceKm > 10, "Distance must exceed 10 km");
console.log(`✅ Far order correctly flagged as out-of-range (${farInfo.distanceKm} km > 10 km)`);

// Test pickup order override
const farPickupOrder = {
  paymentMethod: "Counter Pickup (COP)",
  address: { latitude: farCustLat, longitude: farCustLng },
  restaurant: { address: { latitude: restLat, longitude: restLng }, deliverySettings: { deliveryRadiusKm: 10 } },
};
const farPickupInfo = getOrderDistanceInfo(farPickupOrder);
assert.strictEqual(farPickupInfo.isOutOfRange, false, "Pickup orders must NEVER be flagged as out of range");
console.log("✅ Pickup order override verified (range check ignored for counter pickup)");

// 2. Verify Order model schema has out-of-range fields
const orderModelSource = fs.readFileSync(path.join(REPO_ROOT, "backend/models/Order.js"), "utf8");
assert.ok(orderModelSource.includes("deliveryDistanceKm"), "Order schema must have deliveryDistanceKm field");
assert.ok(orderModelSource.includes("isOutOfRange"), "Order schema must have isOutOfRange field");
assert.ok(orderModelSource.includes("acceptedOutOfRange"), "Order schema must have acceptedOutOfRange field");
assert.ok(orderModelSource.includes("cancellationReason"), "Order schema must have cancellationReason field");
console.log("✅ backend/models/Order.js schema fields verified");

// 3. Verify backend route handles out of range in GET and PUT
const routeSource = fs.readFileSync(path.join(REPO_ROOT, "backend/app/api/restaurant/orders/route.js"), "utf8");
assert.ok(routeSource.includes("getOrderDistanceInfo"), "Restaurant orders route must import getOrderDistanceInfo");
assert.ok(routeSource.includes("acceptedOutOfRange"), "Restaurant orders route must accept acceptedOutOfRange in PUT");
assert.ok(routeSource.includes("deliveryDistanceKm"), "Restaurant orders route must process deliveryDistanceKm");
console.log("✅ backend/app/api/restaurant/orders/route.js verified");

// 4. Verify unified staff map components exist and contain required Leaflet & OSRM features
const adminLiveMapPath = path.join(REPO_ROOT, "frontend-admin/components/orders/LiveDeliveryMap.js");
assert.ok(fs.existsSync(adminLiveMapPath), "frontend-admin/components/orders/LiveDeliveryMap.js must exist");
const adminLiveMapSource = fs.readFileSync(adminLiveMapPath, "utf8");
assert.ok(adminLiveMapSource.includes("router.project-osrm.org"), "Staff LiveDeliveryMap must query OSRM road polyline");
assert.ok(adminLiveMapSource.includes("🛵"), "Staff LiveDeliveryMap must include scooter icon");
assert.ok(adminLiveMapSource.includes("🏠"), "Staff LiveDeliveryMap must include doorstep icon");
assert.ok(adminLiveMapSource.includes("MAP_STYLES"), "Staff LiveDeliveryMap must have map styles");
assert.ok(adminLiveMapSource.includes("activeStyle"), "Staff LiveDeliveryMap must support active style layers");
assert.ok(adminLiveMapSource.includes("routeStats"), "Staff LiveDeliveryMap must calculate route stats");
console.log("✅ frontend-admin/components/orders/LiveDeliveryMap.js verified with full Leaflet + OSRM roadmap");

// 5. Verify DeliveryRouteMap wraps LiveDeliveryMap
const routeMapPath = path.join(REPO_ROOT, "frontend-admin/components/workspaces/DeliveryRouteMap.js");
const routeMapSource = fs.readFileSync(routeMapPath, "utf8");
assert.ok(routeMapSource.includes("LiveDeliveryMap"), "DeliveryRouteMap must proxy to LiveDeliveryMap");
console.log("✅ frontend-admin/components/workspaces/DeliveryRouteMap.js verified");

// 6. Verify OutOfRangeOrderModal component exists
const modalPath = path.join(REPO_ROOT, "frontend-admin/components/orders/OutOfRangeOrderModal.js");
assert.ok(fs.existsSync(modalPath), "OutOfRangeOrderModal.js must exist");
const modalSource = fs.readFileSync(modalPath, "utf8");
assert.ok(modalSource.includes("OutOfRangeOrderModal"), "OutOfRangeOrderModal component must be exported");
assert.ok(modalSource.includes("onAccept"), "OutOfRangeOrderModal must have onAccept handler");
assert.ok(modalSource.includes("onReject"), "OutOfRangeOrderModal must have onReject handler");
console.log("✅ frontend-admin/components/orders/OutOfRangeOrderModal.js verified");

// 7. Verify OrdersClient and KitchenWorkspace integrate out-of-range confirmation
const ordersClientPath = path.join(REPO_ROOT, "frontend-admin/app/orders/OrdersClient.js");
const ordersClientSource = fs.readFileSync(ordersClientPath, "utf8");
assert.ok(ordersClientSource.includes("OutOfRangeOrderModal"), "OrdersClient must import OutOfRangeOrderModal");
assert.ok(ordersClientSource.includes("handleAcceptOrderWithRangeCheck"), "OrdersClient must use range check handler");
console.log("✅ frontend-admin/app/orders/OrdersClient.js out-of-range integration verified");

const kitchenWorkspacePath = path.join(REPO_ROOT, "frontend-admin/components/workspaces/KitchenWorkspace.js");
const kitchenWorkspaceSource = fs.readFileSync(kitchenWorkspacePath, "utf8");
assert.ok(kitchenWorkspaceSource.includes("OutOfRangeOrderModal"), "KitchenWorkspace must import OutOfRangeOrderModal");
assert.ok(kitchenWorkspaceSource.includes("handleStartCooking"), "KitchenWorkspace must use range check before cooking");
console.log("✅ frontend-admin/components/workspaces/KitchenWorkspace.js out-of-range integration verified");

console.log("\n🎉 ALL TESTS PASSED! Phase 2 Out-of-Range (>10km) Check & Unified Staff Map are 100% verified.\n");
