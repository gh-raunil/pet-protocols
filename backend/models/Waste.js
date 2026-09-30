import mongoose from "mongoose";

const WasteSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    ingredientName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.001, "Quantity must be greater than zero"],
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      enum: ["Spoiled", "Expired", "Damaged", "Over-prepared", "Spilled", "Other"],
      required: true,
      default: "Spoiled",
    },
    cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

WasteSchema.index({ restaurant: 1, date: -1 });

delete mongoose.models.Waste;

export default mongoose.models.Waste || mongoose.model("Waste", WasteSchema);
