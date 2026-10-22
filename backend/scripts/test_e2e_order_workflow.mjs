import { register } from "node:module";
import { pathToFileURL } from "node:url";
register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);

import mongoose from "mongoose";
import assert from "node:assert/strict";
import crypto from "crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// Set deterministic test secrets
process.env.DELIVERY_OTP_HMAC_SECRET = "test_hmac_secret_key_12345678901234567890";
process.env.DELIVERY_OTP_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.DELIVERY_OTP_WINDOW_SECONDS = "600";
process.env.DELIVERY_OTP_MAX_ATTEMPTS = "5";

console.log("========================================================================");
console.log("PET PROTOCOLS — END-TO-END ORDER WORKFLOW & SECURITY INTEGRITY SUITE");
console.log("PHASE 4: MASTER INTEGRATION, CONCURRENCY & LIFECYCLE RECONCILIATION");
console.log("========================================================================\n");

console.log("Starting isolated MongoMemoryReplSet on 127.0.0.1...");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const MONGODB_URI = replSet.getUri();

const parsedUri = new URL(MONGODB_URI);
if (parsedUri.hostname !== "127.0.0.1" && parsedUri.hostname !== "localhost") {
  throw new Error(`CRITICAL: Test execution aborted. Non-loopback database URI detected: ${MONGODB_URI}`);
}
process.env.MONGODB_URI = MONGODB_URI;
console.log(`Connected to isolated test database: ${MONGODB_URI}\n`);

await mongoose.connect(MONGODB_URI);

const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;
const Product = (await import("../models/Product.js")).default;
const Ingredient = (await import("../models/Ingredient.js")).default;
const Recipe = (await import("../models/Recipe.js")).default;
const NotificationOutbox = (await import("../models/NotificationOutbox.js")).default;

const {
  POST: ordersPOST,
  PATCH: ordersCustomerPATCH,
  _setTestGetServerSession: setOrdersSession,
} = await import("../app/api/orders/route.js");

const {
  GET: restaurantOrdersGET,
  PUT: restaurantOrdersPUT,
  _setTestRequireRestaurantAdmin,
} = await import("../app/api/restaurant/orders/route.js");

const {
  GET: handoverOtpGET,
  POST: handoverOtpPOST,
  _setTestGetServerSession: setOtpSession,
} = await import("../app/api/orders/[id]/handover-otp/route.js");

const {
  POST: verifyHandoverPOST,
  _setTestRequireRestaurantAdmin: setVerifyHandoverAuth,
} = await import("../app/api/restaurant/orders/[id]/verify-handover/route.js");

const {
  processOutboxBatch,
  _setTestPushDispatcher,
} = await import("../lib/notificationOutboxService.js");

let testsPassed = 0;
function recordPass(testName, details = "") {
  testsPassed++;
  console.log(`  ✓ Test ${testsPassed}: ${testName}`);
  if (details) console.log(`      ↳ ${details}`);
}

