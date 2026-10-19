import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    image: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "",
    },
    foodType: {
      type: String,
      default: "veg",
    },
  },
  { _id: false }
);

const StatusHistoryItemSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"],
    },
    changedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    changedBy: {
      userId: { type: String, default: null },
      role: { type: String, default: null },
      name: { type: String, default: null },
    },
    note: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const DeliveryTrackingLocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    accuracy: {
      type: Number,
      default: null,
      min: 0,
    },
    heading: {
      type: Number,
      default: null,
      min: 0,
      max: 360,
    },
    speed: {
      type: Number,
      default: null,
      min: 0,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const DeliveryTrackingSchema = new mongoose.Schema(
  {
    isLive: {
      type: Boolean,
      default: false,
    },
    currentLocation: {
      type: DeliveryTrackingLocationSchema,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    endReason: {
      type: String,
      enum: ["delivered", "cancelled", "manually_ended", null],
      default: null,
    },
    lastUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    items: [OrderItemSchema],
    address: {
      fullName: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      pincode: String,
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      recipientName: { type: String, default: "" },
      recipientPhone: { type: String, default: "" },
      isDifferentRecipient: { type: Boolean, default: false },
    },
    customerLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    couponCode: {
      type: String,
      default: "",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentId: {
      type: String,
      default: () => `PAY_MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    },
    orderId: {
      type: String,
      default: () => `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    },
    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
    },
    payloadHash: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "test_paid", "failed", "refund_pending", "refunded", "reconciliation_required"],
      default: "test_paid",
    },
    inventoryStatus: {
      type: String,
      enum: ["pending", "deducted", "failed", "reconciliation_required"],
      default: "pending",
    },
    refundDetails: {
      status: {
        type: String,
        enum: ["none", "pending", "processing", "processed", "failed", "reconciliation_required"],
        default: "none",
      },
      dispatchState: {
        type: String,
        enum: ["none", "prepared", "dispatching", "confirmed", "failed", "quarantined"],
        default: "none",
      },
      refundId: { type: String, default: null },
      opKey: { type: String, default: null },
      idempotencyKey: { type: String, default: null, trim: true },
      paymentId: { type: String, default: null },
      amountPaise: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      requestFingerprint: { type: String, default: null },
      leaseToken: { type: String, default: null },
      leaseGeneration: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      reason: { type: String, default: "" },
      error: { type: String, default: null },
      initiatedBy: { type: String, default: null },
      retryCount: { type: Number, default: 0 },
      reconciled: { type: Boolean, default: false },
      gatewayStatus: { type: String, default: null },
      requiresManualReconciliation: { type: Boolean, default: false },
      processedAt: { type: Date, default: null },
      lastAttemptAt: { type: Date, default: null },
    },
    paymentMethod: {
      type: String,
      default: "Mock Test Payment",
    },
    codPaymentHandler: {
      id: { type: String, default: null },
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      amount: { type: Number, default: 0 },
      collected: { type: Boolean, default: false },
      collectedAt: { type: Date, default: null },
      settledWithManager: { type: Boolean, default: false },
      settledAt: { type: Date, default: null },
      settledBy: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        name: { type: String, default: "" },
      },
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"],
      default: "pending",
    },
    statusHistory: {
      type: [StatusHistoryItemSchema],
      default: function () {
        return [
          {
            status: this.status || "pending",
            changedAt: this.createdAt || new Date(),
            changedBy: { role: "system", name: "System" },
            note: "Order placed and waiting for restaurant confirmation",
          },
        ];
      },
    },
    notes: {
      type: String,
      default: "",
    },
    stockDeducted: {
      type: Boolean,
      default: false,
    },
    stockDeduction: {
      status: {
        type: String,
        enum: ["not_deducted", "in_progress", "completed", "partial_failed", "failed"],
        default: "not_deducted",
      },
      leaseToken: { type: String, default: null },
      leaseGeneration: { type: Number, default: 0 },
      deductedIngredients: [
        {
          ingredient: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient" },
          ingredientName: { type: String, default: "" },
          quantity: { type: Number, default: 0 },
          movementId: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement" },
          opKey: { type: String, default: "" },
          deductedAt: { type: Date, default: Date.now },
        },
      ],
      missingRequirements: [
        {
          product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          productName: { type: String, default: "" },
          ingredient: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient" },
          requiredQuantity: { type: Number },
          availableStock: { type: Number },
          reason: { type: String, default: "" },
        },
      ],
      lastError: { type: String, default: null },
      attemptCount: { type: Number, default: 0 },
      lastAttemptAt: { type: Date, default: null },
    },
    deductedIngredients: [
      {
        ingredient: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient" },
        ingredientName: { type: String, default: "" },
        quantity: { type: Number, default: 0 },
        unit: { type: String, default: "" },
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productName: { type: String, default: "" },
      },
    ],
    stockRestored: {
      type: Boolean,
      default: false,
    },
    stockRestoration: {
      status: {
        type: String,
        enum: ["not_restored", "in_progress", "completed", "partial_failed", "failed"],
        default: "not_restored",
      },
      leaseToken: { type: String, default: null },
      leaseGeneration: { type: Number, default: 0 },
      restoredIngredients: [
        {
          ingredient: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient" },
          ingredientName: { type: String, default: "" },
          quantity: { type: Number, default: 0 },
          movementId: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement" },
          opKey: { type: String, default: "" },
          restoredAt: { type: Date, default: Date.now },
        },
      ],
      missingRequirements: [
        {
          product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          productName: { type: String, default: "" },
          reason: { type: String, default: "" },
        },
      ],
      lastError: { type: String, default: null },
      attemptCount: { type: Number, default: 0 },
      lastAttemptAt: { type: Date, default: null },
    },
    assignedDeliveryStaff: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      assignedAt: { type: Date },
    },
    codPaymentHandler: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      amount: { type: Number, default: 0 },
      collected: { type: Boolean, default: false },
      collectedAt: { type: Date },
      settledWithManager: { type: Boolean, default: false },
      settledAt: { type: Date },
    },
    deliveryTracking: {
      type: DeliveryTrackingSchema,
      default: () => ({
        isLive: false,
        currentLocation: null,
        startedAt: null,
        endedAt: null,
        endReason: null,
        lastUpdatedAt: null,
      }),
    },
    deliveryDistanceKm: {
      type: Number,
      default: null,
    },
    isOutOfRange: {
      type: Boolean,
      default: false,
    },
    acceptedOutOfRange: {
      type: Boolean,
      default: false,
    },
    acceptedOutOfRangeBy: {
      userId: { type: String, default: null },
      name: { type: String, default: "" },
      role: { type: String, default: "" },
      acceptedAt: { type: Date, default: null },
    },
    cancellationReason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Lifecycle transition validation rules
