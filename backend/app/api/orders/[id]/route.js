import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Order from '@/models/Order';
import User from '@/models/User';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  hashGuestAccessToken,
  extractGuestAccessToken,
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

function sanitizeOrderForCustomer(orderDoc) {
  if (!orderDoc) return null;
  const orderObj = typeof orderDoc.toObject === 'function' ? orderDoc.toObject() : { ...orderDoc };

  // 1. Sanitize status progression history
  if (!Array.isArray(orderObj.statusHistory) || orderObj.statusHistory.length === 0) {
    orderObj.statusHistory = [
      {
        status: orderObj.status || 'pending',
        changedAt: orderObj.createdAt || new Date(),
        note: 'Order placed',
      },
    ];
  } else {
    orderObj.statusHistory = orderObj.statusHistory.map((h) => ({
      status: h.status,
      changedAt: h.changedAt,
      note: h.note || '',
    }));
  }

  // 2. Sanitize live delivery tracking — never expose driver coordinates unless actively out_for_delivery
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

  // 3. Strict security: never expose OTP digest, encrypted hashes, or secrets
  if (orderObj.deliveryOtp) {
    delete orderObj.deliveryOtp.codeDigest;
    delete orderObj.deliveryOtp.encryptedCode;
    delete orderObj.deliveryOtp.code;
  }

  // 4. Strict security: never expose internal guest token hashes
  if (orderObj.guestAccess) {
    delete orderObj.guestAccess.tokenHash;
  }

  return orderObj;
}

/**
 * GET — Authenticated Dedicated Order Details & Multi-Restaurant Sibling Resolver
 * Route: /api/orders/[id]
 */
export async function GET(request, { params }) {
  try {
    const session = await resolveSession();
    const guestToken = extractGuestAccessToken(request);

    if (!session?.user && !guestToken) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Please log in or provide guest access token.' },
        { status: 401 }
      );
    }

    const resolvedParams = params ? await params : {};
    const { id } = resolvedParams;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return NextResponse.json(
        { success: false, message: 'Order ID is required.' },
        { status: 400 }
      );
    }

    const cleanId = id.trim();

    await connectDB();

    const isObjectId = cleanId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanId);
    const orderIdentifierFilter = {
      $or: [
        { orderId: cleanId },
        ...(isObjectId ? [{ _id: cleanId }] : []),
      ],
    };

    let ownershipFilter = {};

    if (session?.user?.role === 'superadmin') {
      ownershipFilter = {};
    } else if (session?.user?.role === 'restaurant_admin' || session?.user?.role === 'staff') {
      const restId = (session.user.restaurantId || session.user.restaurant)?.toString();
      if (!restId) {
        return NextResponse.json(
          { success: false, message: 'Access denied: staff account is not assigned to an active restaurant.' },
          { status: 403 }
        );
      }
      ownershipFilter = { restaurant: restId };
    } else if (session?.user) {
      // Customer: ownership strictly enforced against verified user identity
      const user = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!user) {
        return NextResponse.json(
          { success: false, message: 'Customer account not found.' },
          { status: 404 }
        );
      }
      // Never allow phone matching against guest orders.
      if (guestToken) {
        ownershipFilter = {
          $or: [
            { user: user._id },
            buildGuestOrderQuery(hashGuestAccessToken(guestToken)),
          ],
        };
      } else {
        ownershipFilter = { user: user._id };
      }
    } else {
      // Guest: authorized strictly via validated guest access token
      ownershipFilter = buildGuestOrderQuery(hashGuestAccessToken(guestToken));
    }

    // Query primary order document with ownership isolation in database query
    const targetOrder = await Order.findOne({
      $and: [orderIdentifierFilter, ownershipFilter],
    })
      .populate('restaurant', 'name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings')
      .populate('user', 'name email');

    if (!targetOrder) {
      // Not found or unauthorized: strictly 404 without leaking existence of another user's order
      return NextResponse.json(
        { success: false, message: 'Order not found.' },
        { status: 404 }
      );
    }

    // Multi-restaurant parent/sub-order resolution: find all sibling orders sharing the same non-empty orderId or paymentId
    const siblingConditions = [
      ...(targetOrder.orderId && typeof targetOrder.orderId === 'string' && targetOrder.orderId.trim()
        ? [{ orderId: targetOrder.orderId.trim() }]
        : []),
      ...(targetOrder.paymentId && typeof targetOrder.paymentId === 'string' && targetOrder.paymentId.trim()
        ? [{ paymentId: targetOrder.paymentId.trim() }]
        : []),
    ];

    let siblingOrders = [targetOrder];
    if (siblingConditions.length > 0) {
      const siblingFilter = {
        $and: [
          ownershipFilter,
          { $or: siblingConditions },
        ],
      };

      siblingOrders = await Order.find(siblingFilter)
        .populate('restaurant', 'name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings')
        .populate('user', 'name email')
        .sort({ createdAt: -1, _id: -1 });
    }

    const sanitizedTarget = sanitizeOrderForCustomer(targetOrder);
    const sanitizedSiblings = siblingOrders.map(sanitizeOrderForCustomer);

    return NextResponse.json(
      {
        success: true,
        order: sanitizedTarget,
        subOrders: sanitizedSiblings,
        isMultiRestaurant: sanitizedSiblings.length > 1,
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error while fetching order details.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}
