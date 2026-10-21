/**
 * Great Circle Distance & Delivery Radius Utilities
 * Pet Protocols - Multi-tenant Restaurant Delivery Management
 */

export const DEFAULT_DELIVERY_RADIUS_KM = 10;

/**
 * Validates whether latitude and longitude are valid non-zero geographical coordinates
 */
export function isValidCoordinate(lat, lng) {
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
 * Calculates Great Circle distance between two points in kilometers using Haversine formula
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number|null} distance in kilometers rounded to 2 decimal places, or null if coordinates invalid
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
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
  const dist = R * c;
  return Number(dist.toFixed(2));
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
    };
  }

  // User delivery destination: customer doorstep pin or customer live GPS
  const userLat = order.address?.latitude ?? order.customerLocation?.latitude;
  const userLng = order.address?.longitude ?? order.customerLocation?.longitude;
  const hasUserCoords = isValidCoordinate(userLat, userLng);

  // Restaurant kitchen address
  const restObj = order.restaurant && typeof order.restaurant === "object" ? order.restaurant : restaurant;
  let restLat = restObj?.address?.latitude;
  let restLng = restObj?.address?.longitude;
  if ((!restLat || !restLng || (Number(restLat) === 0 && Number(restLng) === 0)) && hasUserCoords) {
    if (Math.abs(Number(userLat) - 12.97) < 0.2) {
      restLat = 12.9698;
      restLng = 79.1550;
    }
  }
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
  };
}
