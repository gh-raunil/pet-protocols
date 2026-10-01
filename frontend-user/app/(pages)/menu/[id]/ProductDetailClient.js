"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";
import useRecentStore from "@/lib/recentStore";
import { toast } from "@/components/ui/ToastProvider";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600";

export default function ProductDetailClient({ product }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const addRecentDish = useRecentStore((s) => s.addRecentDish);

  const isFav = isFavorite(product._id);
  const imageSrc = product.image || FALLBACK_IMAGE;

  // Add to recently viewed dishes on visit
  useEffect(() => {
    if (product) {
      addRecentDish(product);
    }
  }, [product, addRecentDish]);

  const handleAddToCart = () => {
    if (!product.isAvailable) return;
    for (let i = 0; i < quantity; i++) {
      addItem({ ...product, _id: product._id.toString() });
    }
    toast.success(
      `Added ${quantity} × ${product.name} to cart!`
    );
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.info("Dish link copied to clipboard!");
    }
  };

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-[var(--text-main)] transition-colors">
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            aria-label="Share dish"
            className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
          >
            <Share2 size={16} />
          </button>
          <button
            onClick={() => {
              toggleFavorite(product);
              toast.info(isFav ? "Removed from favorites" : "Saved to favorites!");
            }}
            aria-label={isFav ? "Remove favorite" : "Add favorite"}
            className={`p-2.5 rounded-xl border border-[var(--border-color)] transition ${
              isFav
                ? "bg-rose-500 text-white border-rose-500"
                : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <Heart size={16} className={isFav ? "fill-white" : ""} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
        {/* LEFT COLUMN: Large Image and badges */}
        <div className="space-y-4">
          <div className="relative aspect-[4/3] sm:aspect-square rounded-3xl overflow-hidden bg-[var(--bg-sub)] border border-[var(--border-color)] shadow-xl">
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className={`object-cover ${!product.isAvailable ? "grayscale-[40%]" : ""}`}
            />

            {/* Out of Stock Overlay */}
            {!product.isAvailable && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4 text-center">
                <span className="px-4 py-1.5 rounded-full bg-red-600/90 text-white text-xs font-black uppercase tracking-wider shadow-lg">
                  Out of Stock
                </span>
                <span className="text-xs text-white/80 font-medium mt-2">
                  This dish is currently not accepting orders
                </span>
              </div>
            )}

            {/* Veg / Non-Veg badge */}
            <div className="absolute top-4 left-4 z-20">
              <span
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md shadow-sm ${
                  product.type === "veg"
                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40"
                    : "bg-rose-950/80 text-rose-400 border border-rose-500/40"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    product.type === "veg" ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                {product.type === "veg" ? "Pure Veg" : "Non-Veg"}
              </span>
            </div>

            {product.isFeatured && (
              <div className="absolute top-4 right-4 z-20 bg-amber-500/90 text-black text-xs font-black px-3 py-1.5 rounded-full shadow-md">
                ⭐ Bestseller
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Details & Ordering */}
        <div className="space-y-6">
          {/* Category & Kitchen */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] text-xs font-bold uppercase tracking-wider">
                {product.category}
              </span>
              {product.isAvailable ? (
                <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 size={13} /> In Stock
                </span>
              ) : (
                <span className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                  <XCircle size={13} /> Currently Unavailable
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight">
              {product.name}
            </h1>

            {product.restaurant?.name && (
              <Link
                href={`/menu?restaurant=${product.restaurant._id || product.restaurant}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--brand-accent)] transition mt-2"
              >
                <Building size={14} className="text-[var(--brand-accent)]" />
                <span>Prepared by {product.restaurant.name}</span>
              </Link>
            )}
          </div>

          {/* Pricing Row */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-black text-[var(--brand-accent)]">
              ₹{product.price}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              Inclusive of all taxes
            </span>
          </div>

          {/* Description */}
          {product.description && (
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Description
              </h3>
              <p className="text-sm text-[var(--text-main)] leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Key Attributes Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center">
              <span className="text-[11px] text-[var(--text-muted)] block">Prep Time</span>
              <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] mt-0.5 block">
                {product.preparationTime ? `${product.preparationTime} mins` : "15–20 mins"}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center">
              <span className="text-[11px] text-[var(--text-muted)] block">Cuisine Type</span>
              <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] mt-0.5 block">
                {product.type === "veg" ? "Pure Vegetarian" : "Non-Vegetarian"}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center">
              <span className="text-[11px] text-[var(--text-muted)] block">Delivery Fee</span>
              <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] mt-0.5 block">
                ₹40 Flat
              </span>
            </div>
          </div>

          {/* Quantity Controls & Add to Cart Card */}
          <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[var(--text-main)]">Quantity</span>
              <div className="flex items-center gap-3 bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || !product.isAvailable}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] disabled:opacity-30 transition"
                  aria-label="Decrease quantity"
                >
                  <Minus size={15} />
                </button>
                <span className="w-8 text-center text-sm font-black text-[var(--text-main)]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  disabled={quantity >= 20 || !product.isAvailable}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] disabled:opacity-30 transition"
                  aria-label="Increase quantity"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!product.isAvailable}
                className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                  product.isAvailable
                    ? "bg-[var(--brand-accent)] hover:opacity-95 text-white shadow-[var(--brand-accent)]/25 active:scale-98 cursor-pointer"
                    : "bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)] cursor-not-allowed"
                }`}
              >
                <ShoppingBag size={18} />
                <span>
                  {product.isAvailable
                    ? `Add to Cart • ₹${product.price * quantity}`
                    : "Currently Unavailable"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
