import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Restaurant from "@/models/Restaurant";
import { requireSuperAdmin } from "@/lib/authMiddleware";
import bcrypt from "bcryptjs";

// GET — List all restaurant admins
export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();
    const admins = await User.find({
      role: { $in: ["restaurant_admin", "admin"] },
    })
      .populate("restaurant", "name slug status")
      .select("-password")
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, admins });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Add an admin user to a restaurant
export async function POST(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { restaurantId, name, email, password, role = "restaurant_admin" } = body;

    if (!restaurantId || !name || !email || !password) {
      return NextResponse.json(
        { success: false, message: "Restaurant, Name, Email, and Password are all required." },
        { status: 400 }
      );
    }

    await connectDB();

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, message: "Selected restaurant not found." }, { status: 404 });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const configuredSuperadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
    if (configuredSuperadminEmail && normalizedEmail === configuredSuperadminEmail) {
      return NextResponse.json(
        { success: false, message: "Cannot create restaurant admin with the dedicated Super Admin email." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newAdmin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "restaurant_admin",
      restaurant: restaurant._id,
      status: "active",
    });

    return NextResponse.json(
      {
        success: true,
        message: `Admin user added successfully to ${restaurant.name}!`,
        admin: {
          _id: newAdmin._id,
          name: newAdmin.name,
          email: newAdmin.email,
          role: newAdmin.role,
          status: newAdmin.status,
          restaurant: {
            _id: restaurant._id,
            name: restaurant.name,
            slug: restaurant.slug,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
