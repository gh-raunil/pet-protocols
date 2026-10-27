"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Tag,
  Percent,
  Sparkles,
} from "lucide-react";
import { toast } from "@/components/ui/ToastProvider";

export default function SpecialOffersCard({ offers = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Filter genuinely active and valid offers based on dates and active status
  const now = new Date();
  const validOffers = (offers || []).filter((offer) => {
    if (!offer || !offer.isActive) return false;
    if (offer.startDate && new Date(offer.startDate) > now) return false;
    if (offer.endDate && new Date(offer.endDate) <= now) return false;
    return true;
  });

  const nextOffer = useCallback(() => {
    if (validOffers.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % validOffers.length);
  }, [validOffers.length]);

  const prevOffer = useCallback(() => {
    if (validOffers.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + validOffers.length) % validOffers.length);
  }, [validOffers.length]);

  useEffect(() => {
    if (isPaused || validOffers.length <= 1) return;
    const interval = setInterval(nextOffer, 5500);
    return () => clearInterval(interval);
  }, [isPaused, validOffers.length, nextOffer]);

  const handleCopyCode = (code) => {
    if (!code) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Coupon code ${code} copied to clipboard!`);
      setTimeout(() => setCopiedCode(null), 3000);
    }
  };

  const currentOffer = validOffers[activeIndex] || validOffers[0];

  return (
    <div
      aria-label="Ongoing Offers"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="w-full rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-5 shadow-xs transition-colors space-y-3.5 relative"
    >
      {/* Header matching reference image */}
      <div className="flex items-center justify-between pb-1">
        <h3 className="text-base font-extrabold text-[var(--text-main)] tracking-tight flex items-center gap-2">
          <span>Ongoing Offers</span>
          {validOffers.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30">
              {validOffers.length} Active
            </span>
          )}
        </h3>
        <Link
          href="/offers"
          className="text-xs font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 group"
        >
          <span>View all offers</span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* ── CLEAN EMPTY STATE (when no valid offers exist in live DB) ── */}
      {validOffers.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-sub)]/60 border border-[var(--border-color)] p-5 text-center space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center mx-auto shadow-2xs">
            <Percent size={20} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">
              No Active Coupons Right Now
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-xs mx-auto leading-relaxed">
              Restaurant partners release seasonal promo codes regularly. Check the live menu for direct item discounts!
            </p>
          </div>
          <div className="pt-1">
            <Link
              href="/menu"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--brand-accent)]/10 hover:bg-[var(--brand-accent)] text-[var(--brand-accent)] hover:text-white text-xs font-bold transition active:scale-95"
            >
              <span>Explore Dishes</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      ) : (
        /* ── EXACTLY ONE ACTIVE OFFER AT A TIME ── */
        <div className="relative">
          <div className="rounded-2xl bg-gradient-to-br from-[#FFF8EE] to-[#FFF1DE] dark:from-[#182330] dark:to-[#121A24] border border-orange-200/60 dark:border-orange-900/30 p-4 sm:p-5 relative overflow-hidden transition-all duration-300">
            {/* Ambient warm glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-3 relative z-10">
              {/* Left Offer Details */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Restaurant Badge (identifies specific restaurant or platform) */}
                <div className="inline-block">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/80 dark:bg-black/40 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20 shadow-2xs backdrop-blur-xs">
                    {currentOffer.restaurant?.name || "Platform-Wide Special"}
                  </span>
                </div>

                {/* Offer Discount Headline */}
                <div>
                  <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white tracking-tight leading-tight">
                    {currentOffer.discountType === "percentage"
                      ? `${currentOffer.discountValue}% OFF`
                      : currentOffer.discountType === "flat"
                      ? `Flat ₹${currentOffer.discountValue} OFF`
                      : currentOffer.title}
                  </div>
                  {currentOffer.title && currentOffer.discountType !== "custom" && (
                    <div className="text-xs font-bold text-stone-600 dark:text-stone-300 truncate">
                      {currentOffer.title}
                    </div>
                  )}
                </div>

                {/* Offer Condition */}
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {currentOffer.minOrder > 0
                    ? `On orders above ₹${currentOffer.minOrder}`
                    : "Valid on all eligible orders"}
                </p>

                {/* Coupon Code Pill with Copy Action */}
                {currentOffer.code && (
                  <div className="pt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(currentOffer.code)}
                      aria-label={`Copy coupon code ${currentOffer.code}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E293B] border border-dashed border-[var(--brand-accent)] text-[var(--text-main)] text-xs font-mono font-bold hover:bg-orange-50 dark:hover:bg-orange-950/30 transition active:scale-95 group/copy shadow-2xs"
                    >
                      <Tag size={12} className="text-[var(--brand-accent)]" />
                      <span>Code: {currentOffer.code.toUpperCase()}</span>
                      {copiedCode === currentOffer.code ? (
                        <Check size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={12} className="text-[var(--text-muted)] group-hover/copy:text-[var(--brand-accent)]" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Right Dish Thumbnail */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-white/60 dark:bg-black/20 border border-orange-200/50 shadow-sm shrink-0">
                <Image
                  src={
                    currentOffer.image ||
                    currentOffer.restaurant?.image ||
                    "/images/cat-indian.jpg"
                  }
                  alt={currentOffer.title || "Special culinary offer"}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
            </div>

            {/* Prev / Next Chevrons (if multiple offers exist) */}
            {validOffers.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevOffer}
                  aria-label="Previous offer"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white/90 dark:bg-black/60 text-[var(--text-main)] border border-[var(--border-color)] flex items-center justify-center shadow-xs hover:scale-105 active:scale-90 transition"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={nextOffer}
                  aria-label="Next offer"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white/90 dark:bg-black/60 text-[var(--text-main)] border border-[var(--border-color)] flex items-center justify-center shadow-xs hover:scale-105 active:scale-90 transition"
                >
                  <ChevronRight size={13} />
                </button>
              </>
            )}
          </div>

          {/* Carousel Pagination Dots */}
          {validOffers.length > 1 && (
            <div
              className="flex items-center justify-center gap-1.5 pt-2"
              role="tablist"
              aria-label="Offers carousel pagination"
            >
              {validOffers.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeIndex}
                  aria-label={`Go to offer ${idx + 1}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === activeIndex
                      ? "w-5 bg-[var(--brand-accent)]"
                      : "w-1.5 bg-[var(--border-color)] hover:bg-[var(--text-muted)]"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
