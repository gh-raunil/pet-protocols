import mongoose from "mongoose";

const OfferSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Offer title is required"],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: [true, "Offer description is required"],
      trim: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
      index: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat", "custom"],
      default: "percentage",
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    minOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    image: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    creatorRole: {
      type: String,
      enum: ["superadmin", "restaurant_admin"],
      default: "restaurant_admin",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying active offers
OfferSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
OfferSchema.index({ restaurant: 1, isActive: 1 });

if (mongoose.models.Offer) {
  delete mongoose.models.Offer;
}
const Offer = mongoose.model("Offer", OfferSchema);

export default Offer;
