"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Star, Heart, Plus, ArrowRight, UtensilsCrossed, Clock } from "lucide-react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";
import { toast } from "@/components/ui/ToastProvider";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";
import { trackAddToCart, trackProductView } from "@/lib/userPreferences";

const FALLBACK_DISH_IMG = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

function getProductCleanImage(product) {
  if (product?.image && product.image.trim()) {
    return product.image;
  }
  const name = (product?.name || "").toLowerCase();
  if (name.includes("frie")) return "/images/category_icons/fries.png";
  if (name.includes("pizza")) return "/images/category_icons/pizza.png";
  if (name.includes("momo")) return "/images/category_icons/momos.png";
  if (name.includes("drink") || name.includes("mojito")) return "/images/category_icons/drinks.png";
  if (name.includes("burger")) return "/images/category_icons/burger.png";
  return FALLBACK_DISH_IMG;
}

export default function PopularDishesSection({ products = [], loading = false }) {
  const router = useRouter();
  const { addItem } = useCartStore();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();

    if (!product?.isAvailable) {
      toast.error(`${product?.name || "Dish"} is currently sold out.`);
      return;
    }

    if (product?.restaurant) {
      const restStatus = getRestaurantOperationalStatus(product.restaurant);
      if (!restStatus.isOpen) {
        toast.error(
          `${product.restaurant?.name || "Kitchen"} is ${
            restStatus.reason || "currently closed"
          }. Ordering is unavailable right now.`
        );
        return;
      }
    }

    if (product?.hasVariants && Array.isArray(product?.variants) && product.variants.length > 0) {
      router.push(`/menu/${product._id}`);
      return;
    }

    addItem(product);
    trackAddToCart(product);
    toast.success(`${product.name} added to cart!`);
  };

  const handleToggleFav = (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product);
    const fav = isFavorite(product._id);
    if (!fav) {
      toast.info(`Added ${product.name} to favorites`);
    } else {
      toast.info(`Removed from favorites`);
    }
  };

  // Sort: featured items first, then by rating, then by name
  const eligibleProducts = [...products].sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    const rA = a.rating || 0;
    const rB = b.rating || 0;
    if (rB !== rA) return rB - rA;
    return a.name.localeCompare(b.name);
  });

  // Display top 4 dishes matching the desktop 4-column reference grid
  const displayProducts = eligibleProducts.slice(0, 4);

  return (
    <section aria-label="Popular Dishes" className="w-full space-y-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-main)] tracking-tight">
          Popular Dishes
        </h2>
        <Link
          href="/menu"
          className="text-xs sm:text-sm font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 group"
        >
          <span>View all</span>
          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] p-3 space-y-3 animate-pulse"
            >
              <div className="aspect-[4/3] rounded-2xl bg-[var(--bg-sub)] w-full" />
              <div className="h-4 bg-[var(--bg-sub)] rounded-md w-3/4" />
              <div className="flex justify-between items-center">
                <div className="h-4 bg-[var(--bg-sub)] rounded-md w-1/3" />
                <div className="h-8 w-16 bg-[var(--bg-sub)] rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : displayProducts.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-muted)] space-y-2">
          <UtensilsCrossed size={28} className="mx-auto text-[var(--text-muted)] opacity-60" />
          <h3 className="font-bold text-sm text-[var(--text-main)]">Menu Updating</h3>
          <p>Fresh partner kitchen dishes will appear here shortly.</p>
        </div>
      ) : (
        /* ── 4-COLUMN RESPONSIVE DISH GRID MATCHING REFERENCE IMAGE ── */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {displayProducts.map((product) => {
            const fav = favorites.some((item) => String(item._id || item.id) === String(product._id));
            const img = getProductCleanImage(product);
            const isVeg = product.type === "veg";
            const isNonVeg = product.type === "non-veg";
            const rest = product.restaurant;
            const etaTime = rest?.deliverySettings?.estimatedDeliveryMinutes
              ? `${rest.deliverySettings.estimatedDeliveryMinutes} min`
              : null;
            const delFee =
              rest?.chargeSettings?.flatDeliveryFee !== undefined
                ? rest.chargeSettings.flatDeliveryFee === 0
                  ? "Free"
                  : `₹${rest.chargeSettings.flatDeliveryFee}`
                : null;

            return (
              <div
                key={product._id}
                onClick={() => {
                  trackProductView(product);
                  router.push(`/menu/${product._id}`);
                }}
                className="group relative flex flex-col justify-between bg-[var(--bg-card)] rounded-3xl border border-stone-200/80 dark:border-[#202E3B] hover:border-[var(--brand-accent)]/50 hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer p-2.5 sm:p-3 shadow-2xs"
              >
                {/* Food Image Container */}
                <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-[var(--bg-sub)] shrink-0">
                  <Image
                    src={img}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Top-Left Featured Badge (only when genuinely marked in data) */}
                  {product.isFeatured && (
                    <div className="absolute top-2 left-2 z-10">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--brand-accent)] text-white shadow-md">
                        Featured
                      </span>
                    </div>
                  )}

                  {/* Top-Right Heart / Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleFav(e, product)}
                    aria-label={fav ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 dark:bg-black/60 hover:bg-white text-stone-700 dark:text-white flex items-center justify-center backdrop-blur-xs transition active:scale-90 shadow-2xs"
                  >
                    <Heart
                      size={14}
                      className={fav ? "fill-rose-500 text-rose-500" : "text-stone-700 dark:text-white"}
                    />
                  </button>
                </div>

                {/* Dish Details */}
                <div className="pt-2.5 flex-1 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    {/* Dietary indicator + Category */}
                    <div className="flex items-center gap-1.5">
                      {isVeg && (
                        <span
                          title="Vegetarian"
                          className="w-3.5 h-3.5 rounded-[4px] border border-emerald-600 flex items-center justify-center shrink-0"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        </span>
                      )}
                      {isNonVeg && (
                        <span
                          title="Non-Vegetarian"
                          className="w-3.5 h-3.5 rounded-[4px] border border-rose-600 flex items-center justify-center shrink-0"
                        >
                          <span className="w-1.5 h-1.5 border-y-transparent border-l-rose-600 border-l-[5px] border-y-[3px]" />
                        </span>
                      )}
                      {product.category && (
                        <span className="text-[10px] font-medium text-[var(--text-muted)] truncate">
                          {product.category}
                        </span>
                      )}
                    </div>

                    {/* Dish Title */}
                    <h3 className="text-xs sm:text-sm font-extrabold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition-colors truncate">
                      {product.name}
                    </h3>

                    {/* Rating & Review Count (only when actual data exists) */}
                    <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-medium">
                      {product.numRatings > 0 && typeof product.rating === "number" && product.rating > 0 ? (
                        <>
                          <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                            <Star size={11} className="fill-amber-400 stroke-amber-500" />
                            <span>{product.rating}</span>
                          </span>
                          <span className="text-[10px]">({product.numRatings})</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)] italic">
                          No ratings yet
                        </span>
                      )}
                      {etaTime && (
                        <>
                          <span>&bull;</span>
                          <span className="text-[10px] truncate">{etaTime}</span>
                        </>
                      )}
                    </div>

                    {/* Restaurant Name */}
                    {rest?.name && (
                      <p className="text-[10px] text-[var(--text-muted)] truncate">
                        {rest.name}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: Price and Add Button */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-color)]/60">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm sm:text-base font-black text-[var(--text-main)]">
                        ₹{product.price}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-[10px] text-[var(--text-muted)] line-through">
                          ₹{product.originalPrice}
                        </span>
                      )}
                    </div>

                    {/* Add to Cart / Select Button */}
                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(e, product)}
                      disabled={!product.isAvailable}
                      className={`inline-flex items-center justify-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] ${
                        product.isAvailable
                          ? "bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white"
                          : "bg-stone-300 dark:bg-stone-700 text-stone-500 cursor-not-allowed"
                      }`}
                    >
                      <span>{product.isAvailable ? (product.hasVariants ? "Add +" : "Add +") : "Sold Out"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
