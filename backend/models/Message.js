import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Message title is required"],
      trim: true,
      maxlength: 150,
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
    },
    messageType: {
      type: String,
      enum: ["general", "announcement", "important", "warning", "promotion", "maintenance"],
      default: "general",
    },
    priority: {
      type: String,
      enum: ["normal", "high"],
      default: "normal",
    },
    recipientType: {
      type: String,
      enum: ["all", "customers", "restaurants"],
      default: "restaurants",
    },
    recipientSelection: {
      type: String,
      enum: ["all", "selected"],
      default: "all",
    },
    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "recipientModel",
      },
    ],
    recipientModel: {
      type: String,
      enum: ["Restaurant", "User"],
      default: "Restaurant",
    },
    status: {
      type: String,
      enum: ["sent", "scheduled", "draft", "disabled", "expired", "cancelled"],
      default: "sent",
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    readBy: [
      {
        recipientId: { type: String },
        readAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for query performance
MessageSchema.index({ status: 1, recipientType: 1, createdAt: -1 });
MessageSchema.index({ recipients: 1, status: 1 });
MessageSchema.index({ createdBy: 1, createdAt: -1 });

// Ensure fresh model schema in Next.js development HMR
if (mongoose.models.Message) {
  delete mongoose.models.Message;
}
const Message = mongoose.model("Message", MessageSchema);

export default Message;
