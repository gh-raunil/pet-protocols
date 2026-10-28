"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  PackageCheck,
  Clock3,
  Store,
} from "lucide-react";
import { useTheme } from "@/components/ui/ThemeProvider";

export const LIGHT_SLIDES = [
  {
    id: "light_1",
    src: "/images/light_hero.png",
    alt: "Artisan cheeseburger with crispy golden fries and refreshing beverage",
    dishName: "Signature Smash Burger Platter",
  },
  {
    id: "light_2",
    src: "/images/light_theme_heros/herolight1_3.png",
    alt: "Wood-fired artisanal pizza with melted fior di latte mozzarella and fresh basil",
    dishName: "Fire-Roasted Margherita Pizza",
  },
  {
    id: "light_3",
    src: "/images/light_theme_heros/herolight1_2.png",
    alt: "Royal Indian feast with paneer butter masala, dal makhani, and butter naan",
    dishName: "Royal Gourmet Feast & Curries",
  },
];

export const DARK_SLIDES = [
  {
    id: "dark_1",
    src: "/images/dark_hero.png",
    alt: "Signature dark smash burger with melted cheddar, golden fries, and dip",
    dishName: "Chef's Craft Dark Burger & Fries",
  },
  {
    id: "dark_2",
    src: "/images/dark_theme_heros/darkhero_3.png",
    alt: "Midnight wood-fired pizza with olives and herbs",
    dishName: "Midnight Wood-Fired Pizza",
  },
  {
    id: "dark_3",
    src: "/images/dark_theme_heros/darkhero_2.png",
    alt: "Royal Indian feast with paneer butter masala and biryani",
    dishName: "Royal Indian Biryani & Feast",
  },
];

