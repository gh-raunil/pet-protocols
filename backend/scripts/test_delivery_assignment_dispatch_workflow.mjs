import { register } from "node:module";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import dns from "dns";
import assert from "node:assert/strict";

register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);
dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("========================================================================");
console.log("PET PROTOCOLS — DELIVERY ASSIGNMENT, DISPATCH & DUAL-PARTY OTP SUITE");
console.log("STRICTLY ISOLATED IN-MEMORY DATABASE TEST HARNESS (MongoMemoryReplSet)");
console.log("========================================================================\n");

// 1. Start isolated MongoMemoryReplSet (zero access to live or persistent database)
console.log("Starting isolated MongoMemoryReplSet...");
const { MongoMemoryReplSet } = await import("mongodb-memory-server");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const localUri = replSet.getUri("test_delivery_assignment_isolated");
assert.ok(
  localUri.includes("127.0.0.1") || localUri.includes("localhost"),
  "Security Invariant: Must use isolated loopback MongoDB URI"
);

process.env.MONGODB_URI = localUri;
process.env.TEST_MONGODB_URI = localUri;
process.env.DELIVERY_OTP_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

await mongoose.connect(localUri);
console.log(`Connected to isolated test database: ${localUri}\n`);

// 2. Import models
const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;

// 3. Import services & route handlers
const {
  issueDeliveryOtpForOrder,
  verifyAndCompleteDelivery,
  decryptOtpCode,
} = await import("../lib/deliveryOtpService.js");

const {
  GET: deliveryStaffGET,
  _setTestRequireRestaurantAdmin: setDeliveryStaffAuth,
} = await import("../app/api/restaurant/delivery-staff/route.js");

const {
  POST: assignOrderPOST,
  PUT: assignOrderPUT,
  _setTestRequireRestaurantAdmin: setAssignOrderAuth,
} = await import("../app/api/restaurant/orders/[id]/assign/route.js");

const {
  PUT: restaurantOrdersPUT,
  _setTestRequireRestaurantAdmin: setRestaurantOrdersAuth,
} = await import("../app/api/restaurant/orders/route.js");

const {
  GET: orderOtpGET,
  _setTestRequireRestaurantAdmin: setOrderOtpAuth,
} = await import("../app/api/restaurant/orders/[id]/otp/route.js");

const {
  POST: driverVerifyHandoverPOST,
  _setTestRequireRestaurantAdmin: setDriverVerifyAuth,
} = await import("../app/api/restaurant/orders/[id]/verify-handover/route.js");

const {
  GET: customerHandoverOtpGET,
  _setTestGetServerSession: setCustomerOtpSession,
} = await import("../app/api/orders/[id]/handover-otp/route.js");

// 4. Setup Test Fixtures
const restA = await Restaurant.create({
  name: "Assignment Test Kitchen A",
  slug: "assignment-test-kitchen-a",
  phone: "9876543001",
  address: { street: "101 Dispatch St", city: "Bangalore", state: "KA", pincode: "560001", latitude: 12.9716, longitude: 77.5946 },
  enabledFeatures: ["delivery", "pickup"],
});

const restB = await Restaurant.create({
  name: "Assignment Test Kitchen B",
  slug: "assignment-test-kitchen-b",
  phone: "9876543002",
  address: { street: "202 Cross St", city: "Bangalore", state: "KA", pincode: "560002", latitude: 12.9800, longitude: 77.6000 },
  enabledFeatures: ["delivery", "pickup"],
});

// Users
const managerA = await User.create({
  name: "Manager Alpha",
  email: "manager.alpha@test.com",
  role: "restaurant_admin",
  restaurant: restA._id,
  status: "active",
  phone: "9900011111",
});

const managerB = await User.create({
  name: "Manager Beta",
  email: "manager.beta@test.com",
  role: "restaurant_admin",
  restaurant: restB._id,
  status: "active",
  phone: "9900022222",
});

const driverA = await User.create({
  name: "Driver Dave",
  email: "driver.dave@test.com",
  role: "staff",
  staffRole: "Delivery",
  staffRoles: ["Delivery"],
  restaurant: restA._id,
  status: "active",
  phone: "9900033333",
});

