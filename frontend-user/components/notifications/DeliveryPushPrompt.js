"use client";

import { useState, useEffect } from "react";
import { Bell, X, Sparkles, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useWebPush } from "@/hooks/useWebPush";

export default function DeliveryPushPrompt({ className = "", compact = false }) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
  } = useWebPush();

  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Use sessionStorage so user isn't permanently locked out of notifications
      const dismissed = sessionStorage.getItem("pet_delivery_push_prompt_dismissed_session") === "true";
      setIsDismissed(dismissed);
    } catch (e) {
      setIsDismissed(false);
    }
  }, []);

  if (!isSupported || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("pet_delivery_push_prompt_dismissed_session", "true");
    } catch (e) {}
  };

  const handleEnable = async () => {
    await subscribe({ showToast: true });
  };

  // State A: Already Subscribed (Show subtle confirmation badge or render nothing if compact)
  if (isSubscribed) {
    if (compact) return null;
    return (
      <div
        className={`relative overflow-hidden rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-3 sm:p-4 text-xs flex items-center justify-between gap-3 text-emerald-300 ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span className="font-bold text-white">Live Order Alerts Active</span>
            <span className="text-[11px] text-emerald-400/80 block">
              You will receive push updates for cooking and delivery on this device.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-emerald-400/60 hover:text-emerald-300 p-1 cursor-pointer"
          aria-label="Dismiss confirmation"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  // State B: Permission Denied (Informative guide without repeated prompt dialogs)
  if (permission === "denied") {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl bg-rose-500/10 border border-rose-500/25 p-4 text-xs text-rose-300 ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-white">Order Alerts are Blocked in Browser</h4>
              <p className="text-[11px] text-rose-300/90 leading-relaxed">
                Notifications are blocked for this site. To receive live delivery alerts, tap the padlock / info icon in your browser address bar (or Android App Info) and allow Notifications.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-rose-400/60 hover:text-rose-300 p-1 cursor-pointer shrink-0"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // State C: Permission is Granted, but Push Subscription is missing (Common on Android TWA!)
  if (permission === "granted") {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-transparent border border-orange-500/40 p-4 sm:p-5 shadow-sm transition-all duration-300 ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 border border-orange-500/30 shadow-sm shadow-orange-500/10">
              <Bell size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                  Activate Live Order Alerts
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Permission Ready
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                Notification permission is granted. Tap below to link this device to live cooking and dispatch updates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] px-3 py-2 rounded-xl transition cursor-pointer"
            >
              Later
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleEnable}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Activating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Activate Alerts</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State D: Permission is Default (Prompt unprompted user)
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border border-orange-500/30 p-4 sm:p-5 shadow-sm transition-all duration-300 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 border border-orange-500/30 shadow-sm shadow-orange-500/10">
            <Bell size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                Get Live Order Alerts
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Recommended
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
              Receive lock-screen alerts when your food is confirmed, cooking, and arriving at your door.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] px-3 py-2 rounded-xl transition cursor-pointer"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleEnable}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Enabling...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Enable Alerts</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