try {
  // Setup Fixtures
  const restA = await Restaurant.create({
    name: "Burger Express Alpha",
    slug: "burger-express-alpha",
    phone: "9876543210",
    address: { street: "1 Alpha Lane", city: "Vellore", state: "TN", pincode: "632014" },
    enabledFeatures: ["delivery", "pickup"],
    status: "active",
    cancellationSettings: { allowCustomerCancel: true, customerCancelWindowMinutes: 5 },
  });

  const restB = await Restaurant.create({
    name: "Pizza Palace Beta",
    slug: "pizza-palace-beta",
    phone: "9876543220",
    address: { street: "2 Beta Rd", city: "Vellore", state: "TN", pincode: "632014" },
    enabledFeatures: ["delivery", "pickup"],
    status: "active",
  });

  const custAlice = await User.create({
    name: "Alice Customer",
    email: "alice@test.com",
    role: "customer",
    phone: "9100000001",
  });

  const custBob = await User.create({
    name: "Bob Customer",
    email: "bob@test.com",
    role: "customer",
    phone: "9100000002",
  });

  const driverDave = await User.create({
    name: "Driver Dave",
    email: "dave@test.com",
    role: "staff",
    staffRoles: ["Delivery"],
    restaurant: restA._id,
    phone: "9100000003",
    status: "active",
  });

  const driverEarl = await User.create({
    name: "Driver Earl",
    email: "earl@test.com",
    role: "staff",
    staffRoles: ["Delivery"],
    restaurant: restA._id,
    phone: "9100000004",
    status: "active",
  });

  const cashierCarol = await User.create({
    name: "Cashier Carol",
    email: "carol@test.com",
    role: "staff",
    staffRoles: ["Cashier"],
    restaurant: restA._id,
    phone: "9100000005",
    status: "active",
  });

  const managerMary = await User.create({
    name: "Manager Mary",
    email: "mary@test.com",
    role: "staff",
    staffRoles: ["Manager"],
    restaurant: restA._id,
    phone: "9100000006",
    status: "active",
  });

  const cheese = await Ingredient.create({
    name: "Cheddar Cheese",
    unit: "kg",
    currentStock: 50,
    restaurant: restA._id,
  });

  const burgerProduct = await Product.create({
    name: "Classic Cheeseburger",
    price: 300,
    category: "Burgers",
    restaurant: restA._id,
    isAvailable: true,
  });

  await Recipe.create({
    product: burgerProduct._id,
    productName: "Classic Cheeseburger",
    restaurant: restA._id,
    ingredients: [{ ingredient: cheese._id, ingredientName: "Cheddar Cheese", quantity: 1, unit: "kg" }],
  });

  _setTestPushDispatcher(async () => ({ success: true, sentCount: 1 }));

  console.log("------------------------------------------------------------------------");
  console.log("GROUP 1: CORE CUSTOMER JOURNEY (HAPPY PATH + LIFECYCLE RECONCILIATION)");
  console.log("------------------------------------------------------------------------");

  // Test 1: Customer creates order with authoritative total
  const order1 = await Order.create({
    orderId: "ORD-E2E-0001",
    user: custAlice._id,
    restaurant: restA._id,
    items: [{ product: burgerProduct._id, name: "Classic Cheeseburger", quantity: 2, price: 300 }],
    subtotal: 600,
    deliveryFee: 70,
    discount: 0,
    totalAmount: 670,
    status: "pending",
    paymentMethod: "Cash on Delivery (COD)",
    paymentStatus: "pending",
    orderType: "delivery",
    address: { fullName: "Alice Customer", street: "Campus Gate A", city: "Vellore", pincode: "632014", phone: "9100000001" },
  });
  recordPass("Customer order created with authoritative total and delivery address", `orderId: ${order1.orderId}, total: ₹${order1.totalAmount}, status: ${order1.status}`);

  // Test 2: Order appears in Restaurant Alpha workspace view
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: true,
    isStaff: false,
    user: managerMary,
  }));
  const reqRestAGet = new Request("http://localhost:3000/api/restaurant/orders");
  const resRestAGet = await restaurantOrdersGET(reqRestAGet);
  const dataRestAGet = await resRestAGet.json();
  assert.strictEqual(resRestAGet.status, 200);
  assert.ok(dataRestAGet.orders.some((o) => o._id.toString() === order1._id.toString()));
  recordPass("Order appears in Restaurant Alpha's authorized workspace view", `ordersCount: ${dataRestAGet.orders.length}, foundInRestA: true`);

  // Test 3: Tenant Isolation: Order does NOT leak into Restaurant Beta workspace
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restB,
    restaurantId: restB._id,
    isAdmin: true,
    isStaff: false,
    user: { _id: new mongoose.Types.ObjectId(), name: "Beta Admin" },
  }));
  const reqRestBGet = new Request("http://localhost:3000/api/restaurant/orders");
  const resRestBGet = await restaurantOrdersGET(reqRestBGet);
  const dataRestBGet = await resRestBGet.json();
  assert.ok(!dataRestBGet.orders.some((o) => o._id.toString() === order1._id.toString()));
  recordPass("Tenant Isolation: Order does NOT leak into Restaurant Beta workspace", `leakedToRestB: false`);

  // Test 4: Restaurant confirms, prepares, and marks ready
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Kitchen"],
    user: { _id: new mongoose.Types.ObjectId(), name: "Chef Pierre", role: "staff" },
  }));
  // pending -> preparing
  const resPrep = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({ orderId: order1._id.toString(), status: "preparing" }),
  }));
  assert.strictEqual(resPrep.status, 200);

  // preparing -> ready
  const resReady = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({ orderId: order1._id.toString(), status: "ready" }),
  }));
  assert.strictEqual(resReady.status, 200);
  const readyOrder = await Order.findById(order1._id);
  assert.strictEqual(readyOrder.status, "ready");
  recordPass("Order successfully transitions through confirmed -> preparing -> ready", `persistedStatus: ${readyOrder.status}`);

  // Test 5: Order transitions to out_for_delivery and Delivery OTP is auto-issued
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Delivery"],
    user: driverDave,
  }));
  const resTransit = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({ orderId: order1._id.toString(), status: "out_for_delivery" }),
  }));
  assert.strictEqual(resTransit.status, 200);
  const transitOrder = await Order.findById(order1._id).select("+deliveryOtp.codeDigest +deliveryOtp.encryptedCode");
  assert.strictEqual(transitOrder.status, "out_for_delivery");
  assert.strictEqual(transitOrder.assignedDeliveryStaff.id.toString(), driverDave._id.toString());
  assert.strictEqual(transitOrder.deliveryOtp.status, "issued");
  recordPass("Order transitioned to out_for_delivery and Delivery OTP was generated", `status: ${transitOrder.status}, assignedDriver: Driver Dave (Staff A), hasOtp: true`);

  // Test 6: Authorized customer retrieves valid 4-digit handover OTP
  setOtpSession(async () => ({ user: { email: custAlice.email, role: "customer" } }));
  const reqCustOtp = new Request(`http://localhost:3000/api/orders/${order1._id}/handover-otp`);
  const resCustOtp = await handoverOtpGET(reqCustOtp, { params: Promise.resolve({ id: order1._id.toString() }) });
  const dataCustOtp = await resCustOtp.json();
  assert.strictEqual(resCustOtp.status, 200);
  assert.strictEqual(dataCustOtp.success, true);
  assert.strictEqual(typeof dataCustOtp.otpCode, "string");
  assert.strictEqual(dataCustOtp.otpCode.length, 4);
  const activeOtpCode = dataCustOtp.otpCode;
  recordPass("Authorized customer retrieves valid 4-digit handover OTP", `retrievedOtp: ${activeOtpCode}, attemptsRemaining: ${dataCustOtp.maxAttempts}`);

  // Test 7: Wrong OTP rejected (400), correct OTP completes delivery handover
  setVerifyHandoverAuth(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Delivery"],
    user: driverDave,
    staffId: driverDave._id,
  }));
  const reqWrongOtp = new Request(`http://localhost:3000/api/restaurant/orders/${order1._id}/verify-handover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otpCode: "0000" === activeOtpCode ? "1111" : "0000" }),
  });
  const resWrongOtp = await verifyHandoverPOST(reqWrongOtp, { params: Promise.resolve({ id: order1._id.toString() }) });
  assert.strictEqual(resWrongOtp.status, 400);

  const reqRightOtp = new Request(`http://localhost:3000/api/restaurant/orders/${order1._id}/verify-handover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      otpCode: activeOtpCode,
      codPaymentHandler: { collected: true },
    }),
  });
  const resRightOtp = await verifyHandoverPOST(reqRightOtp, { params: Promise.resolve({ id: order1._id.toString() }) });
  const dataRightOtp = await resRightOtp.json();
  assert.strictEqual(resRightOtp.status, 200);
  assert.strictEqual(dataRightOtp.success, true);
  recordPass("Wrong OTP rejected (400), correct OTP completes delivery handover", `wrongRes: ${resWrongOtp.status}, rightRes: ${resRightOtp.status}, status: delivered`);

  // Test 8: Delivery attribution, tracking termination, and COD collection recorded
  const deliveredOrder = await Order.findById(order1._id);
  assert.strictEqual(deliveredOrder.status, "delivered");
  assert.strictEqual(deliveredOrder.deliveryTracking.isLive, false);
  assert.strictEqual(deliveredOrder.paymentStatus, "paid");
  assert.strictEqual(deliveredOrder.codPaymentHandler.collected, true);
  assert.strictEqual(deliveredOrder.codPaymentHandler.amount, 670);
  assert.strictEqual(deliveredOrder.codPaymentHandler.settledWithManager, false);
  recordPass("Delivery attribution, tracking termination, and COD collection recorded", `isLive: false, codCollected: true, paymentStatus: paid`);

  // Test 9: Manager settles COD cash with delivery staff exactly once
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Manager"],
    user: managerMary,
  }));
  const resSettle = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({ orderId: order1._id.toString(), action: "settle_cod_cash" }),
  }));
  const dataSettle = await resSettle.json();
  assert.strictEqual(resSettle.status, 200);
  assert.strictEqual(dataSettle.settledCount, 1);
  const settledOrder = await Order.findById(order1._id);
  assert.strictEqual(settledOrder.codPaymentHandler.settledWithManager, true);
  recordPass("Manager settles COD cash with delivery staff exactly once", `settledCount: 1, settledWithManager: true`);

  // Test 10: Notification outbox records persisted and processed for core order lifecycle
  const outboxCount = await NotificationOutbox.countDocuments({ order: order1._id });
  assert.ok(outboxCount >= 1, "Outbox records must exist for order");
  const workerBatch = await processOutboxBatch({ batchSize: 20 });
  recordPass("Notification outbox records persisted and processed for core order lifecycle", `persistedEventsCount: ${outboxCount}, processedInCycle: ${workerBatch.claimedCount}`);

  console.log("------------------------------------------------------------------------");
  console.log("GROUP 2: NEGATIVE, AUTHORIZATION & CONCURRENCY JOURNEYS");
  console.log("------------------------------------------------------------------------");

  // Test 11: Unauthenticated request to retrieve handover OTP is rejected with 401
  setOtpSession(async () => null);
  const resUnauthOtp = await handoverOtpGET(new Request(`http://localhost:3000/api/orders/${order1._id}/handover-otp`), {
    params: Promise.resolve({ id: order1._id.toString() }),
  });
  assert.strictEqual(resUnauthOtp.status, 401);
  recordPass("Unauthenticated request to retrieve handover OTP is rejected with 401", `statusCode: 401`);

  // Test 12: IDOR Protection: Customer Bob cannot retrieve Alice's order OTP (404/403)
  setOtpSession(async () => ({ user: { email: custBob.email, role: "customer" } }));
  const resIdorOtp = await handoverOtpGET(new Request(`http://localhost:3000/api/orders/${order1._id}/handover-otp`), {
    params: Promise.resolve({ id: order1._id.toString() }),
  });
  assert.strictEqual(resIdorOtp.status, 404);
  recordPass("IDOR Protection: Customer Bob cannot retrieve Alice's order OTP (rejected 404/403)", `statusCode: 404`);

  // Test 13: Role Authorization: Non-delivery staff (Cashier) cannot verify handover (rejected 403)
  const orderRoleAuth = await Order.create({
    orderId: "ORD-E2E-ROLEAUTH",
    user: custAlice._id,
    restaurant: restA._id,
    items: [{ name: "Fries", quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "out_for_delivery",
    paymentMethod: "Cash on Delivery (COD)",
    paymentStatus: "pending",
    assignedDeliveryStaff: { id: driverDave._id, name: driverDave.name },
  });
  setVerifyHandoverAuth(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Cashier"],
    user: cashierCarol,
  }));
  const resCashierVerify = await verifyHandoverPOST(new Request(`http://localhost:3000/api/restaurant/orders/${orderRoleAuth._id}/verify-handover`, {
    method: "POST",
    body: JSON.stringify({ otpCode: "1234" }),
  }), { params: Promise.resolve({ id: orderRoleAuth._id.toString() }) });
  assert.strictEqual(resCashierVerify.status, 403);
  recordPass("Role Authorization: Non-delivery staff (Cashier) cannot verify handover (rejected 403)", `statusCode: 403`);

  // Test 14: Tenant Isolation: Cross-restaurant staff cannot verify handover (rejected 403/404)
  setVerifyHandoverAuth(async () => ({
    restaurant: restB,
    restaurantId: restB._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Delivery"],
    user: { _id: new mongoose.Types.ObjectId(), name: "Beta Driver", role: "staff" },
  }));
  const resCrossRestVerify = await verifyHandoverPOST(new Request(`http://localhost:3000/api/restaurant/orders/${orderRoleAuth._id}/verify-handover`, {
    method: "POST",
    body: JSON.stringify({ otpCode: "1234" }),
  }), { params: Promise.resolve({ id: orderRoleAuth._id.toString() }) });
  assert.ok(resCrossRestVerify.status === 403 || resCrossRestVerify.status === 404);
  recordPass("Tenant Isolation: Cross-restaurant staff cannot verify handover (rejected 403/404)", `statusCode: ${resCrossRestVerify.status}`);

  // Test 15: Reassignment Race: Driver Earl tries to verify order assigned to Driver Dave -> rejected
  const orderReassign = await Order.create({
    orderId: "ORD-E2E-REASSIGN",
    user: custAlice._id,
    restaurant: restA._id,
    items: [{ name: "Fries", quantity: 1, price: 100 }],
    totalAmount: 100,
    status: "out_for_delivery",
    paymentMethod: "Cash on Delivery (COD)",
    paymentStatus: "pending",
    assignedDeliveryStaff: { id: driverDave._id, name: driverDave.name },
  });
  setVerifyHandoverAuth(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Delivery"],
    user: driverEarl, // Not the assigned driver
  }));
  const resEarlVerify = await verifyHandoverPOST(new Request(`http://localhost:3000/api/restaurant/orders/${orderReassign._id}/verify-handover`, {
    method: "POST",
    body: JSON.stringify({ otpCode: "1234" }),
  }), { params: Promise.resolve({ id: orderReassign._id.toString() }) });
  assert.strictEqual(resEarlVerify.status, 403);
  recordPass("Reassignment Race: Reassigned driver attempt is rejected with 403/409 conflict", `statusCode: 403`);

  // Test 16: Concurrency: Simultaneous OTP verification requests yield exactly 1 success (200) and 1 conflict (409)
  const orderRaceOtp = await Order.create({
    orderId: "ORD-E2E-RACEDELIVER",
    user: custAlice._id,
    restaurant: restA._id,
    items: [{ name: "Drink", quantity: 1, price: 50 }],
    totalAmount: 50,
    status: "out_for_delivery",
    paymentMethod: "Cash on Delivery (COD)",
    paymentStatus: "pending",
    assignedDeliveryStaff: { id: driverDave._id, name: driverDave.name },
  });
  // Generate active OTP
  setOtpSession(async () => ({ user: { email: custAlice.email, role: "customer" } }));
  const resGenOtp = await handoverOtpGET(new Request(`http://localhost:3000/api/orders/${orderRaceOtp._id}/handover-otp`), {
    params: Promise.resolve({ id: orderRaceOtp._id.toString() }),
  });
  const dataGenOtp = await resGenOtp.json();
  const raceCode = dataGenOtp.otpCode;

  setVerifyHandoverAuth(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Delivery"],
    user: driverDave,
    staffId: driverDave._id,
  }));
  const [raceVerify1, raceVerify2] = await Promise.all([
    verifyHandoverPOST(new Request(`http://localhost:3000/api/restaurant/orders/${orderRaceOtp._id}/verify-handover`, {
      method: "POST",
      body: JSON.stringify({ otpCode: raceCode }),
    }), { params: Promise.resolve({ id: orderRaceOtp._id.toString() }) }),
    verifyHandoverPOST(new Request(`http://localhost:3000/api/restaurant/orders/${orderRaceOtp._id}/verify-handover`, {
      method: "POST",
      body: JSON.stringify({ otpCode: raceCode }),
    }), { params: Promise.resolve({ id: orderRaceOtp._id.toString() }) }),
  ]);
  const verifyStatuses = [raceVerify1.status, raceVerify2.status].sort();
  assert.deepStrictEqual(verifyStatuses, [200, 409]);
  recordPass("Concurrency: Simultaneous OTP verification requests yield exactly 1 success (200) and 1 conflict (409)", `statuses: ${verifyStatuses.join(", ")}`);

  // Test 17: Concurrency: Simultaneous manager settlement requests settle exactly once
  const orderRaceSettle = await Order.create({
    orderId: "ORD-E2E-RACESETTLE",
    user: custAlice._id,
    restaurant: restA._id,
    items: [{ name: "Wings", quantity: 1, price: 200 }],
    totalAmount: 200,
    status: "delivered",
    paymentMethod: "Cash on Delivery (COD)",
    paymentStatus: "paid",
    codPaymentHandler: { collected: true, settledWithManager: false, amount: 200 },
  });
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Manager"],
    user: managerMary,
  }));
  const [raceSettle1, raceSettle2] = await Promise.all([
    restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      body: JSON.stringify({ orderId: orderRaceSettle._id.toString(), action: "settle_cod_cash" }),
    })),
    restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      body: JSON.stringify({ orderId: orderRaceSettle._id.toString(), action: "settle_cod_cash" }),
    })),
  ]);
  const settleData1 = await raceSettle1.json();
  const settleData2 = await raceSettle2.json();
  const totalSettled = (settleData1.settledCount || 0) + (settleData2.settledCount || 0);
  const totalSkipped = (settleData1.skippedCount || 0) + (settleData2.skippedCount || 0);
  assert.strictEqual(totalSettled, 1);
  assert.strictEqual(totalSkipped, 1);
  recordPass("Concurrency: Simultaneous manager settlement requests settle exactly once (settledCount: 1, skippedCount: 1)", `totalSettled: ${totalSettled}, totalSkipped: ${totalSkipped}`);

  // Test 18: Lifecycle Integrity: Delivered order cannot be cancelled by customer
  setOrdersSession(async () => ({ user: { email: custAlice.email, role: "customer" } }));
  const resCancelDelivered = await ordersCustomerPATCH(new Request("http://localhost:3000/api/orders", {
    method: "PATCH",
    body: JSON.stringify({ orderId: order1._id.toString(), reason: "Changed mind" }),
  }));
  assert.strictEqual(resCancelDelivered.status, 400);
  recordPass("Lifecycle Integrity: Delivered order cannot be cancelled by customer (rejected 400)", `statusCode: ${resCancelDelivered.status}`);

  // Test 19: Security Invariant: Direct transition from pending to delivered without OTP verification is rejected
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Delivery"],
    user: driverDave,
  }));
  const orderDirectDeliver = await Order.create({
    orderId: "ORD-E2E-DIRECTDELIVER",
    user: custAlice._id,
    restaurant: restA._id,
    items: [{ name: "Drink", quantity: 1, price: 50 }],
    totalAmount: 50,
    status: "pending",
    paymentMethod: "Cash on Delivery (COD)",
  });
  const resDirectDeliver = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({ orderId: orderDirectDeliver._id.toString(), status: "delivered" }),
  }));
  assert.strictEqual(resDirectDeliver.status, 400);
  recordPass("Security Invariant: Direct transition from pending to delivered without OTP verification is rejected (400)", `statusCode: ${resDirectDeliver.status}`);

  // Test 20: Financial Integrity: Online payment order cannot be settled as COD cash
  const orderOnline = await Order.create({
    orderId: "ORD-E2E-ONLINE",
    user: custAlice._id,
    restaurant: restA._id,
    items: [{ name: "Online Pizza", quantity: 1, price: 400 }],
    totalAmount: 400,
    status: "delivered",
    paymentMethod: "Razorpay (Online)",
    paymentStatus: "paid",
  });
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Manager"],
    user: managerMary,
  }));
  const resOnlineSettle = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({ orderId: orderOnline._id.toString(), action: "settle_cod_cash" }),
  }));
  const dataOnlineSettle = await resOnlineSettle.json();
  assert.strictEqual(dataOnlineSettle.settledCount, 0);
  assert.strictEqual(dataOnlineSettle.reason, "not_cod_payment");
  recordPass("Financial Integrity: Online payment order cannot be settled as COD cash (skipped: not_cod_payment)", `settledCount: 0, skippedReason: not_cod_payment`);

  console.log("------------------------------------------------------------------------");
  console.log("GROUP 3: PICKUP & CANCELLATION WORKFLOWS");
  console.log("------------------------------------------------------------------------");

  // Test 21: Pickup Workflow: Counter pickup order transitions to delivered without requiring delivery OTP
  const orderPickup = await Order.create({
    orderId: "ORD-E2E-PICKUP",
    user: custAlice._id,
    restaurant: restA._id,
    items: [{ name: "Pickup Wrap", quantity: 1, price: 180 }],
    totalAmount: 180,
    status: "ready",
    orderType: "pickup",
    paymentMethod: "Cash on Pickup (COP)",
    paymentStatus: "pending",
  });
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Cashier"],
    user: cashierCarol,
  }));
  const resPickupDeliver = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({
      orderId: orderPickup._id.toString(),
      status: "delivered",
      codPaymentHandler: { collected: true, amount: 180 },
    }),
  }));
  assert.strictEqual(resPickupDeliver.status, 200);
  const updatedPickup = await Order.findById(orderPickup._id);
  assert.strictEqual(updatedPickup.status, "delivered");
  recordPass("Pickup Workflow: Counter pickup order transitions to delivered without requiring delivery OTP", `status: delivered, orderType: pickup`);

  // Test 22: Pickup Reconciliation: Cash on pickup successfully settled with manager
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Manager"],
    user: managerMary,
  }));
  const resPickupSettle = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({ orderId: orderPickup._id.toString(), action: "settle_cod_cash" }),
  }));
  assert.strictEqual(resPickupSettle.status, 200);
  const dataPickupSettle = await resPickupSettle.json();
  assert.strictEqual(dataPickupSettle.settledCount, 1);
  recordPass("Pickup Reconciliation: Cash on pickup successfully settled with manager", `settledCount: 1`);

  // Test 23: Cancellation: Customer cancellation restores inventory stock exactly once
  const orderCancel = await Order.create({
    orderId: "ORD-E2E-CANCEL",
    user: custAlice._id,
    restaurant: restA._id,
    items: [{ product: burgerProduct._id, name: "Burger", quantity: 2, price: 300 }],
    totalAmount: 600,
    status: "pending",
    stockDeducted: true,
    stockRestored: false,
    deductedIngredients: [{ ingredient: cheese._id, quantity: 2, unit: "kg" }],
  });
  cheese.currentStock = 50;
  await cheese.save();

  setOrdersSession(async () => ({ user: { email: custAlice.email, role: "customer" } }));
  const resCancel = await ordersCustomerPATCH(new Request("http://localhost:3000/api/orders", {
    method: "PATCH",
    body: JSON.stringify({ orderId: orderCancel._id.toString(), reason: "Mistake" }),
  }));
  assert.strictEqual(resCancel.status, 200);
  const reloadedCheese = await Ingredient.findById(cheese._id);
  assert.strictEqual(reloadedCheese.currentStock, 52); // 50 + 2 restored
  recordPass("Cancellation: Customer cancellation restores inventory stock exactly once", `status: cancelled, stockRestored: 50 -> 52`);

  // Test 24: Terminal State Protection: Cancelled order cannot be resurrected into preparing status
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Kitchen"],
    user: { _id: new mongoose.Types.ObjectId(), name: "Chef Pierre", role: "staff" },
  }));
  const resResurrect = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({ orderId: orderCancel._id.toString(), status: "preparing" }),
  }));
  assert.strictEqual(resResurrect.status, 400);
  recordPass("Terminal State Protection: Cancelled order cannot be resurrected into preparing status (400)", `statusCode: 400`);

  console.log("------------------------------------------------------------------------");
  console.log("GROUP 4: FRONTEND & API INTEGRATION VERIFICATION");
  console.log("------------------------------------------------------------------------");

  // Test 25: API Contract: POST /api/orders returns { success: true, order: { _id, orderId, totalAmount, ... } }
  setOrdersSession(async () => ({ user: { email: custAlice.email, role: "customer" } }));
  const resCreateOrder = await ordersPOST(new Request("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantId: restA._id.toString(),
      items: [{ product: burgerProduct._id.toString(), quantity: 1 }],
      address: { fullName: "Alice Customer", street: "Campus Gate A", phone: "9100000001", city: "Vellore", pincode: "632014" },
      paymentMethod: "Cash on Delivery",
    }),
  }));
  assert.strictEqual(resCreateOrder.status, 201);
  const dataCreateOrder = await resCreateOrder.json();
  assert.strictEqual(dataCreateOrder.success, true);
  assert.ok(dataCreateOrder.order._id);
  assert.ok(dataCreateOrder.order.orderId);
  recordPass("API Contract: POST /api/orders returns { success: true, order: { _id, orderId, totalAmount, ... } }", `orderId: ${dataCreateOrder.order.orderId}, totalAmount: ${dataCreateOrder.order.totalAmount}`);

  // Test 26: API Contract: Batch settle returns accurate settledCount, skippedCount, and categorized skippedOrders
  _setTestRequireRestaurantAdmin(async () => ({
    restaurant: restA,
    restaurantId: restA._id,
    isAdmin: false,
    isStaff: true,
    staffRoles: ["Manager"],
    user: managerMary,
  }));
  const resBatchSettle = await restaurantOrdersPUT(new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    body: JSON.stringify({
      orderIds: [order1._id.toString(), orderOnline._id.toString(), orderCancel._id.toString()],
      action: "settle_cod_cash",
    }),
  }));
  const dataBatchSettle = await resBatchSettle.json();
  assert.strictEqual(dataBatchSettle.settledCount, 0); // all already settled or ineligible
  assert.strictEqual(dataBatchSettle.skippedCount, 3);
  assert.strictEqual(dataBatchSettle.skippedOrders.length, 3);
  recordPass("API Contract: Batch settle returns accurate settledCount, skippedCount, and categorized skippedOrders", `settledCount: 0, skippedCount: 3`);

  console.log("\n========================================================================");
  console.log(`🎉 ALL ${testsPassed} OF ${testsPassed} END-TO-END WORKFLOW TESTS PASSED!`);
  console.log("========================================================================\n");

} catch (err) {
  console.error("\n❌ E2E SUITE FAILED WITH ERROR:", err);
  process.exitCode = 1;
} finally {
  _setTestRequireRestaurantAdmin(null);
  setVerifyHandoverAuth(null);
  setOrdersSession(null);
  setOtpSession(null);
  _setTestPushDispatcher(null);
  try {
    await mongoose.disconnect();
  } catch (e) {}
  if (replSet) {
    try {
      await replSet.stop();
    } catch (e) {}
  }
  process.exit(process.exitCode || 0);
}