OrderSchema.methods.canTransitionTo = function (nextStatus) {
  const current = this.status || "pending";
  if (current === nextStatus) return true; // Idempotent check
  if (["delivered", "cancelled"].includes(current)) {
    return false; // Terminal states cannot change
  }
  const allowed = {
    pending: ["confirmed", "preparing", "cancelled"],
    confirmed: ["preparing", "ready", "cancelled"],
    preparing: ["ready", "out_for_delivery", "delivered", "cancelled"],
    ready: ["out_for_delivery", "delivered", "cancelled"],
    out_for_delivery: ["delivered", "cancelled"],
  };
  return Array.isArray(allowed[current]) && allowed[current].includes(nextStatus);
};

// Persistent status transition appender with idempotency, legacy fallback, and tracking coordination
OrderSchema.methods.addStatusTransition = function (nextStatus, actor = {}, note = "") {
  if (!this.statusHistory || !Array.isArray(this.statusHistory)) {
    this.statusHistory = [];
  }

  // Backward compatibility: If order has no history yet, seed the current status
  if (this.statusHistory.length === 0 && this.status && this.status !== nextStatus) {
    this.statusHistory.push({
      status: this.status,
      changedAt: this.createdAt || new Date(),
      changedBy: { role: "system", name: "System" },
      note: "Initial order status",
    });
  }

  // Idempotency: If already at nextStatus and last entry matches, avoid duplicate
  const lastEntry = this.statusHistory[this.statusHistory.length - 1];
  if (this.status === nextStatus && lastEntry?.status === nextStatus) {
    return false; // Already recorded, no-op
  }

  this.status = nextStatus;
  this.statusHistory.push({
    status: nextStatus,
    changedAt: new Date(),
    changedBy: {
      userId: actor?.userId ? String(actor.userId) : null,
      role: actor?.role || null,
      name: actor?.name || null,
    },
    note: typeof note === "string" ? note.trim() : "",
  });

  // Lifecycle coordination with live delivery tracking
  if (nextStatus === "out_for_delivery") {
    if (!this.isPickupOrder()) {
      this.startDeliveryTracking(actor);
    }
  } else if (nextStatus === "delivered") {
    this.stopDeliveryTracking("delivered");
  } else if (nextStatus === "cancelled") {
    this.stopDeliveryTracking("cancelled");
  }

  return true;
};

