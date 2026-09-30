import mongoose from "mongoose";

const StockMovementSchema = new mongoose.Schema(
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
      index: true,
    },
    ingredientName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "purchase",
        "order",
        "waste",
        "manual_addition",
        "manual_removal",
        "order_restoration",
      ],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    referenceId: {
      type: String,
      default: "",
    },
    stockBefore: {
      type: Number,
      required: true,
    },
    stockAfter: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

StockMovementSchema.index({ restaurant: 1, date: -1 });
StockMovementSchema.index({ restaurant: 1, ingredient: 1, date: -1 });

delete mongoose.models.StockMovement;

export default mongoose.models.StockMovement || mongoose.model("StockMovement", StockMovementSchema);
