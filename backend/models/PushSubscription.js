import mongoose from 'mongoose';

const PushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },
    userAgent: {
      type: String,
      default: '',
    },
    deviceLabel: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'disabled'],
      default: 'active',
      index: true,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent mongoose model overwrite in Next.js development HMR
if (mongoose.models.PushSubscription) {
  delete mongoose.models.PushSubscription;
}

const PushSubscription = mongoose.model('PushSubscription', PushSubscriptionSchema);

export default PushSubscription;