// Detect if order is a customer counter pickup rather than a delivery
OrderSchema.methods.isPickupOrder = function () {
  const method = String(this.paymentMethod || "").toLowerCase();
  const notes = String(this.notes || "").toLowerCase();
  const addressType = String(this.address?.addressType || "").toLowerCase();
  return (
    method.includes("pickup") ||
    method.includes("cop") ||
    notes.includes("[pickup]") ||
    addressType.includes("pickup")
  );
};

// Start live delivery tracking session on authorized delivery dispatch
OrderSchema.methods.startDeliveryTracking = function (actor = {}) {
  if (this.isPickupOrder()) {
    return { success: false, reason: "pickup_order", message: "Pickup orders do not support GPS delivery tracking." };
  }
  if (["delivered", "cancelled"].includes(this.status)) {
    return { success: false, reason: "terminal_state", message: `Cannot start tracking on ${this.status} order.` };
  }
  if (this.status !== "out_for_delivery") {
    return { success: false, reason: "invalid_status", message: `Tracking requires order status to be 'out_for_delivery', current is '${this.status}'.` };
  }

  if (!this.deliveryTracking) {
    this.deliveryTracking = {};
  }

  if (this.deliveryTracking.isLive) {
    return { success: true, alreadyLive: true };
  }

  const now = new Date();
  this.deliveryTracking.isLive = true;
  this.deliveryTracking.startedAt = this.deliveryTracking.startedAt || now;
  this.deliveryTracking.endedAt = null;
  this.deliveryTracking.endReason = null;
  this.deliveryTracking.lastUpdatedAt = now;

  return { success: true, alreadyLive: false };
};

// Reusable static validation for GPS coordinate payloads
OrderSchema.statics.validateLocationPayload = function (coords = {}) {
  const lat = Number(coords?.latitude);
  const lng = Number(coords?.longitude);

  if (
    coords?.latitude === undefined || coords?.latitude === null ||
    coords?.longitude === undefined || coords?.longitude === null ||
    isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90 ||
    isNaN(lng) || !isFinite(lng) || lng < -180 || lng > 180
  ) {
    return {
      isValid: false,
      reason: "invalid_coordinates",
      message: "Latitude must be between -90 and 90, Longitude must be between -180 and 180.",
    };
  }

  let accuracy = null;
  if (coords.accuracy !== undefined && coords.accuracy !== null) {
    const acc = Number(coords.accuracy);
    if (!isNaN(acc) && isFinite(acc) && acc >= 0) {
      accuracy = acc;
    } else {
      return { isValid: false, reason: "invalid_coordinates", message: "Accuracy must be a non-negative number." };
    }
  }

  let heading = null;
  if (coords.heading !== undefined && coords.heading !== null) {
    const hdg = Number(coords.heading);
    if (!isNaN(hdg) && isFinite(hdg) && hdg >= 0 && hdg <= 360) {
      heading = hdg;
    } else {
      return { isValid: false, reason: "invalid_coordinates", message: "Heading must be a number between 0 and 360." };
    }
  }

  let speed = null;
  if (coords.speed !== undefined && coords.speed !== null) {
    const spd = Number(coords.speed);
    if (!isNaN(spd) && isFinite(spd) && spd >= 0) {
      speed = spd;
    } else {
      return { isValid: false, reason: "invalid_coordinates", message: "Speed must be a non-negative number." };
    }
  }

  let recordedAt = new Date();
  if (coords.recordedAt) {
    const rDate = new Date(coords.recordedAt);
    if (!isNaN(rDate.getTime())) {
      // Forward clock-skew drift guard: Allow up to 60 seconds of legitimate forward skew
      // for network transit and device clock jitter. Reject excessive future timestamps
      // to prevent tracking session poisoning.
      const maxFutureAllowed = Date.now() + 60 * 1000;
      if (rDate.getTime() > maxFutureAllowed) {
        return {
          isValid: false,
          reason: "future_timestamp",
          message: "Location timestamp cannot be more than 60 seconds in the future.",
        };
      }
      recordedAt = rDate;
    }
  }

  return {
    isValid: true,
    data: {
      latitude: lat,
      longitude: lng,
      accuracy,
      heading,
      speed,
      recordedAt,
    },
  };
};

