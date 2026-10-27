/**
 * Pet Protocols - Restaurant Pickup Capability Helper
 * Evaluates whether a restaurant document or collection of restaurants allows self-pickup.
 */

export function getRestaurantPickupCapability(restaurant) {
  if (!restaurant || typeof restaurant !== "object") {
    return {
      isSupported: false,
      isUnknown: true,
      reason: "Kitchen details are unavailable to verify pickup capability.",
    };
  }

  const hasDeliverySettings = restaurant.deliverySettings !== undefined && restaurant.deliverySettings !== null;
  const hasOrderTypes = restaurant.orderTypes !== undefined && restaurant.orderTypes !== null;

  // If neither deliverySettings nor orderTypes is present, capability is unknown
  if (!hasDeliverySettings && !hasOrderTypes) {
    return {
      isSupported: false,
      isUnknown: true,
      reason: "Self-pickup capability cannot be confirmed for this kitchen.",
    };
  }

  const pickupEnabled =
    restaurant.deliverySettings?.pickupEnabled !== false &&
    restaurant.orderTypes?.pickup !== false;

  if (!pickupEnabled) {
    return {
      isSupported: false,
      isUnknown: false,
      reason: `${restaurant.name || "This kitchen"} does not offer self-pickup.`,
    };
  }

  return {
    isSupported: true,
    isUnknown: false,
    reason: null,
  };
}

export function areAllRestaurantsPickupEnabled(restaurants = []) {
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return { isSupported: true, isUnknown: false, reason: null };
  }

  for (const r of restaurants) {
    const cap = getRestaurantPickupCapability(r);
    if (!cap.isSupported) {
      return cap;
    }
  }

  return { isSupported: true, isUnknown: false, reason: null };
}
