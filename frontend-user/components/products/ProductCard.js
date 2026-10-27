"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Star, Heart, Clock, Sparkles, Tag, Zap, Layers } from "lucide-react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";
import { toast } from "@/components/ui/ToastProvider";
import { useOperationalStatus } from "@/lib/restaurantHours";
import { trackAddToCart, trackProductView } from "@/lib/userPreferences";
import { getProductActiveOffer, calculateItemDiscount, isProductNewArrival } from "@/lib/offersHelper";
import Tooltip from "@/components/ui/Tooltip";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

function getSmartInitialImage(product) {
  const isDefaultSeedBurger =
    product?.image && product.image.includes("1568901346375-23c9450c58cd");
  const name = (product?.name || "").toLowerCase();
  const cat = (
    typeof product?.category === "string"
      ? product.category
      : product?.category?.name || ""
  ).toLowerCase();

  // If it's the generic seed burger image but the item is actually fries, pizza, or momos, give it the proper matched image
  if (isDefaultSeedBurger) {
    if (name.includes("frie") || cat.includes("frie")) return "/images/fries.png";
    if (name.includes("pizza") || cat.includes("pizza")) return "/images/pizza.png";
    if (name.includes("momo") || cat.includes("momo")) return "/images/momos.png";
  }

  if (product?.image && product.image.trim()) {
    return product.image;
  }

  if (name.includes("frie") || cat.includes("frie")) return "/images/fries.png";
  if (name.includes("pizza") || cat.includes("pizza")) return "/images/pizza.png";
  if (name.includes("momo") || cat.includes("momo")) return "/images/momos.png";
  if (name.includes("drink") || name.includes("coke") || cat.includes("drink") || cat.includes("beverage")) return "/images/drinks.png";
  if (name.includes("burger") || cat.includes("burger")) return "/images/burger.png";
  if (name.includes("dessert") || name.includes("jamun") || cat.includes("dessert") || cat.includes("sweet")) return "/images/cat-desserts.jpg";
  if (name.includes("sandwich") || cat.includes("sandwich")) return "/images/cat-sandwiches.jpg";
  if (name.includes("indian") || name.includes("curry") || cat.includes("indian")) return "/images/cat-indian.jpg";

  return FALLBACK_IMAGE;
}

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

