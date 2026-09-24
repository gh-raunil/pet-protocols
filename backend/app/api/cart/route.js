import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Cart from '@/models/Cart'
import User from '@/models/User'

// GET — fetch user's cart
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    console.log('GET session:', session?.user?.email)

    if (!session?.user?.email) {
      return NextResponse.json({ success: true, items: [] })
    }

    await connectDB()

    const user = await User.findOne({ email: session.user.email })
    console.log('GET user:', user?._id)

    if (!user) return NextResponse.json({ success: true, items: [] })

    const cart = await Cart.findOne({ user: user._id })
    console.log('GET cart items:', cart?.items?.length || 0)

    return NextResponse.json({
      success: true,
      items: cart?.items || []
    })

  } catch (error) {
    console.error('GET error:', error.message)
    return NextResponse.json({ success: true, items: [] })
  }
}

// POST — save cart
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    console.log('POST session:', session?.user?.email)

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'Not logged in' }, { status: 401 })
    }

    const body = await request.json()
    const { items } = body

    if (!items) {
      return NextResponse.json({ success: false, message: 'No items' }, { status: 400 })
    }

    await connectDB()

    const user = await User.findOne({ email: session.user.email })
    if (!user) return NextResponse.json({ success: false }, { status: 404 })

    await Cart.findOneAndUpdate(
      { user: user._id },
      { $set: { items } },
      { upsert: true, returnDocument: 'after' }
    )

    console.log('POST saved:', items.length, 'items for', user.email)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('POST error:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE — clear cart
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ success: false }, { status: 401 })

    await connectDB()
    const user = await User.findOne({ email: session.user.email })
    if (!user) return NextResponse.json({ success: false }, { status: 404 })

    await Cart.findOneAndUpdate(
      { user: user._id },
      { $set: { items: [] } },
      { upsert: true }
    )

    console.log('Cart cleared for:', user.email)
    return NextResponse.json({ success: true })

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}