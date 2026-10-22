import { register } from "node:module";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import assert from "node:assert/strict";
import crypto from "crypto";

register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);

dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("========================================================================");
console.log("PET PROTOCOLS — SECURE DELIVERY OTP & HANDOVER VERIFICATION TEST SUITE");
console.log("REC-06: STRICTLY ISOLATED IN-MEMORY DATABASE TEST HARNESS");
console.log("========================================================================\n");

// REC-06: Start isolated MongoMemoryReplSet (zero access to live database)
console.log("Starting isolated MongoMemoryReplSet...");
const { MongoMemoryReplSet } = await import("mongodb-memory-server");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const localUri = replSet.getUri("test_delivery_otp_isolated");
assert.ok(
  localUri.includes("127.0.0.1") || localUri.includes("localhost"),
  "Security Invariant: Must use isolated loopback MongoDB URI"
);

// Explicitly set environment to isolated test database and canonical 32-byte secret
process.env.MONGODB_URI = localUri;
process.env.TEST_MONGODB_URI = localUri;
process.env.DELIVERY_OTP_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

await mongoose.connect(localUri);
console.log(`Connected to isolated database: ${localUri}\n`);

// Import models
const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;

// Import OTP service
const {
  generateSecureOtpCode,
  computeOtpDigest,
  verifyOtpDigest,
  encryptOtpCode,
  decryptOtpCode,
  issueDeliveryOtpForOrder,
  verifyAndCompleteDelivery,
  getDeliveryOtpSecret,
  _setTestNotifyOrderEvent,
  _setTestPreAtomicCommitHook,
} = await import("../lib/deliveryOtpService.js");

// Import API routes and auth mocks
const {
  GET: customerHandoverOtpGET,
  POST: customerHandoverOtpPOST,
  _setTestGetServerSession: setHandoverOtpSession,
} = await import("../app/api/orders/[id]/handover-otp/route.js");

const {
  POST: driverVerifyHandoverPOST,
  _setTestRequireRestaurantAdmin: setDriverVerifyAuth,
} = await import("../app/api/restaurant/orders/[id]/verify-handover/route.js");

const {
  PUT: restaurantOrdersPUT,
  _setTestRequireRestaurantAdmin: setRestaurantOrdersAuth,
} = await import("../app/api/restaurant/orders/route.js");

const {
  GET: customerTrackingGET,
  _setTestGetServerSession: setTrackingSession,
} = await import("../app/api/orders/[id]/tracking/route.js");

const {
  PATCH: superadminOrdersPATCH,
  _setTestRequireSuperAdmin: setSuperAdminAuth,
} = await import("../app/api/superadmin/orders/route.js");

// Setup fixtures
const restA = await Restaurant.create({
  name: "OTP Test Kitchen A",
  slug: "otp-test-kitchen-a",
  phone: "9876543111",
  address: { street: "101 OTP Ave", city: "Bangalore", state: "KA", pincode: "560001", latitude: 12.9716, longitude: 77.5946 },
  enabledFeatures: ["delivery", "pickup"],
});

const restB = await Restaurant.create({
  name: "OTP Test Kitchen B",
  slug: "otp-test-kitchen-b",
  phone: "9876543222",
  address: { street: "202 OTP Blvd", city: "Bangalore", state: "KA", pincode: "560002", latitude: 12.9800, longitude: 77.6000 },
  enabledFeatures: ["delivery", "pickup"],
});

const customerA = await User.create({
  name: "Customer A",
  email: "customer_a@otp-test.com",
  role: "customer",
  phone: "9100001111",
});

const customerB = await User.create({
  name: "Customer B",
  email: "customer_b@otp-test.com",
  role: "customer",
  phone: "9100002222",
});

const driverA = await User.create({
  name: "Driver Alpha",
  email: "driver_a@otp-test.com",
  role: "staff",
  staffRoles: ["Delivery"],
  permissions: ["orders_view", "orders_update", "orders_manage"],
  restaurant: restA._id,
  phone: "9100003333",
  status: "active",
});

const driverB = await User.create({
  name: "Driver Beta",
  email: "driver_b@otp-test.com",
  role: "staff",
  staffRoles: ["Delivery"],
  permissions: ["orders_view", "orders_update", "orders_manage"],
  restaurant: restA._id,
  phone: "9100004444",
  status: "active",
});

const driverOtherBranch = await User.create({
  name: "Driver Branch B",
  email: "driver_branch_b@otp-test.com",
  role: "staff",
  staffRoles: ["Delivery"],
  permissions: ["orders_view", "orders_update", "orders_manage"],
  restaurant: restB._id,
  phone: "9100005555",
  status: "active",
});

const cashierA = await User.create({
  name: "Cashier Alpha",
  email: "cashier_a@otp-test.com",
  role: "staff",
  staffRoles: ["Cashier"],
  permissions: ["orders_view", "orders_update"],
  restaurant: restA._id,
  phone: "9100006666",
  status: "active",
});

const managerA = await User.create({
  name: "Manager Alpha",
  email: "manager_a@otp-test.com",
  role: "restaurant_admin",
  restaurant: restA._id,
  phone: "9100007777",
});

const superAdminUser = await User.create({
  name: "Super Admin",
  email: "superadmin.petprotocols@gmail.com",
  role: "superadmin",
  phone: "9100008888",
});

function mockStaffAuth(user, restaurant) {
  return {
    user,
    restaurant,
    restaurantId: restaurant._id.toString(),
    isAdmin: user.role === "restaurant_admin" || user.role === "superadmin",
    isStaff: user.role === "staff",
    staffRoles: user.staffRoles || [user.role],
    permissions: user.permissions || ["orders_view", "orders_update", "orders_manage"],
  };
}

let testCount = 0;
let passCount = 0;
function reportTest(title, passed, extra = "") {
  testCount++;
  if (passed) {
    passCount++;
    console.log(`  ✓ Test ${testCount}: ${title}`);
  } else {
    console.error(`  ✗ Test ${testCount} FAILED: ${title}`);
    if (extra) console.error(`      ${extra}`);
    throw new Error(`Test ${testCount} failed: ${title}`);
  }
}

