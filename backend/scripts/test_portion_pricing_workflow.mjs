import { register } from "node:module";
import { pathToFileURL } from "node:url";
register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);

import mongoose from "mongoose";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";

console.log("========================================================================");
console.log("PET PROTOCOLS — FOOD PORTION, SERVING SIZE & PRICING TEST SUITE");
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
console.log(`Connected to isolated test database: ${MONGODB_URI}\n`);

await mongoose.connect(MONGODB_URI);

const Product = (await import("../models/Product.js")).default;
const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;
const { calculateOrderDetails } = await import("../lib/checkoutCalculationService.js");

const {
  POST: productsPOST,
  GET: productsGET,
  _setTestRequireRestaurantAdmin: setProductsAuth,
} = await import("../app/api/restaurant/products/route.js");

const {
  PUT: productPUT,
  DELETE: productDELETE,
  _setTestRequireRestaurantAdmin: setProductDetailAuth,
} = await import("../app/api/restaurant/products/[id]/route.js");

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

try {
  // ── FIXTURES ───────────────────────────────────────────────────────────
  const restA = await Restaurant.create({
    name: "Tandoori Flames Kitchen",
    slug: "tandoori-flames",
    ownerEmail: "owner.tandoori@test.com",
    address: { street: "123 Food Street", city: "New Delhi", state: "Delhi", pincode: "110001" },
    status: "active",
    chargeSettings: { flatDeliveryFee: 40, freeDeliveryThreshold: 500 },
  });

  const restB = await Restaurant.create({
    name: "Sweet Delights Corner",
    slug: "sweet-delights",
    ownerEmail: "owner.sweets@test.com",
    address: { street: "456 Sugar Lane", city: "New Delhi", state: "Delhi", pincode: "110002" },
    status: "active",
  });

  const customerUser = await User.create({
    name: "Vikram Mehta",
    email: "vikram@test.com",
    phone: "9811223344",
    role: "customer",
  });

  setProductsAuth(() => ({ restaurantId: restA._id.toString() }));
  setProductDetailAuth(() => ({ restaurantId: restA._id.toString() }));

  let pieceDishId = null;
  let weightDishId = null;
  let volumeDishId = null;
  let legacyDishId = null;
  let variantDishId = null;

  // ── TEST 1: Piece-based portion item ──────────────────────────────────
  await runTest("Create dish with piece-based portion (e.g. 2 pieces per plate)", async () => {
    const req = new Request("http://localhost:4000/api/restaurant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Chef Special Dumpling Platter",
        description: "Steamed artisan dumplings with dipping sauces",
        price: 180,
        category: "Starters",
        portion: {
          quantity: 6,
          unit: "pieces",
          servingLabel: "6 pieces per plate",
        },
      }),
    });

    const res = await productsPOST(req);
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.product.name, "Chef Special Dumpling Platter");
    assert.strictEqual(data.product.price, 180);
    assert.strictEqual(data.product.portion.quantity, 6);
    assert.strictEqual(data.product.portion.unit, "pieces");
    assert.strictEqual(data.product.portion.servingLabel, "6 pieces per plate");
    pieceDishId = data.product._id;
  });

  // ── TEST 2: Weight-based portion item ─────────────────────────────────
  await runTest("Create dish with weight-based portion (e.g. 250 g serving)", async () => {
    const req = new Request("http://localhost:4000/api/restaurant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Artisan Paneer Tikka",
        description: "Smoked cottage cheese cubes with peppers",
        price: 240,
        category: "Starters",
        portion: {
          quantity: 250,
          unit: "g",
          servingLabel: "250 g box (serves 1-2)",
        },
      }),
    });

    const res = await productsPOST(req);
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.product.portion.quantity, 250);
    assert.strictEqual(data.product.portion.unit, "g");
    assert.strictEqual(data.product.portion.servingLabel, "250 g box (serves 1-2)");
    weightDishId = data.product._id;
  });

  // ── TEST 3: Volume-based portion item ─────────────────────────────────
  await runTest("Create dish with volume-based portion (e.g. 300 ml bowl)", async () => {
    const req = new Request("http://localhost:4000/api/restaurant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Wild Mushroom Velouté",
        description: "Creamy wild mushroom soup with truffle oil",
        price: 160,
        category: "Soups",
        portion: {
          quantity: 300,
          unit: "ml",
          servingLabel: "300 ml gourmet bowl",
        },
      }),
    });

    const res = await productsPOST(req);
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.product.portion.quantity, 300);
    assert.strictEqual(data.product.portion.unit, "ml");
    assert.strictEqual(data.product.portion.servingLabel, "300 ml gourmet bowl");
    volumeDishId = data.product._id;
  });

  // ── TEST 4: Backward compatibility legacy item without portion metadata
  await runTest("Create and support legacy dishes without portion metadata", async () => {
    const req = new Request("http://localhost:4000/api/restaurant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Classic Garlic Naan",
        description: "Clay oven baked bread brushed with garlic butter",
        price: 60,
        category: "Breads",
        // No portion or variants supplied
      }),
    });

    const res = await productsPOST(req);
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.product.price, 60);
    assert.strictEqual(data.product.hasVariants, false);
    assert.ok(data.product.portion === null || data.product.portion?.quantity == null);
    legacyDishId = data.product._id;
  });

  // ── TEST 5: Size-based variants creation & editing ────────────────────
  await runTest("Create dish with size-based variants (Small, Medium, Large)", async () => {
    const req = new Request("http://localhost:4000/api/restaurant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Gourmet Woodfired Pizza",
        description: "Hand-stretched sourdough with fresh mozzarella and basil",
        price: 299,
        category: "Pizza",
        hasVariants: true,
        variants: [
          { name: "Small (7 in)", price: 199, size: "7 inches", portionQuantity: 4, portionUnit: "slices", servingLabel: "Serves 1", isAvailable: true },
          { name: "Medium (10 in)", price: 299, size: "10 inches", portionQuantity: 6, portionUnit: "slices", servingLabel: "Serves 2", isAvailable: true },
          { name: "Large (12 in)", price: 449, size: "12 inches", portionQuantity: 8, portionUnit: "slices", servingLabel: "Serves 3-4", isAvailable: true },
        ],
      }),
    });

    const res = await productsPOST(req);
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.product.hasVariants, true);
    assert.strictEqual(data.product.variants.length, 3);
    assert.strictEqual(data.product.variants[0].name, "Small (7 in)");
    assert.strictEqual(data.product.variants[0].price, 199);
    assert.strictEqual(data.product.variants[1].name, "Medium (10 in)");
    assert.strictEqual(data.product.variants[1].price, 299);
    assert.strictEqual(data.product.variants[2].name, "Large (12 in)");
    assert.strictEqual(data.product.variants[2].price, 449);
    variantDishId = data.product._id;
  });

  await runTest("Edit variant pricing and mark a variant out of stock", async () => {
    const req = new Request(`http://localhost:4000/api/restaurant/products/${variantDishId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Gourmet Woodfired Pizza",
        price: 319,
        hasVariants: true,
        variants: [
          { name: "Small (7 in)", price: 209, size: "7 inches", portionQuantity: 4, portionUnit: "slices", isAvailable: true },
          { name: "Medium (10 in)", price: 319, size: "10 inches", portionQuantity: 6, portionUnit: "slices", isAvailable: true },
          { name: "Large (12 in)", price: 469, size: "12 inches", portionQuantity: 8, portionUnit: "slices", isAvailable: false }, // marked out of stock
        ],
      }),
    });

    const res = await productPUT(req, { params: Promise.resolve({ id: variantDishId }) });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.product.variants[0].price, 209);
    assert.strictEqual(data.product.variants[2].isAvailable, false);
  });

  // ── TEST 6: Input validation (Invalid prices and quantities) ───────────
  await runTest("Reject negative base price", async () => {
    const req = new Request("http://localhost:4000/api/restaurant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Faulty Dish",
        price: -50,
        category: "Desserts",
      }),
    });

    const res = await productsPOST(req);
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes("non-negative"));
  });

  await runTest("Reject negative or zero portion quantity", async () => {
    const req = new Request("http://localhost:4000/api/restaurant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Zero Portion Dish",
        price: 120,
        category: "Desserts",
        portion: { quantity: 0, unit: "pieces" },
      }),
    });

    const res = await productsPOST(req);
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes("positive number"));
  });

  await runTest("Reject variant with negative price", async () => {
    const req = new Request("http://localhost:4000/api/restaurant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bad Variant Dish",
        price: 100,
        category: "Desserts",
        hasVariants: true,
        variants: [{ name: "Mini", price: -10 }],
      }),
    });

    const res = await productsPOST(req);
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes("non-negative"));
  });

  // ── TEST 7: Variant selection & Authoritative price lookup ─────────────
  await runTest("Authoritative price calculation resolves correct variant price", async () => {
    const calculation = await calculateOrderDetails({
      items: [
        {
          _id: variantDishId,
          variantName: "Small (7 in)",
          quantity: 2,
        },
      ],
      orderType: "pickup",
    });

    assert.strictEqual(calculation.success, true);
    assert.strictEqual(calculation.subtotal, 209 * 2); // 418
    const orderItem = calculation.primaryOrder.items[0];
    assert.strictEqual(orderItem.price, 209);
    assert.strictEqual(orderItem.variantName, "Small (7 in)");
    assert.strictEqual(orderItem.portionQuantity, 4);
    assert.strictEqual(orderItem.portionUnit, "slices");
  });

  // ── TEST 8: Cart quantity multiplication ──────────────────────────────
  await runTest("Verify ordered quantity multiplies unit price correctly without altering configured serving", async () => {
    const calculation = await calculateOrderDetails({
      items: [
        {
          _id: pieceDishId,
          quantity: 3,
        },
      ],
      orderType: "pickup",
    });

    assert.strictEqual(calculation.success, true);
    // 3 servings of 6 pieces each at ₹180 = ₹540 total
    assert.strictEqual(calculation.subtotal, 180 * 3);
    const orderItem = calculation.primaryOrder.items[0];
    assert.strictEqual(orderItem.quantity, 3);
    assert.strictEqual(orderItem.portionQuantity, 6);
    assert.strictEqual(orderItem.portionUnit, "pieces");
    assert.strictEqual(orderItem.servingLabel, "6 pieces per plate");
  });

  // ── TEST 9: Add-on price calculations ─────────────────────────────────
  await runTest("Add-on calculations integrate seamlessly with variant pricing", async () => {
    const calculation = await calculateOrderDetails({
      items: [
        {
          _id: variantDishId,
          variantName: "Medium (10 in)", // ₹319
          quantity: 2,
          selectedOptions: [
            { name: "Extra Mozzarella", price: 50 },
            { name: "Garlic Dip", price: 30 },
          ],
        },
      ],
      orderType: "pickup",
    });

    assert.strictEqual(calculation.success, true);
    // (319 + 50 + 30) * 2 = 399 * 2 = 798
    assert.strictEqual(calculation.subtotal, 798);
    const orderItem = calculation.primaryOrder.items[0];
    assert.strictEqual(orderItem.price, 319);
    assert.strictEqual(orderItem.selectedOptions.length, 2);
  });

  // ── TEST 10 & 11: Server-authoritative checkout & Tampered price rejection
  await runTest("Server rejects client-tampered prices and enforces database authoritative price", async () => {
    const calculation = await calculateOrderDetails({
      items: [
        {
          _id: variantDishId,
          variantName: "Medium (10 in)",
          price: 1, // Malicious user submitted ₹1 instead of ₹319
          quantity: 1,
        },
      ],
      orderType: "pickup",
    });

    assert.strictEqual(calculation.success, true);
    assert.strictEqual(calculation.subtotal, 319);
    assert.strictEqual(calculation.primaryOrder.items[0].price, 319);
  });

  // ── TEST 12: Rejection of unavailable variants ────────────────────────
  await runTest("Server rejects ordering an out-of-stock variant", async () => {
    const calculation = await calculateOrderDetails({
      items: [
        {
          _id: variantDishId,
          variantName: "Large (12 in)", // Was marked isAvailable: false in Test 5
          quantity: 1,
        },
      ],
      orderType: "pickup",
    });

    assert.strictEqual(calculation.success, false);
    assert.strictEqual(calculation.status, 400);
    assert.ok(calculation.message.includes("out of stock"));
  });

  // ── TEST 13: Restaurant tenant isolation ───────────────────────────────
  await runTest("Restaurant B cannot modify or delete Restaurant A's dish", async () => {
    setProductDetailAuth(() => ({ restaurantId: restB._id.toString() })); // Authenticated as Restaurant B

    const req = new Request(`http://localhost:4000/api/restaurant/products/${pieceDishId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked Dish Name", price: 10 }),
    });

    const res = await productPUT(req, { params: Promise.resolve({ id: pieceDishId }) });
    const data = await res.json();
    assert.strictEqual(res.status, 404);
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes("not owned by your restaurant"));

    // Reset auth back to Restaurant A
    setProductDetailAuth(() => ({ restaurantId: restA._id.toString() }));
  });

  // ── TEST 14: Historical order snapshots after menu edits ───────────────
  let historicalOrderId = null;
  await runTest("Create order snapshot preserving variant name and portion metadata", async () => {
    const calculation = await calculateOrderDetails({
      items: [
        {
          _id: pieceDishId,
          quantity: 2,
        },
        {
          _id: variantDishId,
          variantName: "Small (7 in)",
          quantity: 1,
        },
      ],
      orderType: "delivery",
    });

    assert.strictEqual(calculation.success, true);
    const order = await Order.create({
      orderId: `ORD_PORTION_HIST_${Date.now()}`,
      user: customerUser._id,
      restaurant: restA._id,
      items: calculation.primaryOrder.items,
      totalAmount: calculation.totalAmount,
      subtotal: calculation.subtotal,
      deliveryFee: calculation.deliveryFee,
      status: "delivered",
      orderType: "delivery",
      address: { fullName: "Vikram Mehta", phone: "9811223344", street: "123 Main St", city: "New Delhi", pincode: "110001" },
    });

    assert.ok(order._id);
    historicalOrderId = order._id;
    assert.strictEqual(order.items[0].portionQuantity, 6);
    assert.strictEqual(order.items[0].portionUnit, "pieces");
    assert.strictEqual(order.items[1].variantName, "Small (7 in)");
    assert.strictEqual(order.items[1].price, 209);
  });

  await runTest("Edit menu dish prices and verify historical order totals and portion snapshots remain immutable", async () => {
    // Restaurant updates prices on the active menu
    await Product.findByIdAndUpdate(pieceDishId, { price: 999, "portion.quantity": 12 });
    await Product.findByIdAndUpdate(variantDishId, { "variants.0.price": 888 });

    // Reload historical order from DB
    const savedOrder = await Order.findById(historicalOrderId);
    assert.strictEqual(savedOrder.items[0].price, 180); // Preserved original ₹180, NOT ₹999
    assert.strictEqual(savedOrder.items[0].portionQuantity, 6); // Preserved original 6, NOT 12
    assert.strictEqual(savedOrder.items[0].servingLabel, "6 pieces per plate");
    assert.strictEqual(savedOrder.items[1].price, 209); // Preserved original ₹209, NOT ₹888
    assert.strictEqual(savedOrder.items[1].variantName, "Small (7 in)");
  });

  // ── TEST 15: Legacy orders compatibility ──────────────────────────────
  await runTest("Legacy orders without portion metadata read cleanly without error", async () => {
    const legacyOrder = await Order.create({
      orderId: `ORD_LEGACY_PAST_${Date.now()}`,
      user: customerUser._id,
      restaurant: restA._id,
      items: [{ name: "Vintage Samosa", price: 30, quantity: 2 }],
      totalAmount: 60,
      status: "delivered",
      orderType: "pickup",
      address: { fullName: "Vikram Mehta", phone: "9811223344" },
    });

    const loaded = await Order.findById(legacyOrder._id);
    assert.strictEqual(loaded.items[0].name, "Vintage Samosa");
    assert.strictEqual(loaded.items[0].variantName, null);
    assert.strictEqual(loaded.items[0].portionQuantity, null);
    assert.strictEqual(loaded.items[0].portionUnit, null);
    assert.strictEqual(loaded.items[0].servingLabel, null);
  });

  // ── TEST 16: Cashier / POS price consistency ──────────────────────────
  await runTest("Cashier bill and tax receipt calculate identical subtotal and tax as customer order", async () => {
    const savedOrder = await Order.findById(historicalOrderId);
    const cashierItemsSubtotal = savedOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    assert.strictEqual(cashierItemsSubtotal, (180 * 2) + 209); // 569
    assert.strictEqual(cashierItemsSubtotal, savedOrder.subtotal);
  });

  // ── TEST 17: Existing discount, tax, and delivery fee behavior ─────────
  await runTest("Delivery fee and tax behavior remain strictly compliant", async () => {
    const calculation = await calculateOrderDetails({
      items: [
        {
          _id: legacyDishId,
          quantity: 2, // 60 * 2 = 120 (below free delivery threshold 500)
        },
      ],
      orderType: "delivery",
    });

    assert.strictEqual(calculation.success, true);
    assert.strictEqual(calculation.subtotal, 120);
    assert.strictEqual(calculation.deliveryFee, 40); // ₹40 standard delivery applied
    assert.strictEqual(calculation.totalAmount, 120 + 40);
  });

  console.log("\n========================================================================");
  console.log(`ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions verified successfully!`);
  console.log("========================================================================");
} catch (error) {
  console.error("Test suite execution failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  await replSet.stop();
  console.log("Isolated test database stopped successfully.");
}
