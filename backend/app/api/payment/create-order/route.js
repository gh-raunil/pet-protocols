import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import connectDB from '@/lib/db';
import PaymentIntent from '@/models/PaymentIntent';
import User from '@/models/User';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateOrderDetails } from '@/lib/checkoutCalculationService';
import { checkPaymentCreateOrderRateLimit } from '@/lib/rateLimit';

export async function POST(request) {
  try {
    const body = await request.json();
    const { items, address, notes = '', orderType, couponCode } = body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Cart items are required to create payment order.' },
        { status: 400 }
      );
    }

    await connectDB();

    // SEC-05: Authenticated identity verified server-side only
    const session = await getServerSession(authOptions);
    let verifiedUserId = null;
    if (session?.user?.email) {
      const dbUser = await User.findOne({ email: session.user.email }).lean();
      if (dbUser) verifiedUserId = dbUser._id;
    }

    // SEC-RL: Rate Limiting Protection (User: 15/5m, IP: 25/5m)
    const rateLimit = await checkPaymentCreateOrderRateLimit(verifiedUserId ? verifiedUserId.toString() : null, request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          message: `Too many payment order attempts. Please wait ${rateLimit.resetInSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetInSeconds),
          },
        }
      );
    }

    // Authoritative Server-Side Checkout Calculation & Security Checks
    const calcResult = await calculateOrderDetails({
      items,
      orderType,
      couponCode,
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

    const authoritativePaise = Math.round(calcResult.totalAmount * 100);
    if (authoritativePaise <= 0) {
      return NextResponse.json(
        { success: false, message: 'Total payable amount must be greater than zero.' },
        { status: 400 }
      );
    }

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      console.error('Razorpay order creation failed: Razorpay credentials are not configured on server.');
      return NextResponse.json(
        { success: false, message: 'Payment service is currently unavailable. Please contact support.' },
        { status: 503 }
      );
    }

    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });

    const receipt = `rcpt_${Date.now().toString().slice(-8)}`;
    const order = await razorpay.orders.create({
      amount: authoritativePaise, // authoritative server-calculated amount in paise
      currency: 'INR',
      receipt,
    });

    // SEC-01: Persist server-controlled binding to Razorpay order ID
    await PaymentIntent.create({
      razorpayOrderId: order.id,
      amount: calcResult.totalAmount,
      amountPaise: authoritativePaise,
      currency: 'INR',
      status: 'created',
      user: verifiedUserId,
      address: address || {},
      notes: notes || '',
      orderType: orderType || 'delivery',
      calcResult: {
        subtotal: calcResult.subtotal,
        deliveryFee: calcResult.deliveryFee,
        discount: calcResult.discount,
        couponCode: calcResult.couponCode,
        totalAmount: calcResult.totalAmount,
        orders: calcResult.orders,
      },
      receipt,
    });

    return NextResponse.json({
      success: true,
      order,
      keyId: key_id,
      authoritativeAmount: calcResult.totalAmount,
    });

  } catch (error) {
    console.error('Razorpay order creation error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Failed to create payment order. Please try again.' },
      { status: 500 }
    );
  }
}