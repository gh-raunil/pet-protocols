import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Ingredient from "@/models/Ingredient";
import Supplier from "@/models/Supplier";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;
    await connectDB();

    const ingredient = await Ingredient.findOne({ _id: id, restaurant: restaurantId }).lean();
    if (!ingredient) {
      return NextResponse.json({ success: false, message: "Ingredient not found" }, { status: 404 });
    }

    const stock = Number(ingredient.currentStock) || 0;
    const minStock = Number(ingredient.minimumStock) || 0;
    let status = "GOOD";
    if (stock <= 0) status = "OUT OF STOCK";
    else if (stock <= minStock) status = "LOW STOCK";

    return NextResponse.json({ success: true, ingredient: { ...ingredient, status } });
  } catch (error) {
    console.error("Get ingredient details error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;
    const body = await request.json();

    await connectDB();

    const ingredient = await Ingredient.findOne({ _id: id, restaurant: restaurantId });
    if (!ingredient) {
      return NextResponse.json({ success: false, message: "Ingredient not found" }, { status: 404 });
    }

    if (body.name !== undefined) ingredient.name = body.name.trim();
    if (body.unit !== undefined) ingredient.unit = body.unit.trim().toLowerCase();
    if (body.minimumStock !== undefined) ingredient.minimumStock = Math.max(0, Number(body.minimumStock) || 0);
    if (body.costPerUnit !== undefined) ingredient.costPerUnit = Math.max(0, Number(body.costPerUnit) || 0);

    if (body.supplier !== undefined) {
      ingredient.supplier = body.supplier || null;
      if (body.supplier) {
        const sup = await Supplier.findOne({ _id: body.supplier, restaurant: restaurantId });
        if (sup) ingredient.supplierName = sup.name;
      } else {
        ingredient.supplierName = "";
      }
    }

    await ingredient.save();

    return NextResponse.json({ success: true, ingredient });
  } catch (error) {
    console.error("Update ingredient error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;
    await connectDB();

    const deleted = await Ingredient.findOneAndDelete({ _id: id, restaurant: restaurantId });
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Ingredient not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Ingredient deleted successfully" });
  } catch (error) {
    console.error("Delete ingredient error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
