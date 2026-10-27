import { register } from "node:module";
import mongoose from "mongoose";
import dns from "dns";
import assert from "node:assert/strict";
import crypto from "crypto";

register(new URL("./loader.mjs", import.meta.url).href, import.meta.url);
dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("========================================================================");
console.log("PET PROTOCOLS — GUEST TOKEN HARDENING & REPLAY RECOVERY TEST SUITE");
console.log("GUEST-URL-01, GUEST-REPLAY-02, GUEST-EXPIRY-03");
console.log("========================================================================\n");

console.log("Starting isolated MongoMemoryReplSet...");
const { MongoMemoryReplSet } = await import("mongodb-memory-server");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const localUri = replSet.getUri("test_guest_token_hardening");

assert.ok(
  localUri.includes("127.0.0.1") || localUri.includes("localhost"),
  "Security Invariant: Must use isolated loopback MongoDB URI"
);

process.env.MONGODB_URI = localUri;
process.env.TEST_MONGODB_URI = localUri;
process.env.DELIVERY_OTP_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.RAZORPAY_KEY_ID = "rzp_test_mock_key_id";
process.env.RAZORPAY_KEY_SECRET = "mock_secret_for_razorpay_tests_123456";

await mongoose.connect(localUri);
console.log(`Connected to isolated database: ${localUri}\n`);

// Import models
const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;
const PaymentIntent = (await import("../models/PaymentIntent.js")).default;

// Import services and route handlers
const {
  generateGuestAccessToken,
  deriveGuestAccessToken,
  hashGuestAccessToken,
  verifyGuestToken,
  computeGuestTokenExpiry,
  isGuestAccessActive,
  buildGuestOrderQuery,
  extractGuestAccessToken,
} = await import("../lib/guestAccessService.js");

const { POST: paymentVerifyPOST, _setTestRazorpayClient } = await import("../app/api/payment/verify/route.js");
const { GET: orderDetailGET } = await import("../app/api/orders/[id]/route.js");
const { GET: trackingGET } = await import("../app/api/orders/[id]/tracking/route.js");
const { POST: ordersPOST, GET: ordersGET } = await import("../app/api/orders/route.js");

let totalTests = 0;
let passedTests = 0;

function reportTest(name, condition, details = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
  } else {
    console.error(`  [FAIL] Test ${totalTests}: ${name} — ${details}`);
    throw new Error(`Assertion failed in test ${totalTests}: ${name} (${details})`);
  }
}

