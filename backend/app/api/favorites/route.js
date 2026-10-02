import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Product from '@/models/Product';
import Restaurant from '@/models/Restaurant';

// GET — Fetch the authenticated user's individual favorites
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ success: true, favorites: [] });
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
      return NextResponse.json({ success: true, favorites: [] });
    }

    // Filter out any null products if they were deleted
    const validFavorites = (user.favorites || []).filter((p) => p && p._id);

    return NextResponse.json({
      success: true,
      favorites: validFavorites,
    });
  } catch (error) {
    console.error('Favorites GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message, favorites: [] },
      { status: 500 }
    );
  }
}

// POST — Toggle a product in the authenticated user's individual favorites
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Please sign in to save your personal favorites.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, message: 'Product ID is required.' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    if (!Array.isArray(user.favorites)) {
      user.favorites = [];
    }

    const pIdStr = productId.toString();
    const exists = user.favorites.some((id) => id.toString() === pIdStr);

    if (exists) {
      // Remove from individual favorites
      user.favorites = user.favorites.filter((id) => id.toString() !== pIdStr);
    } else {
      // Add to individual favorites
      user.favorites.unshift(productId);
    }

    await user.save();

    // Populate for fresh return payload
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
    });
  } catch (error) {
    console.error('Favorites POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
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
        { status: 401 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email.toLowerCase() });
    if (user) {
      user.favorites = [];
      await user.save();
    }

    return NextResponse.json({ success: true, favorites: [] });
  } catch (error) {
    console.error('Favorites DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
