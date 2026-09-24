import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import User from '@/models/User'

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    const { name, phone, image } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, message: 'Name is required' },
        { status: 400 }
      )
    }

    await connectDB()

    const updatedUser = await User.findOneAndUpdate(
      { email: session.user.email },
      {
        name: name.trim(),
        ...(phone && { phone }),
        ...(image && { image }),
      },
      { new: true }
    )

    return NextResponse.json({
      success: true,
      user: {
        name: updatedUser.name,
        image: updatedUser.image,
        phone: updatedUser.phone,
      }
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}