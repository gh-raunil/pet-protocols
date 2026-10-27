"use client";

import React, { useEffect } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { useLocationStore } from "@/lib/locationStore";

export default function NavbarLocationSelector() {
  const { location, openModal, initializeLocation } = useLocationStore();

  useEffect(() => {
    initializeLocation();
  }, [initializeLocation]);

  return (
    <button
      type="button"
      onClick={openModal}
      aria-label={`Delivery location: ${location}. Click to change.`}
      className="hidden md:flex items-center gap-1.5 lg:gap-2 text-left group px-1.5 lg:px-2 py-1 rounded-xl hover:bg-[var(--bg-sub)] transition cursor-pointer select-none max-w-[130px] lg:max-w-[155px] xl:max-w-[220px] 2xl:max-w-[240px] shrink min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
    >
      <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center shrink-0 border border-[var(--brand-accent)]/20 shadow-2xs group-hover:bg-[var(--brand-accent)] group-hover:text-white transition-colors duration-200">
        <MapPin size={14} />
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-bold text-[var(--text-main)] truncate group-hover:text-[var(--brand-accent)] transition-colors leading-tight">
            {location}
          </span>
          <ChevronDown
            size={12}
            className="text-[var(--text-muted)] group-hover:text-[var(--brand-accent)] group-hover:translate-y-0.5 transition-all shrink-0"
          />
        </div>
        <span className="text-[10px] text-[var(--text-muted)] leading-tight truncate">
          Change location
        </span>
      </div>
    </button>
  );
}