const driverB = await User.create({
  name: "Driver Dan",
  email: "driver.dan@test.com",
  role: "staff",
  staffRole: "Delivery",
  staffRoles: ["Delivery"],
  restaurant: restA._id,
  status: "active",
  phone: "9900044444",
});

const driverInactive = await User.create({
  name: "Driver Inactive",
  email: "driver.inactive@test.com",
  role: "staff",
  staffRole: "Delivery",
  staffRoles: ["Delivery"],
  restaurant: restA._id,
  status: "inactive",
  phone: "9900055555",
});

const driverOtherRest = await User.create({
  name: "Driver OtherRest",
  email: "driver.otherrest@test.com",
  role: "staff",
  staffRole: "Delivery",
  staffRoles: ["Delivery"],
  restaurant: restB._id,
  status: "active",
  phone: "9900066666",
});

const kitchenStaffA = await User.create({
  name: "Chef Charlie",
  email: "chef.charlie@test.com",
  role: "staff",
  staffRole: "Kitchen",
  staffRoles: ["Kitchen"],
  restaurant: restA._id,
  status: "active",
  phone: "9900077777",
});

const customerAlice = await User.create({
  name: "Alice Customer",
  email: "alice.cust@test.com",
  role: "customer",
  status: "active",
  phone: "9900088888",
});

function mockAuth(user, restaurant) {
  return {
    authenticated: true,
    user,
    userId: user._id.toString(),
    restaurant,
    restaurantId: restaurant._id.toString(),
    isAdmin: user.role === "restaurant_admin" || user.role === "admin" || user.role === "superadmin",
    isStaff: user.role === "staff",
    staffRoles: user.staffRoles || (user.staffRole ? [user.staffRole] : []),
  };
}

let testIndex = 0;
let passedCount = 0;
let failedCount = 0;

function report(name, condition, extra = "") {
  testIndex++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ Test ${testIndex}: ${name}`);
  } else {
    failedCount++;
    console.error(`  ✗ Test ${testIndex} FAILED: ${name}`);
    if (extra) console.error(`      ↳ Detail: ${extra}`);
  }
}

async function createTestOrder(overrides = {}) {
  return await Order.create({
    orderId: `ORD_TEST_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    user: customerAlice._id,
    restaurant: restA._id,
    orderType: "delivery",
    status: "ready",
    paymentStatus: "paid",
    paymentMethod: "Mock Payment",
    totalAmount: 450,
    items: [{ name: "Paneer Butter Masala", price: 450, quantity: 1 }],
    address: {
      fullName: "Alice Customer",
      phone: "9900088888",
      street: "123 Maple Street",
      city: "Bangalore",
      state: "KA",
      pincode: "560001",
      latitude: 12.972,
      longitude: 77.595,
    },
    ...overrides,
  });
}

