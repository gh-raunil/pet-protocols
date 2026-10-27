/**
 * Great Circle Distance & Delivery Radius Utilities
 * Pet Protocols - Multi-tenant Restaurant Delivery Management (Admin & Staff Portal)
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
 * Evaluates delivery distance and checks whether order is outside restaurant's delivery range
 * @param {Object} order - Order document or object
 * @param {Object} restaurant - Restaurant object (fallback if order.restaurant is unpopulated)
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

  const isPickup =
    String(order.paymentMethod || "").toLowerCase().includes("pickup") ||
    String(order.notes || "").toLowerCase().includes("[pickup]") ||
    String(order.address?.addressType || "").toLowerCase().includes("pickup");

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

/**
 * Constructs a Mappls direction URL with staff current location and customer destination
 * Format: https://www.mappls.com/direction?places={startLat},{startLng},{startLabel};{destLat},{destLng},{destLabel}
/**
 * Safely base64 encodes an ASCII string across browser and Node.js environments
 */
function safeBase64(str) {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(str);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  return "";
}

/**
 * Constructs a native Mappls Web directions URL that automatically populates
 * the origin (staff live GPS or "Current Location") and customer destination,
 * and directly triggers Mappls' route calculation engine.
 * 
 * Mappls Web routing schema:
 * https://www.mappls.com/direction-from-{origin}?-to-{destination}?@zdata={base64Payload}
 * 
 * Where payload is:
 * from+{originLng},{originLat}+to+{destLng},{destLat}+v+++{mode}+India@ind@21.127807@82.801626++0
 * 
 * @param {Object} params
 * @param {number|string} [params.startLat] - Staff / origin latitude
 * @param {number|string} [params.startLng] - Staff / origin longitude
 * @param {string} [params.startLabel] - Friendly label for start location
 * @param {number|string} params.destLat - Customer delivery destination latitude
 * @param {number|string} params.destLng - Customer delivery destination longitude
 * @param {string} [params.destLabel] - Customer name / destination label
 * @param {string} [params.mode] - Transport mode: "driving" or "biking"
 * @returns {string|null} Full Mappls directions URL
 */
export function buildMapplsDirectionUrl({
  startLat,
  startLng,
  startLabel = "Current-Location",
  destLat,
  destLng,
  destLabel = "Customer-Destination",
  mode = "driving",
}) {
  if (!isValidCoordinate(destLat, destLng)) return null;

  const hasStart = isValidCoordinate(startLat, startLng);

  // Mappls requires clean URL path segments for labels without special query delimiters
  const cleanDest = String(destLabel || "Customer-Destination")
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .trim()
    .replace(/\s+/g, "-") || "Customer-Destination";

  let cleanStart;
  let startCoord = "";
  if (hasStart) {
    cleanStart = String(startLabel || "Current-Location")
      .replace(/[^a-zA-Z0-9\s_-]/g, " ")
      .trim()
      .replace(/\s+/g, "-") || "Current-Location";
    // Mappls zdata expects lng,lat
    startCoord = `${Number(startLng).toFixed(6)},${Number(startLat).toFixed(6)}`;
  } else {
    // When start coordinate is not yet known, use Mappls' auto-GPS trigger keyword
    cleanStart = "current-location";
    startCoord = "";
  }

  // Mappls zdata expects destLng,destLat
  const destCoord = `${Number(destLng).toFixed(6)},${Number(destLat).toFixed(6)}`;
  const validMode = mode === "biking" ? "biking" : "driving";
  const country = "India@ind@21.127807@82.801626";

  const payload = `from+${startCoord}+to+${destCoord}+v+++${validMode}+${country}++0`;
  const zdata = safeBase64(payload);

  return `https://www.mappls.com/direction-from-${cleanStart}?-to-${cleanDest}?@zdata=${zdata}`;
}

/**
 * Constructs a standard Google Maps Directions URL as an alternate navigation provider
 */
export function buildGoogleMapsDirectionUrl({
  startLat,
  startLng,
  destLat,
  destLng,
}) {
  if (!isValidCoordinate(destLat, destLng)) return null;
  const originQuery = isValidCoordinate(startLat, startLng)
    ? `&origin=${Number(startLat).toFixed(6)},${Number(startLng).toFixed(6)}`
    : "";
  return `https://www.google.com/maps/dir/?api=1${originQuery}&destination=${Number(destLat).toFixed(6)},${Number(destLng).toFixed(6)}&travelmode=driving`;
}

