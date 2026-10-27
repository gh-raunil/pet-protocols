"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function PromotionalBanner() {
  return (
    <section aria-label="Promotional banner" className="w-full">
      <div className="w-full rounded-3xl overflow-hidden bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md relative group">
        {/* Ambient lighting */}
        <div className="absolute top-0 right-1/3 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        {/* Left Copy & Action */}
        <div className="flex-1 min-w-0 space-y-2 relative z-10 text-center md:text-left">
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
            Your Next Favorite Meal
          </h3>
          <p className="text-xs sm:text-sm text-white/90 leading-relaxed max-w-md">
            Discover new flavors, special deals and more.
          </p>
          <div className="pt-2">
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-white text-white hover:bg-white hover:text-[var(--brand-accent)] font-bold text-xs sm:text-sm transition-all duration-200 active:scale-95 shadow-xs"
            >
              <span>Explore Restaurants</span>
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Right Food Photo Mosaic */}
        <div className="relative w-full md:w-64 lg:w-80 h-36 sm:h-44 rounded-2xl overflow-hidden shadow-lg border border-white/20 shrink-0">
          <Image
            src="/images/deals-curry-spread.jpg"
            alt="Delicious assortment of gourmet curries, naan, and biryani"
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      </div>
    </section>
  );
}
