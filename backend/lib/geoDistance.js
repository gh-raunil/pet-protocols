/**
 * Great Circle Distance & Delivery Radius Utilities
 * Pet Protocols - Multi-tenant Restaurant Delivery Management
 */

export const DEFAULT_DELIVERY_RADIUS_KM = 10;

/**
 * Validates whether latitude and longitude are valid non-zero geographical coordinates
 */
export function isValidCoordinate(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false;
  }
  if (typeof lat === "string" && lat.trim() === "") return false;
  if (typeof lng === "string" && lng.trim() === "") return false;

  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180 &&
    !(nLat === 0 && nLng === 0)
  );
}

/**
 * Calculates Great Circle distance between two points in kilometers with full floating-point precision
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number|null} distance in kilometers (unrounded), or null if coordinates invalid
 */
export function calculateRawDistanceKm(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates Great Circle distance between two points in kilometers using Haversine formula
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number|null} distance in kilometers rounded to 2 decimal places, or null if coordinates invalid
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const rawDist = calculateRawDistanceKm(lat1, lon1, lat2, lon2);
  if (rawDist === null) return null;
  return Number(rawDist.toFixed(2));
}

/**
 * Authoritative Server-Side Delivery Serviceability Validator
 *
 * Validates delivery eligibility based on authoritative restaurant settings,
 * full-precision Haversine distance, and customer delivery address coordinates.
 *
 * @param {Object} params
 * @param {Object} params.restaurant - Authoritative Restaurant document or object
 * @param {string} [params.orderType='delivery'] - 'delivery' or 'pickup'
 * @param {Object} [params.address=null] - Customer delivery address
 * @returns {Object} Structured validation result
 */
export function validateDeliveryServiceability({
  restaurant,
  orderType = 'delivery',
  address = null,
}) {
  if (!restaurant || typeof restaurant !== 'object') {
    return {
      isServiceable: false,
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Restaurant information is missing or invalid.',
    };
  }

  const normOrderType = String(orderType || 'delivery').toLowerCase().trim();
  const isPickup = normOrderType === 'pickup';

  // 1. Pickup order evaluation
  if (isPickup) {
    const pickupEnabled =
      restaurant.deliverySettings?.pickupEnabled !== false &&
      restaurant.orderTypes?.pickup !== false;

    if (!pickupEnabled) {
      return {
        isServiceable: false,
        code: 'PICKUP_NOT_SUPPORTED',
        message: `${restaurant.name || 'This kitchen'} does not offer self-pickup.`,
      };
    }

    return {
      isServiceable: true,
      isPickup: true,
      code: 'SERVICEABLE_PICKUP',
      message: 'Self-pickup is available at this kitchen counter.',
      distanceKm: null,
      rawDistanceKm: null,
      maxRadiusKm: null,
      restaurantId: (restaurant._id || restaurant.id)?.toString(),
      restaurantName: restaurant.name || 'Kitchen',
    };
  }

  // 2. Delivery order evaluation
  const deliveryEnabled =
    restaurant.deliverySettings?.deliveryEnabled !== false &&
    restaurant.orderTypes?.delivery !== false;

  if (!deliveryEnabled) {
    return {
      isServiceable: false,
      code: 'DELIVERY_NOT_SUPPORTED',
      message: `${restaurant.name || 'This kitchen'} currently does not offer doorstep delivery.`,
    };
  }

  // Address presence
  if (!address || typeof address !== 'object') {
    return {
      isServiceable: false,
      code: 'MISSING_DELIVERY_ADDRESS',
      message: 'A complete delivery address with location coordinates is required for doorstep delivery.',
    };
  }

  // Customer coordinates validation
  const rawCustLat = address.latitude ?? address.lat;
  const rawCustLng = address.longitude ?? address.lng;

  if (rawCustLat === null || rawCustLat === undefined || rawCustLng === null || rawCustLng === undefined) {
    return {
      isServiceable: false,
      code: 'MISSING_CUSTOMER_COORDINATES',
      message: 'Delivery address is missing GPS coordinates. Please select or pin your delivery location.',
    };
  }

  if (typeof rawCustLat === 'string' && rawCustLat.trim() === '') {
    return {
      isServiceable: false,
      code: 'MISSING_CUSTOMER_COORDINATES',
      message: 'Delivery address is missing GPS coordinates. Please select or pin your delivery location.',
    };
  }

  if (typeof rawCustLng === 'string' && rawCustLng.trim() === '') {
    return {
      isServiceable: false,
      code: 'MISSING_CUSTOMER_COORDINATES',
      message: 'Delivery address is missing GPS coordinates. Please select or pin your delivery location.',
    };
  }

  const custLat = Number(rawCustLat);
  const custLng = Number(rawCustLng);

  if (custLat === 0 && custLng === 0) {
    return {
      isServiceable: false,
      code: 'INVALID_CUSTOMER_COORDINATES',
      message: 'Coordinates (0, 0) represent Null Island and cannot be used as a delivery destination.',
    };
  }

  if (!isValidCoordinate(custLat, custLng)) {
    return {
      isServiceable: false,
      code: 'INVALID_CUSTOMER_COORDINATES',
      message: 'Delivery coordinates are invalid or outside geographic limits (-90 to 90 lat, -180 to 180 lng).',
    };
  }

  // Restaurant coordinates validation
  const rawRestLat = restaurant.address?.latitude;
  const rawRestLng = restaurant.address?.longitude;

  if (!isValidCoordinate(rawRestLat, rawRestLng)) {
    return {
      isServiceable: false,
      code: 'INVALID_RESTAURANT_COORDINATES',
      message: `${restaurant.name || 'This kitchen'} has invalid or unconfigured kitchen coordinates and cannot fulfill delivery.`,
    };
  }

  const restLat = Number(rawRestLat);
  const restLng = Number(rawRestLng);

  // Restaurant delivery radius validation
  const rawRadius = restaurant.deliverySettings?.deliveryRadiusKm;
  const maxRadiusKm = Number(rawRadius);

  if (!Number.isFinite(maxRadiusKm) || maxRadiusKm <= 0) {
    return {
      isServiceable: false,
      code: 'INVALID_DELIVERY_RADIUS',
      message: `${restaurant.name || 'This kitchen'} does not have a valid delivery radius configured.`,
    };
  }

  // Haversine distance calculation (raw full precision)
  const rawDistanceKm = calculateRawDistanceKm(restLat, restLng, custLat, custLng);

  if (rawDistanceKm === null || !Number.isFinite(rawDistanceKm)) {
    return {
      isServiceable: false,
      code: 'DISTANCE_CALCULATION_FAILED',
      message: 'Unable to calculate delivery distance between kitchen and destination.',
    };
  }

  const distanceKm = Number(rawDistanceKm.toFixed(2));
  const isOutOfRange = rawDistanceKm > maxRadiusKm;

  if (isOutOfRange) {
    return {
      isServiceable: false,
      code: 'OUT_OF_DELIVERY_RANGE',
      message: `Delivery address is ${distanceKm} km away from ${restaurant.name || 'the kitchen'}, which exceeds its maximum delivery radius of ${maxRadiusKm} km.`,
      distanceKm,
      rawDistanceKm,
      maxRadiusKm,
      deliveryRadiusKm: maxRadiusKm,
      restaurantId: (restaurant._id || restaurant.id)?.toString(),
      restaurantName: restaurant.name || 'Kitchen',
    };
  }

  return {
    isServiceable: true,
    code: 'SERVICEABLE',
    message: `Delivery address is within the serviceable delivery radius (${distanceKm} km <= ${maxRadiusKm} km).`,
    distanceKm,
    rawDistanceKm,
    maxRadiusKm,
    deliveryRadiusKm: maxRadiusKm,
    restaurantId: (restaurant._id || restaurant.id)?.toString(),
    restaurantName: restaurant.name || 'Kitchen',
  };
}

