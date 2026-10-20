import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import assert from "node:assert/strict";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(backendDir, ".env.local") });
dotenv.config({ path: path.join(backendDir, ".env") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in environment");
}

console.log("========================================================================");
console.log("PET PROTOCOLS — PHASE 2.2 SECURE LIVE TRACKING APIS TEST SUITE");
console.log("========================================================================\n");

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB successfully.\n");

const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;

const { PUT: staffLocationPUT, _setTestRequireRestaurantAdmin } = await import(
  "../app/api/restaurant/orders/[id]/location/route.js"
);
const { GET: customerTrackingGET, _setTestGetServerSession } = await import(
  "../app/api/orders/[id]/tracking/route.js"
);

// Fixtures
let testRestaurantA = await Restaurant.findOne({ slug: "phase2-kitchen-a" });
if (!testRestaurantA) {
  testRestaurantA = await Restaurant.create({
    name: "Phase 2 Kitchen Alpha",
    slug: "phase2-kitchen-a",
    phone: "9876543210",
    address: { street: "123 Alpha St", city: "Bangalore", state: "KA", pincode: "560001", latitude: 12.9716, longitude: 77.5946 },
    enabledFeatures: ["delivery"],
    status: "archived",
  });
}

let testRestaurantB = await Restaurant.findOne({ slug: "phase2-kitchen-b" });
if (!testRestaurantB) {
  testRestaurantB = await Restaurant.create({
    name: "Phase 2 Kitchen Beta",
    slug: "phase2-kitchen-b",
    phone: "9876543222",
    address: { street: "456 Beta St", city: "Bangalore", state: "KA", pincode: "560002", latitude: 12.9800, longitude: 77.6000 },
    enabledFeatures: ["delivery"],
    status: "archived",
  });
}

let testCustomerA = await User.findOne({ email: "customer_alpha_p2@test.com" });
if (!testCustomerA) {
  testCustomerA = await User.create({
    name: "Customer Alpha P2",
    email: "customer_alpha_p2@test.com",
    role: "customer",
    phone: "9100000001",
  });
}

let testCustomerB = await User.findOne({ email: "customer_beta_p2@test.com" });
if (!testCustomerB) {
  testCustomerB = await User.create({
    name: "Customer Beta P2",
    email: "customer_beta_p2@test.com",
    role: "customer",
    phone: "9100000002",
  });
}

let staffA1 = await User.findOne({ email: "staff_driver1_p2@test.com" });
if (!staffA1) {
  staffA1 = await User.create({
    name: "Driver Suresh",
    email: "staff_driver1_p2@test.com",
    role: "staff",
    staffRole: "Delivery",
    staffRoles: ["Delivery"],
    permissions: ["orders_view", "orders_update"],
    restaurant: testRestaurantA._id,
    phone: "9800000001",
  });
}

let staffA2 = await User.findOne({ email: "staff_driver2_p2@test.com" });
if (!staffA2) {
  staffA2 = await User.create({
    name: "Driver Ramesh",
    email: "staff_driver2_p2@test.com",
    role: "staff",
    staffRole: "Delivery",
    staffRoles: ["Delivery"],
    permissions: ["orders_view", "orders_update"],
    restaurant: testRestaurantA._id,
    phone: "9800000002",
  });
}

let adminA = await User.findOne({ email: "admin_alpha_p2@test.com" });
if (!adminA) {
  adminA = await User.create({
    name: "Manager Alpha",
    email: "admin_alpha_p2@test.com",
    role: "restaurant_admin",
    staffRole: "Manager",
    staffRoles: ["Manager"],
    permissions: ["orders_view", "orders_update"],
    restaurant: testRestaurantA._id,
    phone: "9800000099",
  });
}

let staffB = await User.findOne({ email: "staff_beta_p2@test.com" });
if (!staffB) {
  staffB = await User.create({
    name: "Driver Beta",
    email: "staff_beta_p2@test.com",
    role: "staff",
    staffRole: "Delivery",
    staffRoles: ["Delivery"],
    permissions: ["orders_view", "orders_update"],
    restaurant: testRestaurantB._id,
    phone: "9800000003",
  });
}

const createdOrderIds = [];

try {
  // Create an active test order for Restaurant A and Customer A
  let testOrderA = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurantA._id,
    orderId: `ORD-P2-A-${Date.now()}`,
    items: [{ name: "Healthy Kibble", price: 350, quantity: 1 }],
    totalAmount: 350,
    status: "pending",
    address: { street: "10 MG Road", city: "Bangalore", state: "KA", pincode: "560001", phone: testCustomerA.phone },
    assignedDeliveryStaff: {
      id: staffA1._id,
      name: staffA1.name,
      phone: staffA1.phone,
      email: staffA1.email,
      assignedAt: new Date(),
    },
  });
  await testOrderA.save();
  createdOrderIds.push(testOrderA._id);

  // ── TEST 1: Unauthenticated staff location update ──
  console.log("Test 1: Verify unauthenticated staff location update is rejected (401)...");
  _setTestRequireRestaurantAdmin(async () => ({ error: "Authentication required", status: 401 }));
  const reqUnauthStaff = new Request("http://localhost:4000/api/restaurant/orders/any/location", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: 12.97, longitude: 77.59 }),
  });
  const resUnauthStaff = await staffLocationPUT(reqUnauthStaff, { params: Promise.resolve({ id: testOrderA.orderId }) });
  assert.equal(resUnauthStaff.status, 401, "Unauthenticated staff must return 401");
  console.log("  PASS: Unauthenticated staff location update properly rejected.\n");

  // ── TEST 2: Unauthenticated customer tracking read ──
  console.log("Test 2: Verify unauthenticated customer tracking read is rejected (401)...");
  _setTestGetServerSession(async () => null);
  const reqUnauthCust = new Request(`http://localhost:4000/api/orders/${testOrderA.orderId}/tracking`);
  const resUnauthCust = await customerTrackingGET(reqUnauthCust, { params: Promise.resolve({ id: testOrderA.orderId }) });
  assert.equal(resUnauthCust.status, 401, "Unauthenticated customer must return 401");
  console.log("  PASS: Unauthenticated customer read properly rejected.\n");

  // ── TEST 3: Staff from another restaurant rejected (Multi-tenant isolation) ──
  console.log("Test 3: Verify staff from another restaurant cannot access or update order (404)...");
  _setTestRequireRestaurantAdmin(async () => ({
    user: staffB,
    restaurant: testRestaurantB,
    restaurantId: testRestaurantB._id.toString(),
  }));
  const reqCrossStaff = new Request(`http://localhost:4000/api/restaurant/orders/${testOrderA.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: 12.97, longitude: 77.59 }),
  });
  const resCrossStaff = await staffLocationPUT(reqCrossStaff, { params: Promise.resolve({ id: testOrderA.orderId }) });
  assert.equal(resCrossStaff.status, 404, "Cross-restaurant staff must receive 404 without leaking order existence");
  console.log("  PASS: Multi-tenant boundary strictly prevents cross-restaurant location tampering.\n");

  // ── TEST 4: Cross-customer tracking access rejected ──
  console.log("Test 4: Verify customer cannot read another customer's live tracking (404)...");
  _setTestGetServerSession(async () => ({
    user: { id: testCustomerB._id.toString(), email: testCustomerB.email, role: "customer" },
  }));
  const reqCrossCust = new Request(`http://localhost:4000/api/orders/${testOrderA.orderId}/tracking`);
  const resCrossCust = await customerTrackingGET(reqCrossCust, { params: Promise.resolve({ id: testOrderA.orderId }) });
  assert.equal(resCrossCust.status, 404, "Customer B cannot read Customer A's order tracking");
  console.log("  PASS: Customer ownership isolation strictly enforced on tracking read.\n");

  // ── TEST 5: Pending/Preparing orders reject location updates and hide coordinates ──
  console.log("Test 5: Verify pending/preparing order rejects location update and returns location: null...");
  _setTestRequireRestaurantAdmin(async () => ({
    user: staffA1,
    restaurant: testRestaurantA,
    restaurantId: testRestaurantA._id.toString(),
  }));
  const reqPendingUpdate = new Request(`http://localhost:4000/api/restaurant/orders/${testOrderA.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: 12.97, longitude: 77.59 }),
  });
  const resPendingUpdate = await staffLocationPUT(reqPendingUpdate, { params: Promise.resolve({ id: testOrderA.orderId }) });
  assert.equal(resPendingUpdate.status, 400, "Location update on pending order must return 400");

  _setTestGetServerSession(async () => ({
    user: { id: testCustomerA._id.toString(), email: testCustomerA.email, role: "customer" },
  }));
  const resPendingCust = await customerTrackingGET(
    new Request(`http://localhost:4000/api/orders/${testOrderA.orderId}/tracking`),
    { params: Promise.resolve({ id: testOrderA.orderId }) }
  );
  assert.equal(resPendingCust.status, 200);
  const jsonPendingCust = await resPendingCust.json();
  assert.equal(jsonPendingCust.isLive, false);
  assert.equal(jsonPendingCust.location, null, "Coordinates must be null for pending order");
  assert.equal(jsonPendingCust.driver, null, "Driver details must be null for pending order");
  console.log("  PASS: Pending orders reject GPS updates and return null coordinates to customer.\n");

  // ── TEST 6: Order in out_for_delivery with NO location recorded yet ──
  console.log("Test 6: Verify order in transit before first GPS ping returns isLive: false, location: null...");
  testOrderA.addStatusTransition("preparing", { userId: staffA1._id, role: "staff", name: staffA1.name });
  testOrderA.addStatusTransition("out_for_delivery", { userId: staffA1._id, role: "staff", name: staffA1.name });
  await testOrderA.save();

  const resTransitNoLoc = await customerTrackingGET(
    new Request(`http://localhost:4000/api/orders/${testOrderA.orderId}/tracking`),
    { params: Promise.resolve({ id: testOrderA.orderId }) }
  );
  const jsonTransitNoLoc = await resTransitNoLoc.json();
  assert.equal(jsonTransitNoLoc.status, "out_for_delivery");
  assert.equal(jsonTransitNoLoc.isLive, false, "isLive must be false until real location is pinged");
  assert.equal(jsonTransitNoLoc.location, null, "No fabricated coordinates before first driver ping");
  console.log("  PASS: In-transit order without driver ping cleanly reports isLive: false and location: null.\n");

  // ── TEST 7: Valid coordinate ingestion and customer live view ──
  console.log("Test 7: Verify valid GPS ingestion exposes live coordinates and driver info to customer...");
  const validGpsPing = {
    latitude: 12.971598,
    longitude: 77.594563,
    accuracy: 11.2,
    heading: 85.0,
    speed: 7.4,
  };
  const reqValidPing = new Request(`http://localhost:4000/api/restaurant/orders/${testOrderA.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validGpsPing),
  });
  const resValidPing = await staffLocationPUT(reqValidPing, { params: Promise.resolve({ id: testOrderA.orderId }) });
  assert.equal(resValidPing.status, 200);
  const jsonValidPing = await resValidPing.json();
  assert.equal(jsonValidPing.success, true);
  assert.equal(jsonValidPing.isLive, true);

  // Customer reads tracking now
  const resLiveCust = await customerTrackingGET(
    new Request(`http://localhost:4000/api/orders/${testOrderA.orderId}/tracking`),
    { params: Promise.resolve({ id: testOrderA.orderId }) }
  );
  assert.equal(resLiveCust.status, 200);
  const jsonLiveCust = await resLiveCust.json();
  assert.equal(jsonLiveCust.isLive, true);
  assert.equal(jsonLiveCust.isStale, false);
  assert.equal(jsonLiveCust.location.latitude, 12.971598);
  assert.equal(jsonLiveCust.location.longitude, 77.594563);
  assert.equal(jsonLiveCust.location.speed, 7.4);
  assert.equal(jsonLiveCust.driver.name, "Driver Suresh");
  assert.equal(jsonLiveCust.driver.phone, "9800000001");
  console.log("  PASS: Live driver coordinates and display info correctly accessible to customer.\n");

  // ── TEST 8: Malformed / invalid coordinates strictly rejected ──
  console.log("Test 8: Verify malformed coordinates are rejected without state corruption...");
  const reqBadLat = new Request(`http://localhost:4000/api/restaurant/orders/${testOrderA.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: 92.5, longitude: 77.59 }),
  });
  const resBadLat = await staffLocationPUT(reqBadLat, { params: Promise.resolve({ id: testOrderA.orderId }) });
  assert.equal(resBadLat.status, 400);

  const reqBadLng = new Request(`http://localhost:4000/api/restaurant/orders/${testOrderA.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: 12.97, longitude: "not_a_coordinate" }),
  });
  const resBadLng = await staffLocationPUT(reqBadLng, { params: Promise.resolve({ id: testOrderA.orderId }) });
  assert.equal(resBadLng.status, 400);

  // Ensure DB coordinates remain unchanged
  const dbOrderCheck = await Order.findById(testOrderA._id);
  assert.equal(dbOrderCheck.deliveryTracking.currentLocation.latitude, 12.971598);
  console.log("  PASS: Invalid coordinates rejected; stored live location preserved.\n");

  // ── TEST 9: Stale GPS timestamp indicator (> 180s) ──
  console.log("Test 9: Verify stale GPS timestamp flag when location has not updated for > 180s...");
  testOrderA = await Order.findById(testOrderA._id);
  // Simulate 4 minutes (240s) ago
  testOrderA.deliveryTracking.lastUpdatedAt = new Date(Date.now() - 240 * 1000);
  testOrderA.deliveryTracking.currentLocation.recordedAt = new Date(Date.now() - 240 * 1000);
  await testOrderA.save();

  const resStaleCust = await customerTrackingGET(
    new Request(`http://localhost:4000/api/orders/${testOrderA.orderId}/tracking`),
    { params: Promise.resolve({ id: testOrderA.orderId }) }
  );
  const jsonStaleCust = await resStaleCust.json();
  assert.equal(jsonStaleCust.isLive, true);
  assert.equal(jsonStaleCust.isStale, true, "isStale must be true when last location ping is > 180 seconds old");

  // Also verify out-of-order/stale timestamp packet is rejected
  const reqStalePacket = new Request(`http://localhost:4000/api/restaurant/orders/${testOrderA.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: 12.9720,
      longitude: 77.5950,
      recordedAt: new Date(Date.now() - 300 * 1000), // 5 minutes ago (older than current 4m ago)
    }),
  });
  const resStalePacket = await staffLocationPUT(reqStalePacket, { params: Promise.resolve({ id: testOrderA.orderId }) });
  assert.equal(resStalePacket.status, 400);
  const jsonStalePacket = await resStalePacket.json();
  assert.equal(jsonStalePacket.reason, "stale_timestamp");
  console.log("  PASS: Stale GPS status flagged for customer, and out-of-order packets rejected.\n");

  // ── TEST 10: Pickup order rejects GPS updates and hides tracking ──
  console.log("Test 10: Verify pickup orders reject GPS updates and return isPickup: true, location: null...");
  const pickupOrder = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurantA._id,
    orderId: `ORD-P2-PICKUP-${Date.now()}`,
    items: [{ name: "Catnip", price: 100, quantity: 1 }],
    totalAmount: 100,
    status: "ready",
    paymentMethod: "Cash on Pickup",
    notes: "[PICKUP] Customer counter pickup",
  });
  await pickupOrder.save();
  createdOrderIds.push(pickupOrder._id);

  const reqPickupLocation = new Request(`http://localhost:4000/api/restaurant/orders/${pickupOrder.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: 12.97, longitude: 77.59 }),
  });
  const resPickupLocation = await staffLocationPUT(reqPickupLocation, { params: Promise.resolve({ id: pickupOrder.orderId }) });
  assert.equal(resPickupLocation.status, 400);

  const resPickupCust = await customerTrackingGET(
    new Request(`http://localhost:4000/api/orders/${pickupOrder.orderId}/tracking`),
    { params: Promise.resolve({ id: pickupOrder.orderId }) }
  );
  const jsonPickupCust = await resPickupCust.json();
  assert.equal(jsonPickupCust.isPickup, true);
  assert.equal(jsonPickupCust.isLive, false);
  assert.equal(jsonPickupCust.location, null);
  console.log("  PASS: Pickup order safely isolated from GPS tracking.\n");

  // ── TEST 11: Delivered and Cancelled orders terminate live coordinates ──
  console.log("Test 11: Verify delivered and cancelled orders return location: null and reject updates...");
  // Mark testOrderA as delivered
  testOrderA = await Order.findById(testOrderA._id);
  testOrderA.addStatusTransition("delivered", { userId: staffA1._id, role: "staff", name: staffA1.name });
  await testOrderA.save();

  const resDeliveredCust = await customerTrackingGET(
    new Request(`http://localhost:4000/api/orders/${testOrderA.orderId}/tracking`),
    { params: Promise.resolve({ id: testOrderA.orderId }) }
  );
  const jsonDeliveredCust = await resDeliveredCust.json();
  assert.equal(jsonDeliveredCust.status, "delivered");
  assert.equal(jsonDeliveredCust.isLive, false);
  assert.equal(jsonDeliveredCust.location, null, "Driver coordinates must be null once delivered");
  assert.equal(jsonDeliveredCust.driver, null);

  // Attempting location update after delivery
  const resPostDeliverUpdate = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${testOrderA.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.97, longitude: 77.59 }),
    }),
    { params: Promise.resolve({ id: testOrderA.orderId }) }
  );
  assert.equal(resPostDeliverUpdate.status, 400, "Cannot update location on delivered order");

  // Create another order to test cancelled state
  const cancelledOrder = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurantA._id,
    orderId: `ORD-P2-CANCEL-${Date.now()}`,
    items: [{ name: "Pet Shampoo", price: 200, quantity: 1 }],
    totalAmount: 200,
    status: "cancelled",
  });
  await cancelledOrder.save();
  createdOrderIds.push(cancelledOrder._id);

  const resCancelledCust = await customerTrackingGET(
    new Request(`http://localhost:4000/api/orders/${cancelledOrder.orderId}/tracking`),
    { params: Promise.resolve({ id: cancelledOrder.orderId }) }
  );
  const jsonCancelledCust = await resCancelledCust.json();
  assert.equal(jsonCancelledCust.status, "cancelled");
  assert.equal(jsonCancelledCust.isLive, false);
  assert.equal(jsonCancelledCust.location, null, "Driver coordinates must be null for cancelled order");
  console.log("  PASS: Terminal states strictly conceal driver coordinates and reject updates.\n");

  // ── TEST 12: Delivery staff assignment & reassignment concurrency ──
  console.log("Test 12: Verify assigned driver vs non-assigned driver authorization & reassignment...");
  const assignOrder = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurantA._id,
    orderId: `ORD-P2-REASSIGN-${Date.now()}`,
    items: [{ name: "Bird Seed", price: 150, quantity: 1 }],
    totalAmount: 150,
    status: "out_for_delivery",
    assignedDeliveryStaff: {
      id: staffA1._id,
      name: staffA1.name,
      phone: staffA1.phone,
      email: staffA1.email,
      assignedAt: new Date(),
    },
    deliveryTracking: {
      isLive: true,
      startedAt: new Date(),
    },
  });
  await assignOrder.save();
  createdOrderIds.push(assignOrder._id);

  // 12a: Driver Suresh (staffA1) updates location -> 200 OK
  _setTestRequireRestaurantAdmin(async () => ({
    user: staffA1,
    restaurant: testRestaurantA,
    restaurantId: testRestaurantA._id.toString(),
  }));
  const resAssignedDriver = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${assignOrder.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.971, longitude: 77.594 }),
    }),
    { params: Promise.resolve({ id: assignOrder.orderId }) }
  );
  assert.equal(resAssignedDriver.status, 200);

  // 12b: Driver Ramesh (staffA2 - NOT assigned) attempts location update -> 403 Forbidden
  _setTestRequireRestaurantAdmin(async () => ({
    user: staffA2,
    restaurant: testRestaurantA,
    restaurantId: testRestaurantA._id.toString(),
  }));
  const resUnassignedDriver = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${assignOrder.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.972, longitude: 77.595 }),
    }),
    { params: Promise.resolve({ id: assignOrder.orderId }) }
  );
  assert.equal(resUnassignedDriver.status, 403, "Non-assigned driver must be forbidden (403)");

  // 12c: Restaurant Manager (adminA) updates location -> 200 OK (Manager override permitted)
  _setTestRequireRestaurantAdmin(async () => ({
    user: adminA,
    restaurant: testRestaurantA,
    restaurantId: testRestaurantA._id.toString(),
  }));
  const resManagerOverride = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${assignOrder.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.973, longitude: 77.596 }),
    }),
    { params: Promise.resolve({ id: assignOrder.orderId }) }
  );
  assert.equal(resManagerOverride.status, 200, "Manager override must be permitted");

  // 12d: Reassign order to Driver Ramesh (staffA2)
  assignOrder.assignedDeliveryStaff = {
    id: staffA2._id,
    name: staffA2.name,
    phone: staffA2.phone,
    email: staffA2.email,
    assignedAt: new Date(),
  };
  await assignOrder.save();

  // 12e: Driver Suresh (now formerly assigned) attempts location update -> 403 Forbidden
  _setTestRequireRestaurantAdmin(async () => ({
    user: staffA1,
    restaurant: testRestaurantA,
    restaurantId: testRestaurantA._id.toString(),
  }));
  const resOldDriver = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${assignOrder.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.974, longitude: 77.597 }),
    }),
    { params: Promise.resolve({ id: assignOrder.orderId }) }
  );
  assert.equal(resOldDriver.status, 403, "Formerly assigned driver must be forbidden after reassignment");

  // 12f: Driver Ramesh (newly assigned) attempts location update -> 200 OK
  _setTestRequireRestaurantAdmin(async () => ({
    user: staffA2,
    restaurant: testRestaurantA,
    restaurantId: testRestaurantA._id.toString(),
  }));
  const resNewDriver = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${assignOrder.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.975, longitude: 77.598 }),
    }),
    { params: Promise.resolve({ id: assignOrder.orderId }) }
  );
  assert.equal(resNewDriver.status, 200, "Newly assigned driver successfully updates location");
  console.log("  PASS: Driver assignment, unassigned blocking, manager override, and reassignment verified.\n");

  // ── TEST 13: Querying by Mongo _id vs Business orderId ──
  console.log("Test 13: Verify endpoints accept both Mongo ObjectId and business orderId...");
  _setTestGetServerSession(async () => ({
    user: { id: testCustomerA._id.toString(), email: testCustomerA.email, role: "customer" },
  }));

  // By Mongo ObjectId
  const resById = await customerTrackingGET(
    new Request(`http://localhost:4000/api/orders/${assignOrder._id}/tracking`),
    { params: Promise.resolve({ id: assignOrder._id.toString() }) }
  );
  assert.equal(resById.status, 200);

  // By Business orderId
  const resByOrderId = await customerTrackingGET(
    new Request(`http://localhost:4000/api/orders/${assignOrder.orderId}/tracking`),
    { params: Promise.resolve({ id: assignOrder.orderId }) }
  );
  assert.equal(resByOrderId.status, 200);
  console.log("  PASS: Endpoints seamlessly resolve both Mongo _id and business orderId.\n");

  console.log("========================================================================");
  console.log("ALL 13 PHASE 2.2 SECURE LIVE TRACKING API TESTS PASSED SUCCESSFULLY! ✓");
  console.log("========================================================================");
} finally {
  if (createdOrderIds.length > 0) {
    console.log(`\nCleaning up ${createdOrderIds.length} test orders...`);
    await Order.deleteMany({ _id: { $in: createdOrderIds } });
    console.log("Clean up complete.");
  }
  await mongoose.disconnect();
}
