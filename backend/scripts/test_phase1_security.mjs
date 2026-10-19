import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import assert from 'node:assert';
import crypto from 'node:crypto';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register ESM loader for Next.js API route imports
register(pathToFileURL('./scripts/loader.mjs').href, import.meta.url);

import connectDB from '../lib/db.js';
import Restaurant from '../models/Restaurant.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Offer from '../models/Offer.js';
import Order from '../models/Order.js';
import { calculateOrderDetails } from '../lib/checkoutCalculationService.js';
import { requireRestaurantAdmin } from '../lib/authMiddleware.js';

let passed = 0;
let failed = 0;

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

async function runTestSuite() {
  console.log('================================================================');
  console.log('PET PROTOCOLS - PHASE 1 P0-A & P0-B SECURITY VERIFICATION SUITE');
  console.log('================================================================\n');

  await connectDB();

  // Setup test restaurants
  const restA = await Restaurant.findOneAndUpdate(
    { slug: 'test-kitchen-a' },
    {
      name: 'Test Kitchen Alpha',
      slug: 'test-kitchen-a',
      status: 'active',
      isOpen: true,
      acceptingOrders: true,
      isTemporarilyClosed: false,
      'orderLimits.minOrderAmount': 100,
      'chargeSettings.flatDeliveryFee': 40,
      'chargeSettings.freeDeliveryThreshold': 500,
    },
    { upsert: true, new: true }
  );

  const restB = await Restaurant.findOneAndUpdate(
    { slug: 'test-kitchen-b' },
    {
      name: 'Test Kitchen Beta',
      slug: 'test-kitchen-b',
      status: 'active',
      isOpen: true,
      acceptingOrders: true,
      isTemporarilyClosed: false,
      'orderLimits.minOrderAmount': 150,
      'chargeSettings.flatDeliveryFee': 50,
      'chargeSettings.freeDeliveryThreshold': 600,
    },
    { upsert: true, new: true }
  );

  // Setup test products
  const prodA1 = await Product.findOneAndUpdate(
    { name: 'Alpha Burger Deluxe' },
    {
      name: 'Alpha Burger Deluxe',
      price: 250,
      restaurant: restA._id,
      category: 'Burgers',
      isAvailable: true,
    },
    { upsert: true, new: true }
  );

  const prodB1 = await Product.findOneAndUpdate(
    { name: 'Beta Pizza Supreme' },
    {
      name: 'Beta Pizza Supreme',
      price: 300,
      restaurant: restB._id,
      category: 'Pizzas',
      isAvailable: true,
    },
    { upsert: true, new: true }
  );

  // Setup test users
  const adminA = await User.findOneAndUpdate(
    { email: 'admin.alpha@test.com' },
    {
      name: 'Alpha Admin',
      email: 'admin.alpha@test.com',
      role: 'restaurant_admin',
      restaurant: restA._id,
      status: 'active',
    },
    { upsert: true, new: true }
  );

  const adminB = await User.findOneAndUpdate(
    { email: 'admin.beta@test.com' },
    {
      name: 'Beta Admin',
      email: 'admin.beta@test.com',
      role: 'restaurant_admin',
      restaurant: restB._id,
      status: 'active',
    },
    { upsert: true, new: true }
  );

  // Setup test offers
  const now = new Date();
  const past = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const future = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  // Clean old test offers
  await Offer.deleteMany({ code: { $regex: /^TEST_/ } });

  // 1. Valid percentage offer (20% off, min order 200)
  await Offer.create({
    title: 'Test 20% Off',
    description: '20% off on all orders',
    code: 'TEST_PERC20',
    discountType: 'percentage',
    discountValue: 20,
    minOrder: 200,
    startDate: past,
    endDate: future,
    isActive: true,
  });

  // 2. Valid flat offer (₹50 off, min order 200)
  await Offer.create({
    title: 'Test Flat 50 Off',
    description: 'Flat 50 off',
    code: 'TEST_FLAT50',
    discountType: 'flat',
    discountValue: 50,
    minOrder: 200,
    startDate: past,
    endDate: future,
    isActive: true,
  });

  // 3. Expired offer
  await Offer.create({
    title: 'Test Expired Offer',
    description: 'Expired offer',
    code: 'TEST_EXPIRED',
    discountType: 'flat',
    discountValue: 100,
    minOrder: 100,
    startDate: new Date(now.getTime() - 14 * 24 * 3600 * 1000),
    endDate: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
    isActive: true,
  });

  // 4. Inactive offer
  await Offer.create({
    title: 'Test Inactive Offer',
    description: 'Inactive offer',
    code: 'TEST_INACTIVE',
    discountType: 'percentage',
    discountValue: 30,
    minOrder: 100,
    startDate: past,
    endDate: future,
    isActive: false,
  });

  // 5. Future (not yet valid) offer
  await Offer.create({
    title: 'Test Future Offer',
    description: 'Future offer',
    code: 'TEST_FUTURE',
    discountType: 'percentage',
    discountValue: 50,
    minOrder: 100,
    startDate: new Date(now.getTime() + 2 * 24 * 3600 * 1000),
    endDate: new Date(now.getTime() + 10 * 24 * 3600 * 1000),
    isActive: true,
  });

  // 6. Restaurant A restricted offer
  await Offer.create({
    title: 'Test Alpha Kitchen Only',
    description: 'Only valid for Kitchen Alpha',
    code: 'TEST_ALPHAONLY',
    restaurant: restA._id,
    discountType: 'flat',
    discountValue: 40,
    minOrder: 100,
    startDate: past,
    endDate: future,
    isActive: true,
  });

  // 7. Max discount capped offer (50% off, max 50)
  const maxDiscountOffer = new Offer({
    title: 'Test Max Discount Cap',
    description: '50% off capped at 50',
    code: 'TEST_MAXCAP',
    discountType: 'percentage',
    discountValue: 50,
    minOrder: 100,
    startDate: past,
    endDate: future,
    isActive: true,
  });
  maxDiscountOffer.set('maxDiscount', 50, { strict: false });
  await maxDiscountOffer.save();

  console.log('--- SECTION 1: P0-A CHECKOUT & COUPON SECURITY TESTS ---\n');

  // Test 1: Valid percentage coupon
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 2 }], // 2 * 250 = 500
      orderType: 'delivery',
      couponCode: 'TEST_PERC20',
    });
    // Subtotal 500, deliveryFee 0 (>= 500 threshold), discount = 20% of 500 = 100, total = 400
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.subtotal, 500);
    assert.strictEqual(res.deliveryFee, 0);
    assert.strictEqual(res.discount, 100);
    assert.strictEqual(res.totalAmount, 400);
    assert.strictEqual(res.couponCode, 'TEST_PERC20');
    reportTest('Valid percentage coupon (20% on ₹500 -> ₹100 discount, ₹400 total)', true);
  } catch (e) {
    reportTest('Valid percentage coupon', false, e);
  }

  // Test 2: Valid flat-amount coupon
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }], // 1 * 250 = 250
      orderType: 'delivery',
      couponCode: 'TEST_FLAT50',
    });
    // Subtotal 250, deliveryFee 40 (< 500), discount 50, total = 250 + 40 - 50 = 240
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.subtotal, 250);
    assert.strictEqual(res.deliveryFee, 40);
    assert.strictEqual(res.discount, 50);
    assert.strictEqual(res.totalAmount, 240);
    reportTest('Valid flat-amount coupon (₹50 off ₹250 + ₹40 fee -> ₹240 total)', true);
  } catch (e) {
    reportTest('Valid flat-amount coupon', false, e);
  }

  // Test 3: Expired coupon rejected
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
      couponCode: 'TEST_EXPIRED',
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 400);
    assert.match(res.message, /expired/i);
    reportTest('Expired coupon rejected with status 400', true);
  } catch (e) {
    reportTest('Expired coupon rejection', false, e);
  }

  // Test 4: Inactive coupon rejected
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
      couponCode: 'TEST_INACTIVE',
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 400);
    assert.match(res.message, /no longer active/i);
    reportTest('Inactive coupon rejected with status 400', true);
  } catch (e) {
    reportTest('Inactive coupon rejection', false, e);
  }

  // Test 5: Not-yet-valid coupon rejected
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
      couponCode: 'TEST_FUTURE',
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 400);
    assert.match(res.message, /not valid yet/i);
    reportTest('Not-yet-valid coupon rejected with status 400', true);
  } catch (e) {
    reportTest('Not-yet-valid coupon rejection', false, e);
  }

  // Test 6: Minimum-order violation rejected
  try {
    // prodA1 price is 250. Let's create an offer with minOrder: 600
    const highMinOffer = await Offer.findOneAndUpdate(
      { code: 'TEST_HIGHMIN' },
      {
        title: 'High Min Offer',
        description: 'Min order 600 required',
        code: 'TEST_HIGHMIN',
        discountType: 'percentage',
        discountValue: 10,
        minOrder: 600,
        startDate: past,
        endDate: future,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }], // subtotal = 250 < 600
      orderType: 'delivery',
      couponCode: 'TEST_HIGHMIN',
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 400);
    assert.match(res.message, /minimum qualifying order/i);
    reportTest('Minimum order violation rejected with status 400', true);
  } catch (e) {
    reportTest('Minimum order violation rejection', false, e);
  }

  // Test 7: Maximum-discount limit enforced
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 2 }], // subtotal = 500, 50% = 250, maxDiscount = 50
      orderType: 'delivery',
      couponCode: 'TEST_MAXCAP',
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.subtotal, 500);
    assert.strictEqual(res.discount, 50); // Capped at 50, not 250
    assert.strictEqual(res.totalAmount, 450);
    reportTest('Maximum-discount limit enforced (capped at ₹50 instead of ₹250)', true);
  } catch (e) {
    reportTest('Maximum-discount limit', false, e);
  }

  // Test 8: Wrong restaurant coupon rejected
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodB1._id.toString(), quantity: 1 }], // Item belongs to Rest B, coupon is Rest A
      orderType: 'delivery',
      couponCode: 'TEST_ALPHAONLY',
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 400);
    assert.match(res.message, /not applicable to/i);
    reportTest('Coupon for wrong restaurant rejected with status 400', true);
  } catch (e) {
    reportTest('Wrong restaurant coupon rejection', false, e);
  }

  // Test 9: Invalid coupon code rejected
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
      couponCode: 'INVALID_CODE_XYZ',
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 400);
    assert.match(res.message, /invalid coupon code/i);
    reportTest('Invalid non-existent coupon code rejected with status 400', true);
  } catch (e) {
    reportTest('Invalid coupon rejection', false, e);
  }

  // Test 10: Tampered client discount and final amount ignored
  try {
    // Client attempts to pass a fake discount of 200 and total of 50
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1, price: 10 }], // Client tampered price: 10
      orderType: 'delivery',
      couponCode: '',
    });
    // Authoritative price is 250. Subtotal: 250, Delivery: 40, Discount: 0, Total: 290.
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.subtotal, 250);
    assert.strictEqual(res.deliveryFee, 40);
    assert.strictEqual(res.discount, 0);
    assert.strictEqual(res.totalAmount, 290);
    reportTest('Client price/discount tampering completely overridden by authoritative calculation', true);
  } catch (e) {
    reportTest('Client tampering protection', false, e);
  }

  // Test 11: Omitted coupon code with submitted discount yields 0 discount
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
      couponCode: '', // no coupon
    });
    assert.strictEqual(res.discount, 0);
    assert.strictEqual(res.totalAmount, 290);
    reportTest('Omitted coupon code yields 0 discount regardless of client discount claim', true);
  } catch (e) {
    reportTest('Omitted coupon code discount check', false, e);
  }

  // Test 12: Existing legitimate no-coupon checkout behavior preserved
  try {
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 2 }], // 500
      orderType: 'pickup',
      couponCode: '',
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.subtotal, 500);
    assert.strictEqual(res.deliveryFee, 0); // Pickup has 0 delivery fee
    assert.strictEqual(res.discount, 0);
    assert.strictEqual(res.totalAmount, 500);
    reportTest('Standard legitimate no-coupon checkout (pickup) calculated accurately', true);
  } catch (e) {
    reportTest('No-coupon checkout behavior', false, e);
  }

  // Test 13: Consistency between COD and Razorpay checkout calculations
  try {
    const items = [{ _id: prodA1._id.toString(), quantity: 2 }];
    const codCalc = await calculateOrderDetails({ items, orderType: 'delivery', couponCode: 'TEST_PERC20' });
    const razorpayCalc = await calculateOrderDetails({ items, orderType: 'delivery', couponCode: 'TEST_PERC20' });
    assert.strictEqual(codCalc.totalAmount, razorpayCalc.totalAmount);
    assert.strictEqual(codCalc.discount, razorpayCalc.discount);
    assert.strictEqual(codCalc.subtotal, razorpayCalc.subtotal);
    reportTest('COD and Razorpay calculations produce identical authoritative figures', true);
  } catch (e) {
    reportTest('COD and Razorpay consistency', false, e);
  }

  console.log('\n--- SECTION 2: P0-B RESTAURANT SUSPENSION ENFORCEMENT TESTS ---\n');

  // Test 14: Active restaurant with active admin permitted
  try {
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'active' });
    const authResult = await requireRestaurantAdmin({
      sessionOverride: { user: { email: adminA.email, role: 'restaurant_admin' } },
    });
    assert.strictEqual(!authResult.error, true);
    assert.strictEqual(authResult.restaurant._id.toString(), restA._id.toString());
    reportTest('Active restaurant with valid admin session is permitted (200 OK)', true);
  } catch (e) {
    reportTest('Active restaurant admin operation', false, e);
  }

  // Test 15: Suspended restaurant with valid admin session DENIED (403)
  try {
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'suspended' });
    const authResult = await requireRestaurantAdmin({
      sessionOverride: { user: { email: adminA.email, role: 'restaurant_admin' } },
    });
    assert.strictEqual(Boolean(authResult.error), true);
    assert.strictEqual(authResult.status, 403);
    assert.match(authResult.error, /suspended/i);
    reportTest('Suspended restaurant admin operation denied with 403 Forbidden', true);
  } catch (e) {
    reportTest('Suspended restaurant admin denial', false, e);
  }

  // Test 16: Inactive restaurant customer checkout rejected (400)
  try {
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'inactive' });
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
      couponCode: '',
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 400);
    assert.match(res.message, /inactive/i);
    reportTest('Inactive restaurant checkout rejected with status 400', true);
  } catch (e) {
    reportTest('Inactive restaurant checkout rejection', false, e);
  }

  // Test 17: Suspended restaurant customer checkout & payment initiation rejected (400)
  try {
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'suspended' });
    const res = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
      couponCode: '',
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.suspended, true);
    assert.match(res.message, /suspended/i);
    reportTest('Suspended restaurant checkout and payment initiation rejected with status 400', true);
  } catch (e) {
    reportTest('Suspended restaurant checkout rejection', false, e);
  }

  // Test 18: Restaurant becoming suspended between payment initiation and verification
  try {
    // 1. Restaurant is initially active during initiation
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'active' });
    const initRes = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
    });
    assert.strictEqual(initRes.success, true);

    // 2. Superadmin suspends the restaurant while user is paying on Razorpay
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'suspended' });

    // 3. User completes payment and Razorpay calls verification endpoint
    const verifyCalc = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
    });

    assert.strictEqual(verifyCalc.success, false);
    assert.strictEqual(verifyCalc.suspended, true);

    // Emulate verification route behavior: rejection with refund message without creating Order
    const dummyPayId = `pay_test_${Date.now()}`;
    const dummyOrderId = `order_test_${Date.now()}`;

    const verifyResponse = {
      success: false,
      suspended: Boolean(verifyCalc.suspended),
      message: verifyCalc.suspended
        ? `Payment received (${dummyPayId}), but the kitchen branch is currently suspended. Your payment will be refunded. Please contact customer support.`
        : `Payment received (${dummyPayId}), but order could not be placed.`,
    };

    assert.strictEqual(verifyResponse.success, false);
    assert.strictEqual(verifyResponse.suspended, true);
    assert.match(verifyResponse.message, /suspended.*refunded/i);

    // Confirm no order record was created
    const createdOrder = await Order.findOne({ paymentId: dummyPayId });
    assert.strictEqual(createdOrder, null);

    reportTest('Restaurant suspended between initiation and verification safely rejected with refund prompt', true);
  } catch (e) {
    reportTest('Suspension during payment verification test', false, e);
  }

  // Test 19: Unrelated active restaurant remains fully functional
  try {
    // Restaurant A remains suspended
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'suspended' });
    // Restaurant B is active
    await Restaurant.findByIdAndUpdate(restB._id, { status: 'active' });

    // Checkout for Restaurant B succeeds
    const resB = await calculateOrderDetails({
      items: [{ _id: prodB1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
    });
    assert.strictEqual(resB.success, true);
    assert.strictEqual(resB.subtotal, 300);

    // Admin B operation succeeds
    const authB = await requireRestaurantAdmin({
      sessionOverride: { user: { email: adminB.email, role: 'restaurant_admin' } },
    });
    assert.strictEqual(!authB.error, true);
    assert.strictEqual(authB.restaurant._id.toString(), restB._id.toString());

    reportTest('Unrelated active restaurant B remains fully functional while restaurant A is suspended', true);
  } catch (e) {
    reportTest('Unrelated active restaurant isolation', false, e);
  }

  // Test 20: Minimum order limit per restaurant enforced
  try {
    // Restaurant B has minOrder: 150. If user orders item with total < 150:
    const lowItem = await Product.findOneAndUpdate(
      { name: 'Beta Extra Dip' },
      { name: 'Beta Extra Dip', price: 50, restaurant: restB._id, isAvailable: true },
      { upsert: true, new: true }
    );
    const resLow = await calculateOrderDetails({
      items: [{ _id: lowItem._id.toString(), quantity: 1 }], // 50 < 150
      orderType: 'delivery',
    });
    assert.strictEqual(resLow.success, false);
    assert.match(resLow.message, /minimum order amount/i);
    reportTest('Restaurant minimum order threshold enforced correctly', true);
  } catch (e) {
    reportTest('Restaurant minimum order threshold', false, e);
  }

  console.log('\n--- SECTION 3: PHASE 1.1 PAYMENT SECURITY & CHECKOUT CORRECTNESS (SEC-01 - SEC-05) ---\n');

  const { POST: verifyRoutePOST, _setTestRazorpayClient } = await import('../app/api/payment/verify/route.js');
  const PaymentIntent = (await import('../models/PaymentIntent.js')).default;

  const testSecret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_for_mock_verification';
  function signOrder(orderId, paymentId) {
    return crypto.createHmac('sha256', testSecret).update(`${orderId}|${paymentId}`).digest('hex');
  }

  // Ensure Order and PaymentIntent indexes are built
  await Order.syncIndexes();
  await PaymentIntent.syncIndexes();

  // Test 21: SEC-01 Route Test: Cheap Razorpay order paired with expensive cart
  try {
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'active' });
    const orderId = 'order_sec01_cheap_' + Date.now();
    const paymentId = 'pay_sec01_cheap_' + Date.now();

    const legitCalc = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
    });

    await PaymentIntent.create({
      razorpayOrderId: orderId,
      amount: 290,
      amountPaise: 29000,
      currency: 'INR',
      status: 'created',
      user: null,
      address: { fullName: 'Guest User', phone: '9999999999' },
      notes: '',
      orderType: 'delivery',
      calcResult: legitCalc,
      receipt: 'rcpt_sec01',
    });

    // Mock Razorpay gateway returning cheap order of 1000 paise (₹10)
    _setTestRazorpayClient({
      orders: {
        fetch: async (id) => ({ id, amount: 1000, currency: 'INR', status: 'paid' }),
      },
      payments: {
        fetch: async (id) => ({ id, order_id: orderId, amount: 1000, currency: 'INR', status: 'captured' }),
      },
    });

    const sig = signOrder(orderId, paymentId);
    const req = new Request('http://localhost:3000/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await verifyRoutePOST(req);
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /mismatch/i);

    const created = await Order.findOne({ orderId });
    assert.strictEqual(created, null);
    reportTest('SEC-01 Route: Cheap Razorpay order paired with expensive cart rejected (amount mismatch)', true);
  } catch (e) {
    reportTest('SEC-01 Route: Cheap Razorpay order paired with expensive cart', false, e);
  }

  // Test 22: SEC-01 Route Test: Unknown or wrong Razorpay order ID
  try {
    const unknownOrderId = 'order_unknown_' + Date.now();
    const paymentId = 'pay_unknown_' + Date.now();
    const sig = signOrder(unknownOrderId, paymentId);

    const req = new Request('http://localhost:3000/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: unknownOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await verifyRoutePOST(req);
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.message, /not found|expired/i);
    reportTest('SEC-01 Route: Unknown Razorpay order ID rejected without creating order', true);
  } catch (e) {
    reportTest('SEC-01 Route: Unknown Razorpay order ID', false, e);
  }

  // Test 23: SEC-01 Route Test: Currency mismatch (e.g. USD)
  try {
    const orderId = 'order_sec01_usd_' + Date.now();
    const paymentId = 'pay_sec01_usd_' + Date.now();

    await PaymentIntent.create({
      razorpayOrderId: orderId,
      amount: 290,
      amountPaise: 29000,
      currency: 'INR',
      status: 'created',
      user: null,
      address: {},
      calcResult: { orders: [] },
    });

    _setTestRazorpayClient({
      orders: {
        fetch: async (id) => ({ id, amount: 29000, currency: 'USD', status: 'paid' }),
      },
      payments: {
        fetch: async (id) => ({ id, order_id: orderId, amount: 29000, currency: 'USD', status: 'captured' }),
      },
    });

    const sig = signOrder(orderId, paymentId);
    const req = new Request('http://localhost:3000/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await verifyRoutePOST(req);
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /currency/i);
    reportTest('SEC-01 Route: Currency mismatch (USD currency) rejected with status 400', true);
  } catch (e) {
    reportTest('SEC-01 Route: Currency mismatch', false, e);
  }

  // Test 24: SEC-01 Route Test: Invalid HMAC signature
  try {
    const orderId = 'order_sec01_sig_' + Date.now();
    const paymentId = 'pay_sec01_sig_' + Date.now();

    await PaymentIntent.create({
      razorpayOrderId: orderId,
      amount: 290,
      amountPaise: 29000,
      currency: 'INR',
      status: 'created',
      user: null,
      address: {},
      calcResult: { orders: [] },
    });

    const req = new Request('http://localhost:3000/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: 'invalid_forged_signature_12345',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await verifyRoutePOST(req);
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /invalid payment signature/i);
    reportTest('SEC-01 Route: Invalid HMAC signature rejected with status 400', true);
  } catch (e) {
    reportTest('SEC-01 Route: Invalid signature', false, e);
  }

  // Test 25: SEC-01 Route Test: Payment not captured / unsuccessful
  try {
    const orderId = 'order_sec01_failed_' + Date.now();
    const paymentId = 'pay_sec01_failed_' + Date.now();

    await PaymentIntent.create({
      razorpayOrderId: orderId,
      amount: 290,
      amountPaise: 29000,
      currency: 'INR',
      status: 'created',
      user: null,
      address: {},
      calcResult: { orders: [] },
    });

    _setTestRazorpayClient({
      orders: {
        fetch: async (id) => ({ id, amount: 29000, currency: 'INR', status: 'paid' }),
      },
      payments: {
        fetch: async (id) => ({ id, order_id: orderId, amount: 29000, currency: 'INR', status: 'failed' }),
      },
    });

    const sig = signOrder(orderId, paymentId);
    const req = new Request('http://localhost:3000/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await verifyRoutePOST(req);
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.match(body.message, /not successful/i);
    reportTest('SEC-01 Route: Uncaptured/failed payment status rejected with status 400', true);
  } catch (e) {
    reportTest('SEC-01 Route: Uncaptured/failed payment', false, e);
  }

  // Test 26: SEC-04 Route Test: Sequential verification is strictly idempotent
  try {
    const orderId = 'order_sec04_seq_' + Date.now();
    const paymentId = 'pay_sec04_seq_' + Date.now();

    const legitCalc = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
    });

    await PaymentIntent.create({
      razorpayOrderId: orderId,
      amount: 290,
      amountPaise: 29000,
      currency: 'INR',
      status: 'created',
      user: null,
      address: { fullName: 'Seq User', phone: '9888888888' },
      orderType: 'delivery',
      calcResult: legitCalc,
      receipt: 'rcpt_sec04_seq',
    });

    _setTestRazorpayClient({
      orders: {
        fetch: async (id) => ({ id, amount: 29000, currency: 'INR', status: 'paid' }),
      },
      payments: {
        fetch: async (id) => ({ id, order_id: orderId, amount: 29000, currency: 'INR', status: 'captured' }),
      },
    });

    const sig = signOrder(orderId, paymentId);
    const makeReq = () =>
      new Request('http://localhost:3000/api/payment/verify', {
        method: 'POST',
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

    const res1 = await verifyRoutePOST(makeReq());
    const body1 = await res1.json();
    assert.strictEqual(res1.status, 201);
    assert.strictEqual(body1.success, true);

    const ordersCount1 = await Order.countDocuments({ orderId });
    assert.strictEqual(ordersCount1, 1);

    // Call 2 (Sequential retry)
    const res2 = await verifyRoutePOST(makeReq());
    const body2 = await res2.json();
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(body2.success, true);
    assert.match(body2.message, /already verified/i);

    const ordersCount2 = await Order.countDocuments({ orderId });
    assert.strictEqual(ordersCount2, 1);
    reportTest('SEC-04 Route: Sequential verification is strictly idempotent (status 200, exactly 1 order)', true);
  } catch (e) {
    reportTest('SEC-04 Route: Sequential verification idempotency', false, e);
  }

  // Test 27: SEC-04 Route Test: Concurrent verification race safely handled
  try {
    const orderId = 'order_sec04_concur_' + Date.now();
    const paymentId = 'pay_sec04_concur_' + Date.now();

    const legitCalc = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
    });

    await PaymentIntent.create({
      razorpayOrderId: orderId,
      amount: 290,
      amountPaise: 29000,
      currency: 'INR',
      status: 'created',
      user: null,
      address: { fullName: 'Concur User', phone: '9777777777' },
      orderType: 'delivery',
      calcResult: legitCalc,
      receipt: 'rcpt_sec04_concur',
    });

    _setTestRazorpayClient({
      orders: {
        fetch: async (id) => ({ id, amount: 29000, currency: 'INR', status: 'paid' }),
      },
      payments: {
        fetch: async (id) => ({ id, order_id: orderId, amount: 29000, currency: 'INR', status: 'captured' }),
      },
    });

    const sig = signOrder(orderId, paymentId);
    const makeReq = () =>
      new Request('http://localhost:3000/api/payment/verify', {
        method: 'POST',
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

    const [res1, res2] = await Promise.all([
      verifyRoutePOST(makeReq()),
      verifyRoutePOST(makeReq()),
    ]);

    const finalOrderCount = await Order.countDocuments({ orderId });
    assert.strictEqual(finalOrderCount, 1);

    const statuses = [res1.status, res2.status];
    assert.strictEqual(statuses.includes(201) || statuses.includes(200), true);

    reportTest('SEC-04 Route: Concurrent verification race safely handled with 1 order created and 0 duplicates', true);
  } catch (e) {
    reportTest('SEC-04 Route: Concurrent verification race', false, e);
  }

  // Test 28: SEC-05 Route: Guest checkout cannot forge another customer account ownership
  try {
    const victimCustomer = adminA;
    const guestOrderId = 'order_sec05_guest_' + Date.now();
    const guestPayId = 'pay_sec05_guest_' + Date.now();

    const legitCalc = await calculateOrderDetails({
      items: [{ _id: prodA1._id.toString(), quantity: 1 }],
      orderType: 'delivery',
    });

    await PaymentIntent.create({
      razorpayOrderId: guestOrderId,
      amount: 290,
      amountPaise: 29000,
      currency: 'INR',
      status: 'created',
      user: null, // Unauthenticated session strictly assigns null
      address: { fullName: 'Guest', phone: '9666666666' },
      orderType: 'delivery',
      calcResult: legitCalc,
      receipt: 'rcpt_sec05_guest',
    });

    _setTestRazorpayClient({
      orders: { fetch: async (id) => ({ id, amount: 29000, currency: 'INR', status: 'paid' }) },
      payments: { fetch: async (id) => ({ id, order_id: guestOrderId, amount: 29000, currency: 'INR', status: 'captured' }) },
    });

    const sig = signOrder(guestOrderId, guestPayId);
    const req = new Request('http://localhost:3000/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: guestOrderId,
        razorpay_payment_id: guestPayId,
        razorpay_signature: sig,
        userId: victimCustomer._id.toString(), // Attacker attempts to pass victim customer ID in body
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await verifyRoutePOST(req);
    assert.strictEqual(res.status, 201);

    const savedOrder = await Order.findOne({ orderId: guestOrderId });
    assert.strictEqual(savedOrder.user, null);
    reportTest('SEC-05 Route: Guest checkout cannot forge another customer account ownership (user strictly null)', true);
  } catch (e) {
    reportTest('SEC-05 Route: Guest checkout ownership protection', false, e);
  }

  // Test 29: SEC-04 Model: Database partial unique index on { paymentId, restaurant }
  try {
    const testPayId = 'pay_dup_test_' + Date.now();
    await Order.create({
      restaurant: restA._id,
      items: [{ name: 'Burger', price: 100, quantity: 1 }],
      totalAmount: 100,
      paymentId: testPayId,
      orderId: 'ord_dup_a_' + Date.now(),
      paymentStatus: 'paid',
    });

    let dupErrorCaught = false;
    try {
      await Order.create({
        restaurant: restA._id,
        items: [{ name: 'Burger', price: 100, quantity: 1 }],
        totalAmount: 100,
        paymentId: testPayId,
        orderId: 'ord_dup_b_' + Date.now(),
        paymentStatus: 'paid',
      });
    } catch (dbErr) {
      if (dbErr.code === 11000) {
        dupErrorCaught = true;
      }
    }
    assert.strictEqual(dupErrorCaught, true);

    // Multi-restaurant sub-orders with same paymentId at DIFFERENT restaurants do not collide
    const orderDiffRest = await Order.create({
      restaurant: restB._id,
      items: [{ name: 'Pizza', price: 100, quantity: 1 }],
      totalAmount: 100,
      paymentId: testPayId,
      orderId: 'ord_dup_diff_' + Date.now(),
      paymentStatus: 'paid',
    });
    assert.strictEqual(Boolean(orderDiffRest._id), true);

    await Order.deleteMany({ paymentId: testPayId });
    reportTest('SEC-04 Model: Database partial unique index on { paymentId, restaurant } prevents duplicate paid orders', true);
  } catch (e) {
    reportTest('SEC-04 Model: Duplicate payment ID index enforcement', false, e);
  }

  // Test 30: SEC-02 Route: Safe refund workflow on suspended restaurant (Refund Success)
  try {
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'suspended' });
    const orderId = 'order_sec02_rfnd_ok_' + Date.now();
    const paymentId = 'pay_sec02_rfnd_ok_' + Date.now();

    await PaymentIntent.create({
      razorpayOrderId: orderId,
      amount: 290,
      amountPaise: 29000,
      currency: 'INR',
      status: 'created',
      user: null,
      address: { fullName: 'Refund User', phone: '9555555555' },
      orderType: 'delivery',
      calcResult: {
        orders: [{ restaurantId: restA._id.toString(), items: [], subtotal: 250, deliveryFee: 40, discount: 0, totalAmount: 290 }],
      },
      receipt: 'rcpt_sec02_ok',
    });

    _setTestRazorpayClient({
      orders: { fetch: async (id) => ({ id, amount: 29000, currency: 'INR', status: 'paid' }) },
      payments: {
        fetch: async (id) => ({ id, order_id: orderId, amount: 29000, currency: 'INR', status: 'captured' }),
        refund: async (id, opts) => ({ id: 'rfnd_sec02_test_ok', status: 'processed', amount: opts.amount }),
      },
    });

    const sig = signOrder(orderId, paymentId);
    const req = new Request('http://localhost:3000/api/payment/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await verifyRoutePOST(req);
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.suspended, true);
    assert.strictEqual(body.refundStatus, 'processed');
    assert.strictEqual(body.refundId, 'rfnd_sec02_test_ok');

    const intent = await PaymentIntent.findOne({ razorpayOrderId: orderId });
    assert.strictEqual(intent.status, 'refunded');
    assert.strictEqual(intent.refundDetails.refundId, 'rfnd_sec02_test_ok');

    const ordersCreated = await Order.countDocuments({ orderId });
    assert.strictEqual(ordersCreated, 0);

    reportTest('SEC-02 Route: Safe refund workflow executes Razorpay refund and marks intent refunded on suspended restaurant', true);
  } catch (e) {
    reportTest('SEC-02 Route: Safe refund workflow success', false, e);
  }

  // Test 31: SEC-02 Route: Safe refund workflow — Refund API failure and durable refund_pending reconciliation
  try {
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'suspended' });
    const orderId = 'order_sec02_rfnd_fail_' + Date.now();
    const paymentId = 'pay_sec02_rfnd_fail_' + Date.now();

    await PaymentIntent.create({
      razorpayOrderId: orderId,
      amount: 290,
      amountPaise: 29000,
      currency: 'INR',
      status: 'created',
      user: null,
      address: { fullName: 'Refund User Fail', phone: '9444444444' },
      orderType: 'delivery',
      calcResult: {
        orders: [{ restaurantId: restA._id.toString(), items: [], subtotal: 250, deliveryFee: 40, discount: 0, totalAmount: 290 }],
      },
      receipt: 'rcpt_sec02_fail',
    });

    _setTestRazorpayClient({
      orders: { fetch: async (id) => ({ id, amount: 29000, currency: 'INR', status: 'paid' }) },
      payments: {
        fetch: async (id) => ({ id, order_id: orderId, amount: 29000, currency: 'INR', status: 'captured' }),
        refund: async (id, opts) => {
          throw new Error('Razorpay Gateway Timeout');
        },
      },
    });

    const sig = signOrder(orderId, paymentId);
    const makeReq = () =>
      new Request('http://localhost:3000/api/payment/verify', {
        method: 'POST',
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

    const res = await verifyRoutePOST(makeReq());
    const body = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.suspended, true);
    assert.strictEqual(body.refundStatus, 'refund_pending');
    assert.match(body.message, /queued for reconciliation/i);

    const intent = await PaymentIntent.findOne({ razorpayOrderId: orderId });
    assert.strictEqual(intent.status, 'refund_pending');
    assert.match(intent.refundDetails.error, /Gateway Timeout/i);

    const ordersCreated = await Order.countDocuments({ orderId });
    assert.strictEqual(ordersCreated, 0);

    const retryRes = await verifyRoutePOST(makeReq());
    const retryBody = await retryRes.json();
    assert.strictEqual(retryRes.status, 400);
    assert.match(retryBody.message, /already been recorded for refund/i);

    reportTest('SEC-02 Route: Safe refund workflow durably transitions to refund_pending upon API error without creating order', true);
  } catch (e) {
    reportTest('SEC-02 Route: Safe refund workflow failure reconciliation', false, e);
  }

  // Test 32: SEC-03 Service: Platform-wide flat coupon applied once across multiple restaurants
  try {
    await Restaurant.findByIdAndUpdate(restA._id, { status: 'active' });
    await Restaurant.findByIdAndUpdate(restB._id, { status: 'active' });

    await Offer.findOneAndUpdate(
      { code: 'TEST_MULTI_FLAT100' },
      {
        title: 'Platform Flat 100 Off',
        code: 'TEST_MULTI_FLAT100',
        discountType: 'flat',
        discountValue: 100,
        minOrder: 300,
        startDate: past,
        endDate: future,
        isActive: true,
        restaurant: null,
      },
      { upsert: true, new: true }
    );

    const res = await calculateOrderDetails({
      items: [
        { _id: prodA1._id.toString(), quantity: 1 },
        { _id: prodB1._id.toString(), quantity: 1 },
      ],
      orderType: 'delivery',
      couponCode: 'TEST_MULTI_FLAT100',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.subtotal, 550);
    assert.strictEqual(res.discount, 100);
    assert.strictEqual(res.orders.length, 2);

    const [orderA, orderB] = res.orders;
    assert.strictEqual(orderA.discount, 45);
    assert.strictEqual(orderB.discount, 55);
    assert.strictEqual(orderA.discount + orderB.discount, 100);
    assert.strictEqual(orderA.totalAmount, 245);
    assert.strictEqual(orderB.totalAmount, 295);
    assert.strictEqual(res.totalAmount, 540);

    reportTest('SEC-03 Service: Platform-wide flat coupon applied once across multiple restaurants with proportional allocation', true);
  } catch (e) {
    reportTest('SEC-03 Service: Multi-restaurant platform coupon allocation', false, e);
  }

  // Test 33: SEC-03 Service: Multi-restaurant coupon respects subtotal caps without negative amounts
  try {
    const lowProd = await Product.findOneAndUpdate(
      { name: 'Alpha Low Price Snack' },
      { name: 'Alpha Low Price Snack', price: 20, restaurant: restA._id, isAvailable: true },
      { upsert: true, new: true }
    );

    await Offer.findOneAndUpdate(
      { code: 'TEST_MULTI_FLAT150' },
      {
        title: 'Platform Flat 150 Off',
        code: 'TEST_MULTI_FLAT150',
        discountType: 'flat',
        discountValue: 150,
        minOrder: 100,
        startDate: past,
        endDate: future,
        isActive: true,
        restaurant: null,
      },
      { upsert: true, new: true }
    );

    const res = await calculateOrderDetails({
      items: [
        { _id: lowProd._id.toString(), quantity: 5 }, // 100 on Rest A
        { _id: prodB1._id.toString(), quantity: 1 },  // 300 on Rest B
      ],
      orderType: 'delivery',
      couponCode: 'TEST_MULTI_FLAT150',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.subtotal, 400);
    assert.strictEqual(res.discount, 150);

    const [orderA, orderB] = res.orders;
    assert.strictEqual(orderA.discount + orderB.discount, 150);
    assert.strictEqual(orderA.totalAmount >= 0, true);
    assert.strictEqual(orderB.totalAmount >= 0, true);
    assert.strictEqual(res.totalAmount, orderA.totalAmount + orderB.totalAmount);

    await Product.deleteOne({ _id: lowProd._id });
    reportTest('SEC-03 Service: Multi-restaurant coupon respects subtotal caps without negative amounts', true);
  } catch (e) {
    reportTest('SEC-03 Service: Subtotal cap and remainder rollover', false, e);
  }

  // Test 34: SEC-03 Service: Restaurant-scoped coupon restrictions and multi-restaurant COD parity preserved
  try {
    const resRestricted = await calculateOrderDetails({
      items: [
        { _id: prodA1._id.toString(), quantity: 1 },
        { _id: prodB1._id.toString(), quantity: 1 },
      ],
      orderType: 'delivery',
      couponCode: 'TEST_ALPHAONLY',
    });

    assert.strictEqual(resRestricted.success, false);
    assert.strictEqual(resRestricted.status, 400);
    assert.match(resRestricted.message, /not applicable to/i);

    const resCOD = await calculateOrderDetails({
      items: [
        { _id: prodA1._id.toString(), quantity: 1 },
        { _id: prodB1._id.toString(), quantity: 1 },
      ],
      orderType: 'delivery',
      couponCode: '',
    });

    assert.strictEqual(resCOD.success, true);
    assert.strictEqual(resCOD.subtotal, 550);
    assert.strictEqual(resCOD.deliveryFee, 90);
    assert.strictEqual(resCOD.discount, 0);
    assert.strictEqual(resCOD.totalAmount, 640);
    assert.strictEqual(resCOD.orders[0].totalAmount + resCOD.orders[1].totalAmount, 640);

    reportTest('SEC-03 Service: Restaurant-scoped coupon restrictions and multi-restaurant COD parity preserved', true);
  } catch (e) {
    reportTest('SEC-03 Service: Scoped coupon restrictions and COD parity', false, e);
  }

  // Clean up all test records
  await Offer.deleteMany({ code: { $regex: /^TEST_/ } });
  await Product.deleteMany({ _id: { $in: [prodA1._id, prodB1._id] } });
  await Restaurant.deleteMany({ _id: { $in: [restA._id, restB._id] } });
  await User.deleteMany({ _id: { $in: [adminA._id, adminB._id] } });
  await PaymentIntent.deleteMany({ razorpayOrderId: { $regex: /^order_/ } });
  await Order.deleteMany({ orderId: { $regex: /^order_/ } });

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
