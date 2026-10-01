"use client";

import React, { useState } from "react";
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2 } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { toast } from "@/components/ui/ToastProvider";

export default function PWAInstallButton({ variant = "button", className = "" }) {
  const { isInstallable, isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already installed as PWA standalone, show installed badge if in settings or return null
  if (isInstalled) {
    if (variant === "settings") {
      return (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-xs font-bold">
          <CheckCircle2 size={16} />
          <span>App Installed & Ready</span>
        </div>
      );
    }
    return null;
  }

  // Not installable and not iOS
  if (!isInstallable && !isIOS) {
    if (variant === "settings") {
      return (
        <div className="text-xs text-[var(--text-muted)] italic">
          To install, open Pet Protocols in Chrome, Edge, or Safari on your mobile or desktop device.
        </div>
      );
    }
    return null;
  }

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    const result = await triggerInstall();
    if (result.outcome === "accepted") {
      toast.success("Thank you for installing Pet Protocols!");
    }
  };

  return (
    <>
      {variant === "nav" ? (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30 hover:bg-[var(--brand-accent)]/25 transition ${className}`}
        >
          <div className="flex items-center gap-3">
            <Download size={18} className="text-[var(--brand-accent)]" />
            <span>Install Pet Protocols App</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--brand-accent)] text-white">
            App
          </span>
        </button>
      ) : variant === "settings" ? (
        <button
          type="button"
          onClick={handleClick}
          className={`px-4 py-2.5 rounded-2xl bg-[var(--brand-accent)] text-white font-bold text-xs shadow-md shadow-[var(--brand-accent)]/25 hover:opacity-90 transition flex items-center gap-2 ${className}`}
        >
          <Download size={15} />
          <span>Install Pet Protocols App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 hover:opacity-95 transition ${className}`}
        >
          <Download size={14} />
          <span>Install App</span>
        </button>
      )}

      {/* iOS Safari Installation Modal */}
      {showIOSModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
        >
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <Smartphone size={18} className="text-[var(--brand-accent)]" />
                <span>Install on Apple iOS</span>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Install Pet Protocols on your iPhone or iPad for a full-screen, app-like experience:
            </p>

            <ol className="space-y-3 text-xs">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--brand-accent)] text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Tap the <strong>Share</strong> button <Share size={13} className="inline mx-0.5 text-blue-400" /> at the bottom of Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--brand-accent)] text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare size={13} className="inline mx-0.5 text-emerald-400" />.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--brand-accent)] text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Tap <strong>Add</strong> in the top-right corner.
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 hover:opacity-90 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
