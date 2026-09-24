"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Tag,
  Sparkles,
  Building2,
  ArrowRight,
  Clock,
  TicketPercent,
  RefreshCw,
  AlertTriangle,
  Flame,
} from "lucide-react";

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

  return (
    <main className="min-h-screen pt-32 pb-24 px-6 max-w-6xl mx-auto font-jakarta text-white">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="text-center max-w-2xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest mb-3">
          <TicketPercent size={14} /> Deals & Specials
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-3">
          Offers
        </h1>
        <p className="text-sm sm:text-base text-gray-400">
          Exclusive culinary deals and limited-time savings from partner kitchens.
        </p>
      </div>

      {/* ── CONTENT AREA ────────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-orange-500">
          <RefreshCw className="animate-spin w-8 h-8" />
          <p className="text-xs text-gray-400">Loading current offers...</p>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3 my-8 max-w-md mx-auto">
          <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
          <h3 className="text-sm font-bold text-rose-300">Unable to load offers</h3>
          <p className="text-xs text-rose-300/80">{error}</p>
          <button
            onClick={loadOffers}
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : offers.length === 0 ? (
        /* Empty State — Strictly follows specified copy */
        <div className="max-w-lg mx-auto p-12 sm:p-16 rounded-3xl bg-[#0e1013] border border-white/10 text-center shadow-xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
            <Tag size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              No ongoing offers right now.
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
              Check back soon for new deals and special offers from restaurants on Pet Protocols.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-md shadow-orange-500/20"
            >
              <span>Explore Kitchen Menu</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        /* Active Offers Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => {
            const restaurant = offer.restaurant;
            const restaurantId = restaurant?._id || restaurant;
            const discountLabel =
              offer.discountType === "flat"
                ? `₹${offer.discountValue} OFF`
                : `${offer.discountValue}% OFF`;

            return (
              <div
                key={offer._id}
                onClick={() => handleOfferClick(offer)}
                className="group p-6 rounded-3xl bg-[#0e1013] border border-white/10 hover:border-orange-500/40 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-orange-500/10 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full bg-orange-500 text-white shadow-md shadow-orange-500/30">
                      <Flame size={12} /> {discountLabel}
                    </span>
                    {offer.code && (
                      <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/15 text-orange-400 tracking-wider">
                        {offer.code}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-extrabold text-white group-hover:text-orange-400 transition mb-2 leading-snug">
                    {offer.title}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed mb-4">
                    {offer.description}
                  </p>
                </div>

                <div>
                  {/* Minimum Order & Validity */}
                  <div className="pt-3 border-t border-white/5 space-y-1.5 text-xs text-gray-400 mb-4">
                    {offer.minOrder > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Min Order:</span>
                        <span className="font-bold text-gray-200">₹{offer.minOrder}</span>
                      </div>
                    )}
                    {offer.endDate && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> Valid until:
                        </span>
                        <span className="font-mono text-gray-300">
                          {new Date(offer.endDate).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Restaurant Association & CTA */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0">
                        <Building2 size={14} />
                      </div>
                      <span className="text-xs font-bold text-gray-200 truncate">
                        {restaurant?.name || "All Kitchens"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOfferClick(offer);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-sm shrink-0"
                    >
                      <span>View Menu</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
