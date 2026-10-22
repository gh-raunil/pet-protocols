import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);

// Set deterministic test secrets
process.env.DELIVERY_OTP_HMAC_SECRET = "test_hmac_secret_key_12345678901234567890";
process.env.DELIVERY_OTP_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.DELIVERY_OTP_WINDOW_SECONDS = "600";
process.env.DELIVERY_OTP_MAX_ATTEMPTS = "5";

console.log("========================================================================");
console.log("PET PROTOCOLS — DELIVERY ROLE AUTHORIZATION & COD RECONCILIATION SUITE");
console.log("========================================================================\n");

console.log("Starting in-memory MongoDB replica set for isolated regression testing...");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const MONGODB_URI = replSet.getUri();

// Fail closed if URI is remote or not loopback
const parsedUri = new URL(MONGODB_URI);
if (parsedUri.hostname !== "127.0.0.1" && parsedUri.hostname !== "localhost") {
  throw new Error(`CRITICAL: Test execution aborted. Non-loopback database URI detected: ${MONGODB_URI}`);
}
process.env.MONGODB_URI = MONGODB_URI;
console.log(`Isolated loopback database URI established: ${MONGODB_URI}`);

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB successfully.\n");

const { decryptOtpCode } = await import("../lib/deliveryOtpService.js");

const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;

const { PUT: ordersPUT, _setTestRequireRestaurantAdmin } = await import("../app/api/restaurant/orders/route.js");

// Setup fixtures
let testRest = await Restaurant.findOne({ slug: "delivery-role-auth-kitchen" });
if (!testRest) {
  testRest = await Restaurant.create({
    name: "Delivery Role Auth Kitchen",
    slug: "delivery-role-auth-kitchen",
    phone: "9876543291",
    address: { street: "10 Delivery Rd", city: "Vellore", state: "TN", pincode: "632014" },
    enabledFeatures: ["delivery"],
    status: "archived",
  });
}

let customer = await User.findOne({ email: "delivery_cod_cust@test.com" });
if (!customer) {
  customer = await User.create({
    name: "COD Customer",
    email: "delivery_cod_cust@test.com",
    role: "customer",
    phone: "9100000088",
  });
}

let deliveryStaffUser = await User.findOne({ email: "delivery_staff_boy@test.com" });
if (!deliveryStaffUser) {
  deliveryStaffUser = await User.create({
    name: "Raju Delivery",
    email: "delivery_staff_boy@test.com",
    role: "staff",
    staffRoles: ["Delivery"],
    phone: "9100000077",
    restaurant: testRest._id,
  });
}

let managerUser = await User.findOne({ email: "branch_manager@test.com" });
if (!managerUser) {
  managerUser = await User.create({
    name: "Manager Vikram",
    email: "branch_manager@test.com",
    role: "staff",
    staffRoles: ["Manager", "Kitchen"],
    phone: "9100000066",
    restaurant: testRest._id,
  });
}

let createdOrders = [];

