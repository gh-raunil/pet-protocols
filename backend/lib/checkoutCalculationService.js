import connectDB from './db.js';
import Product from '../models/Product.js';
import Restaurant from '../models/Restaurant.js';
import Offer from '../models/Offer.js';
import { validateDeliveryServiceability } from './geoDistance.js';

/**
 * Authoritative Server-Side Checkout Calculation & Validation Service
 * 
 * Enforces:
 * 1. Product existence, pricing, availability, and owning restaurant.
 * 2. Restaurant status (must be active, not suspended/inactive, and accepting orders).
 * 3. Delivery serviceability (valid coordinates, within deliveryRadiusKm, pickup exemption).
 * 4. Minimum order limit configured by the restaurant.
 * 5. Delivery fee vs free delivery threshold vs pickup.
 * 6. Coupon code existence, active status, validity window, min order, and restaurant applicability.
 * 7. Calculates authoritative subtotal, deliveryFee, discount, and totalAmount.
 * 
 * Never trusts client-submitted discount, distance, eligibility, or total amount.
 */
export async function calculateOrderDetails({
  items,
  orderType = 'delivery',
  couponCode = '',
  address = undefined,
}) {
  await connectDB();

  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      success: false,
      status: 400,
      message: 'Cart items are required.',
    };
  }

  // 1. Fetch real products from MongoDB
  const productIds = items
    .map((item) => (item._id || item.product)?.toString())
    .filter(Boolean);

  if (productIds.length === 0) {
    return {
      success: false,
      status: 400,
      message: 'Invalid cart items provided.',
    };
  }

  const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

  // 2. Validate products and group by restaurant
  const itemsByRestaurant = new Map();

  for (const item of items) {
    const prodId = (item._id || item.product)?.toString();
    const dbProd = productMap.get(prodId);

    if (!dbProd) {
      return {
        success: false,
        status: 400,
        message: `Dish '${item.name || 'Unknown'}' is no longer available. Please update your cart.`,
      };
    }

    if (dbProd.isAvailable === false) {
      return {
        success: false,
        status: 400,
        message: `'${dbProd.name}' is currently marked out of stock. Please remove it from your cart.`,
      };
    }

    const restId = (
      dbProd.restaurant?.toString() ||
      item.restaurantId ||
      item.restaurant?._id ||
      item.restaurant
    )?.toString();

    if (!restId) {
      return {
        success: false,
        status: 400,
        message: `Dish '${dbProd.name}' cannot be associated with a valid kitchen branch.`,
      };
    }

    if (!itemsByRestaurant.has(restId)) {
      itemsByRestaurant.set(restId, []);
    }

    let authoritativePrice = Number(dbProd.price) || 0;
    let snapshotVariantName = null;
    let snapshotPortionQuantity = dbProd.portion?.quantity ?? null;
    let snapshotPortionUnit = dbProd.portion?.unit ?? null;
    let snapshotServingLabel = dbProd.portion?.servingLabel ?? null;
    let snapshotSize = dbProd.portion?.size ?? null;

    if (item.variantName && typeof item.variantName === "string" && item.variantName.trim()) {
      const cleanVarName = item.variantName.trim();
      const variantsList = Array.isArray(dbProd.variants) ? dbProd.variants : [];
      const matchedVariant = variantsList.find(
        (v) => v.name && v.name.trim().toLowerCase() === cleanVarName.toLowerCase()
      );

      if (!matchedVariant) {
        return {
          success: false,
          status: 400,
          message: `Variant '${cleanVarName}' for dish '${dbProd.name}' is invalid or no longer exists.`,
        };
      }

      if (matchedVariant.isAvailable === false) {
        return {
          success: false,
          status: 400,
          message: `Variant '${matchedVariant.name}' for '${dbProd.name}' is currently out of stock.`,
        };
      }

      authoritativePrice = Number(matchedVariant.price);
      if (isNaN(authoritativePrice) || authoritativePrice < 0) {
        authoritativePrice = Number(dbProd.price) || 0;
      }

      snapshotVariantName = matchedVariant.name;
      if (matchedVariant.portionQuantity != null) {
        snapshotPortionQuantity = matchedVariant.portionQuantity;
      }
      if (matchedVariant.portionUnit) {
        snapshotPortionUnit = matchedVariant.portionUnit;
      }
      if (matchedVariant.servingLabel) {
        snapshotServingLabel = matchedVariant.servingLabel;
      }
      if (matchedVariant.size) {
        snapshotSize = matchedVariant.size;
      }
    }

    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);

    let optionsTotal = 0;
    const sanitizedOptions = [];
    if (Array.isArray(item.selectedOptions)) {
      for (const opt of item.selectedOptions) {
        if (opt && (opt.name || opt.title)) {
          const optPrice = Math.max(0, Number(opt.price) || 0);
          optionsTotal += optPrice;
          sanitizedOptions.push({
            name: String(opt.name || opt.title),
            price: optPrice,
          });
        }
      }
    }

    itemsByRestaurant.get(restId).push({
      product: dbProd._id.toString(),
      name: dbProd.name,
      price: authoritativePrice,
      quantity: qty,
      selectedOptions: sanitizedOptions,
      optionsTotal,
      image: dbProd.image || '',
      category: dbProd.category || '',
      foodType: dbProd.foodType || dbProd.type || 'veg',
      variantName: snapshotVariantName,
      portionQuantity: snapshotPortionQuantity,
      portionUnit: snapshotPortionUnit,
      servingLabel: snapshotServingLabel,
      size: snapshotSize,
    });
  }

  if (itemsByRestaurant.size === 0) {
    return {
      success: false,
      status: 400,
      message: 'No valid items found in order.',
    };
  }

  const restaurantCalculations = [];

  for (const [restId, restItems] of itemsByRestaurant.entries()) {
    const restDoc = await Restaurant.findById(restId).lean();

    if (!restDoc) {
      return {
        success: false,
        status: 404,
        message: 'The requested restaurant branch was not found.',
      };
    }

    // P0-B: Strict Restaurant Suspension & Inactive Enforcement
    if (restDoc.status === 'suspended') {
      return {
        success: false,
        status: 400,
        suspended: true,
        message: `${restDoc.name || 'This kitchen'} is currently suspended and cannot accept orders.`,
      };
    }

    if (restDoc.status === 'inactive') {
      return {
        success: false,
        status: 400,
        message: `${restDoc.name || 'This kitchen'} is currently inactive and cannot accept orders.`,
      };
    }

    if (restDoc.isOpen === false || restDoc.isTemporarilyClosed || restDoc.acceptingOrders === false) {
      return {
        success: false,
        status: 400,
        message: `${restDoc.name || 'Kitchen'} is currently closed or not accepting orders.`,
      };
    }

    // Subtotal from authoritative DB prices + add-ons
    const restSubtotal = restItems.reduce((sum, it) => sum + (it.price + (it.optionsTotal || 0)) * it.quantity, 0);

    // Phase 2.2: Authoritative Server-Side Delivery Serviceability Validation
    let serviceabilityResult = null;
    if (address !== undefined) {
      serviceabilityResult = validateDeliveryServiceability({
        restaurant: restDoc,
        orderType,
        address,
      });

      if (!serviceabilityResult.isServiceable) {
        return {
          success: false,
          status: 400,
          code: serviceabilityResult.code || 'OUT_OF_DELIVERY_RANGE',
          message: serviceabilityResult.message,
          serviceability: serviceabilityResult,
        };
      }
    }

    // Minimum order check
    const minOrder = restDoc?.orderLimits?.minOrderAmount ?? 0;
    if (minOrder > 0 && restSubtotal < minOrder) {
      return {
        success: false,
        status: 400,
        code: 'MINIMUM_ORDER_NOT_MET',
        message: `Minimum order amount for ${restDoc.name || 'this kitchen'} is ₹${minOrder}. Please add more items.`,
      };
    }

    // Delivery fee
    const isPickup = orderType === 'pickup';
    const flatFee = restDoc?.chargeSettings?.flatDeliveryFee ?? 40;
    const freeThreshold = restDoc?.chargeSettings?.freeDeliveryThreshold ?? 500;
    const restDeliveryFee = isPickup ? 0 : restSubtotal >= freeThreshold ? 0 : flatFee;

    restaurantCalculations.push({
      restaurant: restDoc,
      restaurantId: restId,
      items: restItems,
      subtotal: restSubtotal,
      deliveryFee: restDeliveryFee,
      discount: 0,
      couponCode: '',
      totalAmount: restSubtotal + restDeliveryFee,
      qualifyingSubtotal: restSubtotal, // baseline qualifying items
      serviceability: serviceabilityResult,
      deliveryDistanceKm: serviceabilityResult?.distanceKm ?? null,
    });
  }

  const overallSubtotal = restaurantCalculations.reduce((sum, r) => sum + r.subtotal, 0);

  // Coupon validation & authoritative discount allocation across restaurants (SEC-03)
  if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
    const cleanCode = couponCode.trim().toUpperCase();
    const offer = await Offer.findOne({ code: cleanCode }).lean();

    if (!offer) {
      return {
        success: false,
        status: 400,
        message: `Invalid coupon code '${cleanCode}'.`,
      };
    }

    if (!offer.isActive) {
      return {
        success: false,
        status: 400,
        message: `Coupon code '${cleanCode}' is no longer active.`,
      };
    }

    const now = new Date();
    if (offer.startDate && new Date(offer.startDate) > now) {
      return {
        success: false,
        status: 400,
        message: `Coupon code '${cleanCode}' is not valid yet.`,
      };
    }

    if (offer.endDate && new Date(offer.endDate) <= now) {
      return {
        success: false,
        status: 400,
        message: `Coupon code '${cleanCode}' has expired.`,
      };
    }

    // Restaurant applicability:
    // If offer is restricted to a restaurant, all items must belong to that restaurant
    if (offer.restaurant) {
      const targetRestId = offer.restaurant.toString();
      const hasOtherRest = restaurantCalculations.some((r) => r.restaurantId !== targetRestId);
      if (hasOtherRest || !restaurantCalculations.some((r) => r.restaurantId === targetRestId)) {
        const primaryRest = restaurantCalculations.find((r) => r.restaurantId !== targetRestId);
        return {
          success: false,
          status: 400,
          message: `Coupon '${cleanCode}' is not applicable to ${primaryRest?.restaurant?.name || 'this kitchen'}.`,
        };
      }
    }

    // Determine qualifying items for each restaurant
    const prodIdSet =
      offer.targetType === 'products' && Array.isArray(offer.targetProducts) && offer.targetProducts.length > 0
        ? new Set(offer.targetProducts.map((p) => p.toString()))
        : null;

    let totalQualifyingSubtotal = 0;

    for (const r of restaurantCalculations) {
      let qualifyingItems = r.items;

      if (offer.restaurant && offer.restaurant.toString() !== r.restaurantId) {
        qualifyingItems = [];
      } else if (offer.targetType === 'category' && offer.targetCategory) {
        qualifyingItems = r.items.filter(
          (it) => it.category && it.category.trim().toLowerCase() === offer.targetCategory.trim().toLowerCase()
        );
      } else if (prodIdSet) {
        qualifyingItems = r.items.filter((it) => prodIdSet.has(it.product.toString()));
      }

      r.qualifyingSubtotal = qualifyingItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
      totalQualifyingSubtotal += r.qualifyingSubtotal;
    }

    const offerMinOrder = Number(offer.minOrder || 0);
    if (offerMinOrder > 0 && totalQualifyingSubtotal < offerMinOrder) {
      return {
        success: false,
        status: 400,
        message: `Minimum qualifying order of ₹${offerMinOrder} required to apply coupon '${cleanCode}'.`,
      };
    }

    if (totalQualifyingSubtotal > 0) {
      const val = Number(offer.discountValue || 0);
      let permittedOverallDiscount = 0;

      if (offer.discountType === 'percentage') {
        permittedOverallDiscount = Math.round((totalQualifyingSubtotal * val) / 100);
      } else {
        permittedOverallDiscount = Math.min(totalQualifyingSubtotal, val);
      }

      // Enforce maxDiscount if present on offer schema/document
      if (offer.maxDiscount && Number(offer.maxDiscount) > 0) {
        permittedOverallDiscount = Math.min(permittedOverallDiscount, Number(offer.maxDiscount));
      }

      // Discount cannot exceed the overall cart subtotal
      permittedOverallDiscount = Math.min(overallSubtotal, Math.max(0, permittedOverallDiscount));

      // Deterministic allocation across restaurant sub-orders (SEC-03)
      let remainingDiscount = permittedOverallDiscount;
      const numRestaurants = restaurantCalculations.length;

      for (let i = 0; i < numRestaurants; i++) {
        const r = restaurantCalculations[i];
        if (i === numRestaurants - 1) {
          const allocated = Math.min(r.subtotal, remainingDiscount);
          r.discount = allocated;
          remainingDiscount -= allocated;
        } else {
          const ratio =
            totalQualifyingSubtotal > 0
              ? r.qualifyingSubtotal / totalQualifyingSubtotal
              : r.subtotal / overallSubtotal;
          let allocated = Math.round(permittedOverallDiscount * ratio);
          allocated = Math.min(r.subtotal, Math.min(remainingDiscount, allocated));
          r.discount = allocated;
          remainingDiscount -= allocated;
        }
      }

      // If any remainder exists due to rounding or subtotal caps, allocate to restaurants with capacity
      if (remainingDiscount > 0) {
        for (const r of restaurantCalculations) {
          const room = r.subtotal - r.discount;
          if (room > 0) {
            const extra = Math.min(room, remainingDiscount);
            r.discount += extra;
            remainingDiscount -= extra;
            if (remainingDiscount === 0) break;
          }
        }
      }

      for (const r of restaurantCalculations) {
        r.couponCode = cleanCode;
      }
    }
  }

  // Finalize totals for each restaurant sub-order
  for (const r of restaurantCalculations) {
    r.totalAmount = Math.max(0, Math.round((r.subtotal + r.deliveryFee - r.discount) * 100) / 100);
  }

  const overallDeliveryFee = restaurantCalculations.reduce((sum, r) => sum + r.deliveryFee, 0);
  const overallDiscount = restaurantCalculations.reduce((sum, r) => sum + r.discount, 0);
  const overallTotalAmount = restaurantCalculations.reduce((sum, r) => sum + r.totalAmount, 0);

  return {
    success: true,
    orders: restaurantCalculations,
    primaryOrder: restaurantCalculations[0],
    subtotal: overallSubtotal,
    deliveryFee: overallDeliveryFee,
    discount: overallDiscount,
    couponCode: restaurantCalculations[0]?.couponCode || '',
    totalAmount: overallTotalAmount,
  };
}
