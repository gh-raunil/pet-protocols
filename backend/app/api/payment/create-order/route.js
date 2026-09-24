import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(request) {
  try {
    const { amount } = await request.json();

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid order amount' },
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

    const order = await razorpay.orders.create({
      amount: Math.round(numericAmount * 100), // amount in paise
      currency: 'INR',
      receipt: `rcpt_${Date.now().toString().slice(-8)}`,
    });

    return NextResponse.json({
      success: true,
      order,
      keyId: key_id,
    });

  } catch (error) {
    console.error('Razorpay order creation error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Failed to create payment order. Please try again.' },
      { status: 500 }
    );
  }
}