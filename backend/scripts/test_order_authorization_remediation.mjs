import { register } from "node:module";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import dns from "dns";
import assert from "node:assert/strict";

register(new URL("./loader.mjs", import.meta.url).href, import.meta.url);

dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("========================================================================");
console.log("PET PROTOCOLS — ORDER AUTHORIZATION REMEDIATION REGRESSION TEST SUITE");
console.log("AUD-SEC-01 (TRACKING), AUD-SEC-02 (OTP), AUD-SEC-03 (GUEST OWNERSHIP)");
console.log("========================================================================\n");

console.log("Starting isolated MongoMemoryReplSet...");
const { MongoMemoryReplSet } = await import("mongodb-memory-server");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const localUri = replSet.getUri("test_order_auth_remediation");
assert.ok(
  localUri.includes("127.0.0.1") || localUri.includes("localhost"),
  "Security Invariant: Must use isolated loopback MongoDB URI"
);

process.env.MONGODB_URI = localUri;
process.env.TEST_MONGODB_URI = localUri;
process.env.DELIVERY_OTP_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

await mongoose.connect(localUri);
console.log(`Connected to isolated database: ${localUri}\n`);

// Import models
const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;
const Product = (await import("../models/Product.js")).default;

// Import services and routes
const {
  issueDeliveryOtpForOrder,
  decryptOtpCode,
} = await import("../lib/deliveryOtpService.js");

const {
  generateGuestAccessToken,
  hashGuestAccessToken,
  computeGuestTokenExpiry,
} = await import("../lib/guestAccessService.js");

const {
  GET: trackingGET,
  _setTestGetServerSession: setTrackingSession,
} = await import("../app/api/orders/[id]/tracking/route.js");

const {
  GET: handoverOtpGET,
  POST: handoverOtpPOST,
  _setTestGetServerSession: setHandoverOtpSession,
} = await import("../app/api/orders/[id]/handover-otp/route.js");

const {
  PATCH: customerLocationPATCH,
  _setTestGetServerSession: setLocationSession,
} = await import("../app/api/orders/[id]/customer-location/route.js");

const {
  GET: orderDetailGET,
  _setTestGetServerSession: setDetailSession,
} = await import("../app/api/orders/[id]/route.js");

const {
  GET: ordersGET,
  POST: ordersPOST,
  _setTestGetServerSession: setOrdersSession,
} = await import("../app/api/orders/route.js");

let testCount = 0;
let passCount = 0;

function reportTest(name, passed, detail = "") {
  testCount++;
  if (passed) {
    passCount++;
    console.log(`  [PASS] Test ${testCount}: ${name}`);
  } else {
    console.error(`  [FAIL] Test ${testCount}: ${name} — ${detail}`);
    throw new Error(`Assertion failed in test ${testCount}: ${name} (${detail})`);
  }
}

