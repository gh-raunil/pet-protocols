"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Building2,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
  SlidersHorizontal,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import ProductCard from "@/components/products/ProductCard";

export default function MenuClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const categoryFromUrl = searchParams.get("category") || "All";
  const searchFromUrl = searchParams.get("search") || "";
  const restaurantFromUrl = searchParams.get("restaurant") || "all";

  const [products, setProducts] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl);
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurantFromUrl);
  const [selectedType, setSelectedType] = useState("all");
  const [searchTerm, setSearchTerm] = useState(searchFromUrl);
  const [sortBy, setSortBy] = useState("default");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync state with URL params
  useEffect(() => {
    if (categoryFromUrl) setSelectedCategory(categoryFromUrl);
  }, [categoryFromUrl]);

  useEffect(() => {
    if (restaurantFromUrl) setSelectedRestaurant(restaurantFromUrl);
  }, [restaurantFromUrl]);

  useEffect(() => {
    if (searchFromUrl) setSearchTerm(searchFromUrl);
  }, [searchFromUrl]);

  // Load Categories & Restaurants dynamically
  useEffect(() => {
    async function loadMeta() {
      try {
        const [restRes, catRes] = await Promise.allSettled([
          fetch("/api/restaurants").then((r) => r.json()),
          fetch("/api/categories").then((r) => r.json()),
        ]);
        if (restRes.status === "fulfilled" && restRes.value?.success) {
          setRestaurants(restRes.value.restaurants || []);
        }
        if (catRes.status === "fulfilled" && catRes.value?.success) {
          setDynamicCategories(catRes.value.categories || []);
        }
      } catch (err) {
        console.error("Failed to load menu metadata:", err);
      }
    }
    loadMeta();
  }, []);

  // Fetch Products with filters
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.append("category", selectedCategory);
      if (selectedRestaurant !== "all") params.append("restaurant", selectedRestaurant);
      if (selectedType !== "all") params.append("type", selectedType);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      } else {
        setError(data.message || "Failed to load dishes");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the kitchen menu service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedRestaurant, selectedType, searchTerm]);

  // Client-side sorting and stock filter
  const displayedProducts = useMemo(() => {
    let result = [...products];

    if (onlyInStock) {
      result = result.filter((p) => p.isAvailable);
    }

    if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [products, onlyInStock, sortBy]);

  const categories = useMemo(() => {
    const list = [{ id: "All", label: "All Items", icon: "✨" }];
    dynamicCategories.forEach((cat) => {
      list.push({
        id: cat.name,
        label: `${cat.icon || "🍽️"} ${cat.name}`,
        icon: cat.icon || "🍽️",
      });
    });
    return list;
  }, [dynamicCategories]);

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId);
    const newParams = new URLSearchParams(searchParams.toString());
    if (catId === "All") newParams.delete("category");
    else newParams.set("category", catId);
    router.replace(`/menu?${newParams.toString()}`, { scroll: false });
  };

  const handleRestaurantSelect = (restId) => {
    setSelectedRestaurant(restId);
    const newParams = new URLSearchParams(searchParams.toString());
    if (restId === "all") newParams.delete("restaurant");
    else newParams.set("restaurant", restId);
    router.replace(`/menu?${newParams.toString()}`, { scroll: false });
  };

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-[var(--text-main)] transition-colors">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/25 text-[var(--brand-accent)] text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles size={14} /> Multi-Kitchen Menu
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[var(--text-main)]">
          Explore Menu
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
          Discover freshly cooked meals prepared by verified cloud kitchens and neighborhood culinary partners.
        </p>
      </div>

      {/* ── KITCHEN / RESTAURANT FILTER BAR ────────────────────────── */}
      {restaurants.length > 0 && (
        <div className="p-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="text-[var(--brand-accent)] w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Partner Kitchens
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => handleRestaurantSelect("all")}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition ${
                selectedRestaurant === "all"
                  ? "bg-[var(--brand-accent)] text-white shadow-md shadow-[var(--brand-accent)]/25"
                  : "bg-[var(--bg-sub)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]"
              }`}
            >
              All Kitchens ({restaurants.length})
            </button>

            {restaurants.map((rest) => (
              <button
                key={rest._id}
                onClick={() => handleRestaurantSelect(rest._id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  selectedRestaurant === rest._id
                    ? "bg-[var(--brand-accent)] text-white shadow-md shadow-[var(--brand-accent)]/25"
                    : "bg-[var(--bg-sub)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]"
                }`}
              >
                <span>{rest.name}</span>
                {rest.status === "active" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SEARCH & CATEGORIES BAR ─────────────────────────────────── */}
      <div className="space-y-4 mb-8">
        {/* Search Input & Quick Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by dish name, ingredient, or restaurant..."
              className="w-full pl-11 pr-10 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-accent)] transition shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Quick Filters Row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {/* Veg / Non-Veg Toggle */}
            <div className="flex rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] p-1 shrink-0">
              <button
                onClick={() => setSelectedType("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedType === "all"
                    ? "bg-[var(--brand-accent)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedType("veg")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  selectedType === "veg"
                    ? "bg-emerald-600 text-white"
                    : "text-emerald-500 hover:text-emerald-400"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Veg
              </button>
              <button
                onClick={() => setSelectedType("non-veg")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  selectedType === "non-veg"
                    ? "bg-rose-600 text-white"
                    : "text-rose-500 hover:text-rose-400"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Non-Veg
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3.5 py-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] focus:border-[var(--brand-accent)] transition shrink-0 cursor-pointer"
            >
              <option value="default">Sort: Recommended</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Dish Name: A to Z</option>
            </select>

            {/* In-Stock Filter Toggle */}
            <button
              onClick={() => setOnlyInStock(!onlyInStock)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition shrink-0 flex items-center gap-1.5 ${
                onlyInStock
                  ? "bg-[var(--brand-accent)]/15 border-[var(--brand-accent)] text-[var(--brand-accent)]"
                  : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <Check size={13} className={onlyInStock ? "opacity-100" : "opacity-30"} />
              In Stock Only
            </button>
          </div>
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition shadow-sm ${
                  isSelected
                    ? "bg-[var(--brand-accent)] text-white shadow-md shadow-[var(--brand-accent)]/20"
                    : "bg-[var(--bg-card)] text-[var(--text-main)] hover:border-[var(--brand-accent)]/50 border border-[var(--border-color)]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PRODUCTS GRID & STATES ─────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-80 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-10 rounded-3xl bg-red-500/10 border border-red-500/25 text-center max-w-md mx-auto my-12">
          <p className="text-sm font-bold text-red-500 mb-2">{error}</p>
          <button
            onClick={fetchProducts}
            className="px-4 py-2 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold hover:opacity-90 transition inline-flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] my-8">
          <UtensilsCrossed size={40} className="mx-auto text-[var(--text-muted)] mb-3" />
          <h3 className="text-lg font-bold text-[var(--text-main)]">No dishes found</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `No dishes matched "${searchTerm}". Try another search term or reset filters.`
              : "No dishes are currently active under this kitchen or category."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("All");
                setSelectedRestaurant("all");
                setSelectedType("all");
                setOnlyInStock(false);
              }}
              className="px-5 py-2.5 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold hover:opacity-90 transition"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-xs font-semibold text-[var(--text-muted)] mb-4">
            Showing {displayedProducts.length} delicious {displayedProducts.length === 1 ? "dish" : "dishes"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {displayedProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
