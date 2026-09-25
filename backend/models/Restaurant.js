import mongoose from 'mongoose';

const RestaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    cuisineType: {
      type: [String],
      default: ['Fast Food', 'Burgers', 'Pizza'],
    },
    image: {
      type: String,
      default: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
    },
    bannerImage: {
      type: String,
      default: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
    },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    phone: {
      type: String,
      default: '',
    },
    whatsappNumber: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5,
    },
    openingHours: {
      type: String,
      default: '10:00 AM - 11:00 PM',
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    showPhoneToCustomers: {
      type: Boolean,
      default: true,
    },
    showWhatsappToCustomers: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

if (mongoose.models.Restaurant) {
  delete mongoose.models.Restaurant;
}
const Restaurant = mongoose.model('Restaurant', RestaurantSchema);

export default Restaurant;
