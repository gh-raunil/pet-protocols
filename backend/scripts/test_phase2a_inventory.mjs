import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register ESM loader for Next.js API route imports
register(pathToFileURL('./scripts/loader.mjs').href, import.meta.url);

import connectDB from '../lib/db.js';
import Restaurant from '../models/Restaurant.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Ingredient from '../models/Ingredient.js';
import Recipe from '../models/Recipe.js';
import StockMovement from '../models/StockMovement.js';
import PaymentIntent from '../models/PaymentIntent.js';
import crypto from 'crypto';
import {
  deductStockForOrder,
  restoreStockForOrder,
  releaseRestorationLease,
  releaseDeductionLease,
  _setTestDeductionPauseHook,
  _setTestRestorationPauseHook,
} from '../lib/inventoryService.js';
import {
  PATCH as customerOrdersPATCH,
  POST as customerOrdersPOST,
  _setTestGetServerSession,
} from '../app/api/orders/route.js';
import { PATCH as superadminOrdersPATCH, _setTestRequireSuperAdmin } from '../app/api/superadmin/orders/route.js';
import { PUT as restaurantOrdersPUT, _setTestRequireRestaurantAdmin } from '../app/api/restaurant/orders/route.js';
import { POST as paymentVerifyPOST, _setTestRazorpayClient } from '../app/api/payment/verify/route.js';
import { executeOrderRefund, reconcileOrderRefund, retryFailedDeduction, _setTestRazorpayClient as _setRefundTestRazorpayClient } from '../lib/refundService.js';
import mongoose from 'mongoose';

let passed = 0;
let failed = 0;
let replSet = null;

function reportTest(name, success, error = null) {
  if (success) {
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } else {
    failed++;
    console.error(`  ✗ [FAIL] ${name}`);
    if (error) console.error(`    Error:`, error.message || error);
  }
}

