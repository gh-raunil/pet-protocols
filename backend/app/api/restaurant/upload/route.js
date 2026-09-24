import { NextResponse } from 'next/server';
import { requireRestaurantAdmin } from '@/lib/authMiddleware';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validate actual binary file signature (magic numbers)
 */
function detectImageMimeType(buf) {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF (bytes 0-3) + file size (bytes 4-7) + WEBP (bytes 8-11)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export async function POST(request) {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const formData = await request.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, message: 'No image file provided. Please select a valid photo.' },
        { status: 400 }
      );
    }

    // 1. Validate file extension if filename is present
    if (file.name) {
      const extMatch = file.name.match(/\.[0-9a-z]+$/i);
      const ext = extMatch ? extMatch[0].toLowerCase() : '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid file extension. Only JPG, JPEG, PNG, and WebP images are allowed.',
          },
          { status: 400 }
        );
      }
    }

    // 2. Validate declared MIME type
    if (file.type && !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid image format. Only JPEG, PNG, and WebP images are allowed.',
        },
        { status: 400 }
      );
    }

    // 3. Validate file size (Max 5 MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: 'File size exceeds 5 MB limit. Please upload an image under 5 MB.',
        },
        { status: 400 }
      );
    }

    // Read bytes into buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: 'File size exceeds 5 MB limit. Please upload an image under 5 MB.',
        },
        { status: 400 }
      );
    }

    // 4. Validate actual binary format via magic bytes
    const detectedMime = detectImageMimeType(buffer);
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid image format. Only JPEG, PNG, and WebP images are allowed.',
        },
        { status: 400 }
      );
    }

    const base64 = `data:${detectedMime};base64,${buffer.toString('base64')}`;

    // Upload to Cloudinary if keys are present
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const result = await cloudinary.uploader.upload(base64, {
          folder: 'pet-protocols/dishes',
          transformation: [
            { width: 800, height: 600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
          ]
        });

        return NextResponse.json({
          success: true,
          imageUrl: result.secure_url,
          message: 'Image uploaded successfully'
        });
      } catch (cloudinaryErr) {
        console.error('Cloudinary upload error:', cloudinaryErr?.message || cloudinaryErr);
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            { success: false, message: 'Image upload service failed. Please try again later.' },
            { status: 502 }
          );
        }
        // Fallback to base64 only in local development
        return NextResponse.json({
          success: true,
          imageUrl: base64,
          message: 'Image processed successfully (development fallback)'
        });
      }
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, message: 'Image upload service is currently unavailable.' },
        { status: 503 }
      );
    }

    // Fallback if no cloudinary configured (development only)
    return NextResponse.json({
      success: true,
      imageUrl: base64,
      message: 'Image processed successfully (development fallback)'
    });

  } catch (error) {
    console.error('Restaurant image upload error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred while uploading the image. Please try again.' },
      { status: 500 }
    );
  }
}
