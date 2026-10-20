"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  SlidersHorizontal,
  Check,
  Building2,
  UtensilsCrossed,
  Tag,
  CircleDollarSign,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export default function FilterDrawer({
  isOpen,
  onClose,
  categories = [],
  restaurants = [],
  appliedFilters = {},
  priceBounds = { min: 0, max: 1000 },
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

  // When drawer opens, initialize draft from currently applied filters
  useEffect(() => {
    if (isOpen) {
      setDraftCategory(appliedFilters.category || "All");
      setDraftRestaurant(appliedFilters.restaurant || "all");
      setDraftType(appliedFilters.type || "all");
      setDraftInStock(Boolean(appliedFilters.inStock));
      setDraftHasOffers(Boolean(appliedFilters.hasOffers));
      setDraftMinPrice(appliedFilters.minPrice !== undefined && appliedFilters.minPrice !== "" ? String(appliedFilters.minPrice) : "");
      setDraftMaxPrice(appliedFilters.maxPrice !== undefined && appliedFilters.maxPrice !== "" ? String(appliedFilters.maxPrice) : "");
    }
  }, [isOpen, appliedFilters]);

  // Handle escape key
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

  if (!isOpen) return null;

  // Compute draft active count
  let draftActiveCount = 0;
  if (draftCategory !== "All") draftActiveCount++;
  if (draftRestaurant !== "all") draftActiveCount++;
  if (draftType !== "all") draftActiveCount++;
  if (draftInStock) draftActiveCount++;
  if (draftHasOffers) draftActiveCount++;
  if (draftMinPrice !== "") draftActiveCount++;
  if (draftMaxPrice !== "") draftActiveCount++;

  const handleApply = () => {
    // Validate min/max price
    let minP = draftMinPrice !== "" ? Number(draftMinPrice) : undefined;
    let maxP = draftMaxPrice !== "" ? Number(draftMaxPrice) : undefined;

    if (minP !== undefined && isNaN(minP)) minP = undefined;
    if (maxP !== undefined && isNaN(maxP)) maxP = undefined;

    if (minP !== undefined && maxP !== undefined && minP > maxP) {
      // Swap if user inverted
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
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Drawer Panel: bottom sheet on small mobile (<640px), right slide-over on desktop (>=640px) */}
      <div className="relative w-full sm:max-w-md bg-[var(--bg-card)] border-l border-[var(--border-color)] shadow-2xl flex flex-col h-[90vh] sm:h-full mt-auto sm:mt-0 rounded-t-3xl sm:rounded-none z-10 overflow-hidden transition-transform animate-in slide-in-from-bottom sm:slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between shrink-0 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center">
              <SlidersHorizontal size={16} />
            </div>
            <div>
              <h2
                id="filter-drawer-title"
                className="text-base sm:text-lg font-black text-[var(--text-main)] tracking-tight"
              >
                Filters & Refinements
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {draftActiveCount > 0
                  ? `${draftActiveCount} filter${draftActiveCount > 1 ? "s" : ""} selected`
                  : "Customize your menu view"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close filter panel"
            className="w-8 h-8 rounded-full bg-[var(--bg-sub)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)] flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 custom-scrollbar">
          {/* Section 1: Dietary Preference */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <span>Dietary Preference</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDraftType("all")}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  draftType === "all"
                    ? "bg-[var(--brand-accent)] text-white border-[var(--brand-accent)] shadow-2xs"
                    : "bg-[var(--bg-sub)] text-[var(--text-main)] border-[var(--border-color)] hover:border-[var(--brand-accent)]/40"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDraftType("veg")}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  draftType === "veg"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                    : "bg-[var(--bg-sub)] text-emerald-600 dark:text-emerald-400 border-[var(--border-color)] hover:border-emerald-500/40"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Veg</span>
              </button>
              <button
                type="button"
                onClick={() => setDraftType("non-veg")}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  draftType === "non-veg"
                    ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                    : "bg-[var(--bg-sub)] text-rose-600 dark:text-rose-400 border-[var(--border-color)] hover:border-rose-500/40"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Non-Veg</span>
              </button>
            </div>
          </div>

          {/* Section 2: Dish Categories */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <UtensilsCrossed size={13} className="text-[var(--brand-accent)]" />
                <span>Food Categories</span>
              </label>
              {draftCategory !== "All" && (
                <button
                  type="button"
                  onClick={() => setDraftCategory("All")}
                  className="text-[11px] font-semibold text-[var(--brand-accent)] hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => {
                const isSelected = draftCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setDraftCategory(cat.id)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition cursor-pointer min-h-[42px] ${
                      isSelected
                        ? "bg-[var(--brand-accent)]/15 border-[var(--brand-accent)] text-[var(--brand-accent)] font-bold shadow-2xs"
                        : "bg-[var(--bg-sub)] text-[var(--text-main)] border-[var(--border-color)] hover:border-[var(--brand-accent)]/30 hover:bg-[var(--bg-card-hover)]"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-sm shrink-0" aria-hidden="true">{cat.icon || "🍽️"}</span>
                      <span className="truncate">{cat.label}</span>
                    </span>
                    {cat.count > 0 && (
                      <span className="text-[10px] opacity-70 shrink-0 ml-1">
                        ({cat.count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Kitchens / Restaurants */}
          {restaurants.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <Building2 size={13} className="text-[var(--brand-accent)]" />
                  <span>Partner Kitchens</span>
                </label>
                {draftRestaurant !== "all" && (
                  <button
                    type="button"
                    onClick={() => setDraftRestaurant("all")}
                    className="text-[11px] font-semibold text-[var(--brand-accent)] hover:underline cursor-pointer"
                  >
                    All Kitchens
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setDraftRestaurant("all")}
                  className={`w-full py-2.5 px-3.5 rounded-xl text-xs border text-left flex items-center justify-between transition cursor-pointer ${
                    draftRestaurant === "all"
                      ? "bg-[var(--brand-accent)]/15 border-[var(--brand-accent)] text-[var(--brand-accent)] font-bold shadow-2xs"
                      : "bg-[var(--bg-sub)] text-[var(--text-main)] border-[var(--border-color)] hover:border-[var(--brand-accent)]/30"
                  }`}
                >
                  <span>All Certified Kitchens</span>
                  {draftRestaurant === "all" && <Check size={14} className="text-[var(--brand-accent)]" />}
                </button>

                {restaurants.map((rest) => {
                  const isSelected = draftRestaurant === rest._id;
                  return (
                    <button
                      key={rest._id}
                      type="button"
                      onClick={() => setDraftRestaurant(rest._id)}
                      className={`w-full py-2.5 px-3.5 rounded-xl text-xs border text-left flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? "bg-[var(--brand-accent)]/15 border-[var(--brand-accent)] text-[var(--brand-accent)] font-bold shadow-2xs"
                          : "bg-[var(--bg-sub)] text-[var(--text-main)] border-[var(--border-color)] hover:border-[var(--brand-accent)]/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            rest.isOpen ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          title={rest.isOpen ? "Open" : "Closed"}
                        />
                        <span className="truncate">{rest.name}</span>
                        {rest.address?.city && (
                          <span className="text-[10px] text-[var(--text-muted)] font-normal truncate">
                            · {rest.address.city}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check size={14} className="text-[var(--brand-accent)] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Price Range */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <CircleDollarSign size={13} className="text-[var(--brand-accent)]" />
              <span>Price Range (₹)</span>
            </label>
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-muted)]">
                  ₹
                </span>
                <input
                  type="number"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  placeholder={`Min (${priceBounds.min})`}
                  value={draftMinPrice}
                  onChange={(e) => setDraftMinPrice(e.target.value)}
                  className="w-full h-10 pl-7 pr-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] outline-none focus:border-[var(--brand-accent)] focus:ring-1 focus:ring-[var(--brand-accent)]/30"
                />
              </div>
              <span className="text-xs text-[var(--text-muted)] font-bold">to</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-muted)]">
                  ₹
                </span>
                <input
                  type="number"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  placeholder={`Max (${priceBounds.max})`}
                  value={draftMaxPrice}
                  onChange={(e) => setDraftMaxPrice(e.target.value)}
                  className="w-full h-10 pl-7 pr-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] outline-none focus:border-[var(--brand-accent)] focus:ring-1 focus:ring-[var(--brand-accent)]/30"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Toggles (Availability & Offers) */}
          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Availability & Deals
            </label>

            {/* In-Stock Only */}
            <label className="p-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-between cursor-pointer hover:border-[var(--brand-accent)]/30 transition">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Check size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-main)] block">In Stock Only</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Hide currently unavailable kitchen dishes</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={draftInStock}
                onChange={(e) => setDraftInStock(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--brand-accent)] focus:ring-[var(--brand-accent)] accent-[var(--brand-accent)] cursor-pointer"
              />
            </label>

            {/* Special Offers / Deals Only */}
            <label className="p-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-between cursor-pointer hover:border-[var(--brand-accent)]/30 transition">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center shrink-0">
                  <Tag size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--text-main)] block">Active Deals & Offers</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Dishes with valid promo discounts</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={draftHasOffers}
                onChange={(e) => setDraftHasOffers(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--brand-accent)] focus:ring-[var(--brand-accent)] accent-[var(--brand-accent)] cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Drawer Sticky Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClearDraft}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border border-[var(--border-color)] bg-[var(--bg-sub)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={13} />
            <span>Clear All</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white shadow-md shadow-[var(--brand-accent)]/20 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check size={14} strokeWidth={2.5} />
            <span>Apply Filters {draftActiveCount > 0 ? `(${draftActiveCount})` : ""}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
