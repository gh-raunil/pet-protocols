import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Order from '@/models/Order'
import User from '@/models/User'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectDB()

    // Find user by email
    const user = await User.findOne({ email: session.user.email })

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    // Fetch orders for this user, newest first
    const orders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 })

    return NextResponse.json({ success: true, orders })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}