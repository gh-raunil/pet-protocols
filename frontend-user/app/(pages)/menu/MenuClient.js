"use client";

import ProductCard from "@/components/products/ProductCard";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Search, Filter, RefreshCw, Sparkles } from "lucide-react";

function MenuContent() {
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get("category") || "All";
  const searchFromUrl = searchParams.get("search") || "";
  const restaurantFromUrl = searchParams.get("restaurant") || "all";

  const [products, setProducts] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurantFromUrl);
  const [selectedType, setSelectedType] = useState("all");
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);
  const [loading, setLoading] = useState(true);

  // Sync with URL params
  useEffect(() => {
    if (categoryFromUrl) setSelectedCategory(categoryFromUrl);
  }, [categoryFromUrl]);

  useEffect(() => {
    if (restaurantFromUrl) setSelectedRestaurant(restaurantFromUrl);
  }, [restaurantFromUrl]);

  useEffect(() => {
    if (searchFromUrl) setSearchTerm(searchFromUrl);
  }, [searchFromUrl]);

  // Fetch Restaurants list
  useEffect(() => {
    async function loadRestaurants() {
      try {
        const res = await fetch("/api/restaurants");
        const data = await res.json();
        if (data.success) {
          setRestaurants(data.restaurants || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadRestaurants();
  }, []);

  // Fetch Products with filters
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCategory !== "All") params.append("category", selectedCategory);
        if (selectedRestaurant !== "all") params.append("restaurant", selectedRestaurant);
        if (selectedType !== "all") params.append("type", selectedType);
        if (searchTerm) params.append("search", searchTerm);

        const res = await fetch(`/api/products?${params.toString()}`);
        const data = await res.json();
        setProducts(data.products || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [selectedCategory, selectedRestaurant, selectedType, searchTerm]);

  const categories = ["All", "Burger", "Pizza", "Fries", "Momos", "Cold Drinks"];

  return (
    <main className="min-h-screen pt-32 pb-24 px-6 max-w-7xl mx-auto text-white">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest mb-3">
          <Sparkles size={14} /> Multi-Kitchen Food Catalog
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white">
          Explore Our <span className="text-orange-500">Menu</span>
        </h1>
        <p className="text-gray-400 mt-2 text-base max-w-xl mx-auto">
          Order fresh gourmet burgers, stone-baked pizzas, and crispy snacks from top kitchens.
        </p>
      </div>

      {/* ── RESTAURANT SELECTION BAR ───────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 mb-8 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="text-orange-400 w-4 h-4" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Select Kitchen / Restaurant
          </span>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedRestaurant("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
              selectedRestaurant === "all"
                ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                : "bg-[#141414] text-gray-300 hover:text-white border-white/10 hover:border-orange-500/40"
            }`}
          >
            🍽️ All Kitchens ({restaurants.reduce((acc, r) => acc + (r.productCount || 0), 0)} dishes)
          </button>

          {restaurants.map((rest) => (
            <button
              key={rest._id}
              onClick={() => setSelectedRestaurant(rest._id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                selectedRestaurant === rest._id
                  ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                  : "bg-[#141414] text-gray-300 hover:text-white border-white/10 hover:border-orange-500/40"
              }`}
            >
              <span>{rest.name}</span>
              <span className="text-[10px] font-mono opacity-70 bg-white/10 px-1.5 py-0.5 rounded">
                ★ {rest.rating || "4.8"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ────────────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-4 mb-10 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search burgers, pizzas, drinks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#141414] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-orange-500 outline-none"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                selectedCategory === category
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-[#141414] text-gray-400 hover:text-white border-white/5"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Veg / Non-Veg Toggle */}
        <div className="flex items-center bg-[#141414] border border-white/10 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setSelectedType("all")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              selectedType === "all" ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedType("veg")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              selectedType === "veg" ? "bg-green-500/20 text-green-400" : "text-gray-400 hover:text-green-400"
            }`}
          >
            ● Veg
          </button>
          <button
            onClick={() => setSelectedType("non-veg")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              selectedType === "non-veg" ? "bg-red-500/20 text-red-400" : "text-gray-400 hover:text-red-400"
            }`}
          >
            ● Non-Veg
          </button>
        </div>
      </div>

      {/* ── PRODUCTS CATALOG ────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-[#0d0d0d] rounded-3xl overflow-hidden border border-white/10 animate-pulse"
            >
              <div className="h-56 bg-white/5" />
              <div className="p-5 space-y-3">
                <div className="h-3 bg-white/10 rounded-full w-1/3" />
                <div className="h-5 bg-white/10 rounded-full w-3/4" />
                <div className="h-3 bg-white/5 rounded-full w-full" />
                <div className="h-10 bg-white/10 rounded-2xl mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-[#0d0d0d] border border-white/10 rounded-3xl text-center p-8">
          <p className="text-5xl mb-3">🍽️</p>
          <h2 className="text-2xl font-bold text-white">No dishes found</h2>
          <p className="text-gray-400 text-sm max-w-sm mt-1">
            {searchTerm
              ? `We couldn't find anything matching "${searchTerm}". Try another search.`
              : "No dishes matching the selected filters are currently active."}
          </p>
          <button
            onClick={() => {
              setSelectedCategory("All");
              setSelectedRestaurant("all");
              setSelectedType("all");
              setSearchTerm("");
            }}
            className="mt-6 bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}

export default function MenuClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-orange-500">
          <RefreshCw className="animate-spin w-8 h-8" />
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
