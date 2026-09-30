import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Waste from "@/models/Waste";
import Ingredient from "@/models/Ingredient";
import StockMovement from "@/models/StockMovement";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET() {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const wasteRecords = await Waste.find({ restaurant: restaurantId })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const thisMonthWaste = wasteRecords
      .filter((w) => new Date(w.date) >= startOfMonth)
      .reduce((sum, w) => sum + (Number(w.cost) || 0), 0);

    return NextResponse.json({
      success: true,
      wasteRecords,
      thisMonthWaste: Math.round(thisMonthWaste),
    });
  } catch (error) {
    console.error("Get waste records error:", error);
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

    const { ingredient: ingredientId, quantity: rawQty, reason, date, notes = "" } = body;
    const quantity = Number(rawQty);

    if (!ingredientId) {
      return NextResponse.json({ success: false, message: "Ingredient is required" }, { status: 400 });
    }
    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ success: false, message: "Quantity must be greater than zero" }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ success: false, message: "Waste reason is required" }, { status: 400 });
    }

    await connectDB();

    const ing = await Ingredient.findOne({ _id: ingredientId, restaurant: restaurantId });
    if (!ing) {
      return NextResponse.json({ success: false, message: "Ingredient not found" }, { status: 404 });
    }

    const cost = Number(((ing.costPerUnit || 0) * quantity).toFixed(2));
    const stockBefore = ing.currentStock;
    const stockAfter = Math.max(0, stockBefore - quantity);

    ing.currentStock = stockAfter;
    await ing.save();

    const wasteDate = date ? new Date(date) : new Date();

    const waste = await Waste.create({
      restaurant: restaurantId,
      ingredient: ing._id,
      ingredientName: ing.name,
      quantity,
      unit: ing.unit,
      reason,
      cost,
      date: wasteDate,
      notes: notes.trim(),
    });

    await StockMovement.create({
      restaurant: restaurantId,
      ingredient: ing._id,
      ingredientName: ing.name,
      quantity: -quantity,
      unit: ing.unit,
      type: "waste",
      reason: `Waste (${reason}) ${notes ? `- ${notes}` : ""}`.trim(),
      referenceId: waste._id.toString(),
      stockBefore,
      stockAfter,
      date: wasteDate,
    });

    return NextResponse.json({ success: true, waste, ingredient: ing }, { status: 201 });
  } catch (error) {
    console.error("Record waste error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
