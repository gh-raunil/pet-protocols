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
  Check,
  Clock,
  Tag,
  ArrowUpDown,
  Filter,
  SlidersHorizontal,
} from "lucide-react";
import ProductCard, { ProductCardSkeleton } from "@/components/products/ProductCard";
import ProductCarousel from "@/components/products/ProductCarousel";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";
import {
  getRecommendedProducts,
  getBestSellingProducts,
  getTopRatedProducts,
  hasUserPreferences,
  trackProductSearch,
} from "@/lib/userPreferences";
import { getProductNewArrivalStatus } from "@/lib/offersHelper";

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

  // Data states
  const [products, setProducts] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [offers, setOffers] = useState([]);
  const [dynamicCategories, setDynamicCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setLiveTick] = useState(0);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurantFromUrl);
  const [selectedType, setSelectedType] = useState(typeFromUrl);
  const [sortBy, setSortBy] = useState(sortFromUrl);
  const [onlyInStock, setOnlyInStock] = useState(inStockFromUrl);
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

  // Sync state when URL params change (e.g. from browser back/forward or navbar search)
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

  // Client-side filtering & sorting
  const displayedProducts = useMemo(() => {
    let result = [...products];

    if (onlyInStock) {
      result = result.filter((p) => p.isAvailable);
    }

    if (sortBy === "price-low") {
      result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === "price-high") {
      result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === "rating") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "name") {
      result.sort((a, b) => {
        const nameA = typeof a?.name === "string" ? a.name : "";
        const nameB = typeof b?.name === "string" ? b.name : "";
        return nameA.localeCompare(nameB);
      });
    }

    return result;
  }, [products, onlyInStock, sortBy]);

  // Categories list with global counts (from /api/categories)
  const categories = useMemo(() => {
    const totalGlobalDishes = dynamicCategories.reduce((sum, c) => sum + (c.dishCount || 0), 0);
    const list = [{ id: "All", label: "All Items", icon: "✨", count: totalGlobalDishes }];
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

  // Group displayed products by category for section browsing when "All" is active
  const categorySections = useMemo(() => {
    const groups = {};
    displayedProducts.forEach((item) => {
      const cat = item.category || "Chef Specialties";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [displayedProducts]);

  // Active filter tally for reset pill
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "All") count++;
    if (selectedRestaurant !== "all") count++;
    if (selectedType !== "all") count++;
    if (onlyInStock) count++;
    if (sortBy !== "default") count++;
    if (searchFromUrl.trim()) count++;
    return count;
  }, [selectedCategory, selectedRestaurant, selectedType, onlyInStock, sortBy, searchFromUrl]);

  const handleResetFilters = () => {
    setSearchInput("");
    router.replace("/menu", { scroll: false });
  };

  const handleCategoryClick = (catId) => {
    setSelectedCategory(catId);
    updateFilters({ category: catId });
  };

  const handleRestaurantClick = (restId) => {
    setSelectedRestaurant(restId);
    updateFilters({ restaurant: restId });
  };

  const handleTypeClick = (type) => {
    setSelectedType(type);
    updateFilters({ type });
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    updateFilters({ sort: newSort });
  };

  const handleStockToggle = () => {
    const next = !onlyInStock;
    setOnlyInStock(next);
    updateFilters({ inStock: next });
  };

  return (
    <main className="min-h-screen pt-24 sm:pt-28 pb-24 px-3 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto text-[var(--text-main)] transition-colors overflow-x-hidden min-w-0">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="text-center w-full max-w-2xl mx-auto mb-5 sm:mb-6 px-2 min-w-0">
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

      {/* ── UNIFIED MENU DISCOVERY HUB ─────────────────────────────── */}
      <div className="p-3 sm:p-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] mb-6 shadow-xs space-y-3 w-full max-w-full overflow-hidden min-w-0">
        {/* Row 1: Primary Category Discovery */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shadow-2xs shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                  isSelected
                    ? "bg-[var(--brand-accent)] text-white shadow-xs"
                    : "bg-[var(--bg-sub)] text-[var(--text-main)] hover:border-[var(--brand-accent)]/50 border border-[var(--border-color)]"
                }`}
              >
                <span className="mr-1">{cat.icon}</span>
                <span>{cat.label}</span>
                {cat.count > 0 && (
                  <span className={`ml-1 text-[10px] font-semibold opacity-75`}>
                    ({cat.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 2: Search, Dietary, Stock, and Sort Controls */}
        <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center">
          {/* Search Input */}
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4 pointer-events-none" />
            <input
              type="text"
              aria-label="Search dishes by name or category"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search dishes by name or category..."
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs sm:text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 outline-none transition shadow-2xs font-medium"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  updateFilters({ search: "" });
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Filter Controls */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0 flex-wrap sm:flex-nowrap">
            {/* Veg / Non-Veg Toggle */}
            <div className="flex rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] p-0.5 shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => handleTypeClick("all")}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedType === "all"
                    ? "bg-[var(--brand-accent)] text-white shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => handleTypeClick("veg")}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedType === "veg"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-emerald-600 dark:text-emerald-400 hover:opacity-80"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Veg
              </button>
              <button
                type="button"
                onClick={() => handleTypeClick("non-veg")}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedType === "non-veg"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "text-rose-600 dark:text-rose-400 hover:opacity-80"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Non-Veg
              </button>
            </div>

            {/* In-Stock Filter */}
            <button
              type="button"
              onClick={handleStockToggle}
              aria-pressed={onlyInStock}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition shrink-0 flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden shadow-2xs ${
                onlyInStock
                  ? "bg-[var(--brand-accent)]/15 border-[var(--brand-accent)] text-[var(--brand-accent)]"
                  : "bg-[var(--bg-sub)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <Check size={13} className={onlyInStock ? "opacity-100" : "opacity-30"} />
              <span>In Stock Only</span>
            </button>

            {/* Sort Dropdown */}
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                aria-label="Sort dishes"
                className="pl-3 pr-7 py-2 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] focus:border-[var(--brand-accent)] focus:ring-1 focus:ring-[var(--brand-accent)] outline-none transition cursor-pointer appearance-none shadow-2xs"
              >
                <option value="default">Sort: Recommended</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Top Rated</option>
                <option value="name">Name: A to Z</option>
              </select>
              <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
            </div>

            {/* Reset Filters Pill (visible when active) */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl bg-[var(--bg-sub)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-xs font-bold text-[var(--brand-accent)] transition shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <X size={12} />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Integrated Partner Kitchen Chips */}
        {restaurants.length > 0 && (
          <div className="pt-2.5 border-t border-[var(--border-color)] flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1 shrink-0 mr-1">
              <Building2 size={13} className="text-[var(--brand-accent)]" /> Partner Kitchens:
            </span>
            <button
              type="button"
              onClick={() => handleRestaurantClick("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                selectedRestaurant === "all"
                  ? "bg-[var(--brand-accent)] text-white shadow-2xs font-bold"
                  : "bg-[var(--bg-sub)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]"
              }`}
            >
              All Kitchens ({restaurants.length})
            </button>
            {restaurants.map((rest) => {
              const op = getRestaurantOperationalStatus(rest);
              const isSelected = selectedRestaurant === rest._id;
              return (
                <button
                  key={rest._id}
                  type="button"
                  onClick={() => handleRestaurantClick(rest._id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                    isSelected
                      ? "bg-[var(--brand-accent)] text-white shadow-2xs font-bold"
                      : "bg-[var(--bg-sub)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]"
                  }`}
                >
                  <span>{rest.name}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      op.isOpen ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                    title={op.isOpen ? "Open Now" : op.reason}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Active Kitchen Operational Banner (Expanded when a specific kitchen is selected) */}
        {selectedRestaurant !== "all" && (() => {
          const activeKitchen = restaurants.find((r) => r._id === selectedRestaurant);
          if (!activeKitchen) return null;
          const op = getRestaurantOperationalStatus(activeKitchen);
          const flatFee = activeKitchen.chargeSettings?.flatDeliveryFee ?? 40;
          const freeAbove = activeKitchen.chargeSettings?.freeDeliveryThreshold ?? 500;
          const radius = activeKitchen.deliverySettings?.deliveryRadiusKm ?? 10;
          const minOrder = activeKitchen.orderLimits?.minOrderAmount ?? 0;
          const kitchenOffers = offers.filter(
            (o) => !o.restaurant || o.restaurant?._id === activeKitchen._id || o.restaurant === activeKitchen._id
          );

          return (
            <div className="pt-2.5 border-t border-[var(--border-color)] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-xs sm:text-sm text-[var(--text-main)]">
                    {activeKitchen.name}
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
                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <Clock size={11} className="text-[var(--brand-accent)]" />
                    {op.hoursText || activeKitchen.openingHours || "10:00 AM - 11:00 PM"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] flex-wrap">
                  <span className="bg-[var(--bg-sub)] px-2 py-0.5 rounded-lg border border-[var(--border-color)] font-medium">
                    🛵 ₹{flatFee} {freeAbove > 0 ? `(Free > ₹${freeAbove})` : ""}
                  </span>
                  <span className="bg-[var(--bg-sub)] px-2 py-0.5 rounded-lg border border-[var(--border-color)] font-medium">
                    📍 Up to {radius} km
                  </span>
                  {minOrder > 0 && (
                    <span className="bg-[var(--bg-sub)] px-2 py-0.5 rounded-lg border border-[var(--border-color)] font-medium text-amber-600 dark:text-amber-400">
                      Min ₹{minOrder}
                    </span>
                  )}
                </div>
              </div>

              {!op.isOpen && (
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
                  <Clock size={13} className="shrink-0" />
                  <span>
                    This kitchen is currently closed or ordering is temporarily paused. Dishes are viewable but ordering is unavailable until opening.
                  </span>
                </div>
              )}

              {kitchenOffers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <span className="text-[10px] font-bold text-[var(--brand-accent)] flex items-center gap-1 uppercase tracking-wider">
                    <Tag size={11} /> Deals:
                  </span>
                  {kitchenOffers.slice(0, 2).map((off) => (
                    <span
                      key={off._id}
                      className="px-2 py-0.5 rounded-md bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 text-[var(--brand-accent)] text-[11px] font-bold"
                    >
                      {off.code}: {off.discountType === "percentage" ? `${off.discountValue}% OFF` : `₹${off.discountValue} OFF`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── PRODUCTS CONTENT & STATES ───────────────────────────────── */}
      {loading ? (
        /* Skeletons resembling the final responsive grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
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
              : "No dishes are currently active under this selection."}
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
        <div className="space-y-8">
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

          {/* 1. Curated Highlights Carousel: Shown only when browsing "All" with no specific search */}
          {!searchFromUrl.trim() && selectedCategory === "All" && activeFiltersCount <= 1 && (
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
          {selectedCategory !== "All" || searchFromUrl.trim() || activeFiltersCount > 1 ? (
            /* Single composed responsive grid when category/search/filter is active */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
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
            <div className="space-y-10">
              {Object.entries(categorySections).map(([catName, catProducts]) => (
                <section key={catName} className="space-y-3.5">
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
                      onClick={() => handleCategoryClick(catName)}
                      className="text-xs font-bold text-[var(--brand-accent)] hover:underline cursor-pointer"
                    >
                      Filter {catName}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
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
