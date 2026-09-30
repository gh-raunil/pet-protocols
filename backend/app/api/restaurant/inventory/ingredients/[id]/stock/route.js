import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
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

    const ingredient = await Ingredient.findOne({ _id: id, restaurant: restaurantId }).lean();
    if (!ingredient) {
      return NextResponse.json({ success: false, message: "Ingredient not found" }, { status: 404 });
    }

    const movements = await StockMovement.find({
      restaurant: restaurantId,
      ingredient: id,
    })
      .sort({ date: -1, createdAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({
      success: true,
      ingredient,
      history: movements,
    });
  } catch (error) {
    console.error("Get stock history error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;
    const body = await request.json();

    const action = body.action; // "add" or "remove"
    const quantity = Number(body.quantity);

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return NextResponse.json(
        { success: false, message: "Quantity must be a positive number" },
        { status: 400 }
      );
    }

    await connectDB();

    const ingredient = await Ingredient.findOne({ _id: id, restaurant: restaurantId });
    if (!ingredient) {
      return NextResponse.json({ success: false, message: "Ingredient not found" }, { status: 404 });
    }

    const stockBefore = ingredient.currentStock;
    let stockAfter = stockBefore;
    let movementType = "manual_addition";
    let reasonText = body.notes?.trim() || "";

    if (action === "add") {
      stockAfter = stockBefore + quantity;
      ingredient.currentStock = stockAfter;

      if (body.purchaseCost && Number(body.purchaseCost) > 0) {
        // If cost provided, update unit cost optionally
        ingredient.costPerUnit = Number((body.purchaseCost / quantity).toFixed(2));
      }

      movementType = body.supplier ? "purchase" : "manual_addition";
      reasonText = body.supplier
        ? `Added stock (Supplier: ${body.supplier})`
        : reasonText || "Stock Added";

      await ingredient.save();

      await StockMovement.create({
        restaurant: restaurantId,
        ingredient: ingredient._id,
        ingredientName: ingredient.name,
        quantity: quantity,
        unit: ingredient.unit,
        type: movementType,
        reason: reasonText,
        referenceId: body.supplier || "",
        stockBefore,
        stockAfter,
        date: body.date ? new Date(body.date) : new Date(),
      });

      return NextResponse.json({
        success: true,
        message: `${quantity} ${ingredient.unit} added successfully. New stock: ${stockAfter} ${ingredient.unit}`,
        ingredient,
      });
    } else if (action === "remove") {
      const reasonCategory = body.reason || "Used"; // Used, Damaged, Expired, Wasted, Other
      if (quantity > stockBefore) {
        return NextResponse.json(
          {
            success: false,
            message: `Cannot remove ${quantity} ${ingredient.unit}. Only ${stockBefore} ${ingredient.unit} in stock.`,
          },
          { status: 400 }
        );
      }

      stockAfter = Math.max(0, stockBefore - quantity);
      ingredient.currentStock = stockAfter;
      await ingredient.save();

      movementType = reasonCategory === "Wasted" || reasonCategory === "Damaged" || reasonCategory === "Expired"
        ? "waste"
        : "manual_removal";

      reasonText = reasonCategory + (body.notes ? `: ${body.notes}` : "");

      await StockMovement.create({
        restaurant: restaurantId,
        ingredient: ingredient._id,
        ingredientName: ingredient.name,
        quantity: -quantity,
        unit: ingredient.unit,
        type: movementType,
        reason: reasonText,
        stockBefore,
        stockAfter,
        date: body.date ? new Date(body.date) : new Date(),
      });

      return NextResponse.json({
        success: true,
        message: `${quantity} ${ingredient.unit} removed. New stock: ${stockAfter} ${ingredient.unit}`,
        ingredient,
      });
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid action. Must be 'add' or 'remove'." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Stock adjustment error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
