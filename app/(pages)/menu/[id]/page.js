// app/(pages)/menu/[id]/page.js
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { notFound } from "next/navigation";
import Link from "next/link";
import AddToCartButton from "@/app/components/cart/AddToCartButton";
import BackButton from "@/components/ui/BackButton";

export default async function ProductPage({ params }) {
  const { id } = await params;

  await connectDB();
  const raw = await Product.findById(id).lean();

  if (!raw) notFound();

  // ✅ Serialize — fixes the "plain objects only" error
  const product = JSON.parse(JSON.stringify(raw));

  return (
    <div className="min-h-screen bg-black text-white mt-10">
      <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-2 gap-16 items-start">
        {/* LEFT — Image */}
        <div className="sticky top-24">
          <div className="relative rounded-3xl overflow-hidden bg-[#111]">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-[420px] object-cover"
            />

            {/* Veg / Non-Veg badge */}
            <div className="absolute top-4 left-4">
              <span
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm
                  ${
                    product.type === "veg"
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${product.type === "veg" ? "bg-green-400" : "bg-red-400"}`}
                />
                {product.type === "veg" ? "Pure Veg" : "Non-Veg"}
              </span>
            </div>

            {/* Featured badge */}
            {product.isFeatured && (
              <div className="absolute top-4 right-4 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
                ⭐ Top Pick
              </div>
            )}
          </div>

          {/* Tags row */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs px-3 py-1 rounded-full font-medium">
              {product.category}
            </span>
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium border
              ${
                product.isAvailable
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              {product.isAvailable ? "● In Stock" : "● Out of Stock"}
            </span>
          </div>
        </div>

        {/* RIGHT — Details */}
        <div className="py-4">
          <div className="flex justify-between">

            {/* Category label */}
            <p className="text-orange-400 uppercase tracking-[0.25em] text-xs font-bold mb-3">
              {product.category}
            </p>

            {/* Back Button */}
            <div className="">
              <BackButton />
            </div>

          </div>

          {/* Name */}
          <h1 className="text-5xl font-black leading-tight mb-4">
            {product.name}
          </h1>

          {/* Description */}
          <p className="text-white/60 text-base leading-relaxed mb-8 border-b border-white/10 pb-8">
            {product.description}
          </p>

          {/* Info cards */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-[#111] rounded-2xl p-4 text-center border border-white/5">
              <p className="text-white/40 text-xs mb-1">Prep Time</p>
              <p className="text-white font-bold text-sm">15–20 min</p>
            </div>
            <div className="bg-[#111] rounded-2xl p-4 text-center border border-white/5">
              <p className="text-white/40 text-xs mb-1">Category</p>
              <p className="text-white font-bold text-sm">{product.category}</p>
            </div>
            <div className="bg-[#111] rounded-2xl p-4 text-center border border-white/5">
              <p className="text-white/40 text-xs mb-1">Type</p>
              <p
                className={`font-bold text-sm ${product.type === "veg" ? "text-green-400" : "text-red-400"}`}
              >
                {product.type === "veg" ? "Veg" : "Non-Veg"}
              </p>
            </div>
          </div>

          {/* Price + Add to Cart */}
          <div className="bg-[#111] rounded-3xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-white/40 text-xs mb-1">Price</p>
                <p className="text-4xl font-black text-orange-500">
                  ₹{product.price}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-xs mb-1">Delivery</p>
                <p className="text-white font-bold">₹40 flat</p>
              </div>
            </div>

            <AddToCartButton product={product} />
            
          </div>

          {/* Disclaimer */}
          <p className="text-white/20 text-xs mt-6 leading-relaxed">
            * Images are for representation purposes only. Actual product may
            vary slightly. All prices are inclusive of taxes.
          </p>
        </div>
      </div>
    </div>
  );
}
