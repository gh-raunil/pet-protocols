import mongoose from "mongoose";

const PaymentIntentSchema = new mongoose.Schema(
  {
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["created", "verifying", "verified", "failed", "refund_pending", "refunded", "reconciliation_required"],
      default: "created",
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    address: {
      type: Object,
      default: {},
    },
    notes: {
      type: String,
      default: "",
    },
    orderType: {
      type: String,
      enum: ["delivery", "pickup"],
      default: "delivery",
    },
    calcResult: {
      type: Object,
      required: true,
    },
    receipt: {
      type: String,
      default: "",
    },
    createdOrders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    refundDetails: {
      opKey: { type: String, default: null },
      idempotencyKey: { type: String, default: null, trim: true },
      paymentId: { type: String, default: null },
      amountPaise: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      requestFingerprint: { type: String, default: null },
      leaseToken: { type: String, default: null },
      leaseGeneration: { type: Number, default: 0 },
      dispatchState: {
        type: String,
        enum: ["none", "prepared", "dispatching", "confirmed", "failed", "quarantined"],
        default: "none",
      },
      refundId: { type: String, default: null },
      status: { type: String, default: null },
      gatewayStatus: { type: String, default: null },
      amount: { type: Number, default: 0 },
      reason: { type: String, default: "" },
      error: { type: String, default: null },
      initiatedBy: { type: String, default: null },
      retryCount: { type: Number, default: 0 },
      processedAt: { type: Date, default: null },
      lastAttemptAt: { type: Date, default: null },
      reconciled: { type: Boolean, default: false },
      requiresManualReconciliation: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

if (mongoose.models.PaymentIntent) {
  delete mongoose.models.PaymentIntent;
}

const PaymentIntent = mongoose.model("PaymentIntent", PaymentIntentSchema);
export default PaymentIntent;
