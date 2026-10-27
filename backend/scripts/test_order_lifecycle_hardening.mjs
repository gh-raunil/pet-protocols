import { register } from "node:module";
import { pathToFileURL } from "node:url";
register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);

import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import assert from "node:assert/strict";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("========================================================================");
console.log("PET PROTOCOLS — ORDER LIFECYCLE SECURITY HARDENING REGRESSION TEST SUITE");
console.log("REC-06: STRICTLY ISOLATED IN-MEMORY DATABASE TEST HARNESS");
console.log("========================================================================\n");

// REC-06: Start isolated MongoMemoryReplSet (zero access to live database)
console.log("Starting isolated MongoMemoryReplSet for order lifecycle hardening...");
const { MongoMemoryReplSet } = await import("mongodb-memory-server");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const localUri = replSet.getUri("test_order_lifecycle_isolated");

// Security Invariant: Ensure connection is strictly loopback (zero access to live database)
assert.ok(
  localUri.includes("127.0.0.1") || localUri.includes("localhost"),
  "Security Invariant: Must use isolated loopback MongoDB URI"
);

process.env.MONGODB_URI = localUri;
process.env.TEST_MONGODB_URI = localUri;
process.env.DELIVERY_OTP_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

await mongoose.connect(localUri);
console.log(`Connected to isolated test database: ${localUri}\n`);

// Import models
const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;
const Waste = (await import("../models/Waste.js")).default;
const Ingredient = (await import("../models/Ingredient.js")).default;

// Import route handlers and test hooks
const {
  GET: restaurantOrdersGET,
  PUT: restaurantOrdersPUT,
  _setTestRequireRestaurantAdmin: setRestaurantOrdersAuth,
} = await import("../app/api/restaurant/orders/route.js");

const {
  PUT: staffLocationPUT,
  _setTestRequireRestaurantAdmin: setLocationAuth,
} = await import("../app/api/restaurant/orders/[id]/location/route.js");

const {
  PATCH: customerLocationPATCH,
  _setTestGetServerSession: setCustLocationSession,
} = await import("../app/api/orders/[id]/customer-location/route.js");

const {
  POST: customerOrdersPOST,
  _setTestGetServerSession: setOrdersSession,
} = await import("../app/api/orders/route.js");

const {
  GET: cronMaintenanceGET,
  POST: cronMaintenancePOST,
  _setTestCronSecret,
  _resetMaintenanceLock,
} = await import("../app/api/cron/order-maintenance/route.js");

const {
  processStalePickupOrders,
  logWasteForOrder,
  recoverCancelledOrderSideEffects,
} = await import("../lib/orderMaintenanceService.js");
const { _setTestRazorpayClient } = await import("../lib/refundService.js");

const {
  _setTestHttpTransport,
  _resetTestHttpTransport,
} = await import("../lib/razorpayHttpClient.js");
const { decryptOtpCode } = await import("../lib/deliveryOtpService.js");

// Cleanup previous test fixtures
const cleanupFilter = {
  $or: [
    { email: { $regex: /@hardened-test\.com$/ } },
    { slug: { $regex: /^hardened-test-/ } },
    { orderId: { $regex: /^TEST-HL-/ } },
  ],
};

await Order.deleteMany({ orderId: { $regex: /^TEST-HL-/ } });
await Waste.deleteMany({ notes: { $regex: /TEST-HL-/ } });
await User.deleteMany({ email: { $regex: /@hardened-test\.com$/ } });
await Restaurant.deleteMany({ slug: { $regex: /^hardened-test-/ } });
await Ingredient.deleteMany({ name: { $regex: /^Test Hardened / } });

// --- Setup Test Fixtures ---
const restA = await Restaurant.create({
  name: "Hardened Test Kitchen A",
  slug: "hardened-test-kitchen-a",
  phone: "9876500001",
  address: { street: "100 Security Blvd", city: "Bangalore", state: "KA", pincode: "560001", latitude: 12.9716, longitude: 77.5946 },
  enabledFeatures: ["delivery", "pickup"],
  orderingSettings: {
    autoDismissUncollectedOrders: true,
    uncollectedTimeoutMinutes: 60,
  },
});

const restB = await Restaurant.create({
  name: "Hardened Test Kitchen B",
  slug: "hardened-test-kitchen-b",
  phone: "9876500002",
  address: { street: "200 Security Blvd", city: "Bangalore", state: "KA", pincode: "560002", latitude: 12.9800, longitude: 77.6000 },
  enabledFeatures: ["delivery", "pickup"],
});

const testIngredient = await Ingredient.create({
  name: "Test Hardened Chicken",
  restaurant: restA._id,
  currentStock: 100,
  unit: "kg",
  reorderLevel: 10,
  costPerUnit: 150,
});

const testIngredient2 = await Ingredient.create({
  name: "Test Hardened Rice",
  restaurant: restA._id,
  currentStock: 50,
  unit: "kg",
  reorderLevel: 5,
  costPerUnit: 50,
});

const customerUser = await User.create({
  name: "Hardened Customer",
  email: "cust@hardened-test.com",
  role: "customer",
  phone: "9100000001",
});

const managerUserA = await User.create({
  name: "Manager Branch A",
  email: "manager_a@hardened-test.com",
  role: "restaurant_admin",
  restaurant: restA._id,
  phone: "9100000002",
});

const managerUserB = await User.create({
  name: "Manager Branch B",
  email: "manager_b@hardened-test.com",
  role: "restaurant_admin",
  restaurant: restB._id,
  phone: "9100000003",
});

const cashierUser = await User.create({
  name: "Counter Cashier",
  email: "cashier@hardened-test.com",
  role: "staff",
  restaurant: restA._id,
  staffRoles: ["Cashier"],
  permissions: ["orders_view", "orders_update"],
  phone: "9100000004",
  status: "active",
});

const kitchenUser = await User.create({
  name: "Kitchen Chef",
  email: "kitchen@hardened-test.com",
  role: "staff",
  restaurant: restA._id,
  staffRoles: ["Kitchen"],
  permissions: ["orders_view", "orders_update"],
  phone: "9100000005",
  status: "active",
});

