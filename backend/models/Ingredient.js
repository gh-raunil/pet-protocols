import mongoose from "mongoose";

const IngredientSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Ingredient name is required"],
      trim: true,
    },
    unit: {
      type: String,
      required: [true, "Unit is required"],
      trim: true,
      lowercase: true,
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Current stock cannot be negative"],
    },
    minimumStock: {
      type: Number,
      default: 10,
      min: [0, "Minimum stock cannot be negative"],
    },
    costPerUnit: {
      type: Number,
      default: 0,
      min: [0, "Cost per unit cannot be negative"],
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    supplierName: {
      type: String,
      default: "",
      trim: true,
    },
    appliedRestorations: [
      {
        opKey: { type: String, required: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
        quantity: { type: Number, required: true },
        date: { type: Date, default: Date.now },
      },
    ],
    appliedDeductions: [
      {
        opKey: { type: String, required: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
        quantity: { type: Number, required: true },
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

IngredientSchema.index({ restaurant: 1, name: 1 });
IngredientSchema.index({ "appliedRestorations.opKey": 1 });
IngredientSchema.index({ "appliedDeductions.opKey": 1 });

delete mongoose.models.Ingredient;

export default mongoose.models.Ingredient || mongoose.model("Ingredient", IngredientSchema);