try {
  // --- TEST 1: Delivery Staff Role Transition Restrictions ---
  console.log("--- Test 1: Delivery staff cannot change order to kitchen statuses (confirmed, preparing, cancelled) ---");
  const testOrder1 = await Order.create({
    user: customer._id,
    restaurant: testRest._id,
    items: [{ name: "Crispy Paneer Burger", quantity: 2, price: 199 }],
    totalAmount: 398,
    status: "pending",
    paymentMethod: "Cash on Delivery (COD)",
    paymentStatus: "pending",
    address: { fullName: "COD Customer", street: "Campus Gate", city: "Vellore", pincode: "632014", phone: "9100000088" },
  });
  createdOrders.push(testOrder1._id);

  // Mock requireRestaurantAdmin as Delivery Staff
  _setTestRequireRestaurantAdmin(async () => ({
    restaurantId: testRest._id,
    isStaff: true,
    isAdmin: false,
    staffRoles: ["Delivery"],
    user: deliveryStaffUser,
  }));

  // Delivery staff attempts to accept & start cooking
  const reqStartCooking = new Request("http://localhost:4000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: testOrder1._id.toString(), status: "preparing" }),
  });
  const resStartCooking = await ordersPUT(reqStartCooking);
  const dataStartCooking = await resStartCooking.json();

  assert.strictEqual(resStartCooking.status, 403, "Delivery staff should receive 403 when updating to preparing");
  assert.strictEqual(dataStartCooking.success, false);
  console.log("  ✅ Delivery staff transition to 'preparing' correctly rejected with 403.");

  // Delivery staff attempts to cancel order
  const reqCancel = new Request("http://localhost:4000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: testOrder1._id.toString(), status: "cancelled" }),
  });
  const resCancel = await ordersPUT(reqCancel);
  assert.strictEqual(resCancel.status, 403, "Delivery staff should receive 403 when updating to cancelled");
  console.log("  ✅ Delivery staff transition to 'cancelled' correctly rejected with 403.");

  // --- TEST 2A: Early COD cash collection before pickup is rejected ---
  console.log("\n--- Test 2A: Cash collection before picking up the order is strictly rejected ---");
  // Simulate kitchen staff preparing the order
  testOrder1.status = "preparing";
  await testOrder1.save();

  const reqEarlyCash = new Request("http://localhost:4000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: testOrder1._id.toString(),
      codPaymentHandler: {
        id: deliveryStaffUser._id.toString(),
        name: deliveryStaffUser.name,
        collected: true,
        amount: 398,
      },
    }),
  });
  const resEarlyCash = await ordersPUT(reqEarlyCash);
  const dataEarlyCash = await resEarlyCash.json();
  assert.strictEqual(resEarlyCash.status, 400, "Cash collection before pickup should be rejected with 400");
  assert.strictEqual(dataEarlyCash.success, false);
  console.log("  ✅ Premature cash collection before pickup correctly rejected with 400.");

  // --- TEST 2B: Delivery staff can transition orders to 'out_for_delivery' ---
  console.log("\n--- Test 2B: Delivery staff can transition orders to 'out_for_delivery' ---");
  const reqTransit = new Request("http://localhost:4000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: testOrder1._id.toString(), status: "out_for_delivery" }),
  });
  const resTransit = await ordersPUT(reqTransit);
  const dataTransit = await resTransit.json();
  assert.strictEqual(resTransit.status, 200, "Delivery staff can transition to out_for_delivery");
  assert.strictEqual(dataTransit.success, true);
  console.log("  ✅ Delivery staff transition to 'out_for_delivery' successfully accepted.");

  // --- TEST 3: COD Cash Collection Recording ---
  console.log("\n--- Test 3: Delivery staff records COD cash collection ---");
  const reqCollectCash = new Request("http://localhost:4000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: testOrder1._id.toString(),
      paymentStatus: "paid",
      codPaymentHandler: {
        id: deliveryStaffUser._id.toString(),
        name: deliveryStaffUser.name,
        phone: deliveryStaffUser.phone,
        amount: 398,
        collected: true,
        settledWithManager: false,
      },
    }),
  });
  const resCollectCash = await ordersPUT(reqCollectCash);
  const dataCollectCash = await resCollectCash.json();
  assert.strictEqual(resCollectCash.status, 200);
  assert.strictEqual(dataCollectCash.success, true);

  const updatedOrder1 = await Order.findById(testOrder1._id);
  assert.strictEqual(updatedOrder1.paymentStatus, "paid");
  assert.strictEqual(updatedOrder1.codPaymentHandler.collected, true);
  assert.strictEqual(updatedOrder1.codPaymentHandler.amount, 398);
  assert.strictEqual(updatedOrder1.codPaymentHandler.name, "Raju Delivery");
  assert.strictEqual(updatedOrder1.codPaymentHandler.settledWithManager, false);
  console.log("  ✅ COD cash collection recorded: ₹398 by Raju Delivery (Pending manager handover).");

  // --- TEST 4: Delivery Staff transitions to delivered ---
  console.log("\n--- Test 4: Marking order delivered after cash collection ---");
  // Retrieve active OTP from the order (using select('+deliveryOtp.encryptedCode') since it's select: false)
  const refreshed = await Order.findById(testOrder1._id).select("+deliveryOtp.encryptedCode");
  const activeOtpCode = decryptOtpCode(refreshed.deliveryOtp?.encryptedCode, {
    orderId: testOrder1._id,
    issuanceId: refreshed.deliveryOtp?.issuanceId,
  });

  const reqDeliver = new Request("http://localhost:4000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: testOrder1._id.toString(),
      status: "delivered",
      deliveryOtpCode: activeOtpCode,
    }),
  });
  const resDeliver = await ordersPUT(reqDeliver);
  const dataDeliver = await resDeliver.json();
  assert.strictEqual(resDeliver.status, 200);
  assert.strictEqual(dataDeliver.success, true);
  console.log("  ✅ Order successfully marked delivered with OTP verification.");

  // --- TEST 5: Manager Settlement of COD Cash ---
  console.log("\n--- Test 5: Manager settles COD cash with delivery staff ---");
  // Delivery staff attempts to settle cash (should fail with 403)
  const reqStaffSettle = new Request("http://localhost:4000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: testOrder1._id.toString(), action: "settle_cod_cash" }),
  });
  const resStaffSettle = await ordersPUT(reqStaffSettle);
  assert.strictEqual(resStaffSettle.status, 403, "Non-manager staff should not be able to settle COD cash");
  console.log("  ✅ Non-manager staff settlement correctly rejected with 403.");

  // Manager settles cash
  _setTestRequireRestaurantAdmin(async () => ({
    restaurantId: testRest._id,
    isStaff: true,
    isAdmin: false,
    staffRoles: ["Manager"],
    user: managerUser,
  }));

  const reqManagerSettle = new Request("http://localhost:4000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: testOrder1._id.toString(), action: "settle_cod_cash" }),
  });
  const resManagerSettle = await ordersPUT(reqManagerSettle);
  const dataManagerSettle = await resManagerSettle.json();
  assert.strictEqual(resManagerSettle.status, 200);
  assert.strictEqual(dataManagerSettle.success, true);

  const settledOrder = await Order.findById(testOrder1._id);
  assert.strictEqual(settledOrder.codPaymentHandler.settledWithManager, true);
  assert.ok(settledOrder.codPaymentHandler.settledAt instanceof Date);
  console.log("  ✅ Manager settlement recorded: settledWithManager=true with timestamp.");

  console.log("\n=======================================================");
  console.log("DELIVERY ROLE AUTH & COD RECONCILIATION: ALL TESTS PASSED");
  console.log("=======================================================");
} finally {
  // Cleanup test orders
  if (createdOrders.length > 0) {
    try {
      await Order.deleteMany({ _id: { $in: createdOrders } });
    } catch (e) {}
  }
  _setTestRequireRestaurantAdmin(null);
  try {
    await mongoose.disconnect();
  } catch (e) {}
  if (replSet) {
    try {
      await replSet.stop();
    } catch (e) {}
  }
  process.exit(0);
}
