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
console.log("PET PROTOCOLS — PHASE 2.1 DELIVERY TRACKING DATA MODEL & LIFECYCLE SUITE");
console.log("========================================================================\n");

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB successfully.\n");

const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;

let testRestaurant = await Restaurant.findOne();
if (!testRestaurant) {
  testRestaurant = await Restaurant.create({
    name: "Phase 2 Test Kitchen",
    slug: `test-kitchen-${Date.now()}`,
    phone: "9876543210",
    address: { street: "123 Food Street", city: "Bangalore", state: "KA", pincode: "560001", latitude: 12.9716, longitude: 77.5946 },
  });
}

let testCustomer = await User.findOne({ role: "customer" });
if (!testCustomer) {
  testCustomer = await User.create({
    name: "Customer Phase 2",
    email: `phase2_${Date.now()}@test.com`,
    role: "customer",
    phone: "9333333333",
  });
}

const actorStaff = { userId: testCustomer._id, role: "restaurant_admin", name: "Dispatcher" };
const createdOrderIds = [];

try {
  // ── TEST 1: New order default tracking state ──
  console.log("Test 1: Verify new order receives inactive tracking by default without coordinates...");
  const newOrder = new Order({
    user: testCustomer._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-NEW-${Date.now()}`,
    items: [{ name: "Organic Dog Biscuit", price: 120, quantity: 1 }],
    totalAmount: 120,
    status: "pending",
  });
  await newOrder.save();
  createdOrderIds.push(newOrder._id);

  assert.equal(newOrder.deliveryTracking.isLive, false, "Tracking must be inactive by default");
  assert.equal(newOrder.deliveryTracking.currentLocation, null, "Current location must default to null");
  assert.equal(newOrder.deliveryTracking.startedAt, null, "Started timestamp must default to null");
  assert.equal(newOrder.deliveryTracking.endedAt, null, "Ended timestamp must default to null");
  assert.equal(newOrder.deliveryTracking.endReason, null, "End reason must default to null");

  const customerView = newOrder.getCustomerTrackingView();
  assert.equal(customerView.isLive, false);
  assert.equal(customerView.currentLocation, null, "Customer view must return null coordinates for pending order");
  assert.equal(customerView.status, "pending");
  console.log("  PASS: New order tracking defaults to inactive with zero coordinates.\n");

  // ── TEST 2: Legacy orders without tracking data ──
  console.log("Test 2: Verify legacy orders without deliveryTracking subdocument function seamlessly...");
  const legacyRaw = await mongoose.connection.collection("orders").insertOne({
    user: testCustomer._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-LEGACY-${Date.now()}`,
    items: [{ name: "Cat Treats", price: 90, quantity: 1 }],
    totalAmount: 90,
    status: "preparing",
    createdAt: new Date(Date.now() - 7200000),
  });
  createdOrderIds.push(legacyRaw.insertedId);

  const fetchedLegacy = await Order.findById(legacyRaw.insertedId);
  assert.ok(fetchedLegacy, "Legacy order must load");
  const legacyView = fetchedLegacy.getCustomerTrackingView();
  assert.equal(legacyView.isLive, false);
  assert.equal(legacyView.currentLocation, null);

  // Test static sanitizer on plain object
  const leanLegacy = await Order.findById(legacyRaw.insertedId).lean();
  const sanitizedLean = Order.sanitizeTrackingForCustomer(leanLegacy);
  assert.equal(sanitizedLean.isLive, false);
  assert.equal(sanitizedLean.currentLocation, null);
  console.log("  PASS: Legacy orders handle missing tracking data gracefully without errors.\n");

  // ── TEST 3: Starting delivery tracking on authorized transition ──
  console.log("Test 3: Verify transition to out_for_delivery activates tracking without fabricating coordinates...");
  newOrder.addStatusTransition("preparing", actorStaff, "Preparing in kitchen");
  await newOrder.save();
  assert.equal(newOrder.deliveryTracking.isLive, false, "Preparing status must keep tracking inactive");

  // Transition to out_for_delivery
  const transitTransition = newOrder.addStatusTransition("out_for_delivery", actorStaff, "Dispatched with rider");
  assert.equal(transitTransition, true);
  await newOrder.save();

  assert.equal(newOrder.status, "out_for_delivery");
  assert.equal(newOrder.deliveryTracking.isLive, true, "Tracking must be active when out_for_delivery");
  assert.ok(newOrder.deliveryTracking.startedAt instanceof Date, "startedAt must be a Date");
  assert.equal(newOrder.deliveryTracking.currentLocation, null, "Must NOT fabricate coordinates before driver pings");

  const transitView = newOrder.getCustomerTrackingView();
  assert.equal(transitView.isLive, true);
  assert.equal(transitView.currentLocation, null, "Customer view returns null coordinates until first valid GPS ping");
  console.log("  PASS: Tracking starts on out_for_delivery with no fabricated coordinates.\n");

  // ── TEST 4: Valid coordinate updates ──
  console.log("Test 4: Verify accepting and persisting valid GPS location updates...");
  const validCoords = {
    latitude: 12.971598,
    longitude: 77.594563,
    accuracy: 12.5,
    heading: 95.0,
    speed: 8.2,
    recordedAt: new Date(),
  };

  const updateRes = newOrder.updateDeliveryLocation(validCoords, actorStaff);
  assert.equal(updateRes.success, true, "Valid coordinates update must succeed");
  await newOrder.save();

  const refreshedOrder = await Order.findById(newOrder._id);
  assert.equal(refreshedOrder.deliveryTracking.currentLocation.latitude, 12.971598);
  assert.equal(refreshedOrder.deliveryTracking.currentLocation.longitude, 77.594563);
  assert.equal(refreshedOrder.deliveryTracking.currentLocation.accuracy, 12.5);
  assert.equal(refreshedOrder.deliveryTracking.currentLocation.heading, 95.0);
  assert.equal(refreshedOrder.deliveryTracking.currentLocation.speed, 8.2);
  assert.ok(refreshedOrder.deliveryTracking.lastUpdatedAt instanceof Date);

  // Customer view exposes coordinates while out_for_delivery
  const customerTransitView = refreshedOrder.getCustomerTrackingView();
  assert.equal(customerTransitView.isLive, true);
  assert.equal(customerTransitView.currentLocation.latitude, 12.971598);
  assert.equal(customerTransitView.currentLocation.longitude, 77.594563);
  console.log("  PASS: Valid GPS coordinates accepted, persisted, and exposed during active transit.\n");

  // ── TEST 5: Strict rejection of invalid coordinates ──
  console.log("Test 5: Verify rejection of invalid, NaN, out-of-range, and malformed coordinates...");
  const invalidCases = [
    { name: "Latitude > 90", coords: { latitude: 90.001, longitude: 77.5 } },
    { name: "Latitude < -90", coords: { latitude: -90.001, longitude: 77.5 } },
    { name: "Longitude > 180", coords: { latitude: 12.9, longitude: 180.001 } },
    { name: "Longitude < -180", coords: { latitude: 12.9, longitude: -180.001 } },
    { name: "NaN Latitude", coords: { latitude: "not_a_num", longitude: 77.5 } },
    { name: "NaN Longitude", coords: { latitude: 12.9, longitude: NaN } },
    { name: "Missing Latitude", coords: { longitude: 77.5 } },
    { name: "Negative Accuracy", coords: { latitude: 12.9, longitude: 77.5, accuracy: -10 } },
    { name: "Heading > 360", coords: { latitude: 12.9, longitude: 77.5, heading: 361 } },
    { name: "Negative Speed", coords: { latitude: 12.9, longitude: 77.5, speed: -1 } },
  ];

  for (const testCase of invalidCases) {
    const res = refreshedOrder.updateDeliveryLocation(testCase.coords, actorStaff);
    assert.equal(res.success, false, `Must reject ${testCase.name}`);
    assert.equal(res.reason, "invalid_coordinates", `Reason must be invalid_coordinates for ${testCase.name}`);
  }

  // Ensure last known good coordinates were not corrupted by bad updates
  const postInvalidOrder = await Order.findById(newOrder._id);
  assert.equal(postInvalidOrder.deliveryTracking.currentLocation.latitude, 12.971598, "Coordinates must remain unchanged");
  console.log("  PASS: All 10 invalid coordinate test cases strictly rejected without state corruption.\n");

  // ── TEST 6: Order delivery ends tracking and hides coordinates from customer ──
  console.log("Test 6: Verify delivered status terminates tracking and hides live coordinates from customer...");
  refreshedOrder.addStatusTransition("delivered", actorStaff, "Delivered to customer");
  await refreshedOrder.save();

  const deliveredOrder = await Order.findById(newOrder._id);
  assert.equal(deliveredOrder.status, "delivered");
  assert.equal(deliveredOrder.deliveryTracking.isLive, false, "Tracking isLive must be false on delivery");
  assert.equal(deliveredOrder.deliveryTracking.endReason, "delivered");
  assert.ok(deliveredOrder.deliveryTracking.endedAt instanceof Date);

  // In database, dropoff location is preserved for audit
  assert.ok(deliveredOrder.deliveryTracking.currentLocation.latitude, "Database preserves audit location");

  // BUT customer view strictly conceals coordinates
  const deliveredCustomerView = deliveredOrder.getCustomerTrackingView();
  assert.equal(deliveredCustomerView.isLive, false);
  assert.equal(deliveredCustomerView.currentLocation, null, "Customer view MUST return null coordinates once delivered");
  assert.equal(deliveredCustomerView.status, "delivered");

  // Static sanitizer on lean object also conceals coordinates
  const leanDelivered = await Order.findById(newOrder._id).lean();
  const sanitizedDelivered = Order.sanitizeTrackingForCustomer(leanDelivered);
  assert.equal(sanitizedDelivered.isLive, false);
  assert.equal(sanitizedDelivered.currentLocation, null, "Static sanitizer MUST return null coordinates once delivered");

  // Attempting to push new coordinates to delivered order must fail
  const postDeliveryUpdate = deliveredOrder.updateDeliveryLocation({ latitude: 12.98, longitude: 77.60 }, actorStaff);
  assert.equal(postDeliveryUpdate.success, false, "Cannot update location on delivered order");
  assert.equal(postDeliveryUpdate.reason, "not_in_transit");
  console.log("  PASS: Delivery terminates tracking; driver coordinates strictly hidden from customer view.\n");

  // ── TEST 7: Order cancellation ends tracking and hides coordinates ──
  console.log("Test 7: Verify order cancellation terminates tracking and conceals driver coordinates...");
  const cancelTestOrder = new Order({
    user: testCustomer._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-CANCEL-${Date.now()}`,
    items: [{ name: "Beef Jerky", price: 250, quantity: 1 }],
    totalAmount: 250,
    status: "pending",
  });
  await cancelTestOrder.save();
  createdOrderIds.push(cancelTestOrder._id);

  cancelTestOrder.addStatusTransition("preparing", actorStaff, "Preparing");
  cancelTestOrder.addStatusTransition("out_for_delivery", actorStaff, "Dispatched");
  cancelTestOrder.updateDeliveryLocation({ latitude: 12.95, longitude: 77.58 }, actorStaff);
  await cancelTestOrder.save();

  assert.equal(cancelTestOrder.deliveryTracking.isLive, true);

  // Cancel order while in transit
  cancelTestOrder.addStatusTransition("cancelled", actorStaff, "Cancelled due to customer emergency");
  await cancelTestOrder.save();

  const refreshedCancelled = await Order.findById(cancelTestOrder._id);
  assert.equal(refreshedCancelled.status, "cancelled");
  assert.equal(refreshedCancelled.deliveryTracking.isLive, false);
  assert.equal(refreshedCancelled.deliveryTracking.endReason, "cancelled");
  assert.ok(refreshedCancelled.deliveryTracking.endedAt instanceof Date);

  // Customer view strictly conceals coordinates
  const cancelledCustomerView = refreshedCancelled.getCustomerTrackingView();
  assert.equal(cancelledCustomerView.isLive, false);
  assert.equal(cancelledCustomerView.currentLocation, null, "Cancelled order must not leak driver coordinates");

  // Further updates rejected
  const postCancelUpdate = refreshedCancelled.updateDeliveryLocation({ latitude: 12.96, longitude: 77.59 }, actorStaff);
  assert.equal(postCancelUpdate.success, false);
  assert.equal(postCancelUpdate.reason, "not_in_transit");
  console.log("  PASS: Cancellation terminates tracking; driver coordinates strictly hidden.\n");

  // ── TEST 8: Repeated transitions and idempotent updates ──
  console.log("Test 8: Verify idempotency of startDeliveryTracking and stopDeliveryTracking...");
  const repeatOrder = new Order({
    user: testCustomer._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-REPEAT-${Date.now()}`,
    items: [{ name: "Dental Chew", price: 180, quantity: 1 }],
    totalAmount: 180,
    status: "out_for_delivery",
  });
  await repeatOrder.save();
  createdOrderIds.push(repeatOrder._id);

  const start1 = repeatOrder.startDeliveryTracking(actorStaff);
  assert.equal(start1.success, true);
  assert.equal(start1.alreadyLive, false);
  const initialStart = repeatOrder.deliveryTracking.startedAt;

  // Repeated call to start
  const start2 = repeatOrder.startDeliveryTracking(actorStaff);
  assert.equal(start2.success, true);
  assert.equal(start2.alreadyLive, true);
  assert.equal(repeatOrder.deliveryTracking.startedAt.getTime(), initialStart.getTime(), "startedAt must not change");

  // Stop tracking
  const stop1 = repeatOrder.stopDeliveryTracking("manually_ended");
  assert.equal(stop1.success, true);
  assert.equal(stop1.wasLive, true);

  // Repeated call to stop
  const stop2 = repeatOrder.stopDeliveryTracking("manually_ended");
  assert.equal(stop2.success, true);
  assert.equal(stop2.wasLive, false);
  console.log("  PASS: Repeated lifecycle calls are strictly idempotent.\n");

  // ── TEST 9: Existing pickup orders not starting GPS tracking ──
  console.log("Test 9: Verify pickup orders never start GPS tracking...");
  const pickupOrder = new Order({
    user: testCustomer._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-PICKUP-${Date.now()}`,
    items: [{ name: "Salmon Bites", price: 220, quantity: 1 }],
    totalAmount: 220,
    status: "pending",
    paymentMethod: "Cash on Pickup (COP)",
    notes: "[PICKUP] Customer counter pickup",
  });
  await pickupOrder.save();
  createdOrderIds.push(pickupOrder._id);

  assert.equal(pickupOrder.isPickupOrder(), true, "isPickupOrder must return true");

  pickupOrder.addStatusTransition("preparing", actorStaff, "Preparing");
  pickupOrder.addStatusTransition("ready", actorStaff, "Ready at counter");
  await pickupOrder.save();

  assert.equal(pickupOrder.deliveryTracking.isLive, false);

  // Direct attempt to start tracking on pickup order
  const startPickupRes = pickupOrder.startDeliveryTracking(actorStaff);
  assert.equal(startPickupRes.success, false);
  assert.equal(startPickupRes.reason, "pickup_order");

  // Direct attempt to update location on pickup order
  const updatePickupRes = pickupOrder.updateDeliveryLocation({ latitude: 12.9, longitude: 77.5 }, actorStaff);
  assert.equal(updatePickupRes.success, false);
  assert.equal(updatePickupRes.reason, "pickup_order");

  pickupOrder.addStatusTransition("delivered", actorStaff, "Picked up by customer");
  await pickupOrder.save();

  assert.equal(pickupOrder.deliveryTracking.isLive, false);
  assert.equal(pickupOrder.deliveryTracking.currentLocation, null);
  console.log("  PASS: Pickup orders strictly barred from starting GPS delivery tracking.\n");

  // ── TEST 10: Location updates rejected for non-transit orders ──
  console.log("Test 10: Verify location updates rejected for pending and preparing orders...");
  const nonTransitOrder = new Order({
    user: testCustomer._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-NONTRANSIT-${Date.now()}`,
    items: [{ name: "Puppy Toy", price: 150, quantity: 1 }],
    totalAmount: 150,
    status: "pending",
  });
  await nonTransitOrder.save();
  createdOrderIds.push(nonTransitOrder._id);

  const pendingUpdate = nonTransitOrder.updateDeliveryLocation({ latitude: 12.9, longitude: 77.5 }, actorStaff);
  assert.equal(pendingUpdate.success, false);
  assert.equal(pendingUpdate.reason, "not_in_transit");

  nonTransitOrder.addStatusTransition("preparing", actorStaff, "Cooking");
  await nonTransitOrder.save();

  const preparingUpdate = nonTransitOrder.updateDeliveryLocation({ latitude: 12.9, longitude: 77.5 }, actorStaff);
  assert.equal(preparingUpdate.success, false);
  assert.equal(preparingUpdate.reason, "not_in_transit");
  assert.equal(nonTransitOrder.deliveryTracking.currentLocation, null);
  console.log("  PASS: Non-transit orders cannot accept location updates.\n");

  console.log("========================================================================");
  console.log("ALL 10 PHASE 2.1 DELIVERY TRACKING MODEL & LIFECYCLE TESTS PASSED! ✓");
  console.log("========================================================================");
} finally {
  if (createdOrderIds.length > 0) {
    console.log(`\nCleaning up ${createdOrderIds.length} test orders...`);
    await Order.deleteMany({ _id: { $in: createdOrderIds } });
    console.log("Clean up complete.");
  }
  await mongoose.disconnect();
}
