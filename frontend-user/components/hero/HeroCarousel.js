"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useTheme } from "@/components/ui/ThemeProvider";
import { useSession } from "next-auth/react";

// ── LIGHT-THEME HERO COLLECTION ─────────────────────────────────────
export const LIGHT_HERO_SLIDES = [
  {
    id: "herolight1_1",
    src: "/images/light_theme_heros/herolight1_1.png",
    alt: "Gourmet brioche cheeseburger with golden french fries in wire basket, iced cola, and cutlery on marble platter",
    title: "Signature Cheeseburger & Fries",
  },
  {
    id: "herolight1_2",
    src: "/images/light_theme_heros/herolight1_2.png",
    alt: "Traditional Indian thali meal with paneer butter masala, dal makhani, fragrant basmati rice, crispy papad, and butter naan",
    title: "Royal Indian Feast & Thali",
  },
  {
    id: "herolight1_3",
    src: "/images/light_theme_heros/herolight1_3.png",
    alt: "Crispy thin-crust artisanal pizza loaded with melted mozzarella, bell peppers, olives, and fresh basil leaves on wooden pizza paddle",
    title: "Artisanal Wood-Fired Pizza",
  },
  {
    id: "herolight1_4",
    src: "/images/light_theme_heros/herolight1_4.png",
    alt: "Freshly baked vegetable pizza with melted cheese, tomato dip, and sparkling iced beverage on marble tray",
    title: "Gourmet Pizza & Chilled Drink",
  },
];

// ── DARK-THEME HERO COLLECTION ──────────────────────────────────────
export const DARK_HERO_SLIDES = [
  {
    id: "darkhero_1",
    src: "/images/dark_theme_heros/darkhero_1.png",
    alt: "Gourmet smash burger with melted cheddar, seasoned golden fries in basket, and iced soda on dark slate plate",
    title: "Signature Dark Burger & Fries",
  },
  {
    id: "darkhero_2",
    src: "/images/dark_theme_heros/darkhero_2.png",
    alt: "Aromatic saffron chicken biryani, dal tadka, rich paneer curry, and butter naan served on dark rustic table",
    title: "Royal Indian Biryani & Curries",
  },
  {
    id: "darkhero_3",
    src: "/images/dark_theme_heros/darkhero_3.png",
    alt: "Fresh hot stone-baked pizza with bell peppers, black olives, and fresh basil on dark round wooden peel",
    title: "Midnight Wood-Fired Pizza",
  },
  {
    id: "darkhero_4",
    src: "/images/dark_theme_heros/darkhero_4.png",
    alt: "Juicy handcrafted beef cheeseburger with bowl of crispy potato fries and iced lemon tea against dark moody backdrop",
    title: "Chef's Craft Burger & Fries",
  },
];

const STORAGE_KEYS = {
  SESSION_SLIDE_LIGHT: "pet_hero_session_slide_light",
  SESSION_SLIDE_DARK: "pet_hero_session_slide_dark",
  LAST_SLIDE_LIGHT: "pet_hero_last_slide_light",
  LAST_SLIDE_DARK: "pet_hero_last_slide_dark",
  SESSION_USER: "pet_hero_session_user",
};

/**
 * Session-consistent slide selection.
 * Defaults to 0 (the reference burger) for new visitors, and rotates smoothly.
 */
function getSessionStartingIndex(collection, themeKey, currentUserId) {
  if (typeof window === "undefined") return 0;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramSlide = urlParams.get("slide");
    if (paramSlide !== null) {
      const parsed = parseInt(paramSlide, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < collection.length) {
        return parsed;
      }
    }

    const sessionKey =
      themeKey === "light"
        ? STORAGE_KEYS.SESSION_SLIDE_LIGHT
        : STORAGE_KEYS.SESSION_SLIDE_DARK;

    if (currentUserId) {
      const prevUser = sessionStorage.getItem(STORAGE_KEYS.SESSION_USER);
      if (prevUser !== currentUserId) {
        sessionStorage.setItem(STORAGE_KEYS.SESSION_USER, currentUserId);
        sessionStorage.removeItem(sessionKey);
      }
    }

    const lastKey =
      themeKey === "light"
        ? STORAGE_KEYS.LAST_SLIDE_LIGHT
        : STORAGE_KEYS.LAST_SLIDE_DARK;

    const existingSessionSlide = sessionStorage.getItem(sessionKey);
    if (existingSessionSlide !== null) {
      const idx = parseInt(existingSessionSlide, 10);
      if (!isNaN(idx) && idx >= 0 && idx < collection.length) {
        return idx;
      }
    }

    // Default to the signature primary burger banner (Index 0) on first visit, or next non-repeating slide
    const lastSeenStr = localStorage.getItem(lastKey);
    const lastSeenIdx = lastSeenStr !== null ? parseInt(lastSeenStr, 10) : -1;
    let candidate = 0;
    if (lastSeenIdx === 0 && collection.length > 1) {
      candidate = Math.floor(Math.random() * collection.length);
    }
    sessionStorage.setItem(sessionKey, String(candidate));
    localStorage.setItem(lastKey, String(candidate));
    return candidate;
  } catch {
    return 0;
  }
}

