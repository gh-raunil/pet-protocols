import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/db'
import Product from '@/models/Product'

// GET single product
export async function GET(request, { params }) {
  try {
    const { id } = await params  // ← await params in Next.js 16
    await connectDB()
    const product = await Product.findById(id)
    if (!product) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 })
    return NextResponse.json({ success: true, product })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// UPDATE product
export async function PUT(request, { params }) {
  try {
    const { id } = await params  // ← await params
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    const body = await request.json()
    await connectDB()

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: false }
    )

    if (!product) {
      return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, product })

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE product
export async function DELETE(request, { params }) {
  try {
    const { id } = await params  // ← await params
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    await connectDB()
    await Product.findByIdAndDelete(id)
    return NextResponse.json({ success: true, message: 'Product deleted' })

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}