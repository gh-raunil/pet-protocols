import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import useCartStore from "@/lib/cartStore";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

// ── Popular Products ────────────────────────────────────────────
function PopularSection() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();

        if (data.success) {
          setProducts(data.products.slice(0, 5));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  return (
    <section className="px-8 md:px-14 py-12 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold border-l-4 border-orange-500 pl-3">
          Popular This Week
        </h2>
        <Link
          href="/menu"
          className="text-orange-500 text-sm font-medium hover:text-orange-400 transition"
        >
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/5 rounded-2xl overflow-hidden animate-pulse"
            >
              <div className="aspect-square bg-white/10" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {products.map((p) => (
            <div
              key={p._id}
              className="bg-[#111] rounded-2xl overflow-hidden border border-white/5 hover:border-orange-500/40 transition group"
            >
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={p.image || FALLBACK_IMAGE}
                  alt={p.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 20vw"
                  className="object-cover group-hover:scale-105 transition duration-500"
                />
                {p.isFeatured && (
                  <span className="absolute top-2 left-2 bg-orange-500 text-[10px] font-bold px-2 py-1 rounded-md">
                    Bestseller
                  </span>
                )}
                <span
                  className={`absolute top-2 right-2 w-3.5 h-3.5 rounded-sm border-2 ${p.type === "veg" ? "border-green-500" : "border-red-500"} bg-black flex items-center justify-center`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${p.type === "veg" ? "bg-green-500" : "bg-red-500"}`}
                  />
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-orange-500">₹{p.price}</span>
                  <button
                    onClick={() => addItem({ ...p, _id: p._id.toString() })}
                    disabled={!p.isAvailable}
                    className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition flex items-center justify-center text-white font-bold text-lg leading-none"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default PopularSection;
