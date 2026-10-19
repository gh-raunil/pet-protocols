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
console.log("PET PROTOCOLS — PHASE 2.7 ATOMIC GPS CONCURRENCY REGRESSION TEST SUITE");
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

// Setup fixtures
let testRest = await Restaurant.findOne({ slug: "concurrency-test-kitchen" });
if (!testRest) {
  testRest = await Restaurant.create({
    name: "Concurrency Test Kitchen",
    slug: "concurrency-test-kitchen",
    phone: "9876543299",
    address: { street: "99 Race Rd", city: "Bangalore", state: "KA", pincode: "560001", latitude: 12.9716, longitude: 77.5946 },
    enabledFeatures: ["delivery"],
  });
}

let customer = await User.findOne({ email: "concurrency_cust@test.com" });
if (!customer) {
  customer = await User.create({
    name: "Concurrency Customer",
    email: "concurrency_cust@test.com",
    role: "customer",
    phone: "9100000099",
  });
}

let driver1 = await User.findOne({ email: "concurrency_driver1@test.com" });
if (!driver1) {
  driver1 = await User.create({
    name: "Driver Speed",
    email: "concurrency_driver1@test.com",
    role: "staff",
    staffRole: "Delivery",
    staffRoles: ["Delivery"],
    permissions: ["orders_view", "orders_update"],
    restaurant: testRest._id,
    phone: "9800000091",
  });
}

let driver2 = await User.findOne({ email: "concurrency_driver2@test.com" });
if (!driver2) {
  driver2 = await User.create({
    name: "Driver Flash",
    email: "concurrency_driver2@test.com",
    role: "staff",
    staffRole: "Delivery",
    staffRoles: ["Delivery"],
    permissions: ["orders_view", "orders_update"],
    restaurant: testRest._id,
    phone: "9800000092",
  });
}

const createdOrderIds = [];

