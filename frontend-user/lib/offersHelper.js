/**
 * Offers helper for matching targeted offers and calculating discounts
 * Supports:
 * - Option A: "coupon" mode (user must enter coupon code; catalog price not directly reduced)
 * - Option B: "automatic" mode (discount applied automatically without coupon code)
 * - Target Scopes: "all", "category", "products"
 */

export function getProductActiveOffer(product, offers = []) {
  if (!product || !offers || offers.length === 0) return null;

  const now = new Date();
  const restId = product.restaurant?._id || product.restaurant?.id || product.restaurant;

  for (const offer of offers) {
    if (!offer.isActive) continue;
    if (offer.startDate && new Date(offer.startDate) > now) continue;
    if (offer.endDate && new Date(offer.endDate) <= now) continue;

    // Check restaurant scope: null/undefined means platform-wide
    const offerRestId = offer.restaurant?._id || offer.restaurant?.id || offer.restaurant;
    if (offerRestId && restId && String(offerRestId) !== String(restId)) {
      continue;
    }

    // 1. Target Scope: category
    if (offer.targetType === "category") {
      if (
        product.category &&
        offer.targetCategory &&
        product.category.trim().toLowerCase() === offer.targetCategory.trim().toLowerCase()
      ) {
        return offer;
      }
      continue;
    }

    // 2. Target Scope: specific products
    if (offer.targetType === "products") {
      const targetProdIds = Array.isArray(offer.targetProducts)
        ? offer.targetProducts.map((p) => (typeof p === "object" ? String(p._id) : String(p)))
        : [];
      if (targetProdIds.includes(String(product._id))) {
        return offer;
      }
      continue;
    }

    // 3. Target Scope: all products
    if (offer.targetType === "all" || !offer.targetType) {
      return offer;
    }
  }

  return null;
}

/**
 * Calculates discount for an item or cart based on whether offer is coupon or automatic
 */
export function calculateItemDiscount(product, offer) {
  if (!offer) return 0;
  const isPercent = offer.discountType === "percentage";
  const val = Number(offer.discountValue || 0);

  if (isPercent) {
    return Math.round((product.price * val) / 100);
  }
  return Math.min(product.price, val);
}

/**
 * Checks if a product qualifies as "Newly Arrived" based on createdAt and days window
 */
export function isProductNewArrival(product, windowDays = 14) {
  if (!product || !product.createdAt) return false;
  const createdTime = new Date(product.createdAt).getTime();
  if (isNaN(createdTime)) return false;
  const windowMs = (windowDays || 14) * 86400000;
  return createdTime >= Date.now() - windowMs;
}

/**
 * Checks if a product qualifies as "Newly Arrived" respecting restaurant admin settings
 */
export function getProductNewArrivalStatus(product, restaurants = []) {
  if (!product || !product.createdAt) return false;
  if (product.isAvailable === false) return false;

  let rest = product.restaurant;
  if (typeof rest === "string" || !rest?.menuSettings) {
    const rId = typeof rest === "object" ? rest?._id : rest;
    if (rId && Array.isArray(restaurants)) {
      const found = restaurants.find((r) => String(r._id) === String(rId));
      if (found) rest = found;
    }
  }

  // Admin restaurant setting: showNewArrivals (default true) and newArrivalsDays (default 14)
  const showNewArrivals = rest?.menuSettings?.showNewArrivals ?? true;
  if (!showNewArrivals) return false;

  const windowDays = Number(rest?.menuSettings?.newArrivalsDays) || 14;
  return isProductNewArrival(product, windowDays);
}

/**
 * Evaluates cart items against offers to calculate:
 * - Option B (Automatic discounts for matching categories/products)
 * - Option A (Coupon discounts when user applies coupon code)
 */
