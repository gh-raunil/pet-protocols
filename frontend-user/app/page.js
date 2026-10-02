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
  ShoppingBag,
  Star,
  Flame,
  ChevronRight,
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
  }, [products]);

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

  const popularDishes = products.slice(0, 8);

  return (
    <main className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors">
      {/* ── SECTION A: HERO (TYPOGRAPHY-LED) ───────────────────────── */}
      <section className="pt-32 pb-16 sm:pt-40 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        {/* Subtle pill tag */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/25 text-[var(--brand-accent)] text-xs font-bold uppercase tracking-wider mb-6 animate-[fadeIn_0.5s_ease]">
          <Sparkles size={14} /> Certified Kitchen Partners
        </div>

        {/* Brand headline */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08] text-[var(--text-main)] mb-6">
          Pet Protocols
          <span className="block text-[var(--brand-accent)] mt-1 sm:mt-2 text-3xl sm:text-5xl md:text-6xl font-extrabold">
            Fresh food. Zero compromises.
          </span>
        </h1>

        {/* Clear mission description */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-[var(--text-muted)] font-normal leading-relaxed mb-10">
          Discover vetted partner kitchens, explore chef-crafted menus, and order freshly prepared meals with seamless multi-restaurant ordering.
        </p>

        {/* Primary and secondary call-to-actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
          <Link
            href="/menu"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-sm shadow-xl shadow-[var(--brand-accent)]/25 transition flex items-center justify-center gap-2 group"
          >
            Explore Food
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/offers"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/40 text-[var(--text-main)] font-semibold text-sm transition flex items-center justify-center gap-2"
          >
            <Tag size={15} className="text-[var(--brand-accent)]" />
            View Offers
          </Link>
        </div>
      </section>

      {/* ── SECTION B: DISCOVER & QUICK SEARCH ───────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto -mt-4 mb-16">
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl shadow-black/5 focus-within:border-[var(--brand-accent)] transition"
        >
          <div className="pl-3 text-[var(--text-muted)]">
            <Search size={20} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by dish name, cuisine, or restaurant..."
            className="flex-1 bg-transparent px-2 py-2 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold hover:opacity-90 transition shrink-0"
          >
            Search
          </button>
        </form>
      </section>

      {/* ── SECTION C: BROWSE CATEGORIES ───────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)]">
              Browse Categories
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
              Select your craving for instant menu filtering
            </p>
          </div>
          <Link
            href="/menu"
            className="text-xs font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1"
          >
            All Dishes <ChevronRight size={14} />
          </Link>
        </div>

        {categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
            {categories.map((cat) => (
              <Link
                key={cat._id || cat.name}
                href={`/menu?category=${encodeURIComponent(cat.name)}`}
                className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/50 hover:-translate-y-1 transition-all group flex flex-col items-center text-center shadow-sm"
              >
                <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                  {cat.icon || "🍽️"}
                </span>
                <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition line-clamp-1">
                  {cat.name}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] mt-1">
                  {cat.dishCount > 0 ? `${cat.dishCount} ${cat.dishCount === 1 ? "dish" : "dishes"}` : "Explore menu"}
                </span>
              </Link>
            ))}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 sm:gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-[var(--bg-card)] animate-pulse border border-[var(--border-color)]" />
            ))}
          </div>
        ) : null}
      </section>

      {/* ── SECTION D: CURATED CAROUSELS (FLIPKART STYLE) ───────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-20 space-y-10">
        {loading ? (
          <div className="space-y-8">
            <div className="h-64 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse" />
            <div className="h-64 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <UtensilsCrossed size={36} className="mx-auto text-[var(--text-muted)] mb-3" />
            <h3 className="text-base font-bold text-[var(--text-main)]">Menu Catalog Updating</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1">
              Fresh dishes from our partnered kitchens are currently being prepared. Check back shortly!
            </p>
          </div>
        ) : (
          <>
            {/* 1. Recommended For You (Personalized - Only if user has interaction/search history) */}
            {userHasHistory && recommendedList.length > 0 && (
              <ProductCarousel
                title="Recommended For You"
                subtitle="Dishes curated based on your searches and dining preferences"
                badge="For You"
                icon={<Sparkles size={20} />}
                products={recommendedList}
                viewAllHref="/menu"
              />
            )}

            {/* 2. Our Best Selling Products */}
            <ProductCarousel
              title="Our Best Selling Products"
              subtitle="Most popular and frequently ordered dishes by foodies"
              badge="Hot Sellers"
              icon={<Flame size={20} />}
              products={bestSellingList}
              viewAllHref="/menu"
            />

            {/* 3. Top Rated Food */}
            <ProductCarousel
              title="Top Rated Food"
              subtitle="Exceptional quality with highest customer reviews and ratings"
              badge="Top Rated"
              icon={<Star size={20} className="fill-orange-500 text-orange-500" />}
              products={topRatedList}
              viewAllHref="/menu"
            />
          </>
        )}
      </section>

      {/* ── SECTION E: PARTNERED RESTAURANTS ───────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
              <Building2 className="text-[var(--brand-accent)] w-5 h-5" />
              Partnered Kitchens & Restaurants
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
              Verified dining kitchens preparing food to the highest hygiene standards
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse"
              />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-14 px-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            <Building2 size={36} className="mx-auto text-[var(--text-muted)] mb-3" />
            <h3 className="text-base font-bold text-[var(--text-main)]">Kitchen Onboarding in Progress</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1">
              We are connecting new verified kitchens in your area.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/50 transition-all flex flex-col justify-between group shadow-sm hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-base font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition flex items-center gap-1.5">
                          {rest.name}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {typeof rest.address === "string" && rest.address
                            ? rest.address
                            : rest.address && typeof rest.address === "object"
                            ? [rest.address.street, rest.address.city].filter(Boolean).join(", ") || rest.city || "Verified Kitchen"
                            : rest.city || "Verified Kitchen"}
                        </p>
                      </div>
                      {opStatus.isOpen ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 whitespace-nowrap">
                          Open Now
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 whitespace-nowrap" title={opStatus.reason}>
                          Closed
                        </span>
                      )}
                    </div>

                    {/* Operational Hours & Delivery Badge Row */}
                    <div className="flex items-center gap-2 flex-wrap mb-3 text-[11px] text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1 bg-[var(--bg-sub)] px-2 py-0.5 rounded-md border border-[var(--border-color)]">
                        <Clock size={11} className="text-[var(--brand-accent)]" />
                        {opStatus.hoursText || rest.openingHours || "10 AM - 11 PM"}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-[var(--bg-sub)] px-2 py-0.5 rounded-md border border-[var(--border-color)]">
                        📍 {radiusKm} km radius
                      </span>
                      {minOrder > 0 && (
                        <span className="inline-flex items-center gap-1 bg-[var(--bg-sub)] px-2 py-0.5 rounded-md border border-[var(--border-color)] text-amber-500">
                          Min ₹{minOrder}
                        </span>
                      )}
                    </div>

                    {rest.description && (
                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed mb-4">
                        {rest.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1 font-medium">
                      Delivery: ₹{flatFee} {freeThreshold > 0 ? `(Free > ₹${freeThreshold})` : ""}
                    </span>
                    <span className="font-bold text-[var(--brand-accent)] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      View Menu <ChevronRight size={14} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── SECTION F: CURRENT OFFERS ───────────────────────────────── */}
      {offers.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
                <Tag className="text-[var(--brand-accent)] w-5 h-5" />
                Active Special Offers
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                Exclusive verified discounts on your favorite dishes
              </p>
            </div>
            <Link
              href="/offers"
              className="text-xs font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1"
            >
              All Deals <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.slice(0, 3).map((offer) => (
              <div
                key={offer._id}
                className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between shadow-sm relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30 uppercase tracking-wider">
                    {offer.discountType === "percentage" ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`}
                  </span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--bg-sub)] text-[var(--text-main)] border border-[var(--border-color)]">
                    {offer.code}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[var(--text-main)] mt-2">
                  {offer.title || "Kitchen Special"}
                </h3>
                {offer.description && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                    {offer.description}
                  </p>
                )}
                <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {offer.minOrderAmount ? `Min order ₹${offer.minOrderAmount}` : "No min order"}
                  </span>
                  <Link
                    href="/menu"
                    className="text-xs font-bold text-[var(--brand-accent)] hover:underline"
                  >
                    Apply on Menu →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SECTION G: WHY ORDER THROUGH PET PROTOCOLS ──────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-main)]">
            Why Order Through Pet Protocols
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1.5 leading-relaxed">
            Built from the ground up for food lovers who value quality, transparency, and speed.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] flex items-center justify-center">
              <Zap size={22} />
            </div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Multi-Kitchen Cart
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Order gourmet pizza from one kitchen and momos from another seamlessly in one single platform.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Verified Hygiene
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Every partnered restaurant adheres to standardized culinary quality protocols and clean prep standards.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center">
              <Clock size={22} />
            </div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Real Order Stages
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Honest status updates directly from kitchen prep stations without misleading fake GPS claims.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-500 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Zero Compromises
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Freshly packed, sealed, and handled with care to ensure the food arrives exactly as the chef intended.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION H: CUSTOMER REVIEWS (GENUINE DATA ONLY) ──────────── */}
      {ratings.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
                <Star className="text-amber-400 fill-amber-400 w-5 h-5" />
                Customer Experiences
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                Authentic feedback from verified diners
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ratings.slice(0, 3).map((rate, i) => (
              <div
                key={rate._id || i}
                className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-3"
              >
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      size={14}
                      className={s < (rate.rating || 5) ? "fill-amber-400" : "text-gray-500"}
                    />
                  ))}
                </div>
                <p className="text-xs text-[var(--text-main)] italic leading-relaxed">
                  &ldquo;{rate.comment || rate.review || "Delicious food and prompt delivery!"}&rdquo;
                </p>
                <div className="pt-2 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)]">
                  {rate.userName || rate.user?.name || "Verified Foodie"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
