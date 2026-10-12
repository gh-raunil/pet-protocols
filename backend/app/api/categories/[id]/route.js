import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Category from "@/models/Category";
import { getAuthSession } from "@/lib/authMiddleware";

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// PUT — Update category (Restaurant Admin, Admin, Superadmin)
export async function PUT(request, { params }) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
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

    const { id } = await params;
    const body = await request.json();
    const { name, icon, description, image, isActive } = body;

    await connectDB();

    let category = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id);
    }

    if (!category) {
      // Try finding by name or slug
      const lookupName = name || id;
      category = await Category.findOne({
        $or: [
          { name: { $regex: `^${lookupName}$`, $options: "i" } },
          { slug: slugify(lookupName) },
        ],
      });
    }

    if (!category) {
      // If it doesn't exist yet, create it!
      const trimmedName = (name || id).trim();
      category = await Category.create({
        name: trimmedName,
        slug: slugify(trimmedName),
        icon: icon || "🍽️",
        description: description || "",
        image: image || "",
        restaurant: session.user.restaurantId || null,
        restaurantName: session.user.restaurantName || "Platform-Wide",
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      });

      return NextResponse.json({
        success: true,
        message: `Category "${category.name}" created and updated successfully!`,
        category,
      });
    }

    // Update existing category
    if (name && typeof name === "string" && name.trim()) {
      category.name = name.trim();
      category.slug = slugify(name.trim());
    }
    if (icon !== undefined) category.icon = icon || "🍽️";
    if (description !== undefined) category.description = description.trim();
    if (image !== undefined) category.image = image;
    if (isActive !== undefined) category.isActive = Boolean(isActive);

    await category.save();

    return NextResponse.json({
      success: true,
      message: `Category "${category.name}" updated successfully!`,
      category,
    });
  } catch (error) {
    console.error("Error in PUT /api/categories/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
