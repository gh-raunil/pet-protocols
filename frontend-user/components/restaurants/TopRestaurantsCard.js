"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, ArrowRight, Store, Clock } from "lucide-react";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";

export default function TopRestaurantsCard({ restaurants = [], loading = false }) {
  // Only display launched & active restaurants
  const activeRestaurants = restaurants.filter(
    (r) => r.status === "active" || r.status === undefined
  );

  return (
    <div
      aria-label="Top Partner Restaurants"
      className="w-full rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-5 shadow-xs transition-colors space-y-3"
    >
      {/* Header matching reference image */}
      <div className="flex items-center justify-between pb-1">
        <h3 className="text-base font-extrabold text-[var(--text-main)] tracking-tight">
          Top Restaurants
        </h3>
        <Link
          href="/restaurants"
          className="text-xs font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1 group"
        >
          <span>View all</span>
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Restaurants List */}
      <div className="divide-y divide-[var(--border-color)]">
        {loading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse py-2">
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-sub)] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-[var(--bg-sub)] rounded-md w-3/4" />
                  <div className="h-3 bg-[var(--bg-sub)] rounded-md w-1/2" />
                </div>
                <div className="w-12 h-6 bg-[var(--bg-sub)] rounded-full" />
              </div>
            ))}
          </div>
        ) : activeRestaurants.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-muted)] space-y-1.5">
            <Store size={24} className="mx-auto text-[var(--text-muted)] opacity-60" />
            <p className="font-bold text-[var(--text-main)]">Partner Kitchens Launching</p>
            <p>New gourmet kitchens will be available shortly.</p>
          </div>
        ) : (
          activeRestaurants.map((rest) => {
            const opStatus = getRestaurantOperationalStatus(rest);
            const isOpen = opStatus.isOpen;
            const deliveryFee =
              rest?.chargeSettings?.flatDeliveryFee === 0
                ? "Free delivery"
                : rest?.chargeSettings?.flatDeliveryFee !== undefined
                ? `₹${rest.chargeSettings.flatDeliveryFee}`
                : "Free";

            const estMinutes =
              rest?.deliverySettings?.estimatedDeliveryMinutes || 25;
            const estTime = `${estMinutes}–${estMinutes + 10} min`;

            return (
              <Link
                key={rest._id}
                href={`/menu?restaurant=${encodeURIComponent(rest.slug || rest._id)}`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-[var(--bg-sub)]/60 rounded-2xl px-2 transition-colors group cursor-pointer"
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[var(--bg-sub)] border border-[var(--border-color)] relative shrink-0 shadow-2xs">
                  <Image
                    src={rest.image || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500"}
                    alt={rest.name}
                    fill
                    sizes="56px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Restaurant Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-extrabold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition-colors truncate">
                      {rest.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mt-0.5 flex-wrap">
                    {typeof rest.rating === "number" && rest.numRatings > 0 ? (
                      <span className="flex items-center gap-0.5 text-amber-500 font-bold shrink-0">
                        <Star size={11} className="fill-amber-400 stroke-amber-500" />
                        <span>{rest.rating}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-normal">
                          ({rest.numRatings})
                        </span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)] italic">No ratings yet</span>
                    )}
                    <span>&bull;</span>
                    <span className="truncate flex items-center gap-1">
                      <Clock size={11} />
                      {estTime}
                    </span>
                    <span>&bull;</span>
                    <span className="truncate">{deliveryFee}</span>

                    {/* Accurate distance shown only when calculated from valid coordinates */}
                    {rest.serviceability?.distanceKm != null && (
                      <>
                        <span>&bull;</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {rest.serviceability.distanceKm} km
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Authoritative Serviceability & Operating Status Badge */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {rest.serviceability ? (
                    rest.serviceability.isServiceable ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 dark:text-emerald-400">
                        Delivering to you
                      </span>
                    ) : rest.serviceability.code === "OUT_OF_DELIVERY_RANGE" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-400">
                        Outside delivery area
                      </span>
                    ) : rest.serviceability.code === "DELIVERY_NOT_SUPPORTED" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/25">
                        Pickup only
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-500/10 text-stone-500 border border-stone-500/25">
                        Delivery unavailable
                      </span>
                    )
                  ) : (
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                        isOpen
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400"
                          : "bg-stone-500/10 text-stone-500 border-stone-500/25"
                      }`}
                    >
                      {isOpen ? "Open" : "Closed"}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
