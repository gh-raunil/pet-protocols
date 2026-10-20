import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import User from '@/models/User'
import { isValidPhone, normalizePhone } from '@/lib/validation'

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
    }

    const { name, phone, image } = await request.json().catch(() => ({}))

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, message: 'Name is required' },
        { status: 400 }
      )
    }

    let normalizedPhone = undefined
    if (phone !== undefined) {
      const trimmedPhone = String(phone).trim()
      if (trimmedPhone) {
        if (!isValidPhone(trimmedPhone)) {
          return NextResponse.json(
            { success: false, message: 'Please enter a valid 10-digit mobile contact number.' },
            { status: 400 }
          )
        }
        normalizedPhone = normalizePhone(trimmedPhone)
      } else {
        normalizedPhone = ''
      }
    }

    await connectDB()

    const updatedUser = await User.findOneAndUpdate(
      { email: session.user.email },
      {
        name: name.trim(),
        ...(normalizedPhone !== undefined && { phone: normalizedPhone }),
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