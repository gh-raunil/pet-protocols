import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Purchase from "@/models/Purchase";
import Ingredient from "@/models/Ingredient";
import StockMovement from "@/models/StockMovement";
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

    const purchase = await Purchase.findOne({ _id: id, restaurant: restaurantId }).lean();
    if (!purchase) {
      return NextResponse.json({ success: false, message: "Purchase not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, purchase });
  } catch (error) {
    console.error("Get purchase details error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT — e.g. mark pending purchase as received
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

    const purchase = await Purchase.findOne({ _id: id, restaurant: restaurantId });
    if (!purchase) {
      return NextResponse.json({ success: false, message: "Purchase not found" }, { status: 404 });
    }

    if (body.status === "received" && !purchase.stockAdded) {
      purchase.status = "received";
      purchase.stockAdded = true;

      // Increase stock safely once
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
            date: new Date(),
          });
        }
      }

      await purchase.save();
    }

    return NextResponse.json({ success: true, purchase });
  } catch (error) {
    console.error("Update purchase error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