const deliveryUserA = await User.create({
  name: "Delivery Driver A",
  email: "driver_a@hardened-test.com",
  role: "staff",
  restaurant: restA._id,
  staffRoles: ["Delivery"],
  permissions: ["orders_view", "orders_update"],
  phone: "9100000006",
  status: "active",
});

const deliveryUserB = await User.create({
  name: "Delivery Driver B",
  email: "driver_b@hardened-test.com",
  role: "staff",
  restaurant: restB._id,
  staffRoles: ["Delivery"],
  permissions: ["orders_view", "orders_update"],
  phone: "9100000007",
  status: "active",
});

const inactiveDriverA = await User.create({
  name: "Inactive Driver A",
  email: "inactive_driver@hardened-test.com",
  role: "staff",
  restaurant: restA._id,
  staffRoles: ["Delivery"],
  permissions: ["orders_view", "orders_update"],
  phone: "9100000008",
  status: "inactive",
});

const multiRoleUser = await User.create({
  name: "Multi-Role Staff (Cashier+Delivery)",
  email: "multirole@hardened-test.com",
  role: "staff",
  restaurant: restA._id,
  staffRoles: ["Cashier", "Delivery"],
  permissions: ["orders_view", "orders_update"],
  phone: "9100000009",
  status: "active",
});

const unknownRoleStaff = await User.create({
  name: "Unknown Role Staff",
  email: "unknown@hardened-test.com",
  role: "staff",
  restaurant: restA._id,
  staffRoles: ["Janitor"],
  permissions: ["orders_view", "orders_update"],
  phone: "9100000010",
  status: "active",
});

let superadminUser = await User.findOne({ email: "superadmin.petprotocols@gmail.com" });
if (!superadminUser) {
  superadminUser = await User.create({
    name: "Super Admin",
    email: "superadmin.petprotocols@gmail.com",
    role: "superadmin",
    phone: "9100000011",
  });
}

// Helper to create test orders
async function createTestOrder(overrides = {}) {
  const count = (await Order.countDocuments({ orderId: { $regex: /^TEST-HL-/ } })) + 1;
  const isPickup = overrides.orderType === "pickup" || overrides.address === null;
  const defaults = {
    orderId: `TEST-HL-${String(count).padStart(4, "0")}`,
    user: customerUser._id,
    restaurant: restA._id,
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        name: "Test Hardened Meal",
        price: 250,
        quantity: 2,
        total: 500,
      },
    ],
    totalAmount: 500,
    status: "pending",
    notes: isPickup ? "[pickup] Customer counter pickup" : "Doorstep delivery",
    paymentMethod: isPickup ? "cash_on_pickup" : "cod",
    paymentStatus: "pending",
    orderType: isPickup ? "pickup" : "delivery",
    address: isPickup
      ? { addressType: "pickup" }
      : {
          fullName: "Hardened Customer",
          phone: "9100000001",
          street: "123 Test Rd",
          city: "Bangalore",
          latitude: 12.9750,
          longitude: 77.5950,
        },
    statusHistory: [
      {
        status: "pending",
        changedAt: new Date(),
        changedBy: { role: "customer", name: "Customer" },
        note: "Initial order",
      },
    ],
    deductedIngredients: [
      {
        ingredient: testIngredient._id,
        ingredientName: testIngredient.name,
        quantity: 0.5,
        unit: "kg",
      },
    ],
    stockDeducted: true,
  };
  return await Order.create({ ...defaults, ...overrides });
}

// Auth mock helper for restaurant orders PUT/GET
function mockRestaurantAuth(user, restaurant) {
  const isAdmin = user.role === "restaurant_admin" || user.role === "superadmin";
  const isStaff = user.role === "staff";
  return {
    user,
    restaurant,
    restaurantId: restaurant._id.toString(),
    isAdmin,
    isStaff,
    staffRoles: user.staffRoles || [user.role],
    permissions: user.permissions || [],
  };
}

let passedCount = 0;
let totalCount = 0;

function reportTest(num, title, passed, detail = "") {
  totalCount++;
  if (passed) {
    passedCount++;
    console.log(`  ✓ Test ${num}: ${title}`);
    if (detail) console.log(`      ${detail}`);
  } else {
    console.error(`  ✗ Test ${num} FAILED: ${title}`);
    if (detail) console.error(`      ${detail}`);
    throw new Error(`Test ${num} failed: ${title}`);
  }
}