// Safe update of live delivery location with strict coordinate validation
OrderSchema.methods.updateDeliveryLocation = function (coords = {}, actor = {}) {
  if (this.isPickupOrder()) {
    return { success: false, reason: "pickup_order", message: "Pickup orders do not support GPS delivery tracking." };
  }
  if (this.status !== "out_for_delivery") {
    return { success: false, reason: "not_in_transit", message: `Cannot update location because order is '${this.status}', not 'out_for_delivery'.` };
  }

  if (!this.deliveryTracking) {
    this.deliveryTracking = { isLive: false, currentLocation: null };
  }

  if (!this.deliveryTracking.isLive) {
    this.startDeliveryTracking(actor);
  }

  const validation = (this.constructor.validateLocationPayload || OrderSchema.statics.validateLocationPayload)(coords);
  if (!validation.isValid) {
    return {
      success: false,
      reason: validation.reason,
      message: validation.message,
    };
  }

  const { latitude, longitude, accuracy, heading, speed, recordedAt } = validation.data;

  // Reject out-of-order or duplicate/stale update if incoming recordedAt is older than or equal to currently stored location
  if (
    this.deliveryTracking.currentLocation?.recordedAt &&
    recordedAt.getTime() <= new Date(this.deliveryTracking.currentLocation.recordedAt).getTime()
  ) {
    return {
      success: false,
      reason: "stale_timestamp",
      message: "Stale location update received with older timestamp than current location.",
    };
  }

  const now = new Date();
  this.deliveryTracking.currentLocation = {
    latitude,
    longitude,
    accuracy,
    heading,
    speed,
    recordedAt,
  };
  this.deliveryTracking.lastUpdatedAt = now;

  return {
    success: true,
    location: this.deliveryTracking.currentLocation,
  };
};

// Terminate live delivery tracking session on delivery or cancellation
OrderSchema.methods.stopDeliveryTracking = function (reason = "delivered") {
  if (!this.deliveryTracking) {
    this.deliveryTracking = { isLive: false, currentLocation: null };
  }

  const validReasons = ["delivered", "cancelled", "manually_ended"];
  const sanitizedReason = validReasons.includes(reason) ? reason : "manually_ended";

  const now = new Date();
  const wasLive = Boolean(this.deliveryTracking.isLive);
  this.deliveryTracking.isLive = false;
  this.deliveryTracking.endedAt = this.deliveryTracking.endedAt || now;
  this.deliveryTracking.endReason = sanitizedReason;
  this.deliveryTracking.lastUpdatedAt = now;

  return { success: true, wasLive };
};

// Customer-safe representation: strictly hides driver coordinates unless actively out_for_delivery
OrderSchema.methods.getCustomerTrackingView = function () {
  const tracking = this.deliveryTracking || {};
  const isActivelyDelivering = this.status === "out_for_delivery" && Boolean(tracking.isLive);

  const destination = {
    fullName: this.address?.fullName || "",
    phone: this.address?.phone || "",
    street: this.address?.street || "",
    city: this.address?.city || "",
    state: this.address?.state || "",
    pincode: this.address?.pincode || "",
    latitude: typeof this.address?.latitude === "number" ? this.address.latitude : null,
    longitude: typeof this.address?.longitude === "number" ? this.address.longitude : null,
    recipientName: this.address?.recipientName || null,
    recipientPhone: this.address?.recipientPhone || null,
    isDifferentRecipient: Boolean(this.address?.isDifferentRecipient),
  };

  const customerLocation = this.customerLocation && typeof this.customerLocation.latitude === "number"
    ? {
        latitude: this.customerLocation.latitude,
        longitude: this.customerLocation.longitude,
        accuracy: this.customerLocation.accuracy ?? null,
        updatedAt: this.customerLocation.updatedAt || null,
      }
    : null;

  if (!isActivelyDelivering) {
    return {
      isLive: false,
      currentLocation: null,
      startedAt: tracking.startedAt || null,
      endedAt: tracking.endedAt || null,
      endReason: tracking.endReason || null,
      lastUpdatedAt: tracking.lastUpdatedAt || null,
      status: this.status,
      destination,
      customerLocation,
    };
  }

  return {
    isLive: true,
    currentLocation: tracking.currentLocation
      ? {
          latitude: tracking.currentLocation.latitude,
          longitude: tracking.currentLocation.longitude,
          accuracy: tracking.currentLocation.accuracy ?? null,
          heading: tracking.currentLocation.heading ?? null,
          speed: tracking.currentLocation.speed ?? null,
          recordedAt: tracking.currentLocation.recordedAt || null,
        }
      : null,
    startedAt: tracking.startedAt || null,
    endedAt: null,
    endReason: null,
    lastUpdatedAt: tracking.lastUpdatedAt || null,
    status: this.status,
    destination,
    customerLocation,
  };
};

