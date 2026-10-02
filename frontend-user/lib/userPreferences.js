"use client";

const PREFS_KEY = "pet_protocols_user_prefs_v1";

/**
 * Retrieve user's tracked preferences from localStorage safely.
 */
export function getUserPreferences() {
  if (typeof window === "undefined") {
    return {
      searches: [],
      viewedDishes: {},
      categoryAffinity: {},
      restaurantAffinity: {},
      dietPreference: { veg: 0, nonVeg: 0 },
    };
  }

  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return {
        searches: [],
        viewedDishes: {},
        categoryAffinity: {},
        restaurantAffinity: {},
        dietPreference: { veg: 0, nonVeg: 0 },
      };
    }
    const parsed = JSON.parse(raw);
    return {
      searches: Array.isArray(parsed.searches) ? parsed.searches : [],
      viewedDishes: parsed.viewedDishes || {},
      categoryAffinity: parsed.categoryAffinity || {},
      restaurantAffinity: parsed.restaurantAffinity || {},
      dietPreference: parsed.dietPreference || { veg: 0, nonVeg: 0 },
    };
  } catch (err) {
    console.error("Error reading user preferences:", err);
    return {
      searches: [],
      viewedDishes: {},
      categoryAffinity: {},
      restaurantAffinity: {},
      dietPreference: { veg: 0, nonVeg: 0 },
    };
  }
}

function saveUserPreferences(prefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event("user_preferences_updated"));
  } catch (e) {
    console.error("Error saving user preferences:", e);
  }
}

/**
 * Check if the user has an existing search/interaction history.
 * If brand new without searches or views, returns false.
 */
export function hasUserPreferences() {
  const prefs = getUserPreferences();
  const hasSearches = prefs.searches.length > 0;
  const hasViews = Object.keys(prefs.viewedDishes).length > 0;
  const hasCategories = Object.keys(prefs.categoryAffinity).length > 0;
  return hasSearches || hasViews || hasCategories;
}

/**
 * Track when a user searches for dishes, ingredients, or restaurants.
 */
export function trackProductSearch(term) {
  if (!term || typeof term !== "string") return;
  const cleaned = term.trim().toLowerCase();
  if (cleaned.length < 2) return;

  const prefs = getUserPreferences();
  const existingSearches = prefs.searches.filter((s) => s !== cleaned);
  existingSearches.unshift(cleaned);
  prefs.searches = existingSearches.slice(0, 15); // keep last 15 searches
  saveUserPreferences(prefs);
}

/**
 * Track when a user views or opens a specific product card.
 */
export function trackProductView(product) {
  if (!product || !product._id) return;
  const prefs = getUserPreferences();
  const id = String(product._id);

  // Track dish view count
  const prevCount = prefs.viewedDishes[id]?.count || 0;
  prefs.viewedDishes[id] = {
    count: prevCount + 1,
    lastViewed: Date.now(),
  };

  // Track category affinity
  if (product.category) {
    const cat = String(product.category).trim();
    prefs.categoryAffinity[cat] = (prefs.categoryAffinity[cat] || 0) + 3;
  }

  // Track restaurant affinity
  const restId = product.restaurant?._id || product.restaurant;
  if (restId) {
    const rKey = String(restId);
    prefs.restaurantAffinity[rKey] = (prefs.restaurantAffinity[rKey] || 0) + 2;
  }

  // Track veg / non-veg affinity
  if (product.type === "veg") {
    prefs.dietPreference.veg = (prefs.dietPreference.veg || 0) + 1;
  } else if (product.type === "non-veg") {
    prefs.dietPreference.nonVeg = (prefs.dietPreference.nonVeg || 0) + 1;
  }

  saveUserPreferences(prefs);
}

/**
 * Track when user adds an item to cart (strong purchase intent signal).
 */