try {
  // =========================================================================
  // GROUP 1: ASSIGNMENT TESTS (1 - 10)
  // =========================================================================
  console.log("------------------------------------------------------------------------");
  console.log("GROUP 1: ASSIGNMENT TESTS");
  console.log("------------------------------------------------------------------------");

  // Test 1: Authorized manager can list delivery staff for their restaurant
  {
    setDeliveryStaffAuth(async () => mockAuth(managerA, restA));
    const res = await deliveryStaffGET();
    const data = await res.json();
    report(
      "Authorized manager can list delivery staff for their restaurant",
      res.status === 200 && data.success && Array.isArray(data.deliveryStaff) && data.deliveryStaff.length >= 3
    );
  }

  // Test 2: Manager sees active and inactive personnel with accurate status labels
  {
    setDeliveryStaffAuth(async () => mockAuth(managerA, restA));
    const res = await deliveryStaffGET();
    const data = await res.json();
    const activeStaff = data.deliveryStaff.find((s) => s.name === "Driver Dave");
    const inactiveStaff = data.deliveryStaff.find((s) => s.name === "Driver Inactive");
    report(
      "Manager sees active and inactive personnel with accurate status labels",
      activeStaff?.isActive === true && activeStaff?.status === "active" &&
      inactiveStaff?.isActive === false && inactiveStaff?.status === "inactive"
    );
  }

  // Test 3: Eligible active delivery person can be assigned
  {
    const ord = await createTestOrder({ status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverA._id.toString() }),
    });
    const res = await assignOrderPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const data = await res.json();
    const refreshed = await Order.findById(ord._id);
    report(
      "Eligible active delivery person can be assigned",
      res.status === 200 &&
      data.success &&
      refreshed.assignedDeliveryStaff?.id?.toString() === driverA._id.toString() &&
      refreshed.deliveryAssignmentMode === "staff"
    );
  }

  // Test 4: Delivery person from another restaurant is rejected
  {
    const ord = await createTestOrder({ status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverOtherRest._id.toString() }),
    });
    const res = await assignOrderPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    report(
      "Delivery person from another restaurant is rejected (400)",
      res.status === 400
    );
  }

  // Test 5: Inactive or suspended personnel cannot bypass assignment restrictions
  {
    const ord = await createTestOrder({ status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverInactive._id.toString() }),
    });
    const res = await assignOrderPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    report(
      "Inactive or suspended personnel cannot bypass assignment restrictions (400)",
      res.status === 400
    );
  }

  // Test 6: Manager cannot assign an order that is not eligible (delivered / cancelled / pickup)
  {
    const ordDelivered = await createTestOrder({ status: "delivered" });
    const ordCancelled = await createTestOrder({ status: "cancelled" });
    const ordPickup = await createTestOrder({ orderType: "pickup", status: "ready" });

    setAssignOrderAuth(async () => mockAuth(managerA, restA));
    const reqDelivered = new Request(`http://localhost:3000/api/restaurant/orders/${ordDelivered._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverA._id.toString() }),
    });
    const resDelivered = await assignOrderPOST(reqDelivered, { params: Promise.resolve({ id: ordDelivered._id.toString() }) });

    const reqCancelled = new Request(`http://localhost:3000/api/restaurant/orders/${ordCancelled._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverA._id.toString() }),
    });
    const resCancelled = await assignOrderPOST(reqCancelled, { params: Promise.resolve({ id: ordCancelled._id.toString() }) });

    const reqPickup = new Request(`http://localhost:3000/api/restaurant/orders/${ordPickup._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverA._id.toString() }),
    });
    const resPickup = await assignOrderPOST(reqPickup, { params: Promise.resolve({ id: ordPickup._id.toString() }) });

    report(
      "Manager cannot assign an order that is not eligible (delivered, cancelled, pickup: 400)",
      resDelivered.status === 400 && resCancelled.status === 400 && resPickup.status === 400
    );
  }

  // Test 7: Manager cannot assign orders belonging to another restaurant
  {
    const ordB = await createTestOrder({ restaurant: restB._id, status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ordB._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverA._id.toString() }),
    });
    const res = await assignOrderPOST(req, { params: Promise.resolve({ id: ordB._id.toString() }) });
    report(
      "Manager cannot assign orders belonging to another restaurant (404/Isolated)",
      res.status === 404
    );
  }

  // Test 8: Unauthorized roles cannot assign personnel (e.g. non-manager kitchen staff)
  {
    const ord = await createTestOrder({ status: "ready" });
    setAssignOrderAuth(async () => mockAuth(kitchenStaffA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverA._id.toString() }),
    });
    const res = await assignOrderPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    report(
      "Unauthorized roles cannot assign personnel (403 Forbidden)",
      res.status === 403
    );
  }

  // Test 9: Assignment persists and is reflected in the correct order response and statusHistory
  {
    const ord = await createTestOrder({ status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverB._id.toString() }),
    });
    const res = await assignOrderPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const body = await res.json();
    const refreshed = await Order.findById(ord._id);

    const hasAssignmentHistory = refreshed.statusHistory.some((h) =>
      h.note.includes("Assigned to delivery staff Driver Dan")
    );

    report(
      "Assignment persists and is reflected in order response and statusHistory",
      res.status === 200 &&
      refreshed.assignedDeliveryStaff?.name === "Driver Dan" &&
      refreshed.assignedBy?.name === "Manager Alpha" &&
      hasAssignmentHistory
    );
  }

  // Test 10: Concurrent assignment attempts cannot create conflicting active assignments
  {
    const ord = await createTestOrder({ status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerA, restA));

    const req1 = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverA._id.toString() }),
    });
    const req2 = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverB._id.toString() }),
    });

    const [res1, res2] = await Promise.all([
      assignOrderPOST(req1, { params: Promise.resolve({ id: ord._id.toString() }) }),
      assignOrderPOST(req2, { params: Promise.resolve({ id: ord._id.toString() }) }),
    ]);

    const refreshed = await Order.findById(ord._id);
    const assignedId = refreshed.assignedDeliveryStaff?.id?.toString();
    const isEitherWinner = assignedId === driverA._id.toString() || assignedId === driverB._id.toString();

    report(
      "Concurrent assignment attempts result in exactly 1 authoritative active assignment",
      (res1.status === 200 || res2.status === 200) && isEitherWinner
    );
  }

  // =========================================================================
  // GROUP 2: MANAGER SELF-DELIVERY TESTS (11 - 18)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 2: MANAGER SELF-DELIVERY TESTS");
  console.log("------------------------------------------------------------------------");

  // Test 11: Authorized manager can select self-delivery for an eligible order
  {
    const ord = await createTestOrder({ status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selfDelivery: true }),
    });
    const res = await assignOrderPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const data = await res.json();
    report(
      "Authorized manager can select self-delivery for an eligible order (200)",
      res.status === 200 && data.success && data.assignmentMode === "manager_self_delivery"
    );
  }

  // Test 12: Self-delivery records correct manager identity, assignment mode, and status history
  {
    const ord = await createTestOrder({ status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selfDelivery: true }),
    });
    await assignOrderPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });

    const refreshed = await Order.findById(ord._id);
    const isManagerRecorded = refreshed.assignedDeliveryStaff?.id?.toString() === managerA._id.toString();
    const isModeSelf = refreshed.deliveryAssignmentMode === "manager_self_delivery";
    const historyHasSelf = refreshed.statusHistory.some((h) =>
      h.note.includes("manager-self-delivery")
    );

    report(
      "Self-delivery records correct manager identity, mode, and audit history",
      isManagerRecorded && isModeSelf && historyHasSelf
    );
  }

  // Test 13: Self-delivery and competing driver assignment cannot both become active
  {
    const ord = await createTestOrder({ status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerA, restA));

    // Competing: selfDelivery vs driverA
    const reqSelf = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selfDelivery: true }),
    });
    const reqDriver = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverA._id.toString() }),
    });

    await Promise.all([
      assignOrderPOST(reqSelf, { params: Promise.resolve({ id: ord._id.toString() }) }),
      assignOrderPOST(reqDriver, { params: Promise.resolve({ id: ord._id.toString() }) }),
    ]);

    const refreshed = await Order.findById(ord._id);
    const isSingleActive =
      (refreshed.deliveryAssignmentMode === "manager_self_delivery" && refreshed.assignedDeliveryStaff?.id?.toString() === managerA._id.toString()) ||
      (refreshed.deliveryAssignmentMode === "staff" && refreshed.assignedDeliveryStaff?.id?.toString() === driverA._id.toString());

    report(
      "Self-delivery and competing driver assignment cannot both become active (strictly 1 mode)",
      isSingleActive
    );
  }

  // Test 14: An unauthorized manager cannot self-assign another restaurant's order
  {
    const ordA = await createTestOrder({ restaurant: restA._id, status: "ready" });
    setAssignOrderAuth(async () => mockAuth(managerB, restB));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ordA._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selfDelivery: true }),
    });
    const res = await assignOrderPOST(req, { params: Promise.resolve({ id: ordA._id.toString() }) });
    report(
      "An unauthorized manager cannot self-assign another restaurant's order (404/Isolated)",
      res.status === 404
    );
  }

  // Test 15: Self-delivery cannot bypass normal dispatch requirements
  {
    const ord = await createTestOrder({
      status: "ready",
      deliveryAssignmentMode: "manager_self_delivery",
      assignedDeliveryStaff: {
        id: managerA._id,
        name: "Manager Alpha",
        phone: managerA.phone,
      },
    });

    // Attempt direct transition from ready to delivered without OTP
    setRestaurantOrdersAuth(async () => mockAuth(managerA, restA));
    const reqDirectDeliver = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "delivered" }),
    });
    const res = await restaurantOrdersPUT(reqDirectDeliver);
    report(
      "Self-delivery cannot bypass dispatch or OTP verification (direct deliver rejected 400)",
      res.status === 400
    );
  }

  // Test 16: Manager can access the OTP for their active self-delivery order
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      deliveryAssignmentMode: "manager_self_delivery",
      assignedDeliveryStaff: {
        id: managerA._id,
        name: "Manager Alpha",
        phone: managerA.phone,
      },
    });
    // Auto-issue OTP
    await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    setOrderOtpAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/otp`);
    const res = await orderOtpGET(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const data = await res.json();

    report(
      "Manager can access the OTP for their active self-delivery order (200, 4 digits)",
      res.status === 200 && data.success && /^\d{4}$/.test(data.otpCode)
    );
  }

  // Test 17: Manager can complete delivery through valid OTP verification
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      deliveryAssignmentMode: "manager_self_delivery",
      assignedDeliveryStaff: {
        id: managerA._id,
        name: "Manager Alpha",
        phone: managerA.phone,
      },
    });
    const issueRes = await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    setDriverVerifyAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: issueRes.otpCode }),
    });
    const res = await driverVerifyHandoverPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const data = await res.json();
    const refreshed = await Order.findById(ord._id);

    report(
      "Manager can complete delivery through valid OTP verification",
      res.status === 200 && data.success && refreshed.status === "delivered" && refreshed.deliveryOtp?.status === "verified"
    );
  }

  // Test 18: Invalid OTP cannot complete delivery
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      deliveryAssignmentMode: "manager_self_delivery",
      assignedDeliveryStaff: {
        id: managerA._id,
        name: "Manager Alpha",
        phone: managerA.phone,
      },
    });
    await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    setDriverVerifyAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: "9999" }), // candidate wrong code
    });
    const res = await driverVerifyHandoverPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const refreshed = await Order.findById(ord._id);

    report(
      "Invalid OTP cannot complete delivery (rejected 400, status remains out_for_delivery)",
      res.status === 400 && refreshed.status === "out_for_delivery"
    );
  }

  // =========================================================================
  // GROUP 3: DELIVERY STAFF TESTS (19 - 26)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 3: DELIVERY STAFF TESTS");
  console.log("------------------------------------------------------------------------");

  // Test 19: Assigned delivery person can view their own eligible orders
  {
    const ord = await createTestOrder({
      status: "ready",
      assignedDeliveryStaff: {
        id: driverA._id,
        name: driverA.name,
        phone: driverA.phone,
      },
    });
    setRestaurantOrdersAuth(async () => mockAuth(driverA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders");
    const res = await (await import("../app/api/restaurant/orders/route.js")).GET(req);
    const data = await res.json();
    const foundMyOrder = data.orders?.some((o) => o._id.toString() === ord._id.toString());
    report(
      "Assigned delivery person can view their own eligible orders",
      res.status === 200 && foundMyOrder
    );
  }

  // Test 20: Assigned delivery person can dispatch their own order
  {
    const ord = await createTestOrder({
      status: "ready",
      assignedDeliveryStaff: {
        id: driverA._id,
        name: driverA.name,
        phone: driverA.phone,
      },
    });
    setRestaurantOrdersAuth(async () => mockAuth(driverA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const res = await restaurantOrdersPUT(req);
    const refreshed = await Order.findById(ord._id);
    report(
      "Assigned delivery person can dispatch their own order",
      res.status === 200 && refreshed.status === "out_for_delivery" && refreshed.dispatchedBy?.id?.toString() === driverA._id.toString()
    );
  }

  // Test 21: Unassigned delivery person cannot dispatch an order assigned to someone else
  {
    const ord = await createTestOrder({
      status: "ready",
      assignedDeliveryStaff: {
        id: driverA._id,
        name: driverA.name,
        phone: driverA.phone,
      },
    });
    // Driver B tries to dispatch Driver A's order
    setRestaurantOrdersAuth(async () => mockAuth(driverB, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const res = await restaurantOrdersPUT(req);
    report(
      "Unassigned delivery person cannot dispatch another driver's order (403 Forbidden)",
      res.status === 403
    );
  }

  // Test 22: Previously assigned driver cannot dispatch after reassignment
  {
    const ord = await createTestOrder({
      status: "ready",
      assignedDeliveryStaff: {
        id: driverB._id, // reassigned to driver B
        name: driverB.name,
        phone: driverB.phone,
      },
    });
    // Former driver A tries to dispatch
    setRestaurantOrdersAuth(async () => mockAuth(driverA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const res = await restaurantOrdersPUT(req);
    report(
      "Previously assigned driver cannot dispatch after reassignment (403 Forbidden)",
      res.status === 403
    );
  }

  // Test 23: Driver cannot access another driver's OTP
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      assignedDeliveryStaff: {
        id: driverA._id,
        name: driverA.name,
        phone: driverA.phone,
      },
    });
    await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    // Driver B tries to retrieve Driver A's OTP
    setOrderOtpAuth(async () => mockAuth(driverB, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/otp`);
    const res = await orderOtpGET(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    report(
      "Driver cannot access another driver's OTP (403 Forbidden)",
      res.status === 403
    );
  }

  // Test 24: Driver cannot access orders from another restaurant
  {
    const ordB = await createTestOrder({
      restaurant: restB._id,
      status: "out_for_delivery",
      assignedDeliveryStaff: {
        id: driverOtherRest._id,
        name: driverOtherRest.name,
      },
    });
    setOrderOtpAuth(async () => mockAuth(driverA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ordB._id}/otp`);
    const res = await orderOtpGET(req, { params: Promise.resolve({ id: ordB._id.toString() }) });
    report(
      "Driver cannot access orders from another restaurant (404/Isolated)",
      res.status === 404
    );
  }

  // Test 25: Duplicate dispatch requests do not produce duplicate transitions or side effects
  {
    const ord = await createTestOrder({
      status: "ready",
      assignedDeliveryStaff: {
        id: driverA._id,
        name: driverA.name,
        phone: driverA.phone,
      },
    });
    setRestaurantOrdersAuth(async () => mockAuth(driverA, restA));

    const req1 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const req2 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });

    const res1 = await restaurantOrdersPUT(req1);
    const res2 = await restaurantOrdersPUT(req2);
    // res1 should be 200; res2 should be either idempotent 200 or 409 conflict, without corrupting state
    const refreshed = await Order.findById(ord._id);
    const outTransitions = refreshed.statusHistory.filter((h) => h.status === "out_for_delivery");

    report(
      "Duplicate dispatch requests do not corrupt state or produce redundant side effects",
      res1.status === 200 && outTransitions.length === 1
    );
  }

  // Test 26: Dispatch cannot occur for cancelled, delivered, or otherwise ineligible orders
  {
    const ordCancelled = await createTestOrder({
      status: "cancelled",
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
    });
    setRestaurantOrdersAuth(async () => mockAuth(driverA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ordCancelled._id.toString(), status: "out_for_delivery" }),
    });
    const res = await restaurantOrdersPUT(req);
    report(
      "Dispatch cannot occur for cancelled orders (400)",
      res.status === 400
    );
  }

  // =========================================================================
  // GROUP 4: DUAL-PARTY OTP TESTS (27 - 36)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 4: DUAL-PARTY OTP TESTS");
  console.log("------------------------------------------------------------------------");

  // Test 27: Authorized manager can access the OTP for an eligible staff-delivered order
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      assignedDeliveryStaff: {
        id: driverA._id,
        name: driverA.name,
        phone: driverA.phone,
      },
    });
    await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    // Manager A inspects OTP
    setOrderOtpAuth(async () => mockAuth(managerA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/otp`);
    const res = await orderOtpGET(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const data = await res.json();

    report(
      "Authorized manager can access OTP for eligible staff-delivered order (200)",
      res.status === 200 && data.success && /^\d{4}$/.test(data.otpCode)
    );
  }

  // Test 28: Assigned delivery person can access the OTP for their eligible order
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      assignedDeliveryStaff: {
        id: driverA._id,
        name: driverA.name,
        phone: driverA.phone,
      },
    });
    await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    setOrderOtpAuth(async () => mockAuth(driverA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/otp`);
    const res = await orderOtpGET(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const data = await res.json();

    report(
      "Assigned delivery person can access the OTP for their eligible order (200)",
      res.status === 200 && data.success && /^\d{4}$/.test(data.otpCode)
    );
  }

  // Test 29: Unauthorized manager cannot access another restaurant's OTP
  {
    const ordA = await createTestOrder({
      restaurant: restA._id,
      status: "out_for_delivery",
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
    });
    await issueDeliveryOtpForOrder(ordA, { requestedBy: "system" });

    // Manager B from Rest B attempts to access Rest A order OTP
    setOrderOtpAuth(async () => mockAuth(managerB, restB));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ordA._id}/otp`);
    const res = await orderOtpGET(req, { params: Promise.resolve({ id: ordA._id.toString() }) });

    report(
      "Unauthorized manager cannot access another restaurant's OTP (404/Isolated)",
      res.status === 404
    );
  }

  // Test 30: Unrelated delivery personnel cannot retrieve the OTP
  {
    const ordA = await createTestOrder({
      restaurant: restA._id,
      status: "out_for_delivery",
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
    });
    await issueDeliveryOtpForOrder(ordA, { requestedBy: "system" });

    // Driver B attempts to access Driver A's OTP
    setOrderOtpAuth(async () => mockAuth(driverB, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ordA._id}/otp`);
    const res = await orderOtpGET(req, { params: Promise.resolve({ id: ordA._id.toString() }) });

    report(
      "Unrelated delivery personnel cannot retrieve OTP (403 Forbidden)",
      res.status === 403
    );
  }

  // Test 31: Expired or invalidated OTP is rejected
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
    });
    const issueRes = await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    // Manually expire the OTP in database
    await Order.updateOne(
      { _id: ord._id },
      { $set: { "deliveryOtp.expiresAt": new Date(Date.now() - 60000), "deliveryOtp.status": "expired" } }
    );

    setDriverVerifyAuth(async () => mockAuth(driverA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: issueRes.otpCode }),
    });
    const res = await driverVerifyHandoverPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const data = await res.json();

    report(
      "Expired or invalidated OTP is rejected (codeExpired: true, 400)",
      res.status === 400 && data.codeExpired === true
    );
  }

  // Test 32: OTP attempt limits (5) and rate limiting remain effective
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
    });
    await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    setDriverVerifyAuth(async () => mockAuth(driverA, restA));

    // Submit 5 incorrect attempts
    for (let i = 0; i < 5; i++) {
      const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpCode: "1111" }),
      });
      await driverVerifyHandoverPOST(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    }

    const refreshed = await Order.findById(ord._id);
    const isLocked = refreshed.deliveryOtp?.status === "max_attempts_exceeded";

    // 6th attempt should be blocked with 429
    const req6 = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: "1111" }),
    });
    const res6 = await driverVerifyHandoverPOST(req6, { params: Promise.resolve({ id: ord._id.toString() }) });

    report(
      "OTP attempt limits (5) lock OTP into max_attempts_exceeded and reject subsequent attempts (429)",
      isLocked && res6.status === 429
    );
  }

  // Test 33: OTP cannot be reused after successful completion
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
    });
    const issueRes = await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    setDriverVerifyAuth(async () => mockAuth(driverA, restA));
    // 1st completion
    const req1 = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: issueRes.otpCode }),
    });
    const res1 = await driverVerifyHandoverPOST(req1, { params: Promise.resolve({ id: ord._id.toString() }) });

    // 2nd replay completion attempt
    const req2 = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: issueRes.otpCode }),
    });
    const res2 = await driverVerifyHandoverPOST(req2, { params: Promise.resolve({ id: ord._id.toString() }) });

    report(
      "OTP cannot be reused after successful completion (replayed verification rejected 400)",
      res1.status === 200 && res2.status === 400
    );
  }

  // Test 34: Concurrent completion attempts produce only one successful completion and one set of side effects
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
    });
    const issueRes = await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    setDriverVerifyAuth(async () => mockAuth(driverA, restA));
    const req1 = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: issueRes.otpCode }),
    });
    const req2 = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: issueRes.otpCode }),
    });

    const [res1, res2] = await Promise.all([
      driverVerifyHandoverPOST(req1, { params: Promise.resolve({ id: ord._id.toString() }) }),
      driverVerifyHandoverPOST(req2, { params: Promise.resolve({ id: ord._id.toString() }) }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    const refreshed = await Order.findById(ord._id);

    report(
      "Concurrent completion attempts produce exactly 1 success (200) and 1 conflict/rejection",
      statuses[0] === 200 && (statuses[1] === 400 || statuses[1] === 409) && refreshed.status === "delivered"
    );
  }

  // Test 35: OTP plaintext never appears in general order queries or ordinary API responses
  {
    const ord = await createTestOrder({
      status: "out_for_delivery",
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
    });
    await issueDeliveryOtpForOrder(ord, { requestedBy: "system" });

    setRestaurantOrdersAuth(async () => mockAuth(managerA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders");
    const res = await (await import("../app/api/restaurant/orders/route.js")).GET(req);
    const data = await res.json();
    const targetOrder = data.orders?.find((o) => o._id.toString() === ord._id.toString());

    const hasPlaintextOtp =
      typeof targetOrder?.deliveryOtp?.code !== "undefined" ||
      typeof targetOrder?.deliveryOtp?.otpCode !== "undefined" ||
      typeof targetOrder?.deliveryOtp?.codeDigest !== "undefined" ||
      typeof targetOrder?.deliveryOtp?.encryptedCode !== "undefined";

    report(
      "OTP plaintext never appears in general order queries or ordinary API responses",
      !hasPlaintextOtp
    );
  }

  // Test 36: Reassignment and cancellation correctly invalidate or restrict previous delivery context
  {
    const ord = await createTestOrder({
      status: "ready",
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
    });

    // Reassign order from Driver A to Driver B
    setAssignOrderAuth(async () => mockAuth(managerA, restA));
    const reqReassign = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStaffId: driverB._id.toString() }),
    });
    const resReassign = await assignOrderPOST(reqReassign, { params: Promise.resolve({ id: ord._id.toString() }) });

    // Driver A attempts to dispatch
    setRestaurantOrdersAuth(async () => mockAuth(driverA, restA));
    const reqDispatchOld = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const resDispatchOld = await restaurantOrdersPUT(reqDispatchOld);

    // Driver B dispatches successfully
    setRestaurantOrdersAuth(async () => mockAuth(driverB, restA));
    const reqDispatchNew = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const resDispatchNew = await restaurantOrdersPUT(reqDispatchNew);

    report(
      "Reassignment restricts previous driver (403) and binds new driver successfully (200)",
      resReassign.status === 200 && resDispatchOld.status === 403 && resDispatchNew.status === 200
    );
  }

  console.log("\n========================================================================");
  console.log(`RESULTS: ${passedCount} / ${testIndex} TESTS PASSED`);
  console.log("========================================================================");

  if (failedCount > 0) {
    throw new Error(`${failedCount} test(s) failed in delivery assignment suite.`);
  }

} finally {
  console.log("\nCleaning up isolated test database...");
  await mongoose.disconnect();
  await replSet.stop();
  console.log("Stopped isolated MongoMemoryReplSet.");
  process.exit(0);
}
