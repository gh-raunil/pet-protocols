// Dedicated Buy Now session-isolated checkout context
// Completely decoupled from persistent cart storage (localStorage / MongoDB Cart)

const BUY_NOW_STORAGE_KEY = "pet_protocols_buy_now_item";
const MAX_EXPIRATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Persists an independent Buy Now item selection to tab-isolated sessionStorage.
 * Never mutates or touches persistent cart items.
 */
export function setBuyNowItem(item) {
  if (typeof window === "undefined" || !item) return;
  try {
    const payload = {
      _id: (item._id || item.product)?.toString(),
      cartItemId: `buynow_${item._id || item.product}_${item.variantId || "base"}_${Date.now()}`,
      name: item.name,
      price: Number(item.price) || 0,
      image: item.image,
      category: item.category,
      type: item.type,
      isAvailable: item.isAvailable !== false,
      isFeatured: Boolean(item.isFeatured),
      description: item.description,
      quantity: Math.min(20, Math.max(1, Math.floor(Number(item.quantity) || 1))),
      restaurant: item.restaurant,
      restaurantId:
        item.restaurantId ||
        item.restaurant?._id?.toString() ||
        item.restaurant?.toString() ||
        null,
      variantId: item.variantId ? String(item.variantId).trim() : null,
      variantName: item.variantName ? String(item.variantName).trim() : null,
      compareAtPrice:
        item.compareAtPrice !== undefined &&
        item.compareAtPrice !== null &&
        !isNaN(Number(item.compareAtPrice))
          ? Number(item.compareAtPrice)
          : null,
      portionQuantity:
        item.portionQuantity !== undefined && item.portionQuantity !== null
          ? Number(item.portionQuantity)
          : null,
      portionUnit: item.portionUnit ? String(item.portionUnit).trim() : null,
      servingLabel: item.servingLabel ? String(item.servingLabel).trim() : null,
      size: item.size ? String(item.size).trim() : null,
      createdAt: Date.now(),
    };

    sessionStorage.setItem(BUY_NOW_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to store Buy Now item in sessionStorage:", err);
  }
}

/**
 * Retrieves the currently active Buy Now item from sessionStorage.
 * Validates expiration and basic integrity.
 */
export function getBuyNowItem() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BUY_NOW_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed._id) {
      clearBuyNowItem();
      return null;
    }

    // Expiration check: clear if older than MAX_EXPIRATION_MS
    if (parsed.createdAt && Date.now() - parsed.createdAt > MAX_EXPIRATION_MS) {
      clearBuyNowItem();
      return null;
    }

    return parsed;
  } catch (err) {
    console.error("Failed to parse Buy Now item from sessionStorage:", err);
    clearBuyNowItem();
    return null;
  }
}

/**
 * Clears the Buy Now session item after checkout completion or abandonment.
 * Does not touch persistent cart items.
 */
export function clearBuyNowItem() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(BUY_NOW_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear Buy Now item from sessionStorage:", err);
  }
}
