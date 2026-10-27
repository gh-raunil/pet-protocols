"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  SlidersHorizontal,
  Check,
  UtensilsCrossed,
  Tag,
  CircleDollarSign,
  RotateCcw,
  Search,
  ChevronUp,
  ChevronDown,
  Store,
  ShieldCheck,
  Star,
  Percent,
  ArrowRight,
} from "lucide-react";
import { getProductActiveOffer } from "@/lib/offersHelper";

function getCategoryEmoji(catName = "") {
  const c = String(catName).toLowerCase();
  if (c.includes("burger")) return "🍔";
  if (c.includes("kalakand") || c.includes("mithai") || c.includes("sweet") || c.includes("dessert")) return "🍨";
  if (c.includes("drink") || c.includes("beverage") || c.includes("mojito") || c.includes("coke")) return "🥤";
  if (c.includes("frie")) return "🍟";
  if (c.includes("momo")) return "🥟";
  if (c.includes("pizza")) return "🍕";
  if (c.includes("jamun")) return "🍨";
  if (c.includes("salad")) return "🥗";
  if (c.includes("soup")) return "🍲";
  if (c.includes("curry") || c.includes("paneer") || c.includes("dal")) return "🍛";
  if (c.includes("rice") || c.includes("biryani")) return "🍚";
  if (c.includes("bread") || c.includes("naan") || c.includes("roti")) return "🫓";
  if (c.includes("all")) return "✨";
  return "🍽️";
}

