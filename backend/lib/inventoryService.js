import connectDB from "./db";
import Recipe from "@/models/Recipe";
import Ingredient from "@/models/Ingredient";
import StockMovement from "@/models/StockMovement";
import Order from "@/models/Order";

/**
 * Deduct stock for an order based on recipes of ordered dishes.
 * Idempotent: Deducts exactly once per order.
 */
export async function deductStockForOrder(orderOrId) {
  try {
    await connectDB();
    const order =
      typeof orderOrId === "object" && orderOrId._id
        ? orderOrId
        : await Order.findById(orderOrId);

    if (!order) return { success: false, reason: "Order not found" };
    if (order.stockDeducted) {
      return { success: true, message: "Stock already deducted for this order" };
    }

    const restaurantId = order.restaurant?._id || order.restaurant;
    const items = order.items || [];

    for (const item of items) {
      const productId = item.product?._id || item.product;
      const orderQty = Number(item.quantity) || 1;

      // Find recipe for this product in this restaurant
      let recipe = null;
      if (productId) {
        recipe = await Recipe.findOne({
          restaurant: restaurantId,
          product: productId,
        });
      }
      if (!recipe && item.name) {
        recipe = await Recipe.findOne({
          restaurant: restaurantId,
          productName: { $regex: new RegExp(`^${item.name.trim()}$`, "i") },
        });
      }

      if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
        continue;
      }

      // Deduct each ingredient
      for (const recipeIng of recipe.ingredients) {
        const ingId = recipeIng.ingredient;
        const requiredPerDish = Number(recipeIng.quantity) || 0;
        const totalDeduct = requiredPerDish * orderQty;

        if (totalDeduct <= 0) continue;

        const ingredientDoc = await Ingredient.findOne({
          _id: ingId,
          restaurant: restaurantId,
        });

        if (ingredientDoc) {
          const stockBefore = ingredientDoc.currentStock;
          const stockAfter = Math.max(0, stockBefore - totalDeduct);
          ingredientDoc.currentStock = stockAfter;
          await ingredientDoc.save();

          await StockMovement.create({
            restaurant: restaurantId,
            ingredient: ingredientDoc._id,
            ingredientName: ingredientDoc.name,
            quantity: -totalDeduct,
            unit: ingredientDoc.unit,
            type: "order",
            reason: `Order #${order.orderId || order._id.toString().slice(-6).toUpperCase()}`,
            referenceId: order._id.toString(),
            stockBefore,
            stockAfter,
            date: new Date(),
          });
        }
      }
    }

    order.stockDeducted = true;
    await Order.updateOne({ _id: order._id }, { $set: { stockDeducted: true } });

    return { success: true, message: "Stock deducted successfully" };
  } catch (err) {
    console.error("Error deducting stock for order:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Restore stock if an order is cancelled or refunded.
 * Idempotent: Restores exactly once.
 */
export async function restoreStockForOrder(orderOrId) {
  try {
    await connectDB();
    const order =
      typeof orderOrId === "object" && orderOrId._id
        ? orderOrId
        : await Order.findById(orderOrId);

    if (!order) return { success: false, reason: "Order not found" };
    if (!order.stockDeducted) {
      return { success: true, message: "No stock was deducted for this order" };
    }
    if (order.stockRestored) {
      return { success: true, message: "Stock already restored for this order" };
    }

    const restaurantId = order.restaurant?._id || order.restaurant;
    const items = order.items || [];

    for (const item of items) {
      const productId = item.product?._id || item.product;
      const orderQty = Number(item.quantity) || 1;

      let recipe = null;
      if (productId) {
        recipe = await Recipe.findOne({
          restaurant: restaurantId,
          product: productId,
        });
      }
      if (!recipe && item.name) {
        recipe = await Recipe.findOne({
          restaurant: restaurantId,
          productName: { $regex: new RegExp(`^${item.name.trim()}$`, "i") },
        });
      }

      if (!recipe || !Array.isArray(recipe.ingredients)) continue;

      for (const recipeIng of recipe.ingredients) {
        const ingId = recipeIng.ingredient;
        const requiredPerDish = Number(recipeIng.quantity) || 0;
        const totalRestore = requiredPerDish * orderQty;

        if (totalRestore <= 0) continue;

        const ingredientDoc = await Ingredient.findOne({
          _id: ingId,
          restaurant: restaurantId,
        });

        if (ingredientDoc) {
          const stockBefore = ingredientDoc.currentStock;
          const stockAfter = stockBefore + totalRestore;
          ingredientDoc.currentStock = stockAfter;
          await ingredientDoc.save();

          await StockMovement.create({
            restaurant: restaurantId,
            ingredient: ingredientDoc._id,
            ingredientName: ingredientDoc.name,
            quantity: totalRestore,
            unit: ingredientDoc.unit,
            type: "order_restoration",
            reason: `Order Cancelled #${order.orderId || order._id.toString().slice(-6).toUpperCase()}`,
            referenceId: order._id.toString(),
            stockBefore,
            stockAfter,
            date: new Date(),
          });
        }
      }
    }

    order.stockRestored = true;
    await Order.updateOne({ _id: order._id }, { $set: { stockRestored: true } });

    return { success: true, message: "Stock restored successfully" };
  } catch (err) {
    console.error("Error restoring stock for order:", err);
    return { success: false, error: err.message };
  }
}
