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
      validate: {
        validator: function (v) {
          if (!v || typeof v !== "string") return true;
          return !(v.startsWith("data:") && v.length > 50000);
        },
        message: "Inline image data exceeds 50KB limit. Please upload images to storage instead.",
      },
    },
    bannerImage: {
      type: String,
      default: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
      validate: {
        validator: function (v) {
          if (!v || typeof v !== "string") return true;
          return !(v.startsWith("data:") && v.length > 50000);
        },
        message: "Inline bannerImage data exceeds 50KB limit. Please upload images to storage instead.",
      },
    },
    address: {
      street: { type: String, default: '' },
      buildingFloor: { type: String, default: '' },
      landmark: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      country: { type: String, default: 'India' },
      latitude: {
        type: Number,
        default: null,
        validate: {
          validator: function (v) {
            const doc = typeof this.ownerDocument === 'function' ? this.ownerDocument() : this;
            const isDeliveryActive =
              doc?.status === 'active' &&
              doc?.deliverySettings?.deliveryEnabled !== false &&
              doc?.orderTypes?.delivery !== false;

            if (isDeliveryActive) {
              if (v === null || v === undefined) return false;
              if (v === 0 && (doc?.address?.longitude === 0 || doc?.address?.longitude === null)) return false;
              return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
            }

            if (v === null || v === undefined) return true;
            return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
          },
          message: 'Active delivery restaurants require a valid non-zero latitude between -90 and 90.',
        },
      },
      longitude: {
        type: Number,
        default: null,
        validate: {
          validator: function (v) {
            const doc = typeof this.ownerDocument === 'function' ? this.ownerDocument() : this;
            const isDeliveryActive =
              doc?.status === 'active' &&
              doc?.deliverySettings?.deliveryEnabled !== false &&
              doc?.orderTypes?.delivery !== false;

            if (isDeliveryActive) {
              if (v === null || v === undefined) return false;
              if (v === 0 && (doc?.address?.latitude === 0 || doc?.address?.latitude === null)) return false;
              return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
            }

            if (v === null || v === undefined) return true;
            return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;
          },
          message: 'Active delivery restaurants require a valid non-zero longitude between -180 and 180.',
        },
      },
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
    supportEmail: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'Casual Dining',
    },
    tags: {
      type: [String],
      default: ['Pet Friendly', 'Dine-In', 'Takeaway'],
    },
    shortDescription: {
      type: String,
      default: '',
    },
    fullDescription: {
      type: String,
      default: '',
    },
    regionalSettings: {
      currency: { type: String, default: 'INR' },
      currencySymbol: { type: String, default: '₹' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      timeFormat: { type: String, default: '12-hour' },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'archived'],
      default: 'active',
    },
    // Feature Access Control (Configured by Superadmin per restaurant)
    enabledFeatures: {
      type: [String],
      default: [
        'inventory',
        'cashier',
        'kitchen',
        'delivery',
        'standards',
        'offers',
        'support',
        'analytics',
      ],
    },
    rating: {
      type: Number,
      default: null,
      min: 0,
      max: 5,
    },
    numRatings: {
      type: Number,
      default: 0,
      min: 0,
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
    // Business Operations
    isOpen: {
      type: Boolean,
      default: true,
    },
    acceptingOrders: {
      type: Boolean,
      default: true,
    },
    isTemporarilyClosed: {
      type: Boolean,
      default: false,
    },
    closureReason: {
      type: String,
      default: '',
    },
    weeklyHours: {
      type: Object,
      default: () => ({
        monday: { isOpen: true, slots: [{ open: '10:00', close: '23:00' }] },
        tuesday: { isOpen: true, slots: [{ open: '10:00', close: '23:00' }] },
        wednesday: { isOpen: true, slots: [{ open: '10:00', close: '23:00' }] },
        thursday: { isOpen: true, slots: [{ open: '10:00', close: '23:00' }] },
        friday: { isOpen: true, slots: [{ open: '10:00', close: '23:00' }] },
        saturday: { isOpen: true, slots: [{ open: '10:00', close: '23:00' }] },
        sunday: { isOpen: true, slots: [{ open: '10:00', close: '23:00' }] },
      }),
    },
    specialHours: {
      type: Array,
      default: [],
    },
    prepTimeSettings: {
      defaultMinutes: { type: Number, default: 25 },
      minMinutes: { type: Number, default: 15 },
      maxMinutes: { type: Number, default: 60 },
    },
    // Ordering
    orderTypes: {
      delivery: { type: Boolean, default: true },
      pickup: { type: Boolean, default: true },
    },
    orderingSettings: {
      autoAcceptOrders: { type: Boolean, default: false },
      requireOrderConfirmation: { type: Boolean, default: true },
      estimatedProcessingMinutes: { type: Number, default: 20 },
      autoCancelTimeoutMinutes: { type: Number, default: 15 },
      uncollectedTimeoutMinutes: { type: Number, default: 60, min: 10, max: 240 },
      autoDismissUncollectedOrders: { type: Boolean, default: true },
    },
    orderLimits: {
      minOrderAmount: { type: Number, default: 0 },
      maxOrderAmount: { type: Number, default: 50000 },
      maxItemsPerOrder: { type: Number, default: 30 },
    },
    cancellationSettings: {
      allowCustomerCancel: { type: Boolean, default: true },
      customerCancelWindowMinutes: { type: Number, default: 1 },
      allowRestaurantCancel: { type: Boolean, default: true },
      requireCancelReason: { type: Boolean, default: true },
    },
    // Menu Settings
    menuSettings: {
      productsVisible: { type: Boolean, default: true },
      showUnavailableProducts: { type: Boolean, default: true },
      defaultProductAvailable: { type: Boolean, default: true },
      outOfStockBehavior: { type: String, default: 'mark_unavailable' },
      allowCustomization: { type: Boolean, default: true },
      categoriesVisible: { type: Boolean, default: true },
      categoryOrdering: { type: String, default: 'manual' },
      hideEmptyCategories: { type: Boolean, default: true },
      menuVisible: { type: Boolean, default: true },
      showFeaturedProducts: { type: Boolean, default: true },
      showFeaturedCategories: { type: Boolean, default: true },
      enableSearch: { type: Boolean, default: true },
      enableFilters: { type: Boolean, default: true },
      showNewArrivals: { type: Boolean, default: true },
      newArrivalsDays: { type: Number, default: 14, min: 1, max: 90 },
    },
    // Payments & Charges
    paymentSettings: {
      onlinePaymentEnabled: { type: Boolean, default: true },
      codEnabled: { type: Boolean, default: true },
      copEnabled: { type: Boolean, default: true },
      testPaymentMode: { type: Boolean, default: true },
    },
    taxSettings: {
      enabled: { type: Boolean, default: false },
      percentage: { type: Number, default: 5 },
      inclusive: { type: Boolean, default: false },
      label: { type: String, default: 'GST' },
    },
    chargeSettings: {
      packagingFee: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      convenienceFee: { type: Number, default: 0 },
      flatDeliveryFee: { type: Number, default: 40 },
      freeDeliveryThreshold: { type: Number, default: 500 },
    },
    // Delivery Settings
    deliverySettings: {
      deliveryEnabled: { type: Boolean, default: true },
      pickupEnabled: { type: Boolean, default: true },
      deliveryRadiusKm: { type: Number, default: 10 },
      serviceablePincodes: { type: [String], default: [] },
      estimatedDeliveryMinutes: { type: Number, default: 35 },
      minDeliveryMinutes: { type: Number, default: 20 },
      maxDeliveryMinutes: { type: Number, default: 60 },
      staffAssignmentMethod: { type: String, default: 'manual' },
    },
    // Notifications Settings
    notificationSettings: {
      customerOrderPlaced: { type: Boolean, default: true },
      customerOrderConfirmed: { type: Boolean, default: true },
      customerOrderPreparing: { type: Boolean, default: true },
      customerOrderReady: { type: Boolean, default: true },
      customerOutForDelivery: { type: Boolean, default: true },
      customerDelivered: { type: Boolean, default: true },
      customerCancelled: { type: Boolean, default: true },
      restaurantNewOrder: { type: Boolean, default: true },
      restaurantCancelledOrder: { type: Boolean, default: true },
      restaurantPaymentFailure: { type: Boolean, default: true },
      restaurantCustomerMessage: { type: Boolean, default: true },
      channels: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
      audioChime: { type: String, default: 'bell' },
    },
    // Appearance & Branding
    appearance: {
      theme: { type: String, default: 'dark' },
      primaryColor: { type: String, default: '#f97316' },
      secondaryColor: { type: String, default: '#10141f' },
      announcement: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// Validate geographical coordinates when a restaurant is active and offering delivery
RestaurantSchema.pre('validate', function () {
  const isDeliveryActive =
    this.status === 'active' &&
    this.deliverySettings?.deliveryEnabled !== false &&
    this.orderTypes?.delivery !== false;

  if (isDeliveryActive) {
    const lat = this.address?.latitude;
    const lng = this.address?.longitude;

    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      this.invalidate(
        'address.latitude',
        'Active restaurants offering delivery require valid geographical coordinates (latitude and longitude).'
      );
      this.invalidate(
        'address.longitude',
        'Active restaurants offering delivery require valid geographical coordinates (latitude and longitude).'
      );
    } else if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (lat === 0 && lng === 0)
    ) {
      this.invalidate(
        'address.latitude',
        'Active delivery restaurant coordinates must be valid non-zero geographical numbers (-90 to 90 lat, -180 to 180 lng).'
      );
      this.invalidate(
        'address.longitude',
        'Active delivery restaurant coordinates must be valid non-zero geographical numbers (-90 to 90 lat, -180 to 180 lng).'
      );
    }
  }
});

if (mongoose.models.Restaurant) {
  delete mongoose.models.Restaurant;
}
const Restaurant = mongoose.model('Restaurant', RestaurantSchema);

export default Restaurant;
