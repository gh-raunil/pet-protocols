import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

export async function POST(request) {
  try {
    const { amount } = await request.json()

    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay uses paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    })

    return NextResponse.json({ success: true, order })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}