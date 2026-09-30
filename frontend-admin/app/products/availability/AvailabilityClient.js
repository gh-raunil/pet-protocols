"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Filter,
} from "lucide-react";

export default function AvailabilityClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // "all", "available", "sold_out"
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/products/availability");
    }
  }, [status, router]);

  async function loadProducts(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const res = await fetch("/api/restaurant/products");
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error("Load products error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function toggleAvailability(product) {
    try {
      setUpdatingId(product._id);
      const newAvailability = !product.isAvailable;
      const res = await fetch(`/api/restaurant/products/${product._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: newAvailability }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts((prev) =>
          prev.map((p) => (p._id === product._id ? { ...p, isAvailable: newAvailability } : p))
        );
      } else {
        alert(data.message || "Failed to update dish availability");
      }
    } catch (err) {
      console.error("Update availability error:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterStatus === "available" && !p.isAvailable) return false;
      if (filterStatus === "sold_out" && p.isAvailable) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    });
  }, [products, filterStatus, searchQuery]);

  const availableCount = products.filter((p) => p.isAvailable).length;
  const soldOutCount = products.filter((p) => !p.isAvailable).length;

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors">
      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/products"
                className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
              >
                <ArrowLeft size={13} />
                <span>Back to Menu</span>
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight">
              Menu Availability
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
              Choose which dishes customers can order right now.
            </p>
          </div>

          <button
            onClick={() => loadProducts(false)}
            disabled={refreshing || loading}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-white/10 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span>Sync Dishes</span>
          </button>
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-3 shadow-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs sm:text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: `All (${products.length})` },
              { id: "available", label: `Available (${availableCount})` },
              { id: "sold_out", label: `Sold Out (${soldOutCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  filterStatus === tab.id
                    ? "bg-orange-500 text-white shadow-xs"
                    : "bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dishes List */}
        {loading ? (
          <div className="py-20 text-center text-stone-500 text-sm">
            <RefreshCw className="w-7 h-7 text-orange-500 animate-spin mx-auto mb-2" />
            <span>Loading menu dishes...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-12 text-center text-stone-500 text-xs">
            No dishes found matching your search.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredProducts.map((product) => {
              const isUpdating = updatingId === product._id;
              const isAvailable = product.isAvailable;

              return (
                <div
                  key={product._id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 shadow-xs flex items-center justify-between gap-3 hover:border-stone-300 dark:hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 shrink-0">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          <UtensilsCrossed size={16} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-stone-900 dark:text-white truncate">
                          {product.name}
                        </h3>
                        {product.type && (
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded shrink-0 ${
                              product.type === "veg"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-600 border border-red-500/20"
                            }`}
                          >
                            {product.type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        <span>{product.category || "Main"}</span>
                        <span>•</span>
                        <span className="font-bold text-stone-700 dark:text-stone-300">
                          ₹{(product.price || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        isAvailable
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? "bg-emerald-500" : "bg-rose-500"}`} />
                      <span>{isAvailable ? "Available" : "Sold Out"}</span>
                    </span>

                    <button
                      onClick={() => toggleAvailability(product)}
                      disabled={isUpdating}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50 ${
                        isAvailable
                          ? "bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border border-rose-500/20"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      }`}
                    >
                      {isAvailable ? "Mark Sold Out" : "Make Available"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
