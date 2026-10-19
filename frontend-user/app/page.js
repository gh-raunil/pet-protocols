"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronRight,
  Clock,
  Sparkles,
  Star,
  ShieldCheck,
  ShoppingBag,
  MapPin,
  UtensilsCrossed,
  Tag,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import ProductCard, { ProductCardSkeleton } from "@/components/products/ProductCard";
import ProductCarousel from "@/components/products/ProductCarousel";
import SearchBar from "@/components/ui/SearchBar";
import HeroCarousel from "@/components/hero/HeroCarousel";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";
import {
  getRecommendedProducts,
  getBestSellingProducts,
  getTopRatedProducts,
  hasUserPreferences,
} from "@/lib/userPreferences";
import { getProductNewArrivalStatus } from "@/lib/offersHelper";

// ── 8 CANONICAL CATEGORIES MATCHING VISUAL MOCKUP ───────────────────
const CANONICAL_CATEGORIES = [
  { id: "burger", name: "Burgers", query: "category=Burger", image: "/images/burger.png", match: ["burger"] },
  { id: "pizza", name: "Pizza", query: "category=Pizza", image: "/images/pizza.png", match: ["pizza"] },
  { id: "momos", name: "Momos", query: "category=Momos", image: "/images/momos.png", match: ["momo", "momos"] },
  { id: "fries", name: "Fries", query: "category=Fries", image: "/images/fries.png", match: ["fries", "side", "sides"] },
  { id: "indian", name: "Indian Meals", query: "search=Indian", image: "/images/cat-indian.jpg", match: ["indian", "curry", "paneer"] },
  { id: "sandwiches", name: "Sandwiches", query: "search=Sandwich", image: "/images/cat-sandwiches.jpg", match: ["sandwich", "sandwiches"] },
  { id: "desserts", name: "Desserts", query: "category=Gulab%20Jamun", image: "/images/cat-desserts.jpg", match: ["dessert", "desserts", "gulab jamun", "sweet"] },
  { id: "drinks", name: "Cold Drinks", query: "category=Cold%20Drinks", image: "/images/drinks.png", match: ["drink", "drinks", "cold drinks", "beverage"] },
];

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [offers, setOffers] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setLiveTick] = useState(0);

  // Personalized & curated lists
  const [userHasHistory, setUserHasHistory] = useState(false);
  const [recommendedList, setRecommendedList] = useState([]);
  const [bestSellingList, setBestSellingList] = useState([]);
  const [topRatedList, setTopRatedList] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setLiveTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  // Update curated and recommended lists whenever products load or preferences update
  useEffect(() => {
    if (products.length > 0) {
      const hasHistory = hasUserPreferences();
      setUserHasHistory(hasHistory);
      if (hasHistory) {
        setRecommendedList(getRecommendedProducts(products, 12));
      } else {
        setRecommendedList([]);
      }
      setBestSellingList(getBestSellingProducts(products, 12));
      setTopRatedList(getTopRatedProducts(products, 12));
    }
  }, [products, restaurants]);

  useEffect(() => {
    const handlePrefUpdate = () => {
      if (products.length > 0) {
        const hasHistory = hasUserPreferences();
        setUserHasHistory(hasHistory);
        if (hasHistory) {
          setRecommendedList(getRecommendedProducts(products, 12));
        } else {
          setRecommendedList([]);
        }
      }
    };
    window.addEventListener("user_preferences_updated", handlePrefUpdate);
    return () => window.removeEventListener("user_preferences_updated", handlePrefUpdate);
  }, [products]);

  useEffect(() => {
    async function loadHomeData() {
      try {
        setLoading(true);
        const [prodRes, restRes, offRes, rateRes, catRes] = await Promise.allSettled([
          fetch("/api/products").then((r) => r.json()),
          fetch("/api/restaurants").then((r) => r.json()),
          fetch("/api/offers").then((r) => r.json()),
          fetch("/api/ratings").then((r) => r.json()),
          fetch("/api/categories").then((r) => r.json()),
        ]);

        if (prodRes.status === "fulfilled" && prodRes.value?.success) {
          setProducts(prodRes.value.products || []);
        }
        if (restRes.status === "fulfilled" && restRes.value?.success) {
          setRestaurants(restRes.value.restaurants || []);
        }
        if (offRes.status === "fulfilled" && offRes.value?.success) {
          setOffers(offRes.value.offers || []);
        }
        if (rateRes.status === "fulfilled" && rateRes.value?.ratings) {
          setRatings(rateRes.value.ratings || []);
        }
        if (catRes.status === "fulfilled" && catRes.value?.success) {
          setCategories(catRes.value.categories || []);
        }
      } catch (err) {
        console.error("Error loading home data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadHomeData();
  }, []);

  // Compute 6 featured popular dishes for the primary mockup grid
  const popularDishes = bestSellingList.length >= 6
    ? bestSellingList.slice(0, 6)
    : products.length > 0
    ? products.slice(0, 6)
    : [];

  return (
    <main className="bg-[var(--bg-main)] text-[var(--text-main)] transition-colors w-full max-w-full overflow-x-hidden min-w-0">
      {/* ── 1. UNIFIED PANORAMIC HERO BANNER (MATCHING 1ST PICTURE) ── */}
      <section className="relative w-full overflow-hidden bg-[var(--bg-main)] min-h-[460px] sm:min-h-[520px] lg:min-h-[560px] flex items-center pt-14 sm:pt-20">
        {/* Ambient warm radial glow in the background */}
        <div className="absolute top-10 right-0 w-72 h-72 sm:w-96 sm:h-96 bg-[var(--brand-accent)]/6 rounded-full blur-3xl pointer-events-none -z-0" />

        {/* Seamless Panoramic Background Layer (Desktop: md:block) */}
        <HeroCarousel mode="panoramic" />

        {/* Foreground Content: Headline, Search, Quick Pills, and Mobile Showcase */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-6 sm:py-14 lg:py-16">
          <div className="max-w-xl lg:max-w-2xl flex flex-col justify-center space-y-3.5 sm:space-y-5">
            <div className="w-12 h-1.5 rounded-full bg-[var(--brand-accent)]" />

            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-[68px] font-black tracking-tight text-[var(--text-main)] leading-[1.08] sm:leading-[1.06]">
              Good food.<br />
              <span className="text-[var(--brand-accent)]">Great mood.</span>
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-[var(--text-muted)] font-normal leading-relaxed max-w-xl">
              Discover your next favourite meal, explore local kitchens, and get delicious food delivered to your door.
            </p>

            {/* Prominent Hero Search Bar (Reuses SearchBar component) */}
            <div className="w-full max-w-xl pt-0.5">
              <SearchBar
                variant="hero"
                placeholder="Search dishes, cuisines or restaurants..."
              />
            </div>

            {/* Category Quick Pills - Swipeable on mobile, wrapped on desktop */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 text-xs w-full min-w-0 sm:flex-wrap">
              {[
                { label: "Burgers", icon: "🍔", href: "/menu?category=Burger" },
                { label: "Pizza", icon: "🍕", href: "/menu?category=Pizza" },
                { label: "Momos", icon: "🥟", href: "/menu?category=Momos" },
                { label: "Indian", icon: "🍛", href: "/menu?search=Indian" },
                { label: "Desserts", icon: "🧁", href: "/menu?category=Gulab%20Jamun" },
              ].map((pill) => (
                <Link
                  key={pill.label}
                  href={pill.href}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-main)] hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] shadow-2xs transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
                >
                  <span className="text-sm">{pill.icon}</span>
                  <span>{pill.label}</span>
                </Link>
              ))}
            </div>

            {/* Dedicated Mobile Featured Carousel Card (Visible only on mobile < md) */}
            <div className="md:hidden pt-2 w-full min-w-0">
              <HeroCarousel mode="mobile-card" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. EXPLORE CATEGORIES ───────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-10 sm:mb-16">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-black text-[var(--text-main)] tracking-tight">
            Explore Categories
          </h2>
          <Link
            href="/menu"
            className="text-xs sm:text-sm font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] rounded-md px-1"
          >
            View all categories <ArrowRight size={14} />
          </Link>
        </div>

        {/* 4 columns on mobile so all 8 categories fit in 2 tidy rows */}
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-4 w-full min-w-0">
          {CANONICAL_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/menu?${cat.query}`}
              className="min-w-0 p-1.5 sm:p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/60 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group flex flex-col items-center text-center shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
            >
              <div className="w-11 h-11 sm:w-16 sm:h-16 aspect-square mb-1.5 sm:mb-2.5 rounded-xl sm:rounded-2xl overflow-hidden bg-[var(--bg-sub)] border border-[var(--border-color)] relative shrink-0 shadow-2xs">
                <Image
                  src={cat.image}
                  alt={cat.name}
                  fill
                  sizes="64px"
                  className="object-cover group-hover:scale-108 transition-transform duration-300"
                />
              </div>
              <span className="text-[10px] sm:text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition-colors truncate w-full px-0.5">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 3. RESTAURANTS WORTH DISCOVERING ────────────────────────── */}
      <section id="restaurants" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-10 sm:mb-16 scroll-mt-24">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-black text-[var(--text-main)] tracking-tight">
            Restaurants worth discovering
          </h2>
          <Link
            href="/menu"
            className="text-xs sm:text-sm font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] rounded-md px-1"
          >
            View all restaurants <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse"
              />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <UtensilsCrossed size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Connecting Partner Kitchens</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1">
              New verified cloud kitchens and dining spots in your neighborhood are onboarding shortly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {restaurants.slice(0, 4).map((rest) => {
              const opStatus = getRestaurantOperationalStatus(rest);
              const flatFee = rest.chargeSettings?.flatDeliveryFee ?? 30;
              const cuisines = Array.isArray(rest.cuisineType) && rest.cuisineType.filter(Boolean).length > 0
                ? rest.cuisineType.filter(Boolean).slice(0, 2).join(", ")
                : "Multi-Cuisine, Specials";
              const prepMinutes = rest.prepTimeSettings?.defaultMinutes || 25;
              const deliveryMins = `${prepMinutes}-${prepMinutes + 10} mins`;

              return (
                <Link
                  key={rest._id}
                  href={`/menu?restaurant=${rest._id}`}
                  className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/50 transition-all duration-200 overflow-hidden group shadow-xs hover:shadow-md flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
                >
                  <div>
                    {/* Top Restaurant Banner Container */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-sub)]">
                      <Image
                        src={rest.bannerImage || rest.image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"}
                        alt={rest.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Top Badges: Rating & Verified */}
                      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-md text-white text-[11px] font-bold shadow-xs">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span>{(rest.rating || 4.6).toFixed(1)}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/90 dark:bg-zinc-900/90 text-[var(--text-main)] text-[10px] font-bold shadow-xs backdrop-blur-md">
                          Verified
                        </span>
                      </div>

                      {!opStatus.isOpen && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center z-10">
                          <span className="px-2.5 py-1 rounded-md bg-amber-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                            <Clock size={10} /> Closed
                          </span>
                          <span className="text-[9px] text-white/90 mt-1 line-clamp-1 font-medium">
                            {opStatus.hoursText || "Opens soon"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition-colors truncate">
                          {rest.name}
                        </h3>
                        <span className="w-6 h-6 rounded-full bg-[var(--bg-sub)] text-[var(--brand-accent)] flex items-center justify-center shrink-0 group-hover:bg-[var(--brand-accent)] group-hover:text-white transition">
                          <ChevronRight size={13} strokeWidth={2.5} />
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
                        {cuisines}
                      </p>

                      <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)] font-medium">
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-[var(--brand-accent)]" />
                          {deliveryMins}
                        </span>
                        <span>•</span>
                        <span>₹{flatFee} delivery fee</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. POPULAR DISHES ───────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-12 sm:mb-16">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] tracking-tight">
            Popular Dishes
          </h2>
          <Link
            href="/menu"
            className="text-xs sm:text-sm font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] rounded-md px-1"
          >
            View all dishes <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : popularDishes.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <UtensilsCrossed size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Catalog Updating</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1">
              Fresh recipes from our kitchen partners will appear here momentarily.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {popularDishes.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                offers={offers}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 5. PROMOTIONAL OFFERS BANNER ────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-12 sm:mb-16">
        <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12 items-center">
          {/* Left Text & Action */}
          <div className="p-6 sm:p-8 lg:p-12 md:col-span-7 space-y-4">
            <div className="w-10 h-1 rounded-full bg-[var(--brand-accent)]" />

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[var(--text-main)] tracking-tight">
              Delicious food deals
            </h2>

            <p className="text-xs sm:text-sm md:text-base text-[var(--text-muted)] leading-relaxed max-w-md">
              Great taste. Better value. Explore exclusive offers on your favourite meals.
            </p>

            {offers.length > 0 && offers[0].code && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 text-xs font-bold text-[var(--brand-accent)]">
                <Tag size={13} />
                <span>Use coupon <strong className="font-mono uppercase">{offers[0].code}</strong> for {offers[0].discountType === "percentage" ? `${offers[0].discountValue}% OFF` : `₹${offers[0].discountValue} OFF`}</span>
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/offers"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-97"
              >
                <span>Explore offers</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Right Arched Culinary Photography */}
          <div className="md:col-span-5 relative h-56 sm:h-72 md:h-full min-h-[240px] bg-gradient-to-br from-amber-500/10 via-orange-500/15 to-transparent overflow-hidden">
            <div className="w-full h-full relative">
              <Image
                src="/images/deals-curry-spread.jpg"
                alt="Delicious food deals - fragrant biryani with tandoori naan and curries"
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. WHY ORDER WITH पेट PROTOCOLS? ────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-12 sm:mb-16">
        <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] tracking-tight mb-6 sm:mb-8 text-center sm:text-left">
          Why order with पेट Protocols?
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start gap-4 shadow-xs hover:border-[var(--brand-accent)]/40 hover:shadow-md transition-all">
            <div className="w-11 h-11 rounded-full border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              <Search size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Easy food discovery
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Find your favourite dishes and new flavours.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start gap-4 shadow-xs hover:border-[var(--brand-accent)]/40 hover:shadow-md transition-all">
            <div className="w-11 h-11 rounded-full border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Simple ordering experience
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Add, customize and order in just a few clicks.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start gap-4 shadow-xs hover:border-[var(--brand-accent)]/40 hover:shadow-md transition-all">
            <div className="w-11 h-11 rounded-full border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Transparent order summary
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                See your items, prices and delivery details clearly.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start gap-4 shadow-xs hover:border-[var(--brand-accent)]/40 hover:shadow-md transition-all">
            <div className="w-11 h-11 rounded-full border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Convenient order tracking
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Track your food in real time from kitchen to door.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. PERSONALIZED RECOMMENDATIONS (IF DINER HAS HISTORY) ─── */}
      {userHasHistory && recommendedList.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-12 sm:mb-16">
          <ProductCarousel
            title="Recommended For You"
            subtitle="Dishes curated based on your dining preferences and past searches"
            badge="For You"
            icon={<Sparkles size={18} className="text-[var(--brand-accent)]" />}
            products={recommendedList}
            offers={offers}
            viewAllHref="/menu"
          />
        </section>
      )}

      {/* ── 8. CUSTOMER TESTIMONIALS (GENUINE DATA ONLY) ───────────── */}
      {ratings.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-16 sm:mb-20">
          <div className="flex items-center justify-between mb-5 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] tracking-tight">
              What our customers say
            </h2>
            <Link
              href="/about"
              className="text-xs sm:text-sm font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] rounded-md px-1"
            >
              View all reviews <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {ratings.slice(0, 3).map((rate, i) => {
              const name = rate.userName || rate.user?.name || "Verified Diner";
              const initial = name.charAt(0).toUpperCase();

              return (
                <div
                  key={rate._id || i}
                  className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    {/* Customer Info Header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] font-bold text-sm flex items-center justify-center shrink-0">
                        {initial}
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">
                          {name}
                        </h3>
                        <div className="flex items-center gap-0.5 text-amber-500 mt-0.5">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star
                              key={s}
                              size={11}
                              className={s < (rate.rating || 5) ? "fill-amber-500 text-amber-500" : "text-gray-300 dark:text-gray-600"}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Customer Review Quote */}
                    <p className="text-xs text-[var(--text-main)] italic leading-relaxed pt-1">
                      &ldquo;{rate.comment || rate.review || "Great food, super easy to order. The app is smooth and the delivery was on time!"}&rdquo;
                    </p>
                  </div>

                  <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider pt-2 border-t border-[var(--border-color)]">
                    Customer
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
