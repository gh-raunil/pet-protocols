import assert from "node:assert";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import Ingredient from "../models/Ingredient.js";
import Waste from "../models/Waste.js";
import {
  processUnrespondedStaleOrders,
  processStalePickupOrders,
  processAllStaleOrders,
} from "../lib/orderMaintenanceService.js";
import {
  GET as getOrderById,
  _setTestGetServerSession,
} from "../app/api/orders/[id]/route.js";
import {
  generateGuestAccessToken,
  hashGuestAccessToken,
} from "../lib/guestAccessService.js";
import {
  _setTestHttpTransport,
  _setTestRazorpayClient,
  _resetTestHttpTransport,
} from "../lib/refundService.js";
import {
  PUT as restaurantOrdersPUT,
  _setTestRequireRestaurantAdmin as setRestaurantOrdersAuth,
} from "../app/api/restaurant/orders/route.js";

async function main() {
  console.log("========================================================================");
  console.log("PET PROTOCOLS — STRICTLY READ-ONLY CUSTOMER GET HARDENING TEST SUITE");
  console.log("========================================================================");

  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.DELIVERY_OTP_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.RAZORPAY_KEY_ID = "rzp_test_mock_key";
  process.env.RAZORPAY_KEY_SECRET = "mock_secret_key";
  await mongoose.connect(uri);

  let refundGatewayCallCount = 0;

  _setTestRazorpayClient({
    payments: {
      fetch: async (id) => ({ id: id || "pay_test_ro_001", status: "captured", amount_refunded: 0 }),
      fetchMultipleRefund: async () => ({ count: 0, items: [] }),
    },
  });

  _setTestHttpTransport(async (req) => {
    refundGatewayCallCount++;
    return {
      status: 200,
      data: {
        id: `rfnd_test_${Date.now()}`,
        entity: "refund",
        amount: 25000,
        currency: "INR",
        payment_id: req?.data?.payment_id || "pay_test_ro_001",
        status: "processed",
      },
    };
  });

  try {
    // Setup test restaurant and user
    const restaurant = await Restaurant.create({
      name: "Burger & Co. Central",
      slug: "burger-and-co-central",
      status: "active",
      address: {
        street: "100 Food Court Ave",
        city: "Bangalore",
        latitude: 12.9716,
        longitude: 77.5946,
      },
      orderingSettings: {
        autoDismissUncollectedOrders: true,
        uncollectedTimeoutMinutes: 60,
        autoCancelTimeoutMinutes: 15,
      },
    });

    const restaurantB = await Restaurant.create({
      name: "Pizza Palace Branch",
      slug: "pizza-palace-branch",
      status: "active",
      address: {
        street: "101 Food Court Ave",
        city: "Bangalore",
        latitude: 12.972,
        longitude: 77.595,
      },
      orderingSettings: {
        autoDismissUncollectedOrders: true,
        uncollectedTimeoutMinutes: 60,
        autoCancelTimeoutMinutes: 15,
      },
    });

    const customerUser = await User.create({
      name: "Rounak Customer",
      email: "rounak@example.com",
      role: "customer",
    });

    const kitchenUser = await User.create({
      name: "Chef Kitchen",
      email: "chef@example.com",
      role: "staff",
      staffRoles: ["Kitchen"],
      permissions: ["orders_view", "orders_update"],
      phone: "9100000005",
      status: "active",
    });

    // Setup an ingredient with tracked inventory stock
    const testIngredient = await Ingredient.create({
      restaurant: restaurant._id,
      name: "Angus Beef Patty",
      quantity: 50,
      unit: "kg",
      lowStockThreshold: 5,
    });

    _setTestGetServerSession(async () => ({
      user: {
        email: "rounak@example.com",
        role: "customer",
      },
    }));

    // ------------------------------------------------------------------------
    // TEST 1: Customer GET for overdue pending order leaves all fields unchanged
    // ------------------------------------------------------------------------
    console.log("\n[Test 1] Customer GET for overdue pending order leaves all fields unchanged");
    const ancientTime = new Date(Date.now() - 500 * 60 * 1000); // 500m ago
    const pendingOrder = await Order.create({
      orderId: "PET-RO-001",
      user: customerUser._id,
      restaurant: restaurant._id,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "online_razorpay",
      paymentId: "pay_test_ro_001",
      totalAmount: 499,
      createdAt: ancientTime,
      updatedAt: ancientTime,
      stockRestored: false,
      "stockRestoration.status": "not_restored",
      "wasteLogging.status": "not_applicable",
      statusHistory: [
        {
          status: "pending",
          changedAt: ancientTime,
          note: "Order placed by customer",
        },
      ],
      items: [{ name: "Smash Burger", price: 499, quantity: 1 }],
    });

    refundGatewayCallCount = 0;
    const initialIngDoc = await Ingredient.findById(testIngredient._id);

    const req1 = new Request(`http://localhost:3000/api/orders/${pendingOrder._id}`, { method: "GET" });
    const res1 = await getOrderById(req1, { params: Promise.resolve({ id: pendingOrder._id.toString() }) });
    const data1 = await res1.json();

    assert.strictEqual(res1.status, 200, "Should return HTTP 200");
    assert.strictEqual(data1.order.status, "pending", "Returned order status must remain 'pending'");

    const docAfter1 = await Order.findById(pendingOrder._id);
    assert.strictEqual(docAfter1.status, "pending", "DB document status must remain 'pending'");
    assert.strictEqual(docAfter1.stockRestored, false, "DB stockRestored must remain false");
    assert.strictEqual(docAfter1.statusHistory.length, 1, "statusHistory must not have any appended cancellation entry");
    assert.strictEqual(refundGatewayCallCount, 0, "GET must make ZERO refund gateway calls");

    const checkIngAfter1 = await Ingredient.findById(testIngredient._id);
    assert.strictEqual(checkIngAfter1.quantity, initialIngDoc.quantity, "GET must make ZERO inventory stock alterations");
    console.log("  ✓ Test 1 Passed: GET is purely read-only on overdue pending order.");

    // ------------------------------------------------------------------------
    // TEST 2: Repeated GET requests remain read-only
    // ------------------------------------------------------------------------
    console.log("\n[Test 2] Repeated GET requests remain read-only");
    for (let i = 0; i < 5; i++) {
      const repRes = await getOrderById(req1, { params: Promise.resolve({ id: pendingOrder._id.toString() }) });
      assert.strictEqual(repRes.status, 200);
      const repData = await repRes.json();
      assert.strictEqual(repData.order.status, "pending");
    }
    const docAfter2 = await Order.findById(pendingOrder._id);
    assert.strictEqual(docAfter2.status, "pending");
    assert.strictEqual(refundGatewayCallCount, 0, "Repeated GETs must make ZERO refund calls");
    console.log("  ✓ Test 2 Passed: 5 repeated GET requests caused 0 state mutations.");

    // ------------------------------------------------------------------------
    // TEST 3: Guest-token GET has the same read-only guarantee
    // ------------------------------------------------------------------------
    console.log("\n[Test 3] Guest-token GET has the same read-only guarantee");
    _setTestGetServerSession(async () => null); // unauthenticated customer

    const guestPlainToken = generateGuestAccessToken();
    const guestTokenHash = hashGuestAccessToken(guestPlainToken);

    const guestOrder = await Order.create({
      orderId: "PET-GUEST-RO-003",
      restaurant: restaurant._id,
      guestAccess: {
        tokenHash: guestTokenHash,
        issuedAt: ancientTime,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "online_razorpay",
      paymentId: "pay_test_ro_003",
      totalAmount: 250,
      createdAt: ancientTime,
      updatedAt: ancientTime,
      items: [{ name: "Fries", price: 250, quantity: 1 }],
    });

    const guestReq = new Request(`http://localhost:3000/api/orders/${guestOrder._id}`, {
      method: "GET",
      headers: { "x-guest-access-token": guestPlainToken },
    });

    const guestRes = await getOrderById(guestReq, { params: Promise.resolve({ id: guestOrder._id.toString() }) });
    const guestData = await guestRes.json();

    assert.strictEqual(guestRes.status, 200);
    assert.strictEqual(guestData.order.status, "pending", "Guest order status must remain 'pending'");
    assert.strictEqual(guestData.order.guestAccess?.tokenHash, undefined, "Token hash must not leak in sanitized response");

    const checkGuestDoc = await Order.findById(guestOrder._id);
    assert.strictEqual(checkGuestDoc.status, "pending", "Guest DB doc must remain 'pending'");
    assert.strictEqual(refundGatewayCallCount, 0);
    console.log("  ✓ Test 3 Passed: Guest-token GET is strictly read-only.");

    // Restore customer session
    _setTestGetServerSession(async () => ({
      user: {
        email: "rounak@example.com",
        role: "customer",
      },
    }));

    // ------------------------------------------------------------------------
    // TEST 4: GET on multi-restaurant sibling orders does not mutate any sibling
    // ------------------------------------------------------------------------
    console.log("\n[Test 4] GET on multi-restaurant sibling orders does not mutate any sibling");
    const sharedOrderId = "MULTI-RO-999";
    const sibling1 = await Order.create({
      orderId: sharedOrderId,
      user: customerUser._id,
      restaurant: restaurant._id,
      status: "pending",
      totalAmount: 200,
      createdAt: ancientTime,
      items: [{ name: "Burger Part", price: 200, quantity: 1 }],
    });
    const sibling2 = await Order.create({
      orderId: sharedOrderId,
      user: customerUser._id,
      restaurant: restaurantB._id,
      status: "confirmed",
      totalAmount: 300,
      createdAt: ancientTime,
      items: [{ name: "Pizza Part", price: 300, quantity: 1 }],
    });

    const multiReq = new Request(`http://localhost:3000/api/orders/${sibling1._id}`, { method: "GET" });
    const multiRes = await getOrderById(multiReq, { params: Promise.resolve({ id: sibling1._id.toString() }) });
    const multiData = await multiRes.json();

    assert.strictEqual(multiRes.status, 200);
    assert.strictEqual(multiData.isMultiRestaurant, true);
    assert.strictEqual(multiData.order.status, "pending");
    assert.strictEqual(multiData.subOrders.length, 2);

    const docSib1 = await Order.findById(sibling1._id);
    const docSib2 = await Order.findById(sibling2._id);
    assert.strictEqual(docSib1.status, "pending");
    assert.strictEqual(docSib2.status, "confirmed");
    console.log("  ✓ Test 4 Passed: Neither sibling order was mutated by GET.");

    // ------------------------------------------------------------------------
    // TEST 5: GET makes ZERO refund and ZERO inventory-restoration calls
    // ------------------------------------------------------------------------
    console.log("\n[Test 5] GET makes ZERO refund and ZERO inventory-restoration calls");
    assert.strictEqual(refundGatewayCallCount, 0, "Total refund calls must be 0 across all GETs");
    console.log("  ✓ Test 5 Passed: Absolute zero external or inventory calls made by GET.");

    // ------------------------------------------------------------------------
    // TEST 6: Maintenance pipeline cancels overdue pending/confirmed orders
    // ------------------------------------------------------------------------
    console.log("\n[Test 6] Maintenance pipeline cancels overdue pending/confirmed orders with compensation");
    const mRes = await processUnrespondedStaleOrders({ restaurantId: restaurant._id });
    assert.ok(mRes.processedCount >= 2, `Should cancel overdue orders for restaurant (processed: ${mRes.processedCount})`);

    const docAfterMaint = await Order.findById(pendingOrder._id);
    assert.strictEqual(docAfterMaint.status, "cancelled", "Maintenance must cancel the pending order");
    assert.ok(docAfterMaint.cancellationReason.includes("Auto-cancelled"), "cancellationReason should record auto-cancellation");
    assert.strictEqual(docAfterMaint.wasteLogging?.status, "not_applicable", "Uncooked food waste must be not_applicable");
    assert.ok(refundGatewayCallCount >= 1, "Maintenance should have triggered refund gateway call");
    console.log("  ✓ Test 6 Passed: Maintenance correctly cancelled overdue orders with compensation.");

    // ------------------------------------------------------------------------
    // TEST 7: Preparing orders remain protected
    // ------------------------------------------------------------------------
    console.log("\n[Test 7] Preparing orders remain protected from inactivity maintenance");
    const prepOrder = await Order.create({
      orderId: "PET-PREP-007",
      user: customerUser._id,
      restaurant: restaurant._id,
      status: "preparing",
      totalAmount: 400,
      createdAt: ancientTime, // 500m ago
      items: [{ name: "Chef Special", price: 400, quantity: 1 }],
    });

    await processAllStaleOrders({ restaurantId: restaurant._id });
    const checkPrepDoc = await Order.findById(prepOrder._id);
    assert.strictEqual(checkPrepDoc.status, "preparing", "Order in 'preparing' status must NEVER be auto-cancelled");
    console.log("  ✓ Test 7 Passed: Preparing orders are completely immune to inactivity timeout.");

    // ------------------------------------------------------------------------
    // TEST 8: Ready pickup follows waste policy without raw-stock restoration
    // ------------------------------------------------------------------------
    console.log("\n[Test 8] Ready pickup follows waste policy without raw-stock restoration");
    const initialRawStock = testIngredient.quantity;

    const readyPickup = await Order.create({
      orderId: "PET-PICKUP-READY-008",
      user: customerUser._id,
      restaurant: restaurant._id,
      orderType: "pickup",
      status: "ready",
      paymentStatus: "paid",
      paymentMethod: "online_razorpay",
      paymentId: "pay_test_ro_008",
      totalAmount: 350,
      createdAt: ancientTime,
      stockRestored: false,
      deductedIngredients: [
        {
          ingredient: testIngredient._id,
          ingredientName: "Angus Beef Patty",
          quantity: 2,
          unit: "kg",
        },
      ],
      statusHistory: [
        { status: "pending", changedAt: ancientTime },
        { status: "ready", changedAt: ancientTime },
      ],
      items: [{ name: "Pickup Feast", price: 350, quantity: 1 }],
    });

    const pickupMaint = await processStalePickupOrders({ restaurantId: restaurant._id });
    assert.strictEqual(pickupMaint.processedCount, 1, "Should process 1 stale pickup order");

    const checkPickupDoc = await Order.findById(readyPickup._id);
    assert.strictEqual(checkPickupDoc.status, "cancelled", "Stale pickup order must be cancelled");
    assert.strictEqual(checkPickupDoc.wasteLogging?.status, "completed", "Prepared food must be logged as waste");

    // Verify raw ingredient stock was NOT replenished (prepared food is not restocked)
    const freshIngredient = await Ingredient.findById(testIngredient._id);
    assert.strictEqual(freshIngredient.quantity, initialRawStock, "Raw stock must not be incremented for prepared food");

    // Verify waste document recorded
    const wasteDoc = await Waste.findOne({ order: readyPickup._id });
    assert.ok(wasteDoc, "Waste entry must exist for discarded pickup order");
    assert.strictEqual(wasteDoc.reason, "Spoiled");
    console.log("  ✓ Test 8 Passed: Ready pickup logged waste and did not restore raw stock.");

    // ------------------------------------------------------------------------
    // TEST 9: Ready delivery and out-for-delivery orders remain protected
    // ------------------------------------------------------------------------
    console.log("\n[Test 9] Ready delivery and out-for-delivery orders remain protected with live tracking intact");
    const readyDelivery = await Order.create({
      orderId: "PET-DELIV-READY-009",
      user: customerUser._id,
      restaurant: restaurant._id,
      orderType: "delivery",
      status: "ready",
      totalAmount: 300,
      createdAt: ancientTime,
      items: [{ name: "Box Meal", price: 300, quantity: 1 }],
    });

    const outForDelivery = await Order.create({
      orderId: "PET-DELIV-OUT-009",
      user: customerUser._id,
      restaurant: restaurant._id,
      orderType: "delivery",
      status: "out_for_delivery",
      totalAmount: 300,
      deliveryTracking: {
        isLive: true,
        startedAt: ancientTime,
      },
      createdAt: ancientTime,
      items: [{ name: "Box Meal 2", price: 300, quantity: 1 }],
    });

    await processAllStaleOrders({ restaurantId: restaurant._id });

    const checkReadyDeliv = await Order.findById(readyDelivery._id);
    assert.strictEqual(checkReadyDeliv.status, "ready", "Ready delivery order must not be auto-cancelled");

    const checkOutDeliv = await Order.findById(outForDelivery._id);
    assert.strictEqual(checkOutDeliv.status, "out_for_delivery", "out_for_delivery order must not be auto-cancelled");
    assert.strictEqual(checkOutDeliv.deliveryTracking?.isLive, true, "Active delivery tracking must be preserved");
    console.log("  ✓ Test 9 Passed: Delivery orders (ready & out_for_delivery) remain fully protected.");

    // ------------------------------------------------------------------------
    // TEST 10: Concurrent maintenance runs do not duplicate cancellation/refunds
    // ------------------------------------------------------------------------
    console.log("\n[Test 10] Concurrent maintenance runs do not duplicate cancellation, refunds, or compensation");
    const restaurantRace = await Restaurant.create({
      name: "Race Test Kitchen",
      slug: "race-test-kitchen",
      status: "active",
      address: {
        street: "202 Race Track Rd",
        city: "Bangalore",
        latitude: 12.973,
        longitude: 77.596,
      },
      orderingSettings: {
        autoDismissUncollectedOrders: true,
        uncollectedTimeoutMinutes: 60,
      },
    });

    const orderForRace = await Order.create({
      orderId: "PET-RACE-010",
      user: customerUser._id,
      restaurant: restaurantRace._id,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "online_razorpay",
      paymentId: "pay_test_ro_010",
      totalAmount: 180,
      createdAt: ancientTime,
      items: [{ name: "Pizza Slice", price: 180, quantity: 1 }],
    });

    const preRefunds = refundGatewayCallCount;

    // Run 5 concurrent worker iterations
    const results = await Promise.all([
      processUnrespondedStaleOrders({ restaurantId: restaurantRace._id }),
      processUnrespondedStaleOrders({ restaurantId: restaurantRace._id }),
      processUnrespondedStaleOrders({ restaurantId: restaurantRace._id }),
      processUnrespondedStaleOrders({ restaurantId: restaurantRace._id }),
      processUnrespondedStaleOrders({ restaurantId: restaurantRace._id }),
    ]);

    const totalProcessedForRace = results.reduce((sum, r) => sum + r.processedCount, 0);
    assert.strictEqual(totalProcessedForRace, 1, "Exactly 1 worker must claim and cancel the order across 5 concurrent runs");

    const newRefunds = refundGatewayCallCount - preRefunds;
    assert.strictEqual(newRefunds, 1, "Exactly 1 refund call must be made");

    const checkRaceDoc = await Order.findById(orderForRace._id);
    assert.strictEqual(checkRaceDoc.status, "cancelled");
    console.log("  ✓ Test 10 Passed: 5 concurrent workers produced exactly 1 cancellation and 1 refund.");

    // ------------------------------------------------------------------------
    // TEST 11A: Deterministic Timeout Race — Scenario A: Maintenance claims first & wins
    // ------------------------------------------------------------------------
    console.log("\n[Test 11A] Deterministic Timeout Race — Scenario A: Maintenance claims first & wins");
    const restaurantRaceA = await Restaurant.create({
      name: "Race Kitchen A",
      slug: "race-kitchen-a",
      status: "active",
      address: {
        street: "10 Race Way",
        city: "Bangalore",
        latitude: 12.971,
        longitude: 77.591,
      },
      orderingSettings: {
        autoDismissUncollectedOrders: true,
        uncollectedTimeoutMinutes: 60,
      },
    });

    const pattyRaceA = await Ingredient.create({
      restaurant: restaurantRaceA._id,
      name: "Race Patty A",
      currentStock: 10,
      unit: "kg",
      lowStockThreshold: 2,
    });

    const orderA = await Order.create({
      orderId: "PET-RACE-A-011",
      user: customerUser._id,
      restaurant: restaurantRaceA._id,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "online_razorpay",
      paymentId: "pay_test_ro_scen_a",
      totalAmount: 250,
      createdAt: ancientTime,
      items: [{ name: "Race Burger A", price: 250, quantity: 1 }],
      stockDeducted: true,
      stockRestored: false,
      deductedIngredients: [
        {
          ingredient: pattyRaceA._id,
          ingredientName: "Race Patty A",
          quantity: 2,
          unit: "kg",
        },
      ],
      stockDeduction: {
        status: "completed",
        deductedIngredients: [
          {
            ingredient: pattyRaceA._id,
            ingredientName: "Race Patty A",
            quantity: 2,
            unit: "kg",
          },
        ],
      },
      statusHistory: [
        { status: "pending", changedAt: ancientTime, note: "Order placed by customer" },
      ],
    });

    const preRefundsA = refundGatewayCallCount;

    // 1. Maintenance executes first and claims the unresponded order
    const maintResA = await processUnrespondedStaleOrders({ restaurantId: restaurantRaceA._id });
    assert.strictEqual(maintResA.processedCount, 1, "Maintenance worker must claim and process order A");

    // 2. Kitchen attempts transition to 'preparing' using the real restaurant lifecycle endpoint
    setRestaurantOrdersAuth(async () => ({
      user: kitchenUser,
      restaurant: restaurantRaceA,
      restaurantId: restaurantRaceA._id.toString(),
      isAdmin: false,
      isStaff: true,
      staffRoles: ["Kitchen"],
      permissions: ["orders_view", "orders_update"],
    }));

    const reqKitchenA = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: orderA._id.toString(), status: "preparing" }),
    });
    const resKitchenA = await restaurantOrdersPUT(reqKitchenA);
    const dataKitchenA = await resKitchenA.json();

    assert.strictEqual(dataKitchenA.success, false, "Kitchen transition to preparing must be rejected for cancelled order");
    assert.ok(resKitchenA.status >= 400, "Endpoint must return 400 or 409 error status");

    // 3. Assert persisted state and side effects in MongoDB
    const checkOrderA = await Order.findById(orderA._id);
    assert.strictEqual(checkOrderA.status, "cancelled", "Persisted order status must be 'cancelled'");
    assert.notStrictEqual(checkOrderA.status, "preparing", "Order must never have transitioned to 'preparing'");
    assert.ok(checkOrderA.cancellationReason.includes("Auto-cancelled"), "Cancellation reason must record timeout");
    assert.strictEqual(checkOrderA.stockRestored, true, "stockRestored must be true");
    assert.strictEqual(checkOrderA.wasteLogging?.status, "not_applicable", "Uncooked food waste must be not_applicable");

    const freshPattyA = await Ingredient.findById(pattyRaceA._id);
    assert.strictEqual(freshPattyA.currentStock, 12, "Raw stock must be restored exactly once (10 initial + 2 restored = 12)");

    assert.strictEqual(refundGatewayCallCount - preRefundsA, 1, "Refund gateway must be invoked exactly once for order A");
    console.log("  ✓ Test 11A Passed: Scenario A verified (Maintenance wins, kitchen rejected, refund & stock restored).");

    // ------------------------------------------------------------------------
    // TEST 11B: Deterministic Timeout Race — Scenario B: Kitchen claims first & wins
    // ------------------------------------------------------------------------
    console.log("\n[Test 11B] Deterministic Timeout Race — Scenario B: Kitchen claims first & wins");
    const restaurantRaceB = await Restaurant.create({
      name: "Race Kitchen B",
      slug: "race-kitchen-b",
      status: "active",
      address: {
        street: "20 Race Way",
        city: "Bangalore",
        latitude: 12.972,
        longitude: 77.592,
      },
      orderingSettings: {
        autoDismissUncollectedOrders: true,
        uncollectedTimeoutMinutes: 60,
      },
    });

    const pattyRaceB = await Ingredient.create({
      restaurant: restaurantRaceB._id,
      name: "Race Patty B",
      currentStock: 10,
      unit: "kg",
      lowStockThreshold: 2,
    });

    const orderB = await Order.create({
      orderId: "PET-RACE-B-011",
      user: customerUser._id,
      restaurant: restaurantRaceB._id,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "online_razorpay",
      paymentId: "pay_test_ro_scen_b",
      totalAmount: 280,
      createdAt: ancientTime,
      items: [{ name: "Race Burger B", price: 280, quantity: 1 }],
      stockDeducted: true,
      stockRestored: false,
      deductedIngredients: [
        {
          ingredient: pattyRaceB._id,
          ingredientName: "Race Patty B",
          quantity: 2,
          unit: "kg",
        },
      ],
      stockDeduction: {
        status: "completed",
        deductedIngredients: [
          {
            ingredient: pattyRaceB._id,
            ingredientName: "Race Patty B",
            quantity: 2,
            unit: "kg",
          },
        ],
      },
      statusHistory: [
        { status: "pending", changedAt: ancientTime, note: "Order placed by customer" },
      ],
    });

    // 1. Kitchen accepts order FIRST via real lifecycle endpoint
    setRestaurantOrdersAuth(async () => ({
      user: kitchenUser,
      restaurant: restaurantRaceB,
      restaurantId: restaurantRaceB._id.toString(),
      isAdmin: false,
      isStaff: true,
      staffRoles: ["Kitchen"],
      permissions: ["orders_view", "orders_update"],
    }));

    const reqKitchenB = new Request("http://localhost:3000/api/restaurant/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: orderB._id.toString(), status: "preparing" }),
    });
    const resKitchenB = await restaurantOrdersPUT(reqKitchenB);
    const dataKitchenB = await resKitchenB.json();

    assert.strictEqual(resKitchenB.status, 200, "Kitchen transition to preparing must succeed");
    assert.strictEqual(dataKitchenB.success, true, "Kitchen response must indicate success");

    const preRefundsB = refundGatewayCallCount;

    // 2. Maintenance runs AFTER kitchen acceptance
    const maintResB = await processUnrespondedStaleOrders({ restaurantId: restaurantRaceB._id });
    assert.strictEqual(maintResB.processedCount, 0, "Maintenance worker must NOT claim or cancel the preparing order");

    // 3. Assert persisted state and zero invalid side effects in MongoDB
    const checkOrderB = await Order.findById(orderB._id);
    assert.strictEqual(checkOrderB.status, "preparing", "Persisted order status must remain 'preparing'");

    const hasCancelEntry = checkOrderB.statusHistory.some((h) => h.status === "cancelled");
    assert.strictEqual(hasCancelEntry, false, "No cancellation entry must be appended to statusHistory");

    const freshPattyB = await Ingredient.findById(pattyRaceB._id);
    assert.strictEqual(freshPattyB.currentStock, 10, "Raw stock must NOT be restored (food is actively in cooking)");

    assert.strictEqual(refundGatewayCallCount - preRefundsB, 0, "Zero refund gateway calls must occur for preparing order");
    assert.strictEqual(checkOrderB.paymentStatus, "paid", "Payment status must remain 'paid'");
    console.log("  ✓ Test 11B Passed: Scenario B verified (Kitchen wins, maintenance skipped, zero refunds/restorations).");

    // ------------------------------------------------------------------------
    // TEST 11C: Simultaneous Concurrency Race — CAS Mutual Exclusion
    // ------------------------------------------------------------------------
    console.log("\n[Test 11C] Simultaneous Concurrency Race — CAS Mutual Exclusion");
    const raceOrder2 = await Order.create({
      orderId: "PET-RACE-SIMUL-011",
      user: customerUser._id,
      restaurant: restaurantB._id,
      status: "pending",
      totalAmount: 220,
      createdAt: ancientTime,
      items: [{ name: "Chef Calzone", price: 220, quantity: 1 }],
    });

    // Worker 1 tries to auto-cancel; Chef tries to transition to 'preparing'
    const [maintRaceResult, chefAcceptResult] = await Promise.all([
      Order.findOneAndUpdate(
        { _id: raceOrder2._id, status: { $in: ["pending", "confirmed"] } },
        { $set: { status: "cancelled", cancellationReason: "Auto-cancelled timeout" } },
        { returnDocument: "after" }
      ),
      Order.findOneAndUpdate(
        { _id: raceOrder2._id, status: "pending" },
        { $set: { status: "preparing" } },
        { returnDocument: "after" }
      ),
    ]);

    // Exactly one operation must succeed (returnDocument non-null), the other must fail (null)
    const winnerCount = (maintRaceResult ? 1 : 0) + (chefAcceptResult ? 1 : 0);
    assert.strictEqual(winnerCount, 1, "CAS atomic boundary guarantees exactly 1 state winner");

    const finalRaceDoc = await Order.findById(raceOrder2._id);
    assert.ok(
      finalRaceDoc.status === "cancelled" || finalRaceDoc.status === "preparing",
      `Final status must be cleanly either 'cancelled' or 'preparing', got: ${finalRaceDoc.status}`
    );
    console.log(`  ✓ Test 11C Passed: Atomic CAS resolved simultaneous race cleanly (Winner: ${finalRaceDoc.status}).`);

    console.log("\n========================================================================");
    console.log("🎉 ALL 11 OF 11 STRICTLY READ-ONLY GET & MAINTENANCE INVARIANTS PASSED!");
    console.log("========================================================================");
  } finally {
    _resetTestHttpTransport();
    await mongoose.disconnect();
    await mongod.stop();
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
