import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

// GET — List products belonging to this restaurant
export async function GET(request) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "products_view" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    let filter = { restaurant: restaurantId };
    if (category && category !== "All") filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST — Create a product for this restaurant
export async function POST(request) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "products_manage" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const body = await request.json();

    const { name, description, price, image, category, type = "veg", isAvailable = true, isFeatured = false, preparationTime = 15 } = body;

    if (!name || !price || !category) {
      return NextResponse.json(
        { success: false, message: "Product name, price, and category are required." },
        { status: 400 }
      );
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return NextResponse.json(
        { success: false, message: "Price must be a valid non-negative amount." },
        { status: 400 }
      );
    }

    let sanitizedPortion = null;
    if (body.portion && typeof body.portion === "object") {
      const q = body.portion.quantity !== undefined && body.portion.quantity !== "" && body.portion.quantity !== null
        ? Number(body.portion.quantity)
        : null;
      if (q !== null && (isNaN(q) || q <= 0)) {
        return NextResponse.json(
          { success: false, message: "Portion quantity must be a positive number." },
          { status: 400 }
        );
      }
      sanitizedPortion = {
        quantity: q,
        unit: body.portion.unit ? String(body.portion.unit).trim() : null,
        customUnit: body.portion.customUnit ? String(body.portion.customUnit).trim().slice(0, 50) : null,
        servingLabel: body.portion.servingLabel ? String(body.portion.servingLabel).trim().slice(0, 100) : null,
        size: body.portion.size ? String(body.portion.size).trim().slice(0, 50) : null,
      };
    }

    let sanitizedHasVariants = Boolean(body.hasVariants);
    let sanitizedVariants = [];
    if (sanitizedHasVariants) {
      if (!Array.isArray(body.variants) || body.variants.length === 0) {
        return NextResponse.json(
          { success: false, message: "At least one variant must be defined when multiple variants are enabled." },
          { status: 400 }
        );
      }
      for (const v of body.variants) {
        if (!v || !v.name || !String(v.name).trim()) {
          return NextResponse.json(
            { success: false, message: "All variants must have a name (e.g. Small, Medium, Large)." },
            { status: 400 }
          );
        }
        const vPrice = Number(v.price);
        if (isNaN(vPrice) || vPrice < 0) {
          return NextResponse.json(
            { success: false, message: `Price for variant '${v.name}' must be a valid non-negative number.` },
            { status: 400 }
          );
        }
        const vQty = v.portionQuantity !== undefined && v.portionQuantity !== "" && v.portionQuantity !== null
          ? Number(v.portionQuantity)
          : null;
        if (vQty !== null && (isNaN(vQty) || vQty <= 0)) {
          return NextResponse.json(
            { success: false, message: `Portion quantity for variant '${v.name}' must be positive.` },
            { status: 400 }
          );
        }

        sanitizedVariants.push({
          name: String(v.name).trim().slice(0, 100),
          price: vPrice,
          portionQuantity: vQty,
          portionUnit: v.portionUnit ? String(v.portionUnit).trim() : null,
          servingLabel: v.servingLabel ? String(v.servingLabel).trim().slice(0, 100) : null,
          size: v.size ? String(v.size).trim().slice(0, 50) : null,
          isAvailable: v.isAvailable !== false,
        });
      }
    }

    await connectDB();

    const product = await Product.create({
      restaurant: restaurantId,
      name: name.trim(),
      description: description || "",
      price: numPrice,
      image: image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
      category,
      type,
      preparationTime: Number(preparationTime) || 15,
      isAvailable: isAvailable !== false,
      isFeatured: !!isFeatured,
      portion: sanitizedPortion,
      hasVariants: sanitizedHasVariants,
      variants: sanitizedVariants,
    });

    // Auto-register category in Category model
    if (category && typeof category === "string") {
      const cleanCat = category.trim();
      try {
        const Category = (await import("@/models/Category")).default;
        const existingCat = await Category.findOne({
          name: { $regex: `^${cleanCat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: "i" },
        });
        if (!existingCat) {
          await Category.create({
            name: cleanCat,
            slug: cleanCat.toLowerCase().replace(/[\s\W-]+/g, "-"),
            icon: "🍽️",
            description: `Fresh dishes in ${cleanCat}`,
            restaurant: restaurantId,
            isActive: true,
          });
        }
      } catch (catErr) {
        console.warn("Could not auto-register category:", catErr.message);
      }
    }

    return NextResponse.json({ success: true, message: "Product created successfully!", product }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
