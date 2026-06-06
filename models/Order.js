import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // ← change this
    },
    items: [
      {
        product: String,
        name: String,
        price: Number,
        quantity: Number,
        image: String,
      },
    ],
    address: {
      fullName: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentId: {
      type: String,
    },
    orderId: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "preparing", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
