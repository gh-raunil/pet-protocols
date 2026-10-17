"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  Search,
  UtensilsCrossed,
  Tag,
  Clock,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Star,
  ChevronRight,
  Layers,
} from "lucide-react";
import ProductCard from "@/components/products/ProductCard";
import ProductCarousel from "@/components/products/ProductCarousel";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";
import {
  getRecommendedProducts,
  getBestSellingProducts,
  getTopRatedProducts,
  hasUserPreferences,
} from "@/lib/userPreferences";
import { getProductNewArrivalStatus } from "@/lib/offersHelper";

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [offers, setOffers] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setLiveTick] = useState(0);

  // Personalized & curated lists
  const [userHasHistory, setUserHasHistory] = useState(false);
  const [newArrivalsList, setNewArrivalsList] = useState([]);
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

      // Newly Arrived Dishes (Admin window + freshness calculation)
      const freshDishes = products
        .filter((p) => getProductNewArrivalStatus(p, restaurants))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setNewArrivalsList(freshDishes);
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/menu?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors w-full max-w-full overflow-x-hidden min-w-0">
      {/* ── SECTION A: COMPACT DISCOVERY HERO ───────────────────────── */}
      <section className="pt-28 pb-8 sm:pt-36 sm:pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center w-full min-w-0">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] text-xs font-semibold tracking-wide mb-4">
          <Sparkles size={13} /> Multi-Kitchen Dining Platform
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[var(--text-main)] mb-3 leading-[1.12]">
          Fresh food, <span className="text-[var(--brand-accent)]">zero compromises.</span>
        </h1>

        <p className="max-w-xl mx-auto text-xs sm:text-sm md:text-base text-[var(--text-muted)] font-normal leading-relaxed mb-8 px-2">
          Discover vetted partner kitchens, explore chef-crafted menus, and order freshly prepared meals with seamless multi-restaurant ordering.
        </p>

        {/* Integrated Clean Search Box */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 p-1.5 sm:p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm focus-within:border-[var(--brand-accent)] focus-within:ring-2 focus-within:ring-[var(--brand-accent)]/20 transition max-w-xl mx-auto"
        >
          <div className="pl-3 text-[var(--text-muted)] shrink-0">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dishes, cuisines, or partner kitchens..."
            className="flex-1 bg-transparent px-2 py-2 text-xs sm:text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none min-w-0"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[var(--brand-accent)] hover:bg-[var(--brand-accent-hover)] text-white text-xs font-bold transition shrink-0 cursor-pointer shadow-xs active:scale-97"
          >
            Search
          </button>
        </form>

        {/* Quick Cravings Pill Bar */}
        {categories.length > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap mt-4 text-xs">
            <span className="text-[11px] text-[var(--text-muted)] font-medium">Quick explore:</span>
            {categories.slice(0, 6).map((cat) => (
              <Link
                key={cat._id || cat.name}
                href={`/menu?category=${encodeURIComponent(cat.name)}`}
                className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] text-[11px] font-medium transition shadow-2xs"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── SECTION B: BROWSE FOOD CATEGORIES ───────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[var(--text-main)] tracking-tight">
              Explore Categories
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Select your craving for instant menu filtering
            </p>
          </div>
          <Link
            href="/menu"
            className="text-xs font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 shrink-0"
          >
            All Dishes <ChevronRight size={14} />
          </Link>
        </div>

        {categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((cat) => (
              <Link
                key={cat._id || cat.name}
                href={`/menu?category=${encodeURIComponent(cat.name)}`}
                className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/50 hover:-translate-y-0.5 transition-all group flex flex-col items-center text-center shadow-2xs"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 mb-2.5 rounded-xl overflow-hidden bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-center relative">
                  {cat.image ? (
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <span className="text-2xl group-hover:scale-110 transition-transform">
                      {cat.icon || "🍽️"}
                    </span>
                  )}
                </div>
                <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition line-clamp-1">
                  {cat.name}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {cat.dishCount > 0 ? `${cat.dishCount} ${cat.dishCount === 1 ? "dish" : "dishes"}` : "Explore"}
                </span>
              </Link>
            ))}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-[var(--bg-card)] animate-pulse border border-[var(--border-color)]" />
            ))}
          </div>
        ) : null}
      </section>

      {/* ── SECTION C: SPECIAL OFFERS STRIP ─────────────────────────── */}
      {offers.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-16">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[var(--text-main)] tracking-tight flex items-center gap-2">
                <Tag className="text-[var(--brand-accent)] w-4 h-4" />
                Active Special Offers
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Verified discounts and kitchen promotions
              </p>
            </div>
            <Link
              href="/offers"
              className="text-xs font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 shrink-0"
            >
              All Offers <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.slice(0, 3).map((offer) => (
              <div
                key={offer._id}
                className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between shadow-2xs hover:border-[var(--brand-accent)]/40 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] uppercase tracking-wider">
                      {offer.discountType === "percentage" ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`}
                    </span>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--bg-sub)] text-[var(--text-main)] border border-[var(--border-color)]">
                      {offer.code}
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-[var(--text-main)] mt-1">
                    {offer.title || "Kitchen Special"}
                  </h3>
                  {offer.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                      {offer.description}
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border-color)] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {offer.minOrderAmount ? `Min order ₹${offer.minOrderAmount}` : "No minimum"}
                  </span>
                  <Link
                    href={`/menu?coupon=${encodeURIComponent(offer.code || "")}`}
                    className="font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-0.5"
                  >
                    Apply <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SECTION D: CURATED FOOD DISCOVERY CAROUSELS ─────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-16 space-y-8">
        {loading ? (
          <div className="space-y-6">
            <div className="h-60 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse" />
            <div className="h-60 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <UtensilsCrossed size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Menu Catalog Updating</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1">
              Fresh dishes from our partnered kitchens are currently being prepared. Check back shortly!
            </p>
          </div>
        ) : (
          <>
            {/* Newly Arrived Dishes (Admin window calculation; rendered only if dishes qualify) */}
            {newArrivalsList.length > 0 && (
              <ProductCarousel
                title="Newly Arrived Dishes"
                subtitle="Fresh culinary additions recently prepared by our partner kitchens"
                badge="New"
                icon={<Sparkles size={18} className="text-amber-500 fill-amber-500/20" />}
                products={newArrivalsList}
                offers={offers}
                viewAllHref="/menu"
              />
            )}

            {/* Recommended For You (Personalized - Only if user has interaction/search history) */}
            {userHasHistory && recommendedList.length > 0 && (
              <ProductCarousel
                title="Recommended For You"
                subtitle="Dishes curated based on your dining preferences"
                badge="For You"
                icon={<Sparkles size={18} />}
                products={recommendedList}
                offers={offers}
                viewAllHref="/menu"
              />
            )}

            {/* Best Selling Dishes */}
            <ProductCarousel
              title="Popular & Best Selling"
              subtitle="Frequently ordered favorites across all kitchens"
              badge="Popular"
              icon={<Star size={18} className="text-[var(--brand-accent)]" />}
              products={bestSellingList}
              offers={offers}
              viewAllHref="/menu"
            />

            {/* Top Rated Food */}
            <ProductCarousel
              title="Top Rated Dishes"
              subtitle="Highest customer ratings and reviews"
              badge="Top Rated"
              icon={<Star size={18} className="fill-amber-400 text-amber-400" />}
              products={topRatedList}
              offers={offers}
              viewAllHref="/menu"
            />
          </>
        )}
      </section>

      {/* ── SECTION E: PARTNERED RESTAURANTS ───────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[var(--text-main)] tracking-tight flex items-center gap-2">
              <Building2 className="text-[var(--brand-accent)] w-4 h-4" />
              Partnered Kitchens & Cloud Restaurants
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Verified dining kitchens preparing food to high hygiene standards
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse"
              />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <Building2 size={32} className="mx-auto text-[var(--text-muted)] mb-2" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">Kitchen Onboarding in Progress</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1">
              We are connecting new verified kitchens in your area.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {restaurants.map((rest) => {
              const opStatus = getRestaurantOperationalStatus(rest);
              const flatFee = rest.chargeSettings?.flatDeliveryFee ?? 40;
              const freeThreshold = rest.chargeSettings?.freeDeliveryThreshold ?? 500;
              const radiusKm = rest.deliverySettings?.deliveryRadiusKm ?? 10;
              const minOrder = rest.orderLimits?.minOrderAmount ?? 0;

              return (
                <Link
                  key={rest._id}
                  href={`/menu?restaurant=${rest._id}`}
                  className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/50 transition-all flex flex-col justify-between group shadow-2xs hover:shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition flex items-center gap-1.5">
                          {rest.name}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">
                          {typeof rest.address === "string" && rest.address
                            ? rest.address
                            : rest.address && typeof rest.address === "object"
                            ? [rest.address.street, rest.address.city].filter(Boolean).join(", ") || rest.city || "Verified Kitchen"
                            : rest.city || "Verified Kitchen"}
                        </p>
                      </div>
                      {opStatus.isOpen ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                          Open Now
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap" title={opStatus.reason}>
                          Closed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-2.5 text-[11px] text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1 bg-[var(--bg-sub)] px-2 py-0.5 rounded-md border border-[var(--border-color)]">
                        <Clock size={11} className="text-[var(--brand-accent)]" />
                        {opStatus.hoursText || rest.openingHours || "10 AM - 11 PM"}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-[var(--bg-sub)] px-2 py-0.5 rounded-md border border-[var(--border-color)]">
                        📍 {radiusKm} km radius
                      </span>
                      {minOrder > 0 && (
                        <span className="inline-flex items-center gap-1 bg-[var(--bg-sub)] px-2 py-0.5 rounded-md border border-[var(--border-color)] text-amber-600 dark:text-amber-400">
                          Min ₹{minOrder}
                        </span>
                      )}
                    </div>

                    {rest.description && (
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed mb-3">
                        {rest.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
                    <span className="font-medium">
                      Delivery: ₹{flatFee} {freeThreshold > 0 ? `(Free > ₹${freeThreshold})` : ""}
                    </span>
                    <span className="font-bold text-[var(--brand-accent)] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      Menu <ChevronRight size={13} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── SECTION F: QUALITY STANDARDS ───────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-16">
        <div className="text-center max-w-xl mx-auto mb-8">
          <h2 className="text-lg sm:text-2xl font-black text-[var(--text-main)] tracking-tight">
            Built for Transparent Dining
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Zero fake delivery promises. Just great food prepared with care.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center">
              <Layers size={20} />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Multi-Kitchen Cart
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Order gourmet pizza from one kitchen and momos from another seamlessly in one single platform.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Verified Hygiene
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Every partnered restaurant adheres to standardized culinary quality protocols and clean prep standards.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Honest Order Stages
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Transparent live status directly from kitchen prep stations without misleading fake GPS graphics.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION G: CUSTOMER EXPERIENCES (GENUINE DATA ONLY) ──────── */}
      {ratings.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[var(--text-main)] tracking-tight flex items-center gap-2">
                <Star className="text-amber-400 fill-amber-400 w-4 h-4" />
                Diner Feedback
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Authentic feedback from verified diners
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ratings.slice(0, 3).map((rate, i) => (
              <div
                key={rate._id || i}
                className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs space-y-2.5"
              >
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      size={13}
                      className={s < (rate.rating || 5) ? "fill-amber-400" : "text-gray-300 dark:text-gray-600"}
                    />
                  ))}
                </div>
                <p className="text-xs text-[var(--text-main)] italic leading-relaxed">
                  &ldquo;{rate.comment || rate.review || "Delicious food and prompt delivery!"}&rdquo;
                </p>
                <div className="pt-2 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)]">
                  {rate.userName || rate.user?.name || "Verified Diner"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
