import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Product from '@/models/Product';
import Restaurant from '@/models/Restaurant';

import Category from '@/models/Category';

// Helper function to slugify text
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GET all products (multi-tenant aware)
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const restaurantId = searchParams.get('restaurant') || searchParams.get('restaurantId');
    const isFeatured = searchParams.get('isFeatured');

    // Find active restaurants first
    const activeRestaurants = await Restaurant.find({ status: 'active' }).select('_id');
    const activeRestaurantIds = activeRestaurants.map(r => r._id);

    let filter = {
      restaurant: { $in: activeRestaurantIds }
    };

    if (restaurantId && restaurantId !== 'all') {
      if (restaurantId.length === 24 && /^[0-9a-fA-F]{24}$/.test(restaurantId)) {
        filter.restaurant = restaurantId;
      } else {
        const foundRest = await Restaurant.findOne({ slug: restaurantId });
        if (foundRest) {
          filter.restaurant = foundRest._id;
        }
      }
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (isFeatured === 'true') {
      filter.isFeatured = true;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      // Find any active restaurants matching the search query by name, slug, or cuisine
      const matchingRestaurants = await Restaurant.find({
        status: 'active',
        $or: [
          { name: { $regex: searchRegex } },
          { slug: { $regex: searchRegex } },
          { cuisineType: { $in: [searchRegex] } },
        ]
      }).select('_id');
      const matchingRestaurantIds = matchingRestaurants.map(r => r._id);

      // Search matches dishes by name, description, category OR brings all dishes of any matching restaurant
      filter.$or = [
        { name: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { category: { $regex: searchRegex } },
        ...(matchingRestaurantIds.length > 0 ? [{ restaurant: { $in: matchingRestaurantIds } }] : [])
      ];
    }

    const products = await Product.find(filter)
      .populate('restaurant', 'name slug status rating image')
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, products });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — add new product (Admin / Superadmin)
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['admin', 'restaurant_admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    // If restaurant_admin, force product restaurant to be session user's restaurant
    if (session.user.role === 'restaurant_admin') {
      body.restaurant = session.user.restaurantId;
    }

    if (!body.restaurant) {
      return NextResponse.json({ success: false, message: 'Restaurant ID is required' }, { status: 400 });
    }

    const product = await Product.create(body);

    // Auto-register newly launched category in Category model if not already present
    if (body.category && typeof body.category === 'string') {
      const cleanCat = body.category.trim();
      try {
        const existingCat = await Category.findOne({
          name: { $regex: `^${cleanCat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        });
        if (!existingCat) {
          await Category.create({
            name: cleanCat,
            slug: slugify(cleanCat),
            icon: '🍽️',
            description: `Fresh dishes in ${cleanCat}`,
            restaurant: body.restaurant,
            isActive: true
          });
        }
      } catch (catErr) {
        console.warn('Could not auto-register category:', catErr.message);
      }
    }

    return NextResponse.json({ success: true, product }, { status: 201 });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}