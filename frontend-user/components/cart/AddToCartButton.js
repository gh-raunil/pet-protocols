"use client";

import useCartStore from "@/lib/cartStore";
import { toast } from "@/components/ui/ToastProvider";
import { ShoppingBag } from "lucide-react";

export default function AddToCartButton({ product, quantity = 1 }) {
  const addItem = useCartStore((s) => s.addItem);

  function handleAdd() {
    if (!product.isAvailable) return;
    for (let i = 0; i < quantity; i++) {
      addItem({ ...product, _id: product._id.toString() });
    }
    toast.success(`${product.name} added to your feast!`);
  }

  return (
    <button
      onClick={handleAdd}
      disabled={!product.isAvailable}
      className={`w-full sm:w-auto transition-all px-8 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${
        product.isAvailable
          ? "bg-[var(--brand-accent)] hover:opacity-95 text-white cursor-pointer shadow-lg shadow-[var(--brand-accent)]/20 active:scale-98"
          : "bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)] cursor-not-allowed"
      }`}
    >
      <ShoppingBag size={18} />
      <span>{product.isAvailable ? "Add to Cart" : "Out of Stock"}</span>
    </button>
  );
}