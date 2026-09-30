import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Purchase from "@/models/Purchase";
import Ingredient from "@/models/Ingredient";
import StockMovement from "@/models/StockMovement";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET(request) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const purchases = await Purchase.find({ restaurant: restaurantId })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, purchases });
  } catch (error) {
    console.error("Get purchases error:", error);
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

    const { supplier, supplierName, date, items, totalAmount, status = "received", notes = "" } = body;

    if (!supplierName?.trim()) {
      return NextResponse.json({ success: false, message: "Supplier name is required" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "At least one purchase item is required" }, { status: 400 });
    }

    await connectDB();

    const isReceived = status === "received";

    const purchase = await Purchase.create({
      restaurant: restaurantId,
      supplier: supplier || null,
      supplierName: supplierName.trim(),
      date: date ? new Date(date) : new Date(),
      items: items.map((i) => ({
        ingredient: i.ingredient,
        name: i.name || "Item",
        quantity: Number(i.quantity) || 1,
        unit: i.unit || "pieces",
        unitCost: Number(i.unitCost) || 0,
        totalCost: Number(i.totalCost) || Number(i.quantity) * Number(i.unitCost) || 0,
      })),
      totalAmount: Number(totalAmount) || items.reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0),
      status: isReceived ? "received" : "pending",
      stockAdded: isReceived,
      notes: notes.trim(),
    });

    // If marked received upon creation, increase stock for each item
    if (isReceived) {
      for (const item of purchase.items) {
        if (!item.ingredient) continue;
        const ing = await Ingredient.findOne({ _id: item.ingredient, restaurant: restaurantId });
        if (ing) {
          const stockBefore = ing.currentStock;
          const stockAfter = stockBefore + item.quantity;
          ing.currentStock = stockAfter;
          if (item.unitCost > 0) ing.costPerUnit = item.unitCost;
          await ing.save();

          await StockMovement.create({
            restaurant: restaurantId,
            ingredient: ing._id,
            ingredientName: ing.name,
            quantity: item.quantity,
            unit: ing.unit,
            type: "purchase",
            reason: `Purchase from ${purchase.supplierName}`,
            referenceId: purchase._id.toString(),
            stockBefore,
            stockAfter,
            date: purchase.date,
          });
        }
      }
    }

    return NextResponse.json({ success: true, purchase }, { status: 201 });
  } catch (error) {
    console.error("Create purchase error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
