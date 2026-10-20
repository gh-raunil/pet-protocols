import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      default: 'Home', // Home, Work, Other
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    street: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
    },
    role: {
      type: String,
      enum: ['superadmin', 'restaurant_admin', 'customer', 'admin', 'user', 'staff'],
      default: 'customer',
    },
    staffRole: {
      type: String,
      default: 'Staff',
      trim: true,
    },
    staffRoles: {
      type: [String],
      default: ['Kitchen'],
    },
    roleTitle: {
      type: String,
      default: '',
      trim: true,
    },
    permissions: {
      type: [String],
      default: [
        'orders_view',
        'orders_update',
        'products_view',
        'customers_view',
      ],
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'inactive'],
      default: 'active',
    },
    image: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v || typeof v !== "string") return true;
          return !(v.startsWith("data:") && v.length > 50000);
        },
        message: "Inline image data exceeds 50KB limit. Please upload images to storage instead.",
      },
    },
    phone: {
      type: String,
      default: '',
    },
    addresses: {
      type: [AddressSchema],
      default: [],
    },
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      prepUpdates: { type: Boolean, default: true },
      deliveryUpdates: { type: Boolean, default: true },
      cancellationAlerts: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// Ensure fresh model schema in Next.js development HMR
if (mongoose.models.User) {
  delete mongoose.models.User;
}
const User = mongoose.model('User', UserSchema);

export default User;