// Static helper to sanitize tracking on lean or plain order objects
OrderSchema.statics.sanitizeTrackingForCustomer = function (orderObj) {
  if (!orderObj) return null;
  const status = orderObj.status || "pending";
  const tracking = orderObj.deliveryTracking || {};
  const isActivelyDelivering = status === "out_for_delivery" && Boolean(tracking.isLive);

  const destination = {
    fullName: orderObj.address?.fullName || "",
    phone: orderObj.address?.phone || "",
    street: orderObj.address?.street || "",
    city: orderObj.address?.city || "",
    state: orderObj.address?.state || "",
    pincode: orderObj.address?.pincode || "",
    latitude: typeof orderObj.address?.latitude === "number" ? orderObj.address.latitude : null,
    longitude: typeof orderObj.address?.longitude === "number" ? orderObj.address.longitude : null,
    recipientName: orderObj.address?.recipientName || null,
    recipientPhone: orderObj.address?.recipientPhone || null,
    isDifferentRecipient: Boolean(orderObj.address?.isDifferentRecipient),
  };

  const customerLocation = orderObj.customerLocation && typeof orderObj.customerLocation.latitude === "number"
    ? {
        latitude: orderObj.customerLocation.latitude,
        longitude: orderObj.customerLocation.longitude,
        accuracy: orderObj.customerLocation.accuracy ?? null,
        updatedAt: orderObj.customerLocation.updatedAt || null,
      }
    : null;

  if (!isActivelyDelivering) {
    return {
      isLive: false,
      currentLocation: null,
      startedAt: tracking.startedAt || null,
      endedAt: tracking.endedAt || null,
      endReason: tracking.endReason || null,
      lastUpdatedAt: tracking.lastUpdatedAt || null,
      status,
      destination,
      customerLocation,
    };
  }

  return {
    isLive: true,
    currentLocation: tracking.currentLocation
      ? {
          latitude: tracking.currentLocation.latitude,
          longitude: tracking.currentLocation.longitude,
          accuracy: tracking.currentLocation.accuracy ?? null,
          heading: tracking.currentLocation.heading ?? null,
          speed: tracking.currentLocation.speed ?? null,
          recordedAt: tracking.currentLocation.recordedAt || null,
        }
      : null,
    startedAt: tracking.startedAt || null,
    endedAt: null,
    endReason: null,
    lastUpdatedAt: tracking.lastUpdatedAt || null,
    status,
    destination,
    customerLocation,
  };
};


// Compound and query performance indexes based on actual application queries
OrderSchema.index({ restaurant: 1, status: 1, createdAt: -1 });
OrderSchema.index({ restaurant: 1, createdAt: -1 });
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ "address.phone": 1, createdAt: -1 });
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ "deliveryTracking.isLive": 1 }, { sparse: true });

// Database-enforced uniqueness for Razorpay paid orders (SEC-04)
// Uses a partial index so mock payments and pending COD orders are unaffected
OrderSchema.index(
  { paymentId: 1, restaurant: 1 },
  {
    unique: true,
    partialFilterExpression: {
      paymentStatus: "paid",
      paymentId: { $type: "string" },
    },
  }
);

// Database-enforced uniqueness for client checkout idempotency
OrderSchema.index(
  { restaurant: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

// Delete existing compiled model in dev if any
delete mongoose.models.Order;

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
