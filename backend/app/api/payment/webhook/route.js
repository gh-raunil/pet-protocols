import crypto from 'crypto';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Order from '@/models/Order';
import PaymentIntent from '@/models/PaymentIntent';

let _testWebhookSecret = null;
let _testWebhookPreUpdateHook = null;

export function _setTestWebhookSecret(secret) {
  _testWebhookSecret = secret;
}

export function _setTestWebhookPreUpdateHook(fn) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security] Webhook pre-update test hook is forbidden in production environment.');
  }
  if (fn !== null && typeof fn !== 'function') {
    throw new TypeError('[Security] Webhook pre-update test hook must be a function or null.');
  }
  _testWebhookPreUpdateHook = fn;
}

export function getWebhookSecret() {
  if (_testWebhookSecret !== null) return _testWebhookSecret;
  return process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || null;
}

async function quarantineOrder(orderId, errorMsg) {
  await Order.updateOne(
    {
      _id: orderId,
      paymentStatus: { $ne: 'refunded' },
      'refundDetails.dispatchState': { $ne: 'confirmed' },
    },
    {
      $set: {
        paymentStatus: 'reconciliation_required',
        'refundDetails.status': 'reconciliation_required',
        'refundDetails.dispatchState': 'quarantined',
        'refundDetails.requiresManualReconciliation': true,
        'refundDetails.error': errorMsg,
        'refundDetails.lastAttemptAt': new Date(),
      },
    }
  );
}

