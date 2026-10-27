"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Star,
  Clock,
  MapPin,
  Tag,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Store,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  Bike,
  ShieldCheck,
} from "lucide-react";
import { useLocationStore } from "@/lib/locationStore";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";

const FALLBACK_RESTAURANT_IMG =
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80";

export default function RestaurantsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Location from global store
  const locationDetails = useLocationStore((s) => s.locationDetails);
  const openLocationModal = useLocationStore((s) => s.openLocationModal);

  // URL state synchronization
  const searchFromUrl = searchParams.get("search") || "";
  const sortFromUrl = searchParams.get("sort") || "recommended";
  const ratingFromUrl = searchParams.get("rating") ? Number(searchParams.get("rating")) : null;
  const cuisineFromUrl = searchParams.get("cuisine") || "all";
  const openOnlyFromUrl = searchParams.get("open") === "true";
  const fastDeliveryFromUrl = searchParams.get("fast") === "true";
  const offersOnlyFromUrl = searchParams.get("offers") === "true";
  const vegOnlyFromUrl = searchParams.get("veg") === "true";

  // Component Data State
  const [restaurants, setRestaurants] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setLiveTick] = useState(0);

  // UI Interactive States
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Draft states for the Filter Drawer Modal
  const [draftCuisine, setDraftCuisine] = useState(cuisineFromUrl);
  const [draftRating, setDraftRating] = useState(ratingFromUrl);
  const [draftOpenOnly, setDraftOpenOnly] = useState(openOnlyFromUrl);
  const [draftFastDelivery, setDraftFastDelivery] = useState(fastDeliveryFromUrl);
  const [draftOffersOnly, setDraftOffersOnly] = useState(offersOnlyFromUrl);
  const [draftVegOnly, setDraftVegOnly] = useState(vegOnlyFromUrl);

  // Periodic operational status refresh (every 20s)
  useEffect(() => {
    const timer = setInterval(() => setLiveTick((t) => t + 1), 20000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Restaurants & Offers
  const fetchRestaurantsAndOffers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (locationDetails?.latitude && locationDetails?.longitude) {
        queryParams.set("lat", String(locationDetails.latitude));
        queryParams.set("lng", String(locationDetails.longitude));
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

      const [restRes, offersRes] = await Promise.allSettled([
        fetch(`/api/restaurants${queryString}`).then((r) => r.json()),
        fetch("/api/offers").then((r) => r.json()),
      ]);

      if (restRes.status === "fulfilled" && restRes.value?.success) {
        setRestaurants(restRes.value.restaurants || []);
      } else {
        throw new Error(
          restRes.status === "fulfilled"
            ? restRes.value?.error || "Failed to load restaurants."
            : "Network issue connecting to server."
        );
      }

      if (offersRes.status === "fulfilled" && offersRes.value?.success) {
        setOffers(offersRes.value.offers || []);
      }
    } catch (err) {
      console.error("Restaurants load error:", err);
      setError(err.message || "Unable to load restaurants right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [locationDetails?.latitude, locationDetails?.longitude]);

  useEffect(() => {
    fetchRestaurantsAndOffers();
  }, [fetchRestaurantsAndOffers]);

  // Sync search input if URL changes externally
  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  // Update URL parameters helper
  const updateQuery = useCallback(
    (updates) => {
      const current = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, val]) => {
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          val === "all" ||
          val === "recommended" ||
          val === false
        ) {
          current.delete(key);
        } else {
          current.set(key, String(val));
        }
      });
      router.replace(`/restaurants?${current.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Debounce search input to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchFromUrl) {
        updateQuery({ search: searchInput });
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput, searchFromUrl, updateQuery]);

  // Map each restaurant to its best active offer (if any)
  const getRestaurantOffer = useCallback(
    (rest) => {
      if (!rest || !offers.length) return null;
      // 1. Direct restaurant-specific offer
      const direct = offers.find(
        (o) => o.restaurant?._id === rest._id || o.restaurant === rest._id
      );
      if (direct) return direct;
      // 2. Global all-restaurants offer
      const globalOffer = offers.find((o) => !o.restaurant);
      return globalOffer || null;
    },
    [offers]
  );

  // Extract all unique cuisines from available restaurants
  const availableCuisines = useMemo(() => {
    const set = new Set();
    restaurants.forEach((r) => {
      if (Array.isArray(r.cuisineType)) {
        r.cuisineType.forEach((c) => {
          if (c && typeof c === "string") set.add(c.trim());
        });
      }
    });
    return Array.from(set).sort();
  }, [restaurants]);

  // Filter & Sort Logic
  const filteredAndSortedRestaurants = useMemo(() => {
    let result = [...restaurants];

    // 1. Search Query (Name, Cuisines, Description, City)
    const q = searchFromUrl.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => {
        const nameMatch = (r.name || "").toLowerCase().includes(q);
        const descMatch = (r.description || "").toLowerCase().includes(q);
        const cityMatch = (r.address?.city || "").toLowerCase().includes(q);
        const cuisineMatch = Array.isArray(r.cuisineType)
          ? r.cuisineType.some((c) => (c || "").toLowerCase().includes(q))
          : false;
        return nameMatch || descMatch || cityMatch || cuisineMatch;
      });
    }

    // 2. Cuisine Filter
    if (cuisineFromUrl && cuisineFromUrl !== "all") {
      result = result.filter((r) =>
        Array.isArray(r.cuisineType)
          ? r.cuisineType.some(
              (c) => (c || "").toLowerCase() === cuisineFromUrl.toLowerCase()
            )
          : false
      );
    }

    // 3. Minimum Rating Filter
    if (ratingFromUrl && !isNaN(ratingFromUrl)) {
      result = result.filter((r) => (Number(r.rating) || 0) >= ratingFromUrl);
    }

    // 4. Open Now Filter
    if (openOnlyFromUrl) {
      result = result.filter((r) => {
        const op = getRestaurantOperationalStatus(r);
        return op.isOpen;
      });
    }

    // 5. Fast Delivery (<= 30 min) Filter
    if (fastDeliveryFromUrl) {
      result = result.filter((r) => {
        const mins = r.deliverySettings?.estimatedDeliveryMinutes || 25;
        return mins <= 30;
      });
    }

    // 6. Offers & Discounts Only Filter
    if (offersOnlyFromUrl) {
      result = result.filter((r) => Boolean(getRestaurantOffer(r)));
    }

    // 7. Veg Friendly Filter
    if (vegOnlyFromUrl) {
      result = result.filter((r) => {
        const cuisines = (r.cuisineType || []).map((c) => c.toLowerCase());
        const tags = (r.tags || []).map((t) => t.toLowerCase());
        return (
          cuisines.some((c) => c.includes("veg") || c.includes("mithai") || c.includes("dessert")) ||
          tags.some((t) => t.includes("pure veg") || t.includes("vegetarian"))
        );
      });
    }

    // 8. Sorting
    result.sort((a, b) => {
      switch (sortFromUrl) {
        case "rating": {
          const rB = Number(b.rating || 0);
          const rA = Number(a.rating || 0);
          if (rB !== rA) return rB - rA;
          return Number(b.numRatings || 0) - Number(a.numRatings || 0);
        }

        case "delivery-time": {
          const tA = Number(a.deliverySettings?.estimatedDeliveryMinutes || 25);
          const tB = Number(b.deliverySettings?.estimatedDeliveryMinutes || 25);
          if (tA !== tB) return tA - tB;
          return Number(b.rating || 0) - Number(a.rating || 0);
        }

        case "popularity": {
          const pB = Number(b.numRatings || 0);
          const pA = Number(a.numRatings || 0);
          if (pB !== pA) return pB - pA;
          return Number(b.rating || 0) - Number(a.rating || 0);
        }

        case "offers": {
          const hasOfferB = Boolean(getRestaurantOffer(b)) ? 1 : 0;
          const hasOfferA = Boolean(getRestaurantOffer(a)) ? 1 : 0;
          if (hasOfferB !== hasOfferA) return hasOfferB - hasOfferA;
          return Number(b.rating || 0) - Number(a.rating || 0);
        }

        case "recommended":
        default: {
          // Featured restaurants first, then highest rating with rating volume weight
          const featB = b.isFeatured ? 1 : 0;
          const featA = a.isFeatured ? 1 : 0;
          if (featB !== featA) return featB - featA;

          const scoreB = (Number(b.rating) || 0) * 10 + Math.min(Number(b.numRatings) || 0, 50);
          const scoreA = (Number(a.rating) || 0) * 10 + Math.min(Number(a.numRatings) || 0, 50);
          return scoreB - scoreA;
        }
      }
    });

    return result;
  }, [
    restaurants,
    searchFromUrl,
    cuisineFromUrl,
    ratingFromUrl,
    openOnlyFromUrl,
    fastDeliveryFromUrl,
    offersOnlyFromUrl,
    vegOnlyFromUrl,
    sortFromUrl,
    getRestaurantOffer,
  ]);

  // Featured Restaurant Selection: picks highest rated or explicitly marked isFeatured restaurant
  const featuredRestaurant = useMemo(() => {
    if (!restaurants.length) return null;
    const explicitFeatured = restaurants.find((r) => r.isFeatured);
    if (explicitFeatured) return explicitFeatured;

    // Fallback: top rated restaurant with at least 1 review
    const sorted = [...restaurants].sort((a, b) => {
      const rDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (rDiff !== 0) return rDiff;
      return (Number(b.numRatings) || 0) - (Number(a.numRatings) || 0);
    });
    return sorted[0] || null;
  }, [restaurants]);

  // Calculate active filter count for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (cuisineFromUrl && cuisineFromUrl !== "all") count++;
    if (ratingFromUrl) count++;
    if (openOnlyFromUrl) count++;
    if (fastDeliveryFromUrl) count++;
    if (offersOnlyFromUrl) count++;
    if (vegOnlyFromUrl) count++;
    return count;
  }, [
    cuisineFromUrl,
    ratingFromUrl,
    openOnlyFromUrl,
    fastDeliveryFromUrl,
    offersOnlyFromUrl,
    vegOnlyFromUrl,
  ]);

  // Clear all filters handler
  const handleClearAllFilters = () => {
    setSearchInput("");
    router.replace("/restaurants", { scroll: false });
  };

  // Open Drawer and initialize draft values
  const handleOpenDrawer = () => {
    setDraftCuisine(cuisineFromUrl);
    setDraftRating(ratingFromUrl);
    setDraftOpenOnly(openOnlyFromUrl);
    setDraftFastDelivery(fastDeliveryFromUrl);
    setDraftOffersOnly(offersOnlyFromUrl);
    setDraftVegOnly(vegOnlyFromUrl);
    setIsFilterDrawerOpen(true);
  };

  // Apply Filter Drawer changes
  const handleApplyDrawer = () => {
    updateQuery({
      cuisine: draftCuisine,
      rating: draftRating,
      open: draftOpenOnly,
      fast: draftFastDelivery,
      offers: draftOffersOnly,
      veg: draftVegOnly,
    });
    setIsFilterDrawerOpen(false);
  };

  // Reset Drawer Drafts
  const handleResetDrawer = () => {
    setDraftCuisine("all");
    setDraftRating(null);
    setDraftOpenOnly(false);
    setDraftFastDelivery(false);
    setDraftOffersOnly(false);
    setDraftVegOnly(false);
  };

  return (
    <main className="min-h-screen pt-20 sm:pt-24 pb-20 px-3.5 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-[var(--text-main)] transition-colors overflow-x-hidden min-w-0">
      <div className="space-y-6 sm:space-y-8">
        {/* ── 1. PAGE HEADER & LOCATION INDICATOR ───────────────────── */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1 border-b border-[var(--border-color)]/60 pb-5">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[var(--text-main)]">
              Restaurants near you
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
              Discover top-rated restaurants and your favourite cuisines, all in one place.
            </p>
          </div>

          {/* Location Indicator & Change Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openLocationModal}
              aria-label="Change delivery location"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[#FF7900]/50 hover:bg-[var(--bg-sub)] transition text-xs font-semibold text-[var(--text-main)] shadow-2xs group cursor-pointer"
            >
              <MapPin size={14} className="text-[#FF7900] shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate max-w-[200px] sm:max-w-[260px]">
                {locationDetails?.name || "Select location"}
              </span>
              <span className="text-[10px] font-bold text-[#FF7900] bg-[#FF7900]/10 px-1.5 py-0.5 rounded-md ml-0.5">
                Change
              </span>
            </button>
          </div>
        </section>

        {/* ── 2. PROMINENT FULL-WIDTH SEARCH BAR ───────────────────── */}
        <section className="w-full">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 sm:pl-4 flex items-center pointer-events-none text-[var(--text-muted)]">
              <Search size={18} className="text-[#FF7900]" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search restaurants or cuisines…"
              aria-label="Search restaurants or cuisines"
              className="w-full h-12 sm:h-13 pl-11 pr-10 rounded-2xl bg-[#171B22] border border-[var(--border-color)] text-sm sm:text-base font-medium text-white placeholder-neutral-400 focus:outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/25 transition shadow-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear restaurant search"
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </section>

        {/* ── 3. SORTING & FILTER CONTROLS BAR ──────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
            {/* Quick Filter Pills Row */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Comprehensive Filter Drawer Trigger */}
              <button
                type="button"
                onClick={handleOpenDrawer}
                aria-label="Open restaurant filter options"
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  activeFiltersCount > 0
                    ? "bg-[#FF7900] text-white border-[#FF7900]"
                    : "bg-[#171B22] text-[var(--text-main)] border-[var(--border-color)] hover:border-[#FF7900]/50 hover:bg-[var(--bg-sub)]"
                }`}
              >
                <SlidersHorizontal size={13} />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-white text-[#FF7900] text-[10px] font-black flex items-center justify-center ml-0.5">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Quick Pill: Open Now */}
              <button
                type="button"
                onClick={() => updateQuery({ open: !openOnlyFromUrl })}
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  openOnlyFromUrl
                    ? "bg-[#FF7900]/15 text-[#FF7900] border-[#FF7900]"
                    : "bg-[#171B22] text-[var(--text-muted)] hover:text-white border-[var(--border-color)] hover:border-neutral-700"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${openOnlyFromUrl ? "bg-[#FF7900]" : "bg-emerald-500"}`} />
                <span>Open Now</span>
              </button>

              {/* Quick Pill: 4.0+ Rating */}
              <button
                type="button"
                onClick={() => updateQuery({ rating: ratingFromUrl === 4 ? null : 4 })}
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${
                  ratingFromUrl === 4
                    ? "bg-[#FF7900]/15 text-[#FF7900] border-[#FF7900]"
                    : "bg-[#171B22] text-[var(--text-muted)] hover:text-white border-[var(--border-color)] hover:border-neutral-700"
                }`}
              >
                <Star size={12} className={ratingFromUrl === 4 ? "fill-[#FF7900]" : "text-amber-400 fill-amber-400"} />
                <span>4.0+ Rating</span>
              </button>

              {/* Quick Pill: Fast Delivery (<= 30 min) */}
              <button
                type="button"
                onClick={() => updateQuery({ fast: !fastDeliveryFromUrl })}
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  fastDeliveryFromUrl
                    ? "bg-[#FF7900]/15 text-[#FF7900] border-[#FF7900]"
                    : "bg-[#171B22] text-[var(--text-muted)] hover:text-white border-[var(--border-color)] hover:border-neutral-700"
                }`}
              >
                <Clock size={12} />
                <span>Fast Delivery</span>
              </button>

              {/* Quick Pill: Offers & Discounts */}
              <button
                type="button"
                onClick={() => updateQuery({ offers: !offersOnlyFromUrl })}
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  offersOnlyFromUrl
                    ? "bg-[#FF7900]/15 text-[#FF7900] border-[#FF7900]"
                    : "bg-[#171B22] text-[var(--text-muted)] hover:text-white border-[var(--border-color)] hover:border-neutral-700"
                }`}
              >
                <Tag size={12} />
                <span>Offers & Deals</span>
              </button>

              {/* Quick Pill: Veg Friendly */}
              <button
                type="button"
                onClick={() => updateQuery({ veg: !vegOnlyFromUrl })}
                className={`h-9 px-3 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                  vegOnlyFromUrl
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500"
                    : "bg-[#171B22] text-[var(--text-muted)] hover:text-white border-[var(--border-color)] hover:border-neutral-700"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Pure Veg</span>
              </button>
            </div>

            {/* Sorting Dropdown */}
            <div className="relative shrink-0 ml-auto">
              <select
                value={sortFromUrl}
                onChange={(e) => updateQuery({ sort: e.target.value })}
                aria-label="Sort restaurants by"
                className="h-9 pl-3 pr-8 rounded-xl bg-[#171B22] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] hover:border-[#FF7900]/50 focus:outline-none focus:border-[#FF7900] transition cursor-pointer appearance-none shadow-2xs"
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="rating">Top Rated</option>
                <option value="delivery-time">Fastest Delivery</option>
                <option value="popularity">Most Popular</option>
                <option value="offers">Deals & Discounts</option>
              </select>
              <ChevronDown
                size={13}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]"
              />
            </div>
          </div>

          {/* Active Filter Chips & Clear All */}
          {(activeFiltersCount > 0 || searchFromUrl.trim()) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {searchFromUrl.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#171B22] border border-[var(--border-color)] text-xs font-medium text-[var(--text-main)]">
                  <span>"{searchFromUrl.trim()}"</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      updateQuery({ search: "" });
                    }}
                    aria-label="Clear search"
                    className="hover:text-[#FF7900] cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {cuisineFromUrl !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF7900]/15 border border-[#FF7900]/30 text-[#FF7900] text-xs font-bold">
                  <span>Cuisine: {cuisineFromUrl}</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ cuisine: "all" })}
                    aria-label="Remove cuisine filter"
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {ratingFromUrl && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF7900]/15 border border-[#FF7900]/30 text-[#FF7900] text-xs font-bold">
                  <span>{ratingFromUrl}+ Stars</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ rating: null })}
                    aria-label="Remove rating filter"
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {openOnlyFromUrl && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <span>Open Now</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ open: false })}
                    aria-label="Remove open now filter"
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {fastDeliveryFromUrl && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF7900]/15 border border-[#FF7900]/30 text-[#FF7900] text-xs font-bold">
                  <span>Fast Delivery</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ fast: false })}
                    aria-label="Remove fast delivery filter"
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {offersOnlyFromUrl && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF7900]/15 border border-[#FF7900]/30 text-[#FF7900] text-xs font-bold">
                  <span>Has Offers</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ offers: false })}
                    aria-label="Remove offers filter"
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {vegOnlyFromUrl && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <span>Pure Veg</span>
                  <button
                    type="button"
                    onClick={() => updateQuery({ veg: false })}
                    aria-label="Remove veg filter"
                    className="hover:opacity-75 cursor-pointer ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-xs font-bold text-[#FF7900] hover:underline ml-auto cursor-pointer py-1 px-2 flex items-center gap-1"
              >
                <RotateCcw size={11} />
                <span>Clear All</span>
              </button>
            </div>
          )}
        </section>

        {/* ── 4. LOADING STATE ───────────────────────────────────────── */}
        {loading && (
          <div className="space-y-6">
            {/* Featured Skeleton */}
            <div className="w-full h-64 sm:h-72 rounded-3xl bg-[#171B22] border border-[var(--border-color)] animate-pulse" />

            {/* Grid Skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={idx}
                  className="rounded-3xl bg-[#171B22] border border-[var(--border-color)] p-4 space-y-3 animate-pulse"
                >
                  <div className="aspect-[16/10] w-full bg-[var(--bg-sub)] rounded-2xl" />
                  <div className="space-y-2">
                    <div className="h-4 bg-[var(--bg-sub)] rounded-md w-3/4" />
                    <div className="h-3 bg-[var(--bg-sub)] rounded-md w-1/2" />
                    <div className="h-3 bg-[var(--bg-sub)] rounded-md w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 5. ERROR STATE ────────────────────────────────────────── */}
        {!loading && error && (
          <div className="rounded-3xl bg-[#171B22] border border-rose-500/30 p-8 sm:p-10 text-center space-y-4 max-w-xl mx-auto shadow-lg">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-white">Unable to Load Restaurants</h3>
              <p className="text-xs sm:text-sm text-neutral-400">{error}</p>
            </div>
            <button
              type="button"
              onClick={fetchRestaurantsAndOffers}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e06b00] text-white text-xs font-bold transition cursor-pointer shadow-md"
            >
              <RotateCcw size={14} />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* ── 6. MAIN CONTENT (FEATURED & ALL RESTAURANTS) ───────────── */}
        {!loading && !error && (
          <div className="space-y-8 sm:space-y-10">
            {/* ── A. FEATURED RESTAURANT SHOWCASE ───────────────────── */}
            {/* Only show featured section when not searching or heavily filtering */}
            {featuredRestaurant && !searchFromUrl.trim() && activeFiltersCount === 0 && (
              <section aria-label="Featured Partner Restaurant" className="w-full">
                {(() => {
                  const op = getRestaurantOperationalStatus(featuredRestaurant);
                  const offer = getRestaurantOffer(featuredRestaurant);
                  const estMins =
                    featuredRestaurant.deliverySettings?.estimatedDeliveryMinutes || 25;
                  const fee =
                    featuredRestaurant.chargeSettings?.flatDeliveryFee === 0
                      ? "Free Delivery"
                      : featuredRestaurant.chargeSettings?.flatDeliveryFee !== undefined
                      ? `₹${featuredRestaurant.chargeSettings.flatDeliveryFee} Delivery`
                      : "Free Delivery";
                  const cuisines = Array.isArray(featuredRestaurant.cuisineType)
                    ? featuredRestaurant.cuisineType.join(" • ")
                    : "Chef Curated Cuisine";

                  return (
                    <div className="w-full rounded-3xl bg-[#171B22] border border-[var(--border-color)] overflow-hidden shadow-xl hover:border-[#FF7900]/40 transition group">
                      <div className="grid grid-cols-1 md:grid-cols-12 items-center">
                        {/* Cover Image Banner */}
                        <div className="relative md:col-span-5 h-56 sm:h-64 md:h-full min-h-[240px] overflow-hidden bg-neutral-900">
                          <Image
                            src={featuredRestaurant.image || FALLBACK_RESTAURANT_IMG}
                            alt={featuredRestaurant.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 42vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            priority
                          />
                          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-black/20 to-transparent" />

                          {/* Featured Badge */}
                          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF7900] text-white text-[11px] font-black uppercase tracking-wider shadow-md">
                            <Sparkles size={12} />
                            <span>Featured Kitchen</span>
                          </div>

                          {/* Operational status badge */}
                          <div className="absolute bottom-4 left-4 z-10">
                            {op.isOpen ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-bold shadow-md">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                <span>Open Now</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/90 text-white text-xs font-bold shadow-md">
                                <span>Closed ({op.reason || "Currently Closed"})</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Restaurant Details Column */}
                        <div className="md:col-span-7 p-5 sm:p-7 lg:p-8 space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <h2 className="text-xl sm:text-2xl font-black text-white group-hover:text-[#FF7900] transition-colors">
                                {featuredRestaurant.name}
                              </h2>
                              <ShieldCheck size={18} className="text-[#FF7900] shrink-0" title="Certified Culinary Partner" />
                            </div>
                            <p className="text-xs sm:text-sm text-neutral-300 font-medium">
                              {cuisines}
                            </p>
                          </div>

                          {/* Metadata row: Rating, Delivery time, Distance, Location */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-300">
                            {featuredRestaurant.rating ? (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                <Star size={13} className="fill-amber-400" />
                                <span>{Number(featuredRestaurant.rating).toFixed(1)}</span>
                                <span className="text-[11px] text-neutral-400 font-normal">
                                  ({featuredRestaurant.numRatings || 1} ratings)
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-neutral-400">★ New Partner</span>
                            )}

                            <span className="inline-flex items-center gap-1 bg-neutral-800/80 px-2.5 py-1 rounded-lg border border-neutral-700">
                              <Clock size={12} className="text-[#FF7900]" />
                              <span>{estMins}–{estMins + 10} min</span>
                            </span>

                            <span className="inline-flex items-center gap-1 bg-neutral-800/80 px-2.5 py-1 rounded-lg border border-neutral-700">
                              <Bike size={12} className="text-emerald-400" />
                              <span>{fee}</span>
                            </span>

                            {featuredRestaurant.distanceKm !== null && featuredRestaurant.distanceKm !== undefined && (
                              <span className="inline-flex items-center gap-1 bg-neutral-800/80 px-2.5 py-1 rounded-lg border border-neutral-700">
                                <MapPin size={12} className="text-[#FF7900]" />
                                <span>{Number(featuredRestaurant.distanceKm).toFixed(1)} km away</span>
                              </span>
                            )}
                          </div>

                          {/* Active Offer Banner */}
                          {offer && (
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 text-emerald-400 font-bold truncate">
                                <Tag size={14} className="shrink-0" />
                                <span className="truncate">
                                  {offer.title || (offer.discountValue ? `${offer.discountValue}% OFF Promo` : "Exclusive Offer")}
                                </span>
                              </div>
                              {offer.couponCode && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] uppercase font-bold shrink-0">
                                  USE {offer.couponCode}
                                </span>
                              )}
                            </div>
                          )}

                          {/* View Menu CTA Button */}
                          <div className="pt-2 flex items-center justify-between gap-4">
                            <span className="text-xs text-neutral-400 hidden sm:inline">
                              📍 {featuredRestaurant.address?.city || featuredRestaurant.address?.street || "Verified Partner Kitchen"}
                            </span>
                            <Link
                              href={`/menu?restaurant=${encodeURIComponent(featuredRestaurant.slug || featuredRestaurant._id)}`}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#FF7900] hover:bg-[#e06b00] text-white text-sm font-extrabold transition cursor-pointer shadow-lg active:scale-95 group/btn"
                            >
                              <span>View menu</span>
                              <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* ── B. ALL RESTAURANTS SECTION ───────────────────────── */}
            <section aria-label="All Partner Restaurants" className="space-y-5">
              <div className="flex items-center justify-between border-b border-[var(--border-color)]/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-main)] tracking-tight">
                    All Restaurants
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#171B22] border border-[var(--border-color)] text-xs font-bold text-[#FF7900]">
                    {filteredAndSortedRestaurants.length}
                  </span>
                </div>
                <span className="text-xs text-[var(--text-muted)] font-medium hidden sm:inline">
                  Showing verified food partners
                </span>
              </div>

              {/* Zero State for No Matches */}
              {filteredAndSortedRestaurants.length === 0 ? (
                <div className="py-16 text-center space-y-4 rounded-3xl bg-[#171B22] border border-[var(--border-color)] p-6">
                  <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
                    <Store size={28} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-bold text-white">No Restaurants Found</h3>
                    <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto">
                      We couldn't find any partner restaurants matching your criteria. Try loosening your filters or searching for something else.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e06b00] text-white text-xs font-bold transition cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>Clear All Filters</span>
                  </button>
                </div>
              ) : (
                /* Responsive Restaurant Cards Grid (Desktop: 3 cols, Tablet: 2 cols, Mobile: 1 col) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                  {filteredAndSortedRestaurants.map((rest) => {
                    const op = getRestaurantOperationalStatus(rest);
                    const offer = getRestaurantOffer(rest);
                    const estMins =
                      rest.deliverySettings?.estimatedDeliveryMinutes || 25;
                    const fee =
                      rest.chargeSettings?.flatDeliveryFee === 0
                        ? "Free Delivery"
                        : rest.chargeSettings?.flatDeliveryFee !== undefined
                        ? `₹${rest.chargeSettings.flatDeliveryFee}`
                        : "Free";
                    const cuisines = Array.isArray(rest.cuisineType)
                      ? rest.cuisineType.slice(0, 3).join(", ")
                      : "Multi-Cuisine";

                    return (
                      <article
                        key={rest._id}
                        className="rounded-3xl bg-[#171B22] border border-[var(--border-color)] hover:border-[#FF7900]/40 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                      >
                        <div>
                          {/* Restaurant Image Container */}
                          <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-900">
                            <Image
                              src={rest.image || FALLBACK_RESTAURANT_IMG}
                              alt={rest.name}
                              fill
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                            {/* Top Badges: Open status & Rating */}
                            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                              {op.isOpen ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/90 text-white text-[11px] font-bold shadow-sm backdrop-blur-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  <span>Open</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-900/90 border border-neutral-700 text-neutral-300 text-[11px] font-bold shadow-sm backdrop-blur-xs">
                                  <span>Closed</span>
                                </span>
                              )}

                              {rest.rating ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/75 border border-amber-500/40 text-amber-400 text-xs font-bold shadow-sm backdrop-blur-xs">
                                  <Star size={12} className="fill-amber-400" />
                                  <span>{Number(rest.rating).toFixed(1)}</span>
                                  {rest.numRatings > 0 && (
                                    <span className="text-[10px] text-neutral-300 font-normal">
                                      ({rest.numRatings})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg bg-black/75 text-neutral-400 text-[10px] font-bold">
                                  New
                                </span>
                              )}
                            </div>

                            {/* Bottom Image Overlay Badges: Delivery Time & Distance */}
                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white z-10">
                              <span className="inline-flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-xs text-[11px] font-bold">
                                <Clock size={11} className="text-[#FF7900]" />
                                <span>{estMins}–{estMins + 10} min</span>
                              </span>

                              {rest.distanceKm !== null && rest.distanceKm !== undefined ? (
                                <span className="inline-flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-xs text-[11px] font-medium text-neutral-300">
                                  <MapPin size={11} className="text-[#FF7900]" />
                                  <span>{Number(rest.distanceKm).toFixed(1)} km</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-neutral-300 bg-black/70 px-2 py-0.5 rounded-md">
                                  {rest.address?.city || "Partner"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Restaurant Info Content */}
                          <div className="p-4 sm:p-5 space-y-2.5">
                            <div className="space-y-1">
                              <h3 className="text-base font-extrabold text-white group-hover:text-[#FF7900] transition-colors line-clamp-1">
                                {rest.name}
                              </h3>
                              <p className="text-xs text-neutral-400 line-clamp-1 font-medium">
                                {cuisines}
                              </p>
                            </div>

                            {/* Offer Banner if available */}
                            {offer && (
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 truncate">
                                <Tag size={12} className="shrink-0" />
                                <span className="truncate">
                                  {offer.title || (offer.discountValue ? `${offer.discountValue}% OFF Promo` : "Exclusive Offer")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Bottom CTA & Delivery Fee */}
                        <div className="p-4 pt-0 sm:p-5 sm:pt-0 mt-auto flex items-center justify-between gap-3 border-t border-[var(--border-color)]/60 pt-3">
                          <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1">
                            <Bike size={12} className="text-[#FF7900]" />
                            <span>{fee}</span>
                          </span>

                          <Link
                            href={`/menu?restaurant=${encodeURIComponent(rest.slug || rest._id)}`}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#FF7900] hover:bg-[#e06b00] text-white text-xs font-extrabold transition shadow-md active:scale-95 group/link"
                          >
                            <span>View menu</span>
                            <ArrowRight size={13} className="group-hover/link:translate-x-0.5 transition-transform" />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ── 7. COMPREHENSIVE FILTER DRAWER MODAL (Mobile & Desktop) ─── */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setIsFilterDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter Restaurants"
            className="relative w-full max-w-md bg-[#101216] border-l border-[var(--border-color)] h-full overflow-y-auto flex flex-col justify-between z-10 shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)] bg-[#171B22]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#FF7900]/15 text-[#FF7900] flex items-center justify-center font-bold">
                  <SlidersHorizontal size={16} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Filter Restaurants</h3>
                  <p className="text-[11px] text-neutral-400">Refine by cuisine, ratings, and timing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                aria-label="Close filter drawer"
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body Options */}
            <div className="p-5 space-y-6 flex-1 overflow-y-auto">
              {/* Cuisines Section */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  Cuisine
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftCuisine("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      draftCuisine === "all"
                        ? "bg-[#FF7900] text-white border-[#FF7900]"
                        : "bg-[#171B22] text-neutral-300 border-[var(--border-color)] hover:border-neutral-600"
                    }`}
                  >
                    All Cuisines
                  </button>
                  {availableCuisines.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraftCuisine(draftCuisine === c ? "all" : c)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        draftCuisine === c
                          ? "bg-[#FF7900] text-white border-[#FF7900]"
                          : "bg-[#171B22] text-neutral-300 border-[var(--border-color)] hover:border-neutral-600"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating Section */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  Minimum Rating
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Any Rating", val: null },
                    { label: "4.0+ Stars", val: 4 },
                    { label: "4.5+ Stars", val: 4.5 },
                  ].map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => setDraftRating(draftRating === r.val ? null : r.val)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                        draftRating === r.val
                          ? "bg-[#FF7900] text-white border-[#FF7900]"
                          : "bg-[#171B22] text-neutral-300 border-[var(--border-color)] hover:border-neutral-600"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability & Delivery Switches */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  Preferences & Availability
                </label>
                <div className="space-y-2">
                  {/* Open Only */}
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-[#171B22] border border-[var(--border-color)] cursor-pointer">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Open Restaurants Only</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={draftOpenOnly}
                      onChange={(e) => setDraftOpenOnly(e.target.checked)}
                      className="accent-[#FF7900] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  {/* Fast Delivery */}
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-[#171B22] border border-[var(--border-color)] cursor-pointer">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Clock size={13} className="text-[#FF7900]" />
                      <span>Fast Delivery (≤ 30 min)</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={draftFastDelivery}
                      onChange={(e) => setDraftFastDelivery(e.target.checked)}
                      className="accent-[#FF7900] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  {/* Offers Only */}
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-[#171B22] border border-[var(--border-color)] cursor-pointer">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Tag size={13} className="text-[#FF7900]" />
                      <span>Active Offers & Discounts Only</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={draftOffersOnly}
                      onChange={(e) => setDraftOffersOnly(e.target.checked)}
                      className="accent-[#FF7900] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  {/* Veg Only */}
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-[#171B22] border border-[var(--border-color)] cursor-pointer">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Pure Veg / Vegetarian Friendly</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={draftVegOnly}
                      onChange={(e) => setDraftVegOnly(e.target.checked)}
                      className="accent-[#FF7900] w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-[var(--border-color)] bg-[#171B22] flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetDrawer}
                className="flex-1 py-3 px-4 rounded-xl border border-[var(--border-color)] hover:border-neutral-600 text-xs font-bold text-neutral-300 transition cursor-pointer text-center"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyDrawer}
                className="flex-1 py-3 px-4 rounded-xl bg-[#FF7900] hover:bg-[#e06b00] text-white text-xs font-extrabold transition cursor-pointer text-center shadow-lg"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
