"use client";

import toast from "react-hot-toast";
import useCartStore from "@/lib/cartStore";
import { ShoppingCart, Star, Building } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

export default function ProductCard({ product }) {
  const { addItem } = useCartStore();
  const imageSrc = product.image || FALLBACK_IMAGE;

  const handleAddToCart = () => {
    if (!product.isAvailable) return;
    addItem(product);
    toast.custom((t) => (
      <div
        className={`
        ${t.visible ? "animate-[toastIn_0.35s_ease]" : "animate-[toastOut_0.35s_ease]"}
        w-72 bg-[#111] border border-white/10 rounded-2xl px-4 py-3
        flex items-center gap-3 relative shadow-2xl z-50
      `}
      >
        <Image
          src={imageSrc}
          alt={product.name}
          width={48}
          height={48}
          className="w-12 h-12 rounded-xl object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-orange-400 font-semibold uppercase tracking-widest">
            Added to Feast ✓
          </p>
          <p className="text-white font-bold text-sm truncate">
            {product.name}
          </p>
          <p className="text-white/40 text-xs">₹{product.price}</p>
        </div>
        <button
          onClick={() => toast.remove(t.id)}
          className="text-white/30 hover:text-white transition text-lg leading-none"
        >
          ×
        </button>
      </div>
    ));
  };

  return (
    <Link href={`/menu/${product._id}`} className="block">
      <div
        className={`group relative bg-[#111111] rounded-3xl overflow-hidden border transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)] ${
          product.isAvailable
            ? "border-white/5 hover:border-orange-500/30 hover:-translate-y-1 cursor-pointer"
            : "border-red-500/20 opacity-80"
        }`}
      >
        {/* Image */}
        <div className="relative h-56 overflow-hidden">
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover transition-transform duration-700 ease-out ${
              product.isAvailable ? "group-hover:scale-110" : "grayscale-[40%]"
            }`}
          />

          {/* Strong bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/20 to-transparent pointer-events-none" />

          {/* Out of stock overlay */}
          {!product.isAvailable && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none z-10">
              <span className="px-3.5 py-1.5 rounded-full bg-red-600/90 text-white text-xs font-black uppercase tracking-wider shadow-lg border border-red-400/30">
                Out of Stock
              </span>
              <span className="text-[11px] text-white/70 font-semibold mt-1">
                Currently Unavailable
              </span>
            </div>
          )}

          {/* Top row badges */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
            {/* Restaurant name pill */}
            {product.restaurant?.name ? (
              <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/75 text-orange-300 border border-orange-500/30 backdrop-blur-md">
                <Building size={11} className="text-orange-400" />
                <span className="truncate max-w-[140px]">{product.restaurant.name}</span>
              </span>
            ) : (
              <div />
            )}

            {/* Availability pill */}
            <span
              className={`text-[11px] font-bold px-3 py-1 rounded-full backdrop-blur-sm
            ${
              product.isAvailable
                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}
            >
              {product.isAvailable ? "● Live" : "● Out of Stock"}
            </span>
          </div>

          {/* Bottom overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex justify-between items-end z-10">
            <div>
              <p className="text-white/50 text-[11px] font-medium uppercase tracking-widest mb-0.5">
                Price
              </p>
              <p className="text-white font-black text-3xl leading-none">
                ₹{product.price}
              </p>
            </div>

            {product.isFeatured && (
              <span className="flex items-center gap-1 bg-yellow-400 text-yellow-900 text-[11px] font-black px-3 py-1.5 rounded-full uppercase tracking-wide">
                <Star size={10} fill="currentColor" />
                Signature Pick
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
              {product.category}
            </span>

            <span className="w-1 h-1 rounded-full bg-white/20" />

            <span
              className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest
            ${product.type === "veg" ? "text-green-400" : "text-red-400"}`}
            >
              <span
                className={`w-2 h-2 rounded-full inline-block
              ${product.type === "veg" ? "bg-green-400" : "bg-red-400"}`}
              />
              {product.type === "veg" ? "Veg" : "Non-Veg"}
            </span>
          </div>

          {/* Product Name */}
          <h3 className="text-white font-black text-lg leading-tight mb-2 line-clamp-1 group-hover:text-orange-300 transition">
            {product.name}
          </h3>

          {/* Description */}
          <p className="text-white/40 text-sm leading-relaxed line-clamp-2 mb-4">
            {product.description}
          </p>

          {/* Add To Cart */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddToCart();
            }}
            disabled={!product.isAvailable}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-200
          ${
            product.isAvailable
              ? "bg-orange-500 text-white hover:bg-orange-400 active:scale-95 shadow-lg shadow-orange-500/20 cursor-pointer"
              : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
          }`}
          >
            {product.isAvailable ? (
              <>
                <ShoppingCart size={16} strokeWidth={2.5} />
                Add to Feast
              </>
            ) : (
              "Out of Stock"
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}
