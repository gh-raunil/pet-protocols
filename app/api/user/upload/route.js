import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image')

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No image provided' },
        { status: 400 }
      )
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder: 'pet-protocols/avatars',
      transformation: [
        { width: 200, height: 200, crop: 'fill', gravity: 'face' }
      ]
    })

    return NextResponse.json({
      success: true,
      imageUrl: result.secure_url
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}