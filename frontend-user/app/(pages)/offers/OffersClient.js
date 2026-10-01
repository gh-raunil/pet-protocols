"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Tag,
  Sparkles,
  Building2,
  ArrowRight,
  TicketPercent,
  RefreshCw,
  AlertTriangle,
  Flame,
  Copy,
} from "lucide-react";
import { toast } from "@/components/ui/ToastProvider";

export default function OffersClient() {
  const router = useRouter();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadOffers() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/offers", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setOffers(data.offers || []);
      } else {
        setError(data.message || "Failed to load offers");
      }
    } catch (err) {
      console.error("Error loading offers:", err);
      setError("Unable to connect to the offers service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOffers();
  }, []);

  const handleOfferClick = (offer) => {
    const restaurantId = offer.restaurant?._id || offer.restaurant;
    if (restaurantId) {
      router.push(`/menu?restaurant=${restaurantId}`);
    } else {
      router.push("/menu");
    }
  };

  const copyCouponCode = (e, code) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      toast.success(`Coupon code ${code} copied!`);
    }
  };

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-[var(--text-main)] transition-colors">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/25 text-[var(--brand-accent)] text-xs font-bold uppercase tracking-wider mb-3">
          <TicketPercent size={14} /> Deals & Specials
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[var(--text-main)] mb-3">
          Special Dining Offers
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">
          Verified discount promotions and seasonal kitchen vouchers across Pet Protocols.
        </p>
      </div>

      {/* ── CONTENT AREA ────────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-[var(--brand-accent)]">
          <RefreshCw className="animate-spin w-8 h-8" />
          <p className="text-xs text-[var(--text-muted)]">Loading verified offers...</p>
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/25 text-center space-y-3 my-8 max-w-md mx-auto">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-sm font-bold text-rose-500">Unable to load offers</h3>
          <p className="text-xs text-[var(--text-muted)]">{error}</p>
          <button
            onClick={loadOffers}
            className="px-5 py-2.5 rounded-xl bg-rose-500 hover:opacity-95 text-white text-xs font-bold transition shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : offers.length === 0 ? (
        <div className="max-w-lg mx-auto p-12 sm:p-16 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center shadow-xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] flex items-center justify-center mx-auto">
            <Tag size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-main)]">
              No ongoing offers right now.
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed max-w-sm mx-auto">
              Check back soon for new deals and special offers from verified partner restaurants on Pet Protocols.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white text-xs font-bold transition shadow-lg shadow-[var(--brand-accent)]/20"
            >
              <span>Explore Kitchen Menu</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => {
            const restaurant = offer.restaurant;
            const discountLabel =
              offer.discountType === "flat"
                ? `₹${offer.discountValue} FLAT OFF`
                : `${offer.discountValue}% OFF`;

            return (
              <div
                key={offer._id}
                onClick={() => handleOfferClick(offer)}
                className="group p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/40 transition-all duration-300 shadow-xl cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-[var(--brand-accent)] text-white shadow-md shadow-[var(--brand-accent)]/25">
                      <Flame size={12} /> {discountLabel}
                    </span>
                    {offer.code && (
                      <button
                        type="button"
                        onClick={(e) => copyCouponCode(e, offer.code)}
                        className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--brand-accent)] hover:border-[var(--brand-accent)] transition flex items-center gap-1.5"
                        title="Click to copy promo code"
                      >
                        <span>{offer.code}</span>
                        <Copy size={12} />
                      </button>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition mb-2 leading-snug">
                    {offer.title}
                  </h3>
                  {offer.description && (
                    <p className="text-xs text-[var(--text-muted)] line-clamp-3 leading-relaxed mb-4">
                      {offer.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <Building2 size={13} className="text-[var(--brand-accent)]" />
                    <span className="truncate max-w-[130px]">
                      {restaurant?.name || "All Partner Kitchens"}
                    </span>
                  </span>
                  <span className="font-bold text-[var(--brand-accent)] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    Apply <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
