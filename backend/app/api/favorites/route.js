import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Product from '@/models/Product';
import Restaurant from '@/models/Restaurant';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
};

// GET — Fetch the authenticated user's individual favorites
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: true, favorites: [] }, { headers: NO_CACHE_HEADERS });
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email.toLowerCase() }).populate({
      path: 'favorites',
      model: Product,
      populate: {
        path: 'restaurant',
        model: Restaurant,
        select: 'name deliverySettings chargeSettings regionalSettings',
      },
    });

    if (!user) {
      return NextResponse.json({ success: true, favorites: [] }, { headers: NO_CACHE_HEADERS });
    }

    // Filter out any null products if they were deleted
    const validFavorites = (user.favorites || []).filter((p) => p && p._id);

    return NextResponse.json({
      success: true,
      favorites: validFavorites,
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Favorites GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message, favorites: [] },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

// POST — Toggle a product or batch-merge guest favorites for the authenticated user
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Please sign in to save your personal favorites.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const body = await request.json();
    const { productId, productIds } = body;

    if (!productId && (!Array.isArray(productIds) || productIds.length === 0)) {
      return NextResponse.json(
        { success: false, message: 'Product ID or productIds array is required.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    if (!Array.isArray(user.favorites)) {
      user.favorites = [];
    }

    // Batch merge (e.g. guest favorites migrated on user login)
    if (Array.isArray(productIds) && productIds.length > 0) {
      for (const pId of productIds) {
        if (!pId) continue;
        const pIdStr = pId.toString();
        if (!user.favorites.some((id) => id.toString() === pIdStr)) {
          user.favorites.unshift(pId);
        }
      }
      await user.save();
      await user.populate({
        path: 'favorites',
        model: Product,
        populate: {
          path: 'restaurant',
          model: Restaurant,
          select: 'name deliverySettings chargeSettings regionalSettings',
        },
      });
      const validFavorites = (user.favorites || []).filter((p) => p && p._id);
      return NextResponse.json({
        success: true,
        favorites: validFavorites,
        message: 'Favorites merged successfully',
      }, { headers: NO_CACHE_HEADERS });
    }

    // Single item toggle
    const pIdStr = productId.toString();
    const exists = user.favorites.some((id) => id.toString() === pIdStr);

    if (exists) {
      user.favorites = user.favorites.filter((id) => id.toString() !== pIdStr);
    } else {
      user.favorites.unshift(productId);
    }

    await user.save();

    await user.populate({
      path: 'favorites',
      model: Product,
      populate: {
        path: 'restaurant',
        model: Restaurant,
        select: 'name deliverySettings chargeSettings regionalSettings',
      },
    });

    const isFavNow = !exists;
    const validFavorites = (user.favorites || []).filter((p) => p && p._id);

    return NextResponse.json({
      success: true,
      isFavorite: isFavNow,
      favorites: validFavorites,
      message: isFavNow ? 'Added to your favorites' : 'Removed from your favorites',
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Favorites POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

// DELETE — Clear all favorites for the authenticated user
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Please sign in.' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email.toLowerCase() });
    if (user) {
      user.favorites = [];
      await user.save();
    }

    return NextResponse.json({ success: true, favorites: [] }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Favorites DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