export function calculateCartDiscounts(items = [], offers = [], appliedCouponOffer = null) {
  if (!items || items.length === 0) {
    return { autoDiscountAmount: 0, couponDiscountAmount: 0, totalDiscountAmount: 0, autoOffersApplied: [] };
  }

  const now = new Date();
  const activeOffers = (offers || []).filter((o) => {
    if (!o.isActive) return false;
    if (o.startDate && new Date(o.startDate) > now) return false;
    if (o.endDate && new Date(o.endDate) <= now) return false;
    return true;
  });

  // 1. Calculate Option B (Automatic Discounts)
  const autoOffers = activeOffers.filter((o) => o.applyMode === "automatic");
  let autoDiscountAmount = 0;
  const autoOffersApplied = [];

  // Group items by matched auto offer
  for (const item of items) {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    const itemTotal = price * qty;

    // Find best matching auto offer for this item
    const matchedAuto = autoOffers.find((offer) => {
      // Restaurant check
      const offerRestId = offer.restaurant?._id || offer.restaurant?.id || offer.restaurant;
      const itemRestId = item.restaurant?._id || item.restaurant?.id || item.restaurant || item.restaurantId;
      if (offerRestId && itemRestId && String(offerRestId) !== String(itemRestId)) {
        return false;
      }

      // Target check
      if (offer.targetType === "category") {
        return (
          item.category &&
          offer.targetCategory &&
          item.category.trim().toLowerCase() === offer.targetCategory.trim().toLowerCase()
        );
      }
      if (offer.targetType === "products") {
        const prodIds = Array.isArray(offer.targetProducts)
          ? offer.targetProducts.map((p) => (typeof p === "object" ? String(p._id) : String(p)))
          : [];
        return prodIds.includes(String(item._id));
      }
      // targetType === "all"
      return true;
    });

    if (matchedAuto) {
      const isPercent = matchedAuto.discountType === "percentage";
      const val = Number(matchedAuto.discountValue || 0);
      let disc = 0;
      if (isPercent) {
        disc = Math.round((itemTotal * val) / 100);
      } else {
        disc = Math.min(itemTotal, val * qty);
      }
      autoDiscountAmount += disc;
      if (!autoOffersApplied.some((o) => String(o._id) === String(matchedAuto._id))) {
        autoOffersApplied.push(matchedAuto);
      }
    }
  }

  // 2. Calculate Option A (Coupon Discount)
  let couponDiscountAmount = 0;
  if (appliedCouponOffer) {
    const targetRestId = appliedCouponOffer.restaurant?._id || appliedCouponOffer.restaurant?.id || appliedCouponOffer.restaurant;
    
    // Filter qualifying items for this coupon
    const qualifyingItems = items.filter((item) => {
      const itemRestId = item.restaurant?._id || item.restaurant?.id || item.restaurant || item.restaurantId;
      if (targetRestId && itemRestId && String(targetRestId) !== String(itemRestId)) {
        return false;
      }
      if (appliedCouponOffer.targetType === "category") {
        return (
          item.category &&
          appliedCouponOffer.targetCategory &&
          item.category.trim().toLowerCase() === appliedCouponOffer.targetCategory.trim().toLowerCase()
        );
      }
      if (appliedCouponOffer.targetType === "products") {
        const prodIds = Array.isArray(appliedCouponOffer.targetProducts)
          ? appliedCouponOffer.targetProducts.map((p) => (typeof p === "object" ? String(p._id) : String(p)))
          : [];
        return prodIds.includes(String(item._id));
      }
      return true;
    });

    const qualifyingSubtotal = qualifyingItems.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    // Check minOrder requirement if specified
    const minOrder = Number(appliedCouponOffer.minOrder || 0);
    if (qualifyingSubtotal > 0 && qualifyingSubtotal >= minOrder) {
      const isPercent = appliedCouponOffer.discountType === "percentage";
      const val = Number(appliedCouponOffer.discountValue || 0);
      if (isPercent) {
        couponDiscountAmount = Math.round((qualifyingSubtotal * val) / 100);
      } else {
        couponDiscountAmount = Math.min(qualifyingSubtotal, val);
      }
    }
  }

  const totalDiscountAmount = autoDiscountAmount + couponDiscountAmount;

  return {
    autoDiscountAmount,
    couponDiscountAmount,
    totalDiscountAmount,
    autoOffersApplied,
  };
}
