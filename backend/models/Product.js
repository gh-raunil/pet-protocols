import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    image: {
      type: String,
      default: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
    },
    category: {
      type: String,
      required: true,
      enum: ["Pizza", "Burger", "Fries", "Momos", "Cold Drinks", "Desserts", "Sides"],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ["veg", "non-veg"],
      default: "veg",
    },
  },
  { timestamps: true }
);

// Query performance indexes based on actual application queries
ProductSchema.index({ restaurant: 1, isAvailable: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ restaurant: 1, category: 1, createdAt: -1 });
ProductSchema.index({ restaurant: 1, isAvailable: 1, createdAt: -1 });
ProductSchema.index({ restaurant: 1, createdAt: -1 });

// Delete existing compiled model in dev if any
delete mongoose.models.Product;

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
