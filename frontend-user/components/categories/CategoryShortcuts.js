"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

/**
 * Returns a high-res project fallback illustration for categories
 */
function getCategoryFallbackAsset(catName, catSlug) {
  const name = (catName || "").toLowerCase();
  const slug = (catSlug || "").toLowerCase();

  if (name.includes("burger") || slug.includes("burger")) {
    return "/images/category_icons/burger.png";
  }
  if (name.includes("pizza") || slug.includes("pizza")) {
    return "/images/category_icons/pizza.png";
  }
  if (name.includes("fry") || name.includes("fries") || slug.includes("fries") || name.includes("snack")) {
    return "/images/category_icons/fries.png";
  }
  if (name.includes("drink") || name.includes("beverage") || slug.includes("cold-drink") || name.includes("soda")) {
    return "/images/category_icons/drinks.png";
  }
  if (name.includes("momo") || name.includes("dumpling") || slug.includes("momo")) {
    return "/images/category_icons/momos.png";
  }
  if (name.includes("kalakand") || name.includes("sweet") || name.includes("dessert") || name.includes("jamun")) {
    return "/images/cat-desserts.jpg";
  }
  if (name.includes("salad") || slug.includes("salad")) {
    return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300";
  }
  if (name.includes("soup") || slug.includes("soup")) {
    return "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300";
  }
  return null;
}

export default function CategoryShortcuts({ categories: propCategories = [] }) {
  const [dbCategories, setDbCategories] = useState(propCategories || []);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setDbCategories(propCategories);
      return;
    }

    async function fetchLiveCategories() {
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        if (data?.success && Array.isArray(data.categories) && data.categories.length > 0) {
          setDbCategories(data.categories);
        }
      } catch (err) {
        console.warn("Could not fetch categories:", err);
      }
    }
    fetchLiveCategories();
  }, [propCategories]);

  // Deduplicate and filter categories from DB
  const displayCategories = dbCategories
    .filter((cat) => cat && cat.name)
    .filter(
      (cat, idx, arr) =>
        arr.findIndex((c) => c.name.toLowerCase() === cat.name.toLowerCase()) === idx
    );

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [displayCategories]);

  const scrollByAmount = (amount) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: "smooth" });
      setTimeout(checkScroll, 350);
    }
  };

  return (
    <section aria-label="Explore Food Categories" className="w-full space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-main)] tracking-tight">
          Explore Categories
        </h2>
        <Link
          href="/menu"
          className="text-xs sm:text-sm font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 group"
        >
          <span>View all</span>
          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Categories Scroller Container with optional navigation controls */}
      <div className="relative group/scroller">
        {/* Left Scroll Chevron Button (Desktop) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-240)}
            aria-label="Scroll categories left"
            className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] items-center justify-center shadow-md hover:bg-[var(--bg-sub)] transition active:scale-90"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Right Scroll Chevron Button (Desktop) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(240)}
            aria-label="Scroll categories right"
            className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] items-center justify-center shadow-md hover:bg-[var(--bg-sub)] transition active:scale-90"
          >
            <ChevronRight size={16} />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-none scroll-smooth py-2 px-1"
        >
          {/* ── "ALL" CATEGORY AVATAR ── */}
          <Link
            href="/menu"
            className="flex flex-col items-center shrink-0 group focus-visible:outline-none transition-transform active:scale-95 min-w-[64px] sm:min-w-[72px]"
          >
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center bg-[#FAF3EA] dark:bg-[#1E2B38] border-2 border-[var(--brand-accent)] group-hover:shadow-md transition-all duration-200">
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center">
                <LayoutGrid size={20} />
              </div>
            </div>
            <span className="mt-2 text-xs sm:text-[13px] font-bold text-[var(--text-main)] tracking-tight text-center whitespace-nowrap">
              All
            </span>
          </Link>

          {/* ── LIVE DATABASE CATEGORIES ── */}
          {displayCategories.map((cat) => {
            const fallbackAsset = getCategoryFallbackAsset(cat.name, cat.slug);
            const imageSrc = cat.image || cat.sampleImage || fallbackAsset;

            return (
              <Link
                key={cat._id || cat.slug || cat.name}
                href={`/menu?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center shrink-0 group focus-visible:outline-none transition-transform active:scale-95 min-w-[64px] sm:min-w-[72px]"
              >
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden bg-[#FAF3EA] dark:bg-[#1E2B38] border border-stone-200/80 dark:border-[#2A3B4D] group-hover:border-[var(--brand-accent)] group-hover:shadow-md transition-all duration-200 relative flex items-center justify-center">
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={cat.name}
                      fill
                      sizes="80px"
                      className="object-cover object-center group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <span className="text-2xl sm:text-3xl">{cat.icon || "🍽️"}</span>
                  )}
                </div>
                <span className="mt-2 text-xs sm:text-[13px] font-medium text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:font-bold tracking-tight text-center whitespace-nowrap transition-colors">
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
