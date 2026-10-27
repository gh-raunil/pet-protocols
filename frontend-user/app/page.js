"use client";

import React, { useEffect, useState } from "react";
import HeroCard from "@/components/hero/HeroCard";
import CategoryShortcuts from "@/components/categories/CategoryShortcuts";
import PopularDishesSection from "@/components/products/PopularDishesSection";
import SpecialOffersCard from "@/components/offers/SpecialOffersCard";
import TopRestaurantsCard from "@/components/restaurants/TopRestaurantsCard";
import AppInstallCard from "@/components/banners/AppInstallCard";
import LocationBar from "@/components/layout/LocationBar";
import SearchBar from "@/components/ui/SearchBar";
import { useLocationStore } from "@/lib/locationStore";

export default function CustomerHomePage() {
  const [products, setProducts] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [offers, setOffers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const locationDetails = useLocationStore((s) => s.locationDetails);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const restQuery =
          locationDetails?.latitude && locationDetails?.longitude
            ? `?lat=${locationDetails.latitude}&lng=${locationDetails.longitude}`
            : "";

        const [prodRes, restRes, offRes, catRes] = await Promise.allSettled([
          fetch("/api/products").then((r) => r.json()),
          fetch(`/api/restaurants${restQuery}`).then((r) => r.json()),
          fetch("/api/offers").then((r) => r.json()),
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
        if (catRes.status === "fulfilled" && catRes.value?.success) {
          setCategories(catRes.value.categories || []);
        }
      } catch (err) {
        console.warn("Home data fetch issue:", err);
        setError("Unable to load live menu right now. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [locationDetails?.latitude, locationDetails?.longitude]);

  return (
    <main className="bg-[var(--bg-main)] text-[var(--text-main)] min-h-screen transition-colors w-full max-w-full overflow-x-hidden pt-16 sm:pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-5 sm:space-y-6">
        
        {/* ── MOBILE-ONLY HEADER EXTENSION (< md: Location row + Search bar) ── */}
        <div className="md:hidden space-y-2 pt-1 pb-0.5">
          <LocationBar />
          <div className="w-full">
            <SearchBar
              variant="mobile-inline"
              placeholder="Search for dishes, cuisines, restaurants..."
            />
          </div>
        </div>

        {/* ── RESPONSIVE COMPOSITION (Desktop: Two-Column Split matching reference image; Mobile: Clean Stack) ── */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-6 xl:gap-8 items-start space-y-6 lg:space-y-0">
          
          {/* ════════ LEFT / MAIN COLUMN (Desktop: 8 cols, Mobile: Full) ════════ */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-6 sm:space-y-7 min-w-0">
            {/* 1. Main Hero Section */}
            <HeroCard />

            {/* 2. Explore Food Categories */}
            <CategoryShortcuts categories={categories} />

            {/* 3. Popular Dishes Grid */}
            <PopularDishesSection
              products={products}
              loading={loading}
            />
          </div>

          {/* ════════ RIGHT / SIDEBAR COLUMN (Desktop: 4 cols, Mobile: Lower Stack) ════════ */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-5 sm:space-y-6 min-w-0">
            {/* 1. Ongoing Offers Carousel (Single visible offer at a time or clean empty state) */}
            <SpecialOffersCard offers={offers} />

            {/* 2. Top Partner Restaurants Discovery */}
            <div id="restaurants">
              <TopRestaurantsCard
                restaurants={restaurants}
                loading={loading}
              />
            </div>

            {/* 3. Dismissible App Installation Card */}
            <AppInstallCard />
          </div>

        </div>

      </div>
    </main>
  );
}
