"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building,
  Clock,
  Heart,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Share2,
  Star,
  ShieldCheck,
  Tag,
  Zap,
  Truck,
  ThumbsUp,
  MessageSquare,
  ChevronRight,
  X,
  Flame,
  Layers,
  Scale,
  Utensils,
} from "lucide-react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";
import useRecentStore from "@/lib/recentStore";
import { toast } from "@/components/ui/ToastProvider";
import { useOperationalStatus } from "@/lib/restaurantHours";
import { trackAddToCart, trackProductView } from "@/lib/userPreferences";
import ProductCarousel from "@/components/products/ProductCarousel";
import { getProductActiveOffer, calculateItemDiscount, isProductNewArrival } from "@/lib/offersHelper";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800";

export default function ProductDetailClient({ product }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [reviewsList, setReviewsList] = useState(product?.reviews || []);
  const [currentRating, setCurrentRating] = useState(product?.rating || 4.5);
  const [numRatings, setNumRatings] = useState(product?.numRatings || 18);
  const [offers, setOffers] = useState([]);
  const [imgSrc, setImgSrc] = useState(product?.image || FALLBACK_IMAGE);

  // Rate Modal State & Accessibility Refs
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [userStars, setUserStars] = useState(5);
  const [hoverStars, setHoverStars] = useState(0);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  const addItem = useCartStore((s) => s.addItem);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const addRecentDish = useRecentStore((s) => s.addRecentDish);

  const isFav = product?._id ? isFavorite(product._id) : false;
  const restStatus = useOperationalStatus(product?.restaurant);

  useEffect(() => {
    setImgSrc(product?.image || FALLBACK_IMAGE);
  }, [product?.image]);

  // Check if product qualifies as Newly Arrived (within 14 days)
  const isNew = isProductNewArrival(product, 14);

  // Match targeted active offer (Option A vs Option B)
  const matchedOffer = getProductActiveOffer(product, offers);
  const isAutoDiscount = matchedOffer && matchedOffer.applyMode === "automatic";
  const isCouponOffer = matchedOffer && (!matchedOffer.applyMode || matchedOffer.applyMode === "coupon");

  // Variant selection state
  const hasVariants = Boolean(
    product?.hasVariants &&
    Array.isArray(product?.variants) &&
    product.variants.length > 0
  );

  const [selectedVariantIndex, setSelectedVariantIndex] = useState(() => {
    if (!hasVariants) return -1;
    const firstAvail = product.variants.findIndex((v) => v.isAvailable !== false);
    return firstAvail >= 0 ? firstAvail : 0;
  });

  const selectedVariant = hasVariants && selectedVariantIndex >= 0 ? product.variants[selectedVariantIndex] : null;

  // Base price: variant price or product.price
  const rawBasePrice = selectedVariant ? Number(selectedVariant.price) || 0 : (product?.price || 0);

  // Active portion metadata resolved from variant or root dish
  const activePortion = useMemo(() => {
    if (selectedVariant) {
      return {
        quantity: selectedVariant.portionQuantity || product?.portion?.quantity,
        unit: selectedVariant.portionUnit || product?.portion?.unit,
        customUnit: product?.portion?.customUnit,
        servingLabel: selectedVariant.servingLabel || product?.portion?.servingLabel,
        size: selectedVariant.size || product?.portion?.size,
      };
    }
    return product?.portion || null;
  }, [selectedVariant, product?.portion]);

  // Formatted serving label
  const activePortionText = useMemo(() => {
    if (!activePortion) return null;
    if (activePortion.servingLabel && activePortion.servingLabel.trim()) {
      return activePortion.servingLabel.trim();
    }
    const qty = activePortion.quantity;
    const unit = activePortion.unit === "custom" ? activePortion.customUnit : activePortion.unit;
    if (qty && unit) {
      const sizePart = activePortion.size ? ` (${activePortion.size})` : "";
      return `${qty} ${unit}${sizePart}`;
    }
    if (activePortion.size) {
      return activePortion.size;
    }
    return null;
  }, [activePortion]);

  // Option B: discount directly reduces the price automatically
  let autoDiscount = 0;
  let displayPrice = rawBasePrice;
  if (isAutoDiscount) {
    autoDiscount = calculateItemDiscount({ ...product, price: rawBasePrice }, matchedOffer);
    displayPrice = Math.max(0, rawBasePrice - autoDiscount);
  }

  // Option A: catalog price is NOT reduced; coupon code is displayed
  const baseComparePrice = rawBasePrice;
  const hasStrikethrough = isAutoDiscount ? true : Boolean(product?.originalPrice && product.originalPrice > baseComparePrice);
  const struckPrice = isAutoDiscount ? baseComparePrice : product?.originalPrice;
  const discountPercent = struckPrice > displayPrice ? Math.round(((struckPrice - displayPrice) / struckPrice) * 100) : 0;
  const deliveryFee = product?.restaurant?.chargeSettings?.flatDeliveryFee ?? 40;
  const freeThreshold = product?.restaurant?.chargeSettings?.freeDeliveryThreshold ?? 500;
  const prepTime = product?.preparationTime ? `${product.preparationTime} mins` : "15–20 mins";

  // Dynamic review distribution calculated honestly from reviewsList
  const starDistribution = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviewsList.forEach((r) => {
      const s = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      counts[s] = (counts[s] || 0) + 1;
    });
    const total = reviewsList.length || 1;
    return [
      { star: "5 ★", pct: Math.round((counts[5] / total) * 100), color: "bg-emerald-600 dark:bg-emerald-500" },
      { star: "4 ★", pct: Math.round((counts[4] / total) * 100), color: "bg-emerald-600 dark:bg-emerald-500" },
      { star: "3 ★", pct: Math.round((counts[3] / total) * 100), color: "bg-amber-500" },
      { star: "2 ★", pct: Math.round((counts[2] / total) * 100), color: "bg-orange-500" },
      { star: "1 ★", pct: Math.round((counts[1] / total) * 100), color: "bg-rose-500" },
    ];
  }, [reviewsList]);

  // Track product view for personalization algorithm
  useEffect(() => {
    if (product) {
      addRecentDish(product);
      trackProductView(product);
    }
  }, [product, addRecentDish]);

  // Fetch live reviews and similar products
  useEffect(() => {
    async function loadExtraData() {
      if (!product?._id) return;
      try {
        // Fetch reviews
        const rateRes = await fetch(`/api/ratings?targetType=product&targetId=${product._id}`).then((r) => r.json());
        if (rateRes.success) {
          if (rateRes.reviews && Array.isArray(rateRes.reviews)) {
            setReviewsList(rateRes.reviews);
          }
          if (rateRes.rating) setCurrentRating(rateRes.rating);
          if (rateRes.numRatings) setNumRatings(rateRes.numRatings);
        }

        // Fetch similar dishes
        const prodRes = await fetch("/api/products").then((r) => r.json());
        if (prodRes.success && Array.isArray(prodRes.products)) {
          const others = prodRes.products.filter((p) => p._id !== product._id);
          // Prefer dishes from same category or same kitchen
          const related = others.filter(
            (p) => p.category === product.category || p.restaurant?._id === product.restaurant?._id
          );
          setSimilarProducts(related.length >= 3 ? related : others.slice(0, 10));
        }

        // Fetch active offers
        fetch("/api/offers")
          .then((r) => r.json())
          .then((d) => {
            if (d.success && Array.isArray(d.offers)) setOffers(d.offers);
          })
          .catch(() => {});
      } catch (e) {
        console.error("Failed to fetch product extras:", e);
      }
    }
    loadExtraData();
  }, [product]);

  const handleAddToCart = () => {
    if (!product.isAvailable) return;
    if (selectedVariant && selectedVariant.isAvailable === false) {
      toast.error(`The "${selectedVariant.name}" size is currently out of stock.`);
      return;
    }
    if (!restStatus.isOpen) {
      toast.error(
        `${product.restaurant?.name || "Kitchen"} is ${restStatus.reason || "currently closed"}. Ordering is unavailable right now.`
      );
      return;
    }

    const itemToAdd = {
      ...product,
      _id: product._id.toString(),
      price: rawBasePrice,
      variantName: selectedVariant ? selectedVariant.name : undefined,
      portionQuantity: activePortion?.quantity,
      portionUnit: activePortion?.unit === "custom" ? activePortion?.customUnit : activePortion?.unit,
      servingLabel: activePortion?.servingLabel,
      size: activePortion?.size,
    };

    addItem(itemToAdd, quantity);
    trackAddToCart(product);
    const variantSuffix = selectedVariant ? ` (${selectedVariant.name})` : "";
    toast.success(`Added ${quantity} × ${product.name}${variantSuffix} to cart!`);
  };

  const handleBuyNow = () => {
    if (!product.isAvailable) return;
    if (selectedVariant && selectedVariant.isAvailable === false) {
      toast.error(`The "${selectedVariant.name}" size is currently out of stock.`);
      return;
    }
    if (!restStatus.isOpen) {
      toast.error(
        `${product.restaurant?.name || "Kitchen"} is ${restStatus.reason || "currently closed"}.`
      );
      return;
    }

    const itemToAdd = {
      ...product,
      _id: product._id.toString(),
      price: rawBasePrice,
      variantName: selectedVariant ? selectedVariant.name : undefined,
      portionQuantity: activePortion?.quantity,
      portionUnit: activePortion?.unit === "custom" ? activePortion?.customUnit : activePortion?.unit,
      servingLabel: activePortion?.servingLabel,
      size: activePortion?.size,
    };

    addItem(itemToAdd, quantity);
    trackAddToCart(product);
    router.push("/cart");
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.info("Dish link copied to clipboard!");
    }
  };

  // Submit Rating & Review
  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!reviewerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    try {
      setSubmittingRating(true);
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "product",
          targetId: product._id,
          rating: userStars,
          reviewText: reviewComment.trim(),
          userName: reviewerName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Thank you for your rating & feedback!");
        if (data.reviews) setReviewsList(data.reviews);
        if (data.rating) setCurrentRating(data.rating);
        if (data.numRatings) setNumRatings(data.numRatings);
        setIsRateModalOpen(false);
        setReviewComment("");
      } else {
        toast.error(data.message || "Failed to submit rating");
      }
    } catch (err) {
      toast.error("Network error while submitting rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  // Review Modal Accessibility (Focus trap, Escape listener, Body scroll lock, Focus restoration)
  useEffect(() => {
    if (!isRateModalOpen) return;

    // 1. Lock background body scrolling preserving existing inline overflow
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 2. Focus first interactive element inside dialog
    const modalEl = modalRef.current;
    if (modalEl) {
      const focusableSelector =
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusableElements = modalEl.querySelectorAll(focusableSelector);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        modalEl.focus();
      }
    }

    // 3. Handle Escape key to close and Tab key trapping
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsRateModalOpen(false);
        return;
      }

      if (e.key === "Tab") {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableSelector =
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(modal.querySelectorAll(focusableSelector)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement
        );

        if (focusables.length === 0) return;

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl || !modal.contains(document.activeElement)) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl || !modal.contains(document.activeElement)) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [isRateModalOpen]);

  const starLabels = ["Terrible", "Poor", "Average", "Good", "Excellent"];

  return (
    <main className="min-h-screen pt-24 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-[var(--text-main)] transition-colors">
      {/* ── BREADCRUMBS ─────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-6 overflow-x-auto pb-1 scrollbar-none">
        <Link href="/" className="hover:text-[var(--brand-accent)] transition font-medium">
          Home
        </Link>
        <ChevronRight size={12} className="shrink-0 opacity-60" />
        <Link href="/menu" className="hover:text-[var(--brand-accent)] transition font-medium">
          Menu
        </Link>
        {product.category && (
          <>
            <ChevronRight size={12} className="shrink-0 opacity-60" />
            <Link
              href={`/menu?category=${encodeURIComponent(product.category)}`}
              className="hover:text-[var(--brand-accent)] transition font-medium"
            >
              {product.category}
            </Link>
          </>
        )}
        <ChevronRight size={12} className="shrink-0 opacity-60" />
        <span className="font-bold text-[var(--text-main)] truncate max-w-[220px]">
          {product.name}
        </span>
      </nav>

      {/* ── MAIN PRODUCT SECTION (2 COLUMNS) ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* LEFT COLUMN: Large Image & Action Buttons (5 Columns) */}
        <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4">
          <div className="relative aspect-square w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-color)] shadow-md">
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 40vw"
              className={`object-cover ${!product.isAvailable ? "grayscale-[40%]" : ""}`}
              onError={() => setImgSrc(FALLBACK_IMAGE)}
            />

            {/* Out of Stock Overlay */}
            {!product.isAvailable && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4 text-center">
                <span className="px-4 py-1.5 rounded-full bg-rose-600 text-white text-xs font-black uppercase tracking-wider shadow-lg">
                  Out of Stock
                </span>
                <span className="text-xs text-white/90 font-medium mt-2">
                  Kitchen is currently not preparing this dish
                </span>
              </div>
            )}

            {/* FSSAI Veg / Non-Veg badge & Newly Arrived Tag */}
            <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-xs bg-[var(--bg-card)]/95 border ${
                  product.type === "veg"
                    ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                    : "border-rose-600 text-rose-700 dark:text-rose-400"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    product.type === "veg" ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                />
                {product.type === "veg" ? "Pure Veg" : "Non-Veg"}
              </span>

              {isNew && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-white shadow-md">
                  <Sparkles size={11} className="fill-white" /> New
                </span>
              )}
            </div>

            {/* Bestseller Badge */}
            {product.isFeatured && (
              <div className="absolute top-3.5 right-14 z-20 bg-amber-500 text-zinc-950 text-[11px] font-black px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                <Flame size={12} className="fill-zinc-950" /> Bestseller
              </div>
            )}

            {/* Wishlist Button */}
            <button
              onClick={() => {
                toggleFavorite(product);
                toast.info(isFav ? "Removed from favorites" : "Saved to favorites!");
              }}
              aria-label={isFav ? "Remove favorite" : "Add favorite"}
              className={`absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full border border-[var(--border-color)] flex items-center justify-center transition shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                isFav
                  ? "bg-rose-500 text-white border-rose-500"
                  : "bg-[var(--bg-card)]/90 text-[var(--text-muted)] hover:text-rose-500"
              }`}
            >
              <Heart size={16} className={isFav ? "fill-white" : ""} />
            </button>
          </div>

          {/* Action Buttons: ADD TO CART & ORDER NOW (Desktop view: visible on lg+) */}
          <div className="hidden lg:grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!product.isAvailable || !restStatus.isOpen}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white shadow-md hover:shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus:outline-hidden"
            >
              <ShoppingBag size={17} />
              <span>Add To Cart</span>
            </button>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!product.isAvailable || !restStatus.isOpen}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--text-main)] hover:opacity-90 text-[var(--bg-main)] shadow-md hover:shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--text-main)] focus-visible:ring-offset-2 focus:outline-hidden"
            >
              <Zap size={17} />
              <span>Order Now</span>
            </button>
          </div>

          {/* Safe & Hygiene Trust Badges (Desktop view: visible on lg+) */}
          <div className="hidden lg:block p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-2.5 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-emerald-500 w-4 h-4 shrink-0" />
              <span><strong className="text-[var(--text-main)]">100% Certified Kitchen</strong> with audited hygiene standards</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-[var(--brand-accent)] w-4 h-4 shrink-0" />
              <span>Prepared fresh upon order in <strong className="text-[var(--text-main)]">{prepTime}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="text-blue-500 w-4 h-4 shrink-0" />
              <span>Contactless tamper-proof sealed packaging</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Product Information (7 Columns) */}
        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
          {/* Header & Kitchen */}
          <div>
            <div className="flex items-center justify-between gap-3">
              {product.restaurant?.name ? (
                <Link
                  href={`/menu?restaurant=${product.restaurant._id || product.restaurant}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-accent)] hover:underline mb-1"
                >
                  <Building size={13} />
                  <span>{product.restaurant.name}</span>
                </Link>
              ) : <div />}

              <button
                type="button"
                onClick={handleShare}
                aria-label="Share dish link"
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--brand-accent)] transition cursor-pointer p-1"
              >
                <Share2 size={13} />
                <span>Share</span>
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[var(--text-main)] tracking-tight">
              {product.name}
            </h1>

            {/* Rating Badge & Reviews Count */}
            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              <div className="inline-flex items-center gap-1 bg-emerald-600 dark:bg-emerald-500 text-white px-2 py-0.5 rounded-[4px] text-xs font-black shadow-2xs">
                <span>{currentRating.toFixed(1)}</span>
                <Star size={11} className="fill-white" />
              </div>
              <span className="text-xs text-[var(--text-muted)] font-semibold">
                {numRatings} Ratings & {reviewsList.length} Reviews
              </span>
              <span className="text-[var(--border-color)]">•</span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} /> Certified Recipe
              </span>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl sm:text-4xl font-black text-[var(--text-main)]">
                ₹{displayPrice}
              </span>
              {hasStrikethrough && struckPrice > displayPrice && (
                <span className="text-base text-[var(--text-muted)] line-through">
                  ₹{struckPrice}
                </span>
              )}
              {discountPercent > 0 && (
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {discountPercent}% off
                </span>
              )}
            </div>

            {/* Serving / Portion Transparent Summary */}
            {activePortionText && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] shadow-2xs">
                <Utensils size={13} className="text-[var(--brand-accent)] shrink-0" />
                <span>Portion: {activePortionText}</span>
                {activePortion?.quantity && quantity > 1 && (
                  <span className="text-[var(--text-muted)] font-normal ml-1">
                    ({quantity} servings = <strong className="text-[var(--text-main)] font-bold">{quantity * Number(activePortion.quantity)} {activePortion.unit === "custom" ? activePortion.customUnit : activePortion.unit}</strong> total)
                  </span>
                )}
              </div>
            )}

            {isAutoDiscount && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                ⚡ Auto Discount Applied: Save ₹{autoDiscount} instantly!
              </p>
            )}
            <div className="text-xs text-[var(--text-muted)] mt-1 font-medium">
              Inclusive of all taxes • No hidden packing charges
            </div>
          </div>

          {/* Multiple Sizes / Pricing Variants Selector */}
          {hasVariants && (
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
                  <Layers size={14} className="text-[var(--brand-accent)]" />
                  Select Size / Variant
                </h3>
                {selectedVariant && (
                  <span className="text-[11px] font-bold text-[var(--brand-accent)]">
                    Selected: {selectedVariant.name} (₹{selectedVariant.price})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {product.variants.map((v, idx) => {
                  const isSelected = selectedVariantIndex === idx;
                  const isOutOfStock = v.isAvailable === false;
                  const vPortion = v.servingLabel || (v.portionQuantity && v.portionUnit ? `${v.portionQuantity} ${v.portionUnit}` : "") || v.size;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => setSelectedVariantIndex(idx)}
                      className={`p-3 rounded-xl border text-left transition relative cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                        isSelected
                          ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 shadow-xs"
                          : isOutOfStock
                          ? "border-[var(--border-color)] bg-[var(--bg-sub)] opacity-50 cursor-not-allowed"
                          : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40 hover:bg-[var(--bg-card)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-xs text-[var(--text-main)] truncate">
                          {v.name}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[var(--brand-accent)] shrink-0" />
                        )}
                      </div>
                      <div className="text-xs font-black text-[var(--brand-accent)] mt-1">
                        ₹{v.price}
                      </div>
                      {vPortion && (
                        <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                          {vPortion}
                        </div>
                      )}
                      {isOutOfStock && (
                        <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider mt-1 block">
                          Sold Out
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Offers Box */}
          <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5 shadow-2xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
              <Tag size={14} className="text-emerald-600 dark:text-emerald-400" /> Available Deals & Offers
            </h3>
            <div className="space-y-2 text-xs text-[var(--text-main)]">
              {/* Option B Highlight */}
              {isAutoDiscount && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">⚡</span>
                  <div>
                    <p className="font-extrabold text-emerald-700 dark:text-emerald-400">
                      Automatic Kitchen Discount: {matchedOffer.discountType === "percentage" ? `${matchedOffer.discountValue}% OFF` : `₹${matchedOffer.discountValue} OFF`}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      No coupon code needed. Discount is automatically calculated on this dish.
                    </p>
                  </div>
                </div>
              )}

              {/* Option A Highlight */}
              {isCouponOffer && (
                <div className="p-2.5 rounded-xl bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/25 flex items-start gap-2">
                  <span className="text-[var(--brand-accent)] font-black text-sm">🎟️</span>
                  <div>
                    <p className="font-extrabold text-[var(--brand-accent)]">
                      Coupon Deal: Use code <span className="font-mono bg-[var(--brand-accent)] text-white px-1.5 py-0.5 rounded text-[11px] uppercase tracking-wider">{matchedOffer.code}</span>
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Apply code at checkout to get {matchedOffer.discountType === "percentage" ? `${matchedOffer.discountValue}% OFF` : `₹${matchedOffer.discountValue} OFF`}{matchedOffer.minOrder ? ` on orders above ₹${matchedOffer.minOrder}` : ""}.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">🛵 Delivery Deal:</span>
                <span className="text-[var(--text-muted)]">
                  Free delivery for orders above ₹{freeThreshold} (Standard fee ₹{deliveryFee})
                </span>
              </div>
            </div>
          </div>

          {/* Kitchen Operational Banner */}
          {!restStatus.isOpen && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-start gap-3">
              <Clock size={18} className="shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-sm text-[var(--text-main)]">
                  {product.restaurant?.name || "Kitchen"} is {restStatus.reason || "currently closed"}
                </p>
                <p className="text-[var(--text-muted)] mt-0.5">
                  Ordering is temporarily closed. Regular kitchen operating hours:{" "}
                  <strong className="text-[var(--text-main)]">{restStatus.hoursText || "10:00 AM - 11:00 PM"}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Quantity Selector & Mobile Action Buttons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
              <span className="text-xs sm:text-sm font-bold text-[var(--text-main)]">
                Select Quantity:
              </span>
              <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-sub)] disabled:opacity-30 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center text-xs font-black text-[var(--text-main)]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  disabled={quantity >= 20}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-sub)] disabled:opacity-30 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Mobile Action Buttons: Visible only on mobile (< lg) right after quantity */}
            <div className="grid lg:hidden grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!product.isAvailable || !restStatus.isOpen}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white shadow-md hover:shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus:outline-hidden"
              >
                <ShoppingBag size={17} />
                <span>Add To Cart</span>
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!product.isAvailable || !restStatus.isOpen}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[var(--text-main)] hover:opacity-90 text-[var(--bg-main)] shadow-md hover:shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--text-main)] focus-visible:ring-offset-2 focus:outline-hidden"
              >
                <Zap size={17} />
                <span>Order Now</span>
              </button>
            </div>
          </div>

          {/* Specifications Table */}
          <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)]">
              Dish Specifications & Highlights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Diet Type</span>
                <span className="font-bold capitalize text-[var(--text-main)]">{product.type || "Veg"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Category</span>
                <span className="font-bold text-[var(--text-main)]">{product.category || "General"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Preparation Time</span>
                <span className="font-bold text-[var(--text-main)]">{prepTime}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Delivery Radius</span>
                <span className="font-bold text-[var(--text-main)]">Up to {product.restaurant?.deliverySettings?.deliveryRadiusKm ?? 10} km</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Portion / Serving</span>
                <span className="font-bold text-[var(--text-main)]">{activePortionText || "Standard Serving"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] font-medium">Kitchen Partner</span>
                <span className="font-bold text-[var(--text-main)]">{product.restaurant?.name || "Local Kitchen"}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                Description
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Safe & Hygiene Trust Badges (Mobile view: visible below lg) */}
          <div className="lg:hidden p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-2.5 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-emerald-500 w-4 h-4 shrink-0" />
              <span><strong className="text-[var(--text-main)]">100% Certified Kitchen</strong> with audited hygiene standards</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-[var(--brand-accent)] w-4 h-4 shrink-0" />
              <span>Prepared fresh upon order in <strong className="text-[var(--text-main)]">{prepTime}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="text-blue-500 w-4 h-4 shrink-0" />
              <span>Contactless tamper-proof sealed packaging</span>
            </div>
          </div>

          {/* ── RATINGS & REVIEWS SECTION ───────────────────────────── */}
          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-main)]">
                  Ratings & Reviews
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Customer ratings and dining feedback
                </p>
              </div>

              {/* Rate Product Trigger Button */}
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsRateModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
              >
                <Star size={13} className="fill-white" />
                Rate Product
              </button>
            </div>

            {/* Score Breakdown Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-[var(--bg-sub)] p-4 rounded-xl border border-[var(--border-color)]">
              <div className="sm:col-span-4 text-center sm:text-left sm:border-r sm:border-[var(--border-color)] sm:pr-4">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-[var(--text-main)]">
                    {currentRating.toFixed(1)}
                  </span>
                  <Star size={24} className="fill-emerald-600 dark:fill-emerald-500 text-emerald-600 dark:text-emerald-500" />
                </div>
                <div className="text-xs text-[var(--text-muted)] font-medium mt-1">
                  {numRatings} Ratings & {reviewsList.length} Reviews
                </div>
              </div>

              <div className="sm:col-span-8 space-y-1.5 text-xs">
                {starDistribution.map((row) => (
                  <div key={row.star} className="flex items-center gap-2">
                    <span className="w-7 text-right font-bold text-[var(--text-muted)]">
                      {row.star}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.color}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[var(--text-muted)] font-medium">
                      {row.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews Feed */}
            {reviewsList.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--text-muted)]">
                <MessageSquare size={24} className="mx-auto mb-1.5 opacity-50" />
                No written customer reviews yet. Be the first to share your thoughts!
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-color)] space-y-4 pt-2">
                {reviewsList.slice(0, 5).map((rev, idx) => (
                  <div key={rev._id || idx} className="pt-4 first:pt-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5 bg-emerald-600 dark:bg-emerald-500 text-white px-1.5 py-0.5 rounded-[3px] text-[10px] font-black">
                        {rev.rating || 5} <Star size={9} className="fill-white" />
                      </span>
                      <span className="text-xs font-bold text-[var(--text-main)]">
                        {rev.userName || "Customer"}
                      </span>
                      {rev.isVerifiedPurchase === true ? (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 ml-auto">
                          <CheckCircle2 size={11} /> Verified Buyer
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)] font-medium flex items-center gap-0.5 ml-auto">
                          Customer Review
                        </span>
                      )}
                    </div>
                    {rev.comment && (
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {rev.comment}
                      </p>
                    )}
                    <div className="text-[10px] text-[var(--text-muted)] opacity-80 flex items-center gap-3">
                      <span>{rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : "Recent Order"}</span>
                      <span className="flex items-center gap-1 hover:text-[var(--text-main)] cursor-pointer">
                        <ThumbsUp size={11} /> Helpful
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SIMILAR DISHES CAROUSEL ───────────────────────────────── */}
      {similarProducts.length > 0 && (
        <div className="mt-16 sm:mt-20">
          <ProductCarousel
            title="Similar Dishes You Might Also Like"
            subtitle="Explore related flavors from our certified partner kitchens"
            badge="Recommended"
            products={similarProducts}
            viewAllHref="/menu"
          />
        </div>
      )}

      {/* ── INTERACTIVE RATE PRODUCT MODAL ───────────────────────── */}
      {isRateModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsRateModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rate-review-title"
            tabIndex={-1}
            className="relative w-full max-w-md bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-color)] shadow-2xl animate-[fadeIn_0.2s_ease]"
          >
            <button
              onClick={() => setIsRateModalOpen(false)}
              aria-label="Close review dialog"
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
            >
              <X size={18} />
            </button>

            <h3 id="rate-review-title" className="text-lg font-black text-[var(--text-main)] mb-1">
              Rate & Review {product.name}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Share your dining feedback to help fellow foodies choose better meals.
            </p>

            <form onSubmit={handleSubmitRating} className="space-y-4">
              {/* Star Rating Picker */}
              <div className="text-center p-3 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
                <div className="flex justify-center gap-2 mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverStars(star)}
                      onMouseLeave={() => setHoverStars(0)}
                      onClick={() => setUserStars(star)}
                      aria-label={`Rate ${star} star`}
                      className="p-1 transition-transform hover:scale-125 focus:outline-hidden cursor-pointer"
                    >
                      <Star
                        size={28}
                        className={`transition-colors ${
                          (hoverStars || userStars) >= star
                            ? "fill-amber-400 text-amber-400"
                            : "text-[var(--border-color)]"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-bold text-amber-500">
                  {starLabels[(hoverStars || userStars) - 1]}
                </span>
              </div>

              {/* Reviewer Name */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-accent)] focus:outline-hidden"
                />
              </div>

              {/* Review Comment */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                  Your Review & Feedback
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Tell us about the flavor, portion, hygiene, and taste..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-accent)] focus:outline-hidden resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRating}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingRating ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
