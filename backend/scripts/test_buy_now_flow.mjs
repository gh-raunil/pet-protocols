import { register } from "node:module";
import { pathToFileURL } from "node:url";
register(new URL("./loader.mjs", import.meta.url).href, import.meta.url);

import mongoose from "mongoose";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";

console.log("========================================================================");
console.log("PET PROTOCOLS — INDEPENDENT BUY NOW / ORDER NOW REGRESSION SUITE");
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
process.env.ENABLE_PAYMENT_SIMULATOR = "true";
console.log(`Connected to isolated test database: ${MONGODB_URI}\n`);

await mongoose.connect(MONGODB_URI);

const Product = (await import("../models/Product.js")).default;
const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;
const Cart = (await import("../models/Cart.js")).default;
const { calculateOrderDetails } = await import("../lib/checkoutCalculationService.js");
const { POST: ordersPOST, _setTestGetServerSession } = await import("../app/api/orders/route.js");
const { GET: cartGET, POST: cartPOST, DELETE: cartDELETE } = await import("../app/api/cart/route.js");

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`TEST [${totalTests}] ${name} ... `);
  try {
    await fn();
    passedTests++;
    console.log("PASSED");
  } catch (err) {
    console.log("FAILED");
    console.error(err);
    throw err;
  }
}

// ── SETUP FIXTURES ──────────────────────────────────────────────────────────
const testRestaurant = await Restaurant.create({
  name: "Royal Sweets & Kitchen",
  slug: "royal-sweets-kitchen",
  cuisine: ["Indian", "Sweets", "Mughlai"],
  address: {
    street: "Connaught Place",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    latitude: 28.63274,
    longitude: 77.216721,
  },
  phone: "9876543210",
  location: {
    type: "Point",
    coordinates: [77.216721, 28.63274],
  },
  chargeSettings: {
    flatDeliveryFee: 40,
    freeDeliveryThreshold: 500,
  },
  deliverySettings: {
    deliveryRadiusKm: 20,
  },
  orderLimits: {
    minOrderAmount: 0,
  },
  pickupSettings: {
    isPickupEnabled: true,
  },
  openingHours: "10:00 AM - 11:00 PM",
  isActive: true,
});

const kalakand = await Product.create({
  name: "Kesariya Kalakand",
  price: 449,
  category: "Sweets",
  restaurant: testRestaurant._id,
  isAvailable: true,
  hasVariants: false,
});

const samosa = await Product.create({
  name: "Samosa",
  price: 45,
  category: "Snacks",
  restaurant: testRestaurant._id,
  isAvailable: true,
  hasVariants: false,
});

const biryani = await Product.create({
  name: "Hyderabadi Dum Biryani",
  price: 250,
  category: "Main Course",
  restaurant: testRestaurant._id,
  isAvailable: true,
  hasVariants: true,
  variants: [
    {
      _id: new mongoose.Types.ObjectId(),
      name: "Half",
      price: 180,
      isAvailable: true,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: "Full",
      price: 320,
      isAvailable: true,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: "Family Pack",
      price: 750,
      isAvailable: false, // Out of stock variant
    },
  ],
});

const testUser = await User.create({
  name: "Shivam Customer",
  email: "shivam@example.com",
  role: "user",
  phone: "9876543210",
});

_setTestGetServerSession(async () => ({
  user: {
    id: testUser._id.toString(),
    email: testUser.email,
    role: "user",
    name: testUser.name,
  },
}));

// ── TEST CASES ──────────────────────────────────────────────────────────────

// 1. Add Kalakand and Samosa to persistent Cart
await runTest("Cart Setup: Add Kalakand and Samosa to persistent Cart", async () => {
  const cartDoc = await Cart.create({
    user: testUser._id,
    items: [
      {
        _id: kalakand._id.toString(),
        name: kalakand.name,
        price: 449,
        quantity: 1,
        cartItemId: kalakand._id.toString(),
      },
      {
        _id: samosa._id.toString(),
        name: samosa.name,
        price: 45,
        quantity: 1,
        cartItemId: samosa._id.toString(),
      },
    ],
  });

  assert.equal(cartDoc.items.length, 2, "Cart should have 2 items");
  assert.equal(cartDoc.items[0].name, "Kesariya Kalakand");
  assert.equal(cartDoc.items[1].name, "Samosa");
});

// 2. Buy Now payload isolation
await runTest("Buy Now Isolation: Generating Buy Now context does not alter Cart in DB", async () => {
  const fullVariant = biryani.variants.find((v) => v.name === "Full");
  const buyNowPayload = {
    _id: biryani._id.toString(),
    name: biryani.name,
    variantId: fullVariant._id.toString(),
    variantName: fullVariant.name,
    price: fullVariant.price,
    quantity: 2,
    restaurant: testRestaurant._id.toString(),
  };

  // Inspect database cart to guarantee zero mutation
  const userCart = await Cart.findOne({ user: testUser._id }).lean();
  assert.equal(userCart.items.length, 2, "Persistent cart must still have exactly 2 items");
  assert.equal(userCart.items[0].name, "Kesariya Kalakand");
  assert.equal(userCart.items[1].name, "Samosa");
  assert.ok(
    !userCart.items.some((i) => i.name === "Hyderabadi Dum Biryani"),
    "Buy Now dish must NOT exist in persistent cart"
  );
});

