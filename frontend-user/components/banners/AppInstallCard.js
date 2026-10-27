"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { X, ArrowDownToLine, Share, CheckCircle2, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISS_KEY = "pet_protocols_home_app_install_dismissed";

export default function AppInstallCard() {
  const { triggerInstall, isInstallable, isInstalled, isIOS } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const isDismissed = localStorage.getItem(DISMISS_KEY) === "true";
      setDismissed(isDismissed);
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!mounted || dismissed || isInstalled) return null;

  const handleDismiss = (e) => {
    e.stopPropagation();
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {}
  };

  const handleInstallClick = async () => {
    if (!isInstallable) return;
    setInstalling(true);
    try {
      await triggerInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      aria-label="Install पेट Protocols Web App"
      className="w-full rounded-3xl bg-[#FFF9F2] dark:bg-[#141C25] border border-amber-200/70 dark:border-amber-900/30 p-4 sm:p-5 shadow-xs relative overflow-hidden transition-all duration-300 animate-[fadeIn_0.2s_ease]"
    >
      {/* Dismiss Button */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install banner"
        className="absolute top-3.5 right-3.5 z-20 w-7 h-7 rounded-full bg-white/80 dark:bg-black/50 text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center transition border border-[var(--border-color)] active:scale-90"
      >
        <X size={14} />
      </button>

      <div className="flex items-center justify-between gap-4 relative z-10">
        {/* Left Copy & Action */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20">
              <Smartphone size={11} />
              <span>Progressive Web App</span>
            </div>
            <h4 className="text-sm sm:text-base font-extrabold text-[var(--text-main)] tracking-tight">
              Install पेट Protocols
            </h4>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Fast ordering, order updates, and instant one-tap launch right from your home screen.
            </p>
          </div>

          {/* Genuine PWA Action State */}
          <div className="pt-1">
            {isInstallable ? (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition active:scale-95 shadow-xs cursor-pointer disabled:opacity-60"
              >
                <ArrowDownToLine size={14} />
                <span>{installing ? "Opening..." : "Install Web App"}</span>
              </button>
            ) : isIOS ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-100/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-xs font-medium">
                <Share size={13} className="shrink-0" />
                <span>
                  Tap <strong>Share</strong> and select <strong>&quot;Add to Home Screen&quot;</strong>
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)] italic">
                To install, open in Chrome, Edge, or Safari and choose &quot;Add to Home Screen&quot; or &quot;Install App&quot; from the browser menu.
              </p>
            )}
          </div>
        </div>

        {/* Right Artwork */}
        <div className="relative w-20 h-24 sm:w-24 sm:h-28 shrink-0">
          <Image
            src="/images/category_img_phone.png"
            alt="पेट Protocols App mobile interface"
            fill
            sizes="96px"
            className="object-contain drop-shadow-md"
          />
        </div>
      </div>
    </div>
  );
}
