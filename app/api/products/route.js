import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/db'
import Product from '@/models/Product'

// GET all products
export async function GET(request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const type = searchParams.get('type')

    let filter = {}

    if (category) filter.category = category
    if (type) filter.type = type
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ]
    }

    const products = await Product.find(filter)
    return NextResponse.json({ success: true, products })

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST — add new product
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    await connectDB()

    const product = await Product.create(body)
    return NextResponse.json({ success: true, product }, { status: 201 })

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}