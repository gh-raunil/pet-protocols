"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building,
  Clock,
  Heart,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  XCircle,
  Share2,
  Star,
  ShieldCheck,
  Tag,
  Zap,
  Truck,
  ThumbsUp,
  MessageSquare,
  Award,
  ChevronRight,
  X,
  Flame,
} from "lucide-react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";
import useRecentStore from "@/lib/recentStore";
import { toast } from "@/components/ui/ToastProvider";
import { useOperationalStatus } from "@/lib/restaurantHours";
import { trackAddToCart, trackProductView } from "@/lib/userPreferences";
import ProductCarousel from "@/components/products/ProductCarousel";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800";

export default function ProductDetailClient({ product }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [reviewsList, setReviewsList] = useState(product?.reviews || []);
  const [currentRating, setCurrentRating] = useState(product?.rating || 4.5);
  const [numRatings, setNumRatings] = useState(product?.numRatings || 18);

  // Rate Modal State
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [userStars, setUserStars] = useState(5);
  const [hoverStars, setHoverStars] = useState(0);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const addRecentDish = useRecentStore((s) => s.addRecentDish);

  const isFav = isFavorite(product._id);
  const imageSrc = product.image || FALLBACK_IMAGE;
  const restStatus = useOperationalStatus(product.restaurant);

  // Calculate simulated MRP and discount like Flipkart
  const mrp = product.originalPrice || Math.round(product.price * 1.25);
  const discountPercent = mrp > product.price ? Math.round(((mrp - product.price) / mrp) * 100) : 0;
  const deliveryFee = product.restaurant?.chargeSettings?.flatDeliveryFee ?? 40;
  const freeThreshold = product.restaurant?.chargeSettings?.freeDeliveryThreshold ?? 500;
  const prepTime = product.preparationTime ? `${product.preparationTime} mins` : "15–20 mins";

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
      } catch (e) {
        console.error("Failed to fetch product extras:", e);
      }
    }
    loadExtraData();
  }, [product]);

  const handleAddToCart = () => {
    if (!product.isAvailable) return;
    if (!restStatus.isOpen) {
      toast.error(
        `${product.restaurant?.name || "Kitchen"} is ${restStatus.reason || "currently closed"}. Ordering is unavailable right now.`
      );
      return;
    }
    for (let i = 0; i < quantity; i++) {
      addItem({ ...product, _id: product._id.toString() });
    }
    trackAddToCart(product);
    toast.success(`Added ${quantity} × ${product.name} to cart!`);
  };

  const handleBuyNow = () => {
    if (!product.isAvailable) return;
    if (!restStatus.isOpen) {
      toast.error(
        `${product.restaurant?.name || "Kitchen"} is ${restStatus.reason || "currently closed"}.`
      );
      return;
    }
    for (let i = 0; i < quantity; i++) {
      addItem({ ...product, _id: product._id.toString() });
    }
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

  const starLabels = ["Terrible", "Poor", "Average", "Good", "Excellent"];

  return (
    <main className="min-h-screen pt-24 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-[var(--text-main)] transition-colors">
      {/* ── BREADCRUMBS (FLIPKART STYLE) ─────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-6 overflow-x-auto pb-1 scrollbar-none">
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
              src={imageSrc}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 40vw"
              className={`object-cover ${!product.isAvailable ? "grayscale-[40%]" : ""}`}
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

            {/* FSSAI Veg / Non-Veg badge */}
            <div className="absolute top-3.5 left-3.5 z-20">
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
            </div>

            {/* Bestseller Badge */}
            {product.isFeatured && (
              <div className="absolute top-3.5 right-14 z-20 bg-amber-500 text-black text-[11px] font-black px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                <Flame size={12} className="fill-black" /> Bestseller
              </div>
            )}

            {/* Wishlist Button */}
            <button
              onClick={() => {
                toggleFavorite(product);
                toast.info(isFav ? "Removed from favorites" : "Saved to favorites!");
              }}
              aria-label={isFav ? "Remove favorite" : "Add favorite"}
              className={`absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full border border-[var(--border-color)] flex items-center justify-center transition shadow-xs cursor-pointer ${
                isFav
                  ? "bg-rose-500 text-white border-rose-500"
                  : "bg-[var(--bg-card)]/90 text-[var(--text-muted)] hover:text-rose-500"
              }`}
            >
              <Heart size={16} className={isFav ? "fill-white" : ""} />
            </button>
          </div>

          {/* Flipkart-Style Action Buttons: ADD TO CART & BUY NOW */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!product.isAvailable || !restStatus.isOpen}
              className="w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[#ff9f00] hover:bg-[#f39700] text-white shadow-md hover:shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShoppingBag size={17} />
              <span>Add To Cart</span>
            </button>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!product.isAvailable || !restStatus.isOpen}
              className="w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-[#fb641b] hover:bg-[#e95a12] text-white shadow-md hover:shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Zap size={17} />
              <span>Order Now</span>
            </button>
          </div>

          {/* Safe & Hygiene Trust Badges */}
          <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-2.5 text-xs text-[var(--text-muted)]">
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

        {/* RIGHT COLUMN: Product Information & Flipkart Features (7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header & Kitchen */}
          <div>
            {product.restaurant?.name && (
              <Link
                href={`/menu?restaurant=${product.restaurant._id || product.restaurant}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-accent)] hover:underline mb-1"
              >
                <Building size={13} />
                <span>{product.restaurant.name}</span>
              </Link>
            )}

            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] tracking-tight">
              {product.name}
            </h1>

            {/* Flipkart-Style Rating Badge & Reviews Count */}
            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              <div className="inline-flex items-center gap-1 bg-[#388e3c] text-white px-2 py-0.5 rounded-[4px] text-xs font-black shadow-2xs">
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

          {/* Pricing Section (Flipkart Style) */}
          <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl sm:text-4xl font-black text-[var(--text-main)]">
                ₹{product.price}
              </span>
              {mrp > product.price && (
                <span className="text-base text-[var(--text-muted)] line-through">
                  ₹{mrp}
                </span>
              )}
              {discountPercent > 0 && (
                <span className="text-sm font-bold text-[#388e3c]">
                  {discountPercent}% off
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1 font-medium">
              Inclusive of all taxes • No hidden packing charges
            </div>
          </div>

          {/* Available Offers Box (Flipkart Style) */}
          <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5 shadow-2xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
              <Tag size={14} className="text-emerald-600" /> Available Offers
            </h3>
            <div className="space-y-2 text-xs text-[var(--text-main)]">
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold shrink-0">🏷️ Bank Offer:</span>
                <span className="text-[var(--text-muted)]">5% Unlimited Cashback on Pet Protocols Axis or ICICI Cards</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold shrink-0">🏷️ Special Price:</span>
                <span className="text-[var(--text-muted)]">Get flat ₹50 OFF on orders above ₹299 using promo coupon at checkout</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold shrink-0">🏷️ Partner Deal:</span>
                <span className="text-[var(--text-muted)]">
                  Free delivery for orders above ₹{freeThreshold} (Standard fee ₹{deliveryFee})
                </span>
              </div>
            </div>
          </div>

          {/* Kitchen Operational Banner & Details */}
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

          {/* Quantity Selector */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
            <span className="text-xs sm:text-sm font-bold text-[var(--text-main)]">
              Select Quantity:
            </span>
            <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-sub)] disabled:opacity-30 transition cursor-pointer"
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
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-sub)] disabled:opacity-30 transition cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Specifications Table (Flipkart Style) */}
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
                <span className="font-bold text-[var(--text-main)]">Standard 1 Person</span>
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

          {/* ── RATINGS & REVIEWS SECTION (FLIPKART STYLE) ───────────── */}
          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-main)]">
                  Ratings & Reviews
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Authentic reviews from verified foodies
                </p>
              </div>

              {/* Rate Product Trigger Button */}
              <button
                type="button"
                onClick={() => setIsRateModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--brand-accent)] hover:opacity-90 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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
                  <Star size={24} className="fill-[#388e3c] text-[#388e3c]" />
                </div>
                <div className="text-xs text-[var(--text-muted)] font-medium mt-1">
                  {numRatings} Ratings & {reviewsList.length} Reviews
                </div>
              </div>

              <div className="sm:col-span-8 space-y-1.5 text-xs">
                {[
                  { star: "5 ★", pct: 72, color: "bg-[#388e3c]" },
                  { star: "4 ★", pct: 18, color: "bg-[#388e3c]" },
                  { star: "3 ★", pct: 6, color: "bg-amber-400" },
                  { star: "2 ★", pct: 3, color: "bg-orange-400" },
                  { star: "1 ★", pct: 1, color: "bg-rose-500" },
                ].map((row) => (
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
                      <span className="inline-flex items-center gap-0.5 bg-[#388e3c] text-white px-1.5 py-0.5 rounded-[3px] text-[10px] font-black">
                        {rev.rating || 5} <Star size={9} className="fill-white" />
                      </span>
                      <span className="text-xs font-bold text-[var(--text-main)]">
                        {rev.userName || "Verified Foodie"}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 ml-auto">
                        <CheckCircle2 size={11} /> Certified Buyer
                      </span>
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

      {/* ── SIMILAR DISHES CAROUSEL (FLIPKART STYLE) ──────────────── */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-color)] shadow-2xl animate-[fadeIn_0.2s_ease]">
            <button
              onClick={() => setIsRateModalOpen(false)}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-black text-[var(--text-main)] mb-1">
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
                  className="flex-1 py-2.5 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
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
