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

    const body = await request.json().catch(() => ({}))
    const { name, phone, image } = body

    const updateFields = {}

    if (name !== undefined) {
      const trimmedName = String(name).trim()
      if (!trimmedName) {
        return NextResponse.json(
          { success: false, message: 'Name cannot be empty' },
          { status: 400 }
        )
      }
      updateFields.name = trimmedName
    }

    if (phone !== undefined) {
      const trimmedPhone = String(phone).trim()
      if (trimmedPhone) {
        if (!isValidPhone(trimmedPhone)) {
          return NextResponse.json(
            { success: false, message: 'Please enter a valid 10-digit mobile contact number.' },
            { status: 400 }
          )
        }
        updateFields.phone = normalizePhone(trimmedPhone)
      } else {
        updateFields.phone = ''
      }
    }

    if (image !== undefined) {
      updateFields.image = image ? String(image).trim() : ''
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No fields provided to update.' },
        { status: 400 }
      )
    }

    await connectDB()

    const updatedUser = await User.findOneAndUpdate(
      { email: session.user.email },
      updateFields,
      { new: true }
    )

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

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

export const PUT = PATCH;

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 })
    }

    await connectDB()

    const updatedUser = await User.findOneAndUpdate(
      { email: session.user.email },
      { image: '' },
      { new: true }
    )

    return NextResponse.json({
      success: true,
      message: 'Profile image removed successfully',
      user: {
        name: updatedUser?.name,
        image: '',
        phone: updatedUser?.phone,
      }
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}