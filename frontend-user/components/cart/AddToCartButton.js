"use client";
import useCartStore from "@/lib/cartStore";
import toast from "react-hot-toast";

export default function AddToCartButton({ product }) {
  const addItem = useCartStore((s) => s.addItem);

  function handleAdd() {
    if (!product.isAvailable) return;
    addItem({ ...product, _id: product._id.toString() });
    toast.success(`${product.name} added to cart!`);
  }

  return (
    <button
      onClick={handleAdd}
      disabled={!product.isAvailable}
      className={`transition px-8 py-4 rounded-2xl font-black text-lg ${
        product.isAvailable
          ? "bg-orange-500 hover:bg-orange-400 text-white cursor-pointer shadow-lg shadow-orange-500/20"
          : "bg-white/10 text-white/30 border border-white/10 cursor-not-allowed"
      }`}
    >
      {product.isAvailable ? "Add To Cart" : "Out of Stock"}
    </button>
  );
}