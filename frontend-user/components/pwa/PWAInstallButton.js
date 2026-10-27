"use client";

import React, { useState } from "react";
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2 } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { toast } from "@/components/ui/ToastProvider";

export default function PWAInstallButton({ variant = "button", className = "" }) {
  const { isInstallable, isInstalled, isIOS, isAndroid, triggerInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

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

  const handleDownloadAPK = () => {
    toast.success("Starting official पेट Protocols Android APK download...");
    const link = document.createElement("a");
    link.href = "/downloads/pet-protocols-release.apk";
    link.download = "pet-protocols-1.1.apk";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDeviceModal(false);
  };

  const handleClick = async () => {
    if (isInstallable) {
      const result = await triggerInstall();
      if (result?.outcome === "accepted") {
        toast.success("Thank you for installing पेट Protocols!");
        return;
      }
    }

    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (isAndroid) {
      handleDownloadAPK();
      return;
    }

    // Desktop or other browser
    setShowDeviceModal(true);
  };

  return (
    <>
      {variant === "nav" ? (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30 hover:bg-[var(--brand-accent)]/25 transition cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-3">
            <Download size={18} className="text-[var(--brand-accent)]" />
            <span>Install पेट Protocols App</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--brand-accent)] text-white">
            App
          </span>
        </button>
      ) : variant === "settings" ? (
        <button
          type="button"
          onClick={handleClick}
          className={`px-4 py-2.5 rounded-2xl bg-[var(--brand-accent)] text-white font-bold text-xs shadow-md shadow-[var(--brand-accent)]/25 hover:opacity-90 transition flex items-center gap-2 cursor-pointer ${className}`}
        >
          <Download size={15} />
          <span>Install पेट Protocols App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-[var(--brand-accent)] hover:opacity-95 text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 active:scale-95 transition cursor-pointer shrink-0 whitespace-nowrap ${className}`}
        >
          <Download size={14} className="stroke-[2.5]" />
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
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Install पेट Protocols on your iPhone or iPad for a full-screen, app-like experience:
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
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 hover:opacity-90 transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Desktop / All Devices App Download Dialog */}
      {showDeviceModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
        >
          <div className="w-full max-w-md p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <Smartphone size={18} className="text-[var(--brand-accent)]" />
                <span>Get पेट Protocols App</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDeviceModal(false)}
                className="p-1 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Option 1: Official Android APK */}
              <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                    <span>Android Application (APK)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 font-extrabold uppercase">Official</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Download signed APK (3.6 MB) for all Android devices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadAPK}
                  className="px-3.5 py-2 rounded-xl bg-[var(--brand-accent)] hover:opacity-95 text-white text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-[var(--brand-accent)]/20 active:scale-95"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
              </div>

              {/* Option 2: Browser Web App Installation */}
              <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-1.5">
                <div className="text-xs font-bold text-[var(--text-main)]">
                  Desktop & Web App (PWA)
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  In Chrome or Edge, look for the <strong>Install</strong> icon (<span className="font-mono text-[var(--brand-accent)]">⊕</span>) in your browser address bar on the right, or click the browser menu (⋮) → &quot;Install पेट Protocols&quot;.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href="/download"
                className="text-xs font-bold text-[var(--brand-accent)] hover:underline"
                onClick={() => setShowDeviceModal(false)}
              >
                View full download guide & details →
              </a>
              <button
                type="button"
                onClick={() => setShowDeviceModal(false)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-sub)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-main)] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