export default function ProductCard({
  product,
  isCarousel = false,
  offers = [],
  variant = "default",
}) {
  const router = useRouter();
  const { addItem } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const [imgSrc, setImgSrc] = useState(() => getSmartInitialImage(product));
  const isFav = product?._id ? isFavorite(product._id) : false;
  const restStatus = useOperationalStatus(product?.restaurant);

  useEffect(() => {
    setImgSrc(getSmartInitialImage(product));
  }, [product?.image, product?.name, product?.category]);

  // Portion label preview
  const portionLabel = useMemo(() => {
    if (product?.portion?.servingLabel && product.portion.servingLabel.trim()) {
      return product.portion.servingLabel.trim();
    }
    const qty = product?.portion?.quantity;
    const unit = product?.portion?.unit === "custom" ? product?.portion?.customUnit : product?.portion?.unit;
    if (qty && unit) {
      const sizePart = product?.portion?.size ? ` · ${product.portion.size}` : "";
      return `${qty} ${unit}${sizePart}`;
    }
    if (product?.portion?.size) {
      return product.portion.size;
    }
    return null;
  }, [product?.portion]);

  // Variant checking
  const hasMultipleVariants = Boolean(
    product?.hasVariants &&
    Array.isArray(product?.variants) &&
    product.variants.length > 0
  );

  const availableVariants = hasMultipleVariants
    ? product.variants.filter((v) => v.isAvailable !== false)
    : [];

  const variantPrices = (availableVariants.length > 0 ? availableVariants : product?.variants || []).map(
    (v) => Number(v.price) || 0
  );
  const minVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : (product?.price || 0);

  if (!product) return null;

  // Check if product qualifies as Newly Arrived (within 14 days)
  const isNew = isProductNewArrival(product, 14);

  // Match targeted active offer (Option A vs Option B)
  const matchedOffer = getProductActiveOffer(product, offers);
  const isAutoDiscount = matchedOffer && matchedOffer.applyMode === "automatic";
  const isCouponOffer = matchedOffer && (!matchedOffer.applyMode || matchedOffer.applyMode === "coupon");

  // Option B: discount directly reduces the price automatically
  let autoDiscount = 0;
  let displayPrice = hasMultipleVariants ? minVariantPrice : product.price;
  if (isAutoDiscount) {
    autoDiscount = calculateItemDiscount(product, matchedOffer);
    displayPrice = Math.max(0, (hasMultipleVariants ? minVariantPrice : product.price) - autoDiscount);
  }

  // Option A: catalog price is NOT reduced; coupon code is displayed
  const baseComparePrice = hasMultipleVariants ? minVariantPrice : product.price;
  const hasStrikethrough = isAutoDiscount ? true : Boolean(product.originalPrice && product.originalPrice > baseComparePrice);
  const struckPrice = isAutoDiscount ? baseComparePrice : product.originalPrice;
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

    if (hasMultipleVariants) {
      router.push(`/menu/${product._id}`);
      return;
    }

    const itemToAdd = {
      ...product,
      portionQuantity: product.portion?.quantity,
      portionUnit: product.portion?.unit === "custom" ? product.portion?.customUnit : product.portion?.unit,
      servingLabel: product.portion?.servingLabel,
      size: product.portion?.size,
    };

    addItem(itemToAdd); // addItem(product) compatibility
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

  if (variant === "catalog") {
    const isBestseller = product.isFeatured || (Number(product.rating) >= 4.5);
    const cuisineText = product.cuisine || (typeof product.category === "string" ? product.category : product.category?.name) || "Gourmet";
    const deliveryText = product.restaurant?.chargeSettings?.flatDeliveryFee === 0 ? "Free delivery" : "Free delivery";

    return (
      <div
        onClick={handleCardClick}
        className={`group relative flex flex-col justify-between bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 hover:border-orange-500/50 hover:shadow-md transition-all duration-200 overflow-hidden w-full ${
          !product.isAvailable ? "opacity-75" : ""
        }`}
      >
        <Link href={`/menu/${product._id}`} className="block flex-1 flex flex-col">
          {/* Top Product Image Container */}
          <div className="relative aspect-[4/3] w-full bg-stone-100 dark:bg-stone-800 overflow-hidden shrink-0">
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
                product.isAvailable ? "" : "grayscale-[40%]"
              }`}
              onError={() => setImgSrc(FALLBACK_IMAGE)}
            />

            {/* Top Left Ribbon: Bestseller or New */}
            {isBestseller ? (
              <div className="absolute top-0 left-0 z-10">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black italic rounded-br-xl shadow-xs tracking-wide">
                  <Sparkles size={9} className="fill-white" />
                  <span>Bestseller</span>
                </span>
              </div>
            ) : isNew ? (
              <div className="absolute top-0 left-0 z-10">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white text-[10px] font-black uppercase rounded-br-xl shadow-xs tracking-wider">
                  New
                </span>
              </div>
            ) : null}

            {/* Top Right Wishlist Button */}
            <button
              type="button"
              onClick={handleToggleFav}
              aria-label={isFav ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
              className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-stone-900/60 backdrop-blur-xs text-white hover:text-rose-400 active:scale-95 transition shadow-xs flex items-center justify-center cursor-pointer"
            >
              <Heart size={14} className={isFav ? "fill-rose-500 text-rose-500" : "text-white"} />
            </button>

            {/* Bottom Left Veg / Non-Veg Indicator */}
            <div className="absolute bottom-2.5 left-2.5 z-10">
              <span
                className={`w-4 h-4 rounded-[4px] border-2 bg-white dark:bg-stone-900 flex items-center justify-center shadow-xs ${
                  product.type === "veg" ? "border-emerald-600" : "border-rose-600"
                }`}
                aria-label={product.type === "veg" ? "Pure Vegetarian" : "Non-Vegetarian"}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    product.type === "veg" ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                />
              </span>
            </div>

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
              </div>
            ) : null}
          </div>

          {/* Card Body */}
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-1.5 min-w-0">
            <div className="min-w-0 space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate group-hover:text-orange-500 transition-colors">
                {product.name}
              </h3>

              {product.numRatings > 0 && typeof product.rating === "number" && product.rating > 0 ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-amber-500 font-bold flex items-center gap-0.5">
                    ★ {product.rating.toFixed(1)}
                  </span>
                  <span className="text-stone-400 text-[11px]">
                    ({product.numRatings > 999 ? (product.numRatings / 1000).toFixed(1) + "k" : product.numRatings})
                  </span>
                </div>
              ) : (
                <div className="text-stone-400 text-[11px] italic">
                  No ratings yet
                </div>
              )}

              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-stone-900 dark:text-white">
                  ₹{displayPrice}
                </span>
                {hasStrikethrough && struckPrice > displayPrice && (
                  <span className="text-[11px] text-stone-400 line-through">
                    ₹{struckPrice}
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="text-[10px] sm:text-[11px] font-bold text-orange-500">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>

              <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                {cuisineText} • 20 min • {deliveryText}
              </div>
            </div>
          </div>
        </Link>

        {/* Action Button Row */}
        <div className="px-3 pb-3 sm:px-3.5 sm:pb-3.5 pt-0">
          {!product.isAvailable ? (
            <button
              disabled
              className="w-full py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-400 text-xs font-semibold cursor-not-allowed"
            >
              Unavailable
            </button>
          ) : !restStatus.isOpen ? (
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Clock size={12} /> Closed
            </button>
          ) : hasMultipleVariants ? (
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition flex items-center justify-center cursor-pointer active:scale-98"
            >
              Select Size
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1 cursor-pointer active:scale-98"
            >
              <span>Add to Cart</span>
              <Plus size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    );
  }

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
            <Tooltip
              content={
                product.type === "veg"
                  ? "Pure Vegetarian (Green dot): Contains 100% vegetarian ingredients"
                  : "Non-Vegetarian (Red dot): Contains meat, egg, seafood, or animal derivatives"
              }
              placement="right"
            >
              <span
                className={`w-4 h-4 rounded-[4px] border-2 bg-white/95 dark:bg-zinc-900/95 flex items-center justify-center shadow-xs cursor-help ${
                  product.type === "veg" ? "border-emerald-600" : "border-rose-600"
                }`}
                aria-label={product.type === "veg" ? "Pure Vegetarian" : "Non-Vegetarian"}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    product.type === "veg" ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                />
              </span>
            </Tooltip>
            {isNew && (
              <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider shadow-xs flex items-center gap-0.5 leading-none">
                <Sparkles size={8} className="fill-white" /> New
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <Tooltip
            content={isFav ? "Remove from saved favorites" : "Save to favorites"}
            placement="left"
          >
            <button
              type="button"
              onClick={handleToggleFav}
              aria-label={isFav ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
              className="absolute top-2.5 right-2.5 z-10 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-[var(--bg-card)]/90 backdrop-blur-xs border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 active:scale-95 transition shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
            >
              <Heart size={16} className={isFav ? "fill-rose-500 text-rose-500" : ""} />
            </button>
          </Tooltip>

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
            {typeof product.rating === "number" && product.rating > 0 ? (
              <div className="flex items-center gap-1.5 mb-1.5">
                <Tooltip
                  content={`Rated ${product.rating.toFixed(1)} out of 5 stars${product.numRatings ? ` (${product.numRatings} verified ratings)` : ""}`}
                  placement="top"
                >
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black shadow-2xs cursor-help">
                    <span>{product.rating.toFixed(1)}</span>
                    <Star size={9} className="fill-white" />
                  </span>
                </Tooltip>
                {typeof product.numRatings === "number" && product.numRatings > 0 && (
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">
                    ({product.numRatings})
                  </span>
                )}
                {product.isFeatured && (
                  <span className="ml-auto text-[9px] font-black text-amber-500 uppercase tracking-wider">
                    ⭐ Top
                  </span>
                )}
              </div>
            ) : product.isFeatured ? (
              <div className="flex items-center justify-end mb-1.5">
                <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider">
                  ⭐ Top
                </span>
              </div>
            ) : null}

            {/* Restaurant Name */}
            {product.restaurant?.name && (
              <p className="text-[10px] sm:text-[11px] font-medium text-[var(--text-muted)] truncate mb-0.5">
                {product.restaurant.name}
              </p>
            )}

            {/* Dish Title */}
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)] line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] group-hover:text-[var(--brand-accent)] transition-colors break-words leading-tight">
              {product.name}
            </h3>
          </div>

          {/* Pricing & Offer Row */}
          <div className="min-w-0 pt-0.5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-black text-[var(--text-main)]">
                {hasMultipleVariants ? `From ₹${displayPrice}` : `₹${displayPrice}`}
              </span>
              {hasMultipleVariants ? (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {product.variants.length} sizes
                </span>
              ) : portionLabel ? (
                <span className="text-[11px] font-semibold text-[var(--text-muted)] truncate max-w-[130px]">
                  · {portionLabel}
                </span>
              ) : null}
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
          <Tooltip content="This dish is currently out of stock in the kitchen" placement="top">
            <button
              disabled
              aria-disabled="true"
              className="w-full py-2.5 rounded-xl bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)] text-xs font-semibold cursor-not-allowed min-h-[44px]"
            >
              Unavailable
            </button>
          </Tooltip>
        ) : !restStatus.isOpen ? (
          <Tooltip
            content={`Kitchen is currently closed: ${restStatus.reason || "Check back during restaurant opening hours"}`}
            placement="top"
          >
            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={`Kitchen is closed: ${restStatus.reason || "Currently Closed"}`}
              className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-500/20 active:scale-98 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500 focus:outline-hidden min-h-[44px]"
            >
              <Clock size={14} /> Closed
            </button>
          </Tooltip>
        ) : hasMultipleVariants ? (
          <button
            type="button"
            onClick={handleAddToCart}
            aria-label={`Select size for ${product.name}`}
            className="w-full py-2.5 rounded-xl bg-[var(--bg-sub)] hover:bg-[var(--brand-accent)] hover:text-white border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-xs font-bold shadow-xs active:scale-97 transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1 focus:outline-hidden min-h-[44px]"
          >
            <Layers size={14} strokeWidth={2.5} />
            <span>Select Size</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            aria-label={`Add ${product.name} to cart`}
            className="w-full py-2.5 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold shadow-xs active:scale-97 transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1 focus:outline-hidden min-h-[44px]"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add to Cart</span>
          </button>
        )}
      </div>
    </div>
  );
}
