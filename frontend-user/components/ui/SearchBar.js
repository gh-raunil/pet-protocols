"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, X, Loader2, Utensils, ArrowRight, ArrowLeft, Clock, Trash2 } from "lucide-react";

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
  const [recentSearches, setRecentSearches] = useState([]);

  const router = useRouter();
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  const categories = ["All", "Burgers", "Pizza", "Fries", "Drinks", "Momos"];

  // Load recent searches on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pet_protocols_recent_searches");
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  function saveRecentSearch(term) {
    if (!term || !term.trim()) return;
    const clean = term.trim();
    setRecentSearches((prev) => {
      const updated = [clean, ...prev.filter((i) => i.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem("pet_protocols_recent_searches", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }

  function clearRecentSearches() {
    setRecentSearches([]);
    try {
      localStorage.removeItem("pet_protocols_recent_searches");
    } catch (e) {}
  }

  function removeRecentSearch(term, e) {
    e?.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((i) => i !== term);
      try {
        localStorage.setItem("pet_protocols_recent_searches", JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  }

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
    e?.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query.trim());
      setIsOpen(false);
      const catParam = activeCategory !== "All" ? `&category=${encodeURIComponent(activeCategory)}` : "";
      if (isMobile) {
        onClose?.();
      }
      router.push(`/menu?search=${encodeURIComponent(query.trim())}${catParam}`);
    }
  }

  function handleSelectProduct(productId) {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }
    setIsOpen(false);
    setQuery("");
    if (isMobile) {
      onClose?.();
    }
    router.push(`/menu/${productId}`);
  }

  function handleQuickSearch(term) {
    setQuery(term);
    saveRecentSearch(term);
    setIsOpen(true);
  }

  // ── MOBILE FULL-SCREEN / OVERLAY SEARCH VIEW ──────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-full w-full bg-[var(--bg-main)] text-[var(--text-main)] transition-colors">
        {/* Top Header / Search Input */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border-color)] bg-[var(--bg-card)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:outline-none shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          <form
            onSubmit={handleFormSubmit}
            role="search"
            className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--bg-sub)] border border-[var(--border-color)] focus-within:border-[var(--brand-accent)] focus-within:ring-2 focus-within:ring-[var(--brand-accent)]/20 transition-all text-sm"
          >
            <Search size={16} className="text-[var(--brand-accent)] shrink-0" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              placeholder="Search dishes, burgers, pizza..."
              className="bg-transparent outline-none w-full text-[var(--text-main)] placeholder-[var(--text-muted)]/60 text-sm font-medium"
              aria-label="Search dishes and menu"
            />
            {loading && <Loader2 size={15} className="animate-spin text-[var(--brand-accent)] shrink-0" />}
            {query && !loading && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  inputRef.current?.focus();
                }}
                aria-label="Clear search input"
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition p-1 rounded-full"
              >
                <X size={15} />
              </button>
            )}
          </form>
        </div>

        {/* Category Filter Chips */}
        <div className="px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-sub)] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-1 shrink-0">
            Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-[var(--brand-accent)] text-white shadow-sm shadow-[var(--brand-accent)]/30"
                  : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-[var(--border-color)]/60">
          {loading ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-3">
              <Loader2 size={24} className="animate-spin text-[var(--brand-accent)]" />
              <span>Searching active kitchen menus...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((product) => (
              <div
                key={product._id}
                onClick={() => handleSelectProduct(product._id)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-sub)] transition cursor-pointer active:scale-[0.99]"
              >
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-[var(--bg-sub)] overflow-hidden shrink-0 border border-[var(--border-color)]">
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
                    <h4 className="text-sm font-bold text-[var(--text-main)] truncate">
                      {product.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] truncate">
                    <span className="text-[var(--brand-accent)] font-extrabold">₹{product.price}</span>
                    <span>•</span>
                    <span className="truncate">{product.restaurant?.name || "Flagship Kitchen"}</span>
                  </div>
                </div>
                <span className="text-[var(--text-muted)] text-sm font-bold shrink-0">→</span>
              </div>
            ))
          ) : query.trim() ? (
            <div className="py-12 text-center">
              <Utensils className="mx-auto text-3xl text-[var(--text-muted)]/40 mb-2" />
              <p className="text-sm font-bold text-[var(--text-main)]">No dishes found</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Try searching for "Burger", "Pizza", "Fries", or "Momos"
              </p>
            </div>
          ) : (
            <div className="py-6 px-2 space-y-6">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                      <Clock size={12} /> Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--brand-accent)] flex items-center gap-1 transition"
                    >
                      <Trash2 size={11} /> Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <span
                        key={term}
                        onClick={() => handleQuickSearch(term)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-main)] hover:border-[var(--brand-accent)]/50 transition cursor-pointer"
                      >
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(term, e)}
                          aria-label={`Remove ${term}`}
                          className="text-[var(--text-muted)] hover:text-red-400 p-0.5 rounded-full"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Searches */}
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-2.5 px-1 font-bold uppercase tracking-wider">
                  Popular Searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Burgers", "Pizza", "Fries", "Momos", "Drinks"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleQuickSearch(item)}
                      className="px-3.5 py-1.5 rounded-full bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-main)] hover:border-[var(--brand-accent)]/50 hover:text-[var(--brand-accent)] transition"
                    >
                      🔍 {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action */}
        {query.trim() && (
          <div className="p-3 bg-[var(--bg-card)] border-t border-[var(--border-color)] text-center shrink-0">
            <button
              type="button"
              onClick={handleFormSubmit}
              className="w-full py-2.5 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-[var(--brand-accent)]/20 active:scale-[0.99]"
            >
              <span>View all results in Full Menu</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── DESKTOP INLINE SEARCH VIEW ────────────────────────────────
  return (
    <div ref={searchContainerRef} className="relative w-full">
      {/* ── SEARCH INPUT BOX ────────────────────────────────────── */}
      <form
        onSubmit={handleFormSubmit}
        role="search"
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--bg-sub)] border border-[var(--border-color)] focus-within:border-[var(--brand-accent)] focus-within:ring-2 focus-within:ring-[var(--brand-accent)]/20 transition-all text-sm w-full"
      >
        <Search size={16} className="text-[var(--brand-accent)] shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search dishes, burgers, pizza..."
          className="bg-transparent outline-none w-full text-[var(--text-main)] placeholder-[var(--text-muted)]/60 text-xs sm:text-sm font-medium"
          aria-label="Search dishes and menu"
        />
        {loading && <Loader2 size={15} className="animate-spin text-[var(--brand-accent)] shrink-0" />}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            aria-label="Clear search input"
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition p-0.5 rounded-full"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {/* ── LIVE SEARCH DROPDOWN OVERLAY ────────────────────────── */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl w-[320px] sm:w-[420px] max-w-[90vw] -left-10 sm:left-0">
          {/* Category Filter Chips */}
          <div className="px-3 pt-3 pb-2 border-b border-[var(--border-color)]/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-[var(--brand-accent)] text-white shadow-sm shadow-[var(--brand-accent)]/20"
                    : "bg-[var(--bg-sub)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="max-h-72 overflow-y-auto p-2 divide-y divide-[var(--border-color)]/50">
            {loading ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
                <Loader2 size={20} className="animate-spin text-[var(--brand-accent)]" />
                <span>Searching active kitchen menus...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((product) => (
                <div
                  key={product._id}
                  onClick={() => handleSelectProduct(product._id)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--bg-sub)] transition cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--bg-sub)] overflow-hidden shrink-0 border border-[var(--border-color)]">
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
                      <h4 className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate group-hover:text-[var(--brand-accent)] transition">
                        {product.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-muted)] truncate">
                      <span className="text-[var(--brand-accent)] font-black">₹{product.price}</span>
                      <span>•</span>
                      <span className="truncate">{product.restaurant?.name || "Flagship Kitchen"}</span>
                    </div>
                  </div>
                  <span className="text-[var(--text-muted)] group-hover:text-[var(--brand-accent)] transition text-xs font-bold shrink-0">
                    →
                  </span>
                </div>
              ))
            ) : query.trim() ? (
              <div className="p-6 text-center">
                <Utensils className="mx-auto text-2xl text-[var(--text-muted)]/40 mb-1" />
                <p className="text-xs font-bold text-[var(--text-main)]">No dishes found</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Try searching for "Burger", "Pizza", "Fries", or "Momos"
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                        <Clock size={10} /> Recent Searches
                      </span>
                      <button
                        type="button"
                        onClick={clearRecentSearches}
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--brand-accent)] transition"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => handleQuickSearch(term)}
                          className="px-2.5 py-1 rounded-full bg-[var(--bg-sub)] border border-[var(--border-color)] text-[11px] font-medium text-[var(--text-main)] hover:border-[var(--brand-accent)]/50 transition"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 px-0.5">
                    Popular
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Burgers", "Pizza", "Fries", "Momos", "Drinks"].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleQuickSearch(item)}
                        className="px-2.5 py-1 rounded-full bg-[var(--bg-sub)] border border-[var(--border-color)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--brand-accent)]/50 transition"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Action */}
          {query.trim() && (
            <div className="p-2.5 bg-[var(--bg-sub)] border-t border-[var(--border-color)] text-center">
              <button
                type="button"
                onClick={handleFormSubmit}
                className="w-full py-1.5 rounded-lg bg-[var(--brand-accent)]/15 hover:bg-[var(--brand-accent)]/25 text-[var(--brand-accent)] text-xs font-bold flex items-center justify-center gap-1.5 transition"
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
