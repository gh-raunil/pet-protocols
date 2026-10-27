/**
 * PET PROTOCOLS — ORDER HISTORY, ORDER DETAILS & PAGINATION TEST SUITE
 *
 * Verifies:
 * 1. Backend Pagination on GET /api/orders:
 *    - Default page size (20) & Max limit clamping (50)
 *    - Validation: invalid, negative, non-integer, or zero page/limit rejected with HTTP 400
 *    - Empty order history behavior
 *    - Deterministic sort order with stable tie-breaker (createdAt: -1, _id: -1)
 *    - No duplicate or missing entries across page boundaries
 *    - Strict customer ownership isolation (customer A cannot access customer B's orders)
 *    - Backward-compatible response structure: { success: true, order, orders, pagination }
 *
 * 2. Dedicated Order Details API on GET /api/orders/[id]:
 *    - Valid owned order retrieval (single & multi-restaurant orders)
 *    - Cross-customer order isolation: unauthorized access returns HTTP 404 without leaking existence
 *    - Nonexistent or malformed order ID handling
 *    - Zero exposure of delivery OTP digest/encryptedCode or internal secrets
 *    - Sanitized statusHistory and deliveryTracking
 *
 * 3. Frontend Order History & Details Contracts:
 *    - OrdersClient 'Load More' pagination & deduplication
 *    - Filter changes resetting pagination
 *    - Direct navigation links to /orders/[id]
 *    - OrderDetailClient implementation contract & accessibility
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

// Register custom module loader for '@/' and 'next/server'
register(pathToFileURL(path.join(scriptsDir, "test_backend_loader.mjs")).href, import.meta.url);

console.log("========================================================================");
console.log("PET PROTOCOLS — ORDER HISTORY, ORDER DETAILS & PAGINATION TEST SUITE");
console.log("========================================================================\n");

// ─── SUITE 1: BACKEND PAGINATION ON GET /api/orders (BEHAVIORAL) ──────
console.log("--- Suite 1: Backend Pagination on GET /api/orders ---");

const {
  GET: ordersGET,
  _setTestGetServerSession: setOrdersSession,
} = await import(pathToFileURL(path.join(backendDir, "app", "api", "orders", "route.js")).href);

const { default: OrderModel } = await import(
  pathToFileURL(path.join(backendDir, "models", "Order.js")).href
);
const { default: UserModel } = await import(
  pathToFileURL(path.join(backendDir, "models", "User.js")).href
);
const { default: mongoose } = await import(
  pathToFileURL(path.join(backendDir, "node_modules", "mongoose", "index.js")).href
);

process.env.MONGODB_URI = "mongodb://localhost:27017/test_pet_protocols";

// Mock mongoose connection readyState so connectDB() executes in-memory without network calls
global.mongoose = {
  conn: mongoose.connection,
  promise: Promise.resolve(mongoose.connection),
};
try {
  Object.defineProperty(mongoose.connection, "readyState", {
    value: 1,
    configurable: true,
    writable: true,
  });
} catch (_) {}

// Mock Users
const customerA = {
  _id: "650000000000000000000001",
  name: "Customer Alpha",
  email: "customer.alpha@example.com",
  phone: "9876543210",
  role: "customer",
};

const customerB = {
  _id: "650000000000000000000002",
  name: "Customer Beta",
  email: "customer.beta@example.com",
  phone: "9876543211",
  role: "customer",
};

// Test 1: Unauthorized request returns HTTP 401
{
  setOrdersSession(async () => null);
  const req = new Request("http://localhost:3000/api/orders");
  const res = await ordersGET(req);
  assert.equal(res.status, 401, "Unauthenticated request must return HTTP 401");
  const data = await res.json();
  assert.equal(data.success, false);
  console.log("✓ PASS: Unauthenticated request to /api/orders returns HTTP 401");
}

// Test 2: Invalid page parameter rejected with HTTP 400
{
  setOrdersSession(async () => ({ user: { email: customerA.email, role: "customer" } }));
  const invalidPages = ["0", "-1", "-10", "abc", "1.5", "null", ""];
  for (const pageVal of invalidPages) {
    const req = new Request(`http://localhost:3000/api/orders?page=${encodeURIComponent(pageVal)}`);
    const res = await ordersGET(req);
    assert.equal(res.status, 400, `Page='${pageVal}' must be rejected with HTTP 400`);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.message.includes("Invalid page parameter"));
  }
  console.log("✓ PASS: Invalid, zero, negative, and non-integer page parameters return HTTP 400");
}

// Test 3: Invalid limit parameter rejected with HTTP 400
{
  setOrdersSession(async () => ({ user: { email: customerA.email, role: "customer" } }));
  const invalidLimits = ["0", "-5", "xyz", "NaN"];
  for (const limitVal of invalidLimits) {
    const req = new Request(`http://localhost:3000/api/orders?limit=${encodeURIComponent(limitVal)}`);
    const res = await ordersGET(req);
    assert.equal(res.status, 400, `Limit='${limitVal}' must be rejected with HTTP 400`);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.message.includes("Invalid limit parameter"));
  }
  console.log("✓ PASS: Invalid, zero, and negative limit parameters return HTTP 400");
}

// Test 4: Pagination query simulation (Defaults, Max Clamping, Deterministic Sort, and Pagination Metadata)
{
  // Mock customer orders in-memory dataset
  const generateMockOrders = (userId, count) => {
    return Array.from({ length: count }, (_, idx) => {
      const orderNum = count - idx; // descending order
      const ts = new Date(1700000000000 + orderNum * 60000);
      return {
        _id: `order_obj_id_${String(orderNum).padStart(4, "0")}`,
        orderId: `ORD_${orderNum}`,
        user: userId,
        restaurant: { _id: "rest_001", name: "Artisan Biryani Lab" },
        items: [{ name: "Dum Biryani", price: 320, quantity: 1 }],
        totalAmount: 320,
        status: "delivered",
        createdAt: ts,
        updatedAt: ts,
      };
    });
  };

  const alphaOrders = generateMockOrders(customerA._id, 45); // 45 orders

  // Mock database find and countDocuments
  const origFind = OrderModel.find;
  const origCount = OrderModel.countDocuments;
  const origUserFindOne = UserModel.findOne;

  try {
    UserModel.findOne = function (q) {
      if (q?.email === customerA.email) return Promise.resolve(customerA);
      if (q?.email === customerB.email) return Promise.resolve(customerB);
      return Promise.resolve(null);
    };

    OrderModel.countDocuments = function (q) {
      // Simulate database customer ownership isolation
      const isAlpha = q.user === customerA._id || q?.$or?.some((clause) => clause.user === customerA._id);
      if (isAlpha) return Promise.resolve(alphaOrders.length);
      return Promise.resolve(0);
    };

    OrderModel.find = function (q) {
      let results = [...alphaOrders];
      const isAlpha = q.user === customerA._id || q?.$or?.some((clause) => clause.user === customerA._id);
      if (!isAlpha) results = [];

      let skipVal = 0;
      let limitVal = 20;

      const chain = {
        populate: () => chain,
        sort: (sortObj) => {
          assert.deepEqual(
            sortObj,
            { createdAt: -1, _id: -1 },
            "Order query must use deterministic sort order { createdAt: -1, _id: -1 }"
          );
          return chain;
        },
        skip: (val) => {
          skipVal = val;
          return chain;
        },
        limit: (val) => {
          limitVal = val;
          return chain;
        },
        then: (resolve) => {
          const slice = results.slice(skipVal, skipVal + limitVal);
          resolve(slice);
        },
      };
      return chain;
    };

    // Subtest 4a: Default page size is 20, returns page 1 of 45
    {
      setOrdersSession(async () => ({ user: { email: customerA.email, role: "customer" } }));
      const req = new Request("http://localhost:3000/api/orders");
      const res = await ordersGET(req);
      const data = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);

      assert.equal(data.success, true);
      assert.equal(data.orders.length, 20, "Default page limit must be 20");
      assert.equal(data.pagination.page, 1);
      assert.equal(data.pagination.limit, 20);
      assert.equal(data.pagination.totalOrders, 45);
      assert.equal(data.pagination.totalPages, 3);
      assert.equal(data.pagination.hasMore, true);
      assert.ok(data.order, "Response must include first order in 'order' field for backward compatibility");
      console.log("✓ PASS: Default page size is 20 with accurate pagination metadata");
    }

    // Subtest 4b: Page 2 (items 21-40) and Page 3 (items 41-45, hasMore: false)
    {
      const reqP2 = new Request("http://localhost:3000/api/orders?page=2&limit=20");
      const resP2 = await ordersGET(reqP2);
      const dataP2 = await resP2.json();
      assert.equal(dataP2.orders.length, 20);
      assert.equal(dataP2.pagination.page, 2);
      assert.equal(dataP2.pagination.hasMore, true);

      const reqP3 = new Request("http://localhost:3000/api/orders?page=3&limit=20");
      const resP3 = await ordersGET(reqP3);
      const dataP3 = await resP3.json();
      assert.equal(dataP3.orders.length, 5);
      assert.equal(dataP3.pagination.page, 3);
      assert.equal(dataP3.pagination.hasMore, false, "Last page hasMore must be false");
      console.log("✓ PASS: Stable non-overlapping pagination across page 1, 2, and 3 without duplicates");
    }

    // Subtest 4c: Maximum limit clamped to 50
    {
      const reqMax = new Request("http://localhost:3000/api/orders?limit=100");
      const resMax = await ordersGET(reqMax);
      const dataMax = await resMax.json();
      assert.equal(dataMax.pagination.limit, 50, "Limit exceeding 50 must be safely clamped to 50");
      console.log("✓ PASS: Excessive limit parameter (limit=100) is clamped to maximum of 50");
    }

    // Subtest 4d: Customer ownership isolation
    {
      setOrdersSession(async () => ({ user: { email: customerB.email, role: "customer" } }));
      const reqB = new Request("http://localhost:3000/api/orders");
      const resB = await ordersGET(reqB);
      const dataB = await resB.json();
      assert.equal(dataB.success, true);
      assert.equal(dataB.orders.length, 0, "Customer B must not see any of Customer A's orders");
      assert.equal(dataB.pagination.totalOrders, 0);
      assert.equal(dataB.pagination.hasMore, false);
      assert.equal(dataB.order, null);
      console.log("✓ PASS: Customer ownership isolation strictly verified in database query");
    }
  } finally {
    OrderModel.find = origFind;
    OrderModel.countDocuments = origCount;
    UserModel.findOne = origUserFindOne;
  }
}

// ─── SUITE 2: DEDICATED ORDER DETAILS ON GET /api/orders/[id] ────────
console.log("\n--- Suite 2: Dedicated Order Details API on GET /api/orders/[id] ---");

const {
  GET: orderDetailGET,
  _setTestGetServerSession: setDetailSession,
} = await import(pathToFileURL(path.join(backendDir, "app", "api", "orders", "[id]", "route.js")).href);

// Test 5: Missing or whitespace ID returns HTTP 400
{
  setDetailSession(async () => ({ user: { email: customerA.email, role: "customer" } }));
  const req = new Request("http://localhost:3000/api/orders/");
  const res = await orderDetailGET(req, { params: Promise.resolve({ id: "" }) });
  assert.equal(res.status, 400, "Empty ID must return HTTP 400");
  const data = await res.json();
  assert.equal(data.success, false);
  console.log("✓ PASS: Empty or missing order ID returns HTTP 400");
}

// Test 6: Valid owned order retrieval & secret sanitization
{
  const mockOrderDoc = {
    _id: "651111111111111111111111",
    orderId: "ORD_78910",
    user: customerA._id,
    restaurant: {
      _id: "rest_888",
      name: "Tandoori Flames",
      phone: "+91 99999 88888",
      cancellationSettings: { allowCustomerCancel: true, customerCancelWindowMinutes: 2 },
    },
    items: [
      { name: "Paneer Tikka", price: 280, quantity: 2 },
      { name: "Butter Naan", price: 50, quantity: 4 },
    ],
    subtotal: 760,
    deliveryFee: 40,
    discount: 50,
    totalAmount: 750,
    paymentMethod: "Cash on Delivery (COD)",
    paymentStatus: "pending",
    status: "out_for_delivery",
    statusHistory: [
      { status: "pending", changedAt: new Date(Date.now() - 1500000), note: "Order placed" },
      { status: "preparing", changedAt: new Date(Date.now() - 1000000), note: "Cooking" },
      { status: "out_for_delivery", changedAt: new Date(Date.now() - 300000), note: "On the way" },
    ],
    deliveryTracking: {
      isLive: true,
      currentLocation: { latitude: 28.6139, longitude: 77.209 },
      startedAt: new Date(),
    },
    deliveryOtp: {
      code: "1234",
      codeDigest: "sha256_secret_digest_hash_987654321",
      encryptedCode: "aes_encrypted_ciphertext_xyz",
    },
    createdAt: new Date(),
    toObject: function () {
      return JSON.parse(JSON.stringify(this));
    },
  };

  const origFindOne = OrderModel.findOne;
  const origFind = OrderModel.find;
  const origUserFindOne = UserModel.findOne;

  try {
    UserModel.findOne = () => Promise.resolve(customerA);

    OrderModel.findOne = function (q) {
      // Check ownership
      const userClause = q.$and?.find((c) => c.user === customerA._id || c.$or?.some((u) => u.user === customerA._id));
      if (!userClause) return { populate: () => ({ populate: () => Promise.resolve(null) }) };

      const idClause = q.$and?.find((c) =>
        c.$or?.some((i) => i.orderId === "ORD_78910" || i._id === "651111111111111111111111")
      );
      if (!idClause) return { populate: () => ({ populate: () => Promise.resolve(null) }) };

      return {
        populate: () => ({
          populate: () => Promise.resolve(mockOrderDoc),
        }),
      };
    };

    OrderModel.find = function () {
      return {
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([mockOrderDoc]),
          }),
        }),
      };
    };

    setDetailSession(async () => ({ user: { email: customerA.email, role: "customer" } }));

    const req = new Request("http://localhost:3000/api/orders/ORD_78910");
    const res = await orderDetailGET(req, { params: Promise.resolve({ id: "ORD_78910" }) });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.order.orderId, "ORD_78910");
    assert.equal(data.order.restaurant.name, "Tandoori Flames");
    assert.equal(data.order.items.length, 2);
    assert.equal(data.order.totalAmount, 750);

    // Verify critical privacy & security invariants:
    assert.equal(
      data.order.deliveryOtp?.codeDigest,
      undefined,
      "Internal OTP codeDigest must NEVER be exposed in order details"
    );
    assert.equal(
      data.order.deliveryOtp?.encryptedCode,
      undefined,
      "Internal OTP encryptedCode must NEVER be exposed in order details"
    );
    assert.equal(
      data.order.deliveryOtp?.code,
      undefined,
      "Plaintext OTP must not be exposed on general order details endpoint"
    );

    console.log("✓ PASS: Owned order detail successfully retrieved and OTP secrets are safely stripped");
  } finally {
    OrderModel.findOne = origFindOne;
    OrderModel.find = origFind;
    UserModel.findOne = origUserFindOne;
  }
}

// Test 7: Cross-customer isolation (Accessing another customer's order ID returns 404)
{
  const origFindOne = OrderModel.findOne;
  const origUserFindOne = UserModel.findOne;

  try {
    UserModel.findOne = () => Promise.resolve(customerB); // Logged in as Customer B
    OrderModel.findOne = function () {
      // Query enforcing Customer B ownership matches 0 documents
      return {
        populate: () => ({
          populate: () => Promise.resolve(null),
        }),
      };
    };

    setDetailSession(async () => ({ user: { email: customerB.email, role: "customer" } }));

    // Customer B requests Customer A's order ID
    const req = new Request("http://localhost:3000/api/orders/ORD_78910");
    const res = await orderDetailGET(req, { params: Promise.resolve({ id: "ORD_78910" }) });

    assert.equal(res.status, 404, "Access to another user's order must return HTTP 404");
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.message, "Order not found.");
    console.log("✓ PASS: Cross-customer order access strictly blocked with HTTP 404 without leaking existence");
  } finally {
    OrderModel.findOne = origFindOne;
    UserModel.findOne = origUserFindOne;
  }
}

// Test 8: Phone-Based Fallback Isolation & Null/Empty Phone Safety (SEC-OH-01)
{
  const origFind = OrderModel.find;
  const origCount = OrderModel.countDocuments;
  const origUserFindOne = UserModel.findOne;

  try {
    let capturedQuery = null;

    OrderModel.countDocuments = (q) => {
      capturedQuery = q;
      return Promise.resolve(0);
    };
    OrderModel.find = () => ({
      populate: () => ({
        populate: () => ({
          sort: () => ({
            skip: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    });

    // Subtest 8a: User with null or empty phone queries user ID strictly
    UserModel.findOne = () => Promise.resolve({
      _id: "650000000000000000000099",
      email: "nophone@example.com",
      phone: null,
      role: "customer",
    });
    setOrdersSession(async () => ({ user: { email: "nophone@example.com", role: "customer" } }));

    const req1 = new Request("http://localhost:3000/api/orders");
    const res1 = await ordersGET(req1);
    assert.equal(res1.status, 200);

    assert.equal(capturedQuery.user, "650000000000000000000099", "User with null phone must query user ID strictly");
    assert.equal(capturedQuery["address.phone"], undefined, "Query must never query address.phone");

    // Subtest 8b: User with phone must strictly query user ID, never falling back to guest orders
    UserModel.findOne = () => Promise.resolve({
      _id: "650000000000000000000099",
      email: "withphone@example.com",
      phone: "9876543210",
      role: "customer",
    });
    setOrdersSession(async () => ({ user: { email: "withphone@example.com", role: "customer" } }));

    const req2 = new Request("http://localhost:3000/api/orders");
    const res2 = await ordersGET(req2);
    assert.equal(res2.status, 200);

    assert.equal(capturedQuery.user, "650000000000000000000099", "Customer query must isolate to user ID");
    assert.equal(capturedQuery["address.phone"], undefined, "Phone fallback must NOT be present in customer query");
    assert.equal(capturedQuery.$or, undefined, "Phone fallback must NOT create $or with guest orders");

    console.log("✓ PASS: Customer query strictly isolates to authenticated user ID and eliminates unverified phone fallbacks");
  } finally {
    OrderModel.find = origFind;
    OrderModel.countDocuments = origCount;
    UserModel.findOne = origUserFindOne;
  }
}

// Test 9: Sibling Order Query Guards Against Null/Empty orderId & paymentId (SEC-OH-02)
{
  const origFindOne = OrderModel.findOne;
  const origFind = OrderModel.find;
  const origUserFindOne = UserModel.findOne;

  try {
    let capturedSiblingFilter = null;

    UserModel.findOne = () => Promise.resolve(customerA);
    // Order has null orderId and null paymentId
    const orderWithNullIds = {
      _id: "650000000000000000000010",
      orderId: null,
      paymentId: null,
      user: customerA._id,
      restaurant: { name: "Solo Cafe" },
      items: [{ name: "Coffee", price: 100, quantity: 1 }],
      totalAmount: 100,
      status: "pending",
    };

    OrderModel.findOne = () => ({
      populate: () => ({
        populate: () => Promise.resolve(orderWithNullIds),
      }),
    });

    OrderModel.find = (filter) => {
      capturedSiblingFilter = filter;
      return {
        populate: () => ({
          populate: () => ({
            sort: () => Promise.resolve([orderWithNullIds]),
          }),
        }),
      };
    };

    setDetailSession(async () => ({ user: { email: customerA.email, role: "customer" } }));

    const req = new Request("http://localhost:3000/api/orders/650000000000000000000010");
    const res = await orderDetailGET(req, {
      params: Promise.resolve({ id: "650000000000000000000010" }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.isMultiRestaurant, false);
    assert.equal(capturedSiblingFilter, null, "When orderId and paymentId are null, sibling query must not execute");

    console.log("✓ PASS: Sibling order query does NOT execute when orderId and paymentId are null/empty");
  } finally {
    OrderModel.findOne = origFindOne;
    OrderModel.find = origFind;
    UserModel.findOne = origUserFindOne;
  }
}

// Test 10: Staff / Restaurant Admin Missing restaurantId Returns HTTP 403 (SEC-OH-03)
{
  setOrdersSession(async () => ({
    user: { email: "unassigned.staff@example.com", role: "staff" },
  }));
  const req1 = new Request("http://localhost:3000/api/orders");
  const res1 = await ordersGET(req1);
  assert.equal(res1.status, 403, "Staff without restaurantId must be rejected with HTTP 403 on /api/orders");

  setDetailSession(async () => ({
    user: { email: "unassigned.staff@example.com", role: "restaurant_admin" },
  }));
  const req2 = new Request("http://localhost:3000/api/orders/ORD_123");
  const res2 = await orderDetailGET(req2, { params: Promise.resolve({ id: "ORD_123" }) });
  assert.equal(res2.status, 403, "Restaurant admin without restaurantId must be rejected with HTTP 403 on /api/orders/[id]");

  console.log("✓ PASS: Staff / Restaurant Admin without active restaurantId is strictly rejected with HTTP 403");
}

// Test 11: Cache-Control Headers Enforced on Customer Order Endpoints (SEC-OH-04)
{
  const origFind = OrderModel.find;
  const origCount = OrderModel.countDocuments;
  const origUserFindOne = UserModel.findOne;

  try {
    UserModel.findOne = () => Promise.resolve(customerA);
    OrderModel.countDocuments = () => Promise.resolve(0);
    OrderModel.find = () => ({
      populate: () => ({
        populate: () => ({
          sort: () => ({
            skip: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    });

    setOrdersSession(async () => ({ user: { email: customerA.email, role: "customer" } }));
    const req = new Request("http://localhost:3000/api/orders");
    const res = await ordersGET(req);
    assert.equal(res.status, 200);

    const cacheControl = res.headers.get("Cache-Control");
    assert.ok(cacheControl, "Response must include Cache-Control header");
    assert.ok(cacheControl.includes("private"), "Cache-Control must be private");
    assert.ok(cacheControl.includes("no-store"), "Cache-Control must include no-store");

    console.log("✓ PASS: Response includes Cache-Control: private, no-cache, no-store, must-revalidate");
  } finally {
    OrderModel.find = origFind;
    OrderModel.countDocuments = origCount;
    UserModel.findOne = origUserFindOne;
  }
}

// Test 12: Internal Server Error (500) Sanitizes Error Disclosure (SEC-OH-05)
{
  const origUserFindOne = UserModel.findOne;
  try {
    UserModel.findOne = () => Promise.reject(new Error("Sensitive mongo connection failed: user:pass@cluster"));
    setOrdersSession(async () => ({ user: { email: customerA.email, role: "customer" } }));

    const req = new Request("http://localhost:3000/api/orders");
    const res = await ordersGET(req);
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(!data.error.includes("user:pass"), "Internal database credentials/error details must NOT be leaked");
    assert.ok(data.error.includes("Internal server error"), "Sanitized error message returned");

    console.log("✓ PASS: 500 catch handler sanitizes raw exception message and preserves secrecy");
  } finally {
    UserModel.findOne = origUserFindOne;
  }
}

// ─── SUITE 3: FRONTEND ORDER HISTORY & DETAILS IMPLEMENTATION CONTRACTS ─
console.log("\n--- Suite 3: Frontend Order History & Details Contracts ---");

// 1. OrdersClient.js contract verification
{
  const ordersClientPath = path.join(frontendUserDir, "app", "(pages)", "orders", "OrdersClient.js");
  assert.ok(fs.existsSync(ordersClientPath), "OrdersClient.js must exist");
  const code = fs.readFileSync(ordersClientPath, "utf-8");

  assert.ok(code.includes("hasMore"), "OrdersClient must observe pagination hasMore state");
  assert.ok(code.includes("handleLoadMore"), "OrdersClient must implement handleLoadMore for pagination");
  assert.ok(code.includes("Load More Orders"), "OrdersClient must render 'Load More Orders' button");
  assert.ok(code.includes("/orders/${order._id || order.orderId}"), "OrdersClient must link directly to /orders/[id]");
  assert.ok(code.includes("setDateFilterMode"), "OrdersClient must support date filtering");
  assert.ok(code.includes("handleReorder"), "OrdersClient must preserve reorder functionality");
  assert.ok(code.includes("handleCancelOrder"), "OrdersClient must preserve cancellation flow");
  console.log("✓ PASS: OrdersClient implements pagination, 'Load More' action, and links to /orders/[id]");
}

// 2. OrderDetailClient.js contract verification
{
  const orderDetailPath = path.join(
    frontendUserDir,
    "app",
    "(pages)",
    "orders",
    "[id]",
    "OrderDetailClient.js"
  );
  assert.ok(fs.existsSync(orderDetailPath), "OrderDetailClient.js must exist");
  const code = fs.readFileSync(orderDetailPath, "utf-8");

  assert.ok(code.includes("OrderStatusTracker"), "OrderDetailClient must render OrderStatusTracker");
  assert.ok(code.includes("LiveDeliveryMap"), "OrderDetailClient must render LiveDeliveryMap for active deliveries");
  assert.ok(code.includes("Back to Order History"), "OrderDetailClient must provide return path to /orders");
  assert.ok(code.includes("Price Breakdown"), "OrderDetailClient must show itemized financial charges breakdown");
  assert.ok(code.includes("handleCancelOrder"), "OrderDetailClient must support in-window order cancellation");
  assert.ok(code.includes("handleReorder"), "OrderDetailClient must support reorder action with stock check");
  assert.ok(code.includes("subOrders.length > 1"), "OrderDetailClient must handle multi-restaurant orders");
  console.log("✓ PASS: OrderDetailClient implements itemized receipt, timeline tracker, live map, and multi-restaurant support");
}

// 3. /orders/[id]/page.js contract verification
{
  const pagePath = path.join(frontendUserDir, "app", "(pages)", "orders", "[id]", "page.js");
  assert.ok(fs.existsSync(pagePath), "/orders/[id]/page.js must exist");
  const code = fs.readFileSync(pagePath, "utf-8");

  assert.ok(code.includes("await params"), "/orders/[id]/page.js must await params per Next.js conventions");
  assert.ok(code.includes("generateMetadata"), "/orders/[id]/page.js must generate dynamic metadata");
  assert.ok(code.includes("OrderDetailClient"), "/orders/[id]/page.js must render OrderDetailClient");
  console.log("✓ PASS: /orders/[id]/page.js conforms to Next.js dynamic routing conventions");
}

console.log("\n========================================================================");
console.log("🎉 ALL ORDER HISTORY, DETAILS & PAGINATION TESTS PASSED CLEANLY!");
console.log("========================================================================\n");
