"use client";

import { useState, useEffect } from "react";
import { Bell, X, Sparkles, CheckCircle2 } from "lucide-react";
import { useWebPush } from "@/hooks/useWebPush";

export default function DeliveryPushPrompt({ className = "" }) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
  } = useWebPush();

  const [isDismissed, setIsDismissed] = useState(true); // default true until verified on client

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const dismissed = localStorage.getItem("pet_delivery_push_prompt_dismissed") === "true";
      setIsDismissed(dismissed);
    } catch (e) {
      setIsDismissed(false);
    }
  }, []);

  // Only show when supported, unprompted (permission === 'default'), not already subscribed, and not dismissed
  if (!isSupported || isSubscribed || permission !== "default" || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem("pet_delivery_push_prompt_dismissed", "true");
    } catch (e) {}
  };

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setIsDismissed(true);
    }
  };

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
              <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-500">
                Closed-Tab
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 max-w-xl">
              Receive browser alerts when chef starts cooking, food is dispatched, and when your delivery arrives—even if your browser tab is closed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleEnable}
            disabled={isLoading}
            className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-orange-500/25 transition duration-150 active:scale-95"
          >
            <Bell size={13} />
            {isLoading ? "Enabling..." : "Enable Alerts"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="cursor-pointer px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