try {
  // ========================================================================
  // GROUP 1: ROLE AUTHORIZATION MATRIX & DEFAULT-DENY (Tests 1 - 9)
  // ========================================================================
  console.log("------------------------------------------------------------------------");
  console.log("GROUP 1: ROLE AUTHORIZATION MATRIX & DEFAULT-DENY");
  console.log("------------------------------------------------------------------------");

  // Test 1: Cashier can confirm counter pickup order (pending -> confirmed)
  {
    const ord = await createTestOrder({ orderType: "pickup", address: null, status: "pending" });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(cashierUser, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "confirmed" }),
    });
    const res = await restaurantOrdersPUT(req);
    const body = await res.json();
    reportTest(1, "Cashier can confirm counter pickup order (pending -> confirmed)", res.status === 200 && body.order?.status === "confirmed");
  }

  // Test 2: Cashier can mark counter pickup order ready (confirmed -> ready)
  {
    const ord = await createTestOrder({ orderType: "pickup", address: null, status: "confirmed" });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(cashierUser, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "ready" }),
    });
    const res = await restaurantOrdersPUT(req);
    const body = await res.json();
    reportTest(2, "Cashier can mark counter pickup order ready (confirmed -> ready)", res.status === 200 && body.order?.status === "ready");
  }

  // Test 3: Cashier can complete counter pickup order (ready -> delivered)
  {
    const ord = await createTestOrder({ orderType: "pickup", address: null, status: "ready" });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(cashierUser, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "delivered" }),
    });
    const res = await restaurantOrdersPUT(req);
    const body = await res.json();
    reportTest(3, "Cashier can complete counter pickup order (ready -> delivered)", res.status === 200 && body.order?.status === "delivered");
  }

  // Test 4: Cashier CANNOT dispatch a delivery order (ready -> out_for_delivery rejected with 403)
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "ready" });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(cashierUser, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const res = await restaurantOrdersPUT(req);
    const body = await res.json();
    reportTest(4, "Cashier CANNOT dispatch a delivery order (rejected with 403)", res.status === 403 && body.success === false);
  }

  // Test 5: Cashier CANNOT cancel a delivery order (rejected with 403)
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "confirmed" });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(cashierUser, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "cancelled", cancellationReason: "Cashier cancel test" }),
    });
    const res = await restaurantOrdersPUT(req);
    const body = await res.json();
    reportTest(5, "Cashier CANNOT cancel a delivery order (rejected with 403)", res.status === 403 && body.success === false);
  }

  // Test 6: Delivery staff CANNOT accept/prepare orders (rejected with 403)
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "confirmed" });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(deliveryUserA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "preparing" }),
    });
    const res = await restaurantOrdersPUT(req);
    const body = await res.json();
    reportTest(6, "Delivery staff CANNOT accept/prepare orders (rejected with 403)", res.status === 403 && body.success === false);
  }

  // Test 7: Delivery staff CAN dispatch and deliver delivery orders (Requires Handover OTP)
  {
    const ord = await createTestOrder({
      orderType: "delivery",
      status: "ready",
      assignedDeliveryStaff: {
        id: deliveryUserA._id,
        name: deliveryUserA.name,
        phone: deliveryUserA.phone || "",
      },
    });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(deliveryUserA, restA));
    const reqDispatch = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const resDispatch = await restaurantOrdersPUT(reqDispatch);
    const bodyDispatch = await resDispatch.json();

    // Rejection check: delivery without OTP must be rejected with 400
    const reqDeliverNoOtp = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "delivered" }),
    });
    const resDeliverNoOtp = await restaurantOrdersPUT(reqDeliverNoOtp);

    // Retrieve active OTP from the order
    const refreshedOrder = await Order.findById(ord._id).select("+deliveryOtp.encryptedCode");
    const activeOtpCode = decryptOtpCode(refreshedOrder.deliveryOtp?.encryptedCode, {
      orderId: ord._id,
      issuanceId: refreshedOrder.deliveryOtp?.issuanceId,
    });

    const reqDeliver = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: ord._id.toString(),
        status: "delivered",
        deliveryOtpCode: activeOtpCode,
      }),
    });
    const resDeliver = await restaurantOrdersPUT(reqDeliver);
    const bodyDeliver = await resDeliver.json();

    reportTest(
      7,
      "Delivery staff CAN dispatch and deliver delivery orders with OTP (unverified rejected)",
      resDispatch.status === 200 &&
      bodyDispatch.order?.status === "out_for_delivery" &&
      resDeliverNoOtp.status === 400 &&
      resDeliver.status === 200 &&
      bodyDeliver.order?.status === "delivered",
      `resDispatch=${resDispatch.status}, bodyDispatch=${JSON.stringify(bodyDispatch)}, resDeliverNoOtp=${resDeliverNoOtp.status}, resDeliver=${resDeliver.status}, bodyDeliver=${JSON.stringify(bodyDeliver)}, activeOtpCode=${activeOtpCode}`
    );
  }

  // Test 8: Kitchen staff CAN progress kitchen workflow (confirmed -> preparing -> ready) but CANNOT mark delivered
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "confirmed" });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(kitchenUser, restA));
    const reqPrep = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "preparing" }),
    });
    const resPrep = await restaurantOrdersPUT(reqPrep);

    const reqReady = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "ready" }),
    });
    const resReady = await restaurantOrdersPUT(reqReady);

    const reqDelivered = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "delivered" }),
    });
    const resDelivered = await restaurantOrdersPUT(reqDelivered);

    reportTest(
      8,
      "Kitchen staff CAN progress kitchen workflow but CANNOT mark delivered (403)",
      resPrep.status === 200 && resReady.status === 200 && resDelivered.status === 403
    );
  }

  // Test 9: Multi-role staff (Cashier+Delivery) receives union of permissions; unknown role is default-denied
  {
    const ordPickup = await createTestOrder({ orderType: "pickup", address: null, status: "ready" });
    const ordDelivery = await createTestOrder({
      orderType: "delivery",
      status: "ready",
      assignedDeliveryStaff: {
        id: multiRoleUser._id,
        name: multiRoleUser.name,
        phone: multiRoleUser.phone || "",
      },
    });

    // Multi-role cashier+delivery can complete pickup
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(multiRoleUser, restA));
    const req1 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ordPickup._id.toString(), status: "delivered" }),
    });
    const res1 = await restaurantOrdersPUT(req1);

    // Multi-role cashier+delivery can dispatch delivery
    const req2 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ordDelivery._id.toString(), status: "out_for_delivery" }),
    });
    const res2 = await restaurantOrdersPUT(req2);

    // Unknown role staff is default-denied
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(unknownRoleStaff, restA));
    const req3 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ordDelivery._id.toString(), status: "delivered" }),
    });
    const res3 = await restaurantOrdersPUT(req3);

    reportTest(
      9,
      "Multi-role staff receives union of capabilities; unknown role is default-denied (403)",
      res1.status === 200 && res2.status === 200 && res3.status === 403
    );
  }

  // ========================================================================
  // GROUP 2: CROSS-RESTAURANT & MANAGER AUTHORITY (Tests 10 - 12)
  // ========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 2: CROSS-RESTAURANT & MANAGER AUTHORITY");
  console.log("------------------------------------------------------------------------");

  // Test 10: Restaurant Manager has authority across all order workflows within their own branch
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "confirmed", restaurant: restA._id });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(managerUserA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "ready" }),
    });
    const res = await restaurantOrdersPUT(req);
    const body = await res.json();
    reportTest(10, "Restaurant Manager has full authority within their own branch", res.status === 200 && body.order?.status === "ready");
  }

  // Test 11: Manager from Branch B CANNOT access or update orders belonging to Branch A
  {
    const ordA = await createTestOrder({ orderType: "delivery", status: "confirmed", restaurant: restA._id });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(managerUserB, restB));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ordA._id.toString(), status: "cancelled", cancellationReason: "Cross-branch attack" }),
    });
    const res = await restaurantOrdersPUT(req);
    reportTest(11, "Manager from Branch B CANNOT modify orders from Branch A (404/Isolated)", res.status === 404);
  }

  // Test 12: Superadmin can access and manage orders across branches
  {
    const ordB = await createTestOrder({ orderType: "delivery", status: "confirmed", restaurant: restB._id });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(superadminUser, restB));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ordB._id.toString(), status: "ready" }),
    });
    const res = await restaurantOrdersPUT(req);
    const body = await res.json();
    reportTest(12, "Superadmin can manage orders across branches", res.status === 200 && body.order?.status === "ready");
  }

  // ========================================================================
  // GROUP 3: DRIVER ASSIGNMENT & VALIDATION (Tests 13 - 17)
  // ========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 3: DRIVER ASSIGNMENT & VALIDATION");
  console.log("------------------------------------------------------------------------");

  // Test 13: Rule B Guard: Manager cannot dispatch unassigned delivery order (400 required assignment)
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "ready", restaurant: restA._id });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(managerUserA, restA));
    const reqUnassigned = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const resUnassigned = await restaurantOrdersPUT(reqUnassigned);

    // Now assign driver and verify dispatch succeeds
    ord.assignedDeliveryStaff = {
      id: deliveryUserA._id,
      name: deliveryUserA.name,
      phone: deliveryUserA.phone || "",
      email: deliveryUserA.email || "",
      assignedAt: new Date(),
    };
    await ord.save();

    const reqAssigned = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "out_for_delivery" }),
    });
    const resAssigned = await restaurantOrdersPUT(reqAssigned);
    const bodyAssigned = await resAssigned.json();

    reportTest(
      13,
      "Manager dispatch requires valid assignment (unassigned 400; assigned 200)",
      resUnassigned.status === 400 && resAssigned.status === 200 && bodyAssigned.order?.status === "out_for_delivery"
    );
  }

  // Test 14: Unassigned delivery driver claims order upon sending first valid GPS location ping
  {
    const ord = await createTestOrder({
      orderType: "delivery",
      status: "out_for_delivery",
      restaurant: restA._id,
      assignedDeliveryStaff: null,
      deliveryTracking: { isLive: true, startedAt: new Date() },
    });
    setLocationAuth(async () => mockRestaurantAuth(deliveryUserA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9720,
        longitude: 77.5950,
        accuracy: 10,
        speed: 25,
        heading: 90,
        recordedAt: new Date().toISOString(),
      }),
    });
    const res = await staffLocationPUT(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    const body = await res.json();
    const refreshed = await Order.findById(ord._id);
    const claimedByDriver = refreshed.assignedDeliveryStaff?.id?.toString() === deliveryUserA._id.toString();
    reportTest(
      14,
      "Unassigned delivery driver claims order upon sending first GPS ping",
      res.status === 200 && claimedByDriver,
      `Assigned driver id: ${refreshed.assignedDeliveryStaff?.id}`
    );
  }

  // Test 15: Non-delivery staff (e.g. Kitchen) CANNOT claim delivery order via GPS ping (rejected with 403)
  {
    const ord = await createTestOrder({
      orderType: "delivery",
      status: "out_for_delivery",
      restaurant: restA._id,
      assignedDeliveryStaff: null,
      deliveryTracking: { isLive: true, startedAt: new Date() },
    });
    setLocationAuth(async () => mockRestaurantAuth(kitchenUser, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9720,
        longitude: 77.5950,
        accuracy: 10,
        recordedAt: new Date().toISOString(),
      }),
    });
    const res = await staffLocationPUT(req, { params: Promise.resolve({ id: ord._id.toString() }) });
    reportTest(15, "Non-delivery staff CANNOT claim delivery order via GPS ping (403)", res.status === 403);
  }

  // Test 16: Explicit driver assignment rejects cross-restaurant driver (driver from Branch B to Branch A order)
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "ready", restaurant: restA._id });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(managerUserA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: ord._id.toString(),
        status: "out_for_delivery",
        assignedDeliveryStaff: { id: deliveryUserB._id.toString() },
      }),
    });
    const res = await restaurantOrdersPUT(req);
    reportTest(16, "Explicit driver assignment rejects cross-restaurant driver (400)", res.status === 400);
  }

  // Test 17: Explicit driver assignment rejects inactive staff member or non-delivery staff
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "ready", restaurant: restA._id });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(managerUserA, restA));
    const reqInactive = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: ord._id.toString(),
        status: "out_for_delivery",
        assignedDeliveryStaff: { id: inactiveDriverA._id.toString() },
      }),
    });
    const resInactive = await restaurantOrdersPUT(reqInactive);

    const reqKitchen = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: ord._id.toString(),
        status: "out_for_delivery",
        assignedDeliveryStaff: { id: kitchenUser._id.toString() },
      }),
    });
    const resKitchen = await restaurantOrdersPUT(reqKitchen);

    reportTest(
      17,
      "Explicit driver assignment rejects inactive staff and non-delivery staff (400)",
      resInactive.status === 400 && resKitchen.status === 400
    );
  }

  // ========================================================================
  // GROUP 4: CONCURRENCY & ATOMIC STATE TRANSITIONS (Tests 18 - 22)
  // ========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 4: CONCURRENCY & ATOMIC STATE TRANSITIONS");
  console.log("------------------------------------------------------------------------");

  // Test 18: Genuine concurrent status updates on same order result in atomic winner and HTTP 409 Conflict for loser
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "confirmed", restaurant: restA._id });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(managerUserA, restA));

    // Two concurrent requests trying to transition from "confirmed" simultaneously
    const reqA = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "preparing" }),
    });
    const reqB = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "cancelled", cancellationReason: "Concurrent cancel" }),
    });

    const [resA, resB] = await Promise.all([restaurantOrdersPUT(reqA), restaurantOrdersPUT(reqB)]);
    const statuses = [resA.status, resB.status];
    const has200 = statuses.includes(200);
    const has409 = statuses.includes(409);

    reportTest(
      18,
      "Concurrent status updates yield atomic winner (200) and HTTP 409 Conflict for loser",
      has200 && has409,
      `Statuses received: [${statuses.join(", ")}]`
    );
  }

  // Test 19: Customer self-cancellation races atomically with kitchen confirmation; if kitchen confirms first, customer cancellation returns 409 Conflict
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "pending", restaurant: restA._id });
    setOrdersSession(async () => ({ user: { email: customerUser.email, role: "customer" } }));

    const { PATCH: customerCancelPATCH } = await import("../app/api/orders/route.js");

    // Simulate concurrent kitchen confirmation right after customer read but before customer atomic update
    const originalFindById = Order.findById;
    Order.findById = function (...args) {
      const query = originalFindById.apply(this, args);
      const originalPopulate = query.populate;
      query.populate = function (...pArgs) {
        const pQuery = originalPopulate.apply(this, pArgs);
        const originalThen = pQuery.then.bind(pQuery);
        pQuery.then = async function (onFulfilled, onRejected) {
          return originalThen(async (doc) => {
            // Kitchen confirms the order concurrently in the database!
            await Order.updateOne({ _id: ord._id }, { $set: { status: "confirmed" } });
            return onFulfilled ? onFulfilled(doc) : doc;
          }, onRejected);
        };
        return pQuery;
      };
      return query;
    };

    let res, body;
    try {
      const req = new Request("http://localhost:3000/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: ord._id.toString(), reason: "Customer cancel test" }),
      });
      res = await customerCancelPATCH(req);
      body = await res.json();
    } finally {
      Order.findById = originalFindById;
    }

    reportTest(
      19,
      "Customer cancellation racing with kitchen confirmation returns HTTP 409 Conflict",
      res.status === 409 && body.conflict === true,
      `Status: ${res.status}, Message: ${body.message}`
    );
  }

  // Test 20: Concurrent customer GPS location update does not overwrite or revert restaurant order status transitions
  {
    const ord = await createTestOrder({ orderType: "delivery", status: "confirmed", restaurant: restA._id });
    setCustLocationSession(async () => ({ user: { email: customerUser.email, role: "customer" } }));

    // 1. Restaurant advances status to "preparing"
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(managerUserA, restA));
    const reqAdvance = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "preparing" }),
    });
    await restaurantOrdersPUT(reqAdvance);

    // 2. Customer GPS ping occurs concurrently
    const reqLocation = new Request(`http://localhost:3000/api/orders/${ord._id}/customer-location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.9730, longitude: 77.5960, accuracy: 5 }),
    });
    const resLoc = await customerLocationPATCH(reqLocation, { params: Promise.resolve({ id: ord._id.toString() }) });

    // 3. Verify order status remains "preparing" and customerLocation is stored
    const refreshed = await Order.findById(ord._id);
    const statusPreserved = refreshed.status === "preparing";
    const locSaved = refreshed.customerLocation?.latitude === 12.9730;

    reportTest(
      20,
      "Customer GPS location update does not overwrite or revert order status",
      resLoc.status === 200 && statusPreserved && locSaved,
      `Order status: ${refreshed.status}, customerLocation.latitude: ${refreshed.customerLocation?.latitude}`
    );
  }

  // Test 21: Delivery GPS write cannot resurrect or modify an already delivered or cancelled order
  {
    const ordDelivered = await createTestOrder({
      orderType: "delivery",
      status: "delivered",
      restaurant: restA._id,
      assignedDeliveryStaff: { id: deliveryUserA._id, name: deliveryUserA.name },
      deliveryTracking: { isLive: false, endedAt: new Date(), endReason: "delivered" },
    });
    setLocationAuth(async () => mockRestaurantAuth(deliveryUserA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ordDelivered._id}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: 12.9750,
        longitude: 77.5970,
        accuracy: 10,
        recordedAt: new Date().toISOString(),
      }),
    });
    const res = await staffLocationPUT(req, { params: Promise.resolve({ id: ordDelivered._id.toString() }) });
    reportTest(21, "Delivery GPS write cannot resurrect or modify delivered order (400)", res.status === 400);
  }

  // Test 22: Pickup orders are strictly rejected from transitioning to out_for_delivery (400)
  {
    const ordPickup = await createTestOrder({ orderType: "pickup", address: null, status: "ready", restaurant: restA._id });
    setRestaurantOrdersAuth(async () => mockRestaurantAuth(managerUserA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ordPickup._id.toString(), status: "out_for_delivery" }),
    });
    const res = await restaurantOrdersPUT(req);
    const body = await res.json();
    reportTest(22, "Pickup orders strictly rejected from transitioning to 'out_for_delivery' (400)", res.status === 400 && body.success === false);
  }

  // ========================================================================
  // GROUP 5: STALE-ORDER AUTO-DISMISSAL, WASTE & SAFE REFUND (Tests 23 - 27)
  // ========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 5: STALE-ORDER AUTO-DISMISSAL, WASTE LOGGING & SAFE REFUND");
  console.log("------------------------------------------------------------------------");

  // Test 23: Active out_for_delivery order is NEVER cancelled by stale-order maintenance
  {
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);
    const ordTransit = await createTestOrder({
      orderType: "delivery",
      status: "out_for_delivery",
      restaurant: restA._id,
      assignedDeliveryStaff: { id: deliveryUserA._id, name: deliveryUserA.name },
      deliveryTracking: { isLive: true, startedAt: twoHoursAgo },
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    });

    const maintenanceRes = await processStalePickupOrders({ restaurantId: restA._id });
    const refreshed = await Order.findById(ordTransit._id);

    reportTest(
      23,
      "Active 'out_for_delivery' order is NEVER cancelled by stale-order maintenance",
      refreshed.status === "out_for_delivery" && refreshed.deliveryTracking.isLive === true,
      `Status: ${refreshed.status}, isLive: ${refreshed.deliveryTracking.isLive}`
    );
  }

  // Test 24: GET /api/restaurant/orders is strictly read-only and does not mutate or cancel orders
  {
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);
    const ordStalePickup = await createTestOrder({
      orderType: "pickup",
      address: null,
      status: "ready",
      restaurant: restA._id,
      statusHistory: [{ status: "ready", changedAt: twoHoursAgo, changedBy: { role: "staff", name: "Chef" } }],
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    });

    setRestaurantOrdersAuth(async () => mockRestaurantAuth(managerUserA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders?status=all");
    const res = await restaurantOrdersGET(req);
    const body = await res.json();

    const refreshed = await Order.findById(ordStalePickup._id);
    reportTest(
      24,
      "GET /api/restaurant/orders is strictly read-only (does not mutate DB)",
      res.status === 200 && refreshed.status === "ready",
      `Order status remained: ${refreshed.status}`
    );
  }

  // Test 25: Stale pickup maintenance auto-dismisses only uncollected pickup orders exceeding timeout
  {
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);
    const ordStale = await createTestOrder({
      orderType: "pickup",
      address: null,
      status: "ready",
      restaurant: restA._id,
      statusHistory: [{ status: "ready", changedAt: twoHoursAgo, changedBy: { role: "staff", name: "Chef" } }],
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    });

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const ordFresh = await createTestOrder({
      orderType: "pickup",
      address: null,
      status: "ready",
      restaurant: restA._id,
      statusHistory: [{ status: "ready", changedAt: tenMinutesAgo, changedBy: { role: "staff", name: "Chef" } }],
      createdAt: tenMinutesAgo,
      updatedAt: tenMinutesAgo,
    });

    const maintenanceRes = await processStalePickupOrders({ restaurantId: restA._id });

    const refStale = await Order.findById(ordStale._id);
    const refFresh = await Order.findById(ordFresh._id);

    reportTest(
      25,
      "Stale pickup maintenance dismisses timed out orders (>60m) and preserves fresh orders",
      refStale.status === "cancelled" && refFresh.status === "ready",
      `Stale order: ${refStale.status}, Fresh order: ${refFresh.status}`
    );
  }

  // Test 26: Auto-dismissed prepared food creates Waste records instead of returning to raw inventory
  {
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);
    const ordWaste = await createTestOrder({
      orderType: "pickup",
      address: null,
      status: "ready",
      restaurant: restA._id,
      deductedIngredients: [
        {
          ingredient: testIngredient._id,
          ingredientName: testIngredient.name,
          quantity: 0.75,
          unit: "kg",
        },
      ],
      stockDeducted: true,
      stockRestored: false,
      statusHistory: [{ status: "ready", changedAt: twoHoursAgo, changedBy: { role: "staff", name: "Chef" } }],
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    });

    const initialIngredient = await Ingredient.findById(testIngredient._id);
    const initialStock = initialIngredient.currentStock;

    await processStalePickupOrders({ restaurantId: restA._id });

    const postIngredient = await Ingredient.findById(testIngredient._id);
    const rawStockUnchanged = postIngredient.currentStock === initialStock;

    const wasteLog = await Waste.findOne({
      restaurant: restA._id,
      ingredient: testIngredient._id,
      notes: { $regex: new RegExp(ordWaste.orderId) },
    });

    reportTest(
      26,
      "Prepared food cancellation logs Waste (Spoiled) and does not restock raw ingredients",
      rawStockUnchanged && wasteLog !== null && wasteLog.reason === "Spoiled",
      `Raw stock remained: ${postIngredient.currentStock} kg (waste quantity logged: ${wasteLog?.quantity} ${wasteLog?.unit})`
    );
  }

  // Test 27: Stale online prepaid pickup order initiates safe gateway-confirmed refund via executeOrderRefund
  {
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000);
    const ordPrepaid = await createTestOrder({
      orderType: "pickup",
      address: null,
      status: "ready",
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      paymentId: "pay_test_hardened_001",
      totalAmount: 500,
      paymentDetails: {
        razorpayPaymentId: "pay_test_hardened_001",
        razorpayOrderId: "order_test_hardened_001",
      },
      statusHistory: [{ status: "ready", changedAt: twoHoursAgo, changedBy: { role: "staff", name: "Chef" } }],
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    });

    _setTestRazorpayClient({
      payments: {
        fetch: async () => ({ id: "pay_test_hardened_001", status: "captured", amount_refunded: 0 }),
        fetchMultipleRefund: async () => ({ count: 0, items: [] }),
      },
    });

    let gatewayCalled = false;
    _setTestHttpTransport(async (req) => {
      gatewayCalled = true;
      return {
        status: 200,
        data: {
          id: "rfnd_test_hardened_001",
          entity: "refund",
          amount: 50000,
          currency: "INR",
          payment_id: "pay_test_hardened_001",
          status: "processed",
        },
      };
    });

    try {
      await processStalePickupOrders({ restaurantId: restA._id });
    } finally {
      _setTestRazorpayClient(null);
      _resetTestHttpTransport();
    }

    const refPrepaid = await Order.findById(ordPrepaid._id);
    const refundProcessed =
      refPrepaid.paymentStatus === "refunded" &&
      refPrepaid.refundDetails?.status === "processed" &&
      refPrepaid.refundDetails?.refundId === "rfnd_test_hardened_001";

    reportTest(
      27,
      "Abandoned prepaid pickup order initiates safe gateway-confirmed refund",
      gatewayCalled && refundProcessed,
      `paymentStatus: ${refPrepaid.paymentStatus}, refundId: ${refPrepaid.refundDetails?.refundId}`
    );
  }

  // ========================================================================
  // GROUP 6: RESIDUAL GAP 1 — PICKUP CLASSIFICATION MATRIX (Tests 28 - 32)
  // ========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 6: RESIDUAL GAP 1 — PICKUP CLASSIFICATION CANONICAL MATRIX");
  console.log("------------------------------------------------------------------------");

  // Test 28: Order with orderType: "pickup" alone (no notes, non-pickup payment method) is recognized as pickup
  {
    const ord = await createTestOrder({
      orderType: "pickup",
      notes: "Please pack hot",
      paymentMethod: "razorpay",
      address: null,
    });
    const staticCheck = Order.isPickupOrder(ord);
    const methodCheck = ord.isPickupOrder();
    reportTest(
      28,
      "Order with orderType: 'pickup' alone is recognized by isPickupOrder (static & method)",
      staticCheck === true && methodCheck === true,
      `static: ${staticCheck}, method: ${methodCheck}`
    );
  }

  // Test 29: Order with orderType: "delivery" is NEVER recognized as pickup even if notes contain "pickup"
  {
    const ord = await createTestOrder({
      orderType: "delivery",
      notes: "Please pickup some extra napkins on your way out",
      paymentMethod: "cod",
      address: {
        street: "123 Main St",
        city: "Bangalore",
        latitude: 12.97,
        longitude: 77.59,
      },
    });
    const staticCheck = Order.isPickupOrder(ord);
    const methodCheck = ord.isPickupOrder();
    reportTest(
      29,
      "Order with orderType: 'delivery' is NEVER classified as pickup despite 'pickup' in notes",
      staticCheck === false && methodCheck === false,
      `static: ${staticCheck}, method: ${methodCheck}`
    );
  }

  // Test 30: Legacy order without orderType field recognized via legacy notes ('counter pickup' / '[pickup]')
  {
    const ord = await createTestOrder({
      orderType: undefined,
      notes: "Customer counter pickup at 5pm",
      paymentMethod: "cash",
      address: null,
    });
    // Remove orderType explicitly if Mongoose defaulted it
    await Order.collection.updateOne({ _id: ord._id }, { $unset: { orderType: "" } });
    const fresh = await Order.findById(ord._id);
    const staticCheck = Order.isPickupOrder(fresh);
    const methodCheck = fresh.isPickupOrder();
    reportTest(
      30,
      "Legacy order without orderType recognized via legacy pickup notes",
      staticCheck === true && methodCheck === true,
      `static: ${staticCheck}, method: ${methodCheck}`
    );
  }

  // Test 31: Legacy order without orderType recognized via address.addressType === 'pickup'
  {
    const ord = await createTestOrder({
      orderType: undefined,
      notes: "Regular food order",
      paymentMethod: "online",
      address: { addressType: "pickup" },
    });
    await Order.collection.updateOne({ _id: ord._id }, { $unset: { orderType: "" } });
    const fresh = await Order.findById(ord._id);
    const staticCheck = Order.isPickupOrder(fresh);
    const methodCheck = fresh.isPickupOrder();
    reportTest(
      31,
      "Legacy order without orderType recognized via address.addressType === 'pickup'",
      staticCheck === true && methodCheck === true,
      `static: ${staticCheck}, method: ${methodCheck}`
    );
  }

  // Test 32: Legacy order without orderType with ordinary delivery address & notes is NOT recognized as pickup
  {
    const ord = await createTestOrder({
      orderType: undefined,
      notes: "Deliver to 2nd floor flat 204",
      paymentMethod: "cod",
      address: {
        street: "456 Park Avenue",
        city: "Bangalore",
        latitude: 12.98,
        longitude: 77.60,
      },
    });
    await Order.collection.updateOne({ _id: ord._id }, { $unset: { orderType: "" } });
    const fresh = await Order.findById(ord._id);
    const staticCheck = Order.isPickupOrder(fresh);
    const methodCheck = fresh.isPickupOrder();
    reportTest(
      32,
      "Legacy order without orderType and delivery details is NOT classified as pickup",
      staticCheck === false && methodCheck === false,
      `static: ${staticCheck}, method: ${methodCheck}`
    );
  }

  // ========================================================================
  // GROUP 7: RESIDUAL GAP 2 & CRASH RECOVERY — WASTE IDEMPOTENCY & SIDE-EFFECT RECOVERY (Tests 33 - 37)
  // ========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 7: RESIDUAL GAP 2 — WASTE IDEMPOTENCY & SIDE-EFFECT RECOVERY");
  console.log("------------------------------------------------------------------------");

  // Test 33: Multi-ingredient cancellation logs waste for all ingredients with stable opKey & checkpoints
  {
    const ord = await createTestOrder({
      orderType: "pickup",
      status: "ready",
      deductedIngredients: [
        { ingredient: testIngredient._id, ingredientName: testIngredient.name, quantity: 1.2, unit: "kg" },
        { ingredient: testIngredient2._id, ingredientName: testIngredient2.name, quantity: 2.5, unit: "kg" },
      ],
      stockDeducted: true,
      stockRestored: false,
    });

    const wasteResult = await logWasteForOrder(ord, { reasonNote: `Cancelled order #${ord.orderId}` });
    const wasteDocs = await Waste.find({ order: ord._id });
    const refOrd = await Order.findById(ord._id);

    const loggedCountMatches = wasteDocs.length === 2;
    const checkpointMatches = refOrd.wasteLogging?.loggedIngredients?.length === 2;
    const statusCompleted = refOrd.wasteLogging?.status === "completed";

    reportTest(
      33,
      "Multi-ingredient waste logging checkpoints each ingredient and marks completed",
      wasteResult.success && loggedCountMatches && checkpointMatches && statusCompleted,
      `wasteDocs: ${wasteDocs.length}, loggedIngredients: ${refOrd.wasteLogging?.loggedIngredients?.length}, status: ${refOrd.wasteLogging?.status}`
    );
  }

  // Test 34: Partial waste logging failure simulation: retry resumes without duplicating existing Waste docs
  {
    const ord = await createTestOrder({
      orderType: "pickup",
      status: "ready",
      deductedIngredients: [
        { ingredient: testIngredient._id, ingredientName: testIngredient.name, quantity: 0.8, unit: "kg" },
        { ingredient: testIngredient2._id, ingredientName: testIngredient2.name, quantity: 1.5, unit: "kg" },
      ],
      stockDeducted: true,
      stockRestored: false,
    });

    // Simulate crash after first ingredient: write first waste doc and checkpoint it
    const opKey1 = `waste_${ord._id.toString()}_${testIngredient._id.toString()}`;
    await Waste.create({
      restaurant: restA._id,
      ingredient: testIngredient._id,
      ingredientName: testIngredient.name,
      quantity: 0.8,
      unit: "kg",
      reason: "Spoiled",
      cost: 0,
      order: ord._id,
      opKey: opKey1,
      notes: `Simulated partial crash order #${ord.orderId}`,
    });

    await Order.updateOne(
      { _id: ord._id },
      {
        $set: { "wasteLogging.status": "failed", "wasteLogging.lastError": "Simulated mid-loop process crash" },
        $push: {
          "wasteLogging.loggedIngredients": {
            ingredient: testIngredient._id,
            ingredientName: testIngredient.name,
            quantity: 0.8,
            unit: "kg",
            opKey: opKey1,
            loggedAt: new Date(),
          },
        },
      }
    );

    // Now retry waste logging
    const retryRes = await logWasteForOrder(await Order.findById(ord._id), { reasonNote: `Retry order #${ord.orderId}` });
    const wasteDocsAfter = await Waste.find({ order: ord._id });
    const refOrdAfter = await Order.findById(ord._id);

    reportTest(
      34,
      "Retry after partial crash finishes remaining ingredients without duplicating first",
      retryRes.success && wasteDocsAfter.length === 2 && refOrdAfter.wasteLogging?.status === "completed",
      `wasteDocs total: ${wasteDocsAfter.length}, newlyLogged: ${retryRes.newlyLogged}, status: ${refOrdAfter.wasteLogging?.status}`
    );
  }

  // Test 35: Order with no recipe deductions completes waste logging safely without fabricating quantities
  {
    const ord = await createTestOrder({
      orderType: "pickup",
      status: "ready",
      deductedIngredients: [],
      stockDeduction: { deductedIngredients: [] },
      stockDeducted: false,
      stockRestored: false,
    });

    const res = await logWasteForOrder(ord, { reasonNote: `Empty recipe cancellation order #${ord.orderId}` });
    const wasteDocs = await Waste.find({ order: ord._id });
    const refOrd = await Order.findById(ord._id);

    reportTest(
      35,
      "Order with no recipe deductions completes without fabricating waste quantities (count 0)",
      res.success === true && wasteDocs.length === 0 && refOrd.wasteLogging?.status === "completed",
      `wasteDocs: ${wasteDocs.length}, status: ${refOrd.wasteLogging?.status}`
    );
  }

  // Test 36: Side-effect recovery worker discovers cancelled order with pending waste logging and completes it
  {
    const ord = await createTestOrder({
      orderType: "pickup",
      status: "cancelled", // already atomically marked cancelled
      deductedIngredients: [
        { ingredient: testIngredient._id, ingredientName: testIngredient.name, quantity: 0.5, unit: "kg" },
      ],
      stockDeducted: true,
      stockRestored: true,
      wasteLogging: { status: "pending", attemptCount: 1 },
    });

    const recRes = await recoverCancelledOrderSideEffects({ restaurantId: restA._id });
    const refOrd = await Order.findById(ord._id);
    const wasteDocs = await Waste.find({ order: ord._id });

    reportTest(
      36,
      "Side-effect recovery worker resumes uncompleted waste logging on cancelled order",
      recRes.wasteRecovered >= 1 && refOrd.wasteLogging?.status === "completed" && wasteDocs.length === 1,
      `wasteRecovered: ${recRes.wasteRecovered}, status: ${refOrd.wasteLogging?.status}, wasteDocs: ${wasteDocs.length}`
    );
  }

  // Test 37: Side-effect recovery worker safely executes pending refund on cancelled order without changing status
  {
    const ord = await createTestOrder({
      orderType: "pickup",
      status: "cancelled", // cancelled prior to refund completion
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      paymentId: "pay_test_recovery_001",
      totalAmount: 300,
      paymentDetails: {
        razorpayPaymentId: "pay_test_recovery_001",
        razorpayOrderId: "order_test_recovery_001",
      },
      wasteLogging: { status: "completed" },
    });

    _setTestRazorpayClient({
      payments: {
        fetch: async () => ({ id: "pay_test_recovery_001", status: "captured", amount_refunded: 0 }),
        fetchMultipleRefund: async () => ({ count: 0, items: [] }),
      },
    });

    let gatewayCalled = false;
    _setTestHttpTransport(async () => {
      gatewayCalled = true;
      return {
        status: 200,
        data: {
          id: "rfnd_test_recovery_001",
          entity: "refund",
          amount: 30000,
          currency: "INR",
          payment_id: "pay_test_recovery_001",
          status: "processed",
        },
      };
    });

    let recRes;
    try {
      recRes = await recoverCancelledOrderSideEffects({ restaurantId: restA._id });
    } finally {
      _setTestRazorpayClient(null);
      _resetTestHttpTransport();
    }

    const refOrd = await Order.findById(ord._id);
    const refundSuccess =
      refOrd.status === "cancelled" &&
      refOrd.paymentStatus === "refunded" &&
      refOrd.refundDetails?.refundId === "rfnd_test_recovery_001";

    reportTest(
      37,
      "Side-effect recovery worker safely executes pending refund without mutating order status",
      gatewayCalled && refundSuccess && recRes.refundsRecovered >= 1,
      `status: ${refOrd.status}, paymentStatus: ${refOrd.paymentStatus}, refundId: ${refOrd.refundDetails?.refundId}`
    );
  }

  console.log("\n========================================================================");
  console.log(`🎉 ALL ${passedCount} OF ${totalCount} ORDER LIFECYCLE HARDENING TESTS PASSED!`);
  console.log("========================================================================\n");

} finally {
  console.log("Cleaning up test fixtures...");
  await Order.deleteMany({ orderId: { $regex: /^TEST-HL-/ } });
  await Waste.deleteMany({ notes: { $regex: /TEST-HL-/ } });
  await User.deleteMany({ email: { $regex: /@hardened-test\.com$/ } });
  await Restaurant.deleteMany({ slug: { $regex: /^hardened-test-/ } });
  await Ingredient.deleteMany({ name: { $regex: /^Test Hardened / } });
  console.log("Cleanup complete.");
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
    console.log("Stopped isolated MongoMemoryReplSet.");
  }
}
