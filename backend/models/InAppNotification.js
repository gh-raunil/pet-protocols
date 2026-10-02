import mongoose from 'mongoose';

const InAppNotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    orderId: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['order', 'promotion', 'general', 'alert'],
      default: 'order',
    },
    status: {
      type: String,
      default: '',
    },
    url: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent mongoose model overwrite in Next.js development HMR
if (mongoose.models.InAppNotification) {
  delete mongoose.models.InAppNotification;
}

const InAppNotification = mongoose.model('InAppNotification', InAppNotificationSchema);

export default InAppNotification;
