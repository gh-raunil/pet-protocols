import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Recipe from "@/models/Recipe";
import Product from "@/models/Product";
import Ingredient from "@/models/Ingredient";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET() {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const [recipes, products, ingredients] = await Promise.all([
      Recipe.find({ restaurant: restaurantId }).populate("product", "name price category image isAvailable").lean(),
      Product.find({ restaurant: restaurantId }).select("name price category image isAvailable").sort({ name: 1 }).lean(),
      Ingredient.find({ restaurant: restaurantId }).select("name unit currentStock minimumStock costPerUnit").sort({ name: 1 }).lean(),
    ]);

    return NextResponse.json({
      success: true,
      recipes,
      products,
      ingredients,
    });
  } catch (error) {
    console.error("Get recipes error:", error);
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

    const { product: productId, ingredients, instructions = "" } = body;

    if (!productId) {
      return NextResponse.json({ success: false, message: "Menu product is required" }, { status: 400 });
    }
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json({ success: false, message: "At least one ingredient is required" }, { status: 400 });
    }

    await connectDB();

    const product = await Product.findOne({ _id: productId, restaurant: restaurantId });
    if (!product) {
      return NextResponse.json({ success: false, message: "Menu product not found in your restaurant" }, { status: 404 });
    }

    // Verify all ingredients belong to this restaurant
    const formattedIngredients = [];
    for (const item of ingredients) {
      const ingDoc = await Ingredient.findOne({ _id: item.ingredient, restaurant: restaurantId });
      if (ingDoc) {
        formattedIngredients.push({
          ingredient: ingDoc._id,
          ingredientName: ingDoc.name,
          quantity: Number(item.quantity) || 1,
          unit: item.unit || ingDoc.unit,
        });
      }
    }

    if (formattedIngredients.length === 0) {
      return NextResponse.json({ success: false, message: "Valid ingredients are required" }, { status: 400 });
    }

    // Upsert recipe for this product in this restaurant
    const recipe = await Recipe.findOneAndUpdate(
      { restaurant: restaurantId, product: product._id },
      {
        restaurant: restaurantId,
        product: product._id,
        productName: product.name,
        ingredients: formattedIngredients,
        instructions: instructions.trim(),
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, recipe }, { status: 201 });
  } catch (error) {
    console.error("Save recipe error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
