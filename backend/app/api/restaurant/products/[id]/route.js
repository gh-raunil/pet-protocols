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

    if (body.images !== undefined) {
      if (!Array.isArray(body.images)) {
        return NextResponse.json({ success: false, message: "Images must be an array." }, { status: 400 });
      }
      if (body.images.length > 5) {
        return NextResponse.json({ success: false, message: "A dish cannot have more than 5 images." }, { status: 400 });
      }
      const sanitizedImages = [];
      let foundPrimary = false;
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (!img || !img.url || typeof img.url !== "string" || !img.url.trim()) {
          continue;
        }
        const isPrimary = Boolean(img.isPrimary) && !foundPrimary;
        if (isPrimary) foundPrimary = true;

        sanitizedImages.push({
          url: String(img.url).trim(),
          alt: img.alt ? String(img.alt).trim().slice(0, 200) : (product.name || "").slice(0, 200),
          order: typeof img.order === "number" ? img.order : i,
          isPrimary,
        });
      }

      if (sanitizedImages.length > 0 && !foundPrimary) {
        sanitizedImages[0].isPrimary = true;
      }

      product.images = sanitizedImages;
      if (sanitizedImages.length > 0) {
        const prim = sanitizedImages.find((img) => img.isPrimary) || sanitizedImages[0];
        product.image = prim.url;
      }
    }
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
        const seenVariantNames = new Set();
        for (let i = 0; i < body.variants.length; i++) {
          const v = body.variants[i];
          if (!v || !v.name || !String(v.name).trim()) {
            return NextResponse.json({ success: false, message: "All variants must have a name (e.g. Small, Medium, Large, 250 g)." }, { status: 400 });
          }
          const cleanName = String(v.name).trim().slice(0, 100);
          const lowerName = cleanName.toLowerCase();
          if (seenVariantNames.has(lowerName)) {
            return NextResponse.json(
              { success: false, message: `Duplicate variant name '${cleanName}'. Each variant name must be unique.` },
              { status: 400 }
            );
          }
          seenVariantNames.add(lowerName);

          const vPrice = Number(v.price);
          if (isNaN(vPrice) || vPrice < 0) {
            return NextResponse.json({ success: false, message: `Price for variant '${cleanName}' must be non-negative.` }, { status: 400 });
          }

          let vCompareAt = null;
          if (v.compareAtPrice !== undefined && v.compareAtPrice !== "" && v.compareAtPrice !== null) {
            const cap = Number(v.compareAtPrice);
            if (isNaN(cap) || cap <= 0) {
              return NextResponse.json(
                { success: false, message: `Compare-at price for '${cleanName}' must be a positive number.` },
                { status: 400 }
              );
            }
            if (cap <= vPrice) {
              return NextResponse.json(
                { success: false, message: `Compare-at price (₹${cap}) for '${cleanName}' must be greater than the selling price (₹${vPrice}).` },
                { status: 400 }
              );
            }
            vCompareAt = cap;
          }

          const vQty = v.portionQuantity !== undefined && v.portionQuantity !== "" && v.portionQuantity !== null
            ? Number(v.portionQuantity)
            : null;
          if (vQty !== null && (isNaN(vQty) || vQty <= 0)) {
            return NextResponse.json({ success: false, message: `Portion quantity for variant '${cleanName}' must be positive.` }, { status: 400 });
          }

          const vImage = v.image && typeof v.image === "string" && v.image.trim() ? v.image.trim() : null;

          sanitizedVariants.push({
            ...(v._id && mongoose.Types.ObjectId.isValid(v._id) ? { _id: v._id } : {}),
            name: cleanName,
            price: vPrice,
            compareAtPrice: vCompareAt,
            portionQuantity: vQty,
            portionUnit: v.portionUnit ? String(v.portionUnit).trim() : null,
            servingLabel: v.servingLabel ? String(v.servingLabel).trim().slice(0, 100) : null,
            size: v.size ? String(v.size).trim().slice(0, 50) : null,
            isAvailable: v.isAvailable !== false,
            image: vImage,
            sortOrder: typeof v.sortOrder === "number" ? v.sortOrder : i,
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
