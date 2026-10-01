"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Building, Heart, Check, XCircle } from "lucide-react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";
import { toast } from "@/components/ui/ToastProvider";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

export default function ProductCard({ product }) {
  const { addItem } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const imageSrc = product.image || FALLBACK_IMAGE;
  const isFav = isFavorite(product._id);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.isAvailable) return;

    addItem(product);
    toast.success(`${product.name} added to cart!`);
  };

  const handleToggleFav = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(product);
    if (!isFav) {
      toast.info(`Added to your favorites`);
    } else {
      toast.info(`Removed from favorites`);
    }
  };

  return (
    <div
      className={`group relative flex flex-col justify-between bg-[var(--bg-card)] rounded-3xl overflow-hidden border border-[var(--border-color)] transition-all duration-300 hover:border-[var(--brand-accent)]/40 hover:shadow-xl hover:-translate-y-1 ${
        !product.isAvailable ? "opacity-75" : ""
      }`}
    >
      <Link href={`/menu/${product._id}`} className="block flex-1 flex flex-col">
        {/* Product Image Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--bg-sub)]">
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className={`object-cover transition-transform duration-500 ${
              product.isAvailable ? "group-hover:scale-105" : "grayscale-[40%]"
            }`}
          />

          {/* Out of Stock Overlay */}
          {!product.isAvailable && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-center z-10">
              <span className="px-3 py-1 rounded-full bg-red-600/90 text-white text-[11px] font-black uppercase tracking-wider shadow">
                Out of Stock
              </span>
            </div>
          )}

          {/* Top badges: Veg/Non-Veg & Favorite button */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
            {/* Veg / Non-Veg badge */}
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md shadow-sm ${
                product.type === "veg"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40"
                  : "bg-rose-950/80 text-rose-400 border border-rose-500/40"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  product.type === "veg" ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              {product.type === "veg" ? "Veg" : "Non-Veg"}
            </span>

            {/* Favorite Wishlist Button */}
            <button
              type="button"
              onClick={handleToggleFav}
              aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
              className={`pointer-events-auto p-2 rounded-full backdrop-blur-md transition shadow-sm ${
                isFav
                  ? "bg-rose-500 text-white"
                  : "bg-black/40 text-white/80 hover:text-white hover:bg-black/60"
              }`}
            >
              <Heart size={14} className={isFav ? "fill-white" : ""} />
            </button>
          </div>
        </div>

        {/* Card Content Details */}
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            {/* Restaurant name */}
            {product.restaurant?.name && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] truncate mb-1">
                <Building size={11} className="text-[var(--brand-accent)] shrink-0" />
                <span className="truncate">{product.restaurant.name}</span>
              </p>
            )}

            {/* Dish title */}
            <h3 className="text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition line-clamp-1">
              {product.name}
            </h3>

            {/* Short description */}
            {product.description && (
              <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1 leading-relaxed">
                {product.description}
              </p>
            )}
          </div>

          {/* Pricing and Action row */}
          <div className="pt-3.5 mt-2 border-t border-[var(--border-color)] flex items-center justify-between">
            <div>
              <span className="text-base font-extrabold text-[var(--text-main)]">
                ₹{product.price}
              </span>
            </div>

            {product.isAvailable ? (
              <button
                type="button"
                onClick={handleAddToCart}
                className="px-3.5 py-1.5 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 hover:opacity-90 active:scale-95 transition flex items-center gap-1.5"
                aria-label={`Add ${product.name} to cart`}
              >
                <Plus size={14} strokeWidth={3} />
                <span>Add</span>
              </button>
            ) : (
              <span className="text-[11px] font-bold text-red-500/80 flex items-center gap-1">
                <XCircle size={13} /> Unavailable
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