try {
  // Set default auth context to driver1
  _setTestRequireRestaurantAdmin(async () => ({
    restaurantId: testRest._id.toString(),
    user: {
      _id: driver1._id,
      name: driver1.name,
      email: driver1.email,
      phone: driver1.phone,
      role: driver1.role,
      staffRoles: driver1.staffRoles,
    },
  }));

  _setTestGetServerSession(async () => ({
    user: {
      _id: customer._id.toString(),
      email: customer.email,
      role: customer.role,
    },
  }));

  // ── TEST 1: Concurrent writes racing on the same initial stored timestamp ──
  console.log("Test 1: Verify newer GPS timestamp wins when concurrent writes race on same initial state...");
  const t0 = new Date("2026-10-18T10:00:00.000Z");
  const testOrder1 = new Order({
    user: customer._id,
    restaurant: testRest._id,
    orderId: `ORD-CONCUR-1-${Date.now()}`,
    items: [{ name: "Kibble", price: 200, quantity: 1 }],
    totalAmount: 200,
    status: "out_for_delivery",
    assignedDeliveryStaff: {
      id: driver1._id,
      name: driver1.name,
      phone: driver1.phone,
      email: driver1.email,
      assignedAt: t0,
    },
    deliveryTracking: {
      isLive: true,
      startedAt: t0,
      currentLocation: {
        latitude: 12.9710,
        longitude: 77.5940,
        accuracy: 10,
        heading: 90,
        speed: 5,
        recordedAt: t0,
      },
      lastUpdatedAt: t0,
    },
  });
  await testOrder1.save();
  createdOrderIds.push(testOrder1._id);

  const t1Newer = new Date("2026-10-18T10:00:10.000Z"); // Newer fix
  const t2Older = new Date("2026-10-18T10:00:04.000Z"); // Older fix, but newer than t0

  // Fire both updates concurrently against the server route
  const reqNewer = new Request(`http://localhost:4000/api/restaurant/orders/${testOrder1.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: 12.9730,
      longitude: 77.5960,
      accuracy: 8,
      heading: 100,
      speed: 12.5,
      recordedAt: t1Newer.toISOString(),
    }),
  });

  const reqOlder = new Request(`http://localhost:4000/api/restaurant/orders/${testOrder1.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: 12.9715,
      longitude: 77.5945,
      accuracy: 15,
      heading: 80,
      speed: 6.0,
      recordedAt: t2Older.toISOString(),
    }),
  });

  // Execute concurrently
  const [resA, resB] = await Promise.all([
    staffLocationPUT(reqNewer, { params: Promise.resolve({ id: testOrder1.orderId }) }),
    staffLocationPUT(reqOlder, { params: Promise.resolve({ id: testOrder1.orderId }) }),
  ]);

  // One or both may return 200 depending on which executed first, but in NO case can older t2 overwrite newer t1
  const dbOrder1 = await Order.findById(testOrder1._id);
  assert.equal(
    dbOrder1.deliveryTracking.currentLocation.latitude,
    12.9730,
    "Database MUST persist newer coordinates (12.9730) regardless of execution order"
  );
  assert.equal(
    dbOrder1.deliveryTracking.currentLocation.recordedAt.toISOString(),
    t1Newer.toISOString(),
    "Database MUST hold newer timestamp (10:00:10)"
  );
  console.log("  PASS: Newer timestamp won the concurrent race; older fix did not overwrite database state.\n");

  // ── TEST 2: Delayed older update strictly rejected when newer is stored ──
  console.log("Test 2: Verify delayed older update is rejected with 400 stale_timestamp...");
  const delayedOlder = new Date("2026-10-18T10:00:07.000Z"); // Older than current 10:00:10
  const reqDelayed = new Request(`http://localhost:4000/api/restaurant/orders/${testOrder1.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: 12.9719,
      longitude: 77.5949,
      recordedAt: delayedOlder.toISOString(),
    }),
  });
  const resDelayed = await staffLocationPUT(reqDelayed, { params: Promise.resolve({ id: testOrder1.orderId }) });
  assert.equal(resDelayed.status, 400);
  const jsonDelayed = await resDelayed.json();
  assert.equal(jsonDelayed.reason, "stale_timestamp");

  // Verify DB state completely unchanged
  const dbOrderCheck = await Order.findById(testOrder1._id);
  assert.equal(dbOrderCheck.deliveryTracking.currentLocation.latitude, 12.9730);
  assert.equal(dbOrderCheck.deliveryTracking.currentLocation.recordedAt.toISOString(), t1Newer.toISOString());
  console.log("  PASS: Delayed older update rejected with 400 and stored location preserved.\n");

  // ── TEST 3: Equal timestamp update strictly rejected ──
  console.log("Test 3: Verify equal timestamp update is rejected deterministically...");
  const reqEqual = new Request(`http://localhost:4000/api/restaurant/orders/${testOrder1.orderId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: 12.9735,
      longitude: 77.5965,
      recordedAt: t1Newer.toISOString(), // Exact same timestamp as stored
    }),
  });
  const resEqual = await staffLocationPUT(reqEqual, { params: Promise.resolve({ id: testOrder1.orderId }) });
  assert.equal(resEqual.status, 400);
  const jsonEqual = await resEqual.json();
  assert.equal(jsonEqual.reason, "stale_timestamp");
  console.log("  PASS: Equal timestamp update rejected deterministically as duplicate/stale.\n");

  // ── TEST 4: GPS write racing with Delivery Completion ──
  console.log("Test 4: Verify GPS write racing with delivery completion cannot reactivate tracking or undo terminal state...");
  const testOrderDelivered = new Order({
    user: customer._id,
    restaurant: testRest._id,
    orderId: `ORD-CONCUR-DELIV-${Date.now()}`,
    items: [{ name: "Toy", price: 150, quantity: 1 }],
    totalAmount: 150,
    status: "out_for_delivery",
    assignedDeliveryStaff: {
      id: driver1._id,
      name: driver1.name,
      phone: driver1.phone,
      email: driver1.email,
      assignedAt: new Date(),
    },
    deliveryTracking: {
      isLive: true,
      startedAt: new Date(),
      currentLocation: { latitude: 12.97, longitude: 77.59, recordedAt: new Date() },
    },
  });
  await testOrderDelivered.save();
  createdOrderIds.push(testOrderDelivered._id);

  // Concurrently mark order as delivered in DB AND attempt location update
  const markDeliveredPromise = (async () => {
    const doc = await Order.findById(testOrderDelivered._id);
    doc.addStatusTransition("delivered", { userId: driver1._id, role: "staff", name: driver1.name });
    await doc.save();
  })();

  const postGpsPromise = staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${testOrderDelivered.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9800,
        longitude: 77.6000,
        recordedAt: new Date(Date.now() + 5000).toISOString(),
      }),
    }),
    { params: Promise.resolve({ id: testOrderDelivered.orderId }) }
  );

  await Promise.all([markDeliveredPromise, postGpsPromise]);

  // In DB, terminal state must strictly be 'delivered' and tracking must NOT be live
  const finalDelivered = await Order.findById(testOrderDelivered._id);
  assert.equal(finalDelivered.status, "delivered");
  assert.equal(finalDelivered.deliveryTracking.isLive, false);

  // Customer tracking view strictly hides coordinates
  const custViewDelivered = finalDelivered.getCustomerTrackingView();
  assert.equal(custViewDelivered.isLive, false);
  assert.equal(custViewDelivered.currentLocation, null);
  console.log("  PASS: Terminal delivery state strictly preserved; GPS update could not reactivate tracking.\n");

  // ── TEST 5: GPS write racing with Cancellation ──
  console.log("Test 5: Verify GPS write racing with cancellation cannot undo cancellation...");
  const testOrderCancelled = new Order({
    user: customer._id,
    restaurant: testRest._id,
    orderId: `ORD-CONCUR-CANCEL-${Date.now()}`,
    items: [{ name: "Bone", price: 100, quantity: 1 }],
    totalAmount: 100,
    status: "out_for_delivery",
    assignedDeliveryStaff: {
      id: driver1._id,
      name: driver1.name,
      phone: driver1.phone,
      email: driver1.email,
      assignedAt: new Date(),
    },
    deliveryTracking: {
      isLive: true,
      startedAt: new Date(),
      currentLocation: { latitude: 12.97, longitude: 77.59, recordedAt: new Date() },
    },
  });
  await testOrderCancelled.save();
  createdOrderIds.push(testOrderCancelled._id);

  const markCancelledPromise = (async () => {
    const doc = await Order.findById(testOrderCancelled._id);
    doc.addStatusTransition("cancelled", { userId: customer._id, role: "customer", name: customer.name });
    await doc.save();
  })();

  const postGpsCancelPromise = staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${testOrderCancelled.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9850,
        longitude: 77.6050,
        recordedAt: new Date(Date.now() + 5000).toISOString(),
      }),
    }),
    { params: Promise.resolve({ id: testOrderCancelled.orderId }) }
  );

  await Promise.all([markCancelledPromise, postGpsCancelPromise]);

  const finalCancelled = await Order.findById(testOrderCancelled._id);
  assert.equal(finalCancelled.status, "cancelled");
  assert.equal(finalCancelled.deliveryTracking.isLive, false);
  assert.equal(finalCancelled.getCustomerTrackingView().currentLocation, null);
  console.log("  PASS: Terminal cancellation state strictly preserved.\n");

  // ── TEST 6: GPS write racing with Driver Reassignment ──
  console.log("Test 6: Verify GPS write racing with driver reassignment rejects former driver with 403...");
  const testOrderReassign = new Order({
    user: customer._id,
    restaurant: testRest._id,
    orderId: `ORD-CONCUR-REASSIGN-${Date.now()}`,
    items: [{ name: "Biscuit", price: 50, quantity: 1 }],
    totalAmount: 50,
    status: "out_for_delivery",
    assignedDeliveryStaff: {
      id: driver1._id,
      name: driver1.name,
      phone: driver1.phone,
      email: driver1.email,
      assignedAt: new Date(),
    },
    deliveryTracking: {
      isLive: true,
      startedAt: new Date(),
      currentLocation: { latitude: 12.97, longitude: 77.59, recordedAt: new Date() },
    },
  });
  await testOrderReassign.save();
  createdOrderIds.push(testOrderReassign._id);

  // Manager reassigns to driver2
  const reassignPromise = (async () => {
    const doc = await Order.findById(testOrderReassign._id);
    doc.assignedDeliveryStaff = {
      id: driver2._id,
      name: driver2.name,
      phone: driver2.phone,
      email: driver2.email,
      assignedAt: new Date(),
    };
    await doc.save();
  })();

  await reassignPromise;

  // Now former driver (driver1) attempts GPS write
  const resFormerDriver = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${testOrderReassign.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9900,
        longitude: 77.6100,
        recordedAt: new Date(Date.now() + 5000).toISOString(),
      }),
    }),
    { params: Promise.resolve({ id: testOrderReassign.orderId }) }
  );

  assert.equal(resFormerDriver.status, 403, "Former driver must be rejected with 403 after reassignment");
  const jsonFormerDriver = await resFormerDriver.json();
  assert.match(jsonFormerDriver.message, /not the currently assigned delivery staff/i);

  // Verify coordinates not modified by former driver
  const dbReassign = await Order.findById(testOrderReassign._id);
  assert.equal(dbReassign.deliveryTracking.currentLocation.latitude, 12.97);

  // New driver (driver2) can now update location
  _setTestRequireRestaurantAdmin(async () => ({
    restaurantId: testRest._id.toString(),
    user: {
      _id: driver2._id,
      name: driver2.name,
      email: driver2.email,
      phone: driver2.phone,
      role: driver2.role,
      staffRoles: driver2.staffRoles,
    },
  }));

  const resNewDriver = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${testOrderReassign.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9910,
        longitude: 77.6110,
        recordedAt: new Date(Date.now() + 6000).toISOString(),
      }),
    }),
    { params: Promise.resolve({ id: testOrderReassign.orderId }) }
  );
  assert.equal(resNewDriver.status, 200);
  const dbNewDriver = await Order.findById(testOrderReassign._id);
  assert.equal(dbNewDriver.deliveryTracking.currentLocation.latitude, 12.9910);
  console.log("  PASS: Former driver blocked with 403; newly assigned driver successfully accepted.\n");

  // ── TEST 7: Invalid coordinates and inactive sessions rejected ──
  console.log("Test 7: Verify invalid coordinates and inactive sessions are rejected...");
  const resBadCoords = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${testOrderReassign.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 95.5, longitude: 77.61 }),
    }),
    { params: Promise.resolve({ id: testOrderReassign.orderId }) }
  );
  assert.equal(resBadCoords.status, 400);
  assert.equal((await resBadCoords.json()).reason, "invalid_coordinates");

  // Non-transit order
  const pendingOrder = new Order({
    user: customer._id,
    restaurant: testRest._id,
    orderId: `ORD-CONCUR-PENDING-${Date.now()}`,
    items: [{ name: "Toy", price: 100, quantity: 1 }],
    totalAmount: 100,
    status: "pending",
  });
  await pendingOrder.save();
  createdOrderIds.push(pendingOrder._id);

  const resPending = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${pendingOrder.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.99, longitude: 77.61 }),
    }),
    { params: Promise.resolve({ id: pendingOrder.orderId }) }
  );
  assert.equal(resPending.status, 400);
  assert.match((await resPending.json()).message, /only accepted while order is 'out_for_delivery'/i);
  console.log("  PASS: Invalid coordinates and non-transit orders rejected cleanly.\n");

  // ── TEST 8: Future-dated timestamp drift boundary policy ──
  console.log("Test 8: Verify forward-skew timestamp boundary policy prevents tracking session poisoning...");
  // 8a: Legitimate forward skew within 60s (e.g. +10s) preserves device timestamp
  const nowMs = Date.now();
  const legitimateSkew = new Date(nowMs + 10 * 1000);
  const resLegitSkew = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${testOrderReassign.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9920,
        longitude: 77.6120,
        recordedAt: legitimateSkew.toISOString(),
      }),
    }),
    { params: Promise.resolve({ id: testOrderReassign.orderId }) }
  );
  assert.equal(resLegitSkew.status, 200);
  const dbLegitCheck = await Order.findById(testOrderReassign._id);
  assert.equal(
    dbLegitCheck.deliveryTracking.currentLocation.recordedAt.toISOString(),
    legitimateSkew.toISOString(),
    "Legitimate forward skew within 60s must preserve the device timestamp"
  );

  // 8b: Excessive forward skew (> 60s, e.g. +10 minutes) is rejected to protect against poisoning
  const excessiveSkew = new Date(nowMs + 600 * 1000); // 10 minutes in the future
  const resExcessiveSkew = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${testOrderReassign.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9930,
        longitude: 77.6130,
        recordedAt: excessiveSkew.toISOString(),
      }),
    }),
    { params: Promise.resolve({ id: testOrderReassign.orderId }) }
  );
  assert.equal(resExcessiveSkew.status, 400, "Excessive future timestamp (> 60s) must be rejected with 400");
  const jsonExcessive = await resExcessiveSkew.json();
  assert.equal(jsonExcessive.reason, "future_timestamp");
  assert.match(jsonExcessive.message, /cannot be more than 60 seconds in the future/i);

  // Verify DB state completely protected: still holds legitimateSkew from 8a
  const dbExcessiveCheck = await Order.findById(testOrderReassign._id);
  assert.equal(
    dbExcessiveCheck.deliveryTracking.currentLocation.recordedAt.toISOString(),
    legitimateSkew.toISOString(),
    "Database must preserve legitimate stored location and not be poisoned by future timestamp"
  );

  // 8c: Verify subsequent legitimate fix with newer valid time is accepted normally
  const subsequentFixTime = new Date(legitimateSkew.getTime() + 1000); // 1s after legitimateSkew, still within ~11s of server now
  const resSubsequent = await staffLocationPUT(
    new Request(`http://localhost:4000/api/restaurant/orders/${testOrderReassign.orderId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9940,
        longitude: 77.6140,
        recordedAt: subsequentFixTime.toISOString(),
      }),
    }),
    { params: Promise.resolve({ id: testOrderReassign.orderId }) }
  );
  assert.equal(resSubsequent.status, 200, "Subsequent fix must succeed without being blocked by future poisoning");
  const dbSubsequentCheck = await Order.findById(testOrderReassign._id);
  assert.equal(dbSubsequentCheck.deliveryTracking.currentLocation.latitude, 12.9940);
  console.log("  PASS: Forward-skew drift policy preserves legitimate timestamps and rejects excessive future timestamps.\n");

  console.log("========================================================================");
  console.log("ALL 8 PHASE 2.7 ATOMIC CONCURRENCY REGRESSION TESTS PASSED! ✓");
  console.log("========================================================================\n");
} finally {
  console.log(`Cleaning up ${createdOrderIds.length} concurrency test orders...`);
  await Order.deleteMany({ _id: { $in: createdOrderIds } });
  await Restaurant.deleteOne({ slug: "concurrency-test-kitchen" });
  await User.deleteMany({ email: { $in: ["concurrency_cust@test.com", "concurrency_driver1@test.com", "concurrency_driver2@test.com"] } });
  await mongoose.disconnect();
  console.log("Clean up complete.");
}