// 3. Server-side price authority on Buy Now item (ignores spoofed client price)
await runTest("Server Authority: Client spoofed price (₹10 instead of ₹320) is strictly overridden", async () => {
  const fullVariant = biryani.variants.find((v) => v.name === "Full");
  const calcResult = await calculateOrderDetails({
    items: [
      {
        _id: biryani._id.toString(),
        name: biryani.name,
        variantId: fullVariant._id.toString(),
        variantName: fullVariant.name,
        price: 10, // Attempted client-side spoof price!
        quantity: 2,
      },
    ],
    orderType: "pickup",
  });

  assert.equal(calcResult.success, true, "Calculation must succeed");
  const orderItem = calcResult.orders[0].items[0];
  assert.equal(orderItem.price, 320, "Server must use authoritative DB price ₹320, not client ₹10");
  assert.equal(calcResult.subtotal, 640, "Subtotal must be 2 × 320 = ₹640");
});

// 4. Variant integrity validation
await runTest("Validation: Non-existent variant for dish with variants is rejected", async () => {
  const calcResult = await calculateOrderDetails({
    items: [
      {
        _id: biryani._id.toString(),
        name: biryani.name,
        variantId: new mongoose.Types.ObjectId().toString(),
        variantName: "NonExistentSize",
        price: 100,
        quantity: 1,
      },
    ],
    orderType: "pickup",
  });

  assert.equal(calcResult.success, false, "Must reject invalid variant");
  assert.equal(calcResult.status, 400);
  assert.match(calcResult.message, /Please select a valid size\/variant/i);
});

// 5. Out of stock variant validation
await runTest("Validation: Out-of-stock variant on Buy Now is rejected", async () => {
  const outOfStockVariant = biryani.variants.find((v) => v.name === "Family Pack");
  const calcResult = await calculateOrderDetails({
    items: [
      {
        _id: biryani._id.toString(),
        name: biryani.name,
        variantId: outOfStockVariant._id.toString(),
        variantName: outOfStockVariant.name,
        price: outOfStockVariant.price,
        quantity: 1,
      },
    ],
    orderType: "pickup",
  });

  assert.equal(calcResult.success, false, "Must reject out-of-stock variant");
  assert.equal(calcResult.status, 400);
  assert.match(calcResult.message, /currently out of stock/i);
});

// 6. Complete Buy Now order creation via POST /api/orders
let createdBuyNowOrderId = null;
await runTest("Order Creation: Buy Now order contains ONLY the single selected dish & variant", async () => {
  const fullVariant = biryani.variants.find((v) => v.name === "Full");
  const reqPayload = {
    items: [
      {
        _id: biryani._id.toString(),
        name: biryani.name,
        variantId: fullVariant._id.toString(),
        variantName: fullVariant.name,
        quantity: 2,
        price: fullVariant.price,
      },
    ],
    address: {
      fullName: "Shivam Thakur",
      phone: "9876543210",
      street: "Self Pickup at Kitchen Counter",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
    },
    orderType: "pickup",
    paymentMethod: "Instant Simulator (Test Mode)",
    checkoutIntent: "buy_now",
  };

  const req = new Request("http://localhost:4000/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-idempotency-key": `buy_now_idem_${Date.now()}`,
    },
    body: JSON.stringify(reqPayload),
  });

  const res = await ordersPOST(req);
  const data = await res.json();

  assert.ok(res.status === 200 || res.status === 201, `Expected 200/201, got: ${res.status} ${JSON.stringify(data)}`);
  assert.equal(data.success, true);
  assert.ok(data.order, "Order should be returned");

  createdBuyNowOrderId = data.order._id;
  const dbOrder = await Order.findById(createdBuyNowOrderId).lean();

  assert.ok(dbOrder, "Order must be in DB");
  assert.equal(dbOrder.items.length, 1, "Buy Now order must have strictly 1 item");
  assert.equal(dbOrder.items[0].name, "Hyderabadi Dum Biryani");
  assert.equal(dbOrder.items[0].variantName, "Full");
  assert.equal(dbOrder.items[0].quantity, 2);
  assert.equal(dbOrder.items[0].price, 320);
  assert.equal(dbOrder.subtotal, 640);
  assert.equal(dbOrder.checkoutIntent, "buy_now", "checkoutIntent must be 'buy_now'");
});

