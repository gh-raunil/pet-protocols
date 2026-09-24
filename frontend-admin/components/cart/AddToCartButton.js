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
      className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 
                 disabled:cursor-not-allowed transition px-8 py-4 
                 rounded-2xl font-black text-lg"
    >
      {product.isAvailable ? "Add To Cart" : "Unavailable"}
    </button>
  );
}