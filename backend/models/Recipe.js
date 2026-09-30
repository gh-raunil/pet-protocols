import mongoose from "mongoose";

const RecipeIngredientSchema = new mongoose.Schema(
  {
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    ingredientName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
    unit: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const RecipeSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    ingredients: [RecipeIngredientSchema],
    instructions: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

RecipeSchema.index({ restaurant: 1, product: 1 }, { unique: true });

delete mongoose.models.Recipe;

export default mongoose.models.Recipe || mongoose.model("Recipe", RecipeSchema);