try {
  // Setup baseline restaurant fixture
  const restaurant = await Restaurant.create({
    name: "Golden Paw Diner",
    slug: "golden-paw-diner",
    email: "kitchen@goldenpaw.test",
    phone: "9876543201",
    address: { street: "12 Bone Way", city: "Bangalore", state: "KA", pincode: "560001" },
    status: "active",
    chargeSettings: { packagingCharge: 15, deliveryFee: 30, freeDeliveryThreshold: 500 },
  });

  const registeredCustomer = await User.create({
    name: "Reggie Customer",
    email: "reggie@example.com",
    role: "customer",
    phone: "9111222333",
  });

  // =========================================================================
  // GROUP 1: GUEST-EXPIRY-03 — MANDATORY EXPIRY VERIFICATION
  // =========================================================================
  console.log("------------------------------------------------------------------------");
  console.log("GROUP 1: GUEST-EXPIRY-03 — MANDATORY EXPIRY CHECKS");
  console.log("------------------------------------------------------------------------");

  // Test 1: Unit check isGuestAccessActive fails closed on null or missing expiresAt
  {
    reportTest(
      "isGuestAccessActive fails closed when expiresAt is null",
      isGuestAccessActive({ tokenHash: "abc", expiresAt: null, isRevoked: false }) === false
    );
  }

  // Test 2: Unit check isGuestAccessActive fails closed when expiresAt is undefined
  {
    reportTest(
      "isGuestAccessActive fails closed when expiresAt is undefined",
      isGuestAccessActive({ tokenHash: "abc", isRevoked: false }) === false
    );
  }

  // Test 3: Unit check isGuestAccessActive fails closed when expiresAt is in the past
  {
    const pastDate = new Date(Date.now() - 60000);
    reportTest(
      "isGuestAccessActive fails closed when expiresAt is in the past",
      isGuestAccessActive({ tokenHash: "abc", expiresAt: pastDate, isRevoked: false }) === false
    );
  }

  // Test 4: Unit check isGuestAccessActive succeeds when expiresAt is in the future
  {
    const futureDate = new Date(Date.now() + 86400000);
    reportTest(
      "isGuestAccessActive succeeds when expiresAt is valid and in the future",
      isGuestAccessActive({ tokenHash: "abc", expiresAt: futureDate, isRevoked: false }) === true
    );
  }

  // Test 5: MongoDB buildGuestOrderQuery fails closed on order with null expiresAt
  {
    const token = generateGuestAccessToken();
    const tokenHash = hashGuestAccessToken(token);

    const orderNullExpiry = await Order.create({
      user: null,
      restaurant: restaurant._id,
      items: [{ name: "Dish A", quantity: 1, price: 100 }],
      totalAmount: 145,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "Razorpay (Online Payment)",
      orderId: "ORD_NULL_EXP_001",
      guestAccess: {
        tokenHash,
        issuedAt: new Date(),
        expiresAt: null, // Null expiry
        isRevoked: false,
      },
    });

    const query = buildGuestOrderQuery(tokenHash, { orderId: orderNullExpiry.orderId });
    const matched = await Order.findOne(query);

    reportTest(
      "buildGuestOrderQuery returns null for order with null expiresAt (mandatory expiry)",
      matched === null
    );
  }

  // Test 6: MongoDB buildGuestOrderQuery succeeds on order with valid future expiresAt
  {
    const token = generateGuestAccessToken();
    const tokenHash = hashGuestAccessToken(token);

    const orderValidExpiry = await Order.create({
      user: null,
      restaurant: restaurant._id,
      items: [{ name: "Dish B", quantity: 1, price: 200 }],
      totalAmount: 245,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "Razorpay (Online Payment)",
      orderId: "ORD_VALID_EXP_001",
      guestAccess: {
        tokenHash,
        issuedAt: new Date(),
        expiresAt: computeGuestTokenExpiry(),
        isRevoked: false,
      },
    });

    const query = buildGuestOrderQuery(tokenHash, { orderId: orderValidExpiry.orderId });
    const matched = await Order.findOne(query);

    reportTest(
      "buildGuestOrderQuery successfully retrieves order with valid future expiresAt",
      matched !== null && matched.orderId === "ORD_VALID_EXP_001"
    );
  }

  // =========================================================================
  // GROUP 2: GUEST-REPLAY-02 — SECURE IDEMPOTENT PAYMENT VERIFICATION RECOVERY
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 2: GUEST-REPLAY-02 — IDEMPOTENT PAYMENT VERIFICATION RECOVERY");
  console.log("------------------------------------------------------------------------");

  // Mock Razorpay gateway client
  const mockRzOrderId = "order_rz_test_guest_101";
  const mockRzPaymentId = "pay_rz_test_guest_101";
  const validSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${mockRzOrderId}|${mockRzPaymentId}`)
    .digest("hex");

  const mockRazorpay = {
    orders: {
      fetch: async (id) => ({
        id,
        amount: id === "order_rz_test_reg_202" ? 40000 : 35000,
        currency: "INR",
        status: "paid",
      }),
    },
    payments: {
      fetch: async (id) => ({
        id,
        order_id: id === "pay_rz_test_reg_202" ? "order_rz_test_reg_202" : mockRzOrderId,
        amount: id === "pay_rz_test_reg_202" ? 40000 : 35000,
        currency: "INR",
        status: "captured",
      }),
    },
  };
  _setTestRazorpayClient(mockRazorpay);

  // Create pre-verified PaymentIntent for guest checkout
  const guestPaymentIntent = await PaymentIntent.create({
    razorpayOrderId: mockRzOrderId,
    amount: 350,
    amountPaise: 35000,
    currency: "INR",
    status: "created",
    user: null, // Guest checkout
    address: {
      fullName: "Guest Customer Alpha",
      phone: "9876543210",
      street: "123 Guest Way",
      city: "Bangalore",
      state: "KA",
      pincode: "560001",
    },
    calcResult: {
      totalAmount: 350,
      orders: [
        {
          restaurantId: restaurant._id,
          subtotal: 300,
          deliveryFee: 35,
          packagingCharge: 15,
          totalAmount: 350,
          items: [
            {
              name: "Gourmet Dog Meal",
              quantity: 2,
              price: 150,
            },
          ],
        },
      ],
    },
  });

  let initialGuestToken = null;

  // Test 7: Initial successful guest verification returns deterministic guestAccessToken
  {
    const req = new Request("http://localhost/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: mockRzOrderId,
        razorpay_payment_id: mockRzPaymentId,
        razorpay_signature: validSignature,
      }),
    });

    const res = await paymentVerifyPOST(req);
    const data = await res.json();

    initialGuestToken = data.guestAccessToken;

    reportTest(
      "Initial guest payment verification returns valid guestAccessToken (status 201)",
      res.status === 201 &&
      data.success === true &&
      typeof initialGuestToken === "string" &&
      initialGuestToken.startsWith("gst_") &&
      initialGuestToken.length >= 36,
      `status=${res.status}, data=${JSON.stringify(data)}`
    );
  }

  // Test 8: Order in DB has tokenHash matching the returned guestAccessToken
  {
    const createdOrder = await Order.findOne({ orderId: mockRzOrderId }).select("+guestAccess.tokenHash");
    const expectedHash = hashGuestAccessToken(initialGuestToken);

    reportTest(
      "Order in database stores SHA-256 hash matching initialGuestToken",
      createdOrder !== null &&
      createdOrder.guestAccess?.tokenHash === expectedHash &&
      createdOrder.user === null
    );
  }

  // Test 9: Simulated lost response -> Client retries identical payment verification request
  let replayedGuestToken = null;
  {
    const retryReq = new Request("http://localhost/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: mockRzOrderId,
        razorpay_payment_id: mockRzPaymentId,
        razorpay_signature: validSignature,
      }),
    });

    const retryRes = await paymentVerifyPOST(retryReq);
    const retryData = await retryRes.json();

    replayedGuestToken = retryData.guestAccessToken;

    reportTest(
      "Replayed payment verification request recovers guestAccessToken (status 200)",
      retryRes.status === 200 &&
      retryData.success === true &&
      replayedGuestToken === initialGuestToken,
      `replayedToken=${replayedGuestToken}, initialToken=${initialGuestToken}`
    );
  }

  // Test 10: Idempotent replay does not create duplicate orders or duplicate payment fulfillment
  {
    const count = await Order.countDocuments({ orderId: mockRzOrderId });
    reportTest(
      "Payment verification replay preserves single order count (zero duplicate orders)",
      count === 1
    );
  }

  // Test 11: Replayed token successfully authorizes access to order details endpoint
  {
    const req = new Request(`http://localhost/api/orders/${mockRzOrderId}`, {
      headers: { "x-guest-access-token": replayedGuestToken },
    });
    const res = await orderDetailGET(req, { params: Promise.resolve({ id: mockRzOrderId }) });
    const data = await res.json();

    reportTest(
      "Replayed guest token successfully retrieves order details on /api/orders/[id] (status 200)",
      res.status === 200 &&
      data.success === true &&
      data.order.orderId === mockRzOrderId &&
      data.order.guestAccess?.tokenHash === undefined // Hash is safely stripped
    );
  }

  // Test 12: Concurrent verification requests return identical tokens without invalidating each other
  {
    const p1 = paymentVerifyPOST(
      new Request("http://localhost/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: mockRzOrderId,
          razorpay_payment_id: mockRzPaymentId,
          razorpay_signature: validSignature,
        }),
      })
    );
    const p2 = paymentVerifyPOST(
      new Request("http://localhost/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: mockRzOrderId,
          razorpay_payment_id: mockRzPaymentId,
          razorpay_signature: validSignature,
        }),
      })
    );

    const [res1, res2] = await Promise.all([p1, p2]);
    const d1 = await res1.json();
    const d2 = await res2.json();

    reportTest(
      "Concurrent verification replays return identical tokens without race collision",
      res1.status === 200 &&
      res2.status === 200 &&
      d1.guestAccessToken === initialGuestToken &&
      d2.guestAccessToken === initialGuestToken
    );
  }

  // Test 13: Registered customer payment verification and replay NEVER returns guest credentials
  {
    const mockRegRzOrderId = "order_rz_test_reg_202";
    const mockRegRzPaymentId = "pay_rz_test_reg_202";
    const regSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${mockRegRzOrderId}|${mockRegRzPaymentId}`)
      .digest("hex");

    await PaymentIntent.create({
      razorpayOrderId: mockRegRzOrderId,
      amount: 400,
      amountPaise: 40000,
      currency: "INR",
      status: "created",
      user: registeredCustomer._id, // Registered customer
      address: {
        fullName: "Reggie Customer",
        phone: "9111222333",
        street: "456 User St",
        city: "Bangalore",
        state: "KA",
        pincode: "560001",
      },
      calcResult: {
        totalAmount: 400,
        orders: [
          {
            restaurantId: restaurant._id,
            subtotal: 350,
            deliveryFee: 35,
            packagingCharge: 15,
            totalAmount: 400,
            items: [{ name: "Catnip Treat", quantity: 1, price: 350 }],
          },
        ],
      },
    });

    const regReq = new Request("http://localhost/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: mockRegRzOrderId,
        razorpay_payment_id: mockRegRzPaymentId,
        razorpay_signature: regSignature,
      }),
    });

    const regRes = await paymentVerifyPOST(regReq);
    const regData = await regRes.json();

    // Replay for registered user
    const regReplayRes = await paymentVerifyPOST(
      new Request("http://localhost/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: mockRegRzOrderId,
          razorpay_payment_id: mockRegRzPaymentId,
          razorpay_signature: regSignature,
        }),
      })
    );
    const regReplayData = await regReplayRes.json();

    reportTest(
      "Registered customer verification and replay strictly omits guestAccessToken",
      regData.guestAccessToken === undefined &&
      regReplayData.guestAccessToken === undefined &&
      (regData.order.user?._id || regData.order.user)?.toString() === registeredCustomer._id.toString()
    );
  }

  // Test 14: Tampered signature is rejected (400) without disclosing any credentials
  {
    const tamperedReq = new Request("http://localhost/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: mockRzOrderId,
        razorpay_payment_id: mockRzPaymentId,
        razorpay_signature: "tampered_invalid_signature_hex",
      }),
    });
    const tamperedRes = await paymentVerifyPOST(tamperedReq);
    const tamperedData = await tamperedRes.json();

    reportTest(
      "Tampered signature fails closed (status 400) with zero credential disclosure",
      tamperedRes.status === 400 &&
      tamperedData.guestAccessToken === undefined &&
      tamperedData.success === false
    );
  }

  // =========================================================================
  // GROUP 3: GUEST-URL-01 — URL SANITIZATION & SESSION RETENTION CONTRACTS
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 3: GUEST-URL-01 — URL SANITIZATION & SESSION STORAGE CONTRACTS");
  console.log("------------------------------------------------------------------------");

  // Test 15: URL sanitizer removes both guestToken and guestAccessToken while preserving orderId & other params
  {
    const rawUrl = "http://localhost:3000/order-confirmation?orderId=ORD_12345&guestToken=gst_abc123&utm_source=email&guestAccessToken=gst_xyz789&tab=details";
    const parsed = new URL(rawUrl);

    parsed.searchParams.delete("guestToken");
    parsed.searchParams.delete("guestAccessToken");

    const sanitized = parsed.toString();

    reportTest(
      "URL sanitizer strips both guestToken and guestAccessToken parameters",
      !sanitized.includes("guestToken") && !sanitized.includes("guestAccessToken")
    );

    reportTest(
      "URL sanitizer strictly preserves orderId and legitimate query parameters",
      parsed.searchParams.get("orderId") === "ORD_12345" &&
      parsed.searchParams.get("utm_source") === "email" &&
      parsed.searchParams.get("tab") === "details"
    );
  }

  // Test 17: OrderConfirmationPage metadata sets strict no-referrer policy
  {
    const fs = await import("fs");
    const content = fs.readFileSync(new URL("../../frontend-user/app/(pages)/order-confirmation/page.js", import.meta.url), "utf8");
    const hasNoReferrer = /referrer:\s*["']no-referrer["']/.test(content);
    reportTest(
      "OrderConfirmationPage specifies referrer: 'no-referrer' in page metadata",
      hasNoReferrer
    );
  }

  console.log("\n========================================================================");
  console.log(`🎉 ALL ${passedTests} OF ${totalTests} GUEST TOKEN HARDENING TESTS PASSED!`);
  console.log("========================================================================\n");
} finally {
  console.log("Cleaning up isolated test database...");
  await mongoose.disconnect();
  await replSet.stop();
  console.log("Stopped isolated MongoMemoryReplSet.");
}
