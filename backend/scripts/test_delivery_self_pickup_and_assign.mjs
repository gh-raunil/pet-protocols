import { register } from "node:module";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import dns from "dns";
import assert from "node:assert/strict";

register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);
dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("========================================================================");
console.log("TEST: DELIVERY SELF-PICKUP & DIRECT ASSIGNMENT SUITE");
console.log("========================================================================\n");

const { MongoMemoryReplSet } = await import("mongodb-memory-server");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const localUri = replSet.getUri("test_self_pickup_isolated");

process.env.MONGODB_URI = localUri;
process.env.TEST_MONGODB_URI = localUri;
process.env.DELIVERY_OTP_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

await mongoose.connect(localUri);
console.log(`Connected to isolated test database: ${localUri}\n`);

const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;

const {
  POST: assignOrderPOST,
  _setTestRequireRestaurantAdmin: setAssignOrderAuth,
} = await import("../app/api/restaurant/orders/[id]/assign/route.js");

const {
  PUT: restaurantOrdersPUT,
  _setTestRequireRestaurantAdmin: setRestaurantOrdersAuth,
} = await import("../app/api/restaurant/orders/route.js");

// Mock auth helper
function mockAuth(user, restaurant) {
  const isStaff = user.role === "staff";
  const staffRoles = isStaff
    ? Array.isArray(user.staffRoles) && user.staffRoles.length > 0
      ? user.staffRoles
      : (user.staffRole ? [user.staffRole] : [])
    : [];
  const isAdmin = user.role === "restaurant_admin" || user.role === "admin";
  return {
    user,
    restaurantId: restaurant._id,
    isStaff,
    isAdmin,
    staffRoles,
    staffRole: staffRoles[0] || null,
  };
}

// Setup test restaurant and users
const rest = await Restaurant.create({
  name: "Pet Protocols Express",
  slug: "pet-protocols-express",
  email: "express@petprotocols.test",
  phone: "9876543210",
  address: { street: "123 Test Street", city: "Bangalore", state: "KA", pincode: "560001", latitude: 12.9716, longitude: 77.5946 },
  status: "active",
});

const manager = await User.create({
  name: "Manager Rounak",
  email: "rounak.manager@test.com",
  phone: "9998887770",
  role: "staff",
  staffRoles: ["Manager"],
  restaurant: rest._id,
  status: "active",
});

const driverA = await User.create({
  name: "Driver Amar",
  email: "amar.driver@test.com",
  phone: "9998887771",
  role: "staff",
  staffRoles: ["Delivery"],
  restaurant: rest._id,
  status: "active",
});

const driverB = await User.create({
  name: "Driver Bobby",
  email: "bobby.driver@test.com",
  phone: "9998887772",
  role: "staff",
  staffRoles: ["Delivery"],
  restaurant: rest._id,
  status: "active",
});

let testCount = 0;
function report(name, passed) {
  testCount++;
  console.log(`  ${passed ? "✓" : "✗"} Test ${testCount}: ${name}`);
  assert.ok(passed, `Failed: ${name}`);
}

async function createOrder(attrs = {}) {
  return await Order.create({
    restaurant: rest._id,
    orderId: `PET-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    status: "ready",
    paymentStatus: "paid",
    paymentMethod: "online",
    totalAmount: 399,
    address: {
      fullName: "Test Customer",
      phone: "9876543210",
      street: "456 Customer Road",
      city: "Bangalore",
      pincode: "560001",
    },
    items: [{ name: "Burger", quantity: 1, price: 399 }],
    ...attrs,
  });
}

// 1. Manager Assigns Driver
{
  const order = await createOrder();
  setAssignOrderAuth(async () => mockAuth(manager, rest));
  const req = new Request(`http://localhost:3000/api/restaurant/orders/${order._id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deliveryStaffId: driverA._id.toString() }),
  });
  const res = await assignOrderPOST(req, { params: Promise.resolve({ id: order._id.toString() }) });
  const data = await res.json();
  const refreshed = await Order.findById(order._id);
  report(
    "Manager can assign driver from KDS assign route",
    res.status === 200 &&
    data.success &&
    refreshed.assignedDeliveryStaff?.id?.toString() === driverA._id.toString()
  );
}

// 2. Manager Unassigns Driver
{
  const order = await createOrder({
    assignedDeliveryStaff: {
      id: driverA._id,
      name: driverA.name,
      phone: driverA.phone,
    },
    deliveryAssignmentMode: "staff",
  });
  setAssignOrderAuth(async () => mockAuth(manager, rest));
  const req = new Request(`http://localhost:3000/api/restaurant/orders/${order._id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unassign: true }),
  });
  const res = await assignOrderPOST(req, { params: Promise.resolve({ id: order._id.toString() }) });
  const data = await res.json();
  const refreshed = await Order.findById(order._id);
  report(
    "Manager can unassign driver returning parcel to awaiting pickup pool",
    res.status === 200 &&
    data.success &&
    refreshed.assignedDeliveryStaff?.id === undefined
  );
}

// 3. Delivery Boy self-claims parcel via assign endpoint (selfClaim: true)
{
  const order = await createOrder();
  setAssignOrderAuth(async () => mockAuth(driverA, rest));
  const req = new Request(`http://localhost:3000/api/restaurant/orders/${order._id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selfClaim: true }),
  });
  const res = await assignOrderPOST(req, { params: Promise.resolve({ id: order._id.toString() }) });
  const data = await res.json();
  const refreshed = await Order.findById(order._id);
  report(
    "Delivery boy can self-claim parcel in assign route (selfClaim: true)",
    res.status === 200 &&
    data.success &&
    refreshed.assignedDeliveryStaff?.id?.toString() === driverA._id.toString()
  );
}

// 4. Delivery Boy picks up UNASSIGNED parcel directly at counter (PUT status out_for_delivery)
{
  const order = await createOrder({ status: "ready" });
  setRestaurantOrdersAuth(async () => mockAuth(driverB, rest));
  const req = new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: order._id.toString(), status: "out_for_delivery" }),
  });
  const res = await restaurantOrdersPUT(req);
  const data = await res.json();
  const refreshed = await Order.findById(order._id);
  report(
    "Delivery boy can pick up unassigned parcel directly without manager pre-assignment",
    res.status === 200 &&
    data.success &&
    refreshed.status === "out_for_delivery" &&
    refreshed.assignedDeliveryStaff?.id?.toString() === driverB._id.toString()
  );
}

// 5. Delivery Boy picks up parcel with selfPickup flag (whether manager assigned or not)
{
  const order = await createOrder({
    status: "ready",
    assignedDeliveryStaff: {
      id: driverA._id,
      name: driverA.name,
      phone: driverA.phone,
    },
  });
  // Driver B arrives at kitchen counter and picks up the parcel
  setRestaurantOrdersAuth(async () => mockAuth(driverB, rest));
  const req = new Request("http://localhost:3000/api/restaurant/orders", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: order._id.toString(),
      status: "out_for_delivery",
      selfPickup: true,
    }),
  });
  const res = await restaurantOrdersPUT(req);
  const data = await res.json();
  const refreshed = await Order.findById(order._id);
  report(
    "Delivery boy can pick up parcel with selfPickup: true even if previously assigned",
    res.status === 200 &&
    data.success &&
    refreshed.status === "out_for_delivery" &&
    refreshed.assignedDeliveryStaff?.id?.toString() === driverB._id.toString()
  );
}

console.log("\n========================================================================");
console.log(`RESULTS: ${testCount} / ${testCount} TESTS PASSED`);
console.log("========================================================================\n");

await replSet.stop();
process.exit(0);