export default function FilterDrawer({
  isOpen,
  onClose,
  categories = [],
  restaurants = [],
  appliedFilters = {},
  products = [],
  offers = [],
  priceBounds = { min: 99, max: 499 },
  onApply,
  onReset,
}) {
  // Local draft state inside the drawer
  const [draftCategory, setDraftCategory] = useState("All");
  const [draftRestaurant, setDraftRestaurant] = useState("all");
  const [draftType, setDraftType] = useState("all");
  const [draftInStock, setDraftInStock] = useState(false);
  const [draftHasOffers, setDraftHasOffers] = useState(false);
  const [draftMinPrice, setDraftMinPrice] = useState("");
  const [draftMaxPrice, setDraftMaxPrice] = useState("");
  const [draftRating, setDraftRating] = useState(null);

  // Search filter terms inside drawer for fast navigation
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  // Collapsible accordion states
  const [openSections, setOpenSections] = useState({
    categories: true,
    kitchens: true,
    price: true,
    rating: true,
    deals: true,
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // When drawer opens, initialize draft from currently applied filters
  useEffect(() => {
    if (isOpen) {
      setDraftCategory(appliedFilters.category || "All");
      setDraftRestaurant(appliedFilters.restaurant || "all");
      setDraftType(appliedFilters.type || "all");
      setDraftInStock(Boolean(appliedFilters.inStock));
      setDraftHasOffers(Boolean(appliedFilters.hasOffers));
      setDraftMinPrice(
        appliedFilters.minPrice !== undefined && appliedFilters.minPrice !== ""
          ? String(appliedFilters.minPrice)
          : ""
      );
      setDraftMaxPrice(
        appliedFilters.maxPrice !== undefined && appliedFilters.maxPrice !== ""
          ? String(appliedFilters.maxPrice)
          : ""
      );
      setDraftRating(
        appliedFilters.rating !== undefined && appliedFilters.rating !== null
          ? Number(appliedFilters.rating)
          : null
      );
      setCategorySearchQuery("");
    }
  }, [isOpen, appliedFilters]);

  // Handle escape key and body scroll lock
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Filtered categories by search
  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories;
    const q = categorySearchQuery.toLowerCase().trim();
    return categories.filter(
      (c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [categories, categorySearchQuery]);

  // Price calculation values for dual range track
  const effectiveMin = priceBounds.min ?? 99;
  const effectiveMax = priceBounds.max ?? 499;
  const curMin = draftMinPrice !== "" ? Math.max(effectiveMin, Number(draftMinPrice)) : effectiveMin;
  const curMax = draftMaxPrice !== "" ? Math.min(effectiveMax, Number(draftMaxPrice)) : effectiveMax;
  const minPercent = Math.max(0, Math.min(100, ((curMin - effectiveMin) / Math.max(1, effectiveMax - effectiveMin)) * 100));
  const maxPercent = Math.max(0, Math.min(100, ((curMax - effectiveMin) / Math.max(1, effectiveMax - effectiveMin)) * 100));

  // Compute live matching dishes count based on draft filters
  const matchingCount = useMemo(() => {
    if (!products || products.length === 0) return 0;
    let list = [...products];

    // Dietary preference
    if (draftType === "veg") {
      list = list.filter((p) => p.isVeg);
    } else if (draftType === "non-veg") {
      list = list.filter((p) => !p.isVeg);
    }

    // Category
    if (draftCategory !== "All") {
      list = list.filter((p) => {
        const cat = (typeof p.category === "string" ? p.category : p.category?.name || "").trim();
        return cat.toLowerCase() === draftCategory.toLowerCase();
      });
    }

    // Restaurant
    if (draftRestaurant !== "all") {
      list = list.filter((p) => {
        const restId = p.restaurant?._id || p.restaurant;
        return String(restId) === String(draftRestaurant);
      });
    }

    // In Stock
    if (draftInStock) {
      list = list.filter((p) => p.isAvailable);
    }

    // Offers
    if (draftHasOffers) {
      list = list.filter((p) => Boolean(getProductActiveOffer(p, offers)));
    }

    // Min / Max Price
    const minP = draftMinPrice !== "" ? Number(draftMinPrice) : undefined;
    const maxP = draftMaxPrice !== "" ? Number(draftMaxPrice) : undefined;
    if (minP !== undefined && !isNaN(minP)) {
      list = list.filter((p) => (Number(p.price) || 0) >= minP);
    }
    if (maxP !== undefined && !isNaN(maxP)) {
      list = list.filter((p) => (Number(p.price) || 0) <= maxP);
    }

    // Rating
    if (draftRating !== null && !isNaN(draftRating)) {
      list = list.filter((p) => (Number(p.rating) || 0) >= draftRating);
    }

    return list.length;
  }, [
    products,
    draftType,
    draftCategory,
    draftRestaurant,
    draftInStock,
    draftHasOffers,
    draftMinPrice,
    draftMaxPrice,
    draftRating,
    offers,
  ]);

  if (!isOpen) return null;

  const handleApply = () => {
    let minP = draftMinPrice !== "" ? Number(draftMinPrice) : undefined;
    let maxP = draftMaxPrice !== "" ? Number(draftMaxPrice) : undefined;

    if (minP !== undefined && isNaN(minP)) minP = undefined;
    if (maxP !== undefined && isNaN(maxP)) maxP = undefined;

    if (minP !== undefined && maxP !== undefined && minP > maxP) {
      const temp = minP;
      minP = maxP;
      maxP = temp;
    }

    onApply({
      category: draftCategory,
      restaurant: draftRestaurant,
      type: draftType,
      inStock: draftInStock,
      hasOffers: draftHasOffers,
      minPrice: minP,
      maxPrice: maxP,
      rating: draftRating,
    });
    onClose();
  };

  const handleClearDraft = () => {
    setDraftCategory("All");
    setDraftRestaurant("all");
    setDraftType("all");
    setDraftInStock(false);
    setDraftHasOffers(false);
    setDraftMinPrice("");
    setDraftMaxPrice("");
    setDraftRating(null);
    if (onReset) onReset();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-drawer-title"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative w-full sm:max-w-[440px] bg-[#0c1017] text-white border-l border-[#1a2332] shadow-2xl flex flex-col h-full z-10 overflow-hidden transition-transform animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[#1a2332] flex items-center justify-between shrink-0 bg-[#0c1017]/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#ea580c] to-[#c2410c] flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2
                id="filter-drawer-title"
                className="text-base sm:text-lg font-black text-white tracking-tight leading-tight"
              >
                Filters & Refinements
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Customize your menu view
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close filter panel"
            className="w-9 h-9 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition border border-stone-700/60 cursor-pointer active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar text-xs">
          {/* Section 1: Dietary Preference */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 block">
              Dietary Preference
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setDraftType("all")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                  draftType === "all"
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20 font-extrabold"
                    : "bg-[#131922] text-stone-300 border border-stone-800 hover:border-stone-700"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDraftType("veg")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  draftType === "veg"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 border border-emerald-500"
                    : "bg-[#131922] text-stone-300 border border-stone-800 hover:border-stone-700"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Veg</span>
              </button>
              <button
                type="button"
                onClick={() => setDraftType("non-veg")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  draftType === "non-veg"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/20 border border-rose-500"
                    : "bg-[#131922] text-stone-300 border border-stone-800 hover:border-stone-700"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Non-Veg</span>
              </button>
            </div>
          </div>

          {/* Section 2: Food Categories */}
          <div className="space-y-2.5 pt-3 border-t border-stone-800/80">
            <button
              type="button"
              onClick={() => toggleSection("categories")}
              className="w-full flex items-center justify-between py-1 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-stone-300">
                <UtensilsCrossed size={14} className="text-orange-500" />
                <span>Food Categories</span>
              </div>
              {openSections.categories ? (
                <ChevronUp size={16} className="text-stone-400 group-hover:text-white transition" />
              ) : (
                <ChevronDown size={16} className="text-stone-400 group-hover:text-white transition" />
              )}
            </button>

            {openSections.categories && (
              <div className="space-y-2.5">
                {/* Search categories input */}
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#131922] border border-stone-800 text-xs text-stone-200 placeholder-stone-500 outline-none focus:border-orange-500 transition"
                  />
                </div>

                {/* 2-column Grid of category pills */}
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
                  {filteredCategories.map((cat) => {
                    const isSelected = draftCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setDraftCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-1.5 transition cursor-pointer min-h-[44px] ${
                          isSelected
                            ? "bg-[#181d26] border-orange-500/90 text-orange-400 font-bold shadow-xs"
                            : "bg-[#131922] border-stone-800/90 hover:border-stone-700 text-stone-200 font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm shrink-0">{getCategoryEmoji(cat.label)}</span>
                          <span className="truncate text-xs">{cat.label}</span>
                          {typeof cat.count === "number" && (
                            <span className={`text-[11px] shrink-0 ${isSelected ? "text-orange-400/80 font-bold" : "text-stone-400"}`}>
                              ({cat.count})
                            </span>
                          )}
                        </div>
                        <div
                          className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition ${
                            isSelected
                              ? "bg-orange-500 border-orange-500 text-white"
                              : "border-stone-700 bg-transparent"
                          }`}
                        >
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Partner Kitchens */}
          <div className="space-y-2.5 pt-3 border-t border-stone-800/80">
            <button
              type="button"
              onClick={() => toggleSection("kitchens")}
              className="w-full flex items-center justify-between py-1 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-stone-300">
                <Store size={14} className="text-orange-500" />
                <span>Partner Kitchens</span>
              </div>
              {openSections.kitchens ? (
                <ChevronUp size={16} className="text-stone-400 group-hover:text-white transition" />
              ) : (
                <ChevronDown size={16} className="text-stone-400 group-hover:text-white transition" />
              )}
            </button>

            {openSections.kitchens && (
              <div className="space-y-2">
                {/* All Certified Kitchens option */}
                <button
                  type="button"
                  onClick={() => setDraftRestaurant("all")}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    draftRestaurant === "all"
                      ? "bg-[#181d26] border-orange-500 text-orange-400 font-bold shadow-xs"
                      : "bg-[#131922] border-stone-800/90 hover:border-stone-700 text-stone-200 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <ShieldCheck size={16} className="text-orange-500 shrink-0" />
                    <span className="text-xs">All Certified Kitchens</span>
                  </div>
                  {draftRestaurant === "all" && (
                    <Check size={16} strokeWidth={2.5} className="text-orange-500 shrink-0" />
                  )}
                </button>

                {restaurants.map((rest) => {
                  const isSelected = draftRestaurant === rest._id;
                  return (
                    <button
                      key={rest._id}
                      type="button"
                      onClick={() => setDraftRestaurant(rest._id)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? "bg-[#181d26] border-orange-500 text-orange-400 font-bold shadow-xs"
                          : "bg-[#131922] border-stone-800/90 hover:border-stone-700 text-stone-200 font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-xs truncate">{rest.name}</span>
                        {rest.address?.city && (
                          <span className="text-[11px] text-stone-400 truncate">· {rest.address.city}</span>
                        )}
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition ${
                          isSelected
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "border-stone-700 bg-transparent"
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Price Range (₹) */}
          <div className="space-y-2.5 pt-3 border-t border-stone-800/80">
            <button
              type="button"
              onClick={() => toggleSection("price")}
              className="w-full flex items-center justify-between py-1 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-stone-300">
                <CircleDollarSign size={14} className="text-orange-500" />
                <span>Price Range (₹)</span>
              </div>
              {openSections.price ? (
                <ChevronUp size={16} className="text-stone-400 group-hover:text-white transition" />
              ) : (
                <ChevronDown size={16} className="text-stone-400 group-hover:text-white transition" />
              )}
            </button>

            {openSections.price && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={draftMinPrice}
                      placeholder={`Min ${effectiveMin}`}
                      onChange={(e) => setDraftMinPrice(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-xl bg-[#131922] border border-stone-800 text-xs font-medium text-stone-200 outline-none focus:border-orange-500 transition"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={draftMaxPrice}
                      placeholder={`Max ${effectiveMax}`}
                      onChange={(e) => setDraftMaxPrice(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-xl bg-[#131922] border border-stone-800 text-xs font-medium text-stone-200 outline-none focus:border-orange-500 transition"
                    />
                  </div>
                </div>

                {/* Dual Slider Bar */}
                <div className="pt-2 px-1">
                  <div className="relative h-1.5 bg-stone-800 rounded-full flex items-center">
                    <div
                      className="absolute h-1.5 bg-orange-500 rounded-full"
                      style={{
                        left: `${minPercent}%`,
                        right: `${100 - maxPercent}%`,
                      }}
                    />
                    <input
                      type="range"
                      min={effectiveMin}
                      max={effectiveMax}
                      value={curMin}
                      onChange={(e) => setDraftMinPrice(String(Math.min(Number(e.target.value), curMax - 5)))}
                      className="absolute w-full pointer-events-none appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-stone-900 [&::-webkit-slider-thumb]:appearance-none"
                    />
                    <input
                      type="range"
                      min={effectiveMin}
                      max={effectiveMax}
                      value={curMax}
                      onChange={(e) => setDraftMaxPrice(String(Math.max(Number(e.target.value), curMin + 5)))}
                      className="absolute w-full pointer-events-none appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-stone-900 [&::-webkit-slider-thumb]:appearance-none"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs text-stone-400 mt-2 font-medium">
                    <span>₹{curMin}</span>
                    <span>₹{curMax}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Rating */}
          <div className="space-y-2.5 pt-3 border-t border-stone-800/80">
            <button
              type="button"
              onClick={() => toggleSection("rating")}
              className="w-full flex items-center justify-between py-1 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-stone-300">
                <Star size={14} className="text-orange-500" />
                <span>Rating</span>
              </div>
              {openSections.rating ? (
                <ChevronUp size={16} className="text-stone-400 group-hover:text-white transition" />
              ) : (
                <ChevronDown size={16} className="text-stone-400 group-hover:text-white transition" />
              )}
            </button>

            {openSections.rating && (
              <div>
                <button
                  type="button"
                  onClick={() => setDraftRating(draftRating === 4 ? null : 4)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    draftRating === 4
                      ? "bg-[#181d26] border-orange-500/80 text-orange-400 font-bold shadow-xs"
                      : "bg-[#131922] border-stone-800/90 hover:border-stone-700 text-stone-200 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Star size={16} className="fill-amber-400 stroke-amber-500" />
                    <span className="text-xs font-bold text-white">4.0+</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition ${
                      draftRating === 4
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "border-stone-700 bg-transparent"
                    }`}
                  >
                    {draftRating === 4 && <Check size={11} strokeWidth={3} />}
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Section 6: Availability & Deals */}
          <div className="space-y-2.5 pt-3 border-t border-stone-800/80">
            <button
              type="button"
              onClick={() => toggleSection("deals")}
              className="w-full flex items-center justify-between py-1 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-stone-300">
                <Tag size={14} className="text-orange-500" />
                <span>Availability & Deals</span>
              </div>
              {openSections.deals ? (
                <ChevronUp size={16} className="text-stone-400 group-hover:text-white transition" />
              ) : (
                <ChevronDown size={16} className="text-stone-400 group-hover:text-white transition" />
              )}
            </button>

            {openSections.deals && (
              <div className="space-y-2">
                {/* In stock only */}
                <button
                  type="button"
                  onClick={() => setDraftInStock(!draftInStock)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    draftInStock
                      ? "bg-[#181d26] border-orange-500/80 text-orange-400 shadow-xs"
                      : "bg-[#131922] border-stone-800/90 hover:border-stone-700 text-stone-200 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <Check size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-200">In stock only</div>
                      <div className="text-[10px] text-stone-400">Only show dishes currently available</div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition ${
                      draftInStock
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "border-stone-700 bg-transparent"
                    }`}
                  >
                    {draftInStock && <Check size={11} strokeWidth={3} />}
                  </div>
                </button>

                {/* Active deals & offers */}
                <button
                  type="button"
                  onClick={() => setDraftHasOffers(!draftHasOffers)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                    draftHasOffers
                      ? "bg-[#181d26] border-orange-500/80 text-orange-400 shadow-xs"
                      : "bg-[#131922] border-stone-800/90 hover:border-stone-700 text-stone-200 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                      <Percent size={15} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-200">Active deals & offers</div>
                      <div className="text-[10px] text-stone-400">Dishes with valid promo discounts</div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md border shrink-0 flex items-center justify-center transition ${
                      draftHasOffers
                        ? "bg-orange-500 border-orange-500 text-white"
                        : "border-stone-700 bg-transparent"
                    }`}
                  >
                    {draftHasOffers && <Check size={11} strokeWidth={3} />}
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Sticky Footer Actions */}
        <div className="p-4 border-t border-stone-800/90 bg-[#0c1017] flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClearDraft}
            className="py-3 px-4 rounded-xl text-xs font-bold border border-stone-800 bg-[#131922] hover:bg-stone-800 text-stone-300 hover:text-white transition cursor-pointer flex items-center justify-center gap-2 shrink-0 min-w-[120px]"
          >
            <RotateCcw size={14} />
            <span>Clear all</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-3 px-5 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/25 transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <span>Show {matchingCount} {matchingCount === 1 ? "dish" : "dishes"}</span>
            <ArrowRight size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
