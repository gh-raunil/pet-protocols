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
    visiblePassword: {
      type: String,
      default: null,
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