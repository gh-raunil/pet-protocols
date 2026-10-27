"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Download, X, Sparkles } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import PWAInstallButton from "./PWAInstallButton";

const DISMISS_KEY = "pet_app_install_popup_dismissed_v2";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export default function PWAInstallBanner() {
  const { isInstalled } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const sessionDismissed = sessionStorage.getItem(DISMISS_KEY) === "true";
      const lastDismissed = localStorage.getItem(DISMISS_KEY);
      const isRecentlyDismissed = lastDismissed && Date.now() - Number(lastDismissed) < TWENTY_FOUR_HOURS_MS;

      if (sessionDismissed || isRecentlyDismissed) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } catch (e) {
      setDismissed(false);
    }

    const handleOpen = () => setDismissed(false);
    window.addEventListener("open_app_install_popup", handleOpen);
    return () => window.removeEventListener("open_app_install_popup", handleOpen);
  }, []);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "true");
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (e) {}
  };

  return (
    <aside
      aria-label="Install App Banner"
      className="fixed bottom-[74px] sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 p-3 sm:p-3.5 rounded-3xl bg-[var(--bg-card)]/98 border border-[var(--border-color)] shadow-2xl backdrop-blur-xl transition-all duration-300 animate-[fadeIn_0.3s_ease]"
    >
      <div className="flex items-center gap-3">
        {/* App Logo in rounded dark frame matching design */}
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl overflow-hidden border border-[var(--brand-accent)]/30 shrink-0 shadow-md bg-black p-1 flex items-center justify-center">
          <Image
            src="/images/logo1.png"
            alt="पेट Protocols"
            width={48}
            height={48}
            className="object-contain w-full h-full"
          />
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-black text-[var(--text-main)] truncate">
            <span>Install पेट Protocols</span>
            <span className="text-[10px] font-bold text-[var(--brand-accent)] inline-flex items-center gap-0.5 shrink-0">
              <Sparkles size={11} /> Fast & Clean
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
            Install on your home screen for quick, tap-and-order access.
          </p>
        </div>

        {/* Action Button & Dismiss Button */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <PWAInstallButton variant="banner" />
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="p-1 sm:p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
