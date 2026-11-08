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
    images: {
      type: [
        {
          url: { type: String, required: true, trim: true },
          alt: { type: String, default: "", trim: true, maxlength: 200 },
          order: { type: Number, default: 0 },
          isPrimary: { type: Boolean, default: false },
        },
      ],
      default: [],
      validate: [
        {
          validator: function (val) {
            return !val || val.length <= 5;
          },
          message: "A dish cannot have more than 5 images.",
        },
      ],
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
      default: null,
      min: 0,
      max: 5,
    },
    numRatings: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    reviews: {
      type: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          deleteToken: { type: String, default: null, select: false },
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
          compareAtPrice: { type: Number, default: null, min: 0 },
          portionQuantity: { type: Number, default: null, min: 0 },
          portionUnit: { type: String, default: null, trim: true },
          servingLabel: { type: String, default: null, trim: true, maxlength: 100 },
          size: { type: String, default: null, trim: true, maxlength: 50 },
          isAvailable: { type: Boolean, default: true },
          image: { type: String, default: null, trim: true },
          sortOrder: { type: Number, default: 0 },
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

// Pre-save synchronization hook for multi-image gallery
ProductSchema.pre("save", function () {
  if (Array.isArray(this.images) && this.images.length > 0) {
    // Sort by order ascending
    this.images.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    // Identify primary image or default to the first image
    let primaryIndex = this.images.findIndex((img) => img.isPrimary === true);
    if (primaryIndex === -1) {
      primaryIndex = 0;
      this.images[0].isPrimary = true;
    }

    // Ensure only one image has isPrimary = true and normalize orders
    this.images.forEach((img, idx) => {
      img.isPrimary = idx === primaryIndex;
      img.order = idx;
    });

    // Synchronize legacy `image` string for 100% backward compatibility
    if (this.images[primaryIndex]?.url) {
      this.image = this.images[primaryIndex].url;
    }
  } else if (this.image && (!this.images || this.images.length === 0)) {
    // If only `image` was set, populate `images` with the primary image
    this.images = [
      {
        url: this.image,
        alt: this.name || "",
        order: 0,
        isPrimary: true,
      },
    ];
  }
});

// Delete existing compiled model in dev if any
delete mongoose.models.Product;

export default mongoose.models.Product ||
  mongoose.model("Product", ProductSchema);