async function createTestOrder(overrides = {}) {
  const count = (await Order.countDocuments()) + 1;
  const isPickup = overrides.orderType === "pickup";
  const defaults = {
    orderId: `TEST-OTP-${String(count).padStart(4, "0")}`,
    user: customerA._id,
    restaurant: restA._id,
    items: [{ product: new mongoose.Types.ObjectId(), name: "OTP Meal", price: 300, quantity: 1, total: 300 }],
    totalAmount: 300,
    status: "out_for_delivery",
    paymentMethod: "cod",
    paymentStatus: "pending",
    orderType: isPickup ? "pickup" : "delivery",
    address: isPickup
      ? { addressType: "pickup" }
      : { fullName: "Customer A", phone: "9100001111", street: "101 Main St", city: "Bangalore", latitude: 12.9716, longitude: 77.5946 },
    assignedDeliveryStaff: { id: driverA._id, name: driverA.name, phone: driverA.phone },
    deliveryTracking: { isLive: true, startedAt: new Date() },
  };
  return await Order.create({ ...defaults, ...overrides });
}

try {
  // =========================================================================
  // GROUP 1: CRYPTOGRAPHIC SECRETS, HKDF KEY DERIVATION & AES-GCM CONTEXT BINDING (F1)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 1: CRYPTOGRAPHIC SECRETS, HKDF DERIVATION & AAD CONTEXT BINDING (F1)");
  console.log("------------------------------------------------------------------------");

  // Test 1: Code generation contract: 4-digit numeric string preserving leading zeros
  {
    const codes = Array.from({ length: 50 }, () => generateSecureOtpCode());
    const allFourDigits = codes.every((c) => typeof c === "string" && /^\d{4}$/.test(c));
    reportTest("generateSecureOtpCode generates 4-digit strings matching /^\\d{4}$/", allFourDigits);
  }

  // Test 2: Keyed HMAC-SHA-256 digest binds orderId, issuanceId, and code
  {
    const orderId = new mongoose.Types.ObjectId();
    const issuanceId = crypto.randomUUID();
    const digest1 = computeOtpDigest(orderId, issuanceId, "0420");
    const digest2 = computeOtpDigest(orderId, issuanceId, "0420");
    const digestWrongCode = computeOtpDigest(orderId, issuanceId, "0421");
    const digestWrongOrder = computeOtpDigest(new mongoose.Types.ObjectId(), issuanceId, "0420");

    reportTest(
      "HMAC-SHA-256 digest is deterministic and strictly bound to orderId, issuanceId, and code",
      digest1 === digest2 && digest1 !== digestWrongCode && digest1 !== digestWrongOrder && digest1.length === 64
    );
  }

  // Test 3: Constant-time comparison rejects tampered or mismatched codes
  {
    const orderId = new mongoose.Types.ObjectId();
    const issuanceId = crypto.randomUUID();
    const digest = computeOtpDigest(orderId, issuanceId, "0007");

    const matchValid = verifyOtpDigest(orderId, issuanceId, "0007", digest);
    const matchInvalid = verifyOtpDigest(orderId, issuanceId, "0008", digest);
    const matchFormat = verifyOtpDigest(orderId, issuanceId, "7", digest);

    reportTest(
      "verifyOtpDigest performs constant-time validation matching valid code and rejecting invalid",
      matchValid === true && matchInvalid === false && matchFormat === false
    );
  }

  // Test 4: AES-256-GCM authenticated encryption at rest with AAD binding to orderId and issuanceId
  {
    const orderId = new mongoose.Types.ObjectId();
    const issuanceId = crypto.randomUUID();
    const code = "0123";
    const encrypted = encryptOtpCode(code, { orderId, issuanceId });
    const decrypted = decryptOtpCode(encrypted, { orderId, issuanceId });

    reportTest(
      "AES-256-GCM encrypts with v1 AAD binding and decrypts accurately with valid context",
      encrypted.startsWith("v1:") && !encrypted.includes("0123") && decrypted === "0123"
    );
  }

  // Test 5: AES-256-GCM fails closed when tampered or transplanted to another order/issuance
  {
    const orderId = new mongoose.Types.ObjectId();
    const issuanceId = crypto.randomUUID();
    const otherOrder = new mongoose.Types.ObjectId();
    const code = "9876";
    const encrypted = encryptOtpCode(code, { orderId, issuanceId });

    const decWrongOrder = decryptOtpCode(encrypted, { orderId: otherOrder, issuanceId });
    const decWrongIssuance = decryptOtpCode(encrypted, { orderId, issuanceId: crypto.randomUUID() });
    const decTampered = decryptOtpCode(encrypted.slice(0, -2) + "aa", { orderId, issuanceId });

    reportTest(
      "AES-256-GCM fails closed (returns null) if orderId, issuanceId, or ciphertext is altered",
      decWrongOrder === null && decWrongIssuance === null && decTampered === null
    );
  }

  // Test 6: Legacy 3-part ciphertext (without AAD) remains decryptable for backward compatibility
  {
    const legacyEncrypted = encryptOtpCode("4321"); // no orderId/issuanceId passed -> 3 parts
    const decrypted = decryptOtpCode(legacyEncrypted);
    reportTest(
      "Legacy 3-part ciphertext remains decryptable ensuring backward compatibility",
      !legacyEncrypted.startsWith("v1:") && decrypted === "4321"
    );
  }

  // Test 7: Secret validation rejects non-hex, truncated, or malformed secrets
  {
    const origSecret = process.env.DELIVERY_OTP_SECRET;
    let shortFailed = false;
    let nonHexFailed = false;

    try {
      process.env.DELIVERY_OTP_SECRET = "not-64-hex";
      getDeliveryOtpSecret();
    } catch {
      shortFailed = true;
    }

    try {
      process.env.DELIVERY_OTP_SECRET = "g".repeat(64); // 64 chars but invalid hex 'g'
      getDeliveryOtpSecret();
    } catch {
      nonHexFailed = true;
    }

    process.env.DELIVERY_OTP_SECRET = origSecret;
    reportTest(
      "getDeliveryOtpSecret strictly validates 64-character hexadecimal format and throws on invalid",
      shortFailed && nonHexFailed
    );
  }

  // Test 8: Missing secret in strict environment fails closed
  {
    const origSecret = process.env.DELIVERY_OTP_SECRET;
    const origEnv = process.env.NODE_ENV;
    delete process.env.DELIVERY_OTP_SECRET;
    process.env.NODE_ENV = "production";

    let failedClosed = false;
    try {
      getDeliveryOtpSecret();
    } catch (err) {
      failedClosed = err.message.includes("Missing required DELIVERY_OTP_SECRET");
    }

    process.env.DELIVERY_OTP_SECRET = origSecret;
    process.env.NODE_ENV = origEnv;
    reportTest("Missing DELIVERY_OTP_SECRET in production strictly fails closed with security error", failedClosed);
  }

  // Test 9: Plaintext OTP is NEVER stored in Order document in MongoDB
  {
    const ord = await createTestOrder();
    const issueRes = await issueDeliveryOtpForOrder(ord);

    const rawDoc = await mongoose.connection.collection("orders").findOne({ _id: ord._id });
    const hasPlaintextOtp = JSON.stringify(rawDoc).includes(issueRes.otpCode);

    reportTest(
      "Plaintext OTP is NEVER stored anywhere in the MongoDB database collection",
      hasPlaintextOtp === false && Boolean(rawDoc.deliveryOtp?.codeDigest) && Boolean(rawDoc.deliveryOtp?.encryptedCode)
    );
  }

  // Test 10: Sensitive OTP fields (codeDigest, encryptedCode) are excluded from default serialization
  {
    const ord = await createTestOrder();
    await issueDeliveryOtpForOrder(ord);

    const normalFind = await Order.findById(ord._id).lean();
    const serializedJson = JSON.stringify(normalFind);

    reportTest(
      "Sensitive OTP fields are hidden by select: false in standard Mongoose queries",
      normalFind.deliveryOtp?.codeDigest === undefined &&
      normalFind.deliveryOtp?.encryptedCode === undefined &&
      !serializedJson.includes("codeDigest") &&
      !serializedJson.includes("encryptedCode")
    );
  }

  // Test 11: Public tracking endpoint strictly omits delivery OTP
  {
    const ord = await createTestOrder();
    await issueDeliveryOtpForOrder(ord);

    setTrackingSession(async () => ({ user: { role: "customer", email: customerA.email } }));
    const req = new Request(`http://localhost:3000/api/orders/${ord._id}/tracking`);
    const res = await customerTrackingGET(req, { params: { id: ord._id.toString() } });
    const trackingData = await res.json();
    const trackingStr = JSON.stringify(trackingData);

    reportTest(
      "Tracking endpoint strictly omits delivery OTP and internal verification metadata",
      trackingData.success === true &&
      trackingData.deliveryOtp === undefined &&
      trackingData.otpCode === undefined &&
      !trackingStr.includes("deliveryOtp")
    );
  }

  // =========================================================================
  // GROUP 2: CUSTOMER OWNERSHIP & REISSUE RATE LIMITS
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 2: CUSTOMER OWNERSHIP & REISSUE RATE LIMITS");
  console.log("------------------------------------------------------------------------");

  // Test 12: Authorized customer can retrieve active delivery handover OTP
  {
    const ord = await createTestOrder();
    setHandoverOtpSession(async () => ({ user: { role: "customer", email: customerA.email } }));
    const req = new Request(`http://localhost:3000/api/orders/${ord._id}/handover-otp`);
    const res = await customerHandoverOtpGET(req, { params: { id: ord._id.toString() } });
    const data = await res.json();

    reportTest(
      "Authorized customer can read active handover OTP (status 200, 4 digits)",
      res.status === 200 && data.success === true && /^\d{4}$/.test(data.otpCode)
    );
  }

  // Test 13: Another customer CANNOT access or retrieve the handover code (404/Isolated)
  {
    const ord = await createTestOrder();
    setHandoverOtpSession(async () => ({ user: { role: "customer", email: customerB.email } }));
    const req = new Request(`http://localhost:3000/api/orders/${ord._id}/handover-otp`);
    const res = await customerHandoverOtpGET(req, { params: { id: ord._id.toString() } });

    reportTest(
      "Unrelated customer is rejected from accessing another customer's handover OTP (404)",
      res.status === 404
    );
  }

  // Test 14: Unauthenticated request is rejected with 401
  {
    const ord = await createTestOrder();
    setHandoverOtpSession(async () => null);
    const req = new Request(`http://localhost:3000/api/orders/${ord._id}/handover-otp`);
    const res = await customerHandoverOtpGET(req, { params: { id: ord._id.toString() } });

    reportTest("Unauthenticated request to handover OTP endpoint is rejected (401)", res.status === 401);
  }

  // Test 15: Reissuing OTP invalidates prior code and enforces 30s cooldown
  {
    const ord = await createTestOrder();
    setHandoverOtpSession(async () => ({ user: { role: "customer", email: customerA.email } }));

    // Initial retrieval
    const reqInit = new Request(`http://localhost:3000/api/orders/${ord._id}/handover-otp`);
    const resInit = await customerHandoverOtpGET(reqInit, { params: { id: ord._id.toString() } });
    const dataInit = await resInit.json();
    const code1 = dataInit.otpCode;

    // Immediate reissue attempt within cooldown (should fail with 429)
    const reqReissue1 = new Request(`http://localhost:3000/api/orders/${ord._id}/handover-otp`, { method: "POST" });
    const resReissue1 = await customerHandoverOtpPOST(reqReissue1, { params: { id: ord._id.toString() } });

    // Manually advance lastIssuedAt backwards by 31 seconds in DB to simulate cooldown expiration
    await Order.updateOne(
      { _id: ord._id },
      { $set: { "deliveryOtp.lastIssuedAt": new Date(Date.now() - 35 * 1000) } }
    );

    // Reissue after cooldown
    const reqReissue2 = new Request(`http://localhost:3000/api/orders/${ord._id}/handover-otp`, { method: "POST" });
    const resReissue2 = await customerHandoverOtpPOST(reqReissue2, { params: { id: ord._id.toString() } });
    const dataReissue2 = await resReissue2.json();
    const code2 = dataReissue2.otpCode;

    reportTest(
      "Reissue rate limiting enforces 30s cooldown (429) and generates fresh code invalidating prior code",
      resReissue1.status === 429 && resReissue2.status === 200 && dataReissue2.success === true && code1 !== code2
    );
  }

  // Test 16: Cumulative max reissues limit (5) blocks excessive reissues (429)
  {
    const ord = await createTestOrder();
    await Order.updateOne(
      { _id: ord._id },
      {
        $set: {
          "deliveryOtp.status": "issued",
          "deliveryOtp.reissueCount": 5,
          "deliveryOtp.lastIssuedAt": new Date(Date.now() - 60 * 1000),
        },
      }
    );

    setHandoverOtpSession(async () => ({ user: { role: "customer", email: customerA.email } }));
    const req = new Request(`http://localhost:3000/api/orders/${ord._id}/handover-otp`, { method: "POST" });
    const res = await customerHandoverOtpPOST(req, { params: { id: ord._id.toString() } });

    reportTest(
      "Cumulative max reissues (5) permanently locks further reissuances with HTTP 429",
      res.status === 429
    );
  }

  // =========================================================================
  // GROUP 3: DRIVER AUTHORIZATION & TENANT CONTEXT
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 3: DRIVER AUTHORIZATION & TENANT CONTEXT");
  console.log("------------------------------------------------------------------------");

  // Test 17: Unassigned delivery driver cannot verify delivery
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: null });
    await issueDeliveryOtpForOrder(ord);

    const result = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: "1234",
    });

    reportTest(
      "Unassigned driver cannot verify delivery until claiming order (400)",
      result.success === false && result.status === 400 && result.message.includes("does not have an assigned delivery driver")
    );
  }

  // Test 18: Driver from another restaurant (Branch B) cannot verify order of Branch A (404/Isolated)
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    await issueDeliveryOtpForOrder(ord);

    const result = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restB._id.toString(),
      staffUser: driverOtherBranch,
      otpCode: "1234",
    });

    reportTest(
      "Driver from different restaurant is rejected under tenant isolation (404)",
      result.success === false && result.status === 404
    );
  }

  // Test 19: Different driver from same restaurant cannot verify if not assigned
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    await issueDeliveryOtpForOrder(ord);

    const result = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverB,
      otpCode: "1234",
    });

    reportTest(
      "Unassigned driver from same restaurant cannot verify order assigned to someone else (403)",
      result.success === false && result.status === 403 && result.message.includes("not the assigned delivery driver")
    );
  }

  // Test 20: Non-delivery roles (Cashier) cannot verify handover
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    await issueDeliveryOtpForOrder(ord);

    const result = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: cashierA,
      otpCode: "1234",
    });

    reportTest(
      "Cashier role is default-denied from verifying delivery handover (403)",
      result.success === false && result.status === 403
    );
  }

  // =========================================================================
  // GROUP 4: ATTEMPT ACCOUNTING, LOCKOUT & EXPIRY
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 4: ATTEMPT ACCOUNTING, LOCKOUT & EXPIRY");
  console.log("------------------------------------------------------------------------");

  // Test 21: Incorrect code increments attempt count and returns remaining attempts
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    const result = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: "9999" === issueRes.otpCode ? "8888" : "9999",
    });

    const refreshed = await Order.findById(ord._id);

    reportTest(
      "Incorrect code increments attemptCount and returns remainingAttempts (400)",
      result.success === false &&
      result.invalidCode === true &&
      result.remainingAttempts === 4 &&
      refreshed.deliveryOtp.attemptCount === 1
    );
  }

  // Test 22: 5 consecutive incorrect attempts lock the OTP (status: max_attempts_exceeded, 429)
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);
    const wrongCode = "9999" === issueRes.otpCode ? "8888" : "9999";

    for (let i = 0; i < 5; i++) {
      await verifyAndCompleteDelivery({
        orderId: ord._id,
        restaurantId: restA._id.toString(),
        staffUser: driverA,
        otpCode: wrongCode,
      });
    }

    const resultLocked = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
    });

    const refreshed = await Order.findById(ord._id);

    reportTest(
      "5 failed attempts locks OTP into max_attempts_exceeded and rejects subsequent attempts (429)",
      resultLocked.success === false &&
      resultLocked.status === 429 &&
      refreshed.deliveryOtp.status === "max_attempts_exceeded"
    );
  }

  // Test 23: Expired code (>10 minutes) is rejected and marked expired
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    await Order.updateOne(
      { _id: ord._id },
      { $set: { "deliveryOtp.expiresAt": new Date(Date.now() - 5 * 60 * 1000) } }
    );

    const result = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
    });

    const refreshed = await Order.findById(ord._id);

    reportTest(
      "Expired code is strictly rejected with codeExpired: true and status set to 'expired'",
      result.success === false && result.codeExpired === true && refreshed.deliveryOtp.status === "expired"
    );
  }

  // =========================================================================
  // GROUP 5: ATOMIC COMPLETION, CONCURRENCY & TOCTOU REASSIGNMENT RACE (F2)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 5: ATOMIC COMPLETION, CONCURRENCY & TOCTOU REASSIGNMENT RACE (F2)");
  console.log("------------------------------------------------------------------------");

  // Test 24: Valid OTP verification atomically transitions status to 'delivered' and ends GPS tracking
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    const result = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
      transitionNote: "Verified handover at customer door",
    });

    const refreshed = await Order.findById(ord._id);

    reportTest(
      "Valid OTP marks order delivered, records statusHistory, sets OTP verified, and ends live tracking",
      result.success === true &&
      refreshed.status === "delivered" &&
      refreshed.deliveryOtp.status === "verified" &&
      refreshed.deliveryTracking.isLive === false &&
      refreshed.deliveryTracking.endReason === "delivered"
    );
  }

  // Test 25: Replayed OTP is rejected (consumed OTP cannot be reused)
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
    });

    const replayResult = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
    });

    reportTest(
      "Replayed OTP is rejected because order is already delivered (terminal state check)",
      replayResult.success === false && replayResult.status === 400
    );
  }

  // Test 26: Concurrent verification requests yield exactly 1 winner and 1 conflict (409)
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    const [res1, res2] = await Promise.all([
      verifyAndCompleteDelivery({
        orderId: ord._id,
        restaurantId: restA._id.toString(),
        staffUser: driverA,
        otpCode: issueRes.otpCode,
      }),
      verifyAndCompleteDelivery({
        orderId: ord._id,
        restaurantId: restA._id.toString(),
        staffUser: driverA,
        otpCode: issueRes.otpCode,
      }),
    ]);

    const results = [res1, res2];
    const successes = results.filter((r) => r.success === true);
    const conflicts = results.filter((r) => r.conflict === true || r.status === 409);

    reportTest(
      "Two concurrent valid verifications yield exactly 1 winner and 1 HTTP 409 Conflict",
      successes.length === 1 && conflicts.length === 1
    );
  }

  // Test 27: Verification racing with cancellation CANNOT resurrect a cancelled order
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    await Order.updateOne({ _id: ord._id }, { $set: { status: "cancelled" } });

    const verifyResult = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
    });

    const refreshed = await Order.findById(ord._id);

    reportTest(
      "Verification cannot complete or resurrect a cancelled order",
      verifyResult.success === false && refreshed.status === "cancelled"
    );
  }

  // Test 28 [F2]: Reassigned driver TOCTOU race: Driver Alpha passes initial check, but manager concurrently reassigns to Driver Beta before atomic commit
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    // Simulate Manager concurrently reassigning order to Driver Beta right before Alpha's atomic update commits
    _setTestPreAtomicCommitHook(async () => {
      await Order.updateOne(
        { _id: ord._id },
        {
          $set: {
            "assignedDeliveryStaff.id": driverB._id,
            "assignedDeliveryStaff.name": driverB.name,
            "assignedDeliveryStaff.phone": driverB.phone,
          },
        }
      );
    });

    // Alpha attempts handover completion with valid OTP
    const alphaResult = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
    });

    // Reset hook
    _setTestPreAtomicCommitHook(null);

    const refreshedAfterAlpha = await Order.findById(ord._id);

    reportTest(
      "F2 TOCTOU Guard: Reassigned Driver Alpha is rejected with HTTP 409 Conflict at atomic boundary",
      alphaResult.success === false &&
      alphaResult.status === 409 &&
      alphaResult.reassigned === true &&
      refreshedAfterAlpha.status === "out_for_delivery" &&
      refreshedAfterAlpha.deliveryOtp.status === "issued"
    );
  }

  // Test 29 [F2]: Newly assigned Driver Beta can successfully complete the reassigned order
  {
    const ord = await Order.findOne({ status: "out_for_delivery", "assignedDeliveryStaff.id": driverB._id });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    const betaResult = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverB,
      otpCode: issueRes.otpCode,
    });

    const refreshedAfterBeta = await Order.findById(ord._id);

    reportTest(
      "F2 TOCTOU Guard: Driver Beta successfully completes handover and delivery attribution is accurate",
      betaResult.success === true &&
      refreshedAfterBeta.status === "delivered" &&
      refreshedAfterBeta.deliveryOtp.verifiedBy?.id?.toString() === driverB._id.toString()
    );
  }

  // Test 30: Dedicated driver verification route POST /api/restaurant/orders/[id]/verify-handover
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    setDriverVerifyAuth(async () => mockStaffAuth(driverA, restA));
    const req = new Request(`http://localhost:3000/api/restaurant/orders/${ord._id}/verify-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpCode: issueRes.otpCode }),
    });

    const res = await driverVerifyHandoverPOST(req, { params: { id: ord._id.toString() } });
    const data = await res.json();

    reportTest(
      "Driver verify-handover route POST returns success 200 and marks order delivered",
      res.status === 200 && data.success === true && data.order?.status === "delivered"
    );
  }

  // Test 31: Superadmin CANNOT bypass OTP to mark delivery orders delivered
  {
    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    setSuperAdminAuth(async () => ({ user: superAdminUser }));

    const req = new Request("http://localhost:3000/api/superadmin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ord._id.toString(), status: "delivered" }),
    });

    const res = await superadminOrdersPATCH(req);
    const data = await res.json();

    reportTest(
      "Superadmin direct status override to 'delivered' for delivery order is strictly blocked (400)",
      res.status === 400 && data.success === false && data.message.includes("Direct superadmin status override")
    );
  }

  // Test 32: Pickup orders strictly skip OTP and complete without OTP
  {
    const ordPickup = await createTestOrder({
      orderType: "pickup",
      address: { addressType: "pickup" },
      status: "ready",
      assignedDeliveryStaff: null,
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(cashierA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ordPickup._id.toString(), status: "delivered" }),
    });

    const res = await restaurantOrdersPUT(req);
    const data = await res.json();

    reportTest(
      "Counter pickup orders complete successfully without requiring any OTP",
      res.status === 200 && data.success === true && data.order?.status === "delivered"
    );
  }

  // =========================================================================
  // GROUP 6: SERVER-AUTHORITATIVE COD COLLECTION & FINANCIAL INTEGRITY (F3)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 6: SERVER-AUTHORITATIVE COD COLLECTION & FINANCIAL INTEGRITY (F3)");
  console.log("------------------------------------------------------------------------");

  // Test 33 [F3]: Legitimate COD delivery records cash collection strictly using authenticated driver and order total
  {
    const ordCod = await createTestOrder({
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
      totalAmount: 650,
      paymentMethod: "cash on delivery",
      paymentStatus: "pending",
    });
    const issueRes = await issueDeliveryOtpForOrder(ordCod);

    const result = await verifyAndCompleteDelivery({
      orderId: ordCod._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
    });

    const refreshed = await Order.findById(ordCod._id);

    reportTest(
      "F3 Invariant: Verified COD handover sets paymentStatus to 'paid' with trusted driver and totalAmount (650)",
      result.success === true &&
      refreshed.status === "delivered" &&
      refreshed.paymentStatus === "paid" &&
      refreshed.codPaymentHandler?.id?.toString() === driverA._id.toString() &&
      refreshed.codPaymentHandler?.amount === 650 &&
      refreshed.codPaymentHandler?.collected === true &&
      refreshed.codPaymentHandler?.settledWithManager === false
    );
  }

  // Test 34 [F3]: Client attempting to spoof handler ID/name/phone is ignored; server records authenticated driver
  {
    const ordCod = await createTestOrder({
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
      totalAmount: 500,
      paymentMethod: "cod",
      paymentStatus: "pending",
    });
    const issueRes = await issueDeliveryOtpForOrder(ordCod);

    // Driver A passes Driver B's identity in codPaymentHandler body
    const result = await verifyAndCompleteDelivery({
      orderId: ordCod._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
      codPaymentHandler: {
        id: driverB._id.toString(),
        name: "Driver Beta Spoofed",
        phone: "9999999999",
      },
    });

    const refreshed = await Order.findById(ordCod._id);

    reportTest(
      "F3 Invariant: Client-supplied handler ID/name is ignored; server binds authenticated driver (Driver Alpha)",
      result.success === true &&
      refreshed.codPaymentHandler?.id?.toString() === driverA._id.toString() &&
      refreshed.codPaymentHandler?.name === driverA.name
    );
  }

  // Test 35 [F3]: Client attempting to submit manipulated amount (e.g. 1 instead of 800) is ignored
  {
    const ordCod = await createTestOrder({
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
      totalAmount: 800,
      paymentMethod: "cod",
      paymentStatus: "pending",
    });
    const issueRes = await issueDeliveryOtpForOrder(ordCod);

    // Client attempts to pass amount: 1
    const result = await verifyAndCompleteDelivery({
      orderId: ordCod._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
      codPaymentHandler: { amount: 1 },
    });

    const refreshed = await Order.findById(ordCod._id);

    reportTest(
      "F3 Invariant: Client-manipulated amount (1) is ignored; server records full totalAmount (800)",
      result.success === true && refreshed.codPaymentHandler?.amount === 800
    );
  }

  // Test 36 [F3]: Driver attempting to self-settle cash liability (settledWithManager: true) is strictly blocked
  {
    const ordCod = await createTestOrder({
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
      totalAmount: 400,
      paymentMethod: "cod",
      paymentStatus: "pending",
    });
    const issueRes = await issueDeliveryOtpForOrder(ordCod);

    // Driver attempts to mark settledWithManager: true
    const result = await verifyAndCompleteDelivery({
      orderId: ordCod._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
      codPaymentHandler: { settledWithManager: true },
    });

    const refreshed = await Order.findById(ordCod._id);

    reportTest(
      "F3 Invariant: Driver self-settlement is prohibited; settledWithManager remains false and settledAt is null",
      result.success === true &&
      refreshed.codPaymentHandler?.settledWithManager === false &&
      refreshed.codPaymentHandler?.settledAt === null
    );
  }

  // Test 37 [F3]: Legitimate manager can confirm cash settlement via manager action (settle_cod_cash)
  {
    const ordCod = await createTestOrder({
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
      totalAmount: 350,
      status: "delivered",
      paymentMethod: "cod",
      paymentStatus: "paid",
      codPaymentHandler: {
        id: driverA._id,
        name: driverA.name,
        amount: 350,
        collected: true,
        settledWithManager: false,
      },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "settle_cod_cash",
        orderId: ordCod._id.toString(),
      }),
    });

    const res = await restaurantOrdersPUT(req);
    const data = await res.json();
    const refreshed = await Order.findById(ordCod._id);

    if (!res.ok || !data.success) {
      console.error("Test 37 debug:", res.status, data);
    }
    reportTest(
      "F3 Invariant: Manager action settle_cod_cash successfully marks settledWithManager: true and records manager",
      res.status === 200 &&
      data.success === true &&
      refreshed.codPaymentHandler?.settledWithManager === true &&
      refreshed.codPaymentHandler?.settledBy?.id?.toString() === managerA._id.toString(),
      `res.status=${res.status}, data=${JSON.stringify(data)}, refreshed=${JSON.stringify(refreshed.codPaymentHandler)}`
    );
  }

  // Test 38 [F3]: Online-paid order (Razorpay) ignores client COD payload and remains online-paid
  {
    const ordOnline = await createTestOrder({
      assignedDeliveryStaff: { id: driverA._id, name: driverA.name },
      totalAmount: 900,
      paymentMethod: "Razorpay (Online Payment)",
      paymentStatus: "paid",
    });
    const issueRes = await issueDeliveryOtpForOrder(ordOnline);

    const result = await verifyAndCompleteDelivery({
      orderId: ordOnline._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
      codPaymentHandler: { amount: 50 },
    });

    const refreshed = await Order.findById(ordOnline._id);

    reportTest(
      "F3 Invariant: Online-paid order ignores COD payload, remains paymentStatus 'paid' without COD collection",
      result.success === true &&
      refreshed.status === "delivered" &&
      refreshed.paymentMethod === "Razorpay (Online Payment)" &&
      refreshed.paymentStatus === "paid" &&
      (refreshed.codPaymentHandler?.collected === false || refreshed.codPaymentHandler?.collected === undefined)
    );
  }

  // =========================================================================
  // GROUP 6B: COD SETTLEMENT ATOMIC HARDENING & FINANCIAL CONCURRENCY (REC-A1)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 6B: COD SETTLEMENT ATOMIC HARDENING & FINANCIAL CONCURRENCY (REC-A1)");
  console.log("------------------------------------------------------------------------");

  // Test 39 [REC-A1]: Eligible collected COD order can be settled by an authorized manager
  {
    const ord = await createTestOrder({
      totalAmount: 500,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: {
        id: driverA._id,
        name: driverA.name,
        amount: 500,
        collected: true,
        settledWithManager: false,
      },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ord._id.toString() }),
    });

    const res = await restaurantOrdersPUT(req);
    const data = await res.json();
    const refreshed = await Order.findById(ord._id);

    reportTest(
      "REC-A1 Invariant 1: Eligible collected COD order settled by manager (status 200, persisted in DB)",
      res.status === 200 &&
      data.success === true &&
      data.settledCount === 1 &&
      refreshed.codPaymentHandler?.settledWithManager === true &&
      refreshed.codPaymentHandler?.settledBy?.id?.toString() === managerA._id.toString() &&
      refreshed.codPaymentHandler?.settledAt instanceof Date
    );
  }

  // Test 40 [REC-A1]: Uncollected COD order cannot be settled
  {
    const ordUncollected = await createTestOrder({
      totalAmount: 300,
      paymentMethod: "Cash on Delivery (COD)",
      status: "out_for_delivery",
      paymentStatus: "pending",
      codPaymentHandler: {
        id: driverA._id,
        name: driverA.name,
        amount: 0,
        collected: false,
        settledWithManager: false,
      },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordUncollected._id.toString() }),
    });

    const res = await restaurantOrdersPUT(req);
    const data = await res.json();
    const refreshed = await Order.findById(ordUncollected._id);

    reportTest(
      "REC-A1 Invariant 2: Uncollected COD order cannot be settled (rejected with 400, cash_not_collected)",
      res.status === 400 &&
      data.success === false &&
      data.reason === "cash_not_collected" &&
      refreshed.codPaymentHandler?.settledWithManager === false &&
      !refreshed.codPaymentHandler?.settledAt
    );
  }

  // Test 41 [REC-A1]: Already-settled order cannot be settled again
  {
    const priorSettledAt = new Date(Date.now() - 3600 * 1000);
    const ordSettled = await createTestOrder({
      totalAmount: 400,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: {
        id: driverA._id,
        name: driverA.name,
        amount: 400,
        collected: true,
        settledWithManager: true,
        settledAt: priorSettledAt,
        settledBy: { id: managerA._id, name: managerA.name },
      },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordSettled._id.toString() }),
    });

    const res = await restaurantOrdersPUT(req);
    const data = await res.json();
    const refreshed = await Order.findById(ordSettled._id);

    reportTest(
      "REC-A1 Invariant 3: Already-settled order cannot be settled again (rejected with 409, original timestamp preserved)",
      res.status === 409 &&
      data.success === false &&
      data.reason === "already_settled" &&
      refreshed.codPaymentHandler?.settledWithManager === true &&
      new Date(refreshed.codPaymentHandler?.settledAt).getTime() === priorSettledAt.getTime()
    );
  }

  // Test 42 [REC-A1]: Duplicate and concurrent settlement requests do not double-settle an order
  {
    const ordConcurrent = await createTestOrder({
      totalAmount: 600,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: {
        id: driverA._id,
        name: driverA.name,
        amount: 600,
        collected: true,
        settledWithManager: false,
      },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));

    const req1 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordConcurrent._id.toString() }),
    });

    const req2 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordConcurrent._id.toString() }),
    });

    const [res1, res2] = await Promise.all([
      restaurantOrdersPUT(req1),
      restaurantOrdersPUT(req2),
    ]);

    const results = [
      { status: res1.status, data: await res1.json() },
      { status: res2.status, data: await res2.json() },
    ];

    const successes = results.filter((r) => r.status === 200 && r.data.success === true);
    const conflicts = results.filter((r) => r.status === 409 && r.data.success === false);
    const refreshed = await Order.findById(ordConcurrent._id);

    reportTest(
      "REC-A1 Invariant 4: Concurrent settlement requests yield exactly 1 success and 1 conflict (no double-settle)",
      successes.length === 1 &&
      conflicts.length === 1 &&
      refreshed.codPaymentHandler?.settledWithManager === true
    );
  }

  // Test 43 [REC-A1]: Orders belonging to another restaurant cannot be settled
  {
    const ordOtherBranch = await createTestOrder({
      restaurant: restB._id,
      totalAmount: 350,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: {
        id: driverOtherBranch._id,
        name: driverOtherBranch.name,
        amount: 350,
        collected: true,
        settledWithManager: false,
      },
    });

    // Manager Alpha (Restaurant A) attempts to settle Restaurant B's order
    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordOtherBranch._id.toString() }),
    });

    const res = await restaurantOrdersPUT(req);
    const data = await res.json();
    const refreshed = await Order.findById(ordOtherBranch._id);

    reportTest(
      "REC-A1 Invariant 5: Cross-restaurant order cannot be settled by un-scoped manager (404 access denied)",
      res.status === 404 &&
      data.success === false &&
      refreshed.codPaymentHandler?.settledWithManager === false
    );
  }

  // Test 44 [REC-A1]: Unauthorized staff and delivery drivers cannot settle cash
  {
    const ordAuthCheck = await createTestOrder({
      totalAmount: 250,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: {
        id: driverA._id,
        name: driverA.name,
        amount: 250,
        collected: true,
        settledWithManager: false,
      },
    });

    // Driver Alpha attempts to settle
    setRestaurantOrdersAuth(async () => mockStaffAuth(driverA, restA));
    const reqDriver = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordAuthCheck._id.toString() }),
    });
    const resDriver = await restaurantOrdersPUT(reqDriver);

    // Cashier Alpha attempts to settle
    setRestaurantOrdersAuth(async () => mockStaffAuth(cashierA, restA));
    const reqCashier = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordAuthCheck._id.toString() }),
    });
    const resCashier = await restaurantOrdersPUT(reqCashier);

    const refreshed = await Order.findById(ordAuthCheck._id);

    reportTest(
      "REC-A1 Invariant 6: Non-manager staff (Delivery, Cashier) are strictly rejected with 403 Forbidden",
      resDriver.status === 403 &&
      resCashier.status === 403 &&
      refreshed.codPaymentHandler?.settledWithManager === false
    );
  }

  // Test 45 [REC-A1]: Online-paid, cancelled, and refunded orders cannot be settled
  {
    const ordOnline = await createTestOrder({
      totalAmount: 500,
      paymentMethod: "Razorpay (Online Payment)",
      status: "delivered",
      paymentStatus: "paid",
    });

    const ordCancelled = await createTestOrder({
      totalAmount: 400,
      paymentMethod: "Cash on Delivery (COD)",
      status: "cancelled",
      paymentStatus: "pending",
      codPaymentHandler: { collected: true, settledWithManager: false },
    });

    const ordRefunded = await createTestOrder({
      totalAmount: 300,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "refunded",
      codPaymentHandler: { collected: true, settledWithManager: false },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));

    const reqOnline = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordOnline._id.toString() }),
    });
    const resOnline = await restaurantOrdersPUT(reqOnline);

    const reqCancelled = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordCancelled._id.toString() }),
    });
    const resCancelled = await restaurantOrdersPUT(reqCancelled);

    const reqRefunded = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordRefunded._id.toString() }),
    });
    const resRefunded = await restaurantOrdersPUT(reqRefunded);

    const [refOnline, refCancelled, refRefunded] = await Promise.all([
      Order.findById(ordOnline._id),
      Order.findById(ordCancelled._id),
      Order.findById(ordRefunded._id),
    ]);

    reportTest(
      "REC-A1 Invariant 7: Online-paid, cancelled, and refunded orders are rejected from COD cash settlement (400)",
      resOnline.status === 400 &&
      resCancelled.status === 400 &&
      resRefunded.status === 400 &&
      !refOnline.codPaymentHandler?.settledWithManager &&
      !refCancelled.codPaymentHandler?.settledWithManager &&
      !refRefunded.codPaymentHandler?.settledWithManager
    );
  }

  // Test 46 [REC-A1]: A mixed batch settles only eligible orders and reports skipped orders accurately
  {
    const ordB1 = await createTestOrder({
      totalAmount: 200,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: { id: driverA._id, amount: 200, collected: true, settledWithManager: false },
    });

    const ordB2 = await createTestOrder({
      totalAmount: 350,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: { id: driverA._id, amount: 350, collected: true, settledWithManager: false },
    });

    const ordBAlreadySettled = await createTestOrder({
      totalAmount: 150,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: { id: driverA._id, amount: 150, collected: true, settledWithManager: true, settledAt: new Date() },
    });

    const ordBUncollected = await createTestOrder({
      totalAmount: 180,
      paymentMethod: "Cash on Delivery (COD)",
      status: "out_for_delivery",
      paymentStatus: "pending",
      codPaymentHandler: { id: driverA._id, amount: 0, collected: false, settledWithManager: false },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "settle_cod_cash",
        orderIds: [
          ordB1._id.toString(),
          ordB2._id.toString(),
          ordBAlreadySettled._id.toString(),
          ordBUncollected._id.toString(),
        ],
      }),
    });

    const res = await restaurantOrdersPUT(req);
    const data = await res.json();

    const [refB1, refB2, refBAlready, refBUncoll] = await Promise.all([
      Order.findById(ordB1._id),
      Order.findById(ordB2._id),
      Order.findById(ordBAlreadySettled._id),
      Order.findById(ordBUncollected._id),
    ]);

    reportTest(
      "REC-A1 Invariant 8: Mixed batch settles exactly 2 eligible orders and skips 2 ineligible with accurate audit report",
      res.status === 200 &&
      data.success === true &&
      data.settledCount === 2 &&
      data.skippedCount === 2 &&
      refB1.codPaymentHandler?.settledWithManager === true &&
      refB2.codPaymentHandler?.settledWithManager === true &&
      refBAlready.codPaymentHandler?.settledWithManager === true &&
      refBUncoll.codPaymentHandler?.settledWithManager === false
    );
  }

  // Test 47 [REC-A1]: Client-supplied handler identities, amounts, and settlement flags cannot override server-authoritative values
  {
    const ordSpoof = await createTestOrder({
      totalAmount: 850,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: {
        id: driverA._id,
        name: driverA.name,
        amount: 850,
        collected: true,
        settledWithManager: false,
      },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "settle_cod_cash",
        orderId: ordSpoof._id.toString(),
        codPaymentHandler: {
          id: new mongoose.Types.ObjectId().toString(),
          name: "Injected Driver",
          amount: 5,
          settledWithManager: false,
        },
        settledBy: {
          id: new mongoose.Types.ObjectId().toString(),
          name: "Injected Manager",
        },
      }),
    });

    const res = await restaurantOrdersPUT(req);
    const data = await res.json();
    const refreshed = await Order.findById(ordSpoof._id);

    reportTest(
      "REC-A1 Invariant 9: Client-supplied amounts and IDs are ignored; server records authentic driver, amount (850), and manager",
      res.status === 200 &&
      data.success === true &&
      refreshed.codPaymentHandler?.amount === 850 &&
      refreshed.codPaymentHandler?.id?.toString() === driverA._id.toString() &&
      refreshed.codPaymentHandler?.settledBy?.id?.toString() === managerA._id.toString() &&
      refreshed.codPaymentHandler?.settledBy?.name === managerA.name
    );
  }

  // Test 48 [REC-A1]: Financial model enforces atomic full-order balance collection and settlement
  {
    const ordFullModel = await createTestOrder({
      totalAmount: 720,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: {
        id: driverA._id,
        name: driverA.name,
        amount: 720,
        collected: true,
        settledWithManager: false,
      },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));
    const req = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordFullModel._id.toString() }),
    });

    const res = await restaurantOrdersPUT(req);
    const refreshed = await Order.findById(ordFullModel._id);

    reportTest(
      "REC-A1 Invariant 10: Outstanding balance verified as full totalAmount (720); partial balances are not modeled",
      res.status === 200 &&
      refreshed.codPaymentHandler?.amount === 720 &&
      refreshed.totalAmount === 720 &&
      refreshed.codPaymentHandler?.settledWithManager === true
    );
  }

  // Test 49 [REC-A1]: Repeated settlement requests do not produce contradictory or duplicate payment records
  {
    const ordRepeat = await createTestOrder({
      totalAmount: 440,
      paymentMethod: "Cash on Delivery (COD)",
      status: "delivered",
      paymentStatus: "paid",
      codPaymentHandler: {
        id: driverA._id,
        name: driverA.name,
        amount: 440,
        collected: true,
        settledWithManager: false,
      },
    });

    setRestaurantOrdersAuth(async () => mockStaffAuth(managerA, restA));

    // Request 1: Valid initial settlement
    const req1 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordRepeat._id.toString() }),
    });
    const res1 = await restaurantOrdersPUT(req1);

    // Request 2: Redundant retry
    const req2 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordRepeat._id.toString() }),
    });
    const res2 = await restaurantOrdersPUT(req2);

    // Request 3: Second redundant retry
    const req3 = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle_cod_cash", orderId: ordRepeat._id.toString() }),
    });
    const res3 = await restaurantOrdersPUT(req3);

    const refreshed = await Order.findById(ordRepeat._id);
    const settlementTransitions = refreshed.statusHistory.filter((h) =>
      h.note?.includes("settled with manager")
    );

    reportTest(
      "REC-A1 Invariant 11: Repeated settlement retries fail closed (409) with exactly 1 audit statusHistory entry",
      res1.status === 200 &&
      res2.status === 409 &&
      res3.status === 409 &&
      refreshed.codPaymentHandler?.settledWithManager === true &&
      settlementTransitions.length === 1
    );
  }

  // =========================================================================
  // GROUP 7: DELIVERY COMPLETION PUSH NOTIFICATIONS (F4)
  // =========================================================================
  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 7: DELIVERY COMPLETION PUSH NOTIFICATIONS (F4)");
  console.log("------------------------------------------------------------------------");

  // Test 39 [F4]: Successful delivery handover dispatches status_update Web Push notification
  {
    let pushDispatched = null;
    _setTestNotifyOrderEvent(async (order, eventType, metadata) => {
      pushDispatched = { orderId: order._id.toString(), eventType, metadata };
    });

    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
    });

    // Small microtask yield for non-blocking push promise
    await new Promise((r) => setTimeout(r, 50));

    reportTest(
      "F4 Notification: Successful delivery handover dispatches status_update Web Push notification",
      pushDispatched !== null &&
      pushDispatched.orderId === ord._id.toString() &&
      pushDispatched.eventType === "status_update" &&
      pushDispatched.metadata?.status === "delivered" &&
      pushDispatched.metadata?.previousStatus === "out_for_delivery"
    );
  }

  // Test 40 [F4]: Rejected verification dispatches zero notifications
  {
    let pushDispatched = false;
    _setTestNotifyOrderEvent(async () => {
      pushDispatched = true;
    });

    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    await issueDeliveryOtpForOrder(ord);

    await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: "0000", // Wrong code
    });

    await new Promise((r) => setTimeout(r, 50));

    reportTest(
      "F4 Notification: Rejected verification (incorrect OTP) dispatches ZERO notifications",
      pushDispatched === false
    );
  }

  // Test 41 [F4]: Push notification failure does not revert or corrupt committed delivery completion
  {
    _setTestNotifyOrderEvent(async () => {
      throw new Error("Simulated network timeout connecting to Web Push service");
    });

    const ord = await createTestOrder({ assignedDeliveryStaff: { id: driverA._id, name: driverA.name } });
    const issueRes = await issueDeliveryOtpForOrder(ord);

    const result = await verifyAndCompleteDelivery({
      orderId: ord._id,
      restaurantId: restA._id.toString(),
      staffUser: driverA,
      otpCode: issueRes.otpCode,
    });

    await new Promise((r) => setTimeout(r, 50));
    const refreshed = await Order.findById(ord._id);

    reportTest(
      "F4 Isolation: External notification failure does not corrupt or roll back committed delivery",
      result.success === true && refreshed.status === "delivered"
    );
  }

  console.log("\n========================================================================");
  console.log(`🎉 ALL ${passCount} OF ${testCount} DELIVERY OTP & HANDOVER TESTS PASSED!`);
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
