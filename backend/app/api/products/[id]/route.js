import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import connectDB from '@/lib/db'
import Product from '@/models/Product'
import mongoose from 'mongoose'

// GET single product
export async function GET(request, { params }) {
  try {
    const { id } = await params  // ← await params in Next.js 16
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid product ID format' },
        { status: 400 }
      );
    }
    await connectDB()
    const product = await Product.findById(id).populate(
      'restaurant',
      'name slug status rating image isOpen acceptingOrders isTemporarilyClosed closureReason openingHours weeklyHours regionalSettings orderTypes orderLimits cancellationSettings menuSettings paymentSettings chargeSettings deliverySettings'
    );
    if (!product) return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 })

    const productObj = product.toObject ? product.toObject() : product;
    if ((!productObj.images || productObj.images.length === 0) && productObj.image) {
      productObj.images = [
        {
          url: productObj.image,
          alt: productObj.name || '',
          order: 0,
          isPrimary: true,
        },
      ];
    }

    return NextResponse.json({ success: true, product: productObj })
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// UPDATE product
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid product ID format' },
        { status: 400 }
      );
    }
    const session = await getServerSession(authOptions);
    if (!session || !["admin", "restaurant_admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    // Tenant boundary check: Branch admins may only update dishes belonging to their assigned restaurant
    if (session.user.role !== "superadmin") {
      const userRestaurantId = session.user.restaurantId || session.user.restaurant;
      if (!userRestaurantId || existingProduct.restaurant?.toString() !== userRestaurantId.toString()) {
        return NextResponse.json(
          { success: false, message: "Forbidden: You cannot modify products belonging to another restaurant." },
          { status: 403 }
        );
      }
      const Restaurant = (await import("@/models/Restaurant")).default;
      const restDoc = await Restaurant.findById(userRestaurantId).select("status").lean();
      if (restDoc && restDoc.status === "suspended") {
        return NextResponse.json(
          { success: false, message: "Restaurant branch is suspended. Operations are disabled." },
          { status: 403 }
        );
      }
      // Never allow a branch admin to transfer a product to another restaurant
      delete body.restaurant;
    }

    if (body.images !== undefined) {
      if (!Array.isArray(body.images)) {
        return NextResponse.json({ success: false, message: "Images must be an array." }, { status: 400 });
      }
      if (body.images.length > 5) {
        return NextResponse.json({ success: false, message: "A dish cannot have more than 5 images." }, { status: 400 });
      }
      const sanitized = [];
      let foundPrimary = false;
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (!img || !img.url || typeof img.url !== "string" || !img.url.trim()) continue;
        const isPrimary = Boolean(img.isPrimary) && !foundPrimary;
        if (isPrimary) foundPrimary = true;
        sanitized.push({
          url: String(img.url).trim(),
          alt: img.alt ? String(img.alt).trim().slice(0, 200) : (body.name || existingProduct.name || "").slice(0, 200),
          order: typeof img.order === "number" ? img.order : i,
          isPrimary,
        });
      }
      if (sanitized.length > 0 && !foundPrimary) {
        sanitized[0].isPrimary = true;
      }
      body.images = sanitized;
      if (sanitized.length > 0) {
        const prim = sanitized.find((img) => img.isPrimary) || sanitized[0];
        body.image = prim.url;
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    return NextResponse.json({ success: true, product: updatedProduct });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE product
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, message: 'Invalid product ID format' },
        { status: 400 }
      );
    }
    const session = await getServerSession(authOptions);
    if (!session || !["admin", "restaurant_admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    // Tenant boundary check: Branch admins may only delete dishes belonging to their assigned restaurant
    if (session.user.role !== "superadmin") {
      const userRestaurantId = session.user.restaurantId || session.user.restaurant;
      if (!userRestaurantId || existingProduct.restaurant?.toString() !== userRestaurantId.toString()) {
        return NextResponse.json(
          { success: false, message: "Forbidden: You cannot delete products belonging to another restaurant." },
          { status: 403 }
        );
      }
      const Restaurant = (await import("@/models/Restaurant")).default;
      const restDoc = await Restaurant.findById(userRestaurantId).select("status").lean();
      if (restDoc && restDoc.status === "suspended") {
        return NextResponse.json(
          { success: false, message: "Restaurant branch is suspended. Operations are disabled." },
          { status: 403 }
        );
      }
    }

    await Product.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Product deleted" });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}