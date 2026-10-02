"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Star, Heart, Clock, Check } from "lucide-react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";
import { toast } from "@/components/ui/ToastProvider";
import { useOperationalStatus } from "@/lib/restaurantHours";
import { trackAddToCart, trackProductView } from "@/lib/userPreferences";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

export default function ProductCard({ product, isCarousel = false }) {
  const { addItem } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const imageSrc = product.image || FALLBACK_IMAGE;
  const isFav = isFavorite(product._id);
  const restStatus = useOperationalStatus(product.restaurant);

  // Simulated original MRP and discount percentage for authentic Flipkart e-commerce feel
  const mrp = product.originalPrice || Math.round(product.price * 1.25);
  const discountPercent = mrp > product.price ? Math.round(((mrp - product.price) / mrp) * 100) : 0;
  const offerPrice = Math.round(product.price * 0.9);

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
        <div className="relative aspect-[4/3] w-full bg-[var(--bg-sub)] overflow-hidden">
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
              product.isAvailable ? "" : "grayscale-[40%]"
            }`}
          />

          {/* FSSAI Veg / Non-Veg Indicator Icon */}
          <div className="absolute top-2 left-2 z-10">
            <span
              className={`w-3.5 h-3.5 rounded-[3px] border-2 bg-white/95 dark:bg-zinc-900/95 flex items-center justify-center shadow-xs ${
                product.type === "veg" ? "border-emerald-600" : "border-rose-600"
              }`}
              title={product.type === "veg" ? "Pure Vegetarian" : "Non-Vegetarian"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  product.type === "veg" ? "bg-emerald-600" : "bg-rose-600"
                }`}
              />
            </span>
          </div>

          {/* Wishlist Button */}
          <button
            type="button"
            onClick={handleToggleFav}
            aria-label={isFav ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-[var(--bg-card)]/90 backdrop-blur-xs border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 transition shadow-xs cursor-pointer"
          >
            <Heart size={13} className={isFav ? "fill-rose-500 text-rose-500" : ""} />
          </button>

          {/* Closed / Sold Out Overlay */}
          {!product.isAvailable ? (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center z-10">
              <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                Sold Out
              </span>
            </div>
          ) : !restStatus.isOpen ? (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center z-10">
              <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white text-[10px] font-bold flex items-center gap-1">
                <Clock size={10} /> Closed
              </span>
              <span className="text-[9px] text-white/90 mt-0.5 line-clamp-1 font-medium">
                {restStatus.hoursText || "Opens soon"}
              </span>
            </div>
          ) : null}
        </div>

        {/* Card Body */}
        <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
          <div>
            {/* Rating Badge + Review Count (Flipkart Style) */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black shadow-2xs">
                <span>{(product.rating || 4.5).toFixed(1)}</span>
                <Star size={9} className="fill-white" />
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                ({product.numRatings || 14})
              </span>
              {product.isFeatured && (
                <span className="ml-auto text-[9px] font-black text-amber-500 uppercase">
                  ⭐ Top
                </span>
              )}
            </div>

            {/* Restaurant Name */}
            {product.restaurant?.name && (
              <p className="text-[10px] font-medium text-[var(--text-muted)] truncate mb-0.5">
                {product.restaurant.name}
              </p>
            )}

            {/* Dish Title */}
            <h3 className="text-xs sm:text-[13px] font-bold text-[var(--text-main)] line-clamp-1 group-hover:text-[var(--brand-accent)] transition-colors">
              {product.name}
            </h3>
          </div>

          {/* Pricing & Flipkart Offer Row */}
          <div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-black text-[var(--text-main)]">
                ₹{product.price}
              </span>
              {mrp > product.price && (
                <span className="text-[10px] text-[var(--text-muted)] line-through">
                  ₹{mrp}
                </span>
              )}
              {discountPercent > 0 && (
                <span className="text-[10px] font-bold text-emerald-600">
                  {discountPercent}% off
                </span>
              )}
            </div>

            {/* Flipkart-style Offer Callout */}
            <p className="text-[10px] font-semibold text-[var(--brand-accent)] mt-0.5 truncate">
              ₹{offerPrice} with Deals
            </p>
          </div>
        </div>
      </Link>

      {/* Action Button Row */}
      <div className="px-3 pb-3 pt-0">
        {!product.isAvailable ? (
          <button
            disabled
            className="w-full py-1.5 rounded-xl bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)] text-xs font-semibold cursor-not-allowed"
          >
            Unavailable
          </button>
        ) : !restStatus.isOpen ? (
          <button
            type="button"
            onClick={handleAddToCart}
            className="w-full py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-amber-500/20 transition cursor-pointer"
          >
            <Clock size={11} /> Closed
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            className="w-full py-1.5 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white text-xs font-bold shadow-xs active:scale-97 transition-all flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus size={13} strokeWidth={3} />
            <span>Add</span>
          </button>
        )}
      </div>
    </div>
  );
}
