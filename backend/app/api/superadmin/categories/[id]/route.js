import { NextResponse } from "next/server";
import mongoose from "mongoose";
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

// PUT — Super Admin edit a category
export async function PUT(request, { params }) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      slug: customSlug,
      icon,
      description,
      image,
      isActive,
      restaurantId,
      oldCategoryName,
    } = body;

    await connectDB();

    let category = null;
    let originalName = oldCategoryName || "";

    // 1. Check if ID is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id);
    }

    // 2. If not found by ObjectId (e.g. was auto-detected/unmanaged category), check by name/slug
    if (!category) {
      const lookupName = originalName || id.replace(/^unmanaged_/, "");
      category = await Category.findOne({
        $or: [
          { name: { $regex: `^${lookupName}$`, $options: "i" } },
          { slug: slugify(lookupName) },
        ],
      });
    }

    const trimmedName = (name && typeof name === "string") ? name.trim() : "";
    if (!trimmedName && !category) {
      return NextResponse.json(
        { success: false, message: "Category name is required." },
        { status: 400 }
      );
    }

    // Determine target restaurant
    let validRestaurantId = null;
    let restaurantName = "Platform-Wide";
    if (restaurantId && restaurantId !== "platform" && restaurantId !== "") {
      const rest = await Restaurant.findById(restaurantId).select("name");
      if (rest) {
        validRestaurantId = rest._id;
        restaurantName = rest.name;
      }
    }

    let updatedOrCreatedCategory;
    const priorName = category ? category.name : originalName;

    if (category) {
      // Update existing document
      if (trimmedName) category.name = trimmedName;
      if (customSlug || trimmedName) {
        category.slug = customSlug ? slugify(customSlug) : slugify(category.name);
      }
      if (icon !== undefined) category.icon = icon || "🍽️";
      if (description !== undefined) category.description = description.trim();
      if (image !== undefined) category.image = image;
      if (isActive !== undefined) category.isActive = Boolean(isActive);
      if (restaurantId !== undefined) {
        category.restaurant = validRestaurantId;
        category.restaurantName = restaurantName;
      }

      await category.save();
      updatedOrCreatedCategory = category;
    } else {
      // First-time save of an auto-detected/inferred category
      const slug = customSlug ? slugify(customSlug) : slugify(trimmedName);
      updatedOrCreatedCategory = await Category.create({
        name: trimmedName,
        slug,
        icon: icon || "🍽️",
        description: (description || "").trim(),
        image: image || "",
        restaurant: validRestaurantId,
        restaurantName,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      });
    }

    // 3. SYNC WITH PRODUCTS: If the category name changed, update all products to retain category association!
    let syncedProductCount = 0;
    const newName = updatedOrCreatedCategory.name;
    if (priorName && newName && priorName.trim().toLowerCase() !== newName.trim().toLowerCase()) {
      const productQuery = {
        category: { $regex: new RegExp(`^${priorName.trim()}$`, "i") },
      };
      if (updatedOrCreatedCategory.restaurant) {
        productQuery.restaurant = updatedOrCreatedCategory.restaurant;
      }
      const updateResult = await Product.updateMany(productQuery, {
        $set: { category: newName.trim() },
      });
      syncedProductCount = updateResult.modifiedCount || 0;
    }

    const populated = await Category.findById(updatedOrCreatedCategory._id)
      .populate("restaurant", "name slug cuisineType status")
      .lean();

    return NextResponse.json({
      success: true,
      message: `Category "${updatedOrCreatedCategory.name}" updated successfully!${
        syncedProductCount > 0 ? ` (${syncedProductCount} dishes updated to new category name)` : ""
      }`,
      category: populated || updatedOrCreatedCategory,
      syncedProductCount,
    });
  } catch (error) {
    console.error("Error in PUT /api/superadmin/categories/[id]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE — Super Admin delete or deactivate a category
export async function DELETE(request, { params }) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    await connectDB();

    let category = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id);
    }

    if (!category) {
      const lookupName = id.replace(/^unmanaged_/, "");
      category = await Category.findOne({
        $or: [
          { name: { $regex: `^${lookupName}$`, $options: "i" } },
          { slug: slugify(lookupName) },
        ],
      });
    }

    if (!category) {
      return NextResponse.json({ success: false, message: "Category not found." }, { status: 404 });
    }

    const categoryName = category.name;
    const catRestaurant = category.restaurant;

    // Check how many products are currently in this category
    const productCountQuery = {
      category: { $regex: new RegExp(`^${categoryName.trim()}$`, "i") },
    };
    if (catRestaurant) {
      productCountQuery.restaurant = catRestaurant;
    }
    const associatedProductsCount = await Product.countDocuments(productCountQuery);

    // Delete the Category document
    await Category.findByIdAndDelete(category._id);

    return NextResponse.json({
      success: true,
      message: `Category "${categoryName}" deleted successfully!${
        associatedProductsCount > 0
          ? ` Note: ${associatedProductsCount} dishes currently retain "${categoryName}" as their category string.`
          : ""
      }`,
      associatedProductsCount,
    });
  } catch (error) {
    console.error("Error in DELETE /api/superadmin/categories/[id]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
