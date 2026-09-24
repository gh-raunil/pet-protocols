"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, X, Loader2, Utensils, ArrowRight, ArrowLeft } from "lucide-react";

export default function SearchBar({
  isMobile = false,
  onClose,
  autoFocus = false,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  const router = useRouter();
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  const categories = ["All", "Burgers", "Pizza", "Fries", "Drinks", "Momos"];

  // Lock body scroll and autofocus on mobile mount
  useEffect(() => {
    if (isMobile) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      if (autoFocus) {
        const timer = setTimeout(() => {
          inputRef.current?.focus();
        }, 80);
        return () => {
          clearTimeout(timer);
          document.body.style.overflow = originalOverflow;
        };
      }
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobile, autoFocus]);

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

  // Click outside to close (desktop only)
  useEffect(() => {
    if (isMobile) return;
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  // Keyboard shortcut (Cmd+K or /) & Escape key to close
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isMobile) {
          inputRef.current?.focus();
        } else {
          searchContainerRef.current?.querySelector("input")?.focus();
          setIsOpen(true);
        }
      }
      if (e.key === "Escape") {
        if (isMobile) {
          onClose?.();
        } else {
          setIsOpen(false);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, onClose]);

  function handleFormSubmit(e) {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      const catParam = activeCategory !== "All" ? `&category=${encodeURIComponent(activeCategory)}` : "";
      if (isMobile) {
        onClose?.();
      }
      router.push(`/menu?search=${encodeURIComponent(query.trim())}${catParam}`);
    }
  }

  function handleSelectProduct(productId) {
    setIsOpen(false);
    setQuery("");
    if (isMobile) {
      onClose?.();
    }
    router.push(`/menu/${productId}`);
  }

  // ── MOBILE FULL-SCREEN / OVERLAY SEARCH VIEW ──────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full bg-[#0a0a0c] light:bg-[#ffffff] text-foreground">
        {/* Top Header / Search Input */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10 light:border-stone-200 bg-neutral-950/80 light:bg-stone-50/90 backdrop-blur-md shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-2 rounded-full text-gray-300 light:text-stone-700 hover:text-white light:hover:text-black hover:bg-white/10 light:hover:bg-stone-200 transition focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          <form
            onSubmit={handleFormSubmit}
            role="search"
            className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-full bg-neutral-900/90 light:bg-stone-100 border border-neutral-700 light:border-stone-300 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all text-sm"
          >
            <Search size={16} className="text-orange-500 shrink-0" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              placeholder="Search dishes, burgers, pizza..."
              className="bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground text-sm font-medium"
              aria-label="Search dishes and menu"
            />
            {loading && <Loader2 size={15} className="animate-spin text-orange-500 shrink-0" />}
            {query && !loading && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  inputRef.current?.focus();
                }}
                aria-label="Clear search input"
                className="text-muted-foreground hover:text-foreground transition p-1 rounded-full"
              >
                <X size={15} />
              </button>
            )}
          </form>
        </div>

        {/* Category Filter Chips */}
        <div className="px-3 py-2 border-b border-white/5 light:border-stone-200 bg-[#0f0f12] light:bg-stone-50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-bold text-neutral-400 light:text-stone-500 uppercase tracking-wider pl-1 shrink-0">
            Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-500/30"
                  : "bg-neutral-800/80 light:bg-stone-200 text-neutral-300 light:text-stone-700 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-neutral-800/60 light:divide-stone-200">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
              <Loader2 size={24} className="animate-spin text-orange-500" />
              <span>Searching active kitchen menus...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((product) => (
              <div
                key={product._id}
                onClick={() => handleSelectProduct(product._id)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-900 light:hover:bg-stone-100 transition cursor-pointer active:scale-[0.99]"
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-neutral-800 light:bg-stone-200 overflow-hidden shrink-0 border border-neutral-700/40 light:border-stone-300">
                  <Image
                    src={product.image || "/images/burger.png"}
                    alt={product.name}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${
                        product.foodType === "veg" ? "bg-emerald-500" : "bg-red-500"
                      }`}
                    />
                    <h4 className="text-sm font-bold text-foreground truncate">
                      {product.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground truncate">
                    <span className="text-orange-400 font-extrabold">₹{product.price}</span>
                    <span>•</span>
                    <span className="truncate">{product.restaurant?.name || "Flagship Kitchen"}</span>
                  </div>
                </div>
                <span className="text-muted-foreground text-sm font-bold shrink-0">→</span>
              </div>
            ))
          ) : query.trim() ? (
            <div className="py-12 text-center">
              <Utensils className="mx-auto text-3xl text-muted-foreground/40 mb-2" />
              <p className="text-sm font-bold text-foreground">No dishes found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for "Burger", "Pizza", "Fries", or "Momos"
              </p>
            </div>
          ) : (
            <div className="py-8 px-2 text-center">
              <p className="text-xs text-muted-foreground mb-3 font-medium">
                Popular Searches
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["Burgers", "Pizza", "Fries", "Momos", "Drinks"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setQuery(item);
                      setIsOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-neutral-900 light:bg-stone-200 border border-neutral-800 light:border-stone-300 text-xs font-semibold text-neutral-300 light:text-stone-700 hover:border-orange-500/50 hover:text-orange-400 transition"
                  >
                    🔍 {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Action */}
        {query.trim() && (
          <div className="p-3 bg-neutral-950 light:bg-stone-100 border-t border-white/10 light:border-stone-200 text-center shrink-0">
            <button
              type="button"
              onClick={handleFormSubmit}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-orange-500/20 active:scale-[0.99]"
            >
              <span>View all results in Full Menu</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── DESKTOP INLINE SEARCH VIEW (UNCHANGED) ───────────────────
  return (
    <div ref={searchContainerRef} className="relative w-full">
      {/* ── SEARCH INPUT BOX ────────────────────────────────────── */}
      <form
        onSubmit={handleFormSubmit}
        role="search"
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-neutral-900/60 light:bg-neutral-100 border border-neutral-800 light:border-neutral-300 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all text-sm w-full"
      >
        <Search size={16} className="text-orange-500 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search dishes, burgers, pizza..."
          className="bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground text-xs sm:text-sm font-medium"
          aria-label="Search dishes and menu"
        />
        {loading && <Loader2 size={15} className="animate-spin text-orange-500 shrink-0" />}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            aria-label="Clear search input"
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

