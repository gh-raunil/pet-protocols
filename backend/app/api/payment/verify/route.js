import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import connectDB from '@/lib/db';
import Order from '@/models/Order';
import Restaurant from '@/models/Restaurant';
import PaymentIntent from '@/models/PaymentIntent';
import { deductStockForOrder } from '@/lib/inventoryService';
import { notifyOrderEvent } from '@/lib/pushService';
import { _setTestRazorpayClient as _setRefundTestClient } from '@/lib/refundService';
import { validateDeliveryServiceability } from '@/lib/geoDistance';
import {
  razorpayHttpClient,
  computePayloadFingerprint,
  generateRefundIdempotencyKey,
} from '@/lib/razorpayHttpClient';
import {
  generateGuestAccessToken,
  deriveGuestAccessToken,
  hashGuestAccessToken,
  computeGuestTokenExpiry,
} from '@/lib/guestAccessService';
import { checkPaymentVerifyRateLimit } from '@/lib/rateLimit';

// Optional override for automated testing
let testRazorpayClient = null;
export function _setTestRazorpayClient(client) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security] Razorpay test client hook is forbidden in production environment.');
  }
  testRazorpayClient = client;
  _setRefundTestClient(client);
}

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, message: 'Missing Razorpay verification parameters' },
        { status: 400 }
      );
    }

    // SEC-RL: Rate Limiting Protection (Order: 15/5m, IP: 30/5m)
    const rateLimit = await checkPaymentVerifyRateLimit(razorpay_order_id, request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: `Too many payment verification attempts. Please wait ${rateLimit.resetInSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetInSeconds),
          },
        }
      );
    }

    // Step 1: Verify HMAC signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret && !testRazorpayClient) {
      console.error('Payment verification failed: RAZORPAY_KEY_SECRET is not configured on server.');
      return NextResponse.json(
        { success: false, message: 'Payment verification service is currently unavailable.' },
        { status: 503 }
      );
    }

    const verificationSecret = secret || 'test_secret_for_mock_verification';
    const generatedSignature = crypto
      .createHmac('sha256', verificationSecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const sigBuf = Buffer.from(razorpay_signature, 'utf8');
    const expectedBuf = Buffer.from(generatedSignature, 'utf8');
    const isSignatureValid =
      sigBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(sigBuf, expectedBuf);

    if (!isSignatureValid) {
      console.error('Razorpay signature mismatch for order:', razorpay_order_id);
      return NextResponse.json(
        { success: false, message: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Step 2: Connect DB and reconcile with stored PaymentIntent (SEC-01)
    await connectDB();

    const paymentIntent = await PaymentIntent.findOne({ razorpayOrderId: razorpay_order_id });
    if (!paymentIntent) {
      return NextResponse.json(
        { success: false, message: 'Payment order was not found or has expired.' },
        { status: 400 }
      );
    }

    // Idempotency: If already verified or reconciliation required, check if all sub-orders exist (SEC-04)
    if (paymentIntent.status === 'verified' || paymentIntent.status === 'reconciliation_required') {
      const existingOrders = await Order.find({ orderId: razorpay_order_id })
        .populate("restaurant", "name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings")
        .populate("user", "name email");

      const expectedCount = paymentIntent.calcResult?.orders?.length || 1;
      if (existingOrders.length >= expectedCount) {
        const hasInventoryFailures = existingOrders.some((o) => o.stockDeducted === false);
        let replayGuestToken = undefined;
        if (!paymentIntent.user) {
          replayGuestToken = deriveGuestAccessToken(
            `${razorpay_order_id}:${razorpay_payment_id}`,
            "pet-protocols:guest-payment-verify"
          );
        }
        return NextResponse.json(
          {
            success: true,
            message: hasInventoryFailures
              ? "Payment already verified. Note: Inventory deduction incomplete for one or more items."
              : "Payment already verified and order confirmed.",
            order: existingOrders[0],
            orders: existingOrders,
            guestAccessToken: replayGuestToken,
            inventoryDeducted: !hasInventoryFailures,
            reconciliationRequired: hasInventoryFailures,
          },
          { status: 200 }
        );
      }
    }

    // If already refunded, refund pending, or refund reconciliation required, return status without double processing (SEC-02)
    const isRefundReconciliation =
      paymentIntent.refundDetails?.status === 'reconciliation_required' ||
      Boolean(paymentIntent.refundDetails?.requiresManualReconciliation);

    if (
      paymentIntent.status === 'refunded' ||
      paymentIntent.status === 'refund_pending' ||
      isRefundReconciliation
    ) {
      return NextResponse.json(
        {
          success: false,
          suspended: true,
          refundStatus: isRefundReconciliation ? 'reconciliation_required' : paymentIntent.status,
          requiresManualReconciliation: isRefundReconciliation,
          refundId: paymentIntent.refundDetails?.refundId,
          message: isRefundReconciliation
            ? `Payment (${razorpay_payment_id}) requires manual reconciliation. Refund redispatch is prohibited to prevent duplicate payouts.`
            : `Payment (${razorpay_payment_id}) has already been recorded for refund (Status: ${paymentIntent.refundDetails?.status || paymentIntent.status}).`,
        },
        { status: 400 }
      );
    }

    // Step 3: Server-side validation against Razorpay API (SEC-01)
    const key_id = process.env.RAZORPAY_KEY_ID;
    let razorpay = testRazorpayClient;
    if (!razorpay) {
      if (key_id?.startsWith("rzp_test_mock")) {
        razorpay = {
          orders: {
            fetch: async (id) => ({
              id,
              amount: paymentIntent.amountPaise,
              currency: "INR",
              status: "paid",
            }),
          },
          payments: {
            fetch: async (id) => ({
              id,
              order_id: razorpay_order_id,
              amount: paymentIntent.amountPaise,
              currency: "INR",
              status: "captured",
              refund: async () => ({ id: `rfnd_mock_${Date.now()}`, status: "processed" }),
            }),
            refund: async () => ({ id: `rfnd_mock_${Date.now()}`, status: "processed" }),
          },
        };
      } else if (key_id && secret) {
        razorpay = new Razorpay({ key_id, key_secret: secret });
      }
    }

    if (!razorpay) {
      return NextResponse.json(
        { success: false, message: 'Payment service configuration missing on server.' },
        { status: 503 }
      );
    }

    let rzOrder;
    let rzPayment;
    try {
      [rzOrder, rzPayment] = await Promise.all([
        razorpay.orders.fetch(razorpay_order_id),
        razorpay.payments.fetch(razorpay_payment_id),
      ]);
    } catch (apiErr) {
      console.error('Razorpay gateway fetch failed:', apiErr.message);
      return NextResponse.json(
        { success: false, message: 'Failed to verify payment with payment gateway. Please contact support.' },
        { status: 502 }
      );
    }

    // a) Verify association between payment and order
    if (rzPayment.order_id !== razorpay_order_id || rzOrder.id !== razorpay_order_id) {
      return NextResponse.json(
        { success: false, message: 'Payment is not associated with the specified order.' },
        { status: 400 }
      );
    }

    // b) Verify currency is INR
    if (rzOrder.currency !== 'INR' || rzPayment.currency !== 'INR') {
      return NextResponse.json(
        { success: false, message: 'Invalid payment currency. Pet Protocols only supports INR.' },
        { status: 400 }
      );
    }

    // c) Verify exact amount in paise matches original server-calculated payable amount
    if (rzOrder.amount !== paymentIntent.amountPaise || rzPayment.amount !== paymentIntent.amountPaise) {
      console.error(
        `[Payment Security Alert] Amount mismatch! Stored: ${paymentIntent.amountPaise} paise, Gateway Order: ${rzOrder.amount}, Payment: ${rzPayment.amount}`
      );
      return NextResponse.json(
        { success: false, message: 'Payment amount mismatch. Verified payment does not match payable amount.' },
        { status: 400 }
      );
    }

    // d) Verify payment was captured or authorized
    if (!['captured', 'authorized'].includes(rzPayment.status)) {
      return NextResponse.json(
        { success: false, message: `Payment is not successful (Gateway status: ${rzPayment.status}).` },
        { status: 400 }
      );
    }

    // Step 4: Concurrency Lock — transition state to 'verifying' (SEC-04)
    // NOTE: Refund reconciliation_required is strictly excluded to prevent redispatch, but order-creation recovery is permitted
    const lockedIntent = await PaymentIntent.findOneAndUpdate(
      {
        _id: paymentIntent._id,
        status: { $in: ['created', 'reconciliation_required'] },
        'refundDetails.requiresManualReconciliation': { $ne: true },
        'refundDetails.status': { $ne: 'reconciliation_required' },
      },
      { $set: { status: 'verifying', razorpayPaymentId: razorpay_payment_id } },
      { returnDocument: 'after' }
    );

    if (!lockedIntent) {
      const freshIntent = await PaymentIntent.findById(paymentIntent._id);
      const isFreshRefundRecon =
        freshIntent?.refundDetails?.status === 'reconciliation_required' ||
        Boolean(freshIntent?.refundDetails?.requiresManualReconciliation);

      if (
        freshIntent?.status === 'refunded' ||
        freshIntent?.status === 'refund_pending' ||
        isFreshRefundRecon
      ) {
        return NextResponse.json(
          {
            success: false,
            suspended: true,
            refundStatus: isFreshRefundRecon ? 'reconciliation_required' : freshIntent.status,
            requiresManualReconciliation: isFreshRefundRecon,
            refundId: freshIntent?.refundDetails?.refundId,
            message: isFreshRefundRecon
              ? `Payment (${razorpay_payment_id}) requires manual reconciliation. Refund redispatch is prohibited to prevent duplicate payouts.`
              : `Payment (${razorpay_payment_id}) has already been recorded for refund (Status: ${freshIntent?.refundDetails?.status || freshIntent?.status}).`,
          },
          { status: 400 }
        );
      }

      // Another request is actively verifying or has completed verification
      const existingOrders = await Order.find({ orderId: razorpay_order_id })
        .populate("restaurant", "name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings")
        .populate("user", "name email");

      if (existingOrders.length > 0) {
        let replayGuestToken = undefined;
        if (!lockedIntent.user) {
          replayGuestToken = deriveGuestAccessToken(
            `${razorpay_order_id}:${razorpay_payment_id}`,
            "pet-protocols:guest-payment-verify"
          );
        }
        return NextResponse.json(
          {
            success: true,
            message: "Payment already verified and order confirmed.",
            order: existingOrders[0],
            orders: existingOrders,
            guestAccessToken: replayGuestToken,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: false, message: 'Payment verification is currently in progress. Please refresh.' },
        { status: 409 }
      );
    }

    // Step 5: Check Restaurant Status & Delivery Serviceability from Live Database (SEC-02 Safe Refund Workflow)
    const subOrders = lockedIntent.calcResult?.orders || [];
    let unserviceableOrInactiveRest = null;
    let unserviceableReason = null;
    let unserviceableUserMessage = null;

    for (const calcOrder of subOrders) {
      const restDoc = await Restaurant.findById(calcOrder.restaurantId).lean();
      if (!restDoc || restDoc.status === 'suspended' || restDoc.status === 'inactive') {
        unserviceableOrInactiveRest = restDoc || { name: 'Kitchen branch', status: 'suspended' };
        unserviceableReason = restDoc?.status === 'suspended' ? 'restaurant_suspended' : 'restaurant_inactive';
        unserviceableUserMessage = `${unserviceableOrInactiveRest.name || 'This kitchen'} is currently ${restDoc?.status === 'suspended' ? 'suspended' : 'inactive'}`;
        break;
      }

      // Live serviceability re-validation at final order-creation boundary
      const serviceability = validateDeliveryServiceability({
        restaurant: restDoc,
        orderType: lockedIntent.orderType,
        address: lockedIntent.address,
      });

      if (!serviceability.isServiceable) {
        unserviceableOrInactiveRest = restDoc;
        unserviceableReason = serviceability.code || 'out_of_delivery_range';
        unserviceableUserMessage = serviceability.message;
        break;
      }
    }

    if (unserviceableOrInactiveRest) {
      const isSuspended = unserviceableOrInactiveRest.status === 'suspended';
      const restName = unserviceableOrInactiveRest.name || 'This kitchen';

      const opKey = lockedIntent.refundDetails?.opKey || `refop_pi_${lockedIntent._id.toString()}`;
      const idempotencyKey = lockedIntent.refundDetails?.idempotencyKey || generateRefundIdempotencyKey('pi', lockedIntent._id);

      const refundNotes = {
        opKey,
        paymentIntentId: lockedIntent._id.toString(),
        razorpay_order_id,
        reason: unserviceableReason,
        restaurant: restName,
      };

      const refundPayload = {
        amount: lockedIntent.amountPaise,
        currency: 'INR',
        speed: 'normal',
        notes: refundNotes,
        receipt: razorpay_order_id || '',
      };
      const requestFingerprint = computePayloadFingerprint(refundPayload);

      const effectiveReason = unserviceableReason || (isSuspended ? 'restaurant_suspended' : 'restaurant_inactive');
      const effectiveUserDetail = unserviceableUserMessage || `${restName} is currently ${isSuspended ? 'suspended' : 'inactive'}`;

      // Record durable dispatching state before calling refund API (SEC-02 / SEC-05)
      lockedIntent.status = 'refund_pending';
      lockedIntent.refundDetails = {
        opKey,
        idempotencyKey,
        paymentId: razorpay_payment_id,
        amountPaise: lockedIntent.amountPaise,
        currency: 'INR',
        requestFingerprint,
        dispatchState: 'dispatching',
        status: 'refund_pending',
        gatewayStatus: null,
        amount: lockedIntent.amount,
        reason: effectiveReason,
        error: null,
        retryCount: (lockedIntent.refundDetails?.retryCount || 0) + 1,
        lastAttemptAt: new Date(),
        requiresManualReconciliation: false,
      };
      await lockedIntent.save();

      // Gateway reconciliation pre-check: verify whether gateway already refunded this payment
      let alreadyRefundedOnGateway = false;
      let existingRefundId = null;
      try {
        if (typeof razorpay.payments?.fetch === 'function') {
          const fetchedPayment = await razorpay.payments.fetch(razorpay_payment_id);
          if (
            fetchedPayment &&
            ((fetchedPayment.amount_refunded && fetchedPayment.amount_refunded >= lockedIntent.amountPaise) ||
              fetchedPayment.refund_status === 'full' ||
              fetchedPayment.status === 'refunded')
          ) {
            alreadyRefundedOnGateway = true;
            existingRefundId =
              fetchedPayment.refunds?.[0]?.id ||
              fetchedPayment.refundId ||
              `rfnd_reconciled_${Date.now()}`;
          }
        }
      } catch (fetchErr) {
        console.warn('[PaymentIntent Refund] Gateway fetch warning before refund:', fetchErr.message);
      }

      if (alreadyRefundedOnGateway) {
        lockedIntent.status = 'refunded';
        lockedIntent.refundDetails = {
          ...lockedIntent.refundDetails,
          dispatchState: 'confirmed',
          status: 'processed',
          gatewayStatus: 'processed',
          refundId: existingRefundId,
          amount: lockedIntent.amount,
          reason: effectiveReason,
          processedAt: new Date(),
          reconciled: true,
          requiresManualReconciliation: false,
        };
        await lockedIntent.save();

        return NextResponse.json(
          {
            success: false,
            suspended: isSuspended,
            refundStatus: 'processed',
            refundId: existingRefundId,
            message: `Payment received (${razorpay_payment_id}), but ${effectiveUserDetail}. Your refund of ₹${lockedIntent.amount} was already processed via Razorpay (Refund ID: ${existingRefundId}).`,
          },
          { status: 400 }
        );
      }

      // Trigger Razorpay refund API via RazorpayHttpClient (or test client adapter)
      let refundResponse;
      if (testRazorpayClient && typeof testRazorpayClient.payments?.refund === 'function') {
        try {
          const raw = await testRazorpayClient.payments.refund(razorpay_payment_id, {
            amount: lockedIntent.amountPaise,
            notes: refundNotes,
          }, {
            headers: {
              'X-Refund-Idempotency': idempotencyKey,
            },
          });
          refundResponse = {
            success: true,
            refundId: raw?.id || `rfnd_${Date.now()}`,
            status: raw?.status || 'processed',
            refund: raw,
          };
        } catch (mockErr) {
          refundResponse = { success: false, uncertain: true, error: mockErr.message };
        }
      } else {
        refundResponse = await razorpayHttpClient.executeRefund({
          paymentId: razorpay_payment_id,
          amountPaise: lockedIntent.amountPaise,
          idempotencyKey,
          notes: refundNotes,
          speed: 'normal',
          receipt: razorpay_order_id || '',
        });
      }

      if (refundResponse && refundResponse.success && refundResponse.refundId) {
        lockedIntent.status = 'refunded';
        lockedIntent.refundDetails = {
          ...lockedIntent.refundDetails,
          opKey,
          refundId: refundResponse.refundId,
          dispatchState: 'confirmed',
          status: refundResponse.status || 'processed',
          gatewayStatus: refundResponse.status || 'processed',
          amount: lockedIntent.amount,
          reason: effectiveReason,
          processedAt: new Date(),
          reconciled: true,
          error: null,
          requiresManualReconciliation: false,
        };
        await lockedIntent.save();

        return NextResponse.json(
          {
            success: false,
            suspended: isSuspended,
            refundStatus: 'processed',
            refundId: refundResponse.refundId,
            message: `Payment received (${razorpay_payment_id}), but ${effectiveUserDetail}. Your refund of ₹${lockedIntent.amount} has been processed via Razorpay (Refund ID: ${refundResponse.refundId}).`,
          },
          { status: 400 }
        );
      }

      // If gateway returned uncertain, 409 conflict, payload mismatch, or error: quarantine immediately
      console.error('[Safe Refund Failure]:', refundResponse?.error);
      lockedIntent.status = 'reconciliation_required';
      lockedIntent.refundDetails = {
        ...lockedIntent.refundDetails,
        opKey,
        dispatchState: 'quarantined',
        status: 'reconciliation_required',
        gatewayStatus: 'failed',
        amount: lockedIntent.amount,
        reason: effectiveReason,
        error: refundResponse?.error || 'Refund dispatch failed or uncertain',
        requiresManualReconciliation: true,
        lastAttemptAt: new Date(),
      };
      await lockedIntent.save();

      return NextResponse.json(
        {
          success: false,
          suspended: isSuspended,
          refundStatus: 'reconciliation_required',
          requiresManualReconciliation: true,
          message: `Payment received (${razorpay_payment_id}), but ${effectiveUserDetail}. Refund outcome is uncertain and has been queued for manual reconciliation (Reference: ${razorpay_order_id}). Customer support has been notified.`,
        },
        { status: 400 }
      );
    }

    // Step 6: Create Confirmed Orders from Server-Stored Snapshots (SEC-01 & SEC-05)
    // Client-supplied items/amounts are completely ignored; user is verified identity from session
    const createdOrders = [];
    const isPickup = lockedIntent.orderType === 'pickup';
    const notes = lockedIntent.notes || '';

    // Generate cryptographically secure guest-order access credential if guest checkout
    let guestAccessToken = null;
    let guestAccessRecord = null;
    if (!lockedIntent.user) {
      guestAccessToken = deriveGuestAccessToken(
        `${razorpay_order_id}:${razorpay_payment_id}`,
        "pet-protocols:guest-payment-verify"
      );
      const tokenHash = hashGuestAccessToken(guestAccessToken);
      const expiresAt = computeGuestTokenExpiry();
      guestAccessRecord = {
        tokenHash,
        issuedAt: new Date(),
        expiresAt,
        isRevoked: false,
      };
    }

    try {
      for (const calcOrder of subOrders) {
        let orderDoc = await Order.findOne({
          paymentId: razorpay_payment_id,
          restaurant: calcOrder.restaurantId,
        });

        if (!orderDoc) {
          try {
            orderDoc = await Order.create({
              user: lockedIntent.user, // SEC-05: Server-verified user identity only
              ...(guestAccessRecord ? { guestAccess: guestAccessRecord } : {}),
              restaurant: calcOrder.restaurantId,
              items: calcOrder.items,
              address: lockedIntent.address,
              subtotal: calcOrder.subtotal,
              deliveryFee: calcOrder.deliveryFee,
              discount: calcOrder.discount,
              couponCode: calcOrder.couponCode || '',
              totalAmount: calcOrder.totalAmount,
              paymentId: razorpay_payment_id,
              orderId: razorpay_order_id,
              paymentStatus: 'paid',
              paymentMethod: 'Razorpay (Online Payment)',
              status: 'pending',
              orderType: lockedIntent.orderType === 'pickup' ? 'pickup' : 'delivery',
              deliveryDistanceKm: calcOrder.deliveryDistanceKm ?? null,
              notes: isPickup ? `[PICKUP] ${notes}` : notes,
            });
          } catch (createErr) {
            if (createErr.code === 11000) {
              orderDoc = await Order.findOne({
                paymentId: razorpay_payment_id,
                restaurant: calcOrder.restaurantId,
              });
            } else {
              throw createErr;
            }
          }
        }

        // Deduct inventory stock based on recipes if not yet completed
        if (!orderDoc.stockDeducted) {
          const deductRes = await deductStockForOrder(orderDoc);
          if (!deductRes.success) {
            const invMsg = deductRes.message || 'Insufficient stock for one or more ingredients';
            await Order.findByIdAndUpdate(orderDoc._id, {
              inventoryStatus: 'failed',
              notes: `${orderDoc.notes || ''} [INVENTORY ALERT: ${invMsg}]`.trim(),
            });
          } else {
            await Order.findByIdAndUpdate(orderDoc._id, {
              inventoryStatus: 'deducted',
            });
          }
        }

        const populatedOrder = await Order.findById(orderDoc._id)
          .populate("restaurant", "name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings")
          .populate("user", "name email");

        createdOrders.push(populatedOrder);
        notifyOrderEvent(populatedOrder, 'order_placed').catch((e) =>
          console.warn('[Payment Verify Push] Push warning:', e.message)
        );
      }

      const hasInventoryFailures = createdOrders.some((o) => o.stockDeducted === false);

      // Mark PaymentIntent: reconciliation_required if any inventory failed, else verified
      lockedIntent.status = hasInventoryFailures ? 'reconciliation_required' : 'verified';
      lockedIntent.createdOrders = createdOrders.map((o) => o._id);
      await lockedIntent.save();

      return NextResponse.json(
        {
          success: true,
          message: hasInventoryFailures
            ? "Payment verified. Note: Inventory deduction incomplete for one or more items."
            : "Payment verified and order placed successfully!",
          order: createdOrders[0],
          orders: createdOrders,
          guestAccessToken: guestAccessToken || undefined,
          inventoryDeducted: !hasInventoryFailures,
          reconciliationRequired: hasInventoryFailures,
        },
        { status: 201 }
      );
    } catch (orderCreateErr) {
      if (orderCreateErr.code === 11000) {
        // SEC-04: Concurrency duplicate-key caught safely
        console.warn(`[Concurrency] Duplicate key caught for paymentId ${razorpay_payment_id}. Fetching confirmed order.`);
        const existingOrders = await Order.find({ orderId: razorpay_order_id })
          .populate("restaurant", "name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings")
          .populate("user", "name email");

        const hasInventoryFailures = existingOrders.some((o) => o.stockDeducted === false);
        let replayGuestToken = undefined;
        if (!lockedIntent.user) {
          replayGuestToken = deriveGuestAccessToken(
            `${razorpay_order_id}:${razorpay_payment_id}`,
            "pet-protocols:guest-payment-verify"
          );
        }
        return NextResponse.json(
          {
            success: true,
            message: hasInventoryFailures
              ? "Payment already verified. Note: Inventory deduction incomplete for one or more items."
              : "Payment already verified and order confirmed.",
            order: existingOrders[0],
            orders: existingOrders,
            guestAccessToken: replayGuestToken,
            inventoryDeducted: !hasInventoryFailures,
            reconciliationRequired: hasInventoryFailures,
          },
          { status: 200 }
        );
      }

      // Preserve any sub-orders created so far so retry can finish the batch safely
      if (createdOrders.length > 0) {
        lockedIntent.createdOrders = Array.from(new Set([
          ...(lockedIntent.createdOrders || []).map((id) => id.toString()),
          ...createdOrders.map((o) => o._id.toString()),
        ]));
        lockedIntent.status = 'reconciliation_required';
        await lockedIntent.save();
      } else {
        lockedIntent.status = 'created';
        await lockedIntent.save();
      }
      throw orderCreateErr;
    }

  } catch (error) {
    console.error('Razorpay verification error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Payment verification failed. Please contact support.' },
      { status: 500 }
    );
  }
}