/**
 * Inspects order and restaurant objects to compute distance and out-of-range status
 * @param {Object} order - Order document or object
 * @param {Object} restaurant - Restaurant document or object (fallback if order.restaurant is unpopulated)
 * @returns {Object} Comprehensive distance evaluation
 */
export function getOrderDistanceInfo(order, restaurant = null) {
  if (!order) {
    return {
      distanceKm: null,
      distFromRestaurantKm: null,
      distFromDriverKm: null,
      isOutOfRange: false,
      maxRangeKm: DEFAULT_DELIVERY_RADIUS_KM,
      userCoords: null,
      restCoords: null,
      driverCoords: null,
      hasValidDistance: false,
      isServiceable: false,
    };
  }

  // User delivery destination: customer doorstep pin or customer live GPS
  const userLat = order.address?.latitude ?? order.customerLocation?.latitude;
  const userLng = order.address?.longitude ?? order.customerLocation?.longitude;
  const hasUserCoords = isValidCoordinate(userLat, userLng);

  // Restaurant kitchen address
  const restObj = order.restaurant && typeof order.restaurant === "object" ? order.restaurant : restaurant;
  const restLat = restObj?.address?.latitude;
  const restLng = restObj?.address?.longitude;
  const hasRestCoords = isValidCoordinate(restLat, restLng);

  // Driver live location (if assigned and transmitting)
  const driverLat = order.deliveryTracking?.currentLocation?.latitude;
  const driverLng = order.deliveryTracking?.currentLocation?.longitude;
  const hasDriverCoords = isValidCoordinate(driverLat, driverLng);

  const distFromRestaurantKm =
    hasUserCoords && hasRestCoords ? calculateDistanceKm(restLat, restLng, userLat, userLng) : null;

  const distFromDriverKm =
    hasUserCoords && hasDriverCoords ? calculateDistanceKm(driverLat, driverLng, userLat, userLng) : null;

  // Standard delivery distance is measured from the restaurant to the customer
  const distanceKm = distFromRestaurantKm ?? distFromDriverKm;

  // Max delivery radius from restaurant delivery settings or default 10km
  const maxRangeKm = Number(restObj?.deliverySettings?.deliveryRadiusKm) || DEFAULT_DELIVERY_RADIUS_KM;

  const isPickup = typeof order.isPickupOrder === "function"
    ? order.isPickupOrder()
    : (
        String(order.orderType || "").toLowerCase().trim() === "pickup" ||
        String(order.paymentMethod || "").toLowerCase().includes("pickup") ||
        String(order.notes || "").toLowerCase().includes("[pickup]") ||
        String(order.address?.addressType || "").toLowerCase().includes("pickup")
      );

  const isOutOfRange = !isPickup && distanceKm !== null && distanceKm > maxRangeKm;

  return {
    distanceKm,
    distFromRestaurantKm,
    distFromDriverKm,
    isOutOfRange,
    maxRangeKm,
    userCoords: hasUserCoords ? { lat: Number(userLat), lng: Number(userLng) } : null,
    restCoords: hasRestCoords ? { lat: Number(restLat), lng: Number(restLng) } : null,
    driverCoords: hasDriverCoords ? { lat: Number(driverLat), lng: Number(driverLng) } : null,
    hasValidDistance: distanceKm !== null,
    isServiceable: isPickup ? true : (distanceKm !== null && distanceKm <= maxRangeKm),
  };
}
