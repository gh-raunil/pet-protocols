import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";
import Restaurant from "@/models/Restaurant";
import { getAuthSession } from "@/lib/authMiddleware";

// Helper function to slugify text
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET — List all dynamic categories developed/launched by restaurants
export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const restaurantFilter = searchParams.get("restaurant");

    // 1. Fetch all explicit launched categories that are active
    const launchedCategories = await Category.find({ isActive: true })
      .populate("restaurant", "name slug status")
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch distinct categories from existing products to guarantee zero omissions
    // Find active restaurants
    const activeRestaurants = await Restaurant.find({ status: "active" }).select("_id");
    const activeRestaurantIds = activeRestaurants.map((r) => r._id);

    const productQuery = {
      restaurant: { $in: activeRestaurantIds },
      isAvailable: true,
    };
    if (restaurantFilter && restaurantFilter !== "all") {
      productQuery.restaurant = restaurantFilter;
    }

    const distinctProductCategories = await Product.distinct("category", productQuery);

    // Map launched categories by name (lowercase)
    const categoryMap = new Map();

    launchedCategories.forEach((cat) => {
      const key = cat.name.trim().toLowerCase();
      categoryMap.set(key, {
        _id: cat._id,
        name: cat.name.trim(),
        slug: cat.slug || slugify(cat.name),
        icon: cat.icon || "🍽️",
        description: cat.description || "",
        image: cat.image || "",
        restaurant: cat.restaurant?._id || cat.restaurant || null,
        restaurantName: cat.restaurant?.name || cat.restaurantName || "Partner Kitchen",
        createdAt: cat.createdAt,
      });
    });

    // Add any distinct categories from products that haven't been explicitly launched in Category collection
    distinctProductCategories.forEach((catName) => {
      if (!catName || typeof catName !== "string") return;
      const cleanName = catName.trim();
      const key = cleanName.toLowerCase();
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          _id: key,
          name: cleanName,
          slug: slugify(cleanName),
          icon: "🍽️",
          description: `Fresh dishes in ${cleanName}`,
          image: "",
          restaurantName: "Partner Kitchens",
          createdAt: new Date(),
        });
      }
    });

    // Also get product counts per category
    const countAggregation = await Product.aggregate([
      { $match: productQuery },
      { $group: { _id: { $toLower: "$category" }, count: { $sum: 1 }, sampleImage: { $first: "$image" } } },
    ]);

    const countsMap = new Map();
    countAggregation.forEach((item) => {
      countsMap.set(item._id, { count: item.count, sampleImage: item.sampleImage });
    });

    const categoriesList = Array.from(categoryMap.values()).map((cat) => {
      const countData = countsMap.get(cat.name.toLowerCase()) || { count: 0, sampleImage: "" };
      return {
        ...cat,
        dishCount: countData.count,
        sampleImage: cat.image || countData.sampleImage || "",
      };
    });

    // Sort categories: categories with dishes first, then alphabetically
    categoriesList.sort((a, b) => {
      if (b.dishCount !== a.dishCount) {
        return b.dishCount - a.dishCount;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      categories: categoriesList,
    });
  } catch (error) {
    console.error("Error in GET /api/categories:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST — Launch a new category (Restaurant Admin, Admin, Superadmin)
export async function POST(request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Authentication required to launch a category." },
        { status: 401 }
      );
    }

    const allowedRoles = ["admin", "restaurant_admin", "superadmin"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Restaurant management privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, icon = "🍽️", description = "", image = "" } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "Category name is required." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const slug = slugify(trimmedName);

    await connectDB();

    // Check if category already exists (case-insensitive)
    const existingCategory = await Category.findOne({
      $or: [
        { name: { $regex: `^${trimmedName}$`, $options: "i" } },
        { slug: slug },
      ],
    });

    let restaurantId = session.user.restaurantId || null;
    let restaurantName = "";

    if (restaurantId) {
      const rest = await Restaurant.findById(restaurantId).select("name");
      if (rest) restaurantName = rest.name;
    }

    if (existingCategory) {
      // Re-activate if deactivated
      existingCategory.isActive = true;
      if (icon && icon !== "🍽️") existingCategory.icon = icon;
      if (description) existingCategory.description = description;
      if (image) existingCategory.image = image;
      await existingCategory.save();

      return NextResponse.json({
        success: true,
        message: `Category "${existingCategory.name}" is already available and updated.`,
        category: existingCategory,
      });
    }

    // Create new category
    const newCategory = await Category.create({
      name: trimmedName,
      slug,
      icon: icon || "🍽️",
      description,
      image,
      restaurant: restaurantId,
      restaurantName,
      isActive: true,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Category "${newCategory.name}" launched successfully!`,
        category: newCategory,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/categories:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
