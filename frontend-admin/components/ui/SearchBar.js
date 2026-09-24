"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, X, Loader2, Utensils, Store, ArrowRight } from "lucide-react";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  const router = useRouter();
  const searchContainerRef = useRef(null);

  const categories = ["All", "Burgers", "Pizza", "Fries", "Drinks", "Momos"];

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const categoryParam = activeCategory !== "All" ? `&category=${encodeURIComponent(activeCategory)}` : "";
        const res = await fetch(`/api/products?search=${encodeURIComponent(query.trim())}${categoryParam}`);
        const data = await res.json();
        if (data.success) {
          setResults(data.products || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, activeCategory]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd+K or /)
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchContainerRef.current?.querySelector("input")?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleFormSubmit(e) {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      const catParam = activeCategory !== "All" ? `&category=${encodeURIComponent(activeCategory)}` : "";
      router.push(`/menu?search=${encodeURIComponent(query.trim())}${catParam}`);
    }
  }

  function handleSelectProduct(productId) {
    setIsOpen(false);
    setQuery("");
    router.push(`/menu/${productId}`);
  }

  return (
    <div ref={searchContainerRef} className="relative w-full">
      {/* ── SEARCH INPUT BOX ────────────────────────────────────── */}
      <form
        onSubmit={handleFormSubmit}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-neutral-900/60 light:bg-neutral-100 border border-neutral-800 light:border-neutral-300 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all text-sm w-full"
      >
        <Search size={16} className="text-orange-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search dishes, burgers, pizza..."
          className="bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground text-xs sm:text-sm font-medium"
        />
        {loading && <Loader2 size={15} className="animate-spin text-orange-500 shrink-0" />}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="text-muted-foreground hover:text-foreground transition p-0.5 rounded-full"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {/* ── LIVE SEARCH DROPDOWN OVERLAY ────────────────────────── */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#121216] light:bg-[#ffffff] border border-neutral-800 light:border-neutral-200 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl w-[320px] sm:w-[420px] max-w-[90vw] -left-10 sm:left-0">
          {/* Category Filter Chips */}
          <div className="px-3 pt-3 pb-2 border-b border-neutral-800/80 light:border-neutral-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-orange-500 text-white"
                    : "bg-neutral-800/60 light:bg-neutral-100 text-neutral-400 light:text-neutral-600 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="max-h-72 overflow-y-auto p-2 divide-y divide-neutral-800/50 light:divide-neutral-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 size={20} className="animate-spin text-orange-500" />
                <span>Searching active kitchen menus...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((product) => (
                <div
                  key={product._id}
                  onClick={() => handleSelectProduct(product._id)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-800/50 light:hover:bg-neutral-100/80 transition cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-xl bg-neutral-800 light:bg-neutral-200 overflow-hidden shrink-0 border border-neutral-700/40 light:border-neutral-200">
                    <Image
                      src={product.image || "/images/burger.png"}
                      alt={product.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${product.foodType === 'veg' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <h4 className="text-xs sm:text-sm font-bold text-foreground truncate group-hover:text-orange-500 transition">
                        {product.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground truncate">
                      <span className="text-orange-400 font-black">₹{product.price}</span>
                      <span>•</span>
                      <span className="truncate">{product.restaurant?.name || "Flagship Kitchen"}</span>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-orange-500 transition text-xs font-bold shrink-0">
                    →
                  </span>
                </div>
              ))
            ) : query.trim() ? (
              <div className="p-6 text-center">
                <Utensils className="mx-auto text-2xl text-muted-foreground/40 mb-1" />
                <p className="text-xs font-bold text-foreground">No dishes found</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Try searching for "Burger", "Pizza", "Fries", or "Momos"
                </p>
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-[11px] text-muted-foreground">
                  Type any dish name, cuisine, or ingredient to search live menus.
                </p>
              </div>
            )}
          </div>

          {/* Footer Action */}
          {query.trim() && (
            <div className="p-2.5 bg-neutral-950/80 light:bg-neutral-50 border-t border-neutral-800 light:border-neutral-200 text-center">
              <button
                type="button"
                onClick={handleFormSubmit}
                className="w-full py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-500 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <span>View all results in Full Menu</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
