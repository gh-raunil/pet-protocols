"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Star, Heart, Clock, Sparkles, Tag, Zap } from "lucide-react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";
import { toast } from "@/components/ui/ToastProvider";
import { useOperationalStatus } from "@/lib/restaurantHours";
import { trackAddToCart, trackProductView } from "@/lib/userPreferences";
import { getProductActiveOffer, calculateItemDiscount, isProductNewArrival } from "@/lib/offersHelper";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

export function ProductCardSkeleton({ isCarousel = false }) {
  return (
    <div
      className={`flex flex-col justify-between bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] overflow-hidden animate-pulse ${
        isCarousel ? "w-[170px] sm:w-[190px] md:w-[205px] shrink-0" : "w-full"
      }`}
    >
      <div className="relative aspect-[4/3] w-full bg-[var(--bg-sub)]" />
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-[var(--bg-sub)] rounded-md" />
          <div className="h-4 w-3/4 bg-[var(--bg-sub)] rounded-md" />
          <div className="h-3 w-1/2 bg-[var(--bg-sub)] rounded-md" />
        </div>
        <div className="pt-1 flex items-center justify-between">
          <div className="h-4 w-14 bg-[var(--bg-sub)] rounded-md" />
          <div className="h-8 w-16 bg-[var(--bg-sub)] rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function ProductCard({ product, isCarousel = false, offers = [] }) {
  const { addItem } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const [imgSrc, setImgSrc] = useState(product?.image || FALLBACK_IMAGE);
  const isFav = product?._id ? isFavorite(product._id) : false;
  const restStatus = useOperationalStatus(product?.restaurant);

  useEffect(() => {
    setImgSrc(product?.image || FALLBACK_IMAGE);
  }, [product?.image]);

  if (!product) return null;

  // Check if product qualifies as Newly Arrived (within 14 days)
  const isNew = isProductNewArrival(product, 14);

  // Match targeted active offer (Option A vs Option B)
  const matchedOffer = getProductActiveOffer(product, offers);
  const isAutoDiscount = matchedOffer && matchedOffer.applyMode === "automatic";
  const isCouponOffer = matchedOffer && (!matchedOffer.applyMode || matchedOffer.applyMode === "coupon");

  // Option B: discount directly reduces the price automatically
  let autoDiscount = 0;
  let displayPrice = product.price;
  if (isAutoDiscount) {
    autoDiscount = calculateItemDiscount(product, matchedOffer);
    displayPrice = Math.max(0, product.price - autoDiscount);
  }

  // Option A: catalog price is NOT reduced; coupon code is displayed
  const hasStrikethrough = isAutoDiscount ? true : Boolean(product.originalPrice && product.originalPrice > product.price);
  const struckPrice = isAutoDiscount ? product.price : product.originalPrice;
  const discountPercent = struckPrice > displayPrice ? Math.round(((struckPrice - displayPrice) / struckPrice) * 100) : 0;

  const handleCardClick = () => {
    trackProductView(product);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.isAvailable) return;
    if (!restStatus.isOpen) {
      toast.error(
        `${product.restaurant?.name || "Kitchen"} is ${restStatus.reason || "currently closed"}. Ordering is unavailable right now.`
      );
      return;
    }

    addItem(product);
    trackAddToCart(product);
    toast.success(`${product.name} added to cart!`);
  };

  const handleToggleFav = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product);
    if (!isFav) {
      toast.info("Added to your favorites");
    } else {
      toast.info("Removed from favorites");
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative flex flex-col justify-between bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] hover:border-[var(--brand-accent)]/50 hover:shadow-md transition-all duration-200 overflow-hidden ${
        isCarousel ? "w-[170px] sm:w-[190px] md:w-[205px] shrink-0 snap-start" : "w-full"
      } ${!product.isAvailable ? "opacity-75" : ""}`}
    >
      <Link href={`/menu/${product._id}`} className="block flex-1 flex flex-col">
        {/* Top Product Image Container */}
        <div className="relative aspect-[4/3] w-full bg-[var(--bg-sub)] overflow-hidden shrink-0">
          <Image
            src={imgSrc}
            alt={product.name}
            fill
            sizes={isCarousel ? "(max-width: 640px) 170px, 205px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"}
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
              product.isAvailable ? "" : "grayscale-[40%]"
            }`}
            onError={() => setImgSrc(FALLBACK_IMAGE)}
          />

          {/* FSSAI Veg / Non-Veg Indicator Icon & Newly Arrived Tag */}
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
            <span
              className={`w-4 h-4 rounded-[4px] border-2 bg-white/95 dark:bg-zinc-900/95 flex items-center justify-center shadow-xs ${
                product.type === "veg" ? "border-emerald-600" : "border-rose-600"
              }`}
              title={product.type === "veg" ? "Pure Vegetarian" : "Non-Vegetarian"}
              aria-label={product.type === "veg" ? "Pure Vegetarian" : "Non-Vegetarian"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  product.type === "veg" ? "bg-emerald-600" : "bg-rose-600"
                }`}
              />
            </span>
            {isNew && (
              <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider shadow-xs flex items-center gap-0.5 leading-none">
                <Sparkles size={8} className="fill-white" /> New
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            type="button"
            onClick={handleToggleFav}
            aria-label={isFav ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-[var(--bg-card)]/90 backdrop-blur-xs border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 transition shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
          >
            <Heart size={13} className={isFav ? "fill-rose-500 text-rose-500" : ""} />
          </button>

          {/* Closed / Sold Out Overlay */}
          {!product.isAvailable ? (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center z-10">
              <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                Sold Out
              </span>
            </div>
          ) : !restStatus.isOpen ? (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center z-10">
              <span className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                <Clock size={10} /> Closed
              </span>
              <span className="text-[9px] text-white/90 mt-1 line-clamp-1 font-medium">
                {restStatus.hoursText || "Opens soon"}
              </span>
            </div>
          ) : null}
        </div>

        {/* Card Body */}
        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2 min-w-0">
          <div className="min-w-0">
            {/* Rating Badge + Review Count */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black shadow-2xs">
                <span>{(product.rating || 4.5).toFixed(1)}</span>
                <Star size={9} className="fill-white" />
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                ({product.numRatings || 14})
              </span>
              {product.isFeatured && (
                <span className="ml-auto text-[9px] font-black text-amber-500 uppercase tracking-wider">
                  ⭐ Top
                </span>
              )}
            </div>

            {/* Restaurant Name */}
            {product.restaurant?.name && (
              <p className="text-[10px] sm:text-[11px] font-medium text-[var(--text-muted)] truncate mb-0.5">
                {product.restaurant.name}
              </p>
            )}

            {/* Dish Title */}
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)] line-clamp-1 group-hover:text-[var(--brand-accent)] transition-colors break-words">
              {product.name}
            </h3>
          </div>

          {/* Pricing & Offer Row */}
          <div className="min-w-0 pt-0.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-black text-[var(--text-main)]">
                ₹{displayPrice}
              </span>
              {hasStrikethrough && struckPrice > displayPrice && (
                <span className="text-[10px] sm:text-xs text-[var(--text-muted)] line-through">
                  ₹{struckPrice}
                </span>
              )}
              {discountPercent > 0 && (
                <span className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {discountPercent}% off
                </span>
              )}
            </div>

            {isAutoDiscount ? (
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate flex items-center gap-1">
                <Zap size={10} className="fill-emerald-600 shrink-0" />
                <span>Auto Applied: ₹{autoDiscount} OFF</span>
              </p>
            ) : isCouponOffer ? (
              <p className="text-[10px] font-semibold text-[var(--brand-accent)] mt-1 truncate flex items-center gap-1">
                <Tag size={10} className="shrink-0" />
                <span>Use code <strong className="font-mono bg-[var(--brand-accent)]/10 px-1 py-0.2 rounded">{matchedOffer.code}</strong></span>
              </p>
            ) : null}
          </div>
        </div>
      </Link>

      {/* Action Button Row */}
      <div className="px-3 pb-3 sm:px-3.5 sm:pb-3.5 pt-0">
        {!product.isAvailable ? (
          <button
            disabled
            aria-disabled="true"
            className="w-full py-2 rounded-xl bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)] text-xs font-semibold cursor-not-allowed"
          >
            Unavailable
          </button>
        ) : !restStatus.isOpen ? (
          <button
            type="button"
            onClick={handleAddToCart}
            aria-label={`Kitchen is closed: ${restStatus.reason || "Currently Closed"}`}
            className="w-full py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center gap-1 hover:bg-amber-500/20 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus:outline-hidden"
          >
            <Clock size={12} /> Closed
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            aria-label={`Add ${product.name} to cart`}
            className="w-full py-2 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold shadow-xs active:scale-97 transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1 focus:outline-hidden"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Add</span>
          </button>
        )}
      </div>
    </div>
  );
}