async function quarantineIntent(intentId, errorMsg) {
  await PaymentIntent.updateOne(
    {
      _id: intentId,
      status: { $ne: 'refunded' },
      'refundDetails.dispatchState': { $ne: 'confirmed' },
    },
    {
      $set: {
        status: 'reconciliation_required',
        'refundDetails.status': 'reconciliation_required',
        'refundDetails.dispatchState': 'quarantined',
        'refundDetails.requiresManualReconciliation': true,
        'refundDetails.error': errorMsg,
        'refundDetails.lastAttemptAt': new Date(),
      },
    }
  );
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json(
        { success: false, message: 'Missing x-razorpay-signature header' },
        { status: 400 }
      );
    }

    const secret = getWebhookSecret();
    if (!secret) {
      return NextResponse.json(
        { success: false, message: 'Webhook secret is not configured' },
        { status: 500 }
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json(
        { success: false, message: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const eventType = event.event;
    const refundEntity = event.payload?.refund?.entity;

    if (!refundEntity && (eventType === 'refund.processed' || eventType === 'refund.failed')) {
      return NextResponse.json(
        { success: false, message: 'Missing refund entity in payload' },
        { status: 400 }
      );
    }

    await connectDB();

    if (eventType === 'refund.processed') {
      const rawRefundId = refundEntity.id;
      const rawPaymentId = refundEntity.payment_id;
      const refundId = typeof rawRefundId === 'string' ? rawRefundId.trim() : '';
      const paymentId = typeof rawPaymentId === 'string' ? rawPaymentId.trim() : '';
      const notes = (refundEntity.notes && typeof refundEntity.notes === 'object') ? refundEntity.notes : {};
      const opKey = typeof notes.opKey === 'string' ? notes.opKey.trim() : '';
      const orderIdNote = typeof notes.orderId === 'string' ? notes.orderId.trim() : '';

      let targetOrder = null;

      // 1. Authoritative match by operation key
      if (opKey) {
        targetOrder = await Order.findOne({ 'refundDetails.opKey': opKey });
      }

      // 2. Persisted refund ID match strictly constrained by verified paymentId
      if (!targetOrder && refundId && paymentId) {
        targetOrder = await Order.findOne({
          'refundDetails.refundId': refundId,
          paymentId,
        });
      }

      // 3. Payment-level attribution strictly constrained by verified paymentId
      if (!targetOrder && paymentId) {
        const matchingOrders = await Order.find({ paymentId });
        if (matchingOrders.length === 1) {
          const singleOrder = matchingOrders[0];
          if (
            orderIdNote &&
            singleOrder.orderId !== orderIdNote &&
            singleOrder._id.toString() !== orderIdNote
          ) {
            console.warn(
              `[Webhook] Order ${singleOrder._id} for payment ${paymentId} contradicted by note orderId '${orderIdNote}'`
            );
          } else {
            targetOrder = singleOrder;
          }
        } else if (matchingOrders.length > 1) {
          // Multi-restaurant payment with ambiguous refund:
          // When opKey is missing, an uncorroborated orderIdNote cannot safely single out one sibling.
          // Quarantine the complete sibling set for manual reconciliation.
          console.warn(
            `[Webhook] Multi-restaurant payment ${paymentId} received refund ${refundId} without corroborating opKey or persisted refundId.`
          );
          await Order.updateMany(
            {
              paymentId,
              paymentStatus: { $ne: 'refunded' },
              'refundDetails.dispatchState': { $ne: 'confirmed' },
            },
            {
              $set: {
                paymentStatus: 'reconciliation_required',
                'refundDetails.status': 'reconciliation_required',
                'refundDetails.dispatchState': 'quarantined',
                'refundDetails.requiresManualReconciliation': true,
                'refundDetails.error': `Ambiguous refund ${refundId || 'unknown'} received at gateway without sub-order notes.`,
                'refundDetails.lastAttemptAt': new Date(),
              },
            }
          );
          return NextResponse.json({
            success: true,
            ambiguous: true,
            message: 'Multi-order refund ambiguous; queued for manual reconciliation',
          });
        }
      }

      let targetIntent = null;
      if (!targetOrder) {
        if (opKey) {
          targetIntent = await PaymentIntent.findOne({ 'refundDetails.opKey': opKey });
        }
        if (!targetIntent && refundId && paymentId) {
          targetIntent = await PaymentIntent.findOne({
            'refundDetails.refundId': refundId,
            razorpayPaymentId: paymentId,
          });
        }
        if (!targetIntent && paymentId) {
          const matchingIntents = await PaymentIntent.find({ razorpayPaymentId: paymentId });
          if (matchingIntents.length === 1) {
            const singleIntent = matchingIntents[0];
            const explicitIntentNote =
              notes && typeof notes.paymentIntentId === 'string' ? notes.paymentIntentId.trim() : '';
            const explicitRzOrderNote =
              notes && typeof notes.razorpay_order_id === 'string' ? notes.razorpay_order_id.trim() : '';
            if (
              (explicitIntentNote && singleIntent._id.toString() !== explicitIntentNote) ||
              (explicitRzOrderNote && singleIntent.razorpayOrderId !== explicitRzOrderNote) ||
              (orderIdNote && singleIntent.razorpayOrderId !== orderIdNote)
            ) {
              console.warn(
                `[Webhook] PaymentIntent ${singleIntent._id} for payment ${paymentId} contradicted by notes`
              );
            } else {
              targetIntent = singleIntent;
            }
          } else if (matchingIntents.length > 1) {
            const explicitIntentNote =
              notes && typeof notes.paymentIntentId === 'string' ? notes.paymentIntentId.trim() : '';
            const explicitRzOrderNote =
              notes && typeof notes.razorpay_order_id === 'string' ? notes.razorpay_order_id.trim() : '';
            if (explicitIntentNote) {
              targetIntent = matchingIntents.find((i) => i._id.toString() === explicitIntentNote);
            } else if (explicitRzOrderNote || orderIdNote) {
              targetIntent = matchingIntents.find(
                (i) => i.razorpayOrderId === (explicitRzOrderNote || orderIdNote)
              );
            }
            if (!targetIntent) {
              console.warn(
                `[Webhook] Multi-intent payment ${paymentId} received refund ${refundId} without exact sub-intent notes.`
              );
              await PaymentIntent.updateMany(
                {
                  razorpayPaymentId: paymentId,
                  status: { $ne: 'refunded' },
                  'refundDetails.dispatchState': { $ne: 'confirmed' },
                },
                {
                  $set: {
                    status: 'reconciliation_required',
                    'refundDetails.status': 'reconciliation_required',
                    'refundDetails.dispatchState': 'quarantined',
                    'refundDetails.requiresManualReconciliation': true,
                    'refundDetails.error': `Ambiguous refund ${refundId || 'unknown'} received at gateway without intent notes.`,
                    'refundDetails.lastAttemptAt': new Date(),
                  },
                }
              );
              return NextResponse.json({
                success: true,
                ambiguous: true,
                message: 'Multi-intent refund ambiguous; queued for manual reconciliation',
              });
            }
          }
        }
      }

      if (!targetOrder && !targetIntent) {
        if (!refundId || !paymentId) {
          return NextResponse.json(
            { success: false, message: 'Missing or invalid refund ID or payment ID in payload' },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          ignored: true,
          message: 'Order or PaymentIntent not found for processed refund event',
        });
      }

      if (targetOrder) {
        // 1. Cross-payment mismatch & missing payment ID check:
        // Must fail closed without mutating or quarantining the target Order or any parent intent.
        if (
          typeof rawPaymentId !== 'string' ||
          !paymentId ||
          !targetOrder.paymentId ||
          paymentId !== targetOrder.paymentId
        ) {
          const errDesc = !paymentId
            ? 'Webhook refund payment_id is missing, empty, or invalid type'
            : `Webhook refund payment_id '${paymentId}' does not match Order paymentId '${targetOrder.paymentId}'`;
          console.warn(`[Webhook] Payment ID mismatch on Order ${targetOrder._id}: ${errDesc}. Mutation blocked to protect victim order.`);
          return NextResponse.json(
            {
              success: false,
              quarantined: false,
              mismatchBlocked: true,
              message: 'Refund payment_id mismatch; event rejected without mutating Order',
            },
            { status: 400 }
          );
        }

        // 2. Validate refund ID: non-empty string (only for legitimately attributed payment)
        if (typeof refundEntity.id !== 'string' || !refundEntity.id.trim()) {
          console.warn(`[Webhook] Missing or invalid refund ID on Order ${targetOrder._id}`);
          await quarantineOrder(targetOrder._id, 'Webhook refund ID is missing, empty, or invalid type');
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Refund ID missing or invalid; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        // 3. Validate currency: explicitly supplied string 'INR'
        if (typeof refundEntity.currency !== 'string' || refundEntity.currency.trim().toUpperCase() !== 'INR') {
          console.warn(`[Webhook] Currency mismatch on Order ${targetOrder._id}: '${refundEntity.currency}' (expected INR)`);
          await quarantineOrder(
            targetOrder._id,
            `Webhook refund currency '${refundEntity.currency}' is invalid (expected explicitly supplied INR)`
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Refund currency mismatch; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        // 4. Validate authoritative persisted amount (No fallback to totalAmount!)
        const persistedAmountPaise = targetOrder.refundDetails?.amountPaise;
        if (
          typeof persistedAmountPaise !== 'number' ||
          !Number.isInteger(persistedAmountPaise) ||
          persistedAmountPaise <= 0
        ) {
          console.warn(`[Webhook] Missing authoritative persisted amountPaise on Order ${targetOrder._id}`);
          await quarantineOrder(
            targetOrder._id,
            'Order lacks authoritative persisted refundDetails.amountPaise; quarantined without fallback'
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Missing authoritative persisted refund amount; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        const expectedAmountPaise = persistedAmountPaise;

        // 5. Validate incoming amount in paise
        if (
          typeof refundEntity.amount !== 'number' ||
          !Number.isInteger(refundEntity.amount) ||
          refundEntity.amount <= 0 ||
          refundEntity.amount !== expectedAmountPaise
        ) {
          console.warn(
            `[Webhook] Amount mismatch on Order ${targetOrder._id}: incoming=${refundEntity.amount} paise vs expected=${expectedAmountPaise} paise`
          );
          await quarantineOrder(
            targetOrder._id,
            `Webhook refund amount (${refundEntity.amount} paise) does not match expected Order amount (${expectedAmountPaise} paise)`
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Refund amount mismatch; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        // 6. Idempotent delivery check (Already confirmed refunded)
        if (
          targetOrder.paymentStatus === 'refunded' &&
          (targetOrder.refundDetails?.status === 'processed' || targetOrder.refundDetails?.dispatchState === 'confirmed')
        ) {
          if (!targetOrder.refundDetails?.refundId || targetOrder.refundDetails.refundId === refundId) {
            return NextResponse.json({
              success: true,
              idempotent: true,
              alreadyProcessed: true,
              message: 'Refund was already processed for this order',
            });
          } else {
            console.warn(
              `[Webhook] Inconsistent refund ID on already-refunded order ${targetOrder._id}: current=${targetOrder.refundDetails.refundId}, incoming=${refundId}`
            );
            return NextResponse.json(
              {
                success: false,
                message: `Order is already confirmed refunded under different refund ID ${targetOrder.refundDetails.refundId}`,
              },
              { status: 409 }
            );
          }
        }

        // 7. Validate journaled refundId if one was already set (for non-refunded orders)
        if (targetOrder.refundDetails?.refundId && targetOrder.refundDetails.refundId !== refundId) {
          console.warn(
            `[Webhook] Refund ID mismatch on Order ${targetOrder._id}: incoming=${refundId} vs journaled=${targetOrder.refundDetails.refundId}`
          );
          await quarantineOrder(
            targetOrder._id,
            `Webhook refund ID '${refundId}' does not match journaled refundId '${targetOrder.refundDetails.refundId}'`
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Refund ID mismatch with journaled refund; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        // 8. Multi-restaurant sub-order attribution check
        const siblingCount = await Order.countDocuments({
          paymentId: targetOrder.paymentId,
          _id: { $ne: targetOrder._id },
        });

        if (siblingCount > 0) {
          const isAttributed =
            (opKey && targetOrder.refundDetails?.opKey === opKey) ||
            (orderIdNote && (targetOrder.orderId === orderIdNote || targetOrder._id.toString() === orderIdNote)) ||
            Boolean(targetOrder.refundDetails?.refundId && targetOrder.refundDetails.refundId === refundId);

          if (!isAttributed) {
            console.warn(
              `[Webhook] Sub-order attribution missing for order ${targetOrder._id} (payment ${targetOrder.paymentId}) in refund ${refundId}`
            );
            await quarantineOrder(
              targetOrder._id,
              `Refund '${refundId}' lacks sub-order attribution notes (opKey/orderId) for multi-restaurant order ${targetOrder._id}`
            );
            return NextResponse.json(
              {
                success: false,
                quarantined: true,
                message: 'Refund lacks sub-order attribution notes; quarantined for reconciliation',
              },
              { status: 400 }
            );
          }
        }

        // 9. Quarantine protection check
        const isOrderQuarantined =
          targetOrder.paymentStatus === 'reconciliation_required' ||
          targetOrder.refundDetails?.status === 'reconciliation_required' ||
          targetOrder.refundDetails?.dispatchState === 'quarantined' ||
          targetOrder.refundDetails?.requiresManualReconciliation === true;

        const hasExplicitOrderAttribution =
          Boolean(opKey && targetOrder.refundDetails?.opKey === opKey) &&
          Boolean(orderIdNote && (targetOrder.orderId === orderIdNote || targetOrder._id.toString() === orderIdNote));

        if (isOrderQuarantined && !hasExplicitOrderAttribution) {
          console.warn(
            `[Webhook] Order ${targetOrder._id} is quarantined for manual reconciliation. Rejecting automatic update without explicit attribution.`
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Order is quarantined for manual reconciliation; webhook cannot automatically transition out of quarantine without explicit attribution',
            },
            { status: 409 }
          );
        }

        // 10. Concurrency-safe atomic conditional update to refunded
        if (process.env.NODE_ENV !== 'production' && _testWebhookPreUpdateHook) {
          await _testWebhookPreUpdateHook({
            type: 'order',
            targetOrder,
            targetIntent: null,
            refundEntity,
            refundId,
          });
        }
        const updateRes = await Order.updateOne(
          {
            _id: targetOrder._id,
            paymentStatus: {
              $in: ['paid', 'refund_pending', ...(hasExplicitOrderAttribution ? ['reconciliation_required'] : [])],
            },
            'refundDetails.dispatchState': {
              $nin: ['confirmed', ...(hasExplicitOrderAttribution ? [] : ['quarantined'])],
            },
            'refundDetails.requiresManualReconciliation': hasExplicitOrderAttribution
              ? { $in: [true, false] }
              : { $ne: true },
          },
          {
            $set: {
              paymentStatus: 'refunded',
              'refundDetails.status': 'processed',
              'refundDetails.dispatchState': 'confirmed',
              'refundDetails.refundId': refundId,
              'refundDetails.gatewayStatus': refundEntity.status || 'processed',
              'refundDetails.amount': targetOrder.refundDetails?.amount || (expectedAmountPaise / 100),
              'refundDetails.amountPaise': expectedAmountPaise,
              'refundDetails.currency': 'INR',
              'refundDetails.processedAt': new Date(
                refundEntity.created_at ? refundEntity.created_at * 1000 : Date.now()
              ),
              'refundDetails.reconciled': true,
              'refundDetails.error': null,
              'refundDetails.requiresManualReconciliation': false,
            },
          }
        );

        if (updateRes.matchedCount === 0) {
          const fresh = await Order.findById(targetOrder._id);
          if (fresh?.paymentStatus === 'refunded') {
            if (!fresh.refundDetails?.refundId || fresh.refundDetails.refundId === refundId) {
              return NextResponse.json({
                success: true,
                idempotent: true,
                alreadyProcessed: true,
                message: 'Refund was already processed for this order',
              });
            } else {
              return NextResponse.json(
                {
                  success: false,
                  message: `Order is already confirmed refunded under different refund ID ${fresh.refundDetails.refundId}`,
                },
                { status: 409 }
              );
            }
          }
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Order state transition failed; record is quarantined or in incompatible state',
            },
            { status: 409 }
          );
        }

        // 11. Safe PaymentIntent sibling synchronization (never reverts quarantine)
        try {
          const intent = await PaymentIntent.findOne({
            $or: [
              { razorpayOrderId: targetOrder.orderId },
              { razorpayPaymentId: targetOrder.paymentId },
              { createdOrders: targetOrder._id },
            ],
          });
          if (intent) {
            if (
              targetOrder.paymentId &&
              intent.razorpayPaymentId &&
              targetOrder.paymentId !== intent.razorpayPaymentId
            ) {
              console.warn(
                `[Webhook] Order ${targetOrder._id} paymentId '${targetOrder.paymentId}' conflicts with parent intent ${intent._id} paymentId '${intent.razorpayPaymentId}'. Parent synchronization skipped.`
              );
            } else {
              const isIntentQuarantined =
                intent.status === 'reconciliation_required' ||
                intent.refundDetails?.dispatchState === 'quarantined' ||
                intent.refundDetails?.requiresManualReconciliation === true;

              const siblings = await Order.find({ _id: { $in: intent.createdOrders } });
              const anySiblingQuarantined = siblings.some(
                (o) =>
                  o.paymentStatus === 'reconciliation_required' ||
                  o.refundDetails?.dispatchState === 'quarantined' ||
                  o.refundDetails?.requiresManualReconciliation === true
              );
              const allRefunded = siblings.length > 0 && siblings.every((o) => o.paymentStatus === 'refunded');

              let newStatus;
              let newDispatchState;
              let newRequiresManualRecon;

              if (isIntentQuarantined || anySiblingQuarantined) {
                newStatus = 'reconciliation_required';
                newDispatchState = 'quarantined';
                newRequiresManualRecon = true;
              } else if (allRefunded) {
                newStatus = 'refunded';
                newDispatchState = 'confirmed';
                newRequiresManualRecon = false;
              } else {
                newStatus = 'refund_pending';
                newDispatchState = intent.refundDetails?.dispatchState || 'none';
                newRequiresManualRecon = false;
              }

              await PaymentIntent.updateOne(
                {
                  _id: intent._id,
                  status: { $ne: 'refunded' },
                  'refundDetails.dispatchState': { $ne: 'confirmed' },
                },
                {
                  $set: {
                    status: newStatus,
                    'refundDetails.status': allRefunded ? 'processed' : (intent.refundDetails?.status || 'pending'),
                    'refundDetails.dispatchState': newDispatchState,
                    'refundDetails.refundId': intent.refundDetails?.refundId || refundId,
                    'refundDetails.requiresManualReconciliation': newRequiresManualRecon,
                    'refundDetails.lastAttemptAt': new Date(),
                    ...(allRefunded
                      ? {
                          'refundDetails.reconciled': true,
                          'refundDetails.processedAt': new Date(),
                        }
                      : {}),
                  },
                }
              );
            }
          }
        } catch (intentErr) {
          console.warn(`[Webhook] Warning reconciling PaymentIntent for order ${targetOrder._id}:`, intentErr.message);
        }

        return NextResponse.json({
          success: true,
          processed: true,
          orderId: targetOrder._id,
          refundId,
        });
      }

      if (targetIntent) {
        // 1. Cross-payment mismatch & missing payment ID check:
        // Must fail closed without mutating or quarantining the target PaymentIntent.
        if (
          typeof rawPaymentId !== 'string' ||
          !paymentId ||
          !targetIntent.razorpayPaymentId ||
          paymentId !== targetIntent.razorpayPaymentId
        ) {
          const errDesc = !paymentId
            ? 'Webhook refund payment_id is missing, empty, or invalid type'
            : `Webhook refund payment_id '${paymentId}' does not match PaymentIntent paymentId '${targetIntent.razorpayPaymentId}'`;
          console.warn(`[Webhook] Payment ID mismatch on PaymentIntent ${targetIntent._id}: ${errDesc}. Mutation blocked to protect victim intent.`);
          return NextResponse.json(
            {
              success: false,
              quarantined: false,
              mismatchBlocked: true,
              message: 'Refund payment_id mismatch; event rejected without mutating PaymentIntent',
            },
            { status: 400 }
          );
        }

        // 2. Validate refund ID: non-empty string (only for legitimately attributed payment)
        if (typeof refundEntity.id !== 'string' || !refundEntity.id.trim()) {
          console.warn(`[Webhook] Missing or invalid refund ID on PaymentIntent ${targetIntent._id}`);
          await quarantineIntent(targetIntent._id, 'Webhook refund ID is missing, empty, or invalid type');
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Refund ID missing or invalid; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        // 3. Validate currency: explicitly supplied string 'INR'
        if (typeof refundEntity.currency !== 'string' || refundEntity.currency.trim().toUpperCase() !== 'INR') {
          console.warn(`[Webhook] Currency mismatch on PaymentIntent ${targetIntent._id}: '${refundEntity.currency}' (expected INR)`);
          await quarantineIntent(
            targetIntent._id,
            `Webhook refund currency '${refundEntity.currency}' is invalid (expected explicitly supplied INR)`
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Refund currency mismatch; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        // 4. Validate authoritative persisted amount (No fallback!)
        const persistedIntentAmountPaise =
          typeof targetIntent.refundDetails?.amountPaise === 'number' && targetIntent.refundDetails.amountPaise > 0
            ? targetIntent.refundDetails.amountPaise
            : (typeof targetIntent.amountPaise === 'number' && targetIntent.amountPaise > 0
                ? targetIntent.amountPaise
                : null);

        if (
          persistedIntentAmountPaise === null ||
          !Number.isInteger(persistedIntentAmountPaise) ||
          persistedIntentAmountPaise <= 0
        ) {
          console.warn(`[Webhook] Missing or invalid persisted amountPaise on PaymentIntent ${targetIntent._id}`);
          await quarantineIntent(
            targetIntent._id,
            'PaymentIntent lacks authoritative persisted amountPaise; quarantined without fallback'
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Missing authoritative persisted refund amount; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        const expectedIntentAmountPaise = persistedIntentAmountPaise;

        // 5. Validate incoming amount in paise
        if (
          typeof refundEntity.amount !== 'number' ||
          !Number.isInteger(refundEntity.amount) ||
          refundEntity.amount <= 0 ||
          refundEntity.amount !== expectedIntentAmountPaise
        ) {
          console.warn(
            `[Webhook] Amount mismatch on PaymentIntent ${targetIntent._id}: incoming=${refundEntity.amount} paise vs expected=${expectedIntentAmountPaise} paise`
          );
          await quarantineIntent(
            targetIntent._id,
            `Webhook refund amount (${refundEntity.amount} paise) does not match PaymentIntent (${expectedIntentAmountPaise} paise)`
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Refund amount mismatch; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        // 6. Idempotent delivery check (Already confirmed refunded)
        if (
          targetIntent.status === 'refunded' &&
          (targetIntent.refundDetails?.status === 'processed' || targetIntent.refundDetails?.dispatchState === 'confirmed')
        ) {
          if (!targetIntent.refundDetails?.refundId || targetIntent.refundDetails.refundId === refundId) {
            return NextResponse.json({
              success: true,
              idempotent: true,
              alreadyProcessed: true,
              paymentIntentId: targetIntent._id,
              message: 'Refund was already processed for this PaymentIntent',
            });
          } else {
            console.warn(
              `[Webhook] Inconsistent refund ID on already-refunded PaymentIntent ${targetIntent._id}: current=${targetIntent.refundDetails.refundId}, incoming=${refundId}`
            );
            return NextResponse.json(
              {
                success: false,
                message: `PaymentIntent is already confirmed refunded under different refund ID ${targetIntent.refundDetails.refundId}`,
              },
              { status: 409 }
            );
          }
        }

        // 7. Validate journaled refundId if one was already set (for non-refunded intents)
        if (targetIntent.refundDetails?.refundId && targetIntent.refundDetails.refundId !== refundId) {
          console.warn(
            `[Webhook] Refund ID mismatch on PaymentIntent ${targetIntent._id}: incoming=${refundId} vs journaled=${targetIntent.refundDetails.refundId}`
          );
          await quarantineIntent(
            targetIntent._id,
            `Webhook refund ID '${refundId}' does not match journaled refundId '${targetIntent.refundDetails.refundId}'`
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'Refund ID mismatch with journaled refund; quarantined for reconciliation',
            },
            { status: 400 }
          );
        }

        // 8. Sibling attribution check on PaymentIntent
        const siblingIntentCount = await PaymentIntent.countDocuments({
          razorpayPaymentId: targetIntent.razorpayPaymentId,
          _id: { $ne: targetIntent._id },
        });

        if (siblingIntentCount > 0) {
          const isIntentAttributed =
            (opKey && targetIntent.refundDetails?.opKey === opKey) ||
            (orderIdNote && targetIntent.razorpayOrderId === orderIdNote) ||
            (notes.paymentIntentId && targetIntent._id.toString() === notes.paymentIntentId) ||
            Boolean(targetIntent.refundDetails?.refundId && targetIntent.refundDetails.refundId === refundId);

          if (!isIntentAttributed) {
            console.warn(
              `[Webhook] Attribution missing for PaymentIntent ${targetIntent._id} (payment ${targetIntent.razorpayPaymentId}) in refund ${refundId}`
            );
            await quarantineIntent(
              targetIntent._id,
              `Refund '${refundId}' lacks attribution notes (opKey/razorpayOrderId/paymentIntentId) for multi-intent payment ${targetIntent.razorpayPaymentId}`
            );
            return NextResponse.json(
              {
                success: false,
                quarantined: true,
                message: 'Refund lacks attribution notes; quarantined for reconciliation',
              },
              { status: 400 }
            );
          }
        }

        // 9. Quarantine protection check
        const isIntentQuarantined =
          targetIntent.status === 'reconciliation_required' ||
          targetIntent.refundDetails?.status === 'reconciliation_required' ||
          targetIntent.refundDetails?.dispatchState === 'quarantined' ||
          targetIntent.refundDetails?.requiresManualReconciliation === true;

        const hasExplicitIntentAttribution =
          Boolean(opKey && targetIntent.refundDetails?.opKey === opKey) &&
          Boolean(
            (notes.paymentIntentId && targetIntent._id.toString() === notes.paymentIntentId) ||
            (orderIdNote && targetIntent.razorpayOrderId === orderIdNote)
          );

        if (isIntentQuarantined && !hasExplicitIntentAttribution) {
          console.warn(
            `[Webhook] PaymentIntent ${targetIntent._id} is quarantined for manual reconciliation. Rejecting automatic update without explicit attribution.`
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'PaymentIntent is quarantined for manual reconciliation; webhook cannot automatically transition out of quarantine without explicit attribution',
            },
            { status: 409 }
          );
        }

        // 10. Concurrency-safe atomic conditional update to refunded
        if (process.env.NODE_ENV !== 'production' && _testWebhookPreUpdateHook) {
          await _testWebhookPreUpdateHook({
            type: 'intent',
            targetOrder: null,
            targetIntent,
            refundEntity,
            refundId,
          });
        }
        const updateRes = await PaymentIntent.updateOne(
          {
            _id: targetIntent._id,
            status: {
              $in: [
                'created',
                'verifying',
                'verified',
                'failed',
                'refund_pending',
                ...(hasExplicitIntentAttribution ? ['reconciliation_required'] : []),
              ],
            },
            'refundDetails.dispatchState': {
              $nin: ['confirmed', ...(hasExplicitIntentAttribution ? [] : ['quarantined'])],
            },
            'refundDetails.requiresManualReconciliation': hasExplicitIntentAttribution
              ? { $in: [true, false] }
              : { $ne: true },
          },
          {
            $set: {
              status: 'refunded',
              'refundDetails.status': 'processed',
              'refundDetails.dispatchState': 'confirmed',
              'refundDetails.refundId': refundId,
              'refundDetails.gatewayStatus': refundEntity.status || 'processed',
              'refundDetails.amount': targetIntent.amount,
              'refundDetails.amountPaise': expectedIntentAmountPaise,
              'refundDetails.currency': 'INR',
              'refundDetails.processedAt': new Date(
                refundEntity.created_at ? refundEntity.created_at * 1000 : Date.now()
              ),
              'refundDetails.reconciled': true,
              'refundDetails.error': null,
              'refundDetails.requiresManualReconciliation': false,
            },
          }
        );

        if (updateRes.matchedCount === 0) {
          const fresh = await PaymentIntent.findById(targetIntent._id);
          if (fresh?.status === 'refunded') {
            if (!fresh.refundDetails?.refundId || fresh.refundDetails.refundId === refundId) {
              return NextResponse.json({
                success: true,
                idempotent: true,
                alreadyProcessed: true,
                paymentIntentId: targetIntent._id,
                message: 'Refund was already processed for this PaymentIntent',
              });
            } else {
              return NextResponse.json(
                {
                  success: false,
                  message: `PaymentIntent is already confirmed refunded under different refund ID ${fresh.refundDetails.refundId}`,
                },
                { status: 409 }
              );
            }
          }
          return NextResponse.json(
            {
              success: false,
              quarantined: true,
              message: 'PaymentIntent state transition failed; record is quarantined or in incompatible state',
            },
            { status: 409 }
          );
        }

        return NextResponse.json({
          success: true,
          processed: true,
          paymentIntentId: targetIntent._id,
          refundId,
        });
      }
    }

    if (eventType === 'refund.failed') {
      const rawRefundId = refundEntity.id;
      const rawPaymentId = refundEntity.payment_id;
      const refundId = typeof rawRefundId === 'string' ? rawRefundId.trim() : '';
      const paymentId = typeof rawPaymentId === 'string' ? rawPaymentId.trim() : '';
      const notes = (refundEntity.notes && typeof refundEntity.notes === 'object') ? refundEntity.notes : {};
      const opKey = typeof notes.opKey === 'string' ? notes.opKey.trim() : '';
      const orderIdNote = typeof notes.orderId === 'string' ? notes.orderId.trim() : '';

      let targetOrder = null;
      if (opKey) {
        targetOrder = await Order.findOne({ 'refundDetails.opKey': opKey });
      }
      if (!targetOrder && refundId && paymentId) {
        targetOrder = await Order.findOne({
          'refundDetails.refundId': refundId,
          paymentId,
        });
      }
      if (!targetOrder && paymentId) {
        const matchingOrders = await Order.find({ paymentId });
        if (matchingOrders.length === 1) {
          const singleOrder = matchingOrders[0];
          if (
            orderIdNote &&
            singleOrder.orderId !== orderIdNote &&
            singleOrder._id.toString() !== orderIdNote
          ) {
            console.warn(
              `[Webhook] Order ${singleOrder._id} for payment ${paymentId} contradicted by note orderId '${orderIdNote}'`
            );
          } else {
            targetOrder = singleOrder;
          }
        } else if (matchingOrders.length > 1) {
          // Multi-restaurant payment with ambiguous refund:
          // When opKey is missing, an uncorroborated orderIdNote cannot safely single out one sibling.
          // Quarantine the complete sibling set and parent PaymentIntent for manual reconciliation.
          console.warn(
            `[Webhook] Multi-restaurant payment ${paymentId} received refund.failed without corroborating opKey or persisted refundId.`
          );
          await Order.updateMany(
            {
              paymentId,
              paymentStatus: { $ne: 'refunded' },
              'refundDetails.dispatchState': { $ne: 'confirmed' },
            },
            {
              $set: {
                paymentStatus: 'reconciliation_required',
                'refundDetails.status': 'failed',
                'refundDetails.gatewayStatus': 'failed',
                'refundDetails.dispatchState': 'quarantined',
                'refundDetails.requiresManualReconciliation': true,
                'refundDetails.error':
                  refundEntity.error_description ||
                  refundEntity.error_reason ||
                  'Gateway reported refund failure on ambiguous multi-restaurant payment',
                'refundDetails.lastAttemptAt': new Date(),
              },
            }
          );

          try {
            await PaymentIntent.updateMany(
              {
                razorpayPaymentId: paymentId,
                status: { $ne: 'refunded' },
                'refundDetails.dispatchState': { $ne: 'confirmed' },
              },
              {
                $set: {
                  status: 'reconciliation_required',
                  'refundDetails.status': 'failed',
                  'refundDetails.gatewayStatus': 'failed',
                  'refundDetails.dispatchState': 'quarantined',
                  'refundDetails.requiresManualReconciliation': true,
                  'refundDetails.error':
                    refundEntity.error_description ||
                    refundEntity.error_reason ||
                    'Gateway reported refund failure on ambiguous multi-restaurant payment',
                  'refundDetails.lastAttemptAt': new Date(),
                },
              }
            );
          } catch (piErr) {
            console.warn(
              `[Webhook] Warning synchronizing PaymentIntents for ambiguous failed payment ${paymentId}:`,
              piErr.message
            );
          }

          return NextResponse.json({
            success: true,
            recordedFailure: true,
            ambiguous: true,
            message: 'Multi-order failed refund ambiguous; all unconfirmed sub-orders quarantined',
          });
        }
      }

      let targetIntent = null;
      if (!targetOrder) {
        if (opKey) {
          targetIntent = await PaymentIntent.findOne({ 'refundDetails.opKey': opKey });
        }
        if (!targetIntent && refundId && paymentId) {
          targetIntent = await PaymentIntent.findOne({
            'refundDetails.refundId': refundId,
            razorpayPaymentId: paymentId,
          });
        }
        if (!targetIntent && paymentId) {
          const matchingIntents = await PaymentIntent.find({ razorpayPaymentId: paymentId });
          if (matchingIntents.length === 1) {
            const singleIntent = matchingIntents[0];
            const explicitIntentNote =
              notes && typeof notes.paymentIntentId === 'string' ? notes.paymentIntentId.trim() : '';
            const explicitRzOrderNote =
              notes && typeof notes.razorpay_order_id === 'string' ? notes.razorpay_order_id.trim() : '';
            if (
              (explicitIntentNote && singleIntent._id.toString() !== explicitIntentNote) ||
              (explicitRzOrderNote && singleIntent.razorpayOrderId !== explicitRzOrderNote) ||
              (orderIdNote && singleIntent.razorpayOrderId !== orderIdNote)
            ) {
              console.warn(
                `[Webhook] PaymentIntent ${singleIntent._id} for payment ${paymentId} contradicted by notes`
              );
            } else {
              targetIntent = singleIntent;
            }
          } else if (matchingIntents.length > 1) {
            const explicitIntentNote =
              notes && typeof notes.paymentIntentId === 'string' ? notes.paymentIntentId.trim() : '';
            const explicitRzOrderNote =
              notes && typeof notes.razorpay_order_id === 'string' ? notes.razorpay_order_id.trim() : '';
            if (explicitIntentNote) {
              targetIntent = matchingIntents.find((i) => i._id.toString() === explicitIntentNote);
            } else if (explicitRzOrderNote || orderIdNote) {
              targetIntent = matchingIntents.find(
                (i) => i.razorpayOrderId === (explicitRzOrderNote || orderIdNote)
              );
            }
            if (!targetIntent) {
              console.warn(
                `[Webhook] Multi-intent payment ${paymentId} received refund.failed without exact sub-intent notes.`
              );
              await PaymentIntent.updateMany(
                {
                  razorpayPaymentId: paymentId,
                  status: { $ne: 'refunded' },
                  'refundDetails.dispatchState': { $ne: 'confirmed' },
                },
                {
                  $set: {
                    status: 'reconciliation_required',
                    'refundDetails.status': 'failed',
                    'refundDetails.gatewayStatus': 'failed',
                    'refundDetails.dispatchState': 'quarantined',
                    'refundDetails.requiresManualReconciliation': true,
                    'refundDetails.error':
                      refundEntity.error_description ||
                      refundEntity.error_reason ||
                      'Gateway reported refund failure on ambiguous multi-intent payment',
                    'refundDetails.lastAttemptAt': new Date(),
                  },
                }
              );
              return NextResponse.json({
                success: true,
                recordedFailure: true,
                ambiguous: true,
                message: 'Multi-intent failed refund ambiguous; all unconfirmed intents quarantined',
              });
            }
          }
        }
      }

      if (!targetOrder && !targetIntent) {
        if (!refundId || !paymentId) {
          return NextResponse.json(
            { success: false, message: 'Missing or invalid refund ID or payment ID in payload' },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          ignored: true,
          message: 'Neither Order nor PaymentIntent found for failed refund event',
        });
      }

      if (targetIntent) {
        // Validate paymentId against targetIntent (fail closed on missing, empty, or conflicting payment IDs)
        if (
          typeof rawPaymentId !== 'string' ||
          !paymentId ||
          !targetIntent.razorpayPaymentId ||
          paymentId !== targetIntent.razorpayPaymentId
        ) {
          const errDesc = !paymentId
            ? 'Webhook refund payment_id is missing, empty, or invalid type'
            : `Webhook refund payment_id '${paymentId}' does not match PaymentIntent paymentId '${targetIntent.razorpayPaymentId}'`;
          console.warn(
            `[Webhook] Cross-payment mismatch on PaymentIntent ${targetIntent._id}: ${errDesc}. Mutation blocked to protect victim intent.`
          );
          return NextResponse.json(
            {
              success: false,
              quarantined: false,
              mismatchBlocked: true,
              message: 'Refund payment_id mismatch; event rejected without mutating PaymentIntent',
            },
            { status: 400 }
          );
        }

        // Out-of-order check: Never regress a completed refund
        if (targetIntent.status === 'refunded' || targetIntent.refundDetails?.status === 'processed') {
          console.warn(
            `[Webhook] Out-of-order refund.failed received for already refunded PaymentIntent ${targetIntent._id}. Ignored.`
          );
          return NextResponse.json({
            success: true,
            ignored: true,
            paymentIntentId: targetIntent._id,
            reason: 'PaymentIntent is already marked refunded; out-of-order failure ignored',
          });
        }

        await PaymentIntent.updateOne(
          {
            _id: targetIntent._id,
            status: { $ne: 'refunded' },
            'refundDetails.dispatchState': { $ne: 'confirmed' },
          },
          {
            $set: {
              status: 'reconciliation_required',
              'refundDetails.status': 'failed',
              'refundDetails.gatewayStatus': 'failed',
              'refundDetails.dispatchState': 'quarantined',
              'refundDetails.error':
                refundEntity.error_description || refundEntity.error_reason || 'Gateway reported refund failure',
              'refundDetails.requiresManualReconciliation': true,
              'refundDetails.lastAttemptAt': new Date(),
            },
          }
        );

        return NextResponse.json({
          success: true,
          recordedFailure: true,
          paymentIntentId: targetIntent._id,
        });
      }

      // Validate paymentId against targetOrder (fail closed on missing, empty, or conflicting payment IDs)
      if (
        typeof rawPaymentId !== 'string' ||
        !paymentId ||
        !targetOrder.paymentId ||
        paymentId !== targetOrder.paymentId
      ) {
        const errDesc = !paymentId
          ? 'Webhook refund payment_id is missing, empty, or invalid type'
          : `Webhook refund payment_id '${paymentId}' does not match Order paymentId '${targetOrder.paymentId}'`;
        console.warn(
          `[Webhook] Cross-payment mismatch on Order ${targetOrder._id}: ${errDesc}. Mutation blocked to protect victim order.`
        );
        return NextResponse.json(
          {
            success: false,
            quarantined: false,
            mismatchBlocked: true,
            message: 'Refund payment_id mismatch; event rejected without mutating Order',
          },
          { status: 400 }
        );
      }

      // Out-of-order check: Never regress a completed refund
      if (targetOrder.paymentStatus === 'refunded' || targetOrder.refundDetails?.status === 'processed') {
        console.warn(
          `[Webhook] Out-of-order refund.failed received for already refunded order ${targetOrder._id}. Ignored.`
        );
        return NextResponse.json({
          success: true,
          ignored: true,
          reason: 'Order is already marked refunded; out-of-order failure ignored',
        });
      }

      if (process.env.NODE_ENV !== 'production' && _testWebhookPreUpdateHook) {
        await _testWebhookPreUpdateHook({
          type: 'order_failed',
          targetOrder,
          targetIntent: null,
          refundEntity,
          refundId,
        });
      }

      await Order.updateOne(
        {
          _id: targetOrder._id,
          paymentStatus: { $ne: 'refunded' },
          'refundDetails.dispatchState': { $ne: 'confirmed' },
        },
        {
          $set: {
            paymentStatus: 'reconciliation_required',
            'refundDetails.status': 'failed',
            'refundDetails.gatewayStatus': 'failed',
            'refundDetails.dispatchState': 'quarantined',
            'refundDetails.error':
              refundEntity.error_description || refundEntity.error_reason || 'Gateway reported refund failure',
            'refundDetails.requiresManualReconciliation': true,
            'refundDetails.lastAttemptAt': new Date(),
          },
        }
      );

      // Safe Parent PaymentIntent candidate resolution and synchronization following Order refund.failed
      let parentSyncResult = {
        attempted: false,
        candidatesCount: 0,
        candidateIds: [],
        matchedCount: 0,
        modifiedCount: 0,
        ambiguous: false,
        conflicting: false,
        confirmedPreserved: false,
        zeroMatch: false,
      };

      try {
        const orClauses = [];
        if (targetOrder._id && mongoose.Types.ObjectId.isValid(targetOrder._id)) {
          orClauses.push({ createdOrders: targetOrder._id });
        }
        if (typeof targetOrder.orderId === 'string' && targetOrder.orderId.trim()) {
          orClauses.push({ razorpayOrderId: targetOrder.orderId.trim() });
        }
        if (typeof targetOrder.paymentId === 'string' && targetOrder.paymentId.trim()) {
          orClauses.push({ razorpayPaymentId: targetOrder.paymentId.trim() });
        }

        if (orClauses.length > 0) {
          const candidateIntents = await PaymentIntent.find({ $or: orClauses });
          parentSyncResult.attempted = true;
          parentSyncResult.candidatesCount = candidateIntents.length;
          parentSyncResult.candidateIds = candidateIntents.map((c) => c._id.toString());

          if (candidateIntents.length === 1) {
            const candidate = candidateIntents[0];

            // Validate against explicit identifier conflicts
            let isConflicting = false;
            let conflictReason = '';

            const explicitIntentNote =
              notes && typeof notes.paymentIntentId === 'string' ? notes.paymentIntentId.trim() : '';
            const explicitRzOrderNote =
              notes && typeof notes.razorpay_order_id === 'string' ? notes.razorpay_order_id.trim() : '';

            const isDirectLinked = candidate.createdOrders?.some(
              (id) => id.toString() === targetOrder._id.toString()
            );

            const isPaymentIdConflict = Boolean(
              targetOrder.paymentId &&
              candidate.razorpayPaymentId &&
              targetOrder.paymentId !== candidate.razorpayPaymentId
            );

            if (isPaymentIdConflict) {
              isConflicting = true;
              conflictReason = `Order paymentId '${targetOrder.paymentId}' does not match candidate razorpayPaymentId '${candidate.razorpayPaymentId}'`;
            } else if (explicitIntentNote && explicitIntentNote !== candidate._id.toString()) {
              isConflicting = true;
              conflictReason = `Explicit note paymentIntentId '${explicitIntentNote}' does not match candidate '${candidate._id}'`;
            } else if (
              explicitRzOrderNote &&
              candidate.razorpayOrderId &&
              explicitRzOrderNote !== candidate.razorpayOrderId
            ) {
              isConflicting = true;
              conflictReason = `Explicit note razorpay_order_id '${explicitRzOrderNote}' does not match candidate razorpayOrderId '${candidate.razorpayOrderId}'`;
            } else if (
              !isDirectLinked &&
              orderIdNote &&
              candidate.razorpayOrderId &&
              orderIdNote !== candidate.razorpayOrderId
            ) {
              isConflicting = true;
              conflictReason = `Note orderId '${orderIdNote}' does not match candidate razorpayOrderId '${candidate.razorpayOrderId}'`;
            }

            parentSyncResult.conflicting = isConflicting;

            if (isPaymentIdConflict) {
              console.warn(
                `[Webhook] Conflicting parent candidate ${candidate._id} for failed order ${targetOrder._id}: ${conflictReason}. Mutation skipped to protect candidate.`
              );
              parentSyncResult.conflictedSkipped = true;
              parentSyncResult.conflictReason = conflictReason;
            } else {
              const failureErrorMsg = isConflicting
                ? `Conflicting parent attribution notes received for failed child order ${targetOrder._id}: ${conflictReason}`
                : (refundEntity.error_description ||
                   refundEntity.error_reason ||
                   `Child order ${targetOrder._id} refund failed at gateway`);

              const updateRes = await PaymentIntent.updateOne(
                {
                  _id: candidate._id,
                  status: { $ne: 'refunded' },
                  'refundDetails.dispatchState': { $ne: 'confirmed' },
                },
                {
                  $set: {
                    status: 'reconciliation_required',
                    'refundDetails.status': 'failed',
                    'refundDetails.gatewayStatus': 'failed',
                    'refundDetails.dispatchState': 'quarantined',
                    'refundDetails.requiresManualReconciliation': true,
                    'refundDetails.error': failureErrorMsg,
                    'refundDetails.lastAttemptAt': new Date(),
                  },
                }
              );

              parentSyncResult.matchedCount = updateRes.matchedCount;
              parentSyncResult.modifiedCount = updateRes.modifiedCount;

              if (updateRes.matchedCount === 0) {
                parentSyncResult.zeroMatch = true;
                const freshCandidate = await PaymentIntent.findById(candidate._id);
                if (
                  freshCandidate?.status === 'refunded' ||
                  freshCandidate?.refundDetails?.dispatchState === 'confirmed'
                ) {
                  parentSyncResult.confirmedPreserved = true;
                  console.warn(
                    `[Webhook] Parent PaymentIntent ${candidate._id} is already confirmed refunded. Quarantine skipped to prevent downgrade.`
                  );
                } else {
                  console.warn(
                    `[Webhook] Parent PaymentIntent ${candidate._id} update returned matchedCount === 0 (concurrent state change).`
                  );
                }
              }
            }
          } else if (candidateIntents.length > 1) {
            // Ambiguous parent attribution: Multiple PaymentIntents matched!
            parentSyncResult.ambiguous = true;
            console.warn(
              `[Webhook] Ambiguous parent attribution for failed order ${targetOrder._id}: matched ${candidateIntents.length} candidates (${parentSyncResult.candidateIds.join(', ')}). Quarantining all unconfirmed candidates.`
            );

            const explicitIntentNote =
              notes && typeof notes.paymentIntentId === 'string' ? notes.paymentIntentId.trim() : '';
            if (explicitIntentNote && !candidateIntents.some((c) => c._id.toString() === explicitIntentNote)) {
              parentSyncResult.conflicting = true;
            }

            let totalMatched = 0;
            let totalModified = 0;

            for (const cand of candidateIntents) {
              const candRes = await PaymentIntent.updateOne(
                {
                  _id: cand._id,
                  status: { $ne: 'refunded' },
                  'refundDetails.dispatchState': { $ne: 'confirmed' },
                },
                {
                  $set: {
                    status: 'reconciliation_required',
                    'refundDetails.status': 'failed',
                    'refundDetails.gatewayStatus': 'failed',
                    'refundDetails.dispatchState': 'quarantined',
                    'refundDetails.requiresManualReconciliation': true,
                    'refundDetails.error': `Ambiguous parent attribution: order ${targetOrder._id} refund failed but matched multiple PaymentIntents (${parentSyncResult.candidateIds.join(', ')})`,
                    'refundDetails.lastAttemptAt': new Date(),
                  },
                }
              );
              totalMatched += candRes.matchedCount;
              totalModified += candRes.modifiedCount;
            }

            parentSyncResult.matchedCount = totalMatched;
            parentSyncResult.modifiedCount = totalModified;
          }
        }
      } catch (intentErr) {
        console.warn(
          `[Webhook] Warning reconciling PaymentIntent for failed order ${targetOrder._id}:`,
          intentErr.message
        );
      }

      return NextResponse.json({
        success: true,
        recordedFailure: true,
        orderId: targetOrder._id,
        parentSync: parentSyncResult,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Event '${eventType}' acknowledged`,
    });
  } catch (err) {
    console.error('[Razorpay Webhook Error]:', err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
