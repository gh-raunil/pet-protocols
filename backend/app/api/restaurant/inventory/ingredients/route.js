import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Ingredient from "@/models/Ingredient";
import StockMovement from "@/models/StockMovement";
import Supplier from "@/models/Supplier";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET(request) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const filter = (searchParams.get("filter") || "all").toLowerCase();

    const query = { restaurant: restaurantId };
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    let ingredients = await Ingredient.find(query).sort({ name: 1 }).lean();

    // Attach status to each ingredient
    ingredients = ingredients.map((ing) => {
      const stock = Number(ing.currentStock) || 0;
      const minStock = Number(ing.minimumStock) || 0;
      let status = "GOOD";
      if (stock <= 0) status = "OUT OF STOCK";
      else if (stock <= minStock) status = "LOW STOCK";

      return {
        ...ing,
        status,
      };
    });

    if (filter === "good") {
      ingredients = ingredients.filter((i) => i.status === "GOOD");
    } else if (filter === "low" || filter === "low stock") {
      ingredients = ingredients.filter((i) => i.status === "LOW STOCK");
    } else if (filter === "out" || filter === "out of stock") {
      ingredients = ingredients.filter((i) => i.status === "OUT OF STOCK");
    }

    return NextResponse.json({ success: true, ingredients });
  } catch (error) {
    console.error("Get ingredients error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const body = await request.json();

    const name = body.name?.trim();
    const unit = body.unit?.trim().toLowerCase();
    const currentStock = Number(body.currentStock);
    const minimumStock = Number(body.minimumStock);
    const costPerUnit = Number(body.costPerUnit || 0);
    const supplierId = body.supplier || null;
    let supplierName = body.supplierName?.trim() || "";

    if (!name) {
      return NextResponse.json({ success: false, message: "Ingredient name is required" }, { status: 400 });
    }
    if (!unit) {
      return NextResponse.json({ success: false, message: "Unit is required" }, { status: 400 });
    }
    if (isNaN(currentStock) || currentStock < 0) {
      return NextResponse.json({ success: false, message: "Current stock cannot be negative" }, { status: 400 });
    }
    if (isNaN(minimumStock) || minimumStock < 0) {
      return NextResponse.json({ success: false, message: "Minimum stock cannot be negative" }, { status: 400 });
    }
    if (isNaN(costPerUnit) || costPerUnit < 0) {
      return NextResponse.json({ success: false, message: "Cost per unit cannot be negative" }, { status: 400 });
    }

    await connectDB();

    if (supplierId && !supplierName) {
      const sup = await Supplier.findOne({ _id: supplierId, restaurant: restaurantId });
      if (sup) supplierName = sup.name;
    }

    const ingredient = await Ingredient.create({
      restaurant: restaurantId,
      name,
      unit,
      currentStock,
      minimumStock,
      costPerUnit,
      supplier: supplierId || null,
      supplierName,
    });

    if (currentStock > 0) {
      await StockMovement.create({
        restaurant: restaurantId,
        ingredient: ingredient._id,
        ingredientName: ingredient.name,
        quantity: currentStock,
        unit: ingredient.unit,
        type: "manual_addition",
        reason: "Initial Stock Setup",
        stockBefore: 0,
        stockAfter: currentStock,
        date: new Date(),
      });
    }

    return NextResponse.json({ success: true, ingredient }, { status: 201 });
  } catch (error) {
    console.error("Create ingredient error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
