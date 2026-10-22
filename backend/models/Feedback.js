import mongoose from "mongoose";

export const COMPLAINT_CATEGORIES = [
  "food_quality",
  "missing_incorrect_items",
  "packaging",
  "delivery_delay",
  "delivery_conduct",
  "payment_refund",
  "restaurant_service",
  "other",
];

export const COMPLAINT_STATUSES = ["open", "under_review", "resolved"];

const CategoryRatingsSchema = new mongoose.Schema(
  {
    foodQuality: { type: Number, min: 1, max: 5, default: null },
    packaging: { type: Number, min: 1, max: 5, default: null },
    delivery: { type: Number, min: 1, max: 5, default: null },
    service: { type: Number, min: 1, max: 5, default: null },
  },
  { _id: false }
);

const FeedbackSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    orderIdString: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5",
      },
    },
    categoryRatings: {
      type: CategoryRatingsSchema,
      default: () => ({}),
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, "Review comment cannot exceed 2000 characters"],
      default: "",
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    complaint: {
      hasComplaint: {
        type: Boolean,
        default: false,
        index: true,
      },
      category: {
        type: String,
        enum: [...COMPLAINT_CATEGORIES, null],
        default: null,
      },
      description: {
        type: String,
        trim: true,
        maxlength: [2000, "Complaint description cannot exceed 2000 characters"],
        default: "",
      },
      status: {
        type: String,
        enum: COMPLAINT_STATUSES,
        default: "open",
        index: true,
      },
      resolvedAt: {
        type: Date,
        default: null,
      },
      resolvedBy: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        name: { type: String, default: null },
        role: { type: String, default: null },
      },
      resolutionNotes: {
        type: String,
        trim: true,
        maxlength: [2000, "Resolution notes cannot exceed 2000 characters"],
        default: "",
      },
    },
    response: {
      message: {
        type: String,
        trim: true,
        maxlength: [2000, "Response cannot exceed 2000 characters"],
        default: null,
      },
      respondedAt: {
        type: Date,
        default: null,
      },
      respondedBy: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        name: { type: String, default: null },
        role: { type: String, default: null },
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
    auditHistory: [
      {
        action: { type: String, required: true },
        performedBy: {
          id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          name: { type: String, default: null },
          role: { type: String, default: null },
        },
        performedAt: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound and query performance indexes
FeedbackSchema.index({ restaurant: 1, createdAt: -1 });
FeedbackSchema.index({ restaurant: 1, rating: 1 });
FeedbackSchema.index({ restaurant: 1, "complaint.hasComplaint": 1, "complaint.status": 1 });
FeedbackSchema.index({ customer: 1, createdAt: -1 });

// Helper to safely serialize feedback for restaurant view while respecting customer privacy
FeedbackSchema.methods.toRestaurantDTO = function () {
  const doc = this.toObject ? this.toObject() : this;
  const isAnon = Boolean(doc.isAnonymous);

  let customerInfo = null;
  if (doc.customer) {
    if (isAnon) {
      customerInfo = {
        name: "Anonymous Diner",
        isAnonymous: true,
      };
    } else {
      customerInfo = {
        name: doc.customer.name || "Customer",
        isAnonymous: false,
      };
    }
  }

  return {
    _id: doc._id,
    order: doc.order,
    orderIdString: doc.orderIdString || "",
    customer: customerInfo,
    restaurant: doc.restaurant,
    rating: doc.rating,
    categoryRatings: doc.categoryRatings || {},
    comment: doc.comment || "",
    isAnonymous: isAnon,
    complaint: doc.complaint || { hasComplaint: false },
    response: doc.response?.message ? doc.response : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

// Helper to safely serialize feedback for public customer view
FeedbackSchema.methods.toCustomerDTO = function (viewerUserId = null) {
  const doc = this.toObject ? this.toObject() : this;
  const isOwner = viewerUserId && doc.customer && (
    (doc.customer._id ? doc.customer._id.toString() : doc.customer.toString()) === viewerUserId.toString()
  );

  return {
    _id: doc._id,
    order: doc.order,
    orderIdString: doc.orderIdString || "",
    rating: doc.rating,
    categoryRatings: doc.categoryRatings || {},
    comment: doc.comment || "",
    isAnonymous: doc.isAnonymous,
    customer: doc.isAnonymous && !isOwner
      ? { name: "Anonymous Diner", isAnonymous: true }
      : {
          name: isOwner ? (doc.customer?.name || "You") : (doc.customer?.name || "Customer"),
          isAnonymous: doc.isAnonymous,
        },
    complaint: isOwner
      ? doc.complaint
      : doc.complaint?.hasComplaint
      ? { hasComplaint: true, category: doc.complaint.category, status: doc.complaint.status }
      : { hasComplaint: false },
    response: doc.response?.message ? doc.response : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

delete mongoose.models.Feedback;
export default mongoose.models.Feedback || mongoose.model("Feedback", FeedbackSchema);
