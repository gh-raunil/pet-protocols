"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Building2,
  Search,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  Clock,
  Tag,
  Check,
} from "lucide-react";
import ProductCard, { ProductCardSkeleton } from "@/components/products/ProductCard";
import ProductCarousel from "@/components/products/ProductCarousel";
import FilterDrawer from "@/components/menu/FilterDrawer";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";
import {
  getRecommendedProducts,
  hasUserPreferences,
  trackProductSearch,
} from "@/lib/userPreferences";
import {
  getProductNewArrivalStatus,
  getProductActiveOffer,
  calculateItemDiscount,
} from "@/lib/offersHelper";

export default function MenuClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read filter params from URL
  const categoryFromUrl = searchParams.get("category") || "All";
  const searchFromUrl = searchParams.get("search") || "";
  const restaurantFromUrl = searchParams.get("restaurant") || "all";
  const typeFromUrl = searchParams.get("type") || "all";
  const sortFromUrl = searchParams.get("sort") || "default";
  const inStockFromUrl = searchParams.get("inStock") === "true";
  const hasOffersFromUrl = searchParams.get("hasOffers") === "true";
  const minPriceFromUrl = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
  const maxPriceFromUrl = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;

  // Data states
  const [products, setProducts] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [offers, setOffers] = useState([]);
  const [dynamicCategories, setDynamicCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setLiveTick] = useState(0);

  // Filter drawer open state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurantFromUrl);
  const [selectedType, setSelectedType] = useState(typeFromUrl);
  const [sortBy, setSortBy] = useState(sortFromUrl);
  const [onlyInStock, setOnlyInStock] = useState(inStockFromUrl);
  const [onlyOffers, setOnlyOffers] = useState(hasOffersFromUrl);
  const [minPrice, setMinPrice] = useState(minPriceFromUrl);
  const [maxPrice, setMaxPrice] = useState(maxPriceFromUrl);
  const [searchInput, setSearchInput] = useState(searchFromUrl);

  // Preference & Curated States
  const [userHasHistory, setUserHasHistory] = useState(false);
  const [recommendedList, setRecommendedList] = useState([]);
  const [newArrivalsList, setNewArrivalsList] = useState([]);

  // Periodic operational status refresh (every 15s)
  useEffect(() => {
    const timer = setInterval(() => setLiveTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  // Sync state when URL params change
  useEffect(() => {
    setSelectedCategory(categoryFromUrl);
  }, [categoryFromUrl]);

  useEffect(() => {
    setSelectedRestaurant(restaurantFromUrl);
  }, [restaurantFromUrl]);

  useEffect(() => {
    setSelectedType(typeFromUrl);
  }, [typeFromUrl]);

  useEffect(() => {
    setSortBy(sortFromUrl);
  }, [sortFromUrl]);

  useEffect(() => {
    setOnlyInStock(inStockFromUrl);
  }, [inStockFromUrl]);

  useEffect(() => {
    setOnlyOffers(hasOffersFromUrl);
  }, [hasOffersFromUrl]);

  useEffect(() => {
    setMinPrice(minPriceFromUrl);
  }, [minPriceFromUrl]);

  useEffect(() => {
    setMaxPrice(maxPriceFromUrl);
  }, [maxPriceFromUrl]);

  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  // Helper to compose and update filters without resetting others
  const updateFilters = useCallback(
    (updates) => {
      const current = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, val]) => {
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          val === "all" ||
          val === "All" ||
          val === "default" ||
          val === false
        ) {
          current.delete(key);
        } else {
          current.set(key, String(val));
        }
      });
      router.replace(`/menu?${current.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Debounce search input to URL params
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== searchFromUrl.trim()) {
        updateFilters({ search: searchInput.trim() });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, searchFromUrl, updateFilters]);

  // Load Metadata (Restaurants, Categories, Offers)
  useEffect(() => {
    async function loadMeta() {
      try {
        const [restRes, catRes, offRes] = await Promise.allSettled([
          fetch("/api/restaurants").then((r) => r.json()),
          fetch("/api/categories").then((r) => r.json()),
          fetch("/api/offers").then((r) => r.json()),
        ]);
        if (restRes.status === "fulfilled" && restRes.value?.success) {
          setRestaurants(restRes.value.restaurants || []);
        }
        if (catRes.status === "fulfilled" && catRes.value?.success) {
          setDynamicCategories(catRes.value.categories || []);
        }
        if (offRes.status === "fulfilled" && offRes.value?.success) {
          setOffers(offRes.value.offers || []);
        }
      } catch (err) {
        console.error("Failed to load menu metadata:", err);
      }
    }
    loadMeta();
  }, []);

  // Fetch Products matching backend filters
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "All") params.append("category", selectedCategory);
      if (selectedRestaurant && selectedRestaurant !== "all") params.append("restaurant", selectedRestaurant);
      if (selectedType && selectedType !== "all") params.append("type", selectedType);
      if (searchFromUrl && searchFromUrl.trim()) params.append("search", searchFromUrl.trim());

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      } else {
        setError(data.message || "Failed to load dishes from the kitchen menu service.");
      }
    } catch (err) {
      console.error("Failed to fetch menu dishes:", err);
      setError("Unable to connect to the kitchen service. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedRestaurant, selectedType, searchFromUrl]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Track search terms into personalization engine
  useEffect(() => {
    if (!searchFromUrl || searchFromUrl.trim().length < 2) return;
    const timer = setTimeout(() => {
      trackProductSearch(searchFromUrl.trim());
      setUserHasHistory(hasUserPreferences());
    }, 700);
    return () => clearTimeout(timer);
  }, [searchFromUrl]);

  // Update curated recommendations
  useEffect(() => {
    if (products.length > 0) {
      const hasHistory = hasUserPreferences();
      setUserHasHistory(hasHistory);
      if (hasHistory) {
        setRecommendedList(getRecommendedProducts(products, 8));
      } else {
        setRecommendedList([]);
      }
      setNewArrivalsList(
        products
          .filter((p) => getProductNewArrivalStatus(p, restaurants))
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 8)
      );
    }
  }, [products, restaurants]);

  // Compute absolute min & max prices across current products
  const priceBounds = useMemo(() => {
    if (!products.length) return { min: 0, max: 1000 };
    let min = Infinity;
    let max = -Infinity;
    products.forEach((p) => {
      const price = Number(p.price) || 0;
      if (price < min) min = price;
      if (price > max) max = price;
    });
    return {
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 1000 : max,
    };
  }, [products]);

  // Helper to compute effective discount for discount sorting and filtering
  const getProductDiscountInfo = useCallback((product) => {
    if (!product) return { percent: 0, amount: 0 };
    const offer = getProductActiveOffer(product, offers);
    if (offer && offer.applyMode === "automatic") {
      const disc = calculateItemDiscount(product, offer);
      const pct = product.price > 0 ? Math.round((disc / product.price) * 100) : 0;
      return { percent: pct, amount: disc };
    }
    if (product.originalPrice && product.originalPrice > product.price) {
      const diff = product.originalPrice - product.price;
      const pct = Math.round((diff / product.originalPrice) * 100);
      return { percent: pct, amount: diff };
    }
    return { percent: 0, amount: 0 };
  }, [offers]);

  // Client-side filtering & real sorting
  const displayedProducts = useMemo(() => {
    let result = [...products];

    // Availability filter
    if (onlyInStock) {
      result = result.filter((p) => p.isAvailable);
    }

    // Offers & Discounts filter
    if (onlyOffers) {
      result = result.filter((p) => {
        const disc = getProductDiscountInfo(p);
        const hasCoupon = Boolean(getProductActiveOffer(p, offers));
        return disc.percent > 0 || disc.amount > 0 || hasCoupon;
      });
    }

    // Price range filters
    if (minPrice !== undefined && !isNaN(minPrice)) {
      result = result.filter((p) => (Number(p.price) || 0) >= minPrice);
    }
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      result = result.filter((p) => (Number(p.price) || 0) <= maxPrice);
    }

    // Tie-breaker helper
    const tieBreak = (a, b) => {
      const nameComp = String(a?.name || "").localeCompare(String(b?.name || ""));
      if (nameComp !== 0) return nameComp;
      return String(a?._id || "").localeCompare(String(b?._id || ""));
    };

    // Real Sorting against actual schema values
    switch (sortBy) {
      case "popularity":
        // Real popularity based on verified ratings count
        result.sort((a, b) => {
          const popB = Number(b.numRatings || 0);
          const popA = Number(a.numRatings || 0);
          if (popB !== popA) return popB - popA;
          const rateB = Number(b.rating || 0);
          const rateA = Number(a.rating || 0);
          if (rateB !== rateA) return rateB - rateA;
          return tieBreak(a, b);
        });
        break;

      case "rating":
        // Real ratings sort with numRatings tie-break
        result.sort((a, b) => {
          const rateB = Number(b.rating || 0);
          const rateA = Number(a.rating || 0);
          if (rateB !== rateA) return rateB - rateA;
          const numB = Number(b.numRatings || 0);
          const numA = Number(a.numRatings || 0);
          if (numB !== numA) return numB - numA;
          return tieBreak(a, b);
        });
        break;

      case "price-low":
        result.sort((a, b) => {
          const diff = (Number(a.price) || 0) - (Number(b.price) || 0);
          if (diff !== 0) return diff;
          return tieBreak(a, b);
        });
        break;

      case "price-high":
        result.sort((a, b) => {
          const diff = (Number(b.price) || 0) - (Number(a.price) || 0);
          if (diff !== 0) return diff;
          return tieBreak(a, b);
        });
        break;

      case "newest":
        // Real creation date sorting
        result.sort((a, b) => {
          const timeB = new Date(b.createdAt || 0).getTime();
          const timeA = new Date(a.createdAt || 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return tieBreak(a, b);
        });
        break;

      case "discount":
        // Real discount percentage sorting
        result.sort((a, b) => {
          const discB = getProductDiscountInfo(b);
          const discA = getProductDiscountInfo(a);
          if (discB.percent !== discA.percent) return discB.percent - discA.percent;
          if (discB.amount !== discA.amount) return discB.amount - discA.amount;
          return tieBreak(a, b);
        });
        break;

      case "default":
      case "recommended":
      default:
        // Preserves default ordering (featured first, then createdAt)
        break;
    }

    return result;
  }, [products, onlyInStock, onlyOffers, minPrice, maxPrice, sortBy, getProductDiscountInfo, offers]);

  // Categories list with global counts (from /api/categories or dynamic scan)
  const categories = useMemo(() => {
    const totalGlobalDishes = dynamicCategories.reduce((sum, c) => sum + (c.dishCount || 0), 0);
    const list = [{ id: "All", label: "All Categories", icon: "✨", count: totalGlobalDishes }];
    dynamicCategories.forEach((cat) => {
      list.push({
        id: cat.name,
        label: cat.name,
        icon: cat.icon || "🍽️",
        count: typeof cat.dishCount === "number" ? cat.dishCount : 0,
      });
    });
    return list;
  }, [dynamicCategories]);

  // Group displayed products by category for section browsing when "All" is active and no search
  const categorySections = useMemo(() => {
    const groups = {};
    displayedProducts.forEach((item) => {
      const cat = item.category || "Chef Specialties";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [displayedProducts]);

  // Active filter tally for Filter button badge and status
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "All") count++;
    if (selectedRestaurant !== "all") count++;
    if (selectedType !== "all") count++;
    if (onlyInStock) count++;
    if (onlyOffers) count++;
    if (minPrice !== undefined && minPrice !== "") count++;
    if (maxPrice !== undefined && maxPrice !== "") count++;
    return count;
  }, [selectedCategory, selectedRestaurant, selectedType, onlyInStock, onlyOffers, minPrice, maxPrice]);

  const handleResetFilters = () => {
    setSearchInput("");
    router.replace("/menu", { scroll: false });
  };

  const handleApplyDrawerFilters = (filters) => {
    updateFilters({
      category: filters.category,
      restaurant: filters.restaurant,
      type: filters.type,
      inStock: filters.inStock,
      hasOffers: filters.hasOffers,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
    });
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    updateFilters({ sort: newSort });
  };

  const selectedRestaurantObj = restaurants.find((r) => r._id === selectedRestaurant);

  return (
    <main className="min-h-screen pt-24 sm:pt-28 pb-24 px-3 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto text-[var(--text-main)] transition-colors overflow-x-hidden min-w-0">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="text-center w-full max-w-2xl mx-auto mb-4 sm:mb-6 px-2 min-w-0">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 text-[var(--brand-accent)] text-[11px] font-bold uppercase tracking-wider mb-2">
          <Sparkles size={12} className="shrink-0" /> Verified Kitchen Menu
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[var(--text-main)] break-words">
          Explore Our Menu
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 max-w-lg mx-auto break-words">
          Freshly prepared food crafted upon order by certified kitchens and culinary partners.
        </p>
      </div>

      {/* ── COMPACT TOOLBAR (SEARCH + SORT + FILTER) ────────────────── */}
      <div className="p-2.5 sm:p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] mb-4 sm:mb-5 shadow-xs w-full max-w-full overflow-hidden min-w-0 space-y-2.5">
        {/* Responsive Toolbar Row */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center">
          {/* Primary Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4 pointer-events-none" />
            <input
              type="text"
              aria-label="Search dishes by name or category"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search dishes or cuisines..."
              className="h-10 w-full pl-10 pr-9 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs sm:text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-accent)] focus:ring-1 focus:ring-[var(--brand-accent)]/30 outline-none transition font-medium"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  updateFilters({ search: "" });
                }}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Controls: Compact Sort & Filter Button (Mobile: side-by-side flex; Desktop: compact shrink-0) */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Real Sorting Dropdown */}
            <div className="relative flex-1 sm:flex-initial">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                aria-label="Sort products"
                className="h-10 w-full sm:w-auto pl-3 sm:pl-3.5 pr-8 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] focus:border-[var(--brand-accent)] focus:ring-1 focus:ring-[var(--brand-accent)]/30 outline-none transition cursor-pointer appearance-none"
              >
                <option value="default">Sort: Recommended</option>
                <option value="popularity">Popularity</option>
                <option value="rating">Top Rated</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="newest">Newest First</option>
                <option value="discount">Highest Discount</option>
              </select>
              <ArrowUpDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
            </div>

            {/* Filter Drawer Trigger Button */}
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              aria-label="Open filter panel"
              className={`h-10 flex-1 sm:flex-initial px-3.5 sm:px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] ${
                activeFiltersCount > 0
                  ? "bg-[var(--brand-accent)] text-white border-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)]"
                  : "bg-[var(--bg-sub)] text-[var(--text-main)] border-[var(--border-color)] hover:border-[var(--brand-accent)]/40 hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              <SlidersHorizontal size={14} className="shrink-0" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-[var(--brand-accent)] text-[10px] font-black flex items-center justify-center ml-0.5 shadow-2xs">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── APPLIED ACTIVE FILTER PILLS ROW ────────────────────────── */}
        {(activeFiltersCount > 0 || searchFromUrl.trim()) && (
          <div className="pt-2 border-t border-[var(--border-color)] flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs flex-wrap">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mr-1">
              Active:
            </span>

            {/* Category Chip */}
            {selectedCategory !== "All" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-xs font-bold">
                <span>Category: {selectedCategory}</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ category: "All" })}
                  aria-label={`Remove category filter: ${selectedCategory}`}
                  className="hover:opacity-75 cursor-pointer ml-0.5 p-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Restaurant Chip */}
            {selectedRestaurant !== "all" && selectedRestaurantObj && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-xs font-bold">
                <Building2 size={11} />
                <span>{selectedRestaurantObj.name}</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ restaurant: "all" })}
                  aria-label="Remove kitchen filter"
                  className="hover:opacity-75 cursor-pointer ml-0.5 p-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Dietary Chip */}
            {selectedType !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-xs font-bold">
                <span className={`w-1.5 h-1.5 rounded-full ${selectedType === "veg" ? "bg-emerald-500" : "bg-rose-500"}`} />
                <span>{selectedType === "veg" ? "Vegetarian" : "Non-Vegetarian"}</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ type: "all" })}
                  aria-label="Remove diet filter"
                  className="hover:opacity-75 cursor-pointer ml-0.5 p-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* In-Stock Chip */}
            {onlyInStock && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-xs font-bold">
                <Check size={11} />
                <span>In Stock Only</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ inStock: false })}
                  aria-label="Remove in stock filter"
                  className="hover:opacity-75 cursor-pointer ml-0.5 p-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Deals Only Chip */}
            {onlyOffers && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-xs font-bold">
                <Tag size={11} />
                <span>Deals & Offers</span>
                <button
                  type="button"
                  onClick={() => updateFilters({ hasOffers: false })}
                  aria-label="Remove offers filter"
                  className="hover:opacity-75 cursor-pointer ml-0.5 p-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Price Chip */}
            {(minPrice !== undefined || maxPrice !== undefined) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-xs font-bold">
                <span>
                  Price: ₹{minPrice ?? priceBounds.min} - ₹{maxPrice ?? priceBounds.max}
                </span>
                <button
                  type="button"
                  onClick={() => updateFilters({ minPrice: undefined, maxPrice: undefined })}
                  aria-label="Remove price filter"
                  className="hover:opacity-75 cursor-pointer ml-0.5 p-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Search Query Chip */}
            {searchFromUrl.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-xs font-medium">
                <span>"{searchFromUrl.trim()}"</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    updateFilters({ search: "" });
                  }}
                  aria-label="Clear search"
                  className="hover:opacity-75 cursor-pointer ml-0.5 p-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Reset All Action */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-[var(--brand-accent)] hover:underline ml-auto cursor-pointer py-1 px-2"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Selected Kitchen Details Banner (When filtered by single restaurant) */}
        {selectedRestaurant !== "all" && selectedRestaurantObj && (() => {
          const op = getRestaurantOperationalStatus(selectedRestaurantObj);
          const flatFee = selectedRestaurantObj.chargeSettings?.flatDeliveryFee ?? 40;
          const freeAbove = selectedRestaurantObj.chargeSettings?.freeDeliveryThreshold ?? 500;
          const radius = selectedRestaurantObj.deliverySettings?.deliveryRadiusKm ?? 10;
          const minOrder = selectedRestaurantObj.orderLimits?.minOrderAmount ?? 0;

          return (
            <div className="pt-2 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-[var(--text-main)]">
                  {selectedRestaurantObj.name}
                </span>
                {op.isOpen ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    ● Open Now
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    ● Closed ({op.reason})
                  </span>
                )}
                <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                  <Clock size={11} className="text-[var(--brand-accent)]" />
                  {op.hoursText || selectedRestaurantObj.openingHours || "10:00 AM - 11:00 PM"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] flex-wrap">
                <span className="bg-[var(--bg-sub)] px-2 py-0.5 rounded-md border border-[var(--border-color)] font-medium">
                  🛵 ₹{flatFee} {freeAbove > 0 ? `(Free > ₹${freeAbove})` : ""}
                </span>
                <span className="bg-[var(--bg-sub)] px-2 py-0.5 rounded-md border border-[var(--border-color)] font-medium">
                  📍 {radius} km
                </span>
                {minOrder > 0 && (
                  <span className="bg-[var(--bg-sub)] px-2 py-0.5 rounded-md border border-[var(--border-color)] font-medium text-amber-600 dark:text-amber-400">
                    Min ₹{minOrder}
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── FILTER DRAWER MODAL ─────────────────────────────────────── */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        categories={categories}
        restaurants={restaurants}
        appliedFilters={{
          category: selectedCategory,
          restaurant: selectedRestaurant,
          type: selectedType,
          inStock: onlyInStock,
          hasOffers: onlyOffers,
          minPrice: minPrice,
          maxPrice: maxPrice,
        }}
        priceBounds={priceBounds}
        onApply={handleApplyDrawerFilters}
        onReset={handleResetFilters}
      />

      {/* ── PRODUCTS CONTENT & STATES ───────────────────────────────── */}
      {loading ? (
        /* Skeletons */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="p-8 sm:p-12 rounded-3xl bg-[var(--bg-card)] border border-rose-500/30 text-center max-w-md mx-auto my-12 shadow-sm">
          <UtensilsCrossed size={36} className="mx-auto text-rose-500 mb-3" />
          <h3 className="text-base font-bold text-[var(--text-main)] mb-1">
            Unable to Load Menu
          </h3>
          <p className="text-xs text-[var(--text-muted)] mb-5 leading-relaxed">
            {error}
          </p>
          <button
            type="button"
            onClick={fetchProducts}
            className="px-5 py-2.5 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      ) : displayedProducts.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] my-8 max-w-lg mx-auto shadow-xs">
          <UtensilsCrossed size={42} className="mx-auto text-[var(--text-muted)] mb-3 opacity-60" />
          <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)]">
            No dishes match your criteria
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-sm mx-auto leading-relaxed">
            {searchFromUrl
              ? `No dishes matched "${searchFromUrl}" with your active filters.`
              : "No dishes are currently active under your selected filters."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-5 py-2.5 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      ) : (
        /* Products Found */
        <div className="space-y-6 sm:space-y-8">
          {/* Filter Status Summary Header */}
          {(searchFromUrl.trim() || activeFiltersCount > 0) && (
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 pb-2 border-b border-[var(--border-color)]">
              <div>
                <h2 className="text-sm sm:text-base font-black text-[var(--text-main)]">
                  {searchFromUrl.trim()
                    ? `Results for "${searchFromUrl.trim()}"`
                    : selectedCategory !== "All"
                    ? `${selectedCategory} Dishes`
                    : "Filtered Dishes"}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Showing {displayedProducts.length} {displayedProducts.length === 1 ? "dish" : "dishes"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-[var(--brand-accent)] hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* 1. Curated Highlights Carousel: Shown only when browsing "All" with no specific search or heavy filters */}
          {!searchFromUrl.trim() && selectedCategory === "All" && activeFiltersCount === 0 && (
            <>
              {/* Recommended based on personal preferences */}
              {userHasHistory && recommendedList.length > 0 && (
                <ProductCarousel
                  title="Recommended For You"
                  subtitle="Curated from your recent taste preferences and search history"
                  badge="Personalized"
                  icon={<Sparkles size={18} />}
                  products={recommendedList}
                  offers={offers}
                />
              )}

              {/* Newly arrived seasonal/kitchen specialties */}
              {newArrivalsList.length > 0 && (
                <ProductCarousel
                  title="Newly Arrived Additions"
                  subtitle="Recently launched items prepared fresh by our partner kitchens"
                  badge="Fresh In"
                  icon={<Sparkles size={18} className="text-amber-500 fill-amber-500/20" />}
                  products={newArrivalsList}
                  offers={offers}
                />
              )}
            </>
          )}

          {/* 2. Main Responsive Grids */}
          {selectedCategory !== "All" || searchFromUrl.trim() || activeFiltersCount > 0 ? (
            /* Single composed responsive grid when category/search/filter is active */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
              {displayedProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  isCarousel={false}
                  offers={offers}
                />
              ))}
            </div>
          ) : (
            /* Categorized Sections when browsing all dishes */
            <div className="space-y-8 sm:space-y-10">
              {Object.entries(categorySections).map(([catName, catProducts]) => (
                <section key={catName} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-[var(--text-main)]">
                        {catName}
                      </h2>
                      <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-sub)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">
                        {catProducts.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateFilters({ category: catName })}
                      className="text-xs font-bold text-[var(--brand-accent)] hover:underline cursor-pointer"
                    >
                      Filter {catName} →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
                    {catProducts.map((product) => (
                      <ProductCard
                        key={product._id}
                        product={product}
                        isCarousel={false}
                        offers={offers}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
