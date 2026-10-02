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

console.log("=== Testing Web Push Notifications Architecture & Multi-Tenant Flows ===");

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB successfully.");

const PushSubscription = (await import("../models/PushSubscription.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;
const Order = (await import("../models/Order.js")).default;
const {
  getVapidPublicKey,
  sendPushToUser,
  sendPushToRestaurantAdmins,
  notifyOrderEvent,
} = await import("../lib/pushService.js");

// Clean up any test records
await PushSubscription.deleteMany({ endpoint: { $regex: /test-push-endpoint/ } });
await User.deleteMany({ email: { $regex: /@test-push\.com$/ } });
await Restaurant.deleteMany({ slug: { $regex: /^test-rest-push-/ } });
await Order.deleteMany({ notes: "[TEST_PUSH_SUITE]" });

try {
  // TEST 1: VAPID Configuration
  console.log("\n[TEST 1] Verifying VAPID configuration...");
  const pubKey = getVapidPublicKey();
  console.log("Configured VAPID Public Key:", pubKey ? `${pubKey.slice(0, 16)}...` : "NOT CONFIGURED");
  assert.ok(pubKey, "VAPID public key must be defined in environment");

  // TEST 2: Multi-Tenant Setup (Restaurant A vs Restaurant B)
  console.log("\n[TEST 2] Setting up Multi-Tenant isolation test entities...");
  const restA = await Restaurant.create({
    name: "Push Kitchen Alpha",
    slug: `test-rest-push-alpha-${Date.now()}`,
    status: "active",
  });

  const restB = await Restaurant.create({
    name: "Push Kitchen Beta",
    slug: `test-rest-push-beta-${Date.now()}`,
    status: "active",
  });

  const adminA = await User.create({
    name: "Admin Alpha",
    email: `admin.alpha.${Date.now()}@test-push.com`,
    role: "restaurant_admin",
    restaurant: restA._id,
    status: "active",
  });

  const adminB = await User.create({
    name: "Admin Beta",
    email: `admin.beta.${Date.now()}@test-push.com`,
    role: "restaurant_admin",
    restaurant: restB._id,
    status: "active",
  });

  const customer = await User.create({
    name: "Push Customer",
    email: `customer.${Date.now()}@test-push.com`,
    role: "customer",
    status: "active",
  });

  console.log(`Created Restaurant Alpha (${restA._id}) with Admin Alpha (${adminA._id})`);
  console.log(`Created Restaurant Beta (${restB._id}) with Admin Beta (${adminB._id})`);
  console.log(`Created Customer (${customer._id})`);

  // TEST 3: Multiple Devices Subscription Management
  console.log("\n[TEST 3] Registering multiple device subscriptions for Admin Alpha and Customer...");
  const subAlphaLaptop = await PushSubscription.create({
    user: adminA._id,
    endpoint: `https://fcm.googleapis.com/fcm/send/test-push-endpoint-alpha-laptop-${Date.now()}`,
    keys: {
      p256dh: "BM_test_p256dh_key_alpha_laptop_1234567890abcdef",
      auth: "auth_key_alpha_12345",
    },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
    status: "active",
  });

  const subAlphaPhone = await PushSubscription.create({
    user: adminA._id,
    endpoint: `https://fcm.googleapis.com/fcm/send/test-push-endpoint-alpha-phone-${Date.now()}`,
    keys: {
      p256dh: "BM_test_p256dh_key_alpha_phone_1234567890abcdef",
      auth: "auth_key_alpha_phone_12345",
    },
    userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile",
    status: "active",
  });

  const subBeta = await PushSubscription.create({
    user: adminB._id,
    endpoint: `https://fcm.googleapis.com/fcm/send/test-push-endpoint-beta-pc-${Date.now()}`,
    keys: {
      p256dh: "BM_test_p256dh_key_beta_1234567890abcdef",
      auth: "auth_key_beta_12345",
    },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    status: "active",
  });

  const subCustomer = await PushSubscription.create({
    user: customer._id,
    endpoint: `https://fcm.googleapis.com/fcm/send/test-push-endpoint-customer-${Date.now()}`,
    keys: {
      p256dh: "BM_test_p256dh_key_cust_1234567890abcdef",
      auth: "auth_key_cust_12345",
    },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    status: "active",
  });

  const alphaSubs = await PushSubscription.find({ user: adminA._id, status: "active" });
  assert.strictEqual(alphaSubs.length, 2, "Admin Alpha should have exactly 2 active devices");
  console.log(`Admin Alpha has ${alphaSubs.length} active devices registered.`);

  // TEST 4: Tenant Data Isolation
  console.log("\n[TEST 4] Verifying Tenant Data Isolation between Restaurant Alpha and Beta...");
  // Querying push subscribers for Restaurant Alpha must NEVER include Admin Beta's subscriptions
  const staffAlpha = await User.find({
    restaurant: restA._id,
    status: "active",
    role: { $in: ["restaurant_admin", "admin", "staff"] },
  }).select("_id");

  const alphaIds = staffAlpha.map((u) => u._id.toString());
  assert.ok(alphaIds.includes(adminA._id.toString()), "Restaurant Alpha staff list includes Admin Alpha");
  assert.ok(!alphaIds.includes(adminB._id.toString()), "Restaurant Alpha staff list NEVER includes Admin Beta");

  const targetedSubsAlpha = await PushSubscription.find({
    user: { $in: staffAlpha.map((u) => u._id) },
    status: "active",
  });

  const alphaSubEndpoints = targetedSubsAlpha.map((s) => s.endpoint);
  assert.ok(alphaSubEndpoints.includes(subAlphaLaptop.endpoint), "Includes Alpha laptop");
  assert.ok(alphaSubEndpoints.includes(subAlphaPhone.endpoint), "Includes Alpha phone");
  assert.ok(!alphaSubEndpoints.includes(subBeta.endpoint), "NEVER includes Beta endpoint");
  console.log("Tenant data isolation strictly verified: Restaurant Alpha push targets only Alpha devices.");

  // TEST 5: Order Event Workflow Dispatching
  console.log("\n[TEST 5] Testing Order Event Notification Dispatching...");
  const testOrder = await Order.create({
    user: customer._id,
    restaurant: restA._id,
    items: [
      { name: "Pet Burger Deluxe", price: 250, quantity: 2, foodType: "veg" },
    ],
    address: {
      fullName: "Jane Doe",
      phone: "9876543210",
      street: "123 Pet Lane",
      city: "Bangalore",
    },
    subtotal: 500,
    totalAmount: 500,
    status: "pending",
    notes: "[TEST_PUSH_SUITE]",
  });

  const populatedOrder = await Order.findById(testOrder._id)
    .populate("restaurant", "name slug")
    .populate("user", "name email");

  // A) Test order_placed
  console.log("5A: Dispatching 'order_placed' event...");
  const placedRes = await notifyOrderEvent(populatedOrder, "order_placed");
  assert.strictEqual(placedRes.success, true, "notifyOrderEvent should succeed");
  console.log("5A: 'order_placed' event dispatched successfully.");

  // B) Test status_update: preparing
  console.log("5B: Dispatching 'status_update' (preparing)...");
  const prepRes = await notifyOrderEvent(populatedOrder, "status_update", { status: "preparing" });
  assert.strictEqual(prepRes.success, true);
  console.log("5B: 'status_update' (preparing) dispatched successfully.");

  // C) Test status_update: out_for_delivery
  console.log("5C: Dispatching 'status_update' (out_for_delivery)...");
  const dispatchRes = await notifyOrderEvent(populatedOrder, "status_update", { status: "out_for_delivery" });
  assert.strictEqual(dispatchRes.success, true);
  console.log("5C: 'status_update' (out_for_delivery) dispatched successfully.");

  // D) Test status_update: delivered
  console.log("5D: Dispatching 'status_update' (delivered)...");
  const deliveredRes = await notifyOrderEvent(populatedOrder, "status_update", { status: "delivered" });
  assert.strictEqual(deliveredRes.success, true);
  console.log("5D: 'status_update' (delivered) dispatched successfully.");

  // E) Test order_cancelled_by_customer
  console.log("5E: Dispatching 'order_cancelled_by_customer'...");
  const cancelRes = await notifyOrderEvent(populatedOrder, "order_cancelled_by_customer", {
    reason: "Changed mind",
  });
  assert.strictEqual(cancelRes.success, true);
  console.log("5E: 'order_cancelled_by_customer' dispatched successfully.");

  // TEST 6: Restaurant Setting Toggle Override
  console.log("\n[TEST 6] Verifying Restaurant notification settings disable push channel...");
  restA.notificationSettings = {
    ...restA.notificationSettings,
    channels: { push: false },
  };
  await restA.save();

  const disabledChannelRes = await sendPushToRestaurantAdmins(restA._id, {
    title: "Test",
    body: "Should be skipped",
  });
  assert.strictEqual(disabledChannelRes.success, true);
  assert.strictEqual(disabledChannelRes.sentCount, 0);
  assert.strictEqual(disabledChannelRes.reason, "Push disabled by restaurant settings");
  console.log("Restaurant channel push disabled setting honored correctly.");

  // TEST 7: Single Device Unsubscription (Disabling 1 device preserves other devices)
  console.log("\n[TEST 7] Verifying single device unsubscription...");
  await PushSubscription.deleteOne({ endpoint: subAlphaLaptop.endpoint });

  const remainingAlphaSubs = await PushSubscription.find({ user: adminA._id, status: "active" });
  assert.strictEqual(remainingAlphaSubs.length, 1, "Admin Alpha should still have 1 active device");
  assert.strictEqual(remainingAlphaSubs[0].endpoint, subAlphaPhone.endpoint, "Remaining device is Alpha Phone");
  console.log("Single device unsubscription verified: Phone remains active after Laptop removed.");

} finally {
  // Cleanup test entities
  await PushSubscription.deleteMany({ endpoint: { $regex: /test-push-endpoint/ } });
  await User.deleteMany({ email: { $regex: /@test-push\.com$/ } });
  await Restaurant.deleteMany({ slug: { $regex: /^test-rest-push-/ } });
  await Order.deleteMany({ notes: "[TEST_PUSH_SUITE]" });
  console.log("\nCleaned up all test records.");
  await mongoose.disconnect();
}

console.log("\n>>> ALL WEB PUSH ARCHITECTURE & DATA ISOLATION TESTS PASSED! <<<");
