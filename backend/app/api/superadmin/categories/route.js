import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";
import Restaurant from "@/models/Restaurant";
import { requireSuperAdmin } from "@/lib/authMiddleware";

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET — Super Admin list all categories (platform-wide & restaurant-specific)
export async function GET(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
    const restaurantFilter = searchParams.get("restaurant") || "all";
    const statusFilter = searchParams.get("status") || "all";

    // 1. Fetch all launched/explicit Category documents
    const categoryQuery = {};
    if (statusFilter === "active") categoryQuery.isActive = true;
    if (statusFilter === "inactive") categoryQuery.isActive = false;

    if (restaurantFilter && restaurantFilter !== "all") {
      if (restaurantFilter === "platform") {
        categoryQuery.restaurant = null;
      } else {
        categoryQuery.restaurant = restaurantFilter;
      }
    }

    const explicitCategories = await Category.find(categoryQuery)
      .populate("restaurant", "name slug cuisineType status")
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch product aggregation to get dish counts and sample images per category
    const productMatch = {};
    if (restaurantFilter && restaurantFilter !== "all" && restaurantFilter !== "platform") {
      productMatch.restaurant = restaurantFilter;
    }

    const productStats = await Product.aggregate([
      { $match: productMatch },
      {
        $group: {
          _id: { $toLower: { $trim: { input: "$category" } } },
          count: { $sum: 1 },
          availableCount: {
            $sum: { $cond: [{ $eq: ["$isAvailable", true] }, 1, 0] },
          },
          sampleImage: { $first: "$image" },
          sampleDishes: { $push: { name: "$name", price: "$price" } },
        },
      },
    ]);

    const productStatsMap = new Map();
    productStats.forEach((p) => {
      productStatsMap.set(p._id, {
        count: p.count,
        availableCount: p.availableCount,
        sampleImage: p.sampleImage,
        sampleDishes: (p.sampleDishes || []).slice(0, 4),
      });
    });

    // 3. Map explicit categories
    const categoryMap = new Map();

    explicitCategories.forEach((cat) => {
      const key = cat.name.trim().toLowerCase();
      const stats = productStatsMap.get(key) || {
        count: 0,
        availableCount: 0,
        sampleImage: "",
        sampleDishes: [],
      };

      categoryMap.set(key, {
        _id: cat._id.toString(),
        name: cat.name.trim(),
        slug: cat.slug || slugify(cat.name),
        icon: cat.icon || "🍽️",
        description: cat.description || "",
        image: cat.image || "",
        restaurant: cat.restaurant?._id ? cat.restaurant._id.toString() : cat.restaurant || null,
        restaurantInfo: cat.restaurant || null,
        restaurantName: cat.restaurant?.name || cat.restaurantName || "Platform-Wide",
        isActive: cat.isActive !== false,
        isExplicit: true,
        dishCount: stats.count,
        availableDishCount: stats.availableCount,
        sampleDishes: [],
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      });
    });

    // 4. Also discover any distinct categories from products that don't have an explicit Category document yet
    if (statusFilter !== "inactive") {
      const distinctProductCategories = await Product.distinct("category", productMatch);
      distinctProductCategories.forEach((catName) => {
        if (!catName || typeof catName !== "string") return;
        const cleanName = catName.trim();
        const key = cleanName.toLowerCase();

        if (!categoryMap.has(key)) {
          const stats = productStatsMap.get(key) || {
            count: 0,
            availableCount: 0,
            sampleImage: "",
            sampleDishes: [],
          };

          categoryMap.set(key, {
            _id: `unmanaged_${key}`,
            name: cleanName,
            slug: slugify(cleanName),
            icon: "🍽️",
            description: `Platform category for ${cleanName}`,
            image: "",
            restaurant: null,
            restaurantInfo: null,
            restaurantName: "Platform-Wide",
            isActive: true,
            isExplicit: false,
            dishCount: stats.count,
            availableDishCount: stats.availableCount,
            sampleDishes: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      });
    }

    // Convert map to array and apply search filtering
    let categoriesList = Array.from(categoryMap.values());

    if (searchQuery) {
      categoriesList = categoriesList.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery) ||
          c.description.toLowerCase().includes(searchQuery) ||
          c.restaurantName.toLowerCase().includes(searchQuery)
      );
    }

    // Sort: categories with most dishes first, then alphabetically
    categoriesList.sort((a, b) => {
      if (b.dishCount !== a.dishCount) {
        return b.dishCount - a.dishCount;
      }
      return a.name.localeCompare(b.name);
    });

    const activeCount = categoriesList.filter((c) => c.isActive).length;
    const inactiveCount = categoriesList.filter((c) => !c.isActive).length;
    const totalDishes = categoriesList.reduce((acc, c) => acc + c.dishCount, 0);

    return NextResponse.json({
      success: true,
      categories: categoriesList,
      summary: {
        total: categoriesList.length,
        active: activeCount,
        inactive: inactiveCount,
        totalDishes,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/superadmin/categories:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Super Admin create a new category (platform-wide or restaurant-scoped)
export async function POST(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      name,
      slug: customSlug,
      icon = "🍽️",
      description = "",
      image = "",
      restaurantId = null,
      isActive = true,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "Category name is required." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const slug = (customSlug && customSlug.trim()) ? slugify(customSlug) : slugify(trimmedName);

    await connectDB();

    // Check if category already exists (case-insensitive name)
    const existingCategory = await Category.findOne({
      $or: [
        { name: { $regex: `^${trimmedName}$`, $options: "i" } },
        { slug },
      ],
    });

    let restaurantName = "Platform-Wide";
    let validRestaurantId = null;

    if (restaurantId && restaurantId !== "platform" && restaurantId !== "") {
      const rest = await Restaurant.findById(restaurantId).select("name");
      if (rest) {
        validRestaurantId = rest._id;
        restaurantName = rest.name;
      }
    }

    if (existingCategory) {
      // Re-activate and update existing category
      existingCategory.name = trimmedName;
      existingCategory.slug = slug;
      if (icon) existingCategory.icon = icon;
      if (description !== undefined) existingCategory.description = description.trim();
      if (image !== undefined) existingCategory.image = image;
      existingCategory.isActive = Boolean(isActive);
      existingCategory.restaurant = validRestaurantId;
      existingCategory.restaurantName = restaurantName;
      await existingCategory.save();

      const populated = await Category.findById(existingCategory._id)
        .populate("restaurant", "name slug cuisineType status")
        .lean();

      return NextResponse.json({
        success: true,
        message: `Category "${existingCategory.name}" updated successfully!`,
        category: populated || existingCategory,
      });
    }

    // Create fresh Category document
    const newCategory = await Category.create({
      name: trimmedName,
      slug,
      icon: icon || "🍽️",
      description: (description || "").trim(),
      image: image || "",
      restaurant: validRestaurantId,
      restaurantName,
      isActive: Boolean(isActive),
    });

    const populatedCategory = await Category.findById(newCategory._id)
      .populate("restaurant", "name slug cuisineType status")
      .lean();

    return NextResponse.json(
      {
        success: true,
        message: `Category "${newCategory.name}" created successfully!`,
        category: populatedCategory || newCategory,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/superadmin/categories:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
