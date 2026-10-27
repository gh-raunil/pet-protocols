import crypto from 'crypto';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Order from '@/models/Order';
import User from '@/models/User';
import Restaurant from '@/models/Restaurant';
import Product from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateOrderDetails } from '@/lib/checkoutCalculationService';
import { deductStockForOrder, restoreStockForOrder } from '@/lib/inventoryService';
import { executeOrderRefund } from '@/lib/refundService';
import { notifyOrderEvent } from '@/lib/pushService';
import { enqueueOrderEvents } from '@/lib/notificationOutboxService';
import { isValidPhone, normalizePhone } from '@/lib/validation';
import {
  generateGuestAccessToken,
  deriveGuestAccessToken,
  hashGuestAccessToken,
  extractGuestAccessToken,
  computeGuestTokenExpiry,
  buildGuestOrderQuery,
} from '@/lib/guestAccessService';

let _getServerSession = getServerSession;
export function _setTestGetServerSession(fn) {
  _getServerSession = fn;
}

async function resolveSession() {
  try {
    return await _getServerSession(authOptions);
  } catch {
    return null;
  }
}

// GET — Fetch customer's orders (with pagination, deterministic sort, and optional filters)
export async function GET(request) {
  try {
    const session = await resolveSession();
    const guestToken = extractGuestAccessToken(request);

    if (!session && !guestToken) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get('orderId') || searchParams.get('id');

    // Pagination parameter validation & safe normalization (Phase 3)
    let page = 1;
    let limit = 20;

    if (searchParams.has('page')) {
      const rawPage = searchParams.get('page')?.trim();
      if (!rawPage || !/^\d+$/.test(rawPage) || parseInt(rawPage, 10) < 1) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid page parameter. Page must be a positive integer greater than zero.',
          },
          { status: 400 }
        );
      }
      page = parseInt(rawPage, 10);
    }

    if (searchParams.has('limit')) {
      const rawLimit = searchParams.get('limit')?.trim();
      if (!rawLimit || !/^\d+$/.test(rawLimit) || parseInt(rawLimit, 10) < 1) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid limit parameter. Limit must be a positive integer between 1 and 50.',
          },
          { status: 400 }
        );
      }
      const parsedLimit = parseInt(rawLimit, 10);
      limit = Math.min(50, parsedLimit);
    }

    await connectDB();

    let query = {};

    if (session?.user?.role === 'superadmin') {
      // Superadmin can view all orders
      query = {};
    } else if (session?.user?.role === 'restaurant_admin' || session?.user?.role === 'staff') {
      const restId = (session.user.restaurantId || session.user.restaurant)?.toString();
      if (!restId) {
        return NextResponse.json(
          { success: false, message: 'Access denied: staff account is not assigned to an active restaurant.' },
          { status: 403 }
        );
      }
      query = { restaurant: restId };
    } else if (session?.user) {
      // Customer: ownership strictly enforced in query against verified account ID
      const user = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!user) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }
      // Security Invariant: Registered customer orders are queryable only by authenticated account ID.
      // Phone matching against guest orders is strictly removed to prevent account hijacking.
      if (guestToken) {
        const tokenHash = hashGuestAccessToken(guestToken);
        query = {
          $or: [
            { user: user._id },
            buildGuestOrderQuery(tokenHash),
          ],
        };
      } else {
        query = { user: user._id };
      }
    } else {
      // Guest customer: authorized strictly via validated guest access token
      const tokenHash = hashGuestAccessToken(guestToken);
      query = buildGuestOrderQuery(tokenHash);
    }

    // Optional date filter: 'today', 'all', or 'YYYY-MM-DD'
    const dateParam = searchParams.get('date')?.trim();
    if (dateParam && dateParam !== 'all') {
      let targetDateStr = null;
      if (dateParam === 'today') {
        targetDateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        targetDateStr = dateParam;
      }

      if (targetDateStr) {
        const startOfDay = new Date(`${targetDateStr}T00:00:00.000+05:30`);
        const endOfDay = new Date(`${targetDateStr}T23:59:59.999+05:30`);
        if (!isNaN(startOfDay.getTime()) && !isNaN(endOfDay.getTime())) {
          query.createdAt = { $gte: startOfDay, $lte: endOfDay };
        }
      }
    }

    let totalOrders = 0;
    let orders = [];

    if (orderIdParam) {
      if (orderIdParam.length === 24 && /^[0-9a-fA-F]{24}$/.test(orderIdParam)) {
        query._id = orderIdParam;
      } else {
        query.orderId = orderIdParam;
      }

      orders = await Order.find(query)
        .populate('restaurant', 'name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings')
        .populate('user', 'name email')
        .sort({ createdAt: -1, _id: -1 });

      totalOrders = orders.length;
    } else {
      const skip = (page - 1) * limit;

      const [count, results] = await Promise.all([
        Order.countDocuments(query),
        Order.find(query)
          .populate('restaurant', 'name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings')
          .populate('user', 'name email')
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      totalOrders = count;
      orders = results;
    }

    const totalPages = totalOrders > 0 ? Math.ceil(totalOrders / limit) : 1;
    const hasMore = page < totalPages;

    const sanitizedOrders = orders.map((o) => {
      const orderObj = typeof o.toObject === 'function' ? o.toObject() : { ...o };
      if (!Array.isArray(orderObj.statusHistory) || orderObj.statusHistory.length === 0) {
        orderObj.statusHistory = [
          {
            status: orderObj.status || 'pending',
            changedAt: orderObj.createdAt || new Date(),
            note: 'Order placed',
          },
        ];
      } else {
        // Sanitize history entries: only expose customer-safe fields
        orderObj.statusHistory = orderObj.statusHistory.map((h) => ({
          status: h.status,
          changedAt: h.changedAt,
          note: h.note || '',
        }));
      }

      // Customer Privacy: Never expose driver coordinates unless actively out_for_delivery
      if (orderObj.deliveryTracking) {
        if (typeof Order.sanitizeTrackingForCustomer === 'function') {
          orderObj.deliveryTracking = Order.sanitizeTrackingForCustomer(orderObj);
        } else if (orderObj.status !== 'out_for_delivery' || !orderObj.deliveryTracking.isLive) {
          orderObj.deliveryTracking = {
            isLive: false,
            currentLocation: null,
            startedAt: orderObj.deliveryTracking.startedAt || null,
            endedAt: orderObj.deliveryTracking.endedAt || null,
            endReason: orderObj.deliveryTracking.endReason || null,
            lastUpdatedAt: orderObj.deliveryTracking.lastUpdatedAt || null,
            status: orderObj.status,
          };
        }
      }

      // Strip sensitive handover OTP internals
      if (orderObj.deliveryOtp) {
        delete orderObj.deliveryOtp.codeDigest;
        delete orderObj.deliveryOtp.encryptedCode;
        delete orderObj.deliveryOtp.code;
      }

      return orderObj;
    });

    const order = sanitizedOrders.length > 0 ? sanitizedOrders[0] : null;

    return NextResponse.json(
      {
        success: true,
        order,
        orders: sanitizedOrders,
        pagination: {
          page,
          limit,
          totalOrders,
          totalPages,
          hasMore,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error while loading order history.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

// POST — Place an order (Mock/Test payment checkout)
export async function POST(request) {
  try {
    const session = await resolveSession();
    const body = await request.json();
    const { items, address, paymentMethod = '', notes = '' } = body;
    let idempotencyKey = request.headers.get('x-idempotency-key') || body.idempotencyKey || null;
    if (typeof idempotencyKey === 'string') {
      idempotencyKey = idempotencyKey.trim();
      if (!idempotencyKey) idempotencyKey = null;
    }

    if (!items || !items.length) {
      return NextResponse.json({ success: false, message: 'Cart items are required' }, { status: 400 });
    }

    if (!address || !address.fullName || !address.street || !address.phone) {
      return NextResponse.json({ success: false, message: 'Complete delivery address is required' }, { status: 400 });
    }

    if (!isValidPhone(address.phone)) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid 10-digit mobile contact number for delivery.' },
        { status: 400 }
      );
    }
    address.phone = normalizePhone(address.phone);

    if (address.recipientPhone) {
      if (!isValidPhone(address.recipientPhone)) {
        return NextResponse.json(
          { success: false, message: 'Please provide a valid 10-digit mobile number for the recipient.' },
          { status: 400 }
        );
      }
      address.recipientPhone = normalizePhone(address.recipientPhone);
    }

    // Canonical payment method allowlists (exact match after whitespace/case normalization)
    const CANONICAL_COD_METHODS = new Set([
      'cash on delivery (cod)',
      'cash on delivery',
      'cod',
    ]);

    const CANONICAL_COP_METHODS = new Set([
      'cash on pickup (cop)',
      'cash on pickup',
      'cop',
    ]);

    const CANONICAL_SIMULATOR_METHODS = new Set([
      'instant simulator (test mode)',
      'mock test payment',
    ]);

    // Exact Payment Method Validation & Production Security Gating
    const rawPaymentMethod = typeof paymentMethod === 'string' ? paymentMethod : '';
    const normalizedPaymentMethod = rawPaymentMethod.trim().toLowerCase().replace(/\s+/g, ' ');

    const isCod = CANONICAL_COD_METHODS.has(normalizedPaymentMethod);
    const isCop = CANONICAL_COP_METHODS.has(normalizedPaymentMethod);
    const isSimulator = CANONICAL_SIMULATOR_METHODS.has(normalizedPaymentMethod);

    // 1. Production security boundary: reject simulator unconditionally in production
    const isProd = process.env.NODE_ENV === 'production';
    const isSimulatorAllowed = !isProd && process.env.ENABLE_PAYMENT_SIMULATOR !== 'false';

    if (isSimulator) {
      if (!isSimulatorAllowed) {
        return NextResponse.json(
          {
            success: false,
            message: 'Developer payment simulator is strictly disabled in production environments. Please select an authorized payment method.',
          },
          { status: 403 }
        );
      }
    } else if (isCod) {
      if (body.orderType === 'pickup') {
        return NextResponse.json(
          {
            success: false,
            message: 'Cash on Delivery is only available for doorstep delivery orders. Please select Cash on Pickup.',
          },
          { status: 400 }
        );
      }
    } else if (isCop) {
      if (body.orderType !== 'pickup') {
        return NextResponse.json(
          {
            success: false,
            message: 'Cash on Pickup is only available for pickup orders. Please select Cash on Delivery or an authorized online payment method.',
          },
          { status: 400 }
        );
      }
    } else {
      // Unknown, malformed, empty, or unsupported payment method -> Fail closed
      return NextResponse.json(
        {
          success: false,
          message: 'Unsupported or invalid payment method. Orders placed through this endpoint must use Cash on Delivery, Cash on Pickup, or an authorized payment flow.',
        },
        { status: 400 }
      );
    }

    await connectDB();

    let userId = null;
    if (session?.user?.email) {
      const user = await User.findOne({ email: session.user.email });
      if (user) userId = user._id;
    }

    // Fallback: If client did not provide an idempotency key, compute a deterministic server-side key
    // bounded by user/phone, items, address, and a 1-minute bucket so rapid double-clicks are de-duplicated safely.
    if (!idempotencyKey) {
      const itemsFingerprint = (items || []).map((i) => `${i.product || i._id}_${i.variantName || 'def'}_${i.quantity}`).sort().join('|');
      const userFingerprint = userId?.toString() || address?.phone || 'anon';
      const timeBucket = Math.floor(Date.now() / 60000);
      idempotencyKey = `server_fallback_${crypto.createHash('sha256').update(`${userFingerprint}:${itemsFingerprint}:${address?.street || ''}:${timeBucket}`).digest('hex').substring(0, 32)}`;
    }

    // Authoritative Server-Side Checkout Calculation & Security Checks
    const calcResult = await calculateOrderDetails({
      items,
      orderType: body.orderType,
      couponCode: body.couponCode,
      address,
    });

    if (!calcResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: calcResult.code || 'CALCULATION_FAILED',
          message: calcResult.message,
          serviceability: calcResult.serviceability,
        },
        { status: calcResult.status || 400 }
      );
    }

    // Compute canonical payload hash to detect conflicting parameters on key reuse
    const canonicalPayload = {
      items: (calcResult.orders || []).map((o) => ({
        restaurantId: o.restaurantId?.toString(),
        items: (o.items || []).map((i) => ({
          product: (i.product?._id || i.product)?.toString(),
          quantity: i.quantity,
          price: i.price,
          variantName: i.variantName || null,
        })),
        totalAmount: o.totalAmount,
      })),
      address: {
        fullName: address.fullName?.trim()?.toLowerCase(),
        street: address.street?.trim()?.toLowerCase(),
        phone: address.phone?.trim(),
      },
    };
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');

    // Pre-check for existing orders placed with this idempotency key
    if (idempotencyKey) {
      const targetKeys = calcResult.orders.map((c) =>
        calcResult.orders.length > 1 ? `${idempotencyKey}_${c.restaurantId}` : idempotencyKey
      );
      const existingOrders = await Order.find({
        idempotencyKey: { $in: targetKeys },
      })
        .populate("restaurant", "name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings")
        .populate("user", "name email");

      if (existingOrders.length > 0) {
        // 1. Cross-user security check: key must belong to this user / phone
        for (const exist of existingOrders) {
          const isUserMatch = userId
            ? exist.user?._id?.toString() === userId.toString()
            : exist.address?.phone === address.phone;
          if (!isUserMatch) {
            return NextResponse.json(
              { success: false, message: "Idempotency key conflict: key belongs to another user account." },
              { status: 403 }
            );
          }

          // 2. Conflict check: reject key reuse with different cart/address/parameters
          if (exist.payloadHash && exist.payloadHash !== payloadHash) {
            return NextResponse.json(
              { success: false, message: "Idempotency key cannot be reused with different cart items, amounts, or checkout parameters." },
              { status: 409 }
            );
          }

          // 3. Never replay a cancelled order as a successful checkout
          if (exist.status === "cancelled") {
            return NextResponse.json(
              { success: false, message: "A previous order placed with this idempotency key was cancelled. Please submit a new checkout attempt." },
              { status: 409 }
            );
          }
        }

        if (existingOrders.length === calcResult.orders.length) {
          const hasCash = existingOrders.some((o) => {
            const pm = (o.paymentMethod || '').trim().toLowerCase().replace(/\s+/g, ' ');
            return CANONICAL_COD_METHODS.has(pm) || CANONICAL_COP_METHODS.has(pm) || pm.includes('cash');
          });

          // Refresh guest access token on replay for guest orders so the client receives an active token
          let replayGuestToken = undefined;
          if (!userId) {
            if (idempotencyKey) {
              replayGuestToken = deriveGuestAccessToken(idempotencyKey, "pet-protocols:guest-order-create");
            } else {
              replayGuestToken = generateGuestAccessToken();
            }
            const replayTokenHash = hashGuestAccessToken(replayGuestToken);
            const replayExpiresAt = computeGuestTokenExpiry();
            await Order.updateMany(
              { _id: { $in: existingOrders.map((o) => o._id) } },
              {
                $set: {
                  "guestAccess.tokenHash": replayTokenHash,
                  "guestAccess.issuedAt": new Date(),
                  "guestAccess.expiresAt": replayExpiresAt,
                  "guestAccess.isRevoked": false,
                },
              }
            );
          }

          return NextResponse.json(
            {
              success: true,
              message: hasCash
                ? "Order placed successfully with Cash payment!"
                : "Order placed successfully with Test Payment!",
              order: existingOrders[0],
              orders: existingOrders,
              guestAccessToken: replayGuestToken,
              idempotentReplay: true,
            },
            { status: 200 }
          );
        }
      }
    }

    const createdOrders = [];
    let isReplay = false;

    // Cryptographically secure guest-order access credential generation (256 bits entropy)
    let guestAccessToken = null;
    let guestAccessRecord = null;
    if (!userId) {
      if (idempotencyKey) {
        guestAccessToken = deriveGuestAccessToken(idempotencyKey, "pet-protocols:guest-order-create");
      } else {
        guestAccessToken = generateGuestAccessToken();
      }
      const tokenHash = hashGuestAccessToken(guestAccessToken);
      const expiresAt = computeGuestTokenExpiry();
      guestAccessRecord = {
        tokenHash,
        issuedAt: new Date(),
        expiresAt,
        isRevoked: false,
      };
    }

    for (const calcOrder of calcResult.orders) {
      const paymentStatus = isCod || isCop ? "pending" : (isSimulator ? "test_paid" : "failed");

      let finalPaymentMethod = paymentMethod;
      if (isCod) finalPaymentMethod = "Cash on Delivery (COD)";
      else if (isCop) finalPaymentMethod = "Cash on Pickup (COP)";
      else if (isSimulator) finalPaymentMethod = "Instant Simulator (Test Mode)";

      const scopedKey = calcResult.orders.length > 1
        ? `${idempotencyKey}_${calcOrder.restaurantId}`
        : idempotencyKey;

      let newOrder;
      let isExisting = false;

      try {
        newOrder = await Order.create({
          user: userId,
          ...(guestAccessRecord ? { guestAccess: guestAccessRecord } : {}),
          restaurant: calcOrder.restaurantId,
          items: calcOrder.items,
          address,
          subtotal: calcOrder.subtotal,
          deliveryFee: calcOrder.deliveryFee,
          discount: calcOrder.discount,
          couponCode: calcOrder.couponCode || "",
          totalAmount: calcOrder.totalAmount,
          paymentStatus,
          paymentMethod: finalPaymentMethod,
          status: "pending",
          orderType: body.orderType === "pickup" ? "pickup" : "delivery",
          deliveryDistanceKm: calcOrder.deliveryDistanceKm ?? null,
          notes: body.orderType === "pickup" ? `[PICKUP] ${notes}` : notes,
          idempotencyKey: scopedKey,
          payloadHash,
        });
      } catch (createErr) {
        if (createErr.code === 11000 && scopedKey) {
          // Concurrent duplicate submission caught by unique index
          newOrder = await Order.findOne({
            restaurant: calcOrder.restaurantId,
            idempotencyKey: scopedKey,
          });
          if (newOrder) {
            // Check cross-user collision
            const isUserMatch = userId
              ? newOrder.user?.toString() === userId.toString()
              : newOrder.address?.phone === address.phone;
            if (!isUserMatch) {
              return NextResponse.json(
                { success: false, message: "Idempotency key conflict: key belongs to another user account." },
                { status: 403 }
              );
            }
            // Check payload hash
            if (newOrder.payloadHash && newOrder.payloadHash !== payloadHash) {
              return NextResponse.json(
                { success: false, message: "Idempotency key cannot be reused with different cart items or parameters." },
                { status: 409 }
              );
            }
            // Reject cancelled order replay
            if (newOrder.status === "cancelled") {
              return NextResponse.json(
                { success: false, message: "Cannot replay a cancelled order as a successful checkout." },
                { status: 409 }
              );
            }

            isExisting = true;
            isReplay = true;
          } else {
            throw createErr;
          }
        } else {
          throw createErr;
        }
      }

      if (!isExisting) {
        // Deduct ingredient stock safely based on dish recipes
        const deductRes = await deductStockForOrder(newOrder);
        if (!deductRes.success) {
          // Rollback any orders created in this batch
          const cancelReasonMsg = `Inventory deduction failed: ${deductRes.message || 'Insufficient stock'}`;
          const currentOrderDoc = await Order.findById(newOrder._id);
          if (currentOrderDoc) {
            if (typeof currentOrderDoc.addStatusTransition === 'function') {
              currentOrderDoc.addStatusTransition(
                'cancelled',
                { role: 'system', name: 'Inventory System' },
                cancelReasonMsg
              );
            } else {
              currentOrderDoc.status = 'cancelled';
            }
            currentOrderDoc.set('cancellationReason', cancelReasonMsg, { strict: false });
            currentOrderDoc.notes = currentOrderDoc.notes
              ? `${currentOrderDoc.notes} | ${cancelReasonMsg}`
              : cancelReasonMsg;
            await currentOrderDoc.save();
          } else {
            await Order.findByIdAndUpdate(newOrder._id, {
              status: 'cancelled',
              cancellationReason: cancelReasonMsg,
            });
          }

          for (const prevOrder of createdOrders) {
            try {
              await restoreStockForOrder(prevOrder._id);
              const prevDoc = await Order.findById(prevOrder._id);
              if (prevDoc) {
                const multiCancelMsg = 'Cancelled due to item unavailability in multi-restaurant checkout';
                if (typeof prevDoc.addStatusTransition === 'function') {
                  prevDoc.addStatusTransition(
                    'cancelled',
                    { role: 'system', name: 'Inventory System' },
                    multiCancelMsg
                  );
                } else {
                  prevDoc.status = 'cancelled';
                }
                prevDoc.set('cancellationReason', multiCancelMsg, { strict: false });
                prevDoc.notes = prevDoc.notes
                  ? `${prevDoc.notes} | ${multiCancelMsg}`
                  : multiCancelMsg;
                await prevDoc.save();
              } else {
                await Order.findByIdAndUpdate(prevOrder._id, {
                  status: 'cancelled',
                  cancellationReason: 'Cancelled due to item unavailability in multi-restaurant checkout',
                });
              }
            } catch (_) {}
          }

          return NextResponse.json(
            {
              success: false,
              error: deductRes.message || "Insufficient stock to complete order. Please adjust your cart.",
              insufficientStock: deductRes.insufficientStock || false,
              missingRequirements: deductRes.missingRequirements || [],
            },
            { status: 400 }
          );
        }
      }

      const populatedOrder = await Order.findById(newOrder._id)
        .populate("restaurant", "name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings")
        .populate("user", "name email");

      createdOrders.push(populatedOrder);

      if (!isExisting) {
        // Dispatch Web Push notifications to customer and restaurant admins
        notifyOrderEvent(populatedOrder, 'order_placed').catch((e) =>
          console.warn("[Order Create Push] Non-blocking push warning:", e.message)
        );
        // Persist durable notification event to Outbox
        enqueueOrderEvents(populatedOrder, 'order_placed').catch((e) =>
          console.warn("[Order Create Outbox] Non-blocking outbox enqueue warning:", e.message)
        );
      }
    }

    let orderSuccessMsg = "Order placed successfully!";
    if (isCod) {
      orderSuccessMsg = "Order placed successfully with Cash on Delivery!";
    } else if (isCop) {
      orderSuccessMsg = "Order placed successfully with Cash on Pickup!";
    } else if (isSimulator) {
      orderSuccessMsg = "Order placed successfully with Test Payment!";
    }

    return NextResponse.json(
      {
        success: true,
        message: orderSuccessMsg,
        order: createdOrders[0],
        orders: createdOrders,
        guestAccessToken: guestAccessToken || undefined,
        idempotentReplay: isReplay,
      },
      { status: isReplay ? 200 : 201 }
    );

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH — Customer Order Cancellation
export async function PATCH(request) {
  try {
    const session = await resolveSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: 'Authentication required to cancel an order. For guest orders, please contact the kitchen branch directly.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId, reason = 'Cancelled by customer' } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Order ID is required' }, { status: 400 });
    }

    await connectDB();

    let order = await Order.findById(orderId).populate('restaurant');
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    let currentUser = null;
    if (session.user.email) {
      currentUser = await User.findOne({ email: session.user.email });
    }

    const isSuperadmin = session.user.role === 'superadmin';
    const isRestAdmin =
      session.user.role === 'restaurant_admin' &&
      order.restaurant?._id?.toString() === (session.user.restaurantId || session.user.restaurant)?.toString();
    const isCustomerOwner = Boolean(order.user && currentUser && order.user.toString() === currentUser._id.toString());

    if (!isSuperadmin && !isRestAdmin && !isCustomerOwner) {
      return NextResponse.json({ success: false, message: 'Not authorized to cancel this order.' }, { status: 403 });
    }

    // Check current order status
    const isRestorationIncomplete =
      !order.stockRestored &&
      (order.stockDeducted ||
        (Array.isArray(order.stockDeduction?.deductedIngredients) && order.stockDeduction.deductedIngredients.length > 0) ||
        order.stockDeduction?.status === 'partial_failed');

    const isRefundEligible =
      ['paid', 'refund_pending'].includes(order.paymentStatus) &&
      (order.paymentMethod?.toLowerCase().includes('razorpay') || order.paymentMethod?.toLowerCase().includes('online'));

    const isRefundIncomplete =
      isRefundEligible &&
      order.refundDetails?.status !== 'processed';

    if (order.status === 'cancelled') {
      if (!isRestorationIncomplete && !isRefundIncomplete) {
        return NextResponse.json({ success: false, message: 'Order is already cancelled' }, { status: 400 });
      }
      // If cancellation was previously interrupted, allow retry of restoration/refund without rejecting
    } else if (order.status !== 'pending') {
      return NextResponse.json({
        success: false,
        message: `Order cannot be cancelled because it is already ${order.status.replace(/_/g, ' ')}. Please contact the kitchen directly.`,
      }, { status: 400 });
    }

    // Check restaurant customer cancellation settings
    const cancelSettings = order.restaurant?.cancellationSettings || {};
    if (order.status !== 'cancelled') {
      if (cancelSettings.allowCustomerCancel === false && session?.user?.role !== 'superadmin') {
        return NextResponse.json({
          success: false,
          message: 'This restaurant does not allow self-cancellation. Please contact the kitchen directly.',
        }, { status: 400 });
      }

      // Check cancellation time window (default 1 minute)
      const windowMinutes = Number(cancelSettings.customerCancelWindowMinutes) || 1;
      const createdAtMs = new Date(order.createdAt).getTime();
      const elapsedMinutes = (Date.now() - createdAtMs) / (60 * 1000);

      // Provide a small 30-second grace buffer to handle network travel time
      const allowedWindowMinutes = windowMinutes + 0.5;

      if (elapsedMinutes > allowedWindowMinutes && session?.user?.role !== 'superadmin') {
        return NextResponse.json({
          success: false,
          message: `The ${windowMinutes}-minute cancellation window has passed. Please contact the kitchen directly.`,
        }, { status: 400 });
      }

      // Cancel order atomically to avoid racing against kitchen order acceptance
      const cancelNote = `Cancellation reason: ${reason}`;
      const cancelledDoc = await Order.findOneAndUpdate(
        {
          _id: order._id,
          status: 'pending',
        },
        {
          $set: {
            status: 'cancelled',
            notes: order.notes ? `${order.notes} | ${cancelNote}` : cancelNote,
          },
          $push: {
            statusHistory: {
              status: 'cancelled',
              changedAt: new Date(),
              changedBy: {
                userId: currentUser?._id,
                role: session.user?.role || 'customer',
                name: currentUser?.name || session.user?.name || 'Customer',
              },
              note: cancelNote,
            },
          },
          $inc: { __v: 1 },
        },
        { returnDocument: 'after' }
      );

      if (!cancelledDoc) {
        return NextResponse.json({
          success: false,
          conflict: true,
          message: 'Order status was modified concurrently. The order can no longer be self-cancelled.',
        }, { status: 409 });
      }

      order = cancelledDoc;
    }

    // Restore stock if previously deducted or partially deducted
    let stockRestorationResult = null;
    if (!order.stockRestored) {
      try {
        stockRestorationResult = await restoreStockForOrder(order);
      } catch (stockErr) {
        console.warn('[Order Cancel] Stock restore warning:', stockErr.message);
        stockRestorationResult = { success: false, error: stockErr.message };
      }
    }

    // Execute idempotent refund if order is eligible
    let refundResult = null;
    if (isRefundEligible) {
      if (order.refundDetails?.status !== 'processed') {
        try {
          refundResult = await executeOrderRefund({
            orderId: order._id,
            reason: `Customer cancellation: ${reason}`,
            initiatedBy: 'customer',
          });
        } catch (refErr) {
          console.warn('[Order Cancel] Refund warning:', refErr.message);
          refundResult = { success: false, error: refErr.message };
        }
      } else {
        refundResult = { success: true, alreadyRefunded: true };
      }
    } else if (order.paymentStatus === 'reconciliation_required' || order.refundDetails?.status === 'reconciliation_required') {
      refundResult = {
        success: false,
        status: 'reconciliation_required',
        requiresManualReconciliation: true,
        message: 'Order is in reconciliation_required state. Refund redispatch is prohibited during cancellation.',
      };
    }

    // Dispatch push notifications to customer and restaurant admins
    notifyOrderEvent(order, 'order_cancelled_by_customer', { reason }).catch(() => {});
    // Persist durable cancellation event to Outbox
    enqueueOrderEvents(order, 'status_update', { status: 'cancelled', reason, notifyRestaurant: true }).catch(() => {});

    const updatedOrder = await Order.findById(order._id);

    let refundMsg = 'Order cancelled successfully.';
    if (refundResult) {
      if (refundResult.success) {
        refundMsg = 'Order cancelled and refund processed successfully.';
      } else if (refundResult.requiresManualReconciliation || refundResult.status === 'reconciliation_required') {
        refundMsg = 'Order cancelled. Refund outcome is uncertain and has been queued for manual reconciliation.';
      } else if (refundResult.status === 'refund_pending') {
        refundMsg = 'Order cancelled. Refund is pending and has been queued for processing.';
      } else if (refundResult.inProgress) {
        refundMsg = 'Order cancelled. Refund is currently processing.';
      } else if (refundResult.status === 'failed') {
        refundMsg = `Order cancelled, but refund failed: ${refundResult.error || refundResult.message}. Staff alerted.`;
      }
    }

    if (stockRestorationResult && !stockRestorationResult.success && !stockRestorationResult.alreadyRestored) {
      return NextResponse.json({
        success: true,
        orderCancelled: true,
        inventoryRestored: false,
        refund: refundResult,
        message: stockRestorationResult.requiresManualReconciliation
          ? 'Order cancelled, but inventory requires manual reconciliation.'
          : stockRestorationResult.inProgress
          ? 'Order cancelled, but inventory restoration is currently in progress.'
          : 'Order cancelled, but inventory restoration was incomplete. Kitchen staff has been alerted.',
        order: updatedOrder,
        stockRestoration: stockRestorationResult,
      });
    }

    return NextResponse.json({
      success: true,
      orderCancelled: true,
      inventoryRestored: true,
      refund: refundResult,
      message: refundMsg,
      order: updatedOrder,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}