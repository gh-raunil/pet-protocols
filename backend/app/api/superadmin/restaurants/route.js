import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Restaurant from "@/models/Restaurant";
import User from "@/models/User";
import Product from "@/models/Product";
import Order from "@/models/Order";
import { requireSuperAdmin } from "@/lib/authMiddleware";
import bcrypt from "bcryptjs";

// GET — List all restaurants (Tenants)
export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();
    const restaurants = await Restaurant.find().sort({ createdAt: -1 }).lean();

    // Attach counts for admins, products, orders
    const enriched = await Promise.all(
      restaurants.map(async (r) => {
        const [adminCount, productCount, orderCount] = await Promise.all([
          User.countDocuments({ restaurant: r._id, role: { $in: ["restaurant_admin", "admin"] } }),
          Product.countDocuments({ restaurant: r._id }),
          Order.countDocuments({ restaurant: r._id }),
        ]);
        return {
          ...r,
          adminCount,
          productCount,
          orderCount,
        };
      })
    );

    return NextResponse.json({ success: true, restaurants: enriched });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Create a new restaurant (with its first admin)
export async function POST(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      name,
      slug,
      description,
      cuisineType,
      address,
      phone,
      email,
      image,
      adminName,
      adminEmail,
      adminPassword,
    } = body;

    if (!name || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { success: false, message: "Restaurant name, first admin name, email, and password are required." },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if admin email is already registered
    const existingUser = await User.findOne({ email: adminEmail.toLowerCase().trim() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "An account with this admin email already exists." },
        { status: 400 }
      );
    }

    // Generate or validate slug
    let generatedSlug = slug
      ? slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const existingRestaurant = await Restaurant.findOne({ slug: generatedSlug });
    if (existingRestaurant) {
      generatedSlug = `${generatedSlug}-${Date.now().toString().slice(-4)}`;
    }

    // Create Restaurant
    const restaurant = await Restaurant.create({
      name: name.trim(),
      slug: generatedSlug,
      description: description || `Welcome to ${name.trim()} on Pet Protocols`,
      cuisineType: Array.isArray(cuisineType) ? cuisineType : cuisineType ? [cuisineType] : ["Fast Food"],
      address: address || {},
      phone: phone || "",
      email: email || "",
      image: image || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500",
      status: "active",
    });

    // Create First Admin
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const firstAdmin = await User.create({
      name: adminName.trim(),
      email: adminEmail.toLowerCase().trim(),
      password: hashedPassword,
      role: "restaurant_admin",
      restaurant: restaurant._id,
      status: "active",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Restaurant and first admin created successfully!",
        restaurant,
        admin: {
          id: firstAdmin._id,
          name: firstAdmin.name,
          email: firstAdmin.email,
          role: firstAdmin.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