/**
 * Panoramic Single Theme Carousel.
 * Spans the right side and background of the hero banner with seamless
 * horizontal gradient blending into the text area.
 */
function SingleThemeCarousel({ slides, themeKey, isThemeActive, mode = "panoramic" }) {
  const { data: session } = useSession();
  const userId = session?.user?.id || session?.user?.email || null;

  const [activeIndex, setActiveIndex] = useState(() =>
    getSessionStartingIndex(slides, themeKey, userId)
  );

  const [loadedIndices, setLoadedIndices] = useState(() => {
    return new Set(slides.map((_, i) => i));
  });

  const [isTabVisible, setIsTabVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const clientStartingIdx = getSessionStartingIndex(slides, themeKey, userId);
    setActiveIndex(clientStartingIdx);
    // Preload all slides in this collection for instant crossfade transitions
    setLoadedIndices(new Set(slides.map((_, i) => i)));
  }, [slides, themeKey, userId]);

  useEffect(() => {
    const nextIdx = (activeIndex + 1) % slides.length;
    setLoadedIndices((prev) => {
      if (prev.has(activeIndex) && prev.has(nextIdx)) return prev;
      const updated = new Set(prev);
      updated.add(activeIndex);
      updated.add(nextIdx);
      return updated;
    });
  }, [activeIndex, slides.length]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handleMotionChange = (e) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handleMotionChange);
    return () => mql.removeEventListener("change", handleMotionChange);
  }, []);

  useEffect(() => {
    const handleGoto = (e) => {
      if (typeof e.detail === "number" && e.detail >= 0 && e.detail < slides.length) {
        setActiveIndex(e.detail);
      }
    };
    window.addEventListener("pet_hero_goto_slide", handleGoto);
    return () => window.removeEventListener("pet_hero_goto_slide", handleGoto);
  }, [slides.length]);

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (!isThemeActive || !isTabVisible) return;

    const intervalTimer = setInterval(() => {
      nextSlide();
    }, 9000);

    return () => clearInterval(intervalTimer);
  }, [isThemeActive, isTabVisible, nextSlide]);

  // ── MOBILE SHOWCASE CARD MODE (CLEAR, FRAMED, ZERO FORM-COLLISION) ──
  if (mode === "mobile-card") {
    return (
      <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] max-h-60 rounded-3xl overflow-hidden shadow-lg border border-[var(--border-color)] bg-[var(--bg-card)] select-none">
        {/* Slides Crossfade Container */}
        <div className="absolute inset-0 w-full h-full">
          {slides.map((slide, index) => {
            const isLoaded = loadedIndices.has(index);
            if (!isLoaded) return null;
            const isActive = index === activeIndex;

            return (
              <div
                key={slide.id}
                className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                  isActive ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
                aria-hidden={!isActive}
              >
                <div
                  className={`relative w-full h-full transition-transform duration-700 ease-out ${
                    prefersReducedMotion
                      ? "transform-none"
                      : isActive
                      ? "scale-100"
                      : "scale-[1.02]"
                  }`}
                >
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 768px) 100vw, 500px"
                    className="object-cover object-[78%_center]"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Top-Left Dish Badge */}
        <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold shadow-xs">
          <span className="text-amber-400">✨</span>
          <span>{slides[activeIndex]?.title || "Chef's Special"}</span>
        </div>

        {/* High-Contrast Bottom Vignette Overlay */}
        <div
          className="absolute inset-x-0 bottom-0 h-24 pointer-events-none z-15"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0) 100%)",
          }}
          aria-hidden="true"
        />

        {/* Bottom Information Row & Interactive Pagination Dots */}
        <div className="absolute inset-x-0 bottom-0 p-3.5 z-20 flex items-end justify-between gap-3 text-white pointer-events-auto">
          <div className="min-w-0">
            <p className="text-white text-xs sm:text-sm font-black line-clamp-1 drop-shadow-sm">
              {slides[activeIndex]?.title}
            </p>
            <p className="text-white/80 text-[10px] font-medium drop-shadow-xs">
              Handcrafted with fresh ingredients
            </p>
          </div>

          {/* Interactive Slide Pagination Dots */}
          <div
            className="flex items-center gap-1.5 shrink-0"
            role="tablist"
            aria-label="Hero slide switcher"
          >
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={idx === activeIndex}
                aria-label={`Go to slide ${idx + 1}: ${s.title}`}
                onClick={() => setActiveIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === activeIndex
                    ? "w-5 bg-[var(--brand-accent)] shadow-xs"
                    : "w-1.5 bg-white/60 hover:bg-white"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── DESKTOP PANORAMIC MODE (MATCHING PICTURE 1 EXACT FIDELITY) ─────
  return (
    <div className="hidden md:block absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none">
      {/* ── 1. FOOD IMAGE LAYER (ANCHORED RIGHT) ────────── */}
      <div className="absolute top-0 right-0 bottom-0 w-full md:w-[75%] lg:w-[68%] xl:w-[62%] h-full">
        {slides.map((slide, index) => {
          const isLoaded = loadedIndices.has(index);
          if (!isLoaded) return null;
          const isActive = index === activeIndex;

          return (
            <div
              key={slide.id}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                isActive
                  ? "opacity-100 z-10"
                  : "opacity-0 z-0"
              }`}
              aria-hidden={!isActive}
            >
              <div
                className={`relative w-full h-full transition-transform duration-700 ease-out ${
                  prefersReducedMotion
                    ? "transform-none"
                    : isActive
                    ? "scale-100"
                    : "scale-[1.02]"
                }`}
              >
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 60vw"
                  className="object-cover object-right"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 2. SEAMLESS HORIZONTAL GRADIENT BLEND (LEFT EDGE FADE) ── */}
      {/* Softens and fades only the left edge into the background; middle food area is 100% crisp & unmasked */}
      <div
        className="hidden md:block absolute inset-0 pointer-events-none z-15"
        style={{
          background:
            themeKey === "light"
              ? "linear-gradient(to right, #FAF7F2 0%, #FAF7F2 32%, rgba(250, 247, 242, 0.95) 38%, rgba(250, 247, 242, 0.7) 46%, rgba(250, 247, 242, 0.2) 54%, rgba(250, 247, 242, 0) 60%)"
              : "linear-gradient(to right, #141518 0%, #141518 32%, rgba(20, 21, 24, 0.95) 38%, rgba(20, 21, 24, 0.7) 46%, rgba(20, 21, 24, 0.2) 54%, rgba(20, 21, 24, 0) 60%)",
        }}
        aria-hidden="true"
      />

      {/* ── 3. BOTTOM EDGE BLEND (DEEPER, SOFTER FADE AT BOTTOM BOUNDARY) ── */}
      <div
        className="absolute inset-x-0 bottom-0 h-20 sm:h-28 bg-gradient-to-t pointer-events-none z-15"
        style={{
          background:
            themeKey === "light"
              ? "linear-gradient(to top, #FAF7F2 0%, rgba(250, 247, 242, 0.95) 25%, rgba(250, 247, 242, 0.6) 55%, rgba(250, 247, 242, 0) 100%)"
              : "linear-gradient(to top, #141518 0%, rgba(20, 21, 24, 0.95) 25%, rgba(20, 21, 24, 0.6) 55%, rgba(20, 21, 24, 0) 100%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Theme-aware Hero Carousel Component.
 * Supports desktop panoramic layout and dedicated mobile showcase card mode.
 */
export default function HeroCarousel({ mode = "panoramic" }) {
  const { resolvedTheme } = useTheme();
  const isDarkActive = resolvedTheme === "dark";

  if (mode === "mobile-card") {
    return (
      <div className="block md:hidden w-full">
        {/* Light Theme Collection */}
        <div className="block dark:hidden w-full">
          <SingleThemeCarousel
            slides={LIGHT_HERO_SLIDES}
            themeKey="light"
            isThemeActive={!isDarkActive}
            mode="mobile-card"
          />
        </div>

        {/* Dark Theme Collection */}
        <div className="hidden dark:block w-full">
          <SingleThemeCarousel
            slides={DARK_HERO_SLIDES}
            themeKey="dark"
            isThemeActive={isDarkActive}
            mode="mobile-card"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:block absolute inset-0 w-full h-full pointer-events-none">
      {/* Light Theme Collection (active in light mode, hidden in dark mode) */}
      <div className="block dark:hidden w-full h-full">
        <SingleThemeCarousel
          slides={LIGHT_HERO_SLIDES}
          themeKey="light"
          isThemeActive={!isDarkActive}
          mode="panoramic"
        />
      </div>

      {/* Dark Theme Collection (active in dark mode, hidden in light mode) */}
      <div className="hidden dark:block w-full h-full">
        <SingleThemeCarousel
          slides={DARK_HERO_SLIDES}
          themeKey="dark"
          isThemeActive={isDarkActive}
          mode="panoramic"
        />
      </div>
    </div>
  );
}
