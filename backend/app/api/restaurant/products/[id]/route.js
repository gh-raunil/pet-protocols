import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

export async function PUT(request, { params }) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "products_manage" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;
    const body = await request.json();

    await connectDB();

    // Ensure product belongs to this restaurant
    const product = await Product.findOne({ _id: id, restaurant: restaurantId });
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found or not owned by your restaurant." },
        { status: 404 }
      );
    }

    if (body.name !== undefined) product.name = body.name.trim();
    if (body.description !== undefined) product.description = body.description;
    if (body.price !== undefined) {
      const p = Number(body.price);
      if (isNaN(p) || p < 0) {
        return NextResponse.json({ success: false, message: "Price must be a valid non-negative amount." }, { status: 400 });
      }
      product.price = p;
    }
    if (body.image !== undefined) product.image = body.image;
    if (body.category !== undefined) product.category = body.category;
    if (body.type !== undefined) product.type = body.type;
    if (body.preparationTime !== undefined) product.preparationTime = Math.max(1, Number(body.preparationTime) || 15);
    if (body.isAvailable !== undefined) product.isAvailable = Boolean(body.isAvailable);
    if (body.isFeatured !== undefined) product.isFeatured = Boolean(body.isFeatured);

    if (body.portion !== undefined) {
      if (!body.portion) {
        product.portion = null;
      } else {
        const q = body.portion.quantity !== undefined && body.portion.quantity !== "" && body.portion.quantity !== null
          ? Number(body.portion.quantity)
          : null;
        if (q !== null && (isNaN(q) || q <= 0)) {
          return NextResponse.json({ success: false, message: "Portion quantity must be a positive number." }, { status: 400 });
        }
        product.portion = {
          quantity: q,
          unit: body.portion.unit ? String(body.portion.unit).trim() : null,
          customUnit: body.portion.customUnit ? String(body.portion.customUnit).trim().slice(0, 50) : null,
          servingLabel: body.portion.servingLabel ? String(body.portion.servingLabel).trim().slice(0, 100) : null,
          size: body.portion.size ? String(body.portion.size).trim().slice(0, 50) : null,
        };
      }
    }

    if (body.hasVariants !== undefined) {
      product.hasVariants = Boolean(body.hasVariants);
    }

    if (body.variants !== undefined) {
      if (product.hasVariants) {
        if (!Array.isArray(body.variants) || body.variants.length === 0) {
          return NextResponse.json(
            { success: false, message: "At least one variant must be defined when variants are enabled." },
            { status: 400 }
          );
        }
        const sanitizedVariants = [];
        for (const v of body.variants) {
          if (!v || !v.name || !String(v.name).trim()) {
            return NextResponse.json({ success: false, message: "All variants must have a name." }, { status: 400 });
          }
          const vPrice = Number(v.price);
          if (isNaN(vPrice) || vPrice < 0) {
            return NextResponse.json({ success: false, message: `Price for variant '${v.name}' must be non-negative.` }, { status: 400 });
          }
          const vQty = v.portionQuantity !== undefined && v.portionQuantity !== "" && v.portionQuantity !== null
            ? Number(v.portionQuantity)
            : null;
          if (vQty !== null && (isNaN(vQty) || vQty <= 0)) {
            return NextResponse.json({ success: false, message: `Portion quantity for variant '${v.name}' must be positive.` }, { status: 400 });
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
        product.variants = sanitizedVariants;
      } else {
        product.variants = Array.isArray(body.variants) ? body.variants : [];
      }
    }

    await product.save();

    return NextResponse.json({ success: true, message: "Product updated successfully!", product });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "products_manage" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;

    await connectDB();

    const product = await Product.findOneAndDelete({ _id: id, restaurant: restaurantId });
    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found or not owned by your restaurant." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Product deleted successfully!" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
