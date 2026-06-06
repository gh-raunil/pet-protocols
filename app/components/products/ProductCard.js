"use client";

import toast from "react-hot-toast";
import useCartStore from "@/lib/cartStore";
import { ShoppingCart, Star } from "lucide-react";

export default function ProductCard({ product }) {
  const { addItem } = useCartStore();

  const handleAddToCart = () => {
    if (!product.isAvailable) return;
    addItem(product);
    toast.custom((t) => (
      <div
        className={`
        ${t.visible ? "animate-[toastIn_0.35s_ease]" : "animate-[toastOut_0.35s_ease]"}
        w-72 bg-[#111] border border-white/10 rounded-2xl px-4 py-3
        flex items-center gap-3 relative shadow-2xl
      `}
      >
        <img
          src={product.image}
          alt={product.name}
          className="w-12 h-12 rounded-xl object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-orange-400 font-semibold uppercase tracking-widest">
            Added ✓
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
    <div className="group relative bg-[#111111] rounded-3xl overflow-hidden border border-white/5 hover:border-orange-500/30 transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      {/* Image */}
      <div className="relative h-56 overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />

        {/* Strong bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/20 to-transparent" />

        {/* Top row badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          {/* Availability pill */}
          <span
            className={`text-[11px] font-bold px-3 py-1 rounded-full backdrop-blur-sm
            ${
              product.isAvailable
                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}
          >
            {product.isAvailable ? "● Live" : "● Off"}
          </span>
        </div>

        {/* Bottom row — overlaid on image */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex justify-between items-end">
          {/* Price — big and bold */}
          <div>
            <p className="text-white/50 text-[11px] font-medium uppercase tracking-widest mb-0.5">
              Price
            </p>
            <p className="text-white font-black text-3xl leading-none">
              ₹{product.price}
            </p>
          </div>

          {/* Featured badge */}
          {product.isFeatured && (
            <span className="flex items-center gap-1 bg-yellow-400 text-yellow-900 text-[11px] font-black px-3 py-1.5 rounded-full uppercase tracking-wide">
              <Star size={10} fill="currentColor" />
              Top Pick
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

          {/* Clean inline veg/non-veg indicator */}
          <span
            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest
              ${product.type === "veg" ? "text-green-400" : "text-red-400"}`
            }
          >
            <span
              className={`w-2 h-2 rounded-full inline-block
                ${product.type === "veg" ? "bg-green-400" : "bg-red-400"}`
              }
            />
            {product.type === "veg" ? "Veg" : "Non-Veg"}
          </span>
        </div>

        <h3 className="text-white font-black text-lg leading-tight mb-2 line-clamp-1">
          {product.name}
        </h3>

        <p className="text-white/40 text-sm leading-relaxed line-clamp-2 mb-4">
          {product.description}
        </p>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={!product.isAvailable}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-200
            ${
              product.isAvailable
                ? "bg-orange-500 text-white hover:bg-orange-400 active:scale-95"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            }`}
        >
          {product.isAvailable ? (
            <>
              <ShoppingCart size={16} strokeWidth={2.5} /> Add to Cart
            </>
          ) : (
            "Unavailable"
          )}
        </button>
      </div>
    </div>
  );
}
