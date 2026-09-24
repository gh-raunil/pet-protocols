import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    image: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "",
    },
    foodType: {
      type: String,
      default: "veg",
    },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    items: [OrderItemSchema],
    address: {
      fullName: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentId: {
      type: String,
      default: () => `PAY_MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    },
    orderId: {
      type: String,
      default: () => `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "test_paid", "failed"],
      default: "test_paid",
    },
    paymentMethod: {
      type: String,
      default: "Mock Test Payment",
    },
    status: {
      type: String,
      enum: ["pending", "preparing", "out_for_delivery", "delivered", "cancelled"],
      default: "pending",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Compound and query performance indexes based on actual application queries
OrderSchema.index({ restaurant: 1, status: 1, createdAt: -1 });
OrderSchema.index({ restaurant: 1, createdAt: -1 });
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ "address.phone": 1, createdAt: -1 });
OrderSchema.index({ orderId: 1 });

// Delete existing compiled model in dev if any
delete mongoose.models.Order;

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
