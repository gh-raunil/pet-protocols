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
      trim: true,
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
    preparationTime: {
      type: Number,
      default: 15,
      min: 1,
      max: 180,
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    numRatings: {
      type: Number,
      default: 12,
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    reviews: {
      type: [
        {
          userName: { type: String, default: "Customer" },
          rating: { type: Number, required: true },
          comment: { type: String, default: "" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    portion: {
      quantity: { type: Number, default: null, min: 0 },
      unit: { type: String, default: null, trim: true },
      customUnit: { type: String, default: null, trim: true, maxlength: 50 },
      servingLabel: { type: String, default: null, trim: true, maxlength: 100 },
      size: { type: String, default: null, trim: true, maxlength: 50 },
    },
    hasVariants: {
      type: Boolean,
      default: false,
    },
    variants: {
      type: [
        {
          name: { type: String, required: true, trim: true, maxlength: 100 },
          price: { type: Number, required: true, min: 0 },
          portionQuantity: { type: Number, default: null, min: 0 },
          portionUnit: { type: String, default: null, trim: true },
          servingLabel: { type: String, default: null, trim: true, maxlength: 100 },
          size: { type: String, default: null, trim: true, maxlength: 50 },
          isAvailable: { type: Boolean, default: true },
        },
      ],
      default: [],
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