try {
  // Setup common fixtures
  const restaurant = await Restaurant.create({
    name: "Auth Test Kitchen",
    slug: "auth-test-kitchen",
    phone: "9876543000",
    address: { street: "10 Main St", city: "Bangalore", state: "KA", pincode: "560001", latitude: 12.9716, longitude: 77.5946 },
    enabledFeatures: ["delivery", "pickup"],
  });

  const restaurantB = await Restaurant.create({
    name: "Sibling Kitchen B",
    slug: "sibling-kitchen-b",
    phone: "9876543001",
    address: { street: "20 Main St", city: "Bangalore", state: "KA", pincode: "560001", latitude: 12.9716, longitude: 77.5946 },
    enabledFeatures: ["delivery", "pickup"],
  });

  const customerA = await User.create({
    name: "Customer Alice",
    email: "alice@example.com",
    role: "customer",
    phone: "9876543210",
  });

  // Customer B has the SAME phone number as Customer A (simulating an unverified profile phone spoof)
  const customerB = await User.create({
    name: "Attacker Bob",
    email: "bob@example.com",
    role: "customer",
    phone: "9876543210",
  });

  const customerC = await User.create({
    name: "Unrelated Charlie",
    email: "charlie@example.com",
    role: "customer",
    phone: "9111111111",
  });

  const driver = await User.create({
    name: "Driver Dan",
    email: "driver@example.com",
    role: "staff",
    staffRoles: ["Delivery"],
    restaurant: restaurant._id,
    phone: "9999988888",
  });

  const manager = await User.create({
    name: "Manager Mary",
    email: "manager@example.com",
    role: "restaurant_admin",
    restaurant: restaurant._id,
    phone: "9999977777",
  });

  async function createTestOrder(overrides = {}) {
    const defaultData = {
      orderId: "ORD-" + Math.floor(100000 + Math.random() * 900000),
      restaurant: restaurant._id,
      user: customerA._id,
      orderType: "delivery",
      status: "out_for_delivery",
      items: [{ name: "Pet Feast", price: 300, quantity: 1, itemTotal: 300 }],
      totalAmount: 340,
      subtotal: 300,
      deliveryFee: 40,
      paymentStatus: "paid",
      paymentMethod: "Online (Razorpay)",
      address: {
        fullName: "Alice Wonderland",
        phone: "9876543210",
        street: "123 Pet Lane",
        city: "Bangalore",
        state: "KA",
        pincode: "560001",
        latitude: 12.9750,
        longitude: 77.6000,
      },
      assignedDeliveryStaff: {
        id: driver._id,
        name: driver.name,
        phone: driver.phone,
        assignedAt: new Date(),
      },
      deliveryTracking: {
        isLive: true,
        currentLocation: {
          latitude: 12.9720,
          longitude: 77.5950,
          accuracy: 10,
          speed: 25,
          heading: 90,
          recordedAt: new Date(),
        },
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    };
    return await Order.create({ ...defaultData, ...overrides });
  }

  // Helper to create a guest order with a secure guestAccessToken
  async function createTestGuestOrder(overrides = {}) {
    const rawToken = generateGuestAccessToken();
    const tokenHash = hashGuestAccessToken(rawToken);
    const expiresAt = computeGuestTokenExpiry();

    const order = await createTestOrder({
      user: null,
      guestAccess: {
        tokenHash,
        issuedAt: new Date(),
        expiresAt,
        isRevoked: false,
      },
      ...overrides,
    });

    return { order, rawToken, tokenHash, expiresAt };
  }

  // =========================================================================
  // GROUP 1: REGISTERED CROSS-CUSTOMER ISOLATION (AUD-SEC-01 & AUD-SEC-02)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 1: REGISTERED CROSS-CUSTOMER ISOLATION");
  console.log("------------------------------------------------------------------------");

  // Test 1: Registered Customer B (Attacker) requesting Customer A's live tracking is rejected (404)
  {
    const orderA = await createTestOrder();
    setTrackingSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await trackingGET(new Request("http://localhost/api/orders/" + orderA.orderId + "/tracking"), {
      params: Promise.resolve({ id: orderA.orderId }),
    });
    const data = await res.json();

    reportTest(
      "Customer B cannot access Customer A's tracking route even with matching phone",
      res.status === 404 && data.success === false,
      `status=${res.status}, success=${data.success}`
    );
  }

  // Test 2: Denied tracking response leaks zero coordinates, driver details, or private location data
  {
    const orderA = await createTestOrder();
    setTrackingSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await trackingGET(new Request("http://localhost/api/orders/" + orderA.orderId + "/tracking"), {
      params: Promise.resolve({ id: orderA.orderId }),
    });
    const data = await res.json();

    reportTest(
      "Denied tracking response exposes zero private GPS coordinates or driver data",
      data.location === undefined && data.driver === undefined && data.destination === undefined && data.customerLocation === undefined,
      `data=${JSON.stringify(data)}`
    );
  }

  // Test 3: Registered Customer B cannot retrieve Customer A's handover OTP
  {
    const orderA = await createTestOrder();
    await issueDeliveryOtpForOrder(orderA);
    setHandoverOtpSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await handoverOtpGET(new Request("http://localhost/api/orders/" + orderA.orderId + "/handover-otp"), {
      params: Promise.resolve({ id: orderA.orderId }),
    });
    const data = await res.json();

    reportTest(
      "Customer B cannot access Customer A's delivery OTP even with matching phone (404)",
      res.status === 404 && data.success === false && data.otpCode === undefined
    );
  }

  // Test 4: Registered Customer B cannot reissue Customer A's handover OTP
  {
    const orderA = await createTestOrder();
    await issueDeliveryOtpForOrder(orderA);
    setHandoverOtpSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await handoverOtpPOST(new Request("http://localhost/api/orders/" + orderA.orderId + "/handover-otp", { method: "POST" }), {
      params: Promise.resolve({ id: orderA.orderId }),
    });
    const data = await res.json();

    reportTest(
      "Customer B cannot reissue Customer A's delivery OTP (404)",
      res.status === 404 && data.success === false
    );
  }

  // Test 5: Registered Customer B cannot update Customer A's delivery location
  {
    const orderA = await createTestOrder();
    setLocationSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const req = new Request("http://localhost/api/orders/" + orderA.orderId + "/customer-location", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.9999, longitude: 77.6666 }),
    });
    const res = await customerLocationPATCH(req, { params: Promise.resolve({ id: orderA.orderId }) });
    const data = await res.json();

    reportTest(
      "Customer B cannot overwrite Customer A's customer-location coordinates (404)",
      res.status === 404 && data.success === false
    );
  }

  // =========================================================================
  // GROUP 2: AUD-SEC-03 — GUEST ORDER AUTHORIZATION REMEDIATION (NEGATIVE)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 2: AUD-SEC-03 — GUEST ORDER AUTHORIZATION REMEDIATION (NEGATIVE)");
  console.log("------------------------------------------------------------------------");

  // Test 6 (Negative): Registered attacker sets profile phone to guest's phone -> Cannot access guest order via GET /api/orders
  {
    const { order: guestOrder } = await createTestGuestOrder({
      address: {
        fullName: "Victim Guest",
        phone: "9876543210", // Matching Bob's phone
        street: "Victim St", city: "BLR", state: "KA", pincode: "560001",
      },
    });

    setOrdersSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await ordersGET(new Request("http://localhost/api/orders?orderId=" + guestOrder.orderId));
    const data = await res.json();

    reportTest(
      "AUD-SEC-03: Registered attacker cannot list or find guest order on /api/orders via matching phone",
      res.status === 200 && data.orders.length === 0
    );
  }

  // Test 7 (Negative): Registered attacker sets profile phone to guest's phone -> Cannot access guest order via GET /api/orders/[id]
  {
    const { order: guestOrder } = await createTestGuestOrder({
      address: {
        fullName: "Victim Guest",
        phone: "9876543210",
        street: "Victim St", city: "BLR", state: "KA", pincode: "560001",
      },
    });

    setDetailSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await orderDetailGET(new Request("http://localhost/api/orders/" + guestOrder.orderId), {
      params: Promise.resolve({ id: guestOrder.orderId }),
    });
    const data = await res.json();

    reportTest(
      "AUD-SEC-03: Registered attacker cannot view guest order details on /api/orders/[id] via matching phone (404)",
      res.status === 404 && data.success === false
    );
  }

  // Test 8 (Negative): Registered attacker cannot access guest tracking on /api/orders/[id]/tracking via matching phone
  {
    const { order: guestOrder } = await createTestGuestOrder({
      address: {
        fullName: "Victim Guest",
        phone: "9876543210",
        street: "Victim St", city: "BLR", state: "KA", pincode: "560001",
      },
    });

    setTrackingSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await trackingGET(new Request("http://localhost/api/orders/" + guestOrder.orderId + "/tracking"), {
      params: Promise.resolve({ id: guestOrder.orderId }),
    });
    const data = await res.json();

    reportTest(
      "AUD-SEC-03: Registered attacker cannot access guest live tracking via matching phone (404)",
      res.status === 404 && data.success === false && data.location === undefined
    );
  }

  // Test 9 (Negative): Registered attacker cannot retrieve guest handover OTP via matching phone
  {
    const { order: guestOrder } = await createTestGuestOrder({
      address: {
        fullName: "Victim Guest",
        phone: "9876543210",
        street: "Victim St", city: "BLR", state: "KA", pincode: "560001",
      },
    });
    await issueDeliveryOtpForOrder(guestOrder);

    setHandoverOtpSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await handoverOtpGET(new Request("http://localhost/api/orders/" + guestOrder.orderId + "/handover-otp"), {
      params: Promise.resolve({ id: guestOrder.orderId }),
    });
    const data = await res.json();

    reportTest(
      "AUD-SEC-03: Registered attacker cannot retrieve guest delivery handover OTP via matching phone (404)",
      res.status === 404 && data.success === false && data.otpCode === undefined
    );
  }

  // Test 10 (Negative): Registered attacker cannot reissue or rotate guest handover OTP via matching phone
  {
    const { order: guestOrder } = await createTestGuestOrder({
      address: {
        fullName: "Victim Guest",
        phone: "9876543210",
        street: "Victim St", city: "BLR", state: "KA", pincode: "560001",
      },
    });
    const issueRes = await issueDeliveryOtpForOrder(guestOrder);
    const originalDigest = (await Order.findById(guestOrder._id).select("+deliveryOtp.codeDigest")).deliveryOtp.codeDigest;

    setHandoverOtpSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await handoverOtpPOST(new Request("http://localhost/api/orders/" + guestOrder.orderId + "/handover-otp", { method: "POST" }), {
      params: Promise.resolve({ id: guestOrder.orderId }),
    });
    const data = await res.json();

    const postOrder = await Order.findById(guestOrder._id).select("+deliveryOtp.codeDigest");

    reportTest(
      "AUD-SEC-03: Unauthorized OTP reissue rejected (404) and OTP state remains completely untouched",
      res.status === 404 &&
      data.success === false &&
      postOrder.deliveryOtp.codeDigest === originalDigest &&
      postOrder.deliveryOtp.reissueCount === 0
    );
  }

  // Test 11 (Negative): Registered attacker cannot modify guest customer delivery coordinates
  {
    const { order: guestOrder } = await createTestGuestOrder({
      address: {
        fullName: "Victim Guest",
        phone: "9876543210",
        street: "Victim St", city: "BLR", state: "KA", pincode: "560001",
      },
    });

    setLocationSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const req = new Request("http://localhost/api/orders/" + guestOrder.orderId + "/customer-location", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 12.9111, longitude: 77.5111 }),
    });
    const res = await customerLocationPATCH(req, { params: Promise.resolve({ id: guestOrder.orderId }) });
    const data = await res.json();

    const postOrder = await Order.findById(guestOrder._id);

    reportTest(
      "AUD-SEC-03: Registered attacker cannot update guest customer-location coordinates via matching phone (404)",
      res.status === 404 && data.success === false && (postOrder.customerLocation == null || postOrder.customerLocation.latitude == null)
    );
  }

  // Test 12 (Negative): recipientPhone matching against guest orders is strictly rejected
  {
    const { order: guestRecipientOrder } = await createTestGuestOrder({
      address: {
        fullName: "Guest",
        phone: "9111111111",
        recipientPhone: "9876543210", // Matching Bob's phone
        street: "St", city: "BLR", state: "KA", pincode: "560001",
      },
    });
    await issueDeliveryOtpForOrder(guestRecipientOrder);

    setHandoverOtpSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await handoverOtpGET(new Request("http://localhost/api/orders/" + guestRecipientOrder.orderId + "/handover-otp"), {
      params: Promise.resolve({ id: guestRecipientOrder.orderId }),
    });
    const data = await res.json();

    reportTest(
      "AUD-SEC-03: recipientPhone match against guest order strictly rejected (404)",
      res.status === 404 && data.success === false && data.otpCode === undefined
    );
  }

  // Test 13 (Negative): Legacy guest order (missing user field) cannot be accessed by phone match alone
  {
    const rawLegacy = {
      orderId: "ORD-LEGACY-" + Math.floor(100000 + Math.random() * 900000),
      restaurant: restaurant._id,
      orderType: "delivery",
      status: "out_for_delivery",
      items: [{ name: "Pet Feast", price: 300, quantity: 1, itemTotal: 300 }],
      totalAmount: 340,
      subtotal: 300,
      deliveryFee: 40,
      paymentStatus: "paid",
      paymentMethod: "Cash on Delivery (COD)",
      address: {
        fullName: "Legacy Customer",
        phone: "9876543210", // Matching Bob's phone
        street: "Old Street", city: "BLR", state: "KA", pincode: "560001",
      },
      deliveryTracking: {
        isLive: true,
        currentLocation: { latitude: 12.9730, longitude: 77.5960, recordedAt: new Date() },
      },
    };
    await Order.collection.insertOne(rawLegacy);

    setTrackingSession(async () => ({ user: { email: customerB.email, role: "customer", id: customerB._id.toString() } }));

    const res = await trackingGET(new Request("http://localhost/api/orders/" + rawLegacy.orderId + "/tracking"), {
      params: Promise.resolve({ id: rawLegacy.orderId }),
    });
    const data = await res.json();

    reportTest(
      "AUD-SEC-03: Legacy order without user field fails closed (404, no coordinates leaked)",
      res.status === 404 && data.success === false && data.location === undefined
    );
  }

  // Test 14 (Negative): Missing, malformed, or invalid guest access token is rejected
  {
    const { order: guestOrder } = await createTestGuestOrder();

    setTrackingSession(async () => null);

    // Request with malformed token
    const reqMalformed = new Request("http://localhost/api/orders/" + guestOrder.orderId + "/tracking", {
      headers: { "x-guest-access-token": "not_a_valid_token" },
    });
    const resMalformed = await trackingGET(reqMalformed, { params: Promise.resolve({ id: guestOrder.orderId }) });

    // Request with random wrong token
    const reqWrong = new Request("http://localhost/api/orders/" + guestOrder.orderId + "/tracking", {
      headers: { "x-guest-access-token": generateGuestAccessToken() },
    });
    const resWrong = await trackingGET(reqWrong, { params: Promise.resolve({ id: guestOrder.orderId }) });

    reportTest(
      "AUD-SEC-03: Malformed or wrong guestAccessToken rejected (401/404)",
      resMalformed.status === 401 && resWrong.status === 404
    );
  }

  // Test 15 (Negative): Cross-guest isolation: Guest Token A cannot access Guest Order B
  {
    const { order: guestOrderA, rawToken: tokenA } = await createTestGuestOrder();
    const { order: guestOrderB, rawToken: tokenB } = await createTestGuestOrder();

    setDetailSession(async () => null);

    // Guest A attempts to view Order B details using Token A
    const req = new Request("http://localhost/api/orders/" + guestOrderB.orderId, {
      headers: { "x-guest-access-token": tokenA },
    });
    const res = await orderDetailGET(req, { params: Promise.resolve({ id: guestOrderB.orderId }) });
    const data = await res.json();

    reportTest(
      "AUD-SEC-03: Cross-guest isolation: Guest Token A cannot access Guest Order B (404)",
      res.status === 404 && data.success === false
    );
  }

  // Test 16 (Negative): Guest token cannot access a registered customer's order
  {
    const registeredOrder = await createTestOrder({ user: customerA._id });
    const { rawToken } = await createTestGuestOrder();

    setTrackingSession(async () => null);

    const req = new Request("http://localhost/api/orders/" + registeredOrder.orderId + "/tracking", {
      headers: { "x-guest-access-token": rawToken },
    });
    const res = await trackingGET(req, { params: Promise.resolve({ id: registeredOrder.orderId }) });
    const data = await res.json();

    reportTest(
      "AUD-SEC-03: Guest access token cannot unlock a registered customer's order (404)",
      res.status === 404 && data.success === false
    );
  }

  // Test 17 (Negative): Revoked guest token is immediately rejected
  {
    const { order: guestOrder, rawToken } = await createTestGuestOrder({
      guestAccess: {
        tokenHash: hashGuestAccessToken(generateGuestAccessToken()),
        issuedAt: new Date(),
        expiresAt: computeGuestTokenExpiry(),
        isRevoked: true, // REVOKED
      },
    });

    setTrackingSession(async () => null);

    const req = new Request("http://localhost/api/orders/" + guestOrder.orderId + "/tracking", {
      headers: { "x-guest-access-token": rawToken },
    });
    const res = await trackingGET(req, { params: Promise.resolve({ id: guestOrder.orderId }) });

    reportTest(
      "AUD-SEC-03: Revoked guest access token fails closed with 404",
      res.status === 404
    );
  }

  // Test 18 (Negative): Expired guest token is rejected
  {
    const expiredRawToken = generateGuestAccessToken();
    const expiredHash = hashGuestAccessToken(expiredRawToken);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day in the past

    const guestOrder = await createTestOrder({
      user: null,
      guestAccess: {
        tokenHash: expiredHash,
        issuedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        expiresAt: pastDate, // EXPIRED
        isRevoked: false,
      },
    });

    setTrackingSession(async () => null);

    const req = new Request("http://localhost/api/orders/" + guestOrder.orderId + "/tracking", {
      headers: { "x-guest-access-token": expiredRawToken },
    });
    const res = await trackingGET(req, { params: Promise.resolve({ id: guestOrder.orderId }) });

    reportTest(
      "AUD-SEC-03: Expired guest access token fails closed with 404",
      res.status === 404
    );
  }

  // =========================================================================
  // GROUP 3: POSITIVE AUTHORIZATION & GUEST WORKFLOW VERIFICATION
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 3: POSITIVE AUTHORIZATION & GUEST WORKFLOW VERIFICATION");
  console.log("------------------------------------------------------------------------");

  // Test 19 (Positive): Legitimate registered customer can access their own orders
  {
    const orderA = await createTestOrder();
    setDetailSession(async () => ({ user: { email: customerA.email, role: "customer", id: customerA._id.toString() } }));

    const res = await orderDetailGET(new Request("http://localhost/api/orders/" + orderA.orderId), {
      params: Promise.resolve({ id: orderA.orderId }),
    });
    const data = await res.json();

    reportTest(
      "Registered customer Alice can access their own order details (200)",
      res.status === 200 && data.success === true && data.order.orderId === orderA.orderId
    );
  }

  // Test 20 (Positive): Legitimate guest with guestAccessToken can access their order details
  {
    const { order: guestOrder, rawToken } = await createTestGuestOrder();

    setDetailSession(async () => null);

    const req = new Request("http://localhost/api/orders/" + guestOrder.orderId, {
      headers: { "x-guest-access-token": rawToken },
    });
    const res = await orderDetailGET(req, { params: Promise.resolve({ id: guestOrder.orderId }) });
    const data = await res.json();

    reportTest(
      "Legitimate guest with x-guest-access-token retrieves order details (200)",
      res.status === 200 && data.success === true && data.order.orderId === guestOrder.orderId
    );
  }

  // Test 21 (Positive): Legitimate guest with guestAccessToken via URL parameter retrieves order
  {
    const { order: guestOrder, rawToken } = await createTestGuestOrder();

    setDetailSession(async () => null);

    const req = new Request(`http://localhost/api/orders/${guestOrder.orderId}?guestToken=${encodeURIComponent(rawToken)}`);
    const res = await orderDetailGET(req, { params: Promise.resolve({ id: guestOrder.orderId }) });
    const data = await res.json();

    reportTest(
      "Legitimate guest with ?guestToken= parameter retrieves order details (200)",
      res.status === 200 && data.success === true && data.order.orderId === guestOrder.orderId
    );
  }

  // Test 22 (Positive): Legitimate guest with guestAccessToken can view live tracking coordinates
  {
    const { order: guestOrder, rawToken } = await createTestGuestOrder();

    setTrackingSession(async () => null);

    const req = new Request("http://localhost/api/orders/" + guestOrder.orderId + "/tracking", {
      headers: { "x-guest-access-token": rawToken },
    });
    const res = await trackingGET(req, { params: Promise.resolve({ id: guestOrder.orderId }) });
    const data = await res.json();

    reportTest(
      "Legitimate guest with token receives live GPS tracking coordinates (200)",
      res.status === 200 && data.success === true && data.location?.latitude === 12.9720
    );
  }

  // Test 23 (Positive): Legitimate guest with guestAccessToken can retrieve handover OTP
  {
    const { order: guestOrder, rawToken } = await createTestGuestOrder();
    const issueRes = await issueDeliveryOtpForOrder(guestOrder);

    setHandoverOtpSession(async () => null);

    const req = new Request("http://localhost/api/orders/" + guestOrder.orderId + "/handover-otp", {
      headers: { "x-guest-access-token": rawToken },
    });
    const res = await handoverOtpGET(req, { params: Promise.resolve({ id: guestOrder.orderId }) });
    const data = await res.json();

    reportTest(
      "Legitimate guest with token retrieves handover OTP successfully (200)",
      res.status === 200 && data.success === true && data.otpCode === issueRes.otpCode
    );
  }

  // Test 24 (Positive): Legitimate guest with guestAccessToken can reissue handover OTP
  {
    const { order: guestOrder, rawToken } = await createTestGuestOrder();
    await issueDeliveryOtpForOrder(guestOrder);

    // Set lastIssuedAt to 35 seconds ago to satisfy 30s cooldown
    await Order.findByIdAndUpdate(guestOrder._id, {
      $set: { "deliveryOtp.lastIssuedAt": new Date(Date.now() - 35 * 1000) },
    });

    setHandoverOtpSession(async () => null);

    const req = new Request("http://localhost/api/orders/" + guestOrder.orderId + "/handover-otp", {
      method: "POST",
      headers: { "x-guest-access-token": rawToken },
    });
    const res = await handoverOtpPOST(req, { params: Promise.resolve({ id: guestOrder.orderId }) });
    const data = await res.json();

    reportTest(
      "Legitimate guest with token can reissue handover OTP (200)",
      res.status === 200 && data.success === true && typeof data.otpCode === "string"
    );
  }

  // Test 25 (Positive): Legitimate guest with guestAccessToken can update customer delivery coordinates
  {
    const { order: guestOrder, rawToken } = await createTestGuestOrder();

    setLocationSession(async () => null);

    const req = new Request("http://localhost/api/orders/" + guestOrder.orderId + "/customer-location", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-guest-access-token": rawToken,
      },
      body: JSON.stringify({ latitude: 12.9800, longitude: 77.6100, accuracy: 8 }),
    });
    const res = await customerLocationPATCH(req, { params: Promise.resolve({ id: guestOrder.orderId }) });
    const data = await res.json();

    const postOrder = await Order.findById(guestOrder._id);

    reportTest(
      "Legitimate guest with token updates customer-location coordinates (200)",
      res.status === 200 &&
      data.success === true &&
      postOrder.customerLocation?.latitude === 12.9800 &&
      postOrder.customerLocation?.longitude === 77.6100
    );
  }

  // Test 26 (Positive): Multi-restaurant guest checkout: Single guest token unlocks all sibling child orders in the batch
  {
    const sharedGuestToken = generateGuestAccessToken();
    const sharedTokenHash = hashGuestAccessToken(sharedGuestToken);
    const sharedBatchId = "ORD-BATCH-" + Math.floor(100000 + Math.random() * 900000);

    const childOrder1 = await createTestOrder({
      orderId: sharedBatchId,
      restaurant: restaurant._id,
      user: null,
      guestAccess: {
        tokenHash: sharedTokenHash,
        issuedAt: new Date(),
        expiresAt: computeGuestTokenExpiry(),
        isRevoked: false,
      },
    });

    const childOrder2 = await createTestOrder({
      orderId: sharedBatchId,
      restaurant: restaurantB._id,
      user: null,
      guestAccess: {
        tokenHash: sharedTokenHash,
        issuedAt: new Date(),
        expiresAt: computeGuestTokenExpiry(),
        isRevoked: false,
      },
    });

    setDetailSession(async () => null);

    // Guest views batch order details using single shared token
    const req = new Request("http://localhost/api/orders/" + sharedBatchId, {
      headers: { "x-guest-access-token": sharedGuestToken },
    });
    const res = await orderDetailGET(req, { params: Promise.resolve({ id: sharedBatchId }) });
    const data = await res.json();

    reportTest(
      "Multi-restaurant guest batch: Single guest token unlocks all sibling subOrders (200)",
      res.status === 200 &&
      data.success === true &&
      data.isMultiRestaurant === true &&
      data.subOrders.length === 2
    );
  }

  // Test 27 (Positive): Multi-restaurant least-privilege: Kitchen A staff can only access Child Order 1, not Child Order 2
  {
    const sharedBatchId = "ORD-BATCH-MULTI-" + Math.floor(100000 + Math.random() * 900000);

    const childOrder1 = await createTestOrder({
      orderId: sharedBatchId,
      restaurant: restaurant._id,
      user: null,
    });

    const childOrder2 = await createTestOrder({
      orderId: sharedBatchId,
      restaurant: restaurantB._id,
      user: null,
    });

    // Manager Mary from Restaurant A attempts to view Child Order 2
    setDetailSession(async () => ({ user: { email: manager.email, role: "restaurant_admin", restaurantId: restaurant._id.toString() } }));

    const res2 = await orderDetailGET(new Request("http://localhost/api/orders/" + childOrder2._id), {
      params: Promise.resolve({ id: childOrder2._id.toString() }),
    });

    reportTest(
      "Multi-restaurant least-privilege: Kitchen A manager cannot access Kitchen B child order (404)",
      res2.status === 404
    );
  }

  // Test 28 (Positive): Dual-party verification: Assigned driver Dan can access OTP for delivery
  {
    const orderA = await createTestOrder();
    const issueRes = await issueDeliveryOtpForOrder(orderA);

    setHandoverOtpSession(async () => ({ user: { email: driver.email, role: "staff", id: driver._id.toString() } }));

    const res = await handoverOtpGET(new Request("http://localhost/api/orders/" + orderA.orderId + "/handover-otp"), {
      params: Promise.resolve({ id: orderA.orderId }),
    });
    const data = await res.json();

    reportTest(
      "Assigned delivery staff Dan can access delivery handover OTP (200)",
      res.status === 200 && data.success === true && data.otpCode === issueRes.otpCode
    );
  }

  // Test 29 (Positive): Dual-party verification: Restaurant manager Mary can access OTP for delivery
  {
    const orderA = await createTestOrder();
    const issueRes = await issueDeliveryOtpForOrder(orderA);

    setHandoverOtpSession(async () => ({ user: { email: manager.email, role: "restaurant_admin", id: manager._id.toString() } }));

    const res = await handoverOtpGET(new Request("http://localhost/api/orders/" + orderA.orderId + "/handover-otp"), {
      params: Promise.resolve({ id: orderA.orderId }),
    });
    const data = await res.json();

    reportTest(
      "Restaurant manager Mary can access delivery handover OTP (200)",
      res.status === 200 && data.success === true && data.otpCode === issueRes.otpCode
    );
  }

  // Test 30 (Positive): Pickup orders strictly reject delivery handover OTP (400)
  {
    const pickupOrder = await createTestOrder({ orderType: "pickup", status: "ready" });
    setHandoverOtpSession(async () => ({ user: { email: customerA.email, role: "customer", id: customerA._id.toString() } }));

    const res = await handoverOtpGET(new Request("http://localhost/api/orders/" + pickupOrder.orderId + "/handover-otp"), {
      params: Promise.resolve({ id: pickupOrder.orderId }),
    });

    reportTest(
      "Pickup orders do not require delivery handover OTP (returns 400)",
      res.status === 400
    );
  }

  // Test 31 (Positive): Pre-dispatch order does not leak OTP prematurely (notActiveYet: true)
  {
    const prepOrder = await createTestOrder({ status: "preparing", deliveryTracking: { isLive: false } });
    setHandoverOtpSession(async () => ({ user: { email: customerA.email, role: "customer", id: customerA._id.toString() } }));

    const res = await handoverOtpGET(new Request("http://localhost/api/orders/" + prepOrder.orderId + "/handover-otp"), {
      params: Promise.resolve({ id: prepOrder.orderId }),
    });
    const data = await res.json();

    reportTest(
      "Pre-dispatch order returns notActiveYet without disclosing OTP",
      data.notActiveYet === true && data.otpCode === undefined
    );
  }

  console.log("\n========================================================================");
  console.log(`🎉 ALL ${passCount} OF ${testCount} ORDER AUTHORIZATION REMEDIATION TESTS PASSED!`);
  console.log("========================================================================\n");

} catch (err) {
  console.error("Test execution failed with error:", err);
  process.exit(1);
} finally {
  console.log("Cleaning up isolated test database...");
  await Order.deleteMany({});
  await User.deleteMany({});
  await Restaurant.deleteMany({});
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
    console.log("Stopped isolated MongoMemoryReplSet.");
  }
}
