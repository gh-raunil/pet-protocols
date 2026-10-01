"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, AlertCircle, ShoppingBag, UtensilsCrossed } from "lucide-react";

export default function OfflinePage() {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.href = "/";
      } else {
        setIsRetrying(false);
      }
    }, 600);
  };

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)]">
      <div className="max-w-md w-full p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl text-center space-y-6">
        {/* Offline Icon with pulsing ring */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 flex items-center justify-center text-[var(--brand-accent)]">
          <WifiOff size={36} strokeWidth={2.2} />
          {!isOnline && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-[var(--bg-card)]" />
          )}
        </div>

        {/* Messaging */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
            <AlertCircle size={13} />
            No Internet Connection
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)]">
            You're Currently Offline
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            Pet Protocols requires an active internet connection to browse partner kitchens, update cart items, and place fresh food orders.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full py-3.5 px-4 rounded-2xl bg-[var(--brand-accent)] text-white text-xs sm:text-sm font-bold shadow-lg shadow-[var(--brand-accent)]/25 hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRetrying ? "animate-spin" : ""} />
            {isRetrying ? "Checking connection..." : "Retry Connection"}
          </button>

          <p className="text-[11px] text-[var(--text-muted)]">
            {isOnline
              ? "Connection detected! Click retry to return to your feast."
              : "Please check your Wi-Fi or mobile data network."}
          </p>
        </div>
      </div>
    </main>
  );
}
