import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Ingredient from "@/models/Ingredient";
import StockMovement from "@/models/StockMovement";
import Waste from "@/models/Waste";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET() {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true, requiredFeature: "inventory" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [ingredients, recentMovements] = await Promise.all([
      Ingredient.find({ restaurant: restaurantId }).lean(),
      StockMovement.find({ restaurant: restaurantId })
        .sort({ date: -1, createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const totalIngredients = ingredients.length;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    const lowStockItems = [];

    for (const ing of ingredients) {
      const stock = Number(ing.currentStock) || 0;
      const minStock = Number(ing.minimumStock) || 0;

      if (stock <= 0) {
        outOfStockCount++;
        lowStockItems.push({
          ...ing,
          status: "OUT OF STOCK",
        });
      } else if (stock <= minStock) {
        lowStockCount++;
        lowStockItems.push({
          ...ing,
          status: "LOW STOCK",
        });
      }
    }

    // Sort low stock items: out of stock first, then lowest stock
    lowStockItems.sort((a, b) => a.currentStock - b.currentStock);

    // Calculate today's stock used value from movements
    const todayNegativeMovements = await StockMovement.find({
      restaurant: restaurantId,
      date: { $gte: startOfToday },
      quantity: { $lt: 0 },
    }).lean();

    // Map ingredients to cost for precise value
    const ingCostMap = new Map();
    ingredients.forEach((i) => {
      ingCostMap.set(i._id.toString(), Number(i.costPerUnit) || 0);
    });

    let todayUsedValue = 0;
    for (const mov of todayNegativeMovements) {
      const unitCost = ingCostMap.get(mov.ingredient?.toString()) || 0;
      const absQty = Math.abs(mov.quantity);
      todayUsedValue += absQty * unitCost;
    }

    // Format readable recent activity strings as specified
    const recentActivity = recentMovements.map((m) => {
      let description = "";
      const absQty = Math.abs(m.quantity);
      const formattedQty = Number.isInteger(absQty) ? absQty : absQty.toFixed(1);

      if (m.type === "purchase" || m.type === "manual_addition") {
        description = `${formattedQty} ${m.unit} ${m.ingredientName} added`;
      } else if (m.type === "waste") {
        description = `${formattedQty} ${m.unit} ${m.ingredientName} wasted`;
      } else if (m.type === "order") {
        description = `${formattedQty} ${m.unit} ${m.ingredientName} used for ${m.reason}`;
      } else if (m.type === "order_restoration") {
        description = `${formattedQty} ${m.unit} ${m.ingredientName} restored`;
      } else {
        description = `${formattedQty} ${m.unit} ${m.ingredientName} removed (${m.reason})`;
      }

      return {
        _id: m._id,
        description,
        type: m.type,
        quantity: m.quantity,
        unit: m.unit,
        ingredientName: m.ingredientName,
        date: m.date,
        reason: m.reason,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        totalIngredients,
        lowStockCount,
        outOfStockCount,
        todayStockUsed: Math.round(todayUsedValue),
        lowStockItems: lowStockItems.slice(0, 8),
        recentActivity,
      },
    });
  } catch (error) {
    console.error("Inventory overview error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
