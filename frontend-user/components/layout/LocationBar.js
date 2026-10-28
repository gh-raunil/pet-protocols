"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { MapPin, ChevronDown } from "lucide-react";
import { useLocationStore } from "@/lib/locationStore";

export default function LocationBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const { location, openModal, initializeLocation } = useLocationStore();

  useEffect(() => {
    initializeLocation();
  }, [initializeLocation]);

  const handleLocationClick = () => {
    if (!session) {
      toast.error("Please sign in to set your delivery location.", { icon: "🔒" });
      router.push("/auth/login");
      return;
    }
    openModal();
  };

  return (
    <div className="w-full py-1 flex items-center justify-start">
      <button
        type="button"
        onClick={handleLocationClick}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-main)] hover:text-[var(--brand-accent)] font-semibold transition active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] rounded-xl px-2 py-1 bg-[var(--bg-sub)]/60 border border-[var(--border-color)]"
        aria-label={`Delivery location: ${location}. Click to change.`}
      >
        <MapPin size={14} className="text-[var(--brand-accent)] shrink-0" />
        <span className="font-bold truncate max-w-[200px]">{location}</span>
        <span className="text-[10px] text-[var(--text-muted)] font-normal hidden xs:inline">
          &bull; Change
        </span>
        <ChevronDown
          size={12}
          className="text-[var(--text-muted)] group-hover:text-[var(--brand-accent)] transition-colors"
        />
      </button>
    </div>
  );
}
