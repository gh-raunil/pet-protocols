"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Download, X, Sparkles } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import PWAInstallButton from "./PWAInstallButton";

const DISMISS_KEY = "pet_pwa_banner_dismissed_time";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const lastDismissed = localStorage.getItem(DISMISS_KEY);
      if (lastDismissed && Date.now() - Number(lastDismissed) < SEVEN_DAYS_MS) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } catch (e) {
      setDismissed(false);
    }
  }, []);

  if (isInstalled || dismissed || (!isInstallable && !isIOS)) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (e) {}
  };

  return (
    <aside
      aria-label="Install App Banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 p-4 rounded-3xl bg-[var(--bg-card)]/95 border border-[var(--border-color)] shadow-2xl backdrop-blur-xl transition-all duration-300 animate-[fadeIn_0.3s_ease]"
    >
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl overflow-hidden border border-[var(--brand-accent)]/30 shrink-0 shadow-inner bg-[var(--bg-sub)]">
          <Image
            src="/images/logo1.png"
            alt="Pet Protocols"
            width={44}
            height={44}
            className="object-cover w-full h-full"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-black text-[var(--text-main)]">
            <span>Install Pet Protocols</span>
            <span className="text-[10px] font-bold text-[var(--brand-accent)] flex items-center gap-0.5">
              <Sparkles size={10} /> Fast & Clean
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
            Install on your home screen for quick, tap-and-order access.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton variant="banner" />
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install banner"
            className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
