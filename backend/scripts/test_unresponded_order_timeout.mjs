import assert from "node:assert";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import {
  processUnrespondedStaleOrders,
  processAllStaleOrders,
} from "../lib/orderMaintenanceService.js";
import { GET as getOrderById } from "../app/api/orders/[id]/route.js";
import { _setTestGetServerSession } from "../app/api/orders/[id]/route.js";

async function main() {
  console.log("Starting MongoMemoryReplSet for unresponded order timeout test...");
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);

  console.log("Connected to test DB:", uri);

  try {
    // 1. Create a test restaurant with 120m timeout
    const restaurant = await Restaurant.create({
      name: "Burger & Co. Kitchen",
      slug: "burger-and-co",
      status: "active",
      address: {
        street: "123 Burger St",
        city: "Bangalore",
        latitude: 12.9716,
        longitude: 77.5946,
      },
      orderingSettings: {
        autoDismissUncollectedOrders: true,
        uncollectedTimeoutMinutes: 120,
        autoCancelTimeoutMinutes: 15,
      },
    });

    const user = await User.create({
      name: "Rounak Customer",
      email: "rounak@example.com",
      role: "customer",
    });

    // 2. Create an order that was placed 12823m ago (like in the user's screenshot #PET-K7S4)
    const ancientCreatedAt = new Date(Date.now() - 12823 * 60 * 1000);
    const ancientOrder = await Order.create({
      orderId: "PET-K7S4",
      user: user._id,
      restaurant: restaurant._id,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "online_razorpay",
      totalAmount: 289,
      createdAt: ancientCreatedAt,
      updatedAt: ancientCreatedAt,
      items: [
        {
          name: "Double Smash Cheeseburger",
          price: 289,
          quantity: 1,
        },
      ],
    });

    // 3. Create a fresh order placed 5 minutes ago
    const freshCreatedAt = new Date(Date.now() - 5 * 60 * 1000);
    const freshOrder = await Order.create({
      orderId: "PET-FRESH1",
      user: user._id,
      restaurant: restaurant._id,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "online_razorpay",
      totalAmount: 199,
      createdAt: freshCreatedAt,
      updatedAt: freshCreatedAt,
      items: [
        {
          name: "Crispy Paneer Supreme Burger",
          price: 199,
          quantity: 1,
        },
      ],
    });

    console.log("--- TEST 1: Process Unresponded Stale Orders via Maintenance ---");
    const maintenanceRes = await processUnrespondedStaleOrders({
      restaurantId: restaurant._id,
      managerLimitMinutes: 120,
    });

    assert.strictEqual(maintenanceRes.processedCount, 1, "Should cancel exactly 1 stale order");
    assert.strictEqual(
      maintenanceRes.cancelledOrders[0].orderId,
      "PET-K7S4",
      "Should cancel the ancient order PET-K7S4"
    );

    // Verify DB state of ancient order
    const updatedAncient = await Order.findById(ancientOrder._id);
    assert.strictEqual(updatedAncient.status, "cancelled", "Ancient order status must be cancelled");
    assert.ok(
      updatedAncient.cancellationReason.includes("Order unresponded by kitchen"),
      `Cancellation reason must explain unresponded timeout: ${updatedAncient.cancellationReason}`
    );
    assert.strictEqual(updatedAncient.stockRestored, true, "Raw stock should be marked restored");
    assert.strictEqual(updatedAncient.wasteLogging?.status, "not_applicable", "Waste logging must be not_applicable");

    // Verify fresh order remains untouched in pending
    const updatedFresh = await Order.findById(freshOrder._id);
    assert.strictEqual(updatedFresh.status, "pending", "Fresh order must remain in pending status");

    console.log("✓ Test 1 Passed: Ancient order successfully auto-cancelled, fresh order preserved.");

    console.log("--- TEST 2: Customer GET is strictly read-only; maintenance cancels and informs customer ---");
    // Create another ancient order placed 300m ago
    const order2CreatedAt = new Date(Date.now() - 300 * 60 * 1000);
    const order2 = await Order.create({
      orderId: "PET-TIMEOUT2",
      user: user._id,
      restaurant: restaurant._id,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: "online_razorpay",
      totalAmount: 350,
      createdAt: order2CreatedAt,
      updatedAt: order2CreatedAt,
      items: [
        {
          name: "Loaded Fries",
          price: 350,
          quantity: 1,
        },
      ],
    });

    // Mock customer session
    _setTestGetServerSession(async () => ({
      user: {
        email: "rounak@example.com",
        role: "customer",
      },
    }));

    const req = new Request(`http://localhost:3000/api/orders/${order2._id}`, {
      method: "GET",
    });

    // Invariant: GET is read-only and does not mutate status, stock, or refunds
    const res = await getOrderById(req, { params: Promise.resolve({ id: order2._id.toString() }) });
    const data = await res.json();

    assert.strictEqual(res.status, 200, "Should return 200 OK");
    assert.strictEqual(data.order.status, "pending", "Order returned to customer via GET must remain pending (read-only)");

    const checkOrder2Doc = await Order.findById(order2._id);
    assert.strictEqual(checkOrder2Doc.status, "pending", "Database document must remain pending after GET");

    // Background maintenance worker cancels the overdue order
    const maintenance2 = await processUnrespondedStaleOrders({ restaurantId: restaurant._id });
    assert.strictEqual(maintenance2.processedCount, 1, "Maintenance should cancel 1 stale order");

    // Subsequent GET returns the cancelled status persisted by maintenance
    const resAfter = await getOrderById(req, { params: Promise.resolve({ id: order2._id.toString() }) });
    const dataAfter = await resAfter.json();

    assert.strictEqual(dataAfter.order.status, "cancelled", "Subsequent GET reflects maintenance cancellation");
    assert.ok(
      dataAfter.order.cancellationReason.includes("Order unresponded by kitchen"),
      `Customer order response must have clear unresponded reason: ${dataAfter.order.cancellationReason}`
    );

    console.log("✓ Test 2 Passed: Customer GET is strictly read-only; maintenance handles cancellation.");

    console.log("--- TEST 3: Consolidated processAllStaleOrders ---");
    const combinedRes = await processAllStaleOrders({ restaurantId: restaurant._id });
    assert.ok(typeof combinedRes.processedCount === "number", "Should return processed count");
    console.log("✓ Test 3 Passed: processAllStaleOrders executed cleanly.");

    console.log("\n=======================================================");
    console.log("🎉 ALL UNRESPONDED ORDER TIMEOUT TESTS PASSED!");
    console.log("=======================================================");
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