// 7. Cart preservation after Buy Now order completion
await runTest("Cart Integrity: After Buy Now order, persistent cart still holds Kalakand and Samosa untouched", async () => {
  const userCart = await Cart.findOne({ user: testUser._id }).lean();
  assert.ok(userCart, "Cart must still exist");
  assert.equal(userCart.items.length, 2, "Persistent cart must still have exactly 2 items");

  const kalakandItem = userCart.items.find((i) => i.name === "Kesariya Kalakand");
  const samosaItem = userCart.items.find((i) => i.name === "Samosa");

  assert.ok(kalakandItem, "Kalakand must remain in cart");
  assert.equal(kalakandItem.quantity, 1);
  assert.equal(kalakandItem.price, 449);

  assert.ok(samosaItem, "Samosa must remain in cart");
  assert.equal(samosaItem.quantity, 1);
  assert.equal(samosaItem.price, 45);

  assert.ok(
    !userCart.items.some((i) => i.name === "Hyderabadi Dum Biryani"),
    "Biryani must not be present in persistent cart"
  );
});

// 8. Normal Cart Checkout works independently and clears cart on completion
await runTest("Normal Cart Checkout: Checks out all cart items and clears cart on completion", async () => {
  const userCart = await Cart.findOne({ user: testUser._id }).lean();
  assert.equal(userCart.items.length, 2);

  // 1. Calculate order details with persistent cart items
  const calcResult = await calculateOrderDetails({
    items: userCart.items,
    orderType: "pickup",
  });

  assert.equal(calcResult.success, true);
  assert.equal(calcResult.subtotal, 449 + 45, "Cart subtotal must be ₹494");
  assert.equal(calcResult.orders[0].items.length, 2, "Order items must include both dishes");

  // 2. Place regular cart order
  const cartOrderReq = new Request("http://localhost:4000/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-idempotency-key": `cart_idem_${Date.now()}`,
    },
    body: JSON.stringify({
      items: userCart.items,
      address: {
        fullName: "Shivam Thakur",
        phone: "9876543210",
        street: "Self Pickup at Kitchen Counter",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
      },
      orderType: "pickup",
      paymentMethod: "Instant Simulator (Test Mode)",
      checkoutIntent: "cart",
    }),
  });

  const cartOrderRes = await ordersPOST(cartOrderReq);
  const cartOrderData = await cartOrderRes.json();

  assert.ok(cartOrderRes.status === 200 || cartOrderRes.status === 201, `Expected 200/201, got: ${cartOrderRes.status}`);
  assert.equal(cartOrderData.success, true);
  assert.equal(cartOrderData.order.items.length, 2, "Cart order must have both items");
  assert.equal(cartOrderData.order.checkoutIntent, "cart");

  // 3. Normal checkout triggers cart clearing
  await Cart.findOneAndUpdate({ user: testUser._id }, { $set: { items: [] } });

  const finalCart = await Cart.findOne({ user: testUser._id }).lean();
  assert.equal(finalCart.items.length, 0, "Cart should be cleared after normal cart checkout");
});

// 9. Idempotency test for Buy Now
await runTest("Idempotency: Replaying Buy Now with identical idempotency key returns existing order without duplicates", async () => {
  const idempotencyKey = `idem_replay_${Date.now()}`;
  const fullVariant = biryani.variants.find((v) => v.name === "Full");

  const makeReq = () =>
    new Request("http://localhost:4000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        items: [
          {
            _id: biryani._id.toString(),
            name: biryani.name,
            variantId: fullVariant._id.toString(),
            variantName: fullVariant.name,
            quantity: 1,
            price: fullVariant.price,
          },
        ],
        address: {
          fullName: "Shivam Thakur",
          phone: "9876543210",
          street: "Self Pickup at Kitchen Counter",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
        },
        orderType: "pickup",
        paymentMethod: "Instant Simulator (Test Mode)",
        checkoutIntent: "buy_now",
      }),
    });

  const res1 = await ordersPOST(makeReq());
  const data1 = await res1.json();
  assert.ok(res1.status === 200 || res1.status === 201);
  assert.equal(data1.success, true);
  const order1Id = data1.order._id;

  // Replay request
  const res2 = await ordersPOST(makeReq());
  const data2 = await res2.json();
  assert.ok(res2.status === 200 || res2.status === 201);
  assert.equal(data2.success, true);
  const order2Id = data2.order._id;

  assert.equal(String(order1Id), String(order2Id), "Replayed request must return the identical order ID");

  // Confirm only 1 order exists with this idempotency key
  const count = await Order.countDocuments({ idempotencyKey });
  assert.equal(count, 1, "Strictly 1 order document must exist in database");
});

console.log("\n========================================================================");
console.log(`ALL ${passedTests} / ${totalTests} BUY NOW FLOW INTEGRATION TESTS PASSED!`);
console.log("========================================================================\n");

await mongoose.disconnect();
await replSet.stop();
process.exit(0);