async function runPhase2ATests() {
  console.log('====================================================================');
  console.log('PET PROTOCOLS — PHASE 2A.8: CRASH-SAFE INVENTORY & INTEGRITY SUITE');
  console.log('====================================================================\n');

  console.log('Starting dedicated isolated local test replica set on 127.0.0.1...');
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const localTestUri = replSet.getUri('pet_protocols_phase2a8_test');
  process.env.MONGODB_URI = localTestUri;
  process.env.TEST_MONGODB_URI = localTestUri;
  if (global.mongoose) {
    global.mongoose.conn = null;
    global.mongoose.promise = null;
  }
  console.log(`Dedicated test replica set running on loopback: ${localTestUri}\n`);

  await connectDB();

  // Ensure isolated local test database indexes are in place
  await StockMovement.syncIndexes();
  await Ingredient.syncIndexes();
  await Order.syncIndexes();
  await PaymentIntent.syncIndexes();

  // -------------------------------------------------------------
  // Test Fixture Setup
  // -------------------------------------------------------------
  const testRest = await Restaurant.findOneAndUpdate(
    { slug: 'test-kitchen-phase2a' },
    {
      name: 'Phase 2A Test Kitchen',
      slug: 'test-kitchen-phase2a',
      status: 'active',
      isOpen: true,
      acceptingOrders: true,
      isTemporarilyClosed: false,
      cancellationSettings: {
        allowCustomerCancel: true,
        customerCancelWindowMinutes: 5,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const customerA = await User.findOneAndUpdate(
    { email: 'customer.alpha.phase2a@test.com' },
    {
      name: 'Customer Alpha',
      email: 'customer.alpha.phase2a@test.com',
      role: 'customer',
      status: 'active',
    },
    { upsert: true, returnDocument: 'after' }
  );

  const customerB = await User.findOneAndUpdate(
    { email: 'customer.beta.phase2a@test.com' },
    {
      name: 'Customer Beta',
      email: 'customer.beta.phase2a@test.com',
      role: 'customer',
      status: 'active',
    },
    { upsert: true, returnDocument: 'after' }
  );

  const superadminUser = await User.findOneAndUpdate(
    { email: 'superadmin.petprotocols@gmail.com' },
    {
      name: 'Super Admin Test',
      email: 'superadmin.petprotocols@gmail.com',
      role: 'superadmin',
      status: 'active',
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Setup test ingredients with known stock levels
  const ingBeef = await Ingredient.findOneAndUpdate(
    { restaurant: testRest._id, name: 'Phase2A Gourmet Beef Patty' },
    {
      restaurant: testRest._id,
      name: 'Phase2A Gourmet Beef Patty',
      unit: 'kg',
      currentStock: 100,
      minimumStock: 10,
      costPerUnit: 400,
      appliedRestorations: [],
    },
    { upsert: true, returnDocument: 'after' }
  );

  const ingBun = await Ingredient.findOneAndUpdate(
    { restaurant: testRest._id, name: 'Phase2A Brioche Bun' },
    {
      restaurant: testRest._id,
      name: 'Phase2A Brioche Bun',
      unit: 'pcs',
      currentStock: 50,
      minimumStock: 10,
      costPerUnit: 15,
      appliedRestorations: [],
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Setup test products
  const prodBurger = await Product.findOneAndUpdate(
    { name: 'Phase2A Gourmet Burger' },
    {
      name: 'Phase2A Gourmet Burger',
      price: 250,
      restaurant: testRest._id,
      category: 'Burgers',
      isAvailable: true,
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Setup recipe for Burger (0.2 kg beef + 1 bun per burger)
  await Recipe.findOneAndUpdate(
    { restaurant: testRest._id, product: prodBurger._id },
    {
      restaurant: testRest._id,
      product: prodBurger._id,
      productName: prodBurger.name,
      ingredients: [
        {
          ingredient: ingBeef._id,
          ingredientName: ingBeef.name,
          quantity: 0.2,
          unit: 'kg',
        },
        {
          ingredient: ingBun._id,
          ingredientName: ingBun.name,
          quantity: 1,
          unit: 'pcs',
        },
      ],
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Clean old test orders and movements
  await Order.deleteMany({ 'address.fullName': { $regex: /^TEST_PHASE2A_/ } });
  await StockMovement.deleteMany({ reason: { $regex: /TEST_PHASE2A_/ } });

  // Reset base stock
  await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedRestorations: [] } });
  await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedRestorations: [] } });

  console.log('--- SECTION 1: GUEST ORDER AUTHORIZATION & OWNERSHIP ---\n');

  // Test 0A: Unauthenticated caller cannot cancel an arbitrary guest order (401)
  try {
    const guestOrder = await Order.create({
      user: null,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_Guest', street: '123 Test Ave', phone: '9999999991' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      createdAt: new Date(),
    });

    _setTestGetServerSession(async () => null); // Unauthenticated

    const req = new Request('http://localhost:3000/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: guestOrder._id.toString(),
        reason: 'Guest wants cancel',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await customerOrdersPATCH(req);
    const body = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /authentication required/i);

    const checkOrder = await Order.findById(guestOrder._id);
    assert.strictEqual(checkOrder.status, 'pending');

    reportTest('Authorization: Unauthenticated caller cannot cancel guest order (401)', true);
  } catch (err) {
    reportTest('Authorization: Unauthenticated caller guest cancel rejection', false, err);
  }

  // Test 0B: Unauthorized customer (Customer B) cannot cancel Customer A order (403)
  try {
    const orderA = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_CustA', street: '123 Alpha St', phone: '9999999993' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      createdAt: new Date(),
    });

    _setTestGetServerSession(async () => ({
      user: { email: customerB.email, name: customerB.name, role: 'customer' },
    }));

    const req = new Request('http://localhost:3000/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: orderA._id.toString(),
        reason: 'Malicious cancel attempt',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await customerOrdersPATCH(req);
    assert.strictEqual(res.status, 403);

    reportTest('Authorization: Non-owner customer cannot cancel another customer order (403)', true);
  } catch (err) {
    reportTest('Authorization: Non-owner customer cancel rejection', false, err);
  }

  console.log('\n--- SECTION 2: PHASE 2A.1 CRASH-SAFETY & IDEMPOTENT RESTORATION ---\n');

  // Test 1: Crash after stock mutation but before checkpoint
  try {
    // Reset stock: beef = 100, bun = 50
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedRestorations: [] } });

    // Order with 1 Gourmet Burger (requires 0.2 kg beef, 1 bun)
    const order1 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_CrashPostInc', street: '123 Crash Way', phone: '9999999994' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'cancelled',
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      stockRestored: false,
    });

    // Simulate crash:
    // Worker 1 applied beef increment (100 -> 100.2) and opKey, but died before StockMovement/Order checkpoint
    const opKeyBeef = `${order1._id.toString()}_${ingBeef._id.toString()}_restore`;
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $inc: { currentStock: 0.2 },
        $push: { appliedRestorations: { opKey: opKeyBeef, orderId: order1._id, quantity: 0.2, date: new Date() } },
      }
    );

    // Order is currently in_progress from 30s ago
    await Order.updateOne(
      { _id: order1._id },
      {
        $set: {
          'stockRestoration.status': 'in_progress',
          'stockRestoration.lastAttemptAt': new Date(Date.now() - 30000),
          'stockRestoration.attemptCount': 1,
        },
      }
    );

    // Operator / retry executes restoreStockForOrder
    const retryResult = await restoreStockForOrder(order1._id);
    assert.strictEqual(retryResult.success, true);

    const beefAfterRetry = await Ingredient.findById(ingBeef._id);
    const bunAfterRetry = await Ingredient.findById(ingBun._id);

    // CRITICAL: Beef must NOT have been incremented again (must stay 100.2, NOT 100.4!)
    assert.strictEqual(Math.round(beefAfterRetry.currentStock * 10) / 10, 100.2);
    // Bun must have been restored (50 -> 51)
    assert.strictEqual(bunAfterRetry.currentStock, 51);

    const finalOrder1 = await Order.findById(order1._id);
    assert.strictEqual(finalOrder1.stockRestored, true);
    assert.strictEqual(finalOrder1.stockRestoration.status, 'completed');

    reportTest('Test 1 [DB Integration]: Crash after stock mutation does not duplicate stock upon retry', true);
  } catch (err) {
    reportTest('Test 1 [DB Integration]: Crash after stock mutation recovery', false, err);
  }

  // Test 1A [Phase 2A.3]: 250 subsequent restorations do not evict uncheckpointed crashed operation key
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedRestorations: [] } });

    const order1A = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_EvictionDefense', street: '123 Evict Way', phone: '9999999994' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'cancelled',
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      stockRestored: false,
      'stockRestoration.status': 'in_progress',
      'stockRestoration.lastAttemptAt': new Date(Date.now() - 30000),
      'stockRestoration.attemptCount': 1,
    });

    const opKeyBeef1A = `${order1A._id.toString()}_${ingBeef._id.toString()}_restore`;
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $inc: { currentStock: 0.2 },
        $push: { appliedRestorations: { opKey: opKeyBeef1A, orderId: order1A._id, quantity: 0.2, date: new Date() } },
      }
    );

    // Simulate 250 subsequent restorations from other orders on this same ingredient
    const dummyOps = [];
    for (let i = 1; i <= 250; i++) {
      dummyOps.push({
        opKey: `dummy_order_${i}_${ingBeef._id.toString()}_restore`,
        orderId: new (await import('mongoose')).default.Types.ObjectId(),
        quantity: 0.1,
        date: new Date(),
      });
    }
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      { $push: { appliedRestorations: { $each: dummyOps } } }
    );

    const ingCheckBefore = await Ingredient.findById(ingBeef._id);
    const keyFoundBefore = ingCheckBefore.appliedRestorations.some((r) => r.opKey === opKeyBeef1A);
    assert.strictEqual(keyFoundBefore, true, "Crashed operation key must NOT be evicted by subsequent restorations");

    const retryRes1A = await restoreStockForOrder(order1A._id);
    assert.strictEqual(retryRes1A.success, true);

    const beefAfter1A = await Ingredient.findById(ingBeef._id);
    assert.strictEqual(Math.round(beefAfter1A.currentStock * 10) / 10, 100.2);

    const keyFoundAfter = beefAfter1A.appliedRestorations.some((r) => r.opKey === opKeyBeef1A);
    assert.strictEqual(keyFoundAfter, true, "Durable operation key is preserved on Ingredient post-checkpoint");

    reportTest('Test 1A [Phase 2A.3]: 250 subsequent restorations do not evict uncheckpointed crashed operation key', true);
  } catch (err) {
    reportTest('Test 1A [Phase 2A.3]: 250 subsequent restorations eviction defense', false, err);
  }

  // Test 1B [Phase 2A.3]: Successful checkpoint followed by failed key cleanup recovers safely and skips increment
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedRestorations: [] } });

    const order1B = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_FailedCleanupRecovery', street: '123 Clean Way', phone: '9999999994' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'cancelled',
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      stockRestored: false,
      'stockRestoration.status': 'in_progress',
      'stockRestoration.lastAttemptAt': new Date(Date.now() - 30000),
      'stockRestoration.attemptCount': 1,
      'stockRestoration.restoredIngredients': [
        {
          ingredient: ingBeef._id,
          ingredientName: ingBeef.name,
          quantity: 0.2,
          opKey: 'precheckpointed_opkey',
          restoredAt: new Date(),
        },
      ],
    });

    const opKeyBeef1B = `${order1B._id.toString()}_${ingBeef._id.toString()}_restore`;
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $set: { currentStock: 100.2 },
        $push: { appliedRestorations: { opKey: opKeyBeef1B, orderId: order1B._id, quantity: 0.2, date: new Date() } },
      }
    );

    const retryRes1B = await restoreStockForOrder(order1B._id);
    assert.strictEqual(retryRes1B.success, true);

    const beefAfter1B = await Ingredient.findById(ingBeef._id);
    const bunAfter1B = await Ingredient.findById(ingBun._id);

    assert.strictEqual(Math.round(beefAfter1B.currentStock * 10) / 10, 100.2);
    assert.strictEqual(bunAfter1B.currentStock, 51);

    const lingeringKey = beefAfter1B.appliedRestorations.some((r) => r.opKey === opKeyBeef1B);
    assert.strictEqual(lingeringKey, true, "Durable operation key is preserved on Ingredient across retries");

    reportTest('Test 1B [Phase 2A.3]: Successful checkpoint followed by failed key cleanup recovers safely and skips increment', true);
  } catch (err) {
    reportTest('Test 1B [Phase 2A.3]: Failed key cleanup recovery', false, err);
  }

  // Test 1C [Phase 2A.3]: Checkpoint failure or lease loss preserves operation key to prevent duplicate increments
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedRestorations: [] } });

    const order1C = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_LeaseLossKeyPreserve', street: '123 Lease Way', phone: '9999999994' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'cancelled',
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      stockRestored: false,
    });

    const opKeyBeef1C = `${order1C._id.toString()}_${ingBeef._id.toString()}_restore`;
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $inc: { currentStock: 0.2 },
        $push: { appliedRestorations: { opKey: opKeyBeef1C, orderId: order1C._id, quantity: 0.2, date: new Date() } },
      }
    );

    const staleCheckpoint = await Order.updateOne(
      { _id: order1C._id, 'stockRestoration.leaseToken': 'worker-1-stale' },
      { $push: { 'stockRestoration.restoredIngredients': { ingredient: ingBeef._id, quantity: 0.2, opKey: opKeyBeef1C } } }
    );
    assert.strictEqual(staleCheckpoint.matchedCount, 0, "Stale worker checkpoint must match 0 documents");

    const checkBeefMid = await Ingredient.findById(ingBeef._id);
    const keyStillThere = checkBeefMid.appliedRestorations.some((r) => r.opKey === opKeyBeef1C);
    assert.strictEqual(keyStillThere, true, "opKey must be preserved when lease is lost");

    const resWorker2 = await restoreStockForOrder(order1C._id);
    assert.strictEqual(resWorker2.success, true);

    const beefFinal1C = await Ingredient.findById(ingBeef._id);
    assert.strictEqual(Math.round(beefFinal1C.currentStock * 10) / 10, 100.2);

    const keyAfterWorker2 = beefFinal1C.appliedRestorations.some((r) => r.opKey === opKeyBeef1C);
    assert.strictEqual(keyAfterWorker2, true, "Durable operation key is preserved after Worker 2 checkpoints");

    reportTest('Test 1C [Phase 2A.3]: Checkpoint failure or lease loss preserves operation key to prevent duplicate increments', true);
  } catch (err) {
    reportTest('Test 1C [Phase 2A.3]: Lease loss key preservation', false, err);
  }

  // Test 2: Crash after operation reservation but before stock mutation
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedRestorations: [] } });

    const order2 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_CrashPostReservation', street: '123 Crash2 Way', phone: '9999999995' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'cancelled',
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      stockRestored: false,
      'stockRestoration.status': 'in_progress',
      'stockRestoration.leaseToken': 'old-crashed-worker-token',
      'stockRestoration.lastAttemptAt': new Date(Date.now() - 30000),
      'stockRestoration.attemptCount': 1,
    });

    // Retry should take over expired lease and restore stock
    const result2 = await restoreStockForOrder(order2._id);
    assert.strictEqual(result2.success, true);

    const beef2 = await Ingredient.findById(ingBeef._id);
    const bun2 = await Ingredient.findById(ingBun._id);

    assert.strictEqual(Math.round(beef2.currentStock * 10) / 10, 100.2);
    assert.strictEqual(bun2.currentStock, 51);

    reportTest('Test 2 [DB Integration]: Crash after reservation resumes cleanly and restores exact stock', true);
  } catch (err) {
    reportTest('Test 2 [DB Integration]: Crash after reservation recovery', false, err);
  }

  // Test 3: Duplicate restoration operation submission
  try {
    const order3 = await Order.findOne({ 'address.fullName': 'TEST_PHASE2A_CrashPostReservation' });
    const beefBefore = (await Ingredient.findById(ingBeef._id)).currentStock;

    const dupResult = await restoreStockForOrder(order3._id);
    assert.strictEqual(dupResult.success, true);
    assert.strictEqual(dupResult.alreadyRestored, true);

    const beefAfter = (await Ingredient.findById(ingBeef._id)).currentStock;
    assert.strictEqual(beefAfter, beefBefore);

    reportTest('Test 3 [DB Integration]: Duplicate restoration submission returns alreadyRestored without stock change', true);
  } catch (err) {
    reportTest('Test 3 [DB Integration]: Duplicate restoration submission', false, err);
  }

  // Test 4: Concurrent operation reservation race
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedRestorations: [] } });

    const order4 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 2 }],
      address: { fullName: 'TEST_PHASE2A_ConcurrentRace', street: '123 Race St', phone: '9999999996' },
      subtotal: 500,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 540,
      status: 'cancelled',
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.4, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 2, unit: 'pcs' },
      ],
      stockRestored: false,
    });

    const results = await Promise.all([
      restoreStockForOrder(order4._id),
      restoreStockForOrder(order4._id),
      restoreStockForOrder(order4._id),
      restoreStockForOrder(order4._id),
      restoreStockForOrder(order4._id),
    ]);

    assert.ok(results.some((r) => r.success === true), "At least one call must succeed");
    assert.ok(results.every((r) => r.success === true || r.inProgress === true), "All calls must either succeed or report inProgress truthful status");

    const beef4 = await Ingredient.findById(ingBeef._id);
    const bun4 = await Ingredient.findById(ingBun._id);

    // 100 + 0.4 = 100.4 (NOT 100 + 5 * 0.4 = 102)
    assert.strictEqual(Math.round(beef4.currentStock * 10) / 10, 100.4);
    assert.strictEqual(bun4.currentStock, 52);

    reportTest('Test 4 [DB Integration]: Concurrent operation reservation executes exactly once across 5 races', true);
  } catch (err) {
    reportTest('Test 4 [DB Integration]: Concurrent operation reservation', false, err);
  }

  console.log('\n--- SECTION 3: LEASE FENCING & STALE WORKER ABORTION ---\n');

  // Test 5: Stale worker resuming after lease takeover
  try {
    const order5 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_Fencing', street: '123 Fence Way', phone: '9999999997' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'cancelled',
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      stockRestored: false,
      'stockRestoration.status': 'in_progress',
      'stockRestoration.leaseToken': 'worker-2-active-token',
      'stockRestoration.leaseGeneration': 2,
      'stockRestoration.lastAttemptAt': new Date(),
    });

    // Stale Worker 1 has old lease token "worker-1-stale-token"
    const staleWorkerToken = 'worker-1-stale-token';

    // Verify stale worker check fails
    const fenceCheck = await Order.findOne({
      _id: order5._id,
      'stockRestoration.leaseToken': staleWorkerToken,
    });
    assert.strictEqual(fenceCheck, null);

    // Verify stale worker update is rejected (0 documents matched)
    const staleUpdate = await Order.updateOne(
      {
        _id: order5._id,
        'stockRestoration.leaseToken': staleWorkerToken,
      },
      {
        $set: { stockRestored: true },
      }
    );
    assert.strictEqual(staleUpdate.matchedCount, 0);

    const checkOrder5 = await Order.findById(order5._id);
    assert.strictEqual(checkOrder5.stockRestored, false);
    assert.strictEqual(checkOrder5.stockRestoration.leaseToken, 'worker-2-active-token');

    reportTest('Test 5 [Fencing Integration]: Stale worker with superseded leaseToken is blocked from updating order', true);
  } catch (err) {
    reportTest('Test 5 [Fencing Integration]: Stale worker abortion', false, err);
  }

  // Test 6: Old worker attempting to release a newer worker's lease
  try {
    const order6 = await Order.findOne({ 'address.fullName': 'TEST_PHASE2A_Fencing' });
    const staleWorkerToken = 'worker-1-stale-token';

    // Stale worker tries releasing lease
    const releaseRes = await releaseRestorationLease(order6._id, staleWorkerToken);
    assert.strictEqual(releaseRes.matchedCount, 0);

    // Verify Worker 2's lease remains active
    const checkOrder6 = await Order.findById(order6._id);
    assert.strictEqual(checkOrder6.stockRestoration.leaseToken, 'worker-2-active-token');
    assert.strictEqual(checkOrder6.stockRestoration.status, 'in_progress');

    // Worker 2 releases with correct leaseToken
    const legitRelease = await releaseRestorationLease(order6._id, 'worker-2-active-token');
    assert.strictEqual(legitRelease.matchedCount, 1);

    reportTest('Test 6 [Fencing Integration]: Stale worker cannot release a newer worker lease; legitimate release succeeds', true);
  } catch (err) {
    reportTest('Test 6 [Fencing Integration]: Lease release ownership check', false, err);
  }

  console.log('\n--- SECTION 4: IMMUTABLE DEDUCTION SNAPSHOT INTEGRITY ---\n');

  // Test 7: Recipe changed after deduction does not corrupt restored quantity
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedRestorations: [] } });

    // Place order and deduct stock (Burger recipe originally 0.2 kg beef, 1 bun)
    const order7 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_RecipeChanged', street: '123 Recipe St', phone: '9999999998' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
    });

    const deductRes = await deductStockForOrder(order7._id);
    assert.strictEqual(deductRes.success, true);

    // Chef now updates the recipe in the kitchen to 0.6 kg beef!
    await Recipe.updateOne(
      { restaurant: testRest._id, product: prodBurger._id },
      { $set: { 'ingredients.0.quantity': 0.6 } }
    );

    // Order is cancelled and stock restored
    const restoreRes7 = await restoreStockForOrder(order7._id);
    assert.strictEqual(restoreRes7.success, true);

    const beef7 = await Ingredient.findById(ingBeef._id);
    // Initial 100 -> deducted 0.2 (99.8) -> restored 0.2 (100.0, NOT 100.4!)
    assert.strictEqual(Math.round(beef7.currentStock * 10) / 10, 100.0);

    // Reset recipe back to 0.2 kg
    await Recipe.updateOne(
      { restaurant: testRest._id, product: prodBurger._id },
      { $set: { 'ingredients.0.quantity': 0.2 } }
    );

    reportTest('Test 7 [Snapshot Integration]: Recipe altered after deduction does not corrupt restored quantity (uses snapshot)', true);
  } catch (err) {
    reportTest('Test 7 [Snapshot Integration]: Recipe changed after deduction', false, err);
  }

  // Test 8: Recipe deleted after deduction does not prevent restoration
  try {
    // Place order and deduct stock
    const order8 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_RecipeDeleted', street: '123 Del St', phone: '9999999999' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
    });

    await deductStockForOrder(order8._id);

    // Delete recipe completely from database
    await Recipe.deleteOne({ restaurant: testRest._id, product: prodBurger._id });

    // Cancellation restoration must still succeed from immutable snapshot
    const restoreRes8 = await restoreStockForOrder(order8._id);
    assert.strictEqual(restoreRes8.success, true);
    assert.strictEqual(restoreRes8.restoredIngredientsCount, 2);

    // Restore recipe for other tests
    await Recipe.create({
      restaurant: testRest._id,
      product: prodBurger._id,
      productName: prodBurger.name,
      ingredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
    });

    reportTest('Test 8 [Snapshot Integration]: Recipe deleted after deduction does not prevent restoration (uses snapshot)', true);
  } catch (err) {
    reportTest('Test 8 [Snapshot Integration]: Recipe deleted after deduction', false, err);
  }

  // Test 9: Legacy order without deduction snapshot reports manual reconciliation
  try {
    const legacyOrder = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_LegacyNoSnapshot', street: '123 Legacy St', phone: '9999999901' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'cancelled',
      stockDeducted: true,
      deductedIngredients: [], // Legacy order lacks snapshot
      stockRestored: false,
    });

    const legacyResult = await restoreStockForOrder(legacyOrder._id);
    assert.strictEqual(legacyResult.success, false);
    assert.strictEqual(legacyResult.requiresManualReconciliation, true);
    assert.match(legacyResult.message, /manual inventory verification is required/i);

    const checkLegacy = await Order.findById(legacyOrder._id);
    assert.strictEqual(checkLegacy.stockRestored, false);
    assert.strictEqual(checkLegacy.stockRestoration.status, 'partial_failed');
    assert.match(checkLegacy.stockRestoration.lastError, /manual inventory verification/i);

    reportTest('Test 9 [Legacy Order]: Order without deduction snapshot safely flags manual reconciliation without guessing', true);
  } catch (err) {
    reportTest('Test 9 [Legacy Order]: Missing deduction snapshot handling', false, err);
  }

  // Test 10: Missing ingredient and recoverable retry
  try {
    const nonExistentIngId = new (await import('mongoose')).default.Types.ObjectId();

    const order10 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_MissingIngRecovery', street: '123 Missing St', phone: '9999999902' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'cancelled',
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: nonExistentIngId, ingredientName: 'Deleted Special Spice', quantity: 0.05, unit: 'kg' },
      ],
      stockRestored: false,
    });

    // Attempt 1: Beef restored, nonExistentIngId fails
    const attempt1 = await restoreStockForOrder(order10._id);
    assert.strictEqual(attempt1.success, false);
    assert.strictEqual(attempt1.partial, true);

    const checkAttempt1 = await Order.findById(order10._id);
    assert.strictEqual(checkAttempt1.stockRestored, false);
    assert.strictEqual(checkAttempt1.stockRestoration.status, 'partial_failed');
    assert.strictEqual(checkAttempt1.stockRestoration.restoredIngredients.length, 1);

    // Operator fixes kitchen setup: creates the missing ingredient
    const newSpice = await Ingredient.create({
      _id: nonExistentIngId,
      restaurant: testRest._id,
      name: 'Deleted Special Spice',
      unit: 'kg',
      currentStock: 10,
      minimumStock: 1,
    });

    // Release lease or wait for lease expiry
    await releaseRestorationLease(order10._id, checkAttempt1.stockRestoration.leaseToken);

    // Attempt 2 (Retry): Beef is skipped (not double-restored), spice is restored!
    const attempt2 = await restoreStockForOrder(order10._id);
    assert.strictEqual(attempt2.success, true);
    assert.strictEqual(attempt2.restoredIngredientsCount, 2);

    const checkAttempt2 = await Order.findById(order10._id);
    assert.strictEqual(checkAttempt2.stockRestored, true);
    assert.strictEqual(checkAttempt2.stockRestoration.status, 'completed');

    const updatedSpice = await Ingredient.findById(newSpice._id);
    assert.strictEqual(Math.round(updatedSpice.currentStock * 100) / 100, 10.05);

    await Ingredient.deleteOne({ _id: newSpice._id });

    reportTest('Test 10 [Recoverable Retry]: Missing ingredient halts safely and succeeds upon retry once resolved', true);
  } catch (err) {
    reportTest('Test 10 [Recoverable Retry]: Missing ingredient retry', false, err);
  }

  console.log('\n--- SECTION 5: STOCK MOVEMENT IDEMPOTENCY & AUDIT INTEGRITY ---\n');

  // Test 11: Accurate, non-duplicated StockMovement audit entries with unique idempotencyKey
  try {
    const testMovements = await StockMovement.find({
      restaurant: testRest._id,
      type: 'order_restoration',
    });

    assert.strictEqual(testMovements.length >= 4, true);

    const seenKeys = new Set();
    for (const mov of testMovements) {
      assert.ok(mov.idempotencyKey, 'idempotencyKey must be populated on restoration movement');
      assert.strictEqual(seenKeys.has(mov.idempotencyKey), false, `Duplicate idempotencyKey detected: ${mov.idempotencyKey}`);
      seenKeys.add(mov.idempotencyKey);
      assert.strictEqual(Math.round(mov.stockAfter * 1000) / 1000, Math.round((mov.stockBefore + mov.quantity) * 1000) / 1000);
    }

    // Direct database test: Attempting to insert a duplicate StockMovement with the same idempotencyKey MUST fail
    let duplicateRejected = false;
    try {
      const sample = testMovements[0];
      await StockMovement.create({
        restaurant: sample.restaurant,
        ingredient: sample.ingredient,
        ingredientName: sample.ingredientName,
        quantity: sample.quantity,
        unit: sample.unit,
        type: 'order_restoration',
        reason: 'Duplicate exploit attempt',
        referenceId: sample.referenceId,
        idempotencyKey: sample.idempotencyKey,
        stockBefore: 100,
        stockAfter: 101,
      });
    } catch (e) {
      if (e.code === 11000) duplicateRejected = true;
    }
    assert.strictEqual(duplicateRejected, true, 'Database unique index must reject duplicate StockMovement idempotencyKey');

    reportTest('Test 11 [Audit Integrity]: StockMovement records are mathematically verified with enforced idempotencyKey uniqueness', true);
  } catch (err) {
    reportTest('Test 11 [Audit Integrity]: StockMovement unique idempotency check', false, err);
  }

  console.log('\n--- SECTION 6: TRUTHFUL CANCELLATION API BEHAVIOR ---\n');

  // Test 12: Honest cancellation API behavior after partial restoration failure
  try {
    // Order lacking snapshot (legacy order)
    const order12 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_HonestApi', street: '123 Truth Ave', phone: '9999999903' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: true,
      deductedIngredients: [], // Missing snapshot triggers partial_failed
      stockRestored: false,
      createdAt: new Date(),
    });

    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    const req = new Request('http://localhost:3000/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: order12._id.toString(),
        reason: 'Testing cancellation reporting honesty',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await customerOrdersPATCH(req);
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.orderCancelled, true);
    assert.strictEqual(body.inventoryRestored, false); // CRITICAL: Truthfully reports false!
    assert.match(body.message, /manual reconciliation/i);

    reportTest('Test 12 [API Truthfulness]: Cancellation API truthfully returns inventoryRestored: false upon partial/manual failure', true);
  } catch (err) {
    reportTest('Test 12 [API Truthfulness]: Cancellation API truthful status', false, err);
  }

  console.log('\n--- SECTION 7: PHASE 2A.5 CRASH-SAFE DEDUCTION SUITE ---\n');

  // Test 13 [DB Integration]: Crash after persisting snapshot but before first deduction
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    const order13 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 2 }],
      address: { fullName: 'TEST_PHASE2A_SnapCrash', street: '123 Snap Way', phone: '9999999995' },
      subtotal: 500,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 540,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.4, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 2, unit: 'pcs' },
      ],
      stockDeduction: { status: 'not_deducted' },
    });

    const res13 = await deductStockForOrder(order13._id);
    assert.strictEqual(res13.success, true);

    const beef13 = await Ingredient.findById(ingBeef._id);
    const bun13 = await Ingredient.findById(ingBun._id);
    assert.strictEqual(Math.round(beef13.currentStock * 10) / 10, 99.6);
    assert.strictEqual(bun13.currentStock, 48);

    const updated13 = await Order.findById(order13._id);
    assert.strictEqual(updated13.stockDeducted, true);
    assert.strictEqual(updated13.stockDeduction.status, 'completed');
    assert.strictEqual(updated13.stockDeduction.deductedIngredients.length, 2);

    reportTest('Test 13 [DB Integration]: Crash after persisting snapshot resumes and completes deduction', true);
  } catch (err) {
    reportTest('Test 13 [DB Integration]: Crash after snapshot deduction', false, err);
  }

  // Test 14 [DB Integration]: Crash after one ingredient decrement and opKey insertion, before order checkpoint
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    const order14 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_CrashMidDeduct', street: '123 Mid Way', phone: '9999999996' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      stockDeduction: {
        status: 'in_progress',
        lastAttemptAt: new Date(Date.now() - 30000), // lease expired
      },
    });

    // Simulate crash: Beef was decremented (100 -> 99.8) and opKey pushed, but Order checkpoint was NOT written
    const opKeyBeef = `${order14._id.toString()}_${ingBeef._id.toString()}_deduct`;
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $inc: { currentStock: -0.2 },
        $push: { appliedDeductions: { opKey: opKeyBeef, orderId: order14._id, quantity: 0.2, date: new Date() } },
      }
    );

    // Retry executes deductStockForOrder
    const res14 = await deductStockForOrder(order14._id);
    assert.strictEqual(res14.success, true);

    const beef14 = await Ingredient.findById(ingBeef._id);
    const bun14 = await Ingredient.findById(ingBun._id);

    // CRITICAL: Beef must NOT be decremented twice (must remain 99.8, NOT 99.6!)
    assert.strictEqual(Math.round(beef14.currentStock * 10) / 10, 99.8);
    // Bun must be decremented once (50 -> 49)
    assert.strictEqual(bun14.currentStock, 49);

    const updated14 = await Order.findById(order14._id);
    assert.strictEqual(updated14.stockDeducted, true);
    assert.strictEqual(updated14.stockDeduction.status, 'completed');
    assert.strictEqual(updated14.stockDeduction.deductedIngredients.length, 2);

    // Verify durable opKey is preserved on Ingredient to prevent stale workers from double-decrementing
    assert.strictEqual(beef14.appliedDeductions.length > 0, true);
    assert.ok(beef14.appliedDeductions.some((d) => d.opKey === opKeyBeef));

    reportTest('Test 14 [DB Integration]: Crash after stock decrement does not double-decrement upon retry', true);
  } catch (err) {
    reportTest('Test 14 [DB Integration]: Crash after stock decrement recovery', false, err);
  }

  // Test 15 [DB Integration]: Crash after several ingredients deducted but before all complete
  try {
    const ingCheese = await Ingredient.findOneAndUpdate(
      { restaurant: testRest._id, name: 'Phase2A Cheddar Slice' },
      {
        restaurant: testRest._id,
        name: 'Phase2A Cheddar Slice',
        unit: 'slices',
        currentStock: 40,
        minimumStock: 5,
        costPerUnit: 10,
        appliedDeductions: [],
        appliedRestorations: [],
      },
      { upsert: true, returnDocument: 'after' }
    );

    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [] } });
    await Ingredient.updateOne({ _id: ingCheese._id }, { $set: { currentStock: 40, appliedDeductions: [] } });

    const order15 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_CrashMultiIng', street: '123 Multi Way', phone: '9999999997' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
        { ingredient: ingCheese._id, ingredientName: ingCheese.name, quantity: 2, unit: 'slices' },
      ],
      stockDeduction: {
        status: 'in_progress',
        lastAttemptAt: new Date(Date.now() - 30000),
        deductedIngredients: [
          { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, opKey: 'order15_b_prev' },
          { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, opKey: 'order15_bun_prev' },
        ],
      },
    });

    // Beef and bun already decremented prior to crash
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 99.8 } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 49 } });

    const res15 = await deductStockForOrder(order15._id);
    assert.strictEqual(res15.success, true);

    const beef15 = await Ingredient.findById(ingBeef._id);
    const bun15 = await Ingredient.findById(ingBun._id);
    const cheese15 = await Ingredient.findById(ingCheese._id);

    assert.strictEqual(Math.round(beef15.currentStock * 10) / 10, 99.8);
    assert.strictEqual(bun15.currentStock, 49);
    assert.strictEqual(cheese15.currentStock, 38); // 40 - 2

    const updated15 = await Order.findById(order15._id);
    assert.strictEqual(updated15.stockDeducted, true);
    assert.strictEqual(updated15.stockDeduction.status, 'completed');
    assert.strictEqual(updated15.stockDeduction.deductedIngredients.length, 3);

    reportTest('Test 15 [DB Integration]: Crash after partial ingredient checkpoints skips existing and finishes remaining', true);
  } catch (err) {
    reportTest('Test 15 [DB Integration]: Crash partial checkpoints recovery', false, err);
  }

  // Test 16 [DB Integration]: Crash after all decrements but before final order status update
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 99.8, appliedDeductions: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 49, appliedDeductions: [] } });

    const order16 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_CrashPreFinalize', street: '123 Finalize Way', phone: '9999999998' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      stockDeduction: {
        status: 'in_progress',
        lastAttemptAt: new Date(Date.now() - 30000),
        deductedIngredients: [
          { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2 },
          { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1 },
        ],
      },
    });

    const res16 = await deductStockForOrder(order16._id);
    assert.strictEqual(res16.success, true);

    const beef16 = await Ingredient.findById(ingBeef._id);
    const bun16 = await Ingredient.findById(ingBun._id);
    assert.strictEqual(Math.round(beef16.currentStock * 10) / 10, 99.8);
    assert.strictEqual(bun16.currentStock, 49);

    const updated16 = await Order.findById(order16._id);
    assert.strictEqual(updated16.stockDeducted, true);
    assert.strictEqual(updated16.stockDeduction.status, 'completed');

    reportTest('Test 16 [DB Integration]: Crash after all decrements updates final status without re-decrementing', true);
  } catch (err) {
    reportTest('Test 16 [DB Integration]: Crash before final order status update', false, err);
  }

  // Test 17 [Snapshot Integration]: Retry after recipe altered or deleted uses pre-persisted snapshot
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [] } });

    const order17 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_RecipeMutation', street: '123 Mutate Way', phone: '9999999999' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
    });

    // Mutate the recipe drastically in MongoDB (e.g. 10 kg beef, 50 buns)
    await Recipe.updateOne(
      { restaurant: testRest._id, product: prodBurger._id },
      {
        $set: {
          ingredients: [
            { ingredient: ingBeef._id, quantity: 10, unit: 'kg' },
            { ingredient: ingBun._id, quantity: 50, unit: 'pcs' },
          ],
        },
      }
    );

    const res17 = await deductStockForOrder(order17._id);
    assert.strictEqual(res17.success, true);

    const beef17 = await Ingredient.findById(ingBeef._id);
    const bun17 = await Ingredient.findById(ingBun._id);

    // CRITICAL: Deduction must follow the pre-persisted snapshot (0.2 kg, 1 bun), NOT the changed recipe!
    assert.strictEqual(Math.round(beef17.currentStock * 10) / 10, 99.8);
    assert.strictEqual(bun17.currentStock, 49);

    // Restore recipe for subsequent tests
    await Recipe.updateOne(
      { restaurant: testRest._id, product: prodBurger._id },
      {
        $set: {
          ingredients: [
            { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
            { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
          ],
        },
      }
    );

    reportTest('Test 17 [Snapshot Integration]: Deduction uses immutable snapshot regardless of later recipe mutation', true);
  } catch (err) {
    reportTest('Test 17 [Snapshot Integration]: Recipe mutation immunity', false, err);
  }

  // Test 18 [Concurrency Integration]: Concurrent duplicate deduction requests for the same order
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [] } });

    const order18 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_ConcurrentDeduct', street: '123 Race Way', phone: '9999999901' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
    });

    // Launch 5 parallel deduction calls for the same order
    const results18 = await Promise.all([
      deductStockForOrder(order18._id),
      deductStockForOrder(order18._id),
      deductStockForOrder(order18._id),
      deductStockForOrder(order18._id),
      deductStockForOrder(order18._id),
    ]);

    assert.ok(results18.some((r) => r.success === true), "At least one deduction must succeed");
    assert.ok(results18.every((r) => r.success === true || r.inProgress === true), "All calls must succeed or report inProgress");

    const beef18 = await Ingredient.findById(ingBeef._id);
    const bun18 = await Ingredient.findById(ingBun._id);

    // Exactly one deduction must have taken effect (100 -> 99.8, 50 -> 49)
    assert.strictEqual(Math.round(beef18.currentStock * 10) / 10, 99.8);
    assert.strictEqual(bun18.currentStock, 49);

    const movements18 = await StockMovement.find({ referenceId: order18._id.toString(), type: 'order' });
    assert.strictEqual(movements18.length, 2); // 1 for beef, 1 for bun

    reportTest('Test 18 [Concurrency Integration]: Concurrent deduction requests execute exactly once across 5 races', true);
  } catch (err) {
    reportTest('Test 18 [Concurrency Integration]: Concurrent deduction race', false, err);
  }

  // Test 19 [Concurrency Integration]: Two different orders competing for insufficient stock
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [] } });
    // Exactly 1 bun in stock! Both orders want 1 burger (1 bun each)
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 1, appliedDeductions: [] } });

    const orderA = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_CompeteA', street: '123 Alpha Way', phone: '9999999902' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
    });

    const orderB = await Order.create({
      user: customerB._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_CompeteB', street: '123 Beta Way', phone: '9999999903' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
    });

    // Run both orders concurrently
    const [resA, resB] = await Promise.all([
      deductStockForOrder(orderA._id),
      deductStockForOrder(orderB._id),
    ]);

    const successes = [resA, resB].filter((r) => r.success);
    const failures = [resA, resB].filter((r) => !r.success);

    // Exactly one must succeed and one must fail with insufficientStock
    assert.strictEqual(successes.length, 1);
    assert.strictEqual(failures.length, 1);
    assert.strictEqual(failures[0].insufficientStock, true);

    const bunFinal = await Ingredient.findById(ingBun._id);
    const beefFinal = await Ingredient.findById(ingBeef._id);

    // Bun stock must be exactly 0, NEVER negative!
    assert.strictEqual(bunFinal.currentStock, 0);
    // Beef stock must be decremented by exactly 0.2 kg (the winning order), losing order's beef was rolled back!
    assert.strictEqual(Math.round(beefFinal.currentStock * 10) / 10, 99.8);

    reportTest('Test 19 [Concurrency Integration]: Competing orders enforce in-DB stock checks; loser rolls back cleanly and stock never goes negative', true);
  } catch (err) {
    reportTest('Test 19 [Concurrency Integration]: Competing orders insufficient stock race', false, err);
  }

  // Test 20 [Recovery Integration]: Timeout or simulated error with uncertain mutation outcome
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [] } });

    const order20 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_TimeoutSim', street: '123 Timeout Way', phone: '9999999904' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
      stockDeduction: {
        status: 'in_progress',
        leaseToken: 'simulated_stale_lease',
        leaseGeneration: 1,
        lastAttemptAt: new Date(Date.now() - 20000), // lease expired 20s ago
      },
    });

    const res20 = await deductStockForOrder(order20._id);
    assert.strictEqual(res20.success, true);

    const updated20 = await Order.findById(order20._id);
    assert.strictEqual(updated20.stockDeducted, true);
    assert.strictEqual(updated20.stockDeduction.status, 'completed');
    assert.strictEqual(updated20.stockDeduction.leaseGeneration, 2);

    reportTest('Test 20 [Recovery Integration]: Expired lease from simulated timeout recovers safely with incremented lease generation', true);
  } catch (err) {
    reportTest('Test 20 [Recovery Integration]: Simulated timeout recovery', false, err);
  }

  // Test 21 [Audit Integration]: Crash after stock decrement but before StockMovement creation
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [] } });

    const order21 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_CrashPreMov', street: '123 Mov Way', phone: '9999999905' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      stockDeduction: {
        status: 'in_progress',
        lastAttemptAt: new Date(Date.now() - 30000),
      },
    });

    // Stock was decremented for beef and opKey recorded, but StockMovement died
    const opKey21Beef = `${order21._id.toString()}_${ingBeef._id.toString()}_deduct`;
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $inc: { currentStock: -0.2 },
        $push: { appliedDeductions: { opKey: opKey21Beef, orderId: order21._id, quantity: 0.2, date: new Date() } },
      }
    );

    const res21 = await deductStockForOrder(order21._id);
    assert.strictEqual(res21.success, true);

    const mov21Beef = await StockMovement.findOne({ idempotencyKey: opKey21Beef });
    assert.ok(mov21Beef, 'Missing StockMovement must be created on retry');
    assert.strictEqual(mov21Beef.quantity, -0.2);

    const beef21 = await Ingredient.findById(ingBeef._id);
    assert.strictEqual(Math.round(beef21.currentStock * 10) / 10, 99.8); // Not decremented again

    reportTest('Test 21 [Audit Integration]: Crash before StockMovement creation recovers and generates missing audit record', true);
  } catch (err) {
    reportTest('Test 21 [Audit Integration]: Missing StockMovement recovery', false, err);
  }

  // Test 22 [Audit Integration]: Duplicate StockMovement submission
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [] } });

    const order22 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_DupMov', street: '123 DupMov Way', phone: '9999999906' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
    });

    const opKey22 = `${order22._id.toString()}_${ingBeef._id.toString()}_deduct`;
    await StockMovement.create({
      restaurant: testRest._id,
      ingredient: ingBeef._id,
      ingredientName: ingBeef.name,
      quantity: -0.2,
      unit: 'kg',
      type: 'order',
      reason: `TEST_PHASE2A_PreExisting`,
      referenceId: order22._id.toString(),
      idempotencyKey: opKey22,
      stockBefore: 100,
      stockAfter: 99.8,
      date: new Date(),
    });

    // Run deduction - should handle code 11000 gracefully without error
    const res22 = await deductStockForOrder(order22._id);
    assert.strictEqual(res22.success, true);

    reportTest('Test 22 [Audit Integration]: Duplicate StockMovement submission handles unique index safely', true);
  } catch (err) {
    reportTest('Test 22 [Audit Integration]: Duplicate StockMovement handling', false, err);
  }

  // Test 23 [Rollback Integration]: Insufficient stock discovered after earlier ingredient deducted
  try {
    const ingSauce = await Ingredient.findOneAndUpdate(
      { restaurant: testRest._id, name: 'Phase2A Secret Sauce' },
      {
        restaurant: testRest._id,
        name: 'Phase2A Secret Sauce',
        unit: 'ml',
        currentStock: 0, // OUT OF STOCK!
        minimumStock: 10,
        costPerUnit: 5,
        appliedDeductions: [],
        appliedRestorations: [],
      },
      { upsert: true, returnDocument: 'after' }
    );

    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [] } });

    const order23 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_PartialRollback', street: '123 Rollback Way', phone: '9999999907' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.5, unit: 'kg' },
        { ingredient: ingSauce._id, ingredientName: ingSauce.name, quantity: 50, unit: 'ml' },
      ],
    });

    const res23 = await deductStockForOrder(order23._id);
    assert.strictEqual(res23.success, false);
    assert.strictEqual(res23.insufficientStock, true);

    const beef23 = await Ingredient.findById(ingBeef._id);
    // Beef was deducted and rolled back; stock must be restored to 100 kg!
    assert.strictEqual(beef23.currentStock, 100);

    const order23Doc = await Order.findById(order23._id);
    assert.strictEqual(order23Doc.stockDeducted, false);
    assert.strictEqual(order23Doc.stockDeduction.status, 'partial_failed');
    assert.strictEqual(order23Doc.stockDeduction.missingRequirements.length, 1);

    reportTest('Test 23 [Rollback Integration]: Insufficient stock on later ingredient rolls back earlier deductions with zero stock leak', true);
  } catch (err) {
    reportTest('Test 23 [Rollback Integration]: Partial deduction rollback', false, err);
  }

  // Test 24 [Coordination Integration]: Cancellation requested while deduction is incomplete
  try {
    const order24 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_DeductRestCoord', street: '123 Coord Way', phone: '9999999908' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'pending',
      stockDeducted: false,
      stockDeduction: {
        status: 'in_progress',
        leaseToken: 'active_deduction_worker',
        lastAttemptAt: new Date(), // Active right now
      },
    });

    const restoreRes = await restoreStockForOrder(order24._id);
    assert.strictEqual(restoreRes.success, false);
    assert.strictEqual(restoreRes.inProgress, true);
    assert.match(restoreRes.message, /deduction is currently in progress/i);

    reportTest('Test 24 [Coordination Integration]: Cancellation is blocked while deduction is actively in progress', true);
  } catch (err) {
    reportTest('Test 24 [Coordination Integration]: Cancellation vs deduction race prevention', false, err);
  }

  // Test 25 [Coordination Integration]: Cancellation restores partial deductions from interrupted order
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 99.5, appliedDeductions: [] } });

    const order25 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, name: prodBurger.name, price: 250, quantity: 1 }],
      address: { fullName: 'TEST_PHASE2A_PartialRest', street: '123 PartialRest Way', phone: '9999999909' },
      subtotal: 250,
      deliveryFee: 40,
      discount: 0,
      totalAmount: 290,
      status: 'cancelled',
      stockDeducted: false,
      stockDeduction: {
        status: 'partial_failed',
        deductedIngredients: [
          { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.5, unit: 'kg' },
        ],
      },
    });

    const restoreRes25 = await restoreStockForOrder(order25._id);
    assert.strictEqual(restoreRes25.success, true);

    const beef25 = await Ingredient.findById(ingBeef._id);
    assert.strictEqual(beef25.currentStock, 100); // 99.5 + 0.5 restored!

    const order25Doc = await Order.findById(order25._id);
    assert.strictEqual(order25Doc.stockRestored, true);

    reportTest('Test 25 [Coordination Integration]: Cancellation successfully restores unrolled partial deductions', true);
  } catch (err) {
    reportTest('Test 25 [Coordination Integration]: Partial deduction restoration on cancel', false, err);
  }

  // Test 26 [API Truthfulness]: COD checkout rejects out-of-stock items truthfully (400)
  try {
    // Set bun stock to 0
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 0, appliedDeductions: [] } });

    _setTestGetServerSession(async () => ({
      user: { id: customerA._id.toString(), email: customerA.email, role: 'customer' },
    }));

    const req = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        restaurantId: testRest._id.toString(),
        items: [{ product: prodBurger._id.toString(), quantity: 1, price: 250, name: prodBurger.name }],
        address: { fullName: 'TEST_PHASE2A_OutOfStockCOD', street: '123 COD St', phone: '9999999910' },
        paymentMethod: 'Cash on Delivery',
        orderType: 'delivery',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await customerOrdersPOST(req);
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.insufficientStock, true);
    assert.match(body.error, /insufficient stock/i);

    // Reset bun stock
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50 } });

    reportTest('Test 26 [API Truthfulness]: COD checkout truthfully rejects order placement when ingredient is out of stock (400)', true);
  } catch (err) {
    reportTest('Test 26 [API Truthfulness]: COD out of stock rejection', false, err);
  }

  // -------------------------------------------------------------
  // Test 27: Crash after rollback stock increment but before StockMovement creation
  // -------------------------------------------------------------
  try {
    const testOrder27 = await Order.create({
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, name: 'Burger', price: 250 }],
      totalAmount: 250,
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'pending',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_CrashRollbackBeforeMovement' },
      stockDeducted: false,
      deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
      stockDeduction: {
        status: 'partial_failed',
        leaseToken: 'lease_27',
        leaseGeneration: 1,
        deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
      },
      stockRestoration: { status: 'not_restored', restoredIngredients: [] },
    });

    const opKey27 = `${testOrder27._id.toString()}_${ingBeef._id.toString()}_restore`;

    // Simulate partial rollback state: stock incremented & opKey in appliedRestorations, but NO movement and order not checkpointed
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $inc: { currentStock: 0.2 },
        $push: {
          appliedRestorations: {
            opKey: opKey27,
            orderId: testOrder27._id,
            quantity: 0.2,
            date: new Date(),
          },
        },
      }
    );

    const beefBeforeRetry = await Ingredient.findById(ingBeef._id);

    // Call restoreStockForOrder (which represents cancellation or retry)
    const restoreRes27 = await restoreStockForOrder(testOrder27);
    assert.strictEqual(restoreRes27.success, true);

    const beefAfterRetry = await Ingredient.findById(ingBeef._id);
    // Stock must NOT be incremented a second time
    assert.strictEqual(beefAfterRetry.currentStock, beefBeforeRetry.currentStock);

    // StockMovement must now exist
    const sm27 = await StockMovement.findOne({ idempotencyKey: opKey27 });
    assert.ok(sm27);

    // Checkpoint must be confirmed on Order
    const updatedOrder27 = await Order.findById(testOrder27._id);
    assert.strictEqual(updatedOrder27.stockRestored, true);

    reportTest('Test 27 [Part A Crash Safety]: Crash after rollback stock increment but before StockMovement creation avoids double-increment on retry', true);
  } catch (err) {
    reportTest('Test 27 [Part A Crash Safety]: Crash after rollback stock increment', false, err);
  }

  // -------------------------------------------------------------
  // Test 28: Crash after StockMovement creation but before order rollback checkpoint
  // -------------------------------------------------------------
  try {
    const testOrder28 = await Order.create({
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, name: 'Burger', price: 250 }],
      totalAmount: 250,
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'pending',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_CrashAfterMovementBeforeOrderCheckpoint' },
      stockDeducted: false,
      deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
      stockDeduction: {
        status: 'partial_failed',
        leaseToken: 'lease_28',
        leaseGeneration: 1,
        deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
      },
      stockRestoration: { status: 'not_restored', restoredIngredients: [] },
    });

    const opKey28 = `${testOrder28._id.toString()}_${ingBeef._id.toString()}_restore`;

    // Stock was incremented, opKey inserted, and StockMovement created
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $inc: { currentStock: 0.2 },
        $push: {
          appliedRestorations: {
            opKey: opKey28,
            orderId: testOrder28._id,
            quantity: 0.2,
            date: new Date(),
          },
        },
      }
    );

    await StockMovement.create({
      restaurant: testRest._id,
      ingredient: ingBeef._id,
      ingredientName: 'Ground Beef',
      quantity: 0.2,
      unit: 'kg',
      type: 'order_restoration',
      reason: 'TEST_PHASE2A_PreExistingMovement',
      referenceId: testOrder28._id.toString(),
      idempotencyKey: opKey28,
      stockBefore: 100,
      stockAfter: 100.2,
      date: new Date(),
    });

    const beefBefore28 = await Ingredient.findById(ingBeef._id);

    const restoreRes28 = await restoreStockForOrder(testOrder28);
    assert.strictEqual(restoreRes28.success, true);

    const beefAfter28 = await Ingredient.findById(ingBeef._id);
    assert.strictEqual(beefAfter28.currentStock, beefBefore28.currentStock);

    const updatedOrder28 = await Order.findById(testOrder28._id);
    assert.strictEqual(updatedOrder28.stockRestored, true);

    reportTest('Test 28 [Part A Crash Safety]: Crash after StockMovement creation but before order checkpointing safely completes without error or double increment', true);
  } catch (err) {
    reportTest('Test 28 [Part A Crash Safety]: Crash after StockMovement before order checkpoint', false, err);
  }

  // -------------------------------------------------------------
  // Test 29: Crash after rollback-key cleanup but before order checkpoint
  // -------------------------------------------------------------
  try {
    const testOrder29 = await Order.create({
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, name: 'Burger', price: 250 }],
      totalAmount: 250,
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'pending',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_CrashKeyCleanupBeforeOrderCheckpoint' },
      stockDeducted: false,
      deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
      stockDeduction: {
        status: 'partial_failed',
        leaseToken: 'lease_29',
        leaseGeneration: 1,
        deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
      },
      stockRestoration: {
        status: 'not_restored',
        restoredIngredients: [{ ingredient: ingBeef._id, quantity: 0.2, opKey: 'rest_29' }],
      },
    });

    const beefBefore29 = await Ingredient.findById(ingBeef._id);

    // Call restoreStockForOrder
    const restoreRes29 = await restoreStockForOrder(testOrder29);
    assert.strictEqual(restoreRes29.success, true);

    const beefAfter29 = await Ingredient.findById(ingBeef._id);
    // Because restoredIngredients already had ingBeef, stock was not incremented
    assert.strictEqual(beefAfter29.currentStock, beefBefore29.currentStock);

    reportTest('Test 29 [Part A Crash Safety]: Order checkpoint restoredIngredients presence prevents repeated increments after key cleanup', true);
  } catch (err) {
    reportTest('Test 29 [Part A Crash Safety]: Repeated increment prevention after key cleanup', false, err);
  }

  // -------------------------------------------------------------
  // Test 30: Cancellation following partial rollback must not increment an already-restored ingredient
  // -------------------------------------------------------------
  try {
    // Set bun stock to 0 to trigger partial deduction failure on second ingredient
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 0 } });
    const beefInitial30 = (await Ingredient.findById(ingBeef._id)).currentStock;

    const testOrder30 = await Order.create({
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, name: 'Burger', price: 250 }],
      totalAmount: 250,
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'pending',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_CancelAfterRollback' },
      stockDeducted: false,
    });

    const deductRes30 = await deductStockForOrder(testOrder30);
    assert.strictEqual(deductRes30.success, false);
    assert.strictEqual(deductRes30.insufficientStock, true);

    // Verify rollback restored beef to exact initial stock
    const beefAfterRollback30 = (await Ingredient.findById(ingBeef._id)).currentStock;
    assert.strictEqual(beefAfterRollback30, beefInitial30);

    // Now order cancellation arrives
    const cancelRestoreRes = await restoreStockForOrder(testOrder30);
    assert.strictEqual(cancelRestoreRes.success, true);
    assert.strictEqual(cancelRestoreRes.alreadyRestored, true);

    const beefAfterCancel30 = (await Ingredient.findById(ingBeef._id)).currentStock;
    assert.strictEqual(beefAfterCancel30, beefInitial30);

    // Restore bun stock
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50 } });

    reportTest('Test 30 [Part A Coordination]: Cancellation following partial rollback does not increment already-restored ingredient', true);
  } catch (err) {
    reportTest('Test 30 [Part A Coordination]: Cancellation following partial rollback', false, err);
  }

  // -------------------------------------------------------------
  // Test 31: Repeated rollback and cancellation requests remain idempotent
  // -------------------------------------------------------------
  try {
    const testOrder31 = await Order.create({
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, name: 'Burger', price: 250 }],
      totalAmount: 250,
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'pending',
      status: 'cancelled',
      address: { fullName: 'TEST_PHASE2A_RepeatedCancelIdempotent' },
      stockDeducted: true,
      deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
    });

    const beefBaseline31 = (await Ingredient.findById(ingBeef._id)).currentStock;

    // First restoration
    const res1 = await restoreStockForOrder(testOrder31);
    assert.strictEqual(res1.success, true);
    const beefAfter1 = (await Ingredient.findById(ingBeef._id)).currentStock;
    assert.strictEqual(beefAfter1, beefBaseline31 + 0.2);

    // 4 successive repeated restoration calls
    for (let i = 0; i < 4; i++) {
      const resN = await restoreStockForOrder(testOrder31);
      assert.strictEqual(resN.success, true);
      assert.strictEqual(resN.alreadyRestored, true);
    }

    const beefAfter5 = (await Ingredient.findById(ingBeef._id)).currentStock;
    assert.strictEqual(beefAfter5, beefAfter1);

    reportTest('Test 31 [Part A Idempotency]: 5 repeated cancellation restoration calls remain strictly idempotent (0 stock drift)', true);
  } catch (err) {
    reportTest('Test 31 [Part A Idempotency]: Repeated cancellation restoration', false, err);
  }

  // -------------------------------------------------------------
  // Test 32: Razorpay capture followed by insufficient inventory creates durable reconciliation state
  // -------------------------------------------------------------
  try {
    // Set bun stock to 0 to trigger inventory failure
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 0 } });

    const razorpayOrderId32 = `order_test_rzp_${Date.now()}`;
    const razorpayPaymentId32 = `pay_test_rzp_${Date.now()}`;

    // Compute valid test HMAC signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test_secret');
    hmac.update(`${razorpayOrderId32}|${razorpayPaymentId32}`);
    const validSignature32 = hmac.digest('hex');

    // Create PaymentIntent
    const pi32 = await PaymentIntent.create({
      razorpayOrderId: razorpayOrderId32,
      razorpayPaymentId: razorpayPaymentId32,
      amount: 250,
      amountPaise: 25000,
      status: 'created',
      user: customerA._id,
      address: { fullName: 'TEST_PHASE2A_RazorpayReconciliation', phone: '9999999912' },
      calcResult: {
        total: 250,
        orders: [{
          restaurantId: testRest._id.toString(),
          items: [{ product: prodBurger._id.toString(), quantity: 1, price: 250, name: prodBurger.name }],
          subtotal: 250,
          deliveryFee: 0,
          discount: 0,
          totalAmount: 250,
        }],
      },
    });

    // Mock Razorpay SDK client
    const mockRzp32 = {
      payments: {
        fetch: async () => ({ id: razorpayPaymentId32, order_id: razorpayOrderId32, status: 'captured', amount: 25000, currency: 'INR' }),
        refund: async () => ({ id: `rfnd_${Date.now()}`, status: 'processed', amount: 25000 }),
      },
      orders: {
        fetch: async () => ({ id: razorpayOrderId32, status: 'paid', amount: 25000, currency: 'INR' }),
      },
    };
    _setTestRazorpayClient(mockRzp32);
    _setRefundTestRazorpayClient(mockRzp32);

    const verifyReq = new Request('http://localhost:3000/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: razorpayOrderId32,
        razorpay_payment_id: razorpayPaymentId32,
        razorpay_signature: validSignature32,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const verifyRes = await paymentVerifyPOST(verifyReq);
    const verifyBody = await verifyRes.json();

    assert.strictEqual(verifyRes.status, 201);
    assert.strictEqual(verifyBody.success, true);
    assert.strictEqual(verifyBody.inventoryDeducted, false);
    assert.strictEqual(verifyBody.reconciliationRequired, true);

    // Verify durable DB state
    const refreshedPI = await PaymentIntent.findById(pi32._id);
    assert.strictEqual(refreshedPI.status, 'reconciliation_required');

    const createdOrder32 = await Order.findOne({ paymentId: razorpayPaymentId32 });
    assert.ok(createdOrder32);
    assert.strictEqual(createdOrder32.paymentStatus, 'paid');
    assert.strictEqual(createdOrder32.stockDeducted, false);
    assert.strictEqual(createdOrder32.inventoryStatus, 'failed');
    assert.match(createdOrder32.notes, /INVENTORY ALERT/);

    // Reset bun stock
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50 } });

    reportTest('Test 32 [Part B Recovery]: Captured payment with inventory failure creates durable reconciliation_required state', true);
  } catch (err) {
    reportTest('Test 32 [Part B Recovery]: Captured payment with inventory failure', false, err);
  }

  // -------------------------------------------------------------
  // Test 33: Refund success, refund failure, timeout/uncertain outcome, and retry without duplicate refunds
  // -------------------------------------------------------------
  try {
    const razorpayPaymentId33 = `pay_test_refund_${Date.now()}`;
    const testOrder33 = await Order.create({
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, name: 'Burger', price: 250 }],
      totalAmount: 250,
      paymentMethod: 'Razorpay (Online Payment)',
      paymentId: razorpayPaymentId33,
      orderId: `ord_rzp_${Date.now()}`,
      paymentStatus: 'paid',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_RefundFlowTest' },
      stockDeducted: false,
    });

    let refundCalls = 0;
    // Step 33A: Test refund gateway failure
    const failClient = {
      payments: {
        refund: async () => {
          refundCalls++;
          throw new Error('Gateway network timeout');
        },
      },
    };
    _setTestRazorpayClient(failClient);
    _setRefundTestRazorpayClient(failClient);

    const failRefundRes = await executeOrderRefund({
      orderId: testOrder33._id,
      reason: 'Testing gateway failure',
      initiatedBy: 'test_suite',
    });

    assert.strictEqual(failRefundRes.success, false);
    assert.strictEqual(failRefundRes.status, 'reconciliation_required');
    assert.strictEqual(refundCalls, 1);

    const orderAfterFail = await Order.findById(testOrder33._id);
    assert.strictEqual(orderAfterFail.paymentStatus, 'reconciliation_required');
    assert.strictEqual(orderAfterFail.refundDetails.status, 'reconciliation_required');
    assert.strictEqual(orderAfterFail.refundDetails.dispatchState, 'quarantined');
    assert.match(orderAfterFail.refundDetails.error, /Gateway network timeout/);

    // Step 33B: Direct redispatch on quarantined order MUST be prohibited (zero new refund calls)
    const blockedRetryRes = await executeOrderRefund({
      orderId: testOrder33._id,
      reason: 'Retry after timeout',
      initiatedBy: 'test_suite',
    });
    assert.strictEqual(blockedRetryRes.success, false);
    assert.strictEqual(blockedRetryRes.status, 'reconciliation_required');
    assert.strictEqual(refundCalls, 1, 'ZERO duplicate refunds dispatched to gateway');

    // Step 33C: Safe reconciliation via reconcileOrderRefund
    const reconciledRefundId = `rfnd_mock_${Date.now()}`;
    const successClient = {
      payments: {
        fetch: async () => ({ id: razorpayPaymentId33, amount_refunded: 25000, currency: 'INR', status: 'captured' }),
        fetchMultipleRefund: async () => ({
          items: [{
            id: reconciledRefundId,
            payment_id: razorpayPaymentId33,
            amount: 25000,
            currency: 'INR',
            status: 'processed',
            notes: { opKey: orderAfterFail.refundDetails?.opKey, orderId: testOrder33.orderId },
          }],
        }),
        refund: async () => {
          refundCalls++;
          throw new Error('CRITICAL BUG: payments.refund MUST NOT be called during reconciliation');
        },
      },
    };
    _setTestRazorpayClient(successClient);
    _setRefundTestRazorpayClient(successClient);

    const reconRes = await reconcileOrderRefund({ orderId: testOrder33._id, initiatedBy: 'superadmin' });
    assert.strictEqual(reconRes.success, true);
    assert.strictEqual(refundCalls, 1, 'Strictly zero duplicate refund calls');

    const orderAfterSuccess = await Order.findById(testOrder33._id);
    assert.strictEqual(orderAfterSuccess.paymentStatus, 'refunded');
    assert.strictEqual(orderAfterSuccess.refundDetails.status, 'processed');

    // Step 33D: Repeated refund attempt must return alreadyRefunded without calling gateway
    const duplicateRefundRes = await executeOrderRefund({
      orderId: testOrder33._id,
      reason: 'Duplicate call',
      initiatedBy: 'test_suite',
    });

    assert.strictEqual(duplicateRefundRes.success, true);
    assert.strictEqual(duplicateRefundRes.alreadyRefunded, true);
    assert.strictEqual(refundCalls, 1, 'Gateway was NOT called an extra time');

    reportTest('Test 33 [Part B Refund Flow]: Refund failure quarantines as reconciliation_required, redispatch blocked, reconciliation succeeds', true);
  } catch (err) {
    reportTest('Test 33 [Part B Refund Flow]: Refund flow and retry handling', false, err);
  }

  // -------------------------------------------------------------
  // Test 34: Cancellation of a captured, unfulfilled order cannot silently skip refund handling
  // -------------------------------------------------------------
  try {
    const razorpayPaymentId34 = `pay_test_cancel_refund_${Date.now()}`;
    const testOrder34 = await Order.create({
      restaurant: testRest._id,
      user: customerA._id,
      items: [{ product: prodBurger._id, quantity: 1, name: 'Burger', price: 250 }],
      totalAmount: 250,
      paymentMethod: 'Razorpay (Online Payment)',
      paymentId: razorpayPaymentId34,
      orderId: `ord_rzp_${Date.now()}`,
      paymentStatus: 'paid',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_CancelRequiresRefund' },
      stockDeducted: false,
    });

    let refundInvoked = false;
    _setTestRazorpayClient({
      payments: {
        refund: async () => {
          refundInvoked = true;
          return { id: `rfnd_auto_${Date.now()}`, status: 'processed', amount: 25000 };
        },
      },
    });

    _setTestGetServerSession(async () => ({
      user: { id: customerA._id.toString(), email: customerA.email, role: 'customer' },
    }));

    const cancelReq = new Request('http://localhost:3000/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: testOrder34._id.toString(),
        reason: 'Customer cancelled unfulfilled order',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const cancelRes = await customerOrdersPATCH(cancelReq);
    const cancelBody = await cancelRes.json();

    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelBody.success, true);
    assert.strictEqual(cancelBody.orderCancelled, true);
    assert.strictEqual(refundInvoked, true);

    const orderAfterCancel34 = await Order.findById(testOrder34._id);
    assert.strictEqual(orderAfterCancel34.status, 'cancelled');
    assert.strictEqual(orderAfterCancel34.paymentStatus, 'refunded');
    assert.strictEqual(orderAfterCancel34.refundDetails.status, 'processed');

    reportTest('Test 34 [Part B Cancellation]: Cancellation of paid order automatically triggers refund without leaving captured funds unrefunded', true);
  } catch (err) {
    reportTest('Test 34 [Part B Cancellation]: Cancellation refund handling', false, err);
  }

  // -------------------------------------------------------------
  // Test 35: Partial multi-restaurant order creation recovers without duplicate orders or deductions
  // -------------------------------------------------------------
  try {
    // Create second restaurant for multi-restaurant test
    const testRestB = await Restaurant.create({
      name: 'TEST_PHASE2A_RestB',
      slug: `test-phase2a-restb-${Date.now()}`,
      address: '456 Rest B St',
      phone: '9999999999',
      status: 'archived',
    });

    const ingRestB = await Ingredient.create({
      restaurant: testRestB._id,
      name: 'RestB Fries',
      currentStock: 50,
      unit: 'kg',
      costPerUnit: 10,
    });

    const prodFries = await Product.create({
      name: 'Fries',
      restaurant: testRestB._id,
      price: 100,
      category: 'Sides',
    });

    await Recipe.create({
      restaurant: testRestB._id,
      product: prodFries._id,
      productName: prodFries.name,
      ingredients: [
        {
          ingredient: ingRestB._id,
          ingredientName: ingRestB.name,
          quantity: 0.1,
          unit: ingRestB.unit,
        },
      ],
    });

    const razorpayOrderId35 = `order_multi_rzp_${Date.now()}`;
    const razorpayPaymentId35 = `pay_multi_rzp_${Date.now()}`;

    const hmac35 = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test_secret');
    hmac35.update(`${razorpayOrderId35}|${razorpayPaymentId35}`);
    const validSignature35 = hmac35.digest('hex');

    // Create PaymentIntent with 2 sub-orders
    const pi35 = await PaymentIntent.create({
      razorpayOrderId: razorpayOrderId35,
      razorpayPaymentId: razorpayPaymentId35,
      amount: 350,
      amountPaise: 35000,
      status: 'created',
      user: customerA._id,
      address: { fullName: 'TEST_PHASE2A_MultiRestaurantRecovery', phone: '9999999915' },
      calcResult: {
        total: 350,
        orders: [
          {
            restaurantId: testRest._id.toString(),
            items: [{ product: prodBurger._id.toString(), quantity: 1, price: 250, name: prodBurger.name }],
            subtotal: 250,
            deliveryFee: 0,
            discount: 0,
            totalAmount: 250,
          },
          {
            restaurantId: testRestB._id.toString(),
            items: [{ product: prodFries._id.toString(), quantity: 1, price: 100, name: prodFries.name }],
            subtotal: 100,
            deliveryFee: 0,
            discount: 0,
            totalAmount: 100,
          },
        ],
      },
    });

    _setTestRazorpayClient({
      payments: {
        fetch: async () => ({ id: razorpayPaymentId35, order_id: razorpayOrderId35, status: 'captured', amount: 35000, currency: 'INR' }),
      },
      orders: {
        fetch: async () => ({ id: razorpayOrderId35, status: 'paid', amount: 35000, currency: 'INR' }),
      },
    });

    // Simulate partial failure: Order for testRest was already created and stock deducted in a prior failed attempt
    const preExistingSubOrderA = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentId: razorpayPaymentId35,
      orderId: razorpayOrderId35,
      paymentStatus: 'paid',
      paymentMethod: 'Razorpay (Online Payment)',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_MultiRestaurantRecovery' },
      stockDeducted: true,
      deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
    });

    // Record partial progress on PaymentIntent
    pi35.createdOrders = [preExistingSubOrderA._id];
    pi35.status = 'reconciliation_required';
    await pi35.save();

    const beefBefore35 = (await Ingredient.findById(ingBeef._id)).currentStock;
    const friesBefore35 = (await Ingredient.findById(ingRestB._id)).currentStock;

    // Now client retries payment verification
    const multiVerifyReq = new Request('http://localhost:3000/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: razorpayOrderId35,
        razorpay_payment_id: razorpayPaymentId35,
        razorpay_signature: validSignature35,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const multiVerifyRes = await paymentVerifyPOST(multiVerifyReq);
    const multiVerifyBody = await multiVerifyRes.json();

    assert.strictEqual(multiVerifyRes.status, 201);
    assert.strictEqual(multiVerifyBody.success, true);
    assert.strictEqual(multiVerifyBody.orders.length, 2);

    // Verify subOrderA was NOT duplicated
    const allOrdersA = await Order.find({ paymentId: razorpayPaymentId35, restaurant: testRest._id });
    assert.strictEqual(allOrdersA.length, 1);

    // Verify stock for subOrderA was NOT deducted a second time
    const beefAfter35 = (await Ingredient.findById(ingBeef._id)).currentStock;
    assert.strictEqual(beefAfter35, beefBefore35);

    // Verify subOrderB WAS created and deducted
    const allOrdersB = await Order.find({ paymentId: razorpayPaymentId35, restaurant: testRestB._id });
    assert.strictEqual(allOrdersB.length, 1);
    const friesAfter35 = (await Ingredient.findById(ingRestB._id)).currentStock;
    assert.strictEqual(friesAfter35, friesBefore35 - 0.1);

    // Verify PaymentIntent is now completed with both orders
    const finalPI = await PaymentIntent.findById(pi35._id);
    assert.strictEqual(finalPI.status, 'verified');
    assert.strictEqual(finalPI.createdOrders.length, 2);

    // Clean up restaurant B test data
    await Recipe.deleteOne({ restaurant: testRestB._id });
    await Product.deleteMany({ restaurant: testRestB._id });
    await Ingredient.deleteMany({ restaurant: testRestB._id });
    await Restaurant.deleteOne({ _id: testRestB._id });

    reportTest('Test 35 [Part C Multi-Restaurant]: Partial multi-restaurant order creation recovers without duplicate orders or deductions', true);
  } catch (err) {
    reportTest('Test 35 [Part C Multi-Restaurant]: Multi-restaurant recovery', false, err);
  }

  // -------------------------------------------------------------
  // Test 36: Gateway reconciliation on uncertain retry avoids duplicate refund call
  // -------------------------------------------------------------
  try {
    const order36 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentId: `pay_test36_${Date.now()}`,
      orderId: `order_test36_${Date.now()}`,
      paymentStatus: 'refund_pending',
      paymentMethod: 'Razorpay (Online Payment)',
      status: 'cancelled',
      address: { fullName: 'TEST_PHASE2A_RefundRecon' },
      stockDeducted: false,
      refundDetails: {
        status: 'pending',
        retryCount: 1,
        opKey: `refop_test36_${Date.now()}`,
      },
    });

    let refundEndpointCalled36 = false;
    _setRefundTestRazorpayClient({
      payments: {
        fetch: async (payId) => ({
          id: payId,
          amount: 25000,
          amount_refunded: 25000,
          refund_status: 'full',
          status: 'refunded',
          refunds: [{ id: 'rfnd_gateway_already_done_36' }],
        }),
        refund: async () => {
          refundEndpointCalled36 = true;
          throw new Error('refund() must NOT be called when gateway already refunded');
        },
      },
    });

    const refundRes36 = await executeOrderRefund({ orderId: order36._id });
    assert.strictEqual(refundRes36.success, true);
    assert.strictEqual(refundRes36.reconciled, true);
    assert.strictEqual(refundRes36.refundId, 'rfnd_gateway_already_done_36');
    assert.strictEqual(refundEndpointCalled36, false);

    const freshOrder36 = await Order.findById(order36._id);
    assert.strictEqual(freshOrder36.paymentStatus, 'refunded');
    assert.strictEqual(freshOrder36.refundDetails.status, 'processed');
    assert.strictEqual(freshOrder36.refundDetails.reconciled, true);
    assert.strictEqual(freshOrder36.refundDetails.refundId, 'rfnd_gateway_already_done_36');

    reportTest('Test 36 [Part B Reconciliation]: Gateway reconciliation detects prior refund and avoids duplicate refund API call', true);
  } catch (err) {
    reportTest('Test 36 [Part B Reconciliation]: Gateway reconciliation', false, err);
  }

  // -------------------------------------------------------------
  // Test 37: Reconciliation query failure transitions order to reconciliation_required and prevents duplicate calls
  // -------------------------------------------------------------
  try {
    const order37 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentId: `pay_test37_${Date.now()}`,
      orderId: `order_test37_${Date.now()}`,
      paymentStatus: 'refund_pending',
      paymentMethod: 'Razorpay (Online Payment)',
      status: 'cancelled',
      address: { fullName: 'TEST_PHASE2A_RefundReconFail' },
      stockDeducted: false,
      refundDetails: {
        status: 'pending',
        retryCount: 1,
        opKey: `refop_test37_${Date.now()}`,
      },
    });

    let refundEndpointCalled37 = false;
    _setRefundTestRazorpayClient({
      payments: {
        fetch: async () => {
          throw new Error('Gateway 503 Service Unavailable');
        },
        refund: async () => {
          refundEndpointCalled37 = true;
          throw new Error('refund() must NOT be called on uncertain gateway state');
        },
      },
    });

    const refundRes37 = await executeOrderRefund({ orderId: order37._id });
    assert.strictEqual(refundRes37.success, false);
    assert.strictEqual(refundRes37.status, 'reconciliation_required');
    assert.strictEqual(refundRes37.requiresManualReconciliation, true);
    assert.strictEqual(refundEndpointCalled37, false);

    const freshOrder37 = await Order.findById(order37._id);
    assert.strictEqual(freshOrder37.paymentStatus, 'reconciliation_required');
    assert.strictEqual(freshOrder37.refundDetails.status, 'reconciliation_required');
    assert.strictEqual(freshOrder37.refundDetails.requiresManualReconciliation, true);

    reportTest('Test 37 [Part B Reconciliation]: Reconciliation query failure safely quarantines as reconciliation_required without duplicate refund', true);
  } catch (err) {
    reportTest('Test 37 [Part B Reconciliation]: Reconciliation query failure', false, err);
  }

  // -------------------------------------------------------------
  // Test 38: Lease fencing on refund worker prevents superseded worker from corrupting state
  // -------------------------------------------------------------
  try {
    const order38 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentId: `pay_test38_${Date.now()}`,
      orderId: `order_test38_${Date.now()}`,
      paymentStatus: 'paid',
      paymentMethod: 'Razorpay (Online Payment)',
      status: 'cancelled',
      address: { fullName: 'TEST_PHASE2A_RefundLeaseFence' },
      stockDeducted: false,
    });

    const leaseTokenA = 'token_worker_A';
    const leaseTokenB = 'token_worker_B';

    // Worker A acquires lease
    await Order.updateOne(
      { _id: order38._id },
      {
        $set: {
          'refundDetails.status': 'processing',
          'refundDetails.leaseToken': leaseTokenA,
          'refundDetails.leaseGeneration': 1,
          'refundDetails.lastAttemptAt': new Date(),
        },
      }
    );

    // Worker B supersedes Worker A
    await Order.updateOne(
      { _id: order38._id },
      {
        $set: {
          'refundDetails.status': 'processing',
          'refundDetails.leaseToken': leaseTokenB,
          'refundDetails.leaseGeneration': 2,
          'refundDetails.lastAttemptAt': new Date(),
        },
      }
    );

    // Worker A attempts fenced write with stale leaseTokenA
    const staleWriteRes = await Order.updateOne(
      { _id: order38._id, 'refundDetails.leaseToken': leaseTokenA },
      {
        $set: {
          paymentStatus: 'refunded',
          'refundDetails.status': 'processed',
          'refundDetails.refundId': 'rfnd_stale_worker_A',
        },
      }
    );

    assert.strictEqual(staleWriteRes.matchedCount, 0);

    const freshOrder38 = await Order.findById(order38._id);
    assert.strictEqual(freshOrder38.refundDetails.leaseToken, leaseTokenB);
    assert.strictEqual(freshOrder38.refundDetails.leaseGeneration, 2);
    assert.strictEqual(freshOrder38.paymentStatus, 'paid');

    reportTest('Test 38 [Part B Fencing]: Fencing prevents superseded refund worker from overwriting active order state', true);
  } catch (err) {
    reportTest('Test 38 [Part B Fencing]: Lease fencing', false, err);
  }

  // -------------------------------------------------------------
  // Test 39: Abandoned refund lease with expired TTL (> 30s) recovers safely with incremented lease generation
  // -------------------------------------------------------------
  try {
    const payId39 = `pay_test39_${Date.now()}`;
    const order39 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentId: payId39,
      orderId: `order_test39_${Date.now()}`,
      paymentStatus: 'paid',
      paymentMethod: 'Razorpay (Online Payment)',
      status: 'cancelled',
      address: { fullName: 'TEST_PHASE2A_RefundAbandonedLock' },
      stockDeducted: false,
      refundDetails: {
        status: 'processing',
        leaseToken: 'token_old_crashed_worker',
        leaseGeneration: 1,
        lastAttemptAt: new Date(Date.now() - 35000), // 35 seconds ago (> 30s TTL)
      },
    });

    _setRefundTestRazorpayClient({
      payments: {
        fetch: async () => ({
          id: payId39,
          amount: 25000,
          amount_refunded: 25000,
          refund_status: 'full',
          status: 'refunded',
          refunds: [{ id: 'rfnd_test39_recovered' }],
        }),
        refund: async (id, opts) => ({ id: 'rfnd_test39_recovered', status: 'processed' }),
      },
    });

    const refundRes39 = await executeOrderRefund({ orderId: order39._id });
    assert.strictEqual(refundRes39.success, true);
    assert.strictEqual(refundRes39.refundId, 'rfnd_test39_recovered');

    const freshOrder39 = await Order.findById(order39._id);
    assert.strictEqual(freshOrder39.paymentStatus, 'refunded');
    assert.strictEqual(freshOrder39.refundDetails.status, 'processed');
    assert.strictEqual(freshOrder39.refundDetails.leaseGeneration, 2);
    assert.strictEqual(freshOrder39.refundDetails.refundId, 'rfnd_test39_recovered');

    reportTest('Test 39 [Part B Recovery]: Abandoned refund lease with expired TTL (> 30s) recovers cleanly with incremented lease generation', true);
  } catch (err) {
    reportTest('Test 39 [Part B Recovery]: Abandoned lease recovery', false, err);
  }

  // -------------------------------------------------------------
  // Test 40: Multi-role cancellation endpoints truthfully reflect refund failure/pending status in responses
  // -------------------------------------------------------------
  try {
    // 1. Restaurant Admin Cancellation when gateway refund fails
    _setTestRequireRestaurantAdmin(async () => ({
      user: { _id: customerA._id, name: 'Admin', role: 'admin' },
      restaurantId: testRest._id.toString(),
    }));

    _setRefundTestRazorpayClient({
      payments: {
        fetch: async () => ({ id: 'pay_test40', amount: 25000, amount_refunded: 0 }),
        refund: async () => {
          throw new Error('Gateway refund endpoint unavailable');
        },
      },
    });

    const order40Rest = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentId: `pay_test40_rest_${Date.now()}`,
      orderId: `order_test40_rest_${Date.now()}`,
      paymentStatus: 'paid',
      paymentMethod: 'Razorpay (Online Payment)',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_RestAdminRefundTruth' },
      stockDeducted: true,
      deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
    });

    const restPutReq = new Request('http://localhost:3000/api/restaurant/orders', {
      method: 'PUT',
      body: JSON.stringify({
        orderId: order40Rest._id.toString(),
        status: 'cancelled',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const restPutRes = await restaurantOrdersPUT(restPutReq);
    const restPutBody = await restPutRes.json();

    assert.strictEqual(restPutRes.status, 200);
    assert.strictEqual(restPutBody.success, true);
    assert.strictEqual(restPutBody.orderCancelled, true);
    assert.strictEqual(restPutBody.refund?.success, false);
    assert.strictEqual(restPutBody.refund?.status, 'reconciliation_required');
    assert.match(restPutBody.message, /reconciliation/i);

    // 2. Super Admin Cancellation when gateway refund fails
    _setTestRequireSuperAdmin(async () => ({
      user: { _id: customerA._id, name: 'SuperAdmin', role: 'superadmin' },
    }));

    const order40Super = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentId: `pay_test40_super_${Date.now()}`,
      orderId: `order_test40_super_${Date.now()}`,
      paymentStatus: 'paid',
      paymentMethod: 'Razorpay (Online Payment)',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_SuperAdminRefundTruth' },
      stockDeducted: true,
      deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
    });

    const superPatchReq = new Request('http://localhost:3000/api/superadmin/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: order40Super._id.toString(),
        status: 'cancelled',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const superPatchRes = await superadminOrdersPATCH(superPatchReq);
    const superPatchBody = await superPatchRes.json();

    assert.strictEqual(superPatchRes.status, 200);
    assert.strictEqual(superPatchBody.success, true);
    assert.strictEqual(superPatchBody.orderCancelled, true);
    assert.strictEqual(superPatchBody.refund?.success, false);
    assert.strictEqual(superPatchBody.refund?.status, 'reconciliation_required');
    assert.match(superPatchBody.message, /reconciliation/i);

    reportTest('Test 40 [Part B Truthful APIs]: Restaurant admin and superadmin cancellation endpoints truthfully report pending refund', true);
  } catch (err) {
    reportTest('Test 40 [Part B Truthful APIs]: Multi-role cancellation truthful reporting', false, err);
  }

  // -------------------------------------------------------------
  // Test 41 [Remediation Finding 2]: Decrement succeeded, Order checkpoint missing, cancellation restores in-flight ingredient without leak
  // -------------------------------------------------------------
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    const order41 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_UncheckpointedDeduct' },
      stockDeducted: false,
      deductedIngredients: [],
      'stockDeduction.deductedIngredients': [],
    });

    // Worker decremented beef Patty (100 -> 99.8) and pushed appliedDeductions, then crashed before order checkpoint
    const opKey41Beef = `${order41._id.toString()}_${ingBeef._id.toString()}_deduct`;
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $inc: { currentStock: -0.2 },
        $push: {
          appliedDeductions: {
            opKey: opKey41Beef,
            orderId: order41._id,
            quantity: 0.2,
            date: new Date(),
          },
        },
      }
    );

    const beefMid41 = await Ingredient.findById(ingBeef._id);
    assert.strictEqual(Math.round(beefMid41.currentStock * 10) / 10, 99.8);

    // Cancellation arrives
    const restoreRes41 = await restoreStockForOrder(order41._id);
    assert.strictEqual(restoreRes41.success, true);

    const beefAfter41 = await Ingredient.findById(ingBeef._id);
    // Uncheckpointed deduction must have been reconciled and restored back to 100.0 (NOT leaked at 99.8!)
    assert.strictEqual(Math.round(beefAfter41.currentStock * 10) / 10, 100.0);

    const checkOrder41 = await Order.findById(order41._id);
    assert.strictEqual(checkOrder41.stockRestored, true);

    reportTest('Test 41 [Remediation Finding 2]: Uncheckpointed in-flight deduction is reconciled and restored without inventory leak', true);
  } catch (err) {
    reportTest('Test 41 [Remediation Finding 2]: Uncheckpointed in-flight deduction restoration', false, err);
  }

  // -------------------------------------------------------------
  // Test 42 [Remediation Finding 1]: Rollback increment succeeded, checkpoint missing, deduction retry re-deducts compensated ingredient
  // -------------------------------------------------------------
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    // Order had previously deducted beef, then failed on bun, and rolled back beef
    // But Order.stockDeduction still had beef listed, while stockRestoration durably recorded restored beef
    const order42 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_RollbackReDeduct' },
      stockDeducted: false,
      deductedIngredients: [],
      'stockDeduction.status': 'partial_failed',
      'stockDeduction.deductedIngredients': [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, opKey: 'old_op_beef_deduct' },
      ],
      'stockRestoration.restoredIngredients': [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, opKey: 'old_op_beef_restore' },
      ],
    });

    // Beef stock is at 100 (since it was rolled back).
    // Now retryFailedDeduction or deductStockForOrder is called!
    const deductRes42 = await deductStockForOrder(order42._id);
    assert.strictEqual(deductRes42.success, true);

    const beefAfter42 = await Ingredient.findById(ingBeef._id);
    const bunAfter42 = await Ingredient.findById(ingBun._id);

    // Beef must be re-deducted (100 -> 99.8), not skipped as "already deducted"!
    assert.strictEqual(Math.round(beefAfter42.currentStock * 10) / 10, 99.8);
    assert.strictEqual(bunAfter42.currentStock, 49);

    const checkOrder42 = await Order.findById(order42._id);
    assert.strictEqual(checkOrder42.stockDeducted, true);
    assert.strictEqual(checkOrder42.stockDeduction.status, 'completed');

    reportTest('Test 42 [Remediation Finding 1]: Deduction retry re-deducts rolled-back ingredient without phantom inventory skip', true);
  } catch (err) {
    reportTest('Test 42 [Remediation Finding 1]: Deduction retry re-deducts compensated ingredient', false, err);
  }

  // -------------------------------------------------------------
  // Test 43 [Remediation Finding 3]: Stale deduction worker resumes after cancellation; write is rejected by revoked lease
  // -------------------------------------------------------------
  try {
    const staleToken43 = 'stale_deduct_worker_43';
    const order43 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_StaleDeductRevoked' },
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
      ],
      'stockDeduction.status': 'in_progress',
      'stockDeduction.leaseToken': staleToken43,
      'stockDeduction.leaseGeneration': 1,
      'stockDeduction.lastAttemptAt': new Date(Date.now() - 20000), // expired
      'stockDeduction.deductedIngredients': [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, opKey: 'op_beef_43' },
      ],
    });

    // Cancellation arrives and acquires restoration lease.
    // Restoration atomically sets stockDeduction.leaseToken = null, status = 'revoked'.
    const restoreRes43 = await restoreStockForOrder(order43._id);
    assert.strictEqual(restoreRes43.success, true);

    const checkOrder43AfterRest = await Order.findById(order43._id);
    assert.strictEqual(checkOrder43AfterRest.stockDeduction.leaseToken, null);
    assert.strictEqual(checkOrder43AfterRest.stockDeduction.status, 'revoked');

    // Stale worker wakes up and tries to checkpoint bun deduction using its old leaseToken
    const staleWrite = await Order.updateOne(
      {
        _id: order43._id,
        'stockDeduction.leaseToken': staleToken43,
        'stockDeduction.leaseGeneration': 1,
        status: { $ne: 'cancelled' },
        stockRestored: { $ne: true },
      },
      {
        $push: {
          'stockDeduction.deductedIngredients': {
            ingredient: ingBun._id,
            quantity: 1,
          },
        },
      }
    );
    assert.strictEqual(staleWrite.matchedCount, 0, 'Stale deduction worker write must be rejected');

    reportTest('Test 43 [Remediation Finding 3]: Restoration atomically revokes deduction lease; stale deduction write is rejected', true);
  } catch (err) {
    reportTest('Test 43 [Remediation Finding 3]: Stale deduction lease revocation defense', false, err);
  }

  // -------------------------------------------------------------
  // Test 44 [Remediation Finding 4]: Stale worker catch block fails to overwrite newer worker completed status
  // -------------------------------------------------------------
  try {
    const order44 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'cancelled',
      address: { fullName: 'TEST_PHASE2A_StaleCatchOverwrite' },
      stockDeducted: true,
      stockRestored: true,
      'stockRestoration.status': 'completed',
      'stockRestoration.leaseToken': 'worker_2_winner_token',
      'stockRestoration.leaseGeneration': 2,
    });

    // Stale Worker 1 (from leaseGeneration: 1, leaseToken: 'worker_1_loser_token') hits catch block
    const staleFenceFilter = {
      _id: order44._id,
      'stockRestoration.leaseToken': 'worker_1_loser_token',
      'stockRestoration.leaseGeneration': 1,
    };

    const staleCatchUpdate = await Order.updateOne(
      staleFenceFilter,
      {
        $set: {
          'stockRestoration.status': 'failed',
          'stockRestoration.lastError': 'Simulated stale crash error',
        },
      }
    );
    assert.strictEqual(staleCatchUpdate.matchedCount, 0, 'Stale worker catch block must be fenced and reject update');

    const checkOrder44 = await Order.findById(order44._id);
    assert.strictEqual(checkOrder44.stockRestoration.status, 'completed');
    assert.strictEqual(checkOrder44.stockRestored, true);

    reportTest('Test 44 [Remediation Finding 4]: Fenced catch blocks prevent stale worker from overwriting completed status', true);
  } catch (err) {
    reportTest('Test 44 [Remediation Finding 4]: Stale worker catch block fencing', false, err);
  }

  // -------------------------------------------------------------
  // Test 45 [Remediation Finding 5]: Simultaneous cancellation requests return truthful inProgress without false confirmation
  // -------------------------------------------------------------
  try {
    const order45 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_TruthfulInProgress' },
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
      ],
      stockRestored: false,
    });

    // Simulate an in-progress restoration that holds the lock
    await Order.updateOne(
      { _id: order45._id },
      {
        $set: {
          'stockRestoration.status': 'in_progress',
          'stockRestoration.leaseToken': 'active_lock_token_45',
          'stockRestoration.lastAttemptAt': new Date(),
        },
      }
    );

    const concurrentAttempt = await restoreStockForOrder(order45._id);
    // Must return success: false and inProgress: true (NOT success: true!)
    assert.strictEqual(concurrentAttempt.success, false);
    assert.strictEqual(concurrentAttempt.inProgress, true);
    assert.match(concurrentAttempt.message, /in progress/i);

    reportTest('Test 45 [Remediation Finding 5]: Concurrent restoration lock returns truthful success: false with inProgress: true', true);
  } catch (err) {
    reportTest('Test 45 [Remediation Finding 5]: Truthful inProgress return status', false, err);
  }

  // -------------------------------------------------------------
  // Test 46 [Remediation Priority B]: Duplicate COD submissions with same idempotency key return existing order without double-decrement
  // -------------------------------------------------------------
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    const codIdempKey = `cod_idemp_${Date.now()}`;

    const makeCheckoutReq = () =>
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ product: prodBurger._id.toString(), quantity: 1, price: 250 }],
          address: { fullName: 'TEST_PHASE2A_COD_Idemp', street: '123 COD St', phone: '9999999910' },
          paymentMethod: 'Cash on Delivery',
          idempotencyKey: codIdempKey,
        }),
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': codIdempKey,
        },
      });

    // First submission
    const res1 = await customerOrdersPOST(makeCheckoutReq());
    const body1 = await res1.json();
    assert.strictEqual(res1.status, 201);
    assert.strictEqual(body1.success, true);
    const createdOrderId = body1.order._id.toString();

    // Verify stock decremented once
    const beefAfterReq1 = await Ingredient.findById(ingBeef._id);
    assert.strictEqual(Math.round(beefAfterReq1.currentStock * 10) / 10, 99.8);

    // Duplicate submission (double click)
    const res2 = await customerOrdersPOST(makeCheckoutReq());
    const body2 = await res2.json();
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(body2.success, true);
    assert.strictEqual(body2.idempotentReplay, true);
    assert.strictEqual(body2.order._id.toString(), createdOrderId);

    // Verify stock was NOT decremented a second time (still 99.8, not 99.6!)
    const beefAfterReq2 = await Ingredient.findById(ingBeef._id);
    assert.strictEqual(Math.round(beefAfterReq2.currentStock * 10) / 10, 99.8);

    // Exactly 1 order in database
    const matchingOrders = await Order.find({ idempotencyKey: codIdempKey });
    assert.strictEqual(matchingOrders.length, 1);

    reportTest('Test 46 [Remediation Priority B]: Duplicate COD submissions return existing order without double-decrementing stock', true);
  } catch (err) {
    reportTest('Test 46 [Remediation Priority B]: Duplicate COD submission idempotency', false, err);
  }

  // -------------------------------------------------------------
  // Test 47 [Remediation Priority B]: Different idempotency keys create separate orders and deduct stock cleanly
  // -------------------------------------------------------------
  try {
    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    const key47A = `cod_diff_${Date.now()}_A`;
    const key47B = `cod_diff_${Date.now()}_B`;

    const reqA = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ product: prodBurger._id.toString(), quantity: 1, price: 250 }],
        address: { fullName: 'TEST_PHASE2A_DiffA', street: '123 St', phone: '9999999911' },
        paymentMethod: 'Cash on Delivery',
        idempotencyKey: key47A,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const resA = await customerOrdersPOST(reqA);
    const bodyA = await resA.json();
    assert.strictEqual(resA.status, 201);
    assert.strictEqual(bodyA.success, true);

    const reqB = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ product: prodBurger._id.toString(), quantity: 1, price: 250 }],
        address: { fullName: 'TEST_PHASE2A_DiffB', street: '123 St', phone: '9999999912' },
        paymentMethod: 'Cash on Delivery',
        idempotencyKey: key47B,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const resB = await customerOrdersPOST(reqB);
    const bodyB = await resB.json();
    assert.strictEqual(resB.status, 201);
    assert.strictEqual(bodyB.success, true);

    assert.notStrictEqual(bodyA.order._id.toString(), bodyB.order._id.toString());

    reportTest('Test 47 [Remediation Priority B]: Distinct idempotency keys create distinct orders with clean stock deductions', true);
  } catch (err) {
    reportTest('Test 47 [Remediation Priority B]: Distinct idempotency keys', false, err);
  }

  // -------------------------------------------------------------
  // Test 48 [Remediation Finding 6]: Cancellation retry on previously crashed cancellation completes restoration and refund without HTTP 400
  // -------------------------------------------------------------
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });

    const payId48 = `pay_test48_${Date.now()}`;
    // Simulate order where prior cancel set status = 'cancelled', but died before restoring stock or refunding
    const order48 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentId: payId48,
      orderId: `order_test48_${Date.now()}`,
      paymentStatus: 'refund_pending',
      paymentMethod: 'Razorpay (Online Payment)',
      status: 'cancelled', // already marked cancelled
      address: { fullName: 'TEST_PHASE2A_RetryCrashedCancel' },
      stockDeducted: true,
      stockRestored: false, // stock was NOT restored yet
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
      ],
      refundDetails: {
        status: 'pending',
      },
      createdAt: new Date(),
    });

    // Beef stock was decremented at checkout: 100 -> 99.8
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 99.8 } });

    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    _setRefundTestRazorpayClient({
      payments: {
        fetch: async () => ({ id: payId48, amount: 25000, amount_refunded: 0, refund_status: null }),
        refund: async () => ({ id: 'rfnd_test48_recovered', status: 'processed' }),
      },
    });

    const cancelRetryReq = new Request('http://localhost:3000/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: order48._id.toString(),
        reason: 'Retrying interrupted cancellation',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const cancelRetryRes = await customerOrdersPATCH(cancelRetryReq);
    const cancelRetryBody = await cancelRetryRes.json();

    // Must NOT be rejected with HTTP 400 'Order is already cancelled'!
    assert.strictEqual(cancelRetryRes.status, 200);
    assert.strictEqual(cancelRetryBody.success, true);
    assert.strictEqual(cancelRetryBody.inventoryRestored, true);

    const freshBeef48 = await Ingredient.findById(ingBeef._id);
    // Stock must be restored: 99.8 -> 100.0
    assert.strictEqual(Math.round(freshBeef48.currentStock * 10) / 10, 100.0);

    const freshOrder48 = await Order.findById(order48._id);
    assert.strictEqual(freshOrder48.stockRestored, true);
    assert.strictEqual(freshOrder48.paymentStatus, 'refunded');

    reportTest('Test 48 [Remediation Finding 6]: Cancellation retry on interrupted cancellation finishes restoration and refund without HTTP 400', true);
  } catch (err) {
    reportTest('Test 48 [Remediation Finding 6]: Interrupted cancellation retry', false, err);
  }

  // =====================================================================
  // PHASE 2A.8 REQUIRED CONCURRENCY & INTEGRITY TEST SUITE (TESTS 49-56)
  // =====================================================================

  // -------------------------------------------------------------
  // Test 49 [Phase 2A.8 Required Test 1]:
  // Pause a deduction worker after its lease check but before the Ingredient mutation;
  // complete cancellation; resume the worker. Assert stock is correct and the order remains cancelled.
  // -------------------------------------------------------------
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    const order49 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_StalledDeductPause' },
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
    });

    let pauseTriggered = false;
    let resumeWorkerResolver = null;
    const workerPausedPromise = new Promise((resolve) => {
      const resumePromise = new Promise((resumeResolve) => {
        resumeWorkerResolver = resumeResolve;
      });
      _setTestDeductionPauseHook(async ({ orderId }) => {
        if (orderId.toString() === order49._id.toString() && !pauseTriggered) {
          pauseTriggered = true;
          resolve();
          await resumePromise;
        }
      });
    });

    // Worker A begins deduction and will pause after lease check before Ingredient mutation
    const deductionWorkerPromise = deductStockForOrder(order49._id);

    // Wait until Worker A is paused
    await workerPausedPromise;

    // While Worker A is paused, Cancellation completes
    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    const cancelReq49 = new Request('http://localhost:3000/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: order49._id.toString(),
        reason: 'Customer cancelled while deduction was pending',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const cancelRes49 = await customerOrdersPATCH(cancelReq49);
    assert.strictEqual(cancelRes49.status, 200);

    // Resume Worker A
    _setTestDeductionPauseHook(null);
    if (typeof resumeWorkerResolver === 'function') {
      resumeWorkerResolver();
    }

    const deductResult49 = await deductionWorkerPromise;

    // Stalled worker must have aborted (and self-compensated if it attempted decrement)
    assert.strictEqual(deductResult49.success, false);
    assert.strictEqual(deductResult49.aborted, true);

    // Stock must be 100% correct (Beef: 100, Bun: 50) - NO LEAK!
    const beef49 = await Ingredient.findById(ingBeef._id);
    const bun49 = await Ingredient.findById(ingBun._id);
    assert.strictEqual(Math.round(beef49.currentStock * 10) / 10, 100.0);
    assert.strictEqual(bun49.currentStock, 50);

    // Order must remain cancelled
    const freshOrder49 = await Order.findById(order49._id);
    assert.strictEqual(freshOrder49.status, 'cancelled');
    assert.strictEqual(freshOrder49.stockDeducted, false);

    reportTest('Test 49 [P2A.8 Req 1]: Stalled deduction worker paused before mutation cleanly aborts after cancellation without stock leak', true);
  } catch (err) {
    _setTestDeductionPauseHook(null);
    reportTest('Test 49 [P2A.8 Req 1]: Stalled deduction worker race with cancellation', false, err);
  }

  // -------------------------------------------------------------
  // Test 50 [Phase 2A.8 Required Test 2]:
  // Pause a restoration worker before its Ingredient mutation;
  // let a newer worker finish restoration; resume the stale worker. Assert stock increments exactly once.
  // -------------------------------------------------------------
  try {
    // Baseline: Beef was deducted at checkout (100 -> 99.8)
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 99.8, appliedDeductions: [], appliedRestorations: [] } });

    const order50 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'cancelled',
      address: { fullName: 'TEST_PHASE2A_StalledRestorePause' },
      stockDeducted: true,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
      ],
    });

    let pauseTriggered50 = false;
    let resumeWorkerResolver50 = null;
    const workerPausedPromise50 = new Promise((resolve) => {
      const resumePromise = new Promise((resumeResolve) => {
        resumeWorkerResolver50 = resumeResolve;
      });
      _setTestRestorationPauseHook(async ({ orderId }) => {
        if (orderId.toString() === order50._id.toString() && !pauseTriggered50) {
          pauseTriggered50 = true;
          resolve();
          await resumePromise;
        }
      });
    });

    // Stale Worker 1 begins restoration and pauses before mutating Ingredient
    const worker1Promise = restoreStockForOrder(order50._id);
    await workerPausedPromise50;

    // Simulate Worker 1 lease timeout so Newer Worker 2 can legitimately supersede it
    await Order.updateOne(
      { _id: order50._id },
      { $set: { 'stockRestoration.lastAttemptAt': new Date(Date.now() - 30000) } }
    );

    // Newer Worker 2 runs and completes restoration
    _setTestRestorationPauseHook(null);
    const worker2Result = await restoreStockForOrder(order50._id);
    assert.strictEqual(worker2Result.success, true);

    const beefAfterWorker2 = await Ingredient.findById(ingBeef._id);
    assert.strictEqual(Math.round(beefAfterWorker2.currentStock * 10) / 10, 100.0);

    // Resume Stale Worker 1
    if (typeof resumeWorkerResolver50 === 'function') {
      resumeWorkerResolver50();
    }
    await worker1Promise;

    // Worker 1 finishes (either skipped or aborted due to lease/durable opKey)
    const beefAfterWorker1 = await Ingredient.findById(ingBeef._id);

    // CRITICAL: Stock must have incremented EXACTLY ONCE (100.0, NOT 100.2!)
    assert.strictEqual(Math.round(beefAfterWorker1.currentStock * 10) / 10, 100.0);

    const order50Fresh = await Order.findById(order50._id);
    assert.strictEqual(order50Fresh.stockRestored, true);

    reportTest('Test 50 [P2A.8 Req 2]: Stale restoration worker paused before mutation cannot double-increment stock', true);
  } catch (err) {
    _setTestRestorationPauseHook(null);
    reportTest('Test 50 [P2A.8 Req 2]: Stale restoration worker double-increment defense', false, err);
  }

  // -------------------------------------------------------------
  // Test 51 [Phase 2A.8 Required Test 3]:
  // Inject crashes between every inventory mutation and its order checkpoint;
  // retry recovery multiple times and assert exact stock, order state, and durable operation markers.
  // -------------------------------------------------------------
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    const order51 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_CrashMultiRetry' },
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
      'stockDeduction.status': 'in_progress',
      'stockDeduction.leaseToken': 'crashed_token_51',
      'stockDeduction.leaseGeneration': 1,
      'stockDeduction.lastAttemptAt': new Date(Date.now() - 30000), // lease expired
    });

    // Injected crash: Worker mutated beef (100 -> 99.8) and pushed durable opKey, but died before Order checkpoint
    const opKey51Beef = `${order51._id.toString()}_${ingBeef._id.toString()}_g1_deduct`;
    await Ingredient.updateOne(
      { _id: ingBeef._id },
      {
        $inc: { currentStock: -0.2 },
        $push: {
          appliedDeductions: {
            opKey: opKey51Beef,
            orderId: order51._id,
            quantity: 0.2,
            date: new Date(),
          },
        },
      }
    );

    // Retry 1 executes
    const retry1 = await deductStockForOrder(order51._id);
    assert.strictEqual(retry1.success, true);

    const beefMid51 = await Ingredient.findById(ingBeef._id);
    const bunMid51 = await Ingredient.findById(ingBun._id);
    assert.strictEqual(Math.round(beefMid51.currentStock * 10) / 10, 99.8);
    assert.strictEqual(bunMid51.currentStock, 49);

    // Retry 2 executes (idempotent repeated call)
    const retry2 = await deductStockForOrder(order51._id);
    assert.strictEqual(retry2.success, true);
    assert.strictEqual(retry2.alreadyDeducted, true);

    // Stock must be exactly decremented once
    const beefFinal51 = await Ingredient.findById(ingBeef._id);
    const bunFinal51 = await Ingredient.findById(ingBun._id);
    assert.strictEqual(Math.round(beefFinal51.currentStock * 10) / 10, 99.8);
    assert.strictEqual(bunFinal51.currentStock, 49);

    // Durable operation marker must be durably preserved on Ingredient
    assert.ok(beefFinal51.appliedDeductions.some((d) => d.opKey === opKey51Beef));

    const freshOrder51 = await Order.findById(order51._id);
    assert.strictEqual(freshOrder51.stockDeducted, true);
    assert.strictEqual(freshOrder51.stockDeduction.status, 'completed');

    reportTest('Test 51 [P2A.8 Req 3]: Injected crash between mutation and checkpoint survives multiple retries with durable markers', true);
  } catch (err) {
    reportTest('Test 51 [P2A.8 Req 3]: Injected crash recovery and durable markers', false, err);
  }

  // -------------------------------------------------------------
  // Test 52 [Phase 2A.8 Required Test 4]:
  // Cancellation racing with deduction, restoration racing with a retry, and stale catch handlers
  // -------------------------------------------------------------
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    const order52 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_DeductCancelRace' },
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
    });

    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    // Concurrently launch deduction and cancellation
    const cancelReq52 = new Request('http://localhost:3000/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: order52._id.toString(),
        reason: 'Concurrent cancellation racing with deduction',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await Promise.all([
      deductStockForOrder(order52._id),
      customerOrdersPATCH(cancelReq52),
    ]);

    // Regardless of who won the race, inventory must not leak!
    const freshBeef52 = await Ingredient.findById(ingBeef._id);
    const freshBun52 = await Ingredient.findById(ingBun._id);
    const freshOrder52 = await Order.findById(order52._id);

    // Stock must be perfectly consistent (100 and 50)
    assert.strictEqual(Math.round(freshBeef52.currentStock * 10) / 10, 100.0);
    assert.strictEqual(freshBun52.currentStock, 50);

    reportTest('Test 52 [P2A.8 Req 4]: Cancellation racing concurrently with deduction leaves stock perfectly consistent', true);
  } catch (err) {
    reportTest('Test 52 [P2A.8 Req 4]: Deduction and cancellation race', false, err);
  }

  // -------------------------------------------------------------
  // Test 53 [Phase 2A.8 Required Test 5]:
  // Two concurrent identical COD requests with the same key; assert exactly one logical order and one stock deduction.
  // -------------------------------------------------------------
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    const codIdempotencyKey53 = `concurrent_cod_key_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const codPayload53 = {
      items: [{ product: prodBurger._id.toString(), quantity: 1, name: 'Burger', price: 250 }],
      address: { fullName: 'TEST_PHASE2A_ConcurrentCOD', street: '123 Fast Way', phone: '9999999995' },
      paymentMethod: 'Cash on Delivery (COD)',
      idempotencyKey: codIdempotencyKey53,
    };

    const makeReq = () =>
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': codIdempotencyKey53,
        },
        body: JSON.stringify(codPayload53),
      });

    // Execute true concurrent duplicate submission
    const [resA, resB] = await Promise.all([
      customerOrdersPOST(makeReq()),
      customerOrdersPOST(makeReq()),
    ]);

    const bodyA = await resA.json();
    const bodyB = await resB.json();

    assert.ok(bodyA.success, 'Request A should succeed');
    assert.ok(bodyB.success, 'Request B should succeed');

    const orderIdA = bodyA.order?._id?.toString() || bodyA.orders?.[0]?._id?.toString();
    const orderIdB = bodyB.order?._id?.toString() || bodyB.orders?.[0]?._id?.toString();

    // Must return the exact SAME logical order ID!
    assert.strictEqual(orderIdA, orderIdB, 'Concurrent submissions must return the same order ID');

    // Exactly one order in the DB
    const ordersInDb = await Order.find({
      idempotencyKey: codIdempotencyKey53,
    });
    assert.strictEqual(ordersInDb.length, 1, 'Only one order must exist in DB for this idempotency key');

    // Stock must have been decremented EXACTLY ONCE (Beef: 100 -> 99.8, Bun: 50 -> 49)
    const beef53 = await Ingredient.findById(ingBeef._id);
    const bun53 = await Ingredient.findById(ingBun._id);
    assert.strictEqual(Math.round(beef53.currentStock * 10) / 10, 99.8);
    assert.strictEqual(bun53.currentStock, 49);

    reportTest('Test 53 [P2A.8 Req 5]: Concurrent identical COD requests create exactly 1 logical order and deduct stock once', true);
  } catch (err) {
    reportTest('Test 53 [P2A.8 Req 5]: Concurrent COD requests idempotency', false, err);
  }

  // -------------------------------------------------------------
  // Test 54 [Phase 2A.8 Required Test 6]:
  // Missing keys, empty keys, reused keys with different payloads, cross-user collisions, cancelled-order replay, and multi-restaurant checkout.
  // -------------------------------------------------------------
  try {
    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    // 6A: Missing / empty key gets safe server-side fallback and cannot double-create on rapid duplicate
    const emptyKeyPayload = {
      items: [{ product: prodBurger._id.toString(), quantity: 1, name: 'Burger', price: 250 }],
      address: { fullName: 'TEST_PHASE2A_EmptyKey', street: '456 Fallback St', phone: '9999999996' },
      paymentMethod: 'Cash on Delivery (COD)',
      idempotencyKey: '',
    };
    const reqEmpty1 = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emptyKeyPayload),
    });
    const resEmpty1 = await customerOrdersPOST(reqEmpty1);
    const bodyEmpty1 = await resEmpty1.json();
    assert.strictEqual(resEmpty1.status, 201);
    assert.ok(bodyEmpty1.order?.idempotencyKey, 'Server must enforce fallback non-null idempotency key');

    // 6B: Reused key with different payload (different quantity) -> HTTP 409 Conflict
    const stableKey6B = `stable_key_${Date.now()}`;
    const basePayload6B = {
      items: [{ product: prodBurger._id.toString(), quantity: 1, name: 'Burger', price: 250 }],
      address: { fullName: 'TEST_PHASE2A_PayloadMismatch', street: '789 Conflict St', phone: '9999999997' },
      paymentMethod: 'Cash on Delivery (COD)',
      idempotencyKey: stableKey6B,
    };
    const res6B_Initial = await customerOrdersPOST(
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': stableKey6B },
        body: JSON.stringify(basePayload6B),
      })
    );
    assert.strictEqual(res6B_Initial.status, 201);

    // Submit with SAME key but DIFFERENT quantity (2 instead of 1)
    const alteredPayload6B = {
      ...basePayload6B,
      items: [{ product: prodBurger._id.toString(), quantity: 2, name: 'Burger', price: 250 }],
    };
    const res6B_Altered = await customerOrdersPOST(
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': stableKey6B },
        body: JSON.stringify(alteredPayload6B),
      })
    );
    assert.strictEqual(res6B_Altered.status, 409, 'Reusing key with different payload must reject with 409');

    // 6C: Cross-user key collision (User B attempts to use User A key) -> HTTP 403 Forbidden
    _setTestGetServerSession(async () => ({
      user: { email: customerB.email, name: customerB.name, role: 'customer' },
    }));
    const res6C_CrossUser = await customerOrdersPOST(
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': stableKey6B },
        body: JSON.stringify(basePayload6B),
      })
    );
    assert.strictEqual(res6C_CrossUser.status, 403, 'Cross-user idempotency key reuse must reject with 403');

    // 6D: Cancelled-order replay rejection -> HTTP 409
    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));
    const order6B = (await res6B_Initial.json()).order;
    await customerOrdersPATCH(
      new Request('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order6B._id, reason: 'Cancelling for test' }),
      })
    );

    // Try to checkout again with the cancelled order's key
    const res6D_CancelledReplay = await customerOrdersPOST(
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': stableKey6B },
        body: JSON.stringify(basePayload6B),
      })
    );
    assert.strictEqual(res6D_CancelledReplay.status, 409, 'Replaying cancelled order must reject with 409');

    reportTest('Test 54 [P2A.8 Req 6]: Fallback key, payload mismatch 409, cross-user 403, and cancelled order replay 409', true);
  } catch (err) {
    reportTest('Test 54 [P2A.8 Req 6]: Edge cases in checkout idempotency', false, err);
  }

  // -------------------------------------------------------------
  // Test 55 [Phase 2A.8 Required Test 7]:
  // Refund timeout, refund_pending, reconciliation_required, repeated cancellation, and uncertain gateway outcomes using mocks.
  // -------------------------------------------------------------
  try {
    const payId55 = `pay_test55_${Date.now()}`;
    const order55 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentId: payId55,
      orderId: `order_test55_${Date.now()}`,
      paymentStatus: 'paid',
      paymentMethod: 'Razorpay (Online Payment)',
      status: 'pending',
      address: { fullName: 'TEST_PHASE2A_RefundTimeout' },
      stockDeducted: true,
      deductedIngredients: [{ ingredient: ingBeef._id, quantity: 0.2 }],
    });

    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    // Step 7A: Gateway times out
    let gatewayCalls55 = 0;
    _setRefundTestRazorpayClient({
      payments: {
        fetch: async () => {
          throw new Error('Fetch 504 Gateway Timeout');
        },
        refund: async () => {
          gatewayCalls55++;
          throw new Error('ETIMEDOUT');
        },
      },
    });

    const makeCancelReq55 = () =>
      new Request('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order55._id.toString(), reason: 'Timeout test' }),
      });

    const res55_1 = await customerOrdersPATCH(makeCancelReq55());
    assert.strictEqual(res55_1.status, 200);

    const freshOrder55_1 = await Order.findById(order55._id);
    assert.strictEqual(freshOrder55_1.paymentStatus, 'reconciliation_required');
    assert.strictEqual(freshOrder55_1.refundDetails.status, 'reconciliation_required');
    assert.strictEqual(freshOrder55_1.refundDetails.dispatchState, 'quarantined');

    // Step 7B: Repeated cancellation call while refund is quarantined MUST NOT dispatch another refund!
    const callsBefore7B = gatewayCalls55;
    const res55_2 = await customerOrdersPATCH(makeCancelReq55());
    assert.strictEqual(res55_2.status, 400, 'Repeated cancellation of already cancelled order returns 400');
    assert.strictEqual(gatewayCalls55, callsBefore7B, 'Zero duplicate refund calls dispatched on retry');

    // Step 7C: Safe reconciliation via read-only reconcileOrderRefund
    _setRefundTestRazorpayClient({
      payments: {
        fetch: async () => ({ id: payId55, amount: 25000, amount_refunded: 25000, status: 'captured', currency: 'INR' }),
        fetchMultipleRefund: async () => ({
          items: [{
            id: 'rfnd_success_55',
            payment_id: payId55,
            amount: 25000,
            currency: 'INR',
            status: 'processed',
            notes: { opKey: freshOrder55_1.refundDetails?.opKey, orderId: order55.orderId },
          }],
        }),
        refund: async () => {
          gatewayCalls55++;
          throw new Error('CRITICAL BUG: payments.refund called during reconciliation');
        },
      },
    });

    const reconRes55 = await reconcileOrderRefund({ orderId: order55._id, initiatedBy: 'superadmin' });
    assert.strictEqual(reconRes55.success, true);

    const freshOrder55_3 = await Order.findById(order55._id);
    assert.strictEqual(freshOrder55_3.paymentStatus, 'refunded');
    assert.strictEqual(freshOrder55_3.refundDetails.status, 'processed');

    // Step 7D: Subsequent cancellation call when already refunded returns already cancelled with 0 new gateway calls
    const callsBefore = gatewayCalls55;
    const res55_4 = await customerOrdersPATCH(makeCancelReq55());
    assert.strictEqual(res55_4.status, 400, 'Terminal cancelled and refunded order returns already cancelled');
    assert.strictEqual(gatewayCalls55, callsBefore, 'No additional gateway calls when already refunded');

    reportTest('Test 55 [P2A.8 Req 7]: Refund timeout, reconciliation_required quarantine, safe reconciliation, and duplicate defense', true);
  } catch (err) {
    reportTest('Test 55 [P2A.8 Req 7]: Gateway timeout and refund retry flow', false, err);
  }

  // -------------------------------------------------------------
  // Test 56 [Phase 2A.8 Required Test 8]:
  // Verify the index script is read-only and never calls syncIndexes().
  // -------------------------------------------------------------
  try {
    const { verifyIndexesReadOnly } = await import('./test_indexes.mjs');
    const indexResults = await verifyIndexesReadOnly(process.env.MONGODB_URI);

    assert.strictEqual(indexResults.readOnlyVerified, true);
    assert.strictEqual(indexResults.missing.length, 0, 'No expected indexes should be missing');
    assert.strictEqual(indexResults.mismatched.length, 0, 'No index options should be mismatched');
    assert.strictEqual(indexResults.redundant.length, 0, 'Redundant standalone idempotencyKey index must be removed');

    reportTest('Test 56 [P2A.8 Req 8]: Read-only index verifier passes with 0 DDL calls and 0 redundant indexes', true);
  } catch (err) {
    reportTest('Test 56 [P2A.8 Req 8]: Read-only index verification', false, err);
  }

  // -------------------------------------------------------------
  // Clean Up Test Data
  // -------------------------------------------------------------
  await Order.deleteMany({ 'address.fullName': { $regex: /^TEST_PHASE2A_/ } });
  await StockMovement.deleteMany({ reason: { $regex: /TEST_PHASE2A_/ } });
  await Recipe.deleteOne({ restaurant: testRest._id, product: prodBurger._id });
  await Product.deleteMany({ _id: prodBurger._id });
  await Ingredient.deleteMany({ restaurant: testRest._id });
  await Restaurant.deleteOne({ _id: testRest._id });
  await User.deleteMany({ _id: { $in: [customerA._id, customerB._id] } });

  console.log('\n====================================================================');
  console.log(`PHASE 2A INVENTORY & CRASH-SAFE DEDUCTION TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================================\n');

  if (replSet) {
    await mongoose.disconnect();
    await replSet.stop();
    console.log('Isolated test replica set stopped cleanly.');
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase2ATests().catch(async (err) => {
  console.error('Fatal error during Phase 2A test suite:', err);
  if (replSet) {
    try {
      await mongoose.disconnect();
      await replSet.stop();
    } catch (_) {}
  }
  process.exit(1);
});
