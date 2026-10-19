import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import crypto from 'crypto';

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

let replSet = null;

async function runP0StagingSuite() {
  console.log('========================================================================');
  console.log('PHASE 2A.8: P0 STAGING VERIFICATION EXECUTION SUITE');
  console.log('========================================================================\n');

  // Safety confirmation: Verify strictly isolated loopback replica set
  console.log('[1/7] Initializing dedicated isolated test replica set on 127.0.0.1...');
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const localStagingUri = replSet.getUri('pet_protocols_staging_p0_isolated');
  process.env.MONGODB_URI = localStagingUri;
  process.env.TEST_MONGODB_URI = localStagingUri;

  if (global.mongoose) {
    global.mongoose.conn = null;
    global.mongoose.promise = null;
  }

  // Safety assertions: Verify isolation from Atlas
  assert.ok(localStagingUri.includes('127.0.0.1'), 'Must connect only to local loopback interface');
  assert.ok(!localStagingUri.includes('mongodb.net'), 'Must NOT connect to MongoDB Atlas');
  console.log(`[ISOLATION CONFIRMED] Staging Replica Set running at: ${localStagingUri}\n`);

  await connectDB();

  // Ensure isolated indexes
  await StockMovement.syncIndexes();
  await Ingredient.syncIndexes();
  await Order.syncIndexes();
  await PaymentIntent.syncIndexes();

  // Test Fixtures Setup
  console.log('[2/7] Seeding isolated test fixtures (Restaurants, Customers, Ingredients, Recipes)...');
  const testRest = await Restaurant.findOneAndUpdate(
    { slug: 'test-staging-kitchen-p0' },
    {
      name: 'P0 Staging Test Kitchen',
      slug: 'test-staging-kitchen-p0',
      status: 'active',
      isOpen: true,
      acceptingOrders: true,
      isTemporarilyClosed: false,
      cancellationSettings: {
        allowCustomerCancel: true,
        customerCancelWindowMinutes: 10,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const customerA = await User.findOneAndUpdate(
    { email: 'customer.alpha.staging.p0@test.com' },
    {
      name: 'Staging Customer Alpha',
      email: 'customer.alpha.staging.p0@test.com',
      role: 'customer',
      status: 'active',
    },
    { upsert: true, returnDocument: 'after' }
  );

  const customerB = await User.findOneAndUpdate(
    { email: 'customer.beta.staging.p0@test.com' },
    {
      name: 'Staging Customer Beta',
      email: 'customer.beta.staging.p0@test.com',
      role: 'customer',
      status: 'active',
    },
    { upsert: true, returnDocument: 'after' }
  );

  const ingBeef = await Ingredient.findOneAndUpdate(
    { restaurant: testRest._id, name: 'P0 Staging Gourmet Beef' },
    {
      restaurant: testRest._id,
      name: 'P0 Staging Gourmet Beef',
      unit: 'kg',
      currentStock: 100,
      minimumStock: 10,
      costPerUnit: 400,
      appliedDeductions: [],
      appliedRestorations: [],
    },
    { upsert: true, returnDocument: 'after' }
  );

  const ingBun = await Ingredient.findOneAndUpdate(
    { restaurant: testRest._id, name: 'P0 Staging Brioche Bun' },
    {
      restaurant: testRest._id,
      name: 'P0 Staging Brioche Bun',
      unit: 'pcs',
      currentStock: 50,
      minimumStock: 10,
      costPerUnit: 15,
      appliedDeductions: [],
      appliedRestorations: [],
    },
    { upsert: true, returnDocument: 'after' }
  );

  const prodBurger = await Product.findOneAndUpdate(
    { name: 'P0 Staging Burger' },
    {
      name: 'P0 Staging Burger',
      price: 250,
      restaurant: testRest._id,
      category: 'Burgers',
      isAvailable: true,
    },
    { upsert: true, returnDocument: 'after' }
  );

  await Recipe.findOneAndUpdate(
    { restaurant: testRest._id, product: prodBurger._id },
    {
      restaurant: testRest._id,
      product: prodBurger._id,
      productName: prodBurger.name,
      ingredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('[FIXTURES READY] Fixtures seeded successfully.\n');

  const testResults = [];

  // =========================================================================
  // TEST 1: Rapid duplicate COD submission with a stable client idempotency key
  // =========================================================================
  console.log('>>> EXECUTING TEST 1: Rapid Duplicate COD Submission with Stable Client Idempotency Key');
  try {
    // Reset stock to baseline
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });
    await Order.deleteMany({ 'address.fullName': 'TEST_P0_1_DUPLICATE_COD' });

    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    const clientKey1 = `client_p0_test1_${Date.now()}`;
    const payload1 = {
      items: [{ product: prodBurger._id.toString(), quantity: 1, name: 'Burger', price: 250 }],
      address: { fullName: 'TEST_P0_1_DUPLICATE_COD', street: '100 Main St', phone: '9876543210' },
      paymentMethod: 'Cash on Delivery (COD)',
      idempotencyKey: clientKey1,
    };

    const stockBeforeBeef = (await Ingredient.findById(ingBeef._id)).currentStock;
    const stockBeforeBun = (await Ingredient.findById(ingBun._id)).currentStock;
    const orderCountBefore = await Order.countDocuments({ 'address.fullName': 'TEST_P0_1_DUPLICATE_COD' });

    // Request 1: Fresh submission
    const req1 = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-idempotency-key': clientKey1 },
      body: JSON.stringify(payload1),
    });
    const res1 = await customerOrdersPOST(req1);
    const body1 = await res1.json();

    // Request 2: Rapid immediate duplicate submission with identical key and payload
    const req2 = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-idempotency-key': clientKey1 },
      body: JSON.stringify(payload1),
    });
    const res2 = await customerOrdersPOST(req2);
    const body2 = await res2.json();

    const stockAfterBeef = (await Ingredient.findById(ingBeef._id)).currentStock;
    const stockAfterBun = (await Ingredient.findById(ingBun._id)).currentStock;
    const orderCountAfter = await Order.countDocuments({ 'address.fullName': 'TEST_P0_1_DUPLICATE_COD' });
    const freshBeef = await Ingredient.findById(ingBeef._id);

    // Assertions
    assert.strictEqual(res1.status, 201, 'Request 1 must return HTTP 201 Created');
    assert.strictEqual(body1.success, true);
    assert.strictEqual(body1.idempotentReplay, false, 'Request 1 idempotentReplay must be false');

    assert.strictEqual(res2.status, 200, 'Request 2 must return HTTP 200 OK replay');
    assert.strictEqual(body2.success, true);
    assert.strictEqual(body2.idempotentReplay, true, 'Request 2 idempotentReplay must be true');

    const orderId1 = body1.order._id.toString();
    const orderId2 = body2.order._id.toString();
    assert.strictEqual(orderId1, orderId2, 'Both requests must return the exact same Order ID');

    assert.strictEqual(orderCountBefore, 0);
    assert.strictEqual(orderCountAfter, 1, 'Exactly one order document must exist in database');

    assert.strictEqual(stockBeforeBeef, 100);
    assert.strictEqual(stockBeforeBun, 50);
    assert.strictEqual(Math.round(stockAfterBeef * 10) / 10, 99.8, 'Beef must decrement exactly once (100 -> 99.8)');
    assert.strictEqual(stockAfterBun, 49, 'Bun must decrement exactly once (50 -> 49)');

    // Durable operation marker verification
    const hasDurableMarker = freshBeef.appliedDeductions.some(
      (d) => d.orderId?.toString() === orderId1 && d.quantity === 0.2
    );
    assert.ok(hasDurableMarker, 'Durable operation marker must be permanently retained on Ingredient');

    const savedOrder = await Order.findById(orderId1);
    assert.strictEqual(savedOrder.status, 'pending');
    assert.strictEqual(savedOrder.paymentStatus, 'pending');
    assert.strictEqual(savedOrder.stockDeducted, true);
    assert.strictEqual(savedOrder.stockDeduction.status, 'completed');
    assert.strictEqual(savedOrder.idempotencyKey, clientKey1);
    assert.ok(savedOrder.payloadHash, 'Payload hash must be persisted');

    console.log('  [PASS] Test 1: Rapid duplicate COD submission with client key');
    testResults.push({
      test: 'Test 1: Rapid duplicate COD submission with a stable client idempotency key',
      status: 'PASS',
      details: {
        httpResponses: [
          { request: 'POST /api/orders (Req 1)', status: res1.status, idempotentReplay: body1.idempotentReplay, orderId: orderId1 },
          { request: 'POST /api/orders (Req 2)', status: res2.status, idempotentReplay: body2.idempotentReplay, orderId: orderId2 },
        ],
        stockCounts: {
          beef: { before: stockBeforeBeef, after: stockAfterBeef, delta: -0.2 },
          bun: { before: stockBeforeBun, after: stockAfterBun, delta: -1 },
        },
        orderCounts: { before: orderCountBefore, after: orderCountAfter },
        orderState: {
          id: orderId1,
          status: savedOrder.status,
          stockDeducted: savedOrder.stockDeducted,
          stockDeductionStatus: savedOrder.stockDeduction.status,
          idempotencyKey: savedOrder.idempotencyKey,
        },
        durableMarkersRetained: true,
      },
    });
  } catch (err) {
    console.error('  [FAIL] Test 1:', err.message);
    testResults.push({
      test: 'Test 1: Rapid duplicate COD submission with a stable client idempotency key',
      status: 'FAIL',
      error: err.message,
    });
  }

  // =========================================================================
  // TEST 2: Same-bucket and cross-bucket fallback-key behavior
  // =========================================================================
  console.log('\n>>> EXECUTING TEST 2: Same-Bucket and Cross-Bucket Fallback-Key Behavior');
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });
    await Order.deleteMany({ 'address.fullName': 'TEST_P0_2_FALLBACK_KEY' });

    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    const payloadNoKey = {
      items: [{ product: prodBurger._id.toString(), quantity: 1, name: 'Burger', price: 250 }],
      address: { fullName: 'TEST_P0_2_FALLBACK_KEY', street: '200 Fallback Ln', phone: '9876543211' },
      paymentMethod: 'Cash on Delivery (COD)',
      // Note: idempotencyKey omitted entirely to test server-side fallback derivation
    };

    const stockBeforeT2 = (await Ingredient.findById(ingBeef._id)).currentStock;
    const ordersBeforeT2 = await Order.countDocuments({ 'address.fullName': 'TEST_P0_2_FALLBACK_KEY' });

    // Sub-test 2A: Same 60-second bucket
    const req2A_1 = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadNoKey),
    });
    const res2A_1 = await customerOrdersPOST(req2A_1);
    const body2A_1 = await res2A_1.json();

    const req2A_2 = new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadNoKey),
    });
    const res2A_2 = await customerOrdersPOST(req2A_2);
    const body2A_2 = await res2A_2.json();

    assert.strictEqual(res2A_1.status, 201, 'Same-bucket Request 1 must return HTTP 201 Created');
    assert.strictEqual(body2A_1.idempotentReplay, false);
    assert.ok(body2A_1.order.idempotencyKey.startsWith('server_fallback_'), 'Server fallback key prefix required');

    assert.strictEqual(res2A_2.status, 200, 'Same-bucket Request 2 must return HTTP 200 OK replay');
    assert.strictEqual(body2A_2.idempotentReplay, true);
    assert.strictEqual(body2A_1.order._id.toString(), body2A_2.order._id.toString(), 'Same-bucket requests must return same order ID');

    const stockMidT2 = (await Ingredient.findById(ingBeef._id)).currentStock;
    const ordersMidT2 = await Order.countDocuments({ 'address.fullName': 'TEST_P0_2_FALLBACK_KEY' });
    assert.strictEqual(ordersMidT2, 1, 'Same bucket duplicate must result in exactly 1 order in DB');
    assert.strictEqual(Math.round(stockMidT2 * 10) / 10, 99.8, 'Stock decremented exactly once in same bucket');

    // Sub-test 2B: Cross-bucket boundary (mock time advance by 65,000 ms)
    const realDateNow = Date.now;
    try {
      Date.now = () => realDateNow() + 65000; // Move into next 1-minute bucket

      const req2B = new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadNoKey),
      });
      const res2B = await customerOrdersPOST(req2B);
      const body2B = await res2B.json();

      assert.strictEqual(res2B.status, 201, 'Cross-bucket submission must return HTTP 201 Created (derived new fallback key)');
      assert.strictEqual(body2B.idempotentReplay, false);
      assert.notStrictEqual(body2B.order._id.toString(), body2A_1.order._id.toString(), 'Cross-bucket request must create a second order');
      assert.notStrictEqual(body2B.order.idempotencyKey, body2A_1.order.idempotencyKey, 'Cross-bucket fallback keys must differ');

      const stockAfterT2 = (await Ingredient.findById(ingBeef._id)).currentStock;
      const ordersAfterT2 = await Order.countDocuments({ 'address.fullName': 'TEST_P0_2_FALLBACK_KEY' });
      assert.strictEqual(ordersAfterT2, 2, 'Total orders after cross-bucket submission must equal 2');
      assert.strictEqual(Math.round(stockAfterT2 * 10) / 10, 99.6, 'Stock decremented a second time across minute bucket');

      console.log('  [PASS] Test 2: Same-bucket (HTTP 200 replay) and cross-bucket (HTTP 201 split) verified');
      testResults.push({
        test: 'Test 2: Same-bucket and cross-bucket fallback-key behavior',
        status: 'PASS',
        details: {
          sameBucket: {
            req1: { status: res2A_1.status, idempotentReplay: body2A_1.idempotentReplay, orderId: body2A_1.order._id, key: body2A_1.order.idempotencyKey },
            req2: { status: res2A_2.status, idempotentReplay: body2A_2.idempotentReplay, orderId: body2A_2.order._id, key: body2A_2.order.idempotencyKey },
            ordersInDb: ordersMidT2,
            stockAfter: stockMidT2,
          },
          crossBucket: {
            req3: { status: res2B.status, idempotentReplay: body2B.idempotentReplay, orderId: body2B.order._id, key: body2B.order.idempotencyKey },
            ordersInDb: ordersAfterT2,
            stockAfter: stockAfterT2,
          },
          findingConfirmed: 'Demonstrated why browser frontend must supply stable UUID across retries to prevent split-key submission across minute boundaries.',
        },
      });
    } finally {
      Date.now = realDateNow;
    }
  } catch (err) {
    console.error('  [FAIL] Test 2:', err.message);
    testResults.push({
      test: 'Test 2: Same-bucket and cross-bucket fallback-key behavior',
      status: 'FAIL',
      error: err.message,
    });
  }

  // =========================================================================
  // TEST 3: Stalled inventory deduction versus cancellation
  // =========================================================================
  console.log('\n>>> EXECUTING TEST 3: Stalled Inventory Deduction versus Cancellation');
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    // Create order in DB with deduction not yet executed
    const order3 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      address: { fullName: 'TEST_P0_3_STALLED_DEDUCTION', street: '300 Pause Ave', phone: '9876543212' },
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
        { ingredient: ingBun._id, ingredientName: ingBun.name, quantity: 1, unit: 'pcs' },
      ],
    });

    const stockBeforeBeefT3 = (await Ingredient.findById(ingBeef._id)).currentStock;
    const stockBeforeBunT3 = (await Ingredient.findById(ingBun._id)).currentStock;

    let workerPaused = false;
    let resumeWorker = null;
    const workerPausedPromise = new Promise((resolve) => {
      const resumePromise = new Promise((res) => {
        resumeWorker = res;
      });
      _setTestDeductionPauseHook(async ({ orderId }) => {
        if (orderId.toString() === order3._id.toString() && !workerPaused) {
          workerPaused = true;
          resolve();
          await resumePromise; // Hold worker here before Ingredient mutation
        }
      });
    });

    // Start Worker A deduction asynchronously
    const workerPromise = deductStockForOrder(order3._id);

    // Wait until Worker A is paused
    await workerPausedPromise;

    // While Worker A is paused, customer completes cancellation
    const cancelReq = new Request('http://localhost:3000/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order3._id.toString(),
        reason: 'Customer cancelled while deduction was pending',
      }),
    });
    const cancelRes = await customerOrdersPATCH(cancelReq);
    const cancelBody = await cancelRes.json();
    assert.strictEqual(cancelRes.status, 200, 'Cancellation PATCH must succeed with HTTP 200');

    // Resume Worker A
    _setTestDeductionPauseHook(null);
    if (typeof resumeWorker === 'function') resumeWorker();

    const deductionResult = await workerPromise;

    // Assert worker aborted cleanly
    assert.strictEqual(deductionResult.success, false, 'Worker deduction must not succeed');
    assert.strictEqual(deductionResult.aborted, true, 'Worker must detect cancellation and abort');

    const stockAfterBeefT3 = (await Ingredient.findById(ingBeef._id)).currentStock;
    const stockAfterBunT3 = (await Ingredient.findById(ingBun._id)).currentStock;
    const finalOrder3 = await Order.findById(order3._id);

    // Stock must be 100% intact (0 phantom loss)
    assert.strictEqual(stockAfterBeefT3, 100.0, 'Beef stock must remain 100.0 (0 leak)');
    assert.strictEqual(stockAfterBunT3, 50, 'Bun stock must remain 50 (0 leak)');
    assert.strictEqual(finalOrder3.status, 'cancelled');
    assert.strictEqual(finalOrder3.stockDeducted, false);

    console.log('  [PASS] Test 3: Stalled deduction worker safely aborted after cancellation with 0 stock leak');
    testResults.push({
      test: 'Test 3: Stalled inventory deduction versus cancellation',
      status: 'PASS',
      details: {
        cancellationResponse: { status: cancelRes.status, body: cancelBody },
        workerDeductionResult: deductionResult,
        stockCounts: {
          beef: { before: stockBeforeBeefT3, after: stockAfterBeefT3, delta: 0 },
          bun: { before: stockBeforeBunT3, after: stockAfterBunT3, delta: 0 },
        },
        finalOrderState: {
          id: order3._id.toString(),
          status: finalOrder3.status,
          stockDeducted: finalOrder3.stockDeducted,
          stockDeductionStatus: finalOrder3.stockDeduction?.status,
        },
        evidence: 'Atomic query cancellation guard prevented decrement, worker returned aborted: true.',
      },
    });
  } catch (err) {
    _setTestDeductionPauseHook(null);
    console.error('  [FAIL] Test 3:', err.message);
    testResults.push({
      test: 'Test 3: Stalled inventory deduction versus cancellation',
      status: 'FAIL',
      error: err.message,
    });
  }

  // =========================================================================
  // TEST 4: Self-compensation after deduction lease revocation
  // =========================================================================
  console.log('\n>>> EXECUTING TEST 4: Self-Compensation after Deduction Lease Revocation');
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });

    const order4 = await Order.create({
      user: customerA._id,
      restaurant: testRest._id,
      items: [{ product: prodBurger._id, quantity: 1, price: 250, name: 'Burger' }],
      totalAmount: 250,
      paymentStatus: 'pending',
      paymentMethod: 'Cash On Delivery',
      status: 'pending',
      address: { fullName: 'TEST_P0_4_SELF_COMPENSATION', street: '400 Lease Revoke St', phone: '9876543213' },
      stockDeducted: false,
      deductedIngredients: [
        { ingredient: ingBeef._id, ingredientName: ingBeef.name, quantity: 0.2, unit: 'kg' },
      ],
    });

    const stockBeforeBeefT4 = (await Ingredient.findById(ingBeef._id)).currentStock;

    // Simulate crash/revocation between Ingredient decrement and Order checkpoint:
    // Intercept StockMovement.create so right after Ingredient decrement and StockMovement insert,
    // we revoke the worker's lease on Order before the worker checkpoints Order.
    const originalStockMovementCreate = StockMovement.create;
    StockMovement.create = async function (...args) {
      const result = await originalStockMovementCreate.apply(this, args);
      const doc = Array.isArray(args[0]) ? args[0][0] : args[0];
      if (doc?.referenceId === order4._id.toString()) {
        await Order.updateOne(
          { _id: order4._id },
          {
            $set: {
              'stockDeduction.leaseToken': null,
              'stockDeduction.status': 'revoked',
              status: 'cancelled',
            },
          }
        );
      }
      return result;
    };

    let deductionResult4;
    try {
      deductionResult4 = await deductStockForOrder(order4._id);
    } finally {
      StockMovement.create = originalStockMovementCreate;
    }

    assert.strictEqual(deductionResult4.success, false, 'Deduction must fail due to revoked lease');
    assert.strictEqual(deductionResult4.aborted, true, 'Worker must abort after checkpoint mismatch');
    assert.match(deductionResult4.message, /self-compensated/i, 'Worker must declare self-compensation in message');

    const stockAfterBeefT4 = (await Ingredient.findById(ingBeef._id)).currentStock;
    const finalOrder4 = await Order.findById(order4._id);
    const beefDoc4 = await Ingredient.findById(ingBeef._id);

    // Stock must have self-compensated back to exact baseline (100.0)
    assert.strictEqual(Math.round(stockAfterBeefT4 * 10) / 10, 100.0, 'Beef stock must restore to 100.0 via self-compensation');
    assert.strictEqual(finalOrder4.stockDeduction.status, 'revoked');

    // Durable opKey must have been cleaned up by self-compensation
    const hasLingeringOpKey = (beefDoc4.appliedDeductions || []).some(
      (d) => d.orderId?.toString() === order4._id.toString()
    );
    assert.strictEqual(hasLingeringOpKey, false, 'Self-compensation must pull temporary deduction marker');

    console.log('  [PASS] Test 4: Self-compensation executed cleanly upon lease revocation (0 stock leak)');
    testResults.push({
      test: 'Test 4: Self-compensation after deduction lease revocation',
      status: 'PASS',
      details: {
        workerResult: deductionResult4,
        stockCounts: {
          beef: { before: stockBeforeBeefT4, after: stockAfterBeefT4, delta: 0 },
        },
        finalOrderState: {
          id: order4._id.toString(),
          status: finalOrder4.status,
          stockDeductionStatus: finalOrder4.stockDeduction.status,
          leaseToken: finalOrder4.stockDeduction.leaseToken,
        },
        evidence: 'Order checkpoint failed due to revoked lease, triggering atomic self-compensation $inc: +0.2 on Ingredient.',
      },
    });
  } catch (err) {
    console.error('  [FAIL] Test 4:', err.message);
    testResults.push({
      test: 'Test 4: Self-compensation after deduction lease revocation',
      status: 'FAIL',
      error: err.message,
    });
  }

  // =========================================================================
  // TEST 5: Cross-user idempotency-key replay and payload tampering
  // =========================================================================
  console.log('\n>>> EXECUTING TEST 5: Cross-User Idempotency-Key Replay and Payload Tampering');
  try {
    await Ingredient.updateOne({ _id: ingBeef._id }, { $set: { currentStock: 100, appliedDeductions: [], appliedRestorations: [] } });
    await Ingredient.updateOne({ _id: ingBun._id }, { $set: { currentStock: 50, appliedDeductions: [], appliedRestorations: [] } });
    await Order.deleteMany({ 'address.fullName': { $regex: /^TEST_P0_5_/ } });

    // Step 5.1: Customer Alpha places initial order with a key
    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    const stableKey5 = `client_p0_sec_key_${Date.now()}`;
    const basePayload5 = {
      items: [{ product: prodBurger._id.toString(), quantity: 1, name: 'Burger', price: 250 }],
      address: { fullName: 'TEST_P0_5_ALPHA', street: '500 Security Blvd', phone: '9876543215' },
      paymentMethod: 'Cash on Delivery (COD)',
      idempotencyKey: stableKey5,
    };

    const stockBeforeT5 = (await Ingredient.findById(ingBeef._id)).currentStock;
    const ordersBeforeT5 = await Order.countDocuments({ 'address.fullName': { $regex: /^TEST_P0_5_/ } });

    const res5_Init = await customerOrdersPOST(
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': stableKey5 },
        body: JSON.stringify(basePayload5),
      })
    );
    const body5_Init = await res5_Init.json();
    assert.strictEqual(res5_Init.status, 201, 'Customer Alpha initial order must succeed with HTTP 201');
    const orderId5 = body5_Init.order._id.toString();

    // Step 5.2: Cross-user replay (Customer Beta attempts to reuse Customer Alpha's key) -> HTTP 403 Forbidden
    _setTestGetServerSession(async () => ({
      user: { email: customerB.email, name: customerB.name, role: 'customer' },
    }));

    const res5_CrossUser = await customerOrdersPOST(
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': stableKey5 },
        body: JSON.stringify(basePayload5),
      })
    );
    const body5_CrossUser = await res5_CrossUser.json();
    assert.strictEqual(res5_CrossUser.status, 403, 'Cross-user key reuse must return HTTP 403 Forbidden');
    assert.strictEqual(body5_CrossUser.success, false);
    assert.match(body5_CrossUser.message, /another user account/i);

    // Step 5.3: Payload tampering / cart modification by original Customer Alpha -> HTTP 409 Conflict
    _setTestGetServerSession(async () => ({
      user: { email: customerA.email, name: customerA.name, role: 'customer' },
    }));

    const tamperedPayload = {
      ...basePayload5,
      items: [{ product: prodBurger._id.toString(), quantity: 2, name: 'Burger', price: 250 }], // altered quantity
    };

    const res5_Tamper = await customerOrdersPOST(
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': stableKey5 },
        body: JSON.stringify(tamperedPayload),
      })
    );
    const body5_Tamper = await res5_Tamper.json();
    assert.strictEqual(res5_Tamper.status, 409, 'Payload tampering must return HTTP 409 Conflict');
    assert.strictEqual(body5_Tamper.success, false);
    assert.match(body5_Tamper.message, /different cart items/i);

    // Step 5.4: Cancelled-order replay -> HTTP 409 Conflict
    // Customer Alpha cancels the order
    const cancelRes5 = await customerOrdersPATCH(
      new Request('http://localhost:3000/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId5, reason: 'Cancelling for test' }),
      })
    );
    assert.strictEqual(cancelRes5.status, 200);

    // Replay checkout attempt with the cancelled order's key
    const res5_CancelledReplay = await customerOrdersPOST(
      new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': stableKey5 },
        body: JSON.stringify(basePayload5),
      })
    );
    const body5_CancelledReplay = await res5_CancelledReplay.json();
    assert.strictEqual(res5_CancelledReplay.status, 409, 'Replay on cancelled order must return HTTP 409 Conflict');
    assert.strictEqual(body5_CancelledReplay.success, false);
    assert.match(body5_CancelledReplay.message, /cancelled/i);

    const stockAfterT5 = (await Ingredient.findById(ingBeef._id)).currentStock;
    const ordersAfterT5 = await Order.countDocuments({ 'address.fullName': { $regex: /^TEST_P0_5_/ } });

    // Stock was decremented once at checkout, then restored once at cancellation -> returns to 100.0
    assert.strictEqual(Math.round(stockAfterT5 * 10) / 10, 100.0, 'Stock must return to 100.0 after cancellation');
    assert.strictEqual(ordersAfterT5, 1, 'Only 1 order created in DB');

    console.log('  [PASS] Test 5: Cross-user rejection (403), payload tampering (409), and cancelled replay (409) verified');
    testResults.push({
      test: 'Test 5: Cross-user idempotency-key replay and payload tampering',
      status: 'PASS',
      details: {
        initialOrder: { status: res5_Init.status, orderId: orderId5 },
        crossUserAttempt: { status: res5_CrossUser.status, message: body5_CrossUser.message },
        tamperedPayloadAttempt: { status: res5_Tamper.status, message: body5_Tamper.message },
        cancelledReplayAttempt: { status: res5_CancelledReplay.status, message: body5_CancelledReplay.message },
        ordersInDb: ordersAfterT5,
        finalStock: stockAfterT5,
      },
    });
  } catch (err) {
    console.error('  [FAIL] Test 5:', err.message);
    testResults.push({
      test: 'Test 5: Cross-user idempotency-key replay and payload tampering',
      status: 'FAIL',
      error: err.message,
    });
  }

  // Teardown
  if (replSet) {
    await replSet.stop();
  }

  console.log('\n========================================================================');
  console.log('P0 STAGING EXECUTION SUITE SUMMARY');
  console.log('========================================================================');
  console.log(JSON.stringify(testResults, null, 2));

  return testResults;
}

runP0StagingSuite().catch((e) => {
  console.error('FATAL SUITE ERROR:', e);
  if (replSet) replSet.stop().catch(() => {});
  process.exit(1);
});