export function trackAddToCart(product) {
  if (!product || !product._id) return;
  const prefs = getUserPreferences();
  const id = String(product._id);

  if (product.category) {
    const cat = String(product.category).trim();
    prefs.categoryAffinity[cat] = (prefs.categoryAffinity[cat] || 0) + 5;
  }

  const restId = product.restaurant?._id || product.restaurant;
  if (restId) {
    const rKey = String(restId);
    prefs.restaurantAffinity[rKey] = (prefs.restaurantAffinity[rKey] || 0) + 4;
  }

  prefs.viewedDishes[id] = {
    count: (prefs.viewedDishes[id]?.count || 0) + 4,
    lastViewed: Date.now(),
  };

  saveUserPreferences(prefs);
}

/**
 * Algorithm to recommend products tailored to the user's taste and search history.
 * If user is new without any search or view history, returns an empty array [].
 */
export function getRecommendedProducts(allProducts = [], limit = 10) {
  if (!Array.isArray(allProducts) || allProducts.length === 0) return [];
  if (!hasUserPreferences()) return []; // New user with zero history -> no recommendations

  const prefs = getUserPreferences();
  const searchTerms = prefs.searches || [];
  const categoryScores = prefs.categoryAffinity || {};
  const restaurantScores = prefs.restaurantAffinity || {};
  const totalDietViews = (prefs.dietPreference.veg || 0) + (prefs.dietPreference.nonVeg || 0);

  const scoredProducts = allProducts.map((prod) => {
    let score = 0;

    // 1. Category affinity match
    if (prod.category && categoryScores[prod.category]) {
      score += categoryScores[prod.category] * 4;
    }

    // 2. Restaurant affinity match
    const restId = String(prod.restaurant?._id || prod.restaurant || "");
    if (restId && restaurantScores[restId]) {
      score += restaurantScores[restId] * 3;
    }

    // 3. Search query matching
    const prodName = String(prod.name || "").toLowerCase();
    const prodDesc = String(prod.description || "").toLowerCase();
    const prodCat = String(prod.category || "").toLowerCase();

    for (const term of searchTerms) {
      if (prodName.includes(term)) score += 8;
      else if (prodCat.includes(term)) score += 6;
      else if (prodDesc.includes(term)) score += 3;
    }

    // 4. Diet affinity
    if (totalDietViews >= 3) {
      const isVegDominant = (prefs.dietPreference.veg / totalDietViews) > 0.65;
      const isNonVegDominant = (prefs.dietPreference.nonVeg / totalDietViews) > 0.65;
      if (isVegDominant && prod.type === "veg") score += 5;
      if (isNonVegDominant && prod.type === "non-veg") score += 5;
    }

    // 5. Product quality & rating weight
    score += ((prod.rating || 4.5) - 3) * 2;

    // 6. Featured bonus
    if (prod.isFeatured) score += 2;

    return { product: prod, score };
  });

  // Filter to items that have positive relevance (score >= 4)
  const relevant = scoredProducts
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);

  return relevant.slice(0, limit);
}

/**
 * Return Best Selling products based on featured status, ratings, and review count.
 */
export function getBestSellingProducts(allProducts = [], limit = 10) {
  if (!Array.isArray(allProducts)) return [];
  const list = [...allProducts];
  list.sort((a, b) => {
    const scoreA = (a.isFeatured ? 40 : 0) + (a.numRatings || 10) * (a.rating || 4.5);
    const scoreB = (b.isFeatured ? 40 : 0) + (b.numRatings || 10) * (b.rating || 4.5);
    return scoreB - scoreA;
  });
  return list.slice(0, limit);
}

/**
 * Return Top Rated products (sorted by rating descending, then numRatings).
 */
export function getTopRatedProducts(allProducts = [], limit = 10) {
  if (!Array.isArray(allProducts)) return [];
  const list = [...allProducts];
  list.sort((a, b) => {
    const diff = (b.rating || 4.5) - (a.rating || 4.5);
    if (Math.abs(diff) > 0.05) return diff;
    return (b.numRatings || 10) - (a.numRatings || 10);
  });
  return list.slice(0, limit);
}
