import mongoose from 'mongoose';

const NotificationOutboxSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
      index: true,
    },
    orderId: {
      type: String,
      default: '',
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: false,
      index: true,
    },
    recipient: {
      type: {
        type: String,
        enum: ['customer', 'restaurant_admins', 'delivery_staff', 'user'],
        required: true,
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      preferenceKey: {
        type: String,
        default: null,
      },
    },
    channel: {
      type: String,
      enum: ['web_push', 'in_app', 'all'],
      default: 'all',
    },
    payload: {
      title: { type: String, required: true },
      body: { type: String, required: true },
      icon: { type: String, default: '/icons/icon-192x192.png' },
      badge: { type: String, default: '/icons/badge-96x96.png' },
      url: { type: String, default: '/' },
      tag: { type: String, default: '' },
      data: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'delivered', 'failed', 'dead_letter'],
      default: 'pending',
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    nextRetryAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    leaseToken: {
      type: String,
      default: null,
    },
    leaseExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    deliveryDetails: {
      sentCount: { type: Number, default: 0 },
      targetCount: { type: Number, default: 0 },
      deliveredAt: { type: Date, default: null },
      responseStatusCode: { type: Number, default: null },
    },
    errorDetails: {
      message: { type: String, default: null },
      statusCode: { type: Number, default: null },
      lastErrorAt: { type: Date, default: null },
      permanent: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Compound indexes for polling and worker concurrency
NotificationOutboxSchema.index({ status: 1, nextRetryAt: 1, leaseExpiresAt: 1 });
NotificationOutboxSchema.index({ order: 1, eventType: 1 });
NotificationOutboxSchema.index({ restaurant: 1, createdAt: -1 });

export default mongoose.models.NotificationOutbox ||
  mongoose.model('NotificationOutbox', NotificationOutboxSchema);