export default function HeroCard() {
  const { resolvedTheme, mounted } = useTheme();
  const [isDark, setIsDark] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      const hasDarkClass = document.documentElement.classList.contains("dark");
      setIsDark(resolvedTheme === "dark" || hasDarkClass);
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [resolvedTheme, mounted]);

  const slides = isDark ? DARK_SLIDES : LIGHT_SLIDES;

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide]);

  const currentSlide = slides[activeIndex] || slides[0];

  return (
    <section
      aria-label="Hero Showcase"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full rounded-3xl overflow-hidden bg-[#FBF7F0] dark:bg-[#131D26] border border-amber-100/70 dark:border-[#202E3B] shadow-xs transition-colors select-none group"
    >
      {/* ── DESKTOP HERO LAYOUT (md+) ── */}
      <div className="hidden md:flex items-center justify-between p-6 sm:p-8 lg:p-10 min-h-[360px] lg:min-h-[400px] relative z-10 overflow-hidden">
        {/* Full-bleed photography showcase */}
        <div className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                idx === activeIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={idx === 0}
                loading={idx === 0 ? "eager" : "lazy"}
                sizes="(max-width: 1280px) 100vw, 1200px"
                className="object-cover object-right w-full h-full transition-transform duration-700 scale-[1.02]"
              />
              {/* Seamless full-bleed gradient mask for pristine text contrast */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-[#FBF7F0] via-[#FBF7F0]/80 via-45% to-transparent dark:from-[#131D26] dark:via-[#131D26]/80 dark:via-45% dark:to-transparent pointer-events-none" />
            </div>
          ))}
        </div>

        {/* Left Copy & CTA */}
        <div className="max-w-md lg:max-w-lg space-y-4 lg:space-y-5 relative z-20">
          {/* Eyebrow badge matching reference */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-[11px] font-black uppercase tracking-wider bg-[var(--brand-accent)]/10 shadow-2xs">
            <span>GOOD FOOD</span>
            <span className="w-1 h-1 rounded-full bg-[var(--brand-accent)]" />
            <span>GREAT MOOD</span>
          </div>

          {/* Bold Headline matching reference */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[var(--text-main)] tracking-tight leading-[1.08]">
            Fresh food.<br />
            <span className="text-[var(--brand-accent)]">Zero compromises.</span>
          </h1>

          {/* Supporting Subtitle */}
          <p className="text-xs sm:text-sm text-[var(--text-muted)] font-normal leading-relaxed max-w-sm">
            Order from your favorite restaurants and get it delivered hot to your doorstep.
          </p>

          {/* CTA Button */}
          <div className="pt-1">
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs sm:text-sm font-extrabold shadow-md shadow-[var(--brand-accent)]/25 transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
            >
              <span>Explore Menu</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* Accurate, factual platform indicators */}
          <div className="pt-2 grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)] font-medium">
            <div className="flex items-center gap-1.5">
              <UtensilsCrossed size={14} className="text-[var(--brand-accent)] shrink-0" />
              <span>Freshly Prepared Meals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <PackageCheck size={14} className="text-[var(--brand-accent)] shrink-0" />
              <span>Hygienic Packaging</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock3 size={14} className="text-[var(--brand-accent)] shrink-0" />
              <span>Live Order Tracking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Store size={14} className="text-[var(--brand-accent)] shrink-0" />
              <span>Curated Partner Kitchens</span>
            </div>
          </div>
        </div>

        {/* Carousel Chevrons (< and >) */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Previous hero slide"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-[var(--bg-card)]/80 hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] flex items-center justify-center shadow-md backdrop-blur-xs transition active:scale-90"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={nextSlide}
          aria-label="Next hero slide"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 border-2 border-[var(--brand-accent)] text-white flex items-center justify-center shadow-md backdrop-blur-xs transition active:scale-90"
        >
          <ChevronRight size={16} />
        </button>

        {/* Bottom Pagination Dots */}
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5"
          role="tablist"
          aria-label="Hero carousel pagination"
        >
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={idx === activeIndex}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setActiveIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === activeIndex
                  ? "w-6 bg-[var(--brand-accent)]"
                  : "w-1.5 bg-[var(--border-color)] hover:bg-[var(--text-muted)]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── MOBILE HERO LAYOUT (< md) ── */}
      <div className="md:hidden relative overflow-hidden rounded-3xl min-h-[195px] flex flex-col justify-between p-4 sm:p-5">
        {/* Seamless full-height background dish photography on the right */}
        <div className="absolute right-0 top-0 bottom-0 w-[58%] sm:w-[50%] pointer-events-none overflow-hidden">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                idx === activeIndex ? "opacity-100 z-0" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={idx === 0}
                sizes="(max-width: 768px) 60vw, 320px"
                className="object-cover object-center w-full h-full"
              />
            </div>
          ))}
          {/* Subtle directional gradient blends for text contrast and edge softening */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-card)]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)]/90 via-transparent to-transparent" />
        </div>

        {/* Content on the left */}
        <div className="relative z-10 max-w-[64%] space-y-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-[10px] font-bold bg-[var(--brand-accent)]/10">
            <span>GOOD FOOD</span>
            <span>&bull;</span>
            <span>GREAT MOOD</span>
          </div>
          <h1 className="text-xl font-black text-[var(--text-main)] tracking-tight leading-tight">
            Fresh food.<br />
            <span className="text-[var(--brand-accent)]">Zero compromises.</span>
          </h1>
          <p className="text-[11px] text-[var(--text-muted)] leading-tight">
            Order from favorite restaurants, delivered hot.
          </p>
          <div className="pt-1">
            <Link
              href="/menu"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold shadow-xs active:scale-95 transition"
            >
              <span>Explore Menu</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Mobile Trust Bar */}
        <div className="relative z-10 pt-2.5 mt-2 border-t border-[var(--border-color)]/60 flex items-center justify-between text-[10px] text-[var(--text-muted)] font-medium">
          <span className="flex items-center gap-1">
            <UtensilsCrossed size={11} className="text-[var(--brand-accent)]" /> Fresh Food
          </span>
          <span className="flex items-center gap-1">
            <PackageCheck size={11} className="text-[var(--brand-accent)]" /> Hygienic Pack
          </span>
          <span className="flex items-center gap-1">
            <Clock3 size={11} className="text-[var(--brand-accent)]" /> Live Tracking
          </span>
        </div>
      </div>
    </section>
  );
}
