import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Cart from '@/models/Cart'
import User from '@/models/User'

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
};

// GET — fetch user's cart
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ success: true, items: [] }, { headers: NO_CACHE_HEADERS })
    }

    await connectDB()

    const user = await User.findOne({ email: session.user.email.toLowerCase() })

    if (!user) return NextResponse.json({ success: true, items: [] }, { headers: NO_CACHE_HEADERS })

    const cart = await Cart.findOne({ user: user._id })

    return NextResponse.json({
      success: true,
      items: cart?.items || []
    }, { headers: NO_CACHE_HEADERS })

  } catch (error) {
    console.error('Cart GET error:', error.message)
    return NextResponse.json({ success: true, items: [] }, { headers: NO_CACHE_HEADERS })
  }
}

// POST — save cart
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Not logged in' }, { status: 401, headers: NO_CACHE_HEADERS })
    }

    const body = await request.json()
    const { items } = body

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ success: false, message: 'Items array is required' }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    await connectDB()

    const user = await User.findOne({ email: session.user.email.toLowerCase() })
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS })

    const updatedCart = await Cart.findOneAndUpdate(
      { user: user._id },
      { $set: { items } },
      { upsert: true, returnDocument: 'after' }
    )

    return NextResponse.json({ success: true, items: updatedCart?.items || [] }, { headers: NO_CACHE_HEADERS })

  } catch (error) {
    console.error('Cart POST error:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}

// DELETE — clear cart
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ success: false, message: 'Not logged in' }, { status: 401, headers: NO_CACHE_HEADERS })

    await connectDB()
    const user = await User.findOne({ email: session.user.email.toLowerCase() })
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS })

    await Cart.findOneAndUpdate(
      { user: user._id },
      { $set: { items: [] } },
      { upsert: true }
    )

    return NextResponse.json({ success: true, items: [] }, { headers: NO_CACHE_HEADERS })

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}