"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import ProductCard from "./ProductCard";

export default function ProductCarousel({
  title,
  subtitle,
  badge,
  products = [],
  viewAllHref,
  icon,
}) {
  const containerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [products]);

  const scroll = (direction) => {
    if (!containerRef.current) return;
    const scrollAmount = containerRef.current.clientWidth * 0.75;
    containerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="relative my-8 sm:my-10">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2.5">
          {badge && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20">
              {badge}
            </span>
          )}
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-[var(--text-main)] flex items-center gap-2 tracking-tight">
              {icon && <span className="text-[var(--brand-accent)]">{icon}</span>}
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View All Link */}
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-accent)] hover:underline mr-1"
            >
              View All <ArrowRight size={13} />
            </Link>
          )}

          {/* Desktop Arrow Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                canScrollLeft
                  ? "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--brand-accent)] hover:border-[var(--brand-accent)] hover:text-white shadow-xs"
                  : "bg-[var(--bg-sub)] border-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed opacity-40"
              }`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                canScrollRight
                  ? "bg-[var(--text-main)] text-[var(--bg-main)] border-[var(--text-main)] hover:bg-[var(--brand-accent)] hover:border-[var(--brand-accent)] hover:text-white shadow-xs"
                  : "bg-[var(--bg-sub)] border-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed opacity-40"
              }`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Carousel Track with Floating Circular Arrows */}
      <div className="relative group/carousel">
        {/* Left Floating Arrow (appears when scrollable) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Previous dishes"
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-[var(--bg-card)]/95 text-[var(--text-main)] shadow-lg border border-[var(--border-color)] flex items-center justify-center hover:scale-110 hover:bg-[var(--brand-accent)] hover:text-white transition duration-200 cursor-pointer hidden md:flex"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {/* Right Floating Arrow (appears when scrollable) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Next dishes"
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-[var(--bg-card)]/95 text-[var(--text-main)] shadow-lg border border-[var(--border-color)] flex items-center justify-center hover:scale-110 hover:bg-[var(--brand-accent)] hover:text-white transition duration-200 cursor-pointer hidden md:flex"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={containerRef}
          className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              isCarousel={true}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
