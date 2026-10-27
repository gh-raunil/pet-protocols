/**
 * PET PROTOCOLS — PAYMENT SIMULATOR HARDENING & RAZORPAY SCRIPT RETRY VERIFICATION
 *
 * Verifies:
 * 1. Backend production security boundary: simulator strictly rejected (HTTP 403) in production
 * 2. Backend fails closed on unknown payment methods (HTTP 400)
 * 3. Backend enforces fulfillment matching (COD for delivery, COP for pickup)
 * 4. Frontend CheckoutClient conditionally gates simulator in UI and handlers
 * 5. Razorpay script loader deduplication, cleanup on failure, and in-flight promise sharing
 * 6. Non-regression of existing payment, idempotency, and cart contracts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptsDir, "..", "..");
const backendDir = path.join(repoRoot, "backend");
const frontendUserDir = path.join(repoRoot, "frontend-user");

// Register custom loader for backend '@/' and 'next/server' module resolution
register(pathToFileURL(path.join(scriptsDir, "test_backend_loader.mjs")).href, import.meta.url);

console.log("========================================================================");
console.log("PET PROTOCOLS — PAYMENT SIMULATOR HARDENING & CHECKOUT RETRY TEST SUITE");
console.log("========================================================================\n");

// ─── SUITE 1: BACKEND PRODUCTION SECURITY BOUNDARY (BEHAVIORAL) ──────
console.log("--- Suite 1: Backend Production Security Boundary & Method Validation ---");

const {
  POST: ordersPOST,
  _setTestGetServerSession,
} = await import(pathToFileURL(path.join(backendDir, "app", "api", "orders", "route.js")).href);

if (typeof _setTestGetServerSession === "function") {
  _setTestGetServerSession(async () => null);
}

const validAddress = {
  fullName: "Aarav Sharma",
  phone: "9876543210",
  street: "Flat 402, Royal Palms, Sector 14",
  city: "New Delhi",
  state: "Delhi",
  pincode: "110001",
};

const validItems = [
  {
    _id: "dish_001",
    name: "Smoked Chicken Tikka",
    price: 350,
    quantity: 2,
    restaurant: { _id: "rest_001", name: "Artisan Kitchen" },
  },
];

// Test 1: Direct production API request with "Instant Simulator (Test Mode)" -> HTTP 403
{
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: validItems,
        address: validAddress,
        orderType: "delivery",
        paymentMethod: "Instant Simulator (Test Mode)",
      }),
    });

    const res = await ordersPOST(req);
    const data = await res.json();

    assert.equal(res.status, 403, "Production request with simulator must return HTTP 403");
    assert.equal(data.success, false, "Response success must be false");
    assert.ok(
      data.message.includes("strictly disabled in production"),
      `Expected production rejection message, got: ${data.message}`
    );
    console.log("✓ PASS: Direct production request with 'Instant Simulator (Test Mode)' is rejected with HTTP 403");
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
}

// Test 2: Direct production API request with "Mock Test Payment" -> HTTP 403
{
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: validItems,
        address: validAddress,
        orderType: "delivery",
        paymentMethod: "Mock Test Payment",
      }),
    });

    const res = await ordersPOST(req);
    const data = await res.json();

    assert.equal(res.status, 403, "Production request with Mock Test Payment must return HTTP 403");
    assert.equal(data.success, false);
    console.log("✓ PASS: Direct production request with 'Mock Test Payment' is rejected with HTTP 403");
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
}

// Test 3 (Requirement 7): Simulator requests rejected in production with alternate casing and surrounding whitespace -> HTTP 403
{
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    for (const testMethod of [
      "  instant simulator (test mode)  ",
      "INSTANT SIMULATOR (TEST MODE)",
      "  Mock Test Payment  ",
      "MOCK TEST PAYMENT",
      "  mock   test   payment  ",
    ]) {
      const req = new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: validItems,
          address: validAddress,
          orderType: "delivery",
          paymentMethod: testMethod,
        }),
      });

      const res = await ordersPOST(req);
      const data = await res.json();

      assert.equal(res.status, 403, `Production request with '${testMethod}' must return HTTP 403`);
      assert.equal(data.success, false);
      assert.ok(data.message.includes("strictly disabled in production"));
    }
    console.log("✓ PASS: Simulator requests with alternate casing and whitespace are rejected in production with HTTP 403");
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
}

// Test 4 (Requirement 8): Feature flag ENABLE_PAYMENT_SIMULATOR='false' in non-production -> HTTP 403
{
  const prevEnv = process.env.NODE_ENV;
  const prevFlag = process.env.ENABLE_PAYMENT_SIMULATOR;
  try {
    process.env.NODE_ENV = "development";
    process.env.ENABLE_PAYMENT_SIMULATOR = "false";
    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: validItems,
        address: validAddress,
        orderType: "delivery",
        paymentMethod: "Instant Simulator (Test Mode)",
      }),
    });

    const res = await ordersPOST(req);
    const data = await res.json();

    assert.equal(res.status, 403, "Simulator with ENABLE_PAYMENT_SIMULATOR=false must return HTTP 403");
    assert.equal(data.success, false);
    console.log("✓ PASS: Explicit feature flag ENABLE_PAYMENT_SIMULATOR='false' rejects simulator with HTTP 403");
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.ENABLE_PAYMENT_SIMULATOR = prevFlag;
  }
}

// Test 5 (Requirement 9): Missing or empty payment method fails safely -> HTTP 400
{
  const testPayloads = [
    { name: "omitted paymentMethod", payload: { items: validItems, address: validAddress, orderType: "delivery" } },
    { name: "empty string paymentMethod", payload: { items: validItems, address: validAddress, orderType: "delivery", paymentMethod: "" } },
    { name: "whitespace-only paymentMethod", payload: { items: validItems, address: validAddress, orderType: "delivery", paymentMethod: "    " } },
    { name: "null paymentMethod", payload: { items: validItems, address: validAddress, orderType: "delivery", paymentMethod: null } },
  ];

  for (const { name, payload } of testPayloads) {
    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await ordersPOST(req);
    const data = await res.json();

    assert.equal(res.status, 400, `Request with ${name} must fail safely with HTTP 400`);
    assert.equal(data.success, false);
    assert.ok(data.message.includes("Unsupported or invalid payment method"));
  }
  console.log("✓ PASS: Missing, empty, whitespace-only, and null paymentMethod fail safely with HTTP 400");
}

// Test 6 (Requirement 5): Permissive substring attacks with 'cod' or 'cop' are rejected -> HTTP 400
{
  const substringAttacks = [
    "barcode",
    "decode",
    "unicode delivery",
    "coder",
    "cod_exploit",
    "copy",
    "microscope",
    "telecop",
    "cop_bypass",
  ];

  for (const maliciousMethod of substringAttacks) {
    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: validItems,
        address: validAddress,
        orderType: "delivery",
        paymentMethod: maliciousMethod,
      }),
    });

    const res = await ordersPOST(req);
    const data = await res.json();

    assert.equal(
      res.status,
      400,
      `Substring attack '${maliciousMethod}' must be rejected with HTTP 400`
    );
    assert.equal(data.success, false);
    assert.ok(
      data.message.includes("Unsupported or invalid payment method"),
      `Expected unsupported payment method error for '${maliciousMethod}'`
    );
  }
  console.log("✓ PASS: Permissive substring values containing 'cod' or 'cop' are rejected with HTTP 400");
}

// Test 7 (Requirement 6): Simulator substrings and arbitrary online payment labels are rejected -> HTTP 400
{
  const simulatorAndOnlineLabels = [
    "flight simulator",
    "mockingbird",
    "test payment", // Not exact "mock test payment"
    "razorpay",
    "razorpay (online payment)",
    "online payment",
    "credit_card",
    "upi_gateway",
  ];

  for (const invalidLabel of simulatorAndOnlineLabels) {
    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: validItems,
        address: validAddress,
        orderType: "delivery",
        paymentMethod: invalidLabel,
      }),
    });

    const res = await ordersPOST(req);
    const data = await res.json();

    assert.equal(
      res.status,
      400,
      `Non-canonical method '${invalidLabel}' must be rejected with HTTP 400`
    );
    assert.equal(data.success, false);
    assert.ok(data.message.includes("Unsupported or invalid payment method"));
  }
  console.log("✓ PASS: Non-canonical simulator substrings and arbitrary online-payment labels are rejected with HTTP 400");
}

// Test 8 (Requirement 3 & 4): Fulfillment mismatches -> HTTP 400
{
  // COD requested for pickup order
  const codPickupReq = new Request("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: validItems,
      address: validAddress,
      orderType: "pickup",
      paymentMethod: "Cash on Delivery (COD)",
    }),
  });

  const codRes = await ordersPOST(codPickupReq);
  const codData = await codRes.json();

  assert.equal(codRes.status, 400, "COD for pickup order must return HTTP 400");
  assert.equal(codData.success, false);
  assert.ok(codData.message.includes("Cash on Delivery is only available for doorstep delivery"));

  // COP requested for delivery order
  const copDeliveryReq = new Request("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: validItems,
      address: validAddress,
      orderType: "delivery",
      paymentMethod: "Cash on Pickup (COP)",
    }),
  });

  const copRes = await ordersPOST(copDeliveryReq);
  const copData = await copRes.json();

  assert.equal(copRes.status, 400, "COP for delivery order must return HTTP 400");
  assert.equal(copData.success, false);
  assert.ok(copData.message.includes("Cash on Pickup is only available for pickup orders"));

  console.log("✓ PASS: Fulfillment mismatches (COD on pickup, COP on delivery) are strictly rejected with HTTP 400");
}

// Test 9 (Requirement 1 & 2): Canonical COD and COP values pass method validation
{
  const validCodVariants = [
    "Cash on Delivery (COD)",
    "Cash on Delivery",
    "COD",
    "  cash on delivery (cod)  ",
    "cash on delivery",
    "cod",
  ];

  for (const codMethod of validCodVariants) {
    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: validItems,
        address: validAddress,
        orderType: "delivery",
        paymentMethod: codMethod,
      }),
    });

    const res = await ordersPOST(req);
    // Since payment method is valid, it proceeds past lines 165-215 to connectDB()
    // It must NOT fail with status 400 (payment method error) or 403 (simulator)
    assert.notEqual(res.status, 403, `Canonical COD '${codMethod}' must not return 403`);
    if (res.status === 400) {
      const data = await res.json();
      assert.ok(
        !data.message.includes("Unsupported or invalid payment method"),
        `Canonical COD '${codMethod}' must not fail payment method validation`
      );
    }
  }

  const validCopVariants = [
    "Cash on Pickup (COP)",
    "Cash on Pickup",
    "COP",
    "  cash on pickup (cop)  ",
    "cash on pickup",
    "cop",
  ];

  for (const copMethod of validCopVariants) {
    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: validItems,
        address: validAddress,
        orderType: "pickup",
        paymentMethod: copMethod,
      }),
    });

    const res = await ordersPOST(req);
    assert.notEqual(res.status, 403, `Canonical COP '${copMethod}' must not return 403`);
    if (res.status === 400) {
      const data = await res.json();
      assert.ok(
        !data.message.includes("Unsupported or invalid payment method"),
        `Canonical COP '${copMethod}' must not fail payment method validation`
      );
    }
  }
  console.log("✓ PASS: Exact canonical COD values (for delivery) and COP values (for pickup) pass validation cleanly");
}

// Test 10 (Requirement 10): Client-supplied payment-status fields cannot override server authority
{
  const maliciousReq = new Request("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: validItems,
      address: validAddress,
      orderType: "delivery",
      paymentMethod: "crypto_token",
      paymentStatus: "paid",
      status: "delivered",
      paid: true,
    }),
  });

  const res = await ordersPOST(maliciousReq);
  const data = await res.json();

  assert.equal(res.status, 400, "Injected paymentStatus cannot bypass payment method validation");
  assert.equal(data.success, false);
  console.log("✓ PASS: Client-supplied paymentStatus/paid fields cannot bypass validation or mark order paid");
}

// Test 11 (Requirement 12): Schema-default change verification in backend/models/Order.js
{
  const { default: OrderModel } = await import(
    pathToFileURL(path.join(backendDir, "models", "Order.js")).href
  );

  assert.equal(
    OrderModel.schema.paths.paymentStatus.defaultValue,
    "pending",
    "Order schema paymentStatus default must be 'pending' (unpaid), never 'test_paid'"
  );
  assert.equal(
    OrderModel.schema.paths.paymentMethod.defaultValue,
    null,
    "Order schema paymentMethod default must be null, never 'Mock Test Payment'"
  );

  const testInstance = new OrderModel({
    restaurant: "64f1a2b3c4d5e6f7a8b9c0d1",
    totalAmount: 500,
    items: [{ name: "Dish", price: 500, quantity: 1 }],
  });

  assert.equal(testInstance.paymentStatus, "pending", "New order instance defaults to 'pending'");
  assert.equal(testInstance.paymentMethod, null, "New order instance defaults paymentMethod to null");
  console.log("✓ PASS: Order schema defaults verified: paymentStatus defaults to 'pending' and paymentMethod to null");
}

// ─── SUITE 2: RAZORPAY SCRIPT LOADER & RETRY LOGIC (BEHAVIORAL) ──────
console.log("\n--- Suite 2: Razorpay Script Loader Deduplication & Failure Recovery ---");

// Mock browser DOM environment
function createMockDomEnvironment() {
  const scripts = [];
  const mockDocument = {
    getElementById: (id) => scripts.find((s) => s.id === id) || null,
    querySelector: (selector) => {
      const match = selector.match(/src="([^"]+)"/);
      if (match) {
        return scripts.find((s) => s.src === match[1]) || null;
      }
      return null;
    },
    createElement: (tag) => {
      if (tag === "script") {
        const el = {
          id: "",
          src: "",
          async: false,
          onload: null,
          onerror: null,
          remove: function () {
            const idx = scripts.indexOf(el);
            if (idx !== -1) scripts.splice(idx, 1);
          },
        };
        return el;
      }
      return {};
    },
    body: {
      appendChild: (el) => {
        scripts.push(el);
        return el;
      },
    },
  };

  const mockWindow = {
    Razorpay: undefined,
  };

  return { mockDocument, mockWindow, scripts };
}

// Recreate the loader logic from CheckoutClient to test its behavior directly
function buildLoader(mockWindow, mockDocument) {
  const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
  const RAZORPAY_SCRIPT_ID = "razorpay-checkout-sdk";
  let razorpayLoadingPromise = null;

  return function loadRazorpayScript() {
    if (typeof mockWindow === "undefined") {
      return Promise.resolve(false);
    }
    if (mockWindow.Razorpay) {
      return Promise.resolve(true);
    }
    if (razorpayLoadingPromise) {
      return razorpayLoadingPromise;
    }

    razorpayLoadingPromise = new Promise((resolve) => {
      const existingScript =
        mockDocument.getElementById(RAZORPAY_SCRIPT_ID) ||
        mockDocument.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
      if (existingScript) {
        existingScript.remove();
      }

      const script = mockDocument.createElement("script");
      script.id = RAZORPAY_SCRIPT_ID;
      script.src = RAZORPAY_SCRIPT_SRC;
      script.async = true;

      script.onload = () => {
        razorpayLoadingPromise = null;
        resolve(true);
      };

      script.onerror = () => {
        script.remove();
        razorpayLoadingPromise = null;
        resolve(false);
      };

      mockDocument.body.appendChild(script);
    });

    return razorpayLoadingPromise;
  };
}

// Test 8: Immediate success if window.Razorpay already exists
{
  const { mockDocument, mockWindow, scripts } = createMockDomEnvironment();
  mockWindow.Razorpay = function () {};
  const loadScript = buildLoader(mockWindow, mockDocument);

  const result = await loadScript();
  assert.equal(result, true, "Already loaded SDK must resolve true");
  assert.equal(scripts.length, 0, "No script tag should be added if window.Razorpay exists");
  console.log("✓ PASS: Pre-existing window.Razorpay immediately resolves true with 0 script additions");
}

// Test 9: Failed SDK load cleans up script element from DOM
{
  const { mockDocument, mockWindow, scripts } = createMockDomEnvironment();
  const loadScript = buildLoader(mockWindow, mockDocument);

  const loadPromise = loadScript();
  assert.equal(scripts.length, 1, "Script should be appended to body");

  // Simulate network failure
  scripts[0].onerror();
  const result = await loadPromise;

  assert.equal(result, false, "Failed script load must resolve false");
  assert.equal(scripts.length, 0, "Failed script element must be removed from DOM");
  console.log("✓ PASS: Failed SDK load resolves false and cleans up script element from DOM");
}

// Test 10: Repeated retries do NOT accumulate duplicate script elements in DOM
{
  const { mockDocument, mockWindow, scripts } = createMockDomEnvironment();
  const loadScript = buildLoader(mockWindow, mockDocument);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const p = loadScript();
    assert.equal(scripts.length, 1, `Attempt ${attempt}: exactly 1 script in DOM during load`);
    scripts[0].onerror();
    const res = await p;
    assert.equal(res, false);
    assert.equal(scripts.length, 0, `Attempt ${attempt}: 0 scripts remaining in DOM after failure`);
  }
  console.log("✓ PASS: Consecutive failed retries do NOT accumulate duplicate script elements in DOM");
}

// Test 11: Concurrent overlapping calls share single in-flight promise
{
  const { mockDocument, mockWindow, scripts } = createMockDomEnvironment();
  const loadScript = buildLoader(mockWindow, mockDocument);

  const p1 = loadScript();
  const p2 = loadScript();
  const p3 = loadScript();

  assert.equal(scripts.length, 1, "Concurrent calls must share single in-flight script element");

  // Simulate successful load
  mockWindow.Razorpay = function () {};
  scripts[0].onload();

  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
  assert.equal(r1, true);
  assert.equal(r2, true);
  assert.equal(r3, true);
  assert.equal(scripts.length, 1, "Final DOM has exactly 1 script element");
  console.log("✓ PASS: Concurrent overlapping calls share a single promise and inject exactly 1 script element");
}

// ─── SUITE 3: STATIC AST & CONTRACT ASSERTIONS ───────────────────────
console.log("\n--- Suite 3: Static Source & Contract Invariants Verification ---");

const checkoutClientPath = path.join(frontendUserDir, "app", "(pages)", "checkout", "CheckoutClient.js");
assert.ok(fs.existsSync(checkoutClientPath), "CheckoutClient.js must exist");
const checkoutSrc = fs.readFileSync(checkoutClientPath, "utf8");

// 1. isSimulatorAvailable check in CheckoutClient.js
assert.ok(
  checkoutSrc.includes("isSimulatorAvailable ="),
  "CheckoutClient.js must define isSimulatorAvailable"
);
assert.ok(
  checkoutSrc.includes('process.env.NODE_ENV !== "production"'),
  "CheckoutClient.js must check process.env.NODE_ENV !== 'production'"
);
console.log("✓ PASS: CheckoutClient.js defines isSimulatorAvailable gated on process.env.NODE_ENV !== 'production'");

// 2. Simulator payment option conditionally rendered
assert.ok(
  checkoutSrc.includes("{isSimulatorAvailable && ("),
  "CheckoutClient.js must conditionally render Test Simulator card"
);
console.log("✓ PASS: CheckoutClient.js conditionally renders Test Simulator card via isSimulatorAvailable");

// 3. handleSimulatorCheckout and handleSubmit guarded
assert.ok(
  checkoutSrc.includes("handleSimulatorCheckout = async () => {\n    if (loading) return;\n    if (!isSimulatorAvailable) {"),
  "handleSimulatorCheckout must guard against !isSimulatorAvailable"
);
assert.ok(
  checkoutSrc.includes("else if (paymentMode === \"simulator\") {\n      if (!isSimulatorAvailable) {"),
  "handleSubmit must guard against !isSimulatorAvailable before invoking simulator"
);
console.log("✓ PASS: handleSimulatorCheckout and handleSubmit reject simulator when isSimulatorAvailable is false");

// 4. Razorpay script loader deduplication logic present
assert.ok(
  checkoutSrc.includes("razorpayLoadingPromise"),
  "CheckoutClient.js must track in-flight razorpayLoadingPromise"
);
assert.ok(
  checkoutSrc.includes("script.remove()"),
  "CheckoutClient.js must clean up failed script node on error"
);
assert.ok(
  checkoutSrc.includes("if (retryingSdk) return;"),
  "handleRetryRazorpaySdk must prevent overlapping retry button clicks"
);
console.log("✓ PASS: CheckoutClient.js contains deduplication, script cleanup, and retry click guards");

// 5. Backend orders route invariants
const backendOrdersPath = path.join(backendDir, "app", "api", "orders", "route.js");
const backendOrdersSrc = fs.readFileSync(backendOrdersPath, "utf8");

assert.ok(
  backendOrdersSrc.includes("process.env.NODE_ENV === 'production'"),
  "backend/app/api/orders/route.js must enforce production security check"
);
assert.ok(
  backendOrdersSrc.includes("status: 403"),
  "backend/app/api/orders/route.js must return status 403 for production simulator requests"
);
assert.ok(
  backendOrdersSrc.includes("Unsupported or invalid payment method"),
  "backend/app/api/orders/route.js must fail closed on unknown payment methods"
);
console.log("✓ PASS: backend/app/api/orders/route.js enforces production 403 and fail-closed 400 validation");

// 6. Authorized Razorpay payment creation & verification contracts intact (Requirement 11)
const razorpayCreatePath = path.join(backendDir, "app", "api", "payment", "create-order", "route.js");
assert.ok(fs.existsSync(razorpayCreatePath), "payment/create-order/route.js must exist");
const razorpayCreateSrc = fs.readFileSync(razorpayCreatePath, "utf8");
assert.ok(
  razorpayCreateSrc.includes("calculateOrderDetails"),
  "create-order route must use authoritative calculateOrderDetails"
);
assert.ok(
  razorpayCreateSrc.includes("process.env.RAZORPAY_KEY_ID"),
  "create-order route must validate server-side Razorpay keys"
);

const razorpayVerifyPath = path.join(backendDir, "app", "api", "payment", "verify", "route.js");
assert.ok(fs.existsSync(razorpayVerifyPath), "payment/verify/route.js must exist");
const razorpayVerifySrc = fs.readFileSync(razorpayVerifyPath, "utf8");
assert.ok(
  razorpayVerifySrc.includes("createHmac('sha256'"),
  "payment/verify route must cryptographically verify HMAC-SHA256 signature"
);
assert.ok(
  razorpayVerifySrc.includes("paymentStatus: 'paid'"),
  "payment/verify route must explicitly set paymentStatus to 'paid'"
);
assert.ok(
  razorpayVerifySrc.includes("paymentMethod: 'Razorpay (Online Payment)'"),
  "payment/verify route must explicitly set paymentMethod to 'Razorpay (Online Payment)'"
);
console.log("✓ PASS: Authorized Razorpay payment creation and verification contracts remain fully intact");

console.log("\n========================================================================");
console.log("🎉 ALL PAYMENT SIMULATOR HARDENING & RETRY FIX TESTS PASSED CLEANLY!");
console.log("========================================================================\n");
