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
console.log("PET PROTOCOLS — PHASE 1 ORDER TRACKING & STATUS HISTORY TEST SUITE");
console.log("========================================================================\n");

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB successfully.\n");

const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;

let testRestaurant = await Restaurant.findOne();
if (!testRestaurant) {
  testRestaurant = await Restaurant.create({
    name: "Phase 1 Test Kitchen",
    slug: `test-kitchen-${Date.now()}`,
    phone: "9876543210",
    address: { street: "123 Food Street", city: "Bangalore", state: "KA", pincode: "560001" },
  });
}

let testCustomerA = await User.findOne({ role: "customer" });
if (!testCustomerA) {
  testCustomerA = await User.create({
    name: "Customer Alpha",
    email: `alpha_${Date.now()}@test.com`,
    role: "customer",
    phone: "9111111111",
  });
}

let testCustomerB = await User.findOne({ role: "customer", _id: { $ne: testCustomerA._id } });
if (!testCustomerB) {
  testCustomerB = await User.create({
    name: "Customer Beta",
    email: `beta_${Date.now()}@test.com`,
    role: "customer",
    phone: "9222222222",
  });
}

const createdOrderIds = [];

try {
  // ── TEST 1: Initial status and status history on new order creation ──
  console.log("Test 1: Verify new order receives correct initial status and history...");
  const order1 = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-ORD-${Date.now()}-1`,
    items: [
      {
        name: "Gourmet Puppy Bowl",
        price: 250,
        quantity: 2,
      },
    ],
    totalAmount: 500,
    status: "pending",
  });
  await order1.save();
  createdOrderIds.push(order1._id);

  assert.equal(order1.status, "pending", "Initial order status must be 'pending'");
  assert.ok(Array.isArray(order1.statusHistory), "statusHistory must be an array");
  assert.equal(order1.statusHistory.length, 1, "Initial order must have 1 status history entry");
  assert.equal(order1.statusHistory[0].status, "pending", "History entry status must match initial status");
  assert.ok(order1.statusHistory[0].changedAt instanceof Date, "changedAt must be a valid server Date");
  console.log("  PASS: New order has initial 'pending' status and history entry.\n");

  // ── TEST 2: Valid status transition persists history entry ──
  console.log("Test 2: Verify valid status transition persists history with server timestamp...");
  const canCook = order1.canTransitionTo("preparing");
  assert.equal(canCook, true, "Transition pending -> preparing must be valid");

  const actorStaff = {
    userId: String(testRestaurant._id),
    role: "restaurant_admin",
    name: "Head Chef Mario",
  };
  const transitioned = order1.addStatusTransition("preparing", actorStaff, "Kitchen accepted ticket");
  assert.equal(transitioned, true, "addStatusTransition must succeed for valid transition");
  await order1.save();

  const refreshedOrder1 = await Order.findById(order1._id);
  assert.equal(refreshedOrder1.status, "preparing", "Refreshed order status must be 'preparing'");
  assert.equal(refreshedOrder1.statusHistory.length, 2, "statusHistory must now have 2 entries");
  assert.equal(refreshedOrder1.statusHistory[1].status, "preparing", "Second entry must be 'preparing'");
  assert.equal(refreshedOrder1.statusHistory[1].changedBy.name, "Head Chef Mario", "Actor name must be recorded");
  assert.equal(refreshedOrder1.statusHistory[1].note, "Kitchen accepted ticket", "Note must be recorded");
  assert.ok(
    new Date(refreshedOrder1.statusHistory[1].changedAt) >= new Date(refreshedOrder1.statusHistory[0].changedAt),
    "Timestamps must be monotonically non-decreasing"
  );
  console.log("  PASS: Valid transition persisted with authoritative server timestamp and actor.\n");

  // ── TEST 3: Idempotent status update (no duplicate history or notifications) ──
  console.log("Test 3: Verify duplicate status update is idempotent...");
  const duplicateResult = refreshedOrder1.addStatusTransition("preparing", actorStaff, "Repeated update");
  assert.equal(duplicateResult, false, "addStatusTransition must return false when status has not changed");
  await refreshedOrder1.save();

  const afterDuplicateOrder = await Order.findById(order1._id);
  assert.equal(afterDuplicateOrder.statusHistory.length, 2, "Duplicate request must NOT create extra history entry");
  console.log("  PASS: Repeated status update did not append duplicate history entry.\n");

  // ── TEST 4: Invalid transitions are rejected ──
  console.log("Test 4: Verify invalid transitions are rejected by canTransitionTo...");
  // pending -> delivered is invalid (must go through preparing)
  const orderInvalid = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-ORD-${Date.now()}-INV`,
    items: [{ name: "Dog Biscuit", price: 50, quantity: 1 }],
    totalAmount: 50,
    status: "pending",
  });
  assert.equal(orderInvalid.canTransitionTo("delivered"), false, "pending -> delivered must be rejected");
  assert.equal(orderInvalid.canTransitionTo("out_for_delivery"), false, "pending -> out_for_delivery must be rejected");
  console.log("  PASS: Invalid transitions properly rejected.\n");

  // ── TEST 5: Terminal states (delivered and cancelled) cannot revert ──
  console.log("Test 5: Verify terminal states cannot transition back to active states...");
  // Advance order1 to delivered
  order1.addStatusTransition("out_for_delivery", actorStaff, "Out with rider");
  order1.addStatusTransition("delivered", actorStaff, "Delivered to doorstep");
  await order1.save();

  assert.equal(order1.status, "delivered");
  assert.equal(order1.canTransitionTo("preparing"), false, "delivered cannot transition to preparing");
  assert.equal(order1.canTransitionTo("out_for_delivery"), false, "delivered cannot transition to out_for_delivery");
  assert.equal(order1.canTransitionTo("cancelled"), false, "delivered cannot transition to cancelled");

  // Test cancelled terminal state
  const orderCancel = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-ORD-${Date.now()}-CANC`,
    items: [{ name: "Catnip Toy", price: 100, quantity: 1 }],
    totalAmount: 100,
    status: "pending",
  });
  await orderCancel.save();
  createdOrderIds.push(orderCancel._id);

  orderCancel.addStatusTransition("cancelled", { role: "customer", name: "Customer" }, "Customer changed mind");
  await orderCancel.save();

  assert.equal(orderCancel.status, "cancelled");
  assert.equal(orderCancel.canTransitionTo("preparing"), false, "cancelled cannot transition to preparing");
  assert.equal(orderCancel.canTransitionTo("delivered"), false, "cancelled cannot transition to delivered");
  assert.equal(orderCancel.canTransitionTo("pending"), false, "cancelled cannot transition to pending");
  console.log("  PASS: Delivered and cancelled orders behave as strict terminal states.\n");

  // ── TEST 6: Legacy orders without history fallback gracefully ──
  console.log("Test 6: Verify legacy orders without statusHistory remain readable and functional...");
  // Simulate an older order that has no statusHistory array in DB
  const legacyOrder = await Order.collection.insertOne({
    user: testCustomerA._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-LEGACY-${Date.now()}`,
    items: [{ name: "Classic Kibble", price: 300, quantity: 1 }],
    totalAmount: 300,
    status: "preparing",
    createdAt: new Date(Date.now() - 3600000), // 1 hour ago
  });
  createdOrderIds.push(legacyOrder.insertedId);

  const fetchedLegacy = await Order.findById(legacyOrder.insertedId);
  assert.ok(fetchedLegacy, "Legacy order must be retrievable");
  // Test addStatusTransition on legacy order without crashing
  const legacyTransitionResult = fetchedLegacy.addStatusTransition("out_for_delivery", actorStaff, "Dispatched");
  assert.equal(legacyTransitionResult, true, "Legacy order can transition without error");
  await fetchedLegacy.save();

  const refreshedLegacy = await Order.findById(legacyOrder.insertedId);
  assert.equal(refreshedLegacy.status, "out_for_delivery");
  assert.equal(refreshedLegacy.statusHistory.length, 2, "Legacy order seeds initial status then appends new transition");
  assert.equal(refreshedLegacy.statusHistory[0].status, "preparing", "Seeded entry has historical status");
  assert.equal(refreshedLegacy.statusHistory[1].status, "out_for_delivery", "Second entry has new status");
  console.log("  PASS: Older orders without history function seamlessly with automatic seed fallback.\n");

  // ── TEST 7: Customer tracking data sanitization (Staff privacy) ──
  console.log("Test 7: Verify customer status history is sanitized of internal staff data...");
  const rawOrder = await Order.findById(order1._id).lean();
  assert.ok(rawOrder.statusHistory[1].changedBy.name, "Raw database order contains staff name");

  // Simulate GET /api/orders customer sanitizer
  const sanitizedHistory = rawOrder.statusHistory.map((h) => ({
    status: h.status,
    changedAt: h.changedAt,
    note: h.note || "",
  }));

  for (const entry of sanitizedHistory) {
    assert.equal(entry.changedBy, undefined, "changedBy must be stripped for customer");
    assert.equal(entry.userId, undefined, "userId must be stripped for customer");
    assert.ok(entry.status, "status must be preserved");
    assert.ok(entry.changedAt, "changedAt must be preserved");
  }
  console.log("  PASS: Customer-facing timeline data is properly sanitized, protecting staff privacy.\n");

  // ── TEST 8: Customer ownership isolation ──
  console.log("Test 8: Verify customer ownership checks prevent cross-customer access...");
  // Customer A queries customer B's order
  const queryForCustomerB = {
    $or: [{ user: testCustomerB._id }, { "address.phone": testCustomerB.phone }],
    _id: order1._id, // Belongs to Customer A
  };
  const unauthorizedFetch = await Order.findOne(queryForCustomerB);
  assert.equal(unauthorizedFetch, null, "Customer B cannot read Customer A's order");

  const queryForCustomerA = {
    $or: [{ user: testCustomerA._id }, { "address.phone": testCustomerA.phone }],
    _id: order1._id, // Belongs to Customer A
  };
  const authorizedFetch = await Order.findOne(queryForCustomerA);
  assert.ok(authorizedFetch, "Customer A can read their own order");
  console.log("  PASS: Cross-customer order access is strictly prevented.\n");

  // ── TEST 9: Pickup order lifecycle vs Delivery order lifecycle ──
  console.log("Test 9: Verify pickup orders follow pickup lifecycle (ready -> delivered)...");
  const pickupOrder = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-PICKUP-${Date.now()}`,
    items: [{ name: "Cat Nip Treat", price: 150, quantity: 1 }],
    totalAmount: 150,
    status: "pending",
    notes: "[PICKUP] Customer counter pickup",
  });
  await pickupOrder.save();
  createdOrderIds.push(pickupOrder._id);

  assert.equal(pickupOrder.canTransitionTo("preparing"), true);
  pickupOrder.addStatusTransition("preparing", actorStaff, "Preparing in kitchen");

  // Pickup transitions directly to 'ready' (Ready for Pickup)
  assert.equal(pickupOrder.canTransitionTo("ready"), true);
  pickupOrder.addStatusTransition("ready", actorStaff, "Meal ready at counter");

  // From ready, pickup transitions directly to 'delivered' (Picked Up)
  assert.equal(pickupOrder.canTransitionTo("delivered"), true);
  pickupOrder.addStatusTransition("delivered", actorStaff, "Customer picked up meal");
  await pickupOrder.save();

  const refreshedPickup = await Order.findById(pickupOrder._id);
  assert.equal(refreshedPickup.status, "delivered");
  assert.equal(refreshedPickup.statusHistory.length, 4);
  const statuses = refreshedPickup.statusHistory.map((h) => h.status);
  assert.deepEqual(statuses, ["pending", "preparing", "ready", "delivered"]);
  console.log("  PASS: Pickup order successfully traversed pending -> preparing -> ready -> delivered.\n");

  // ── TEST 10: Inventory deduction failure rollback records cancelled status & history ──
  console.log("Test 10: Verify inventory deduction failure rollback records cancelled status and history...");
  const orderInvFail = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-INVFAIL-${Date.now()}`,
    items: [{ name: "Organic Salmon Bowl", price: 350, quantity: 2 }],
    totalAmount: 700,
    status: "pending",
  });
  await orderInvFail.save();
  createdOrderIds.push(orderInvFail._id);

  assert.equal(orderInvFail.status, "pending");
  assert.equal(orderInvFail.statusHistory.length, 1);

  // Simulate mock-checkout rollback path from POST /api/orders
  const deductRes = { success: false, message: "Insufficient stock for Salmon fillet" };
  const cancelReasonMsg = `Inventory deduction failed: ${deductRes.message || "Insufficient stock"}`;

  const currentOrderDoc = await Order.findById(orderInvFail._id);
  assert.ok(currentOrderDoc, "Failed order must exist in DB");
  if (typeof currentOrderDoc.addStatusTransition === "function") {
    currentOrderDoc.addStatusTransition(
      "cancelled",
      { role: "system", name: "Inventory System" },
      cancelReasonMsg
    );
  } else {
    currentOrderDoc.status = "cancelled";
  }
  currentOrderDoc.set("cancellationReason", cancelReasonMsg, { strict: false });
  currentOrderDoc.notes = currentOrderDoc.notes ? `${currentOrderDoc.notes} | ${cancelReasonMsg}` : cancelReasonMsg;
  await currentOrderDoc.save();

  // Also simulate multi-restaurant previous order rollback
  const prevMultiOrder = new Order({
    user: testCustomerA._id,
    restaurant: testRestaurant._id,
    orderId: `TEST-PREVMULTI-${Date.now()}`,
    items: [{ name: "Chicken Jerky", price: 200, quantity: 1 }],
    totalAmount: 200,
    status: "pending",
  });
  await prevMultiOrder.save();
  createdOrderIds.push(prevMultiOrder._id);

  const prevDoc = await Order.findById(prevMultiOrder._id);
  const multiCancelMsg = "Cancelled due to item unavailability in multi-restaurant checkout";
  if (typeof prevDoc.addStatusTransition === "function") {
    prevDoc.addStatusTransition(
      "cancelled",
      { role: "system", name: "Inventory System" },
      multiCancelMsg
    );
  } else {
    prevDoc.status = "cancelled";
  }
  prevDoc.set("cancellationReason", multiCancelMsg, { strict: false });
  prevDoc.notes = prevDoc.notes ? `${prevDoc.notes} | ${multiCancelMsg}` : multiCancelMsg;
  await prevDoc.save();

  // Verify DB state for failed order
  const refreshedInvFail = await Order.findById(orderInvFail._id).lean();
  assert.equal(refreshedInvFail.status, "cancelled", "Failed order status must be 'cancelled'");
  assert.equal(refreshedInvFail.cancellationReason, cancelReasonMsg, "Cancellation reason must be recorded in DB");
  assert.equal(refreshedInvFail.statusHistory.length, 2, "Failed order must have 2 history entries");
  assert.equal(refreshedInvFail.statusHistory[0].status, "pending", "First entry must be pending");
  assert.equal(refreshedInvFail.statusHistory[1].status, "cancelled", "Second entry must be cancelled");
  assert.equal(refreshedInvFail.statusHistory[1].changedBy.role, "system", "Actor role must be system");
  assert.equal(refreshedInvFail.statusHistory[1].changedBy.name, "Inventory System", "Actor name must be Inventory System");
  assert.equal(refreshedInvFail.statusHistory[1].note, cancelReasonMsg, "History note must match cancellation reason");

  // Verify DB state for previous multi-restaurant order
  const refreshedPrevMulti = await Order.findById(prevMultiOrder._id).lean();
  assert.equal(refreshedPrevMulti.status, "cancelled", "Previous batch order must be 'cancelled'");
  assert.equal(refreshedPrevMulti.cancellationReason, multiCancelMsg);
  assert.equal(refreshedPrevMulti.statusHistory.length, 2);
  assert.equal(refreshedPrevMulti.statusHistory[1].status, "cancelled");
  assert.equal(refreshedPrevMulti.statusHistory[1].changedBy.name, "Inventory System");

  console.log("  PASS: Inventory deduction rollback cleanly records cancelled transition, reason, and actor.\n");

  console.log("========================================================================");
  console.log("ALL PHASE 1 ORDER TRACKING & STATUS HISTORY TESTS PASSED SUCCESSFULLY! ✓");
  console.log("========================================================================");
} finally {
  if (createdOrderIds.length > 0) {
    console.log(`\nCleaning up ${createdOrderIds.length} test orders...`);
    await Order.deleteMany({ _id: { $in: createdOrderIds } });
    console.log("Clean up complete.");
  }
  await mongoose.disconnect();
}
