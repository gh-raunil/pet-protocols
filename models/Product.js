import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Pizza", "Burger", "Fries", "Momos", "Cold Drinks"],
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
  { timestamps: true },
);

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
