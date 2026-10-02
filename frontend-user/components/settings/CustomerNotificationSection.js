"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Send,
  Smartphone,
  Laptop,
  Trash2,
  RefreshCw,
  Sparkles,
  CookingPot,
  Truck,
  ShieldAlert,
  Tag,
  Check,
  RotateCcw,
} from "lucide-react";
import { useWebPush, getDeviceLabel } from "@/hooks/useWebPush";
import { toast } from "@/components/ui/ToastProvider";

const DEFAULT_PREFERENCES = {
  orderUpdates: true,
  prepUpdates: true,
  deliveryUpdates: true,
  cancellationAlerts: true,
  promotions: true,
};

export default function CustomerNotificationSection({ className = "" }) {
  const { data: session, status: authStatus } = useSession();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading: isPushLoading,
    subscribe,
    unsubscribe,
    sendTest,
    devices,
    loadingDevices,
    fetchDevices,
    revokeDevice,
  } = useWebPush();

  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [currentDeviceLabel, setCurrentDeviceLabel] = useState("This Device");

  useEffect(() => {
    setCurrentDeviceLabel(getDeviceLabel());
  }, []);

  // Fetch preferences on mount or auth change
  const loadPreferences = useCallback(async () => {
    try {
      setLoadingPrefs(true);
      const res = await fetch("/api/user/notifications/preferences");
      const data = await res.json();
      if (data.success && data.preferences) {
        setPreferences(data.preferences);
      }
    } catch (e) {
      console.warn("Failed to load customer notification preferences:", e);
    } finally {
      setLoadingPrefs(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
    if (authStatus === "authenticated") {
      fetchDevices();
    }
  }, [authStatus, loadPreferences, fetchDevices]);

  // Toggle individual preference
  const handleTogglePref = async (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);

    if (authStatus !== "authenticated") {
      // Local fallback for guest
      return;
    }

    try {
      setSavingPrefs(true);
      const res = await fetch("/api/user/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: updated }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Failed to save preference.");
      }
    } catch (e) {
      toast.error("Failed to update preference.");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <section className={`p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6 ${className}`}>
      {/* ── HEADER ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-[var(--brand-accent)]" />
            <h2 className="text-lg font-extrabold text-[var(--text-main)]">
              Notification Preferences
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Manage live lock-screen push alerts, order milestone notifications, and active devices.
          </p>
        </div>

        {/* Global Status Pill */}
        {isSupported && (
          <div className="flex items-center gap-2 shrink-0">
            {isSubscribed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold">
                <CheckCircle2 size={13} /> Push Enabled
              </span>
            ) : permission === "denied" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold">
                <AlertCircle size={13} /> Blocked
              </span>
            ) : permission === "granted" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-bold">
                <Sparkles size={13} /> Ready to Activate
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-muted)] text-xs font-bold">
                <Bell size={13} /> Disabled
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 1. THIS DEVICE WEB PUSH TOGGLE ─────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-[var(--text-main)]">
                Web Push Order Alerts ({currentDeviceLabel})
              </span>
              {isSubscribed && (
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Receive native lock-screen & desktop push alerts when your order is placed, confirmed, cooking, and out for delivery.
            </p>
            {permission === "denied" && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1.5">
                <AlertCircle size={13} /> Notifications are blocked. Tap the padlock icon next to your URL (or Android Settings) to allow.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            {isSubscribed && (
              <button
                type="button"
                onClick={sendTest}
                disabled={isPushLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)] text-[var(--text-main)] text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Send size={13} className="text-[var(--brand-accent)]" />
                <span>Test Alert</span>
              </button>
            )}

            <button
              type="button"
              disabled={isPushLoading || !isSupported}
              onClick={() => {
                if (isSubscribed) {
                  unsubscribe();
                } else {
                  subscribe();
                }
              }}
              className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer disabled:opacity-50 ${
                isSubscribed ? "bg-[var(--brand-accent)]" : "bg-[var(--bg-card)] border border-[var(--border-color)]"
              }`}
              aria-label="Toggle Web Push on this device"
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  isSubscribed ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. GRANULAR ORDER LIFECYCLE PREFERENCES ────────────── */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
          Order Status Event Alerts
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Order Placement & Confirmation */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-[var(--brand-accent)] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">Order Placed & Confirmed</span>
                <span className="text-[11px] text-[var(--text-muted)]">Immediate receipt and kitchen acceptance</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.orderUpdates}
              onChange={(e) => handleTogglePref("orderUpdates", e.target.checked)}
              className="w-4 h-4 rounded text-orange-500 bg-[var(--bg-card)] border-[var(--border-color)] cursor-pointer"
            />
          </div>

          {/* Kitchen Cooking & Prep Updates */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <CookingPot size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">Cooking & Kitchen Prep</span>
                <span className="text-[11px] text-[var(--text-muted)]">Chef starts cooking dishes & packing</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.prepUpdates}
              onChange={(e) => handleTogglePref("prepUpdates", e.target.checked)}
              className="w-4 h-4 rounded text-orange-500 bg-[var(--bg-card)] border-[var(--border-color)] cursor-pointer"
            />
          </div>

          {/* Dispatch & Delivery Tracking */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                <Truck size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">Out for Delivery</span>
                <span className="text-[11px] text-[var(--text-muted)]">Courier pickup handoff and doorstep arrival</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.deliveryUpdates}
              onChange={(e) => handleTogglePref("deliveryUpdates", e.target.checked)}
              className="w-4 h-4 rounded text-orange-500 bg-[var(--bg-card)] border-[var(--border-color)] cursor-pointer"
            />
          </div>

          {/* Cancellations & Important Notices */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">Cancellation & Critical Alerts</span>
                <span className="text-[11px] text-[var(--text-muted)]">Refunds, cancellations, and kitchen notes</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.cancellationAlerts}
              onChange={(e) => handleTogglePref("cancellationAlerts", e.target.checked)}
              className="w-4 h-4 rounded text-orange-500 bg-[var(--bg-card)] border-[var(--border-color)] cursor-pointer"
            />
          </div>

          {/* Offers & Promos */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-between gap-3 md:col-span-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                <Tag size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">Kitchen Specials & Promo Vouchers</span>
                <span className="text-[11px] text-[var(--text-muted)]">Seasonal discount codes, festive menus, and flash deals</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.promotions}
              onChange={(e) => handleTogglePref("promotions", e.target.checked)}
              className="w-4 h-4 rounded text-orange-500 bg-[var(--bg-card)] border-[var(--border-color)] cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ── 3. REGISTERED ACTIVE DEVICES ────────────────────────── */}
      {authStatus === "authenticated" && (
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Smartphone size={14} />
              <span>Registered Devices ({devices.length})</span>
            </h3>
            <button
              type="button"
              onClick={fetchDevices}
              disabled={loadingDevices}
              className="text-[11px] text-[var(--brand-accent)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={11} className={loadingDevices ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-center text-xs text-[var(--text-muted)]">
              No registered devices found for your account. Enable push on this device to receive live alerts.
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-3 sm:p-3.5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                      {dev.deviceLabel?.toLowerCase().includes("pc") || dev.deviceLabel?.toLowerCase().includes("mac") ? (
                        <Laptop size={14} />
                      ) : (
                        <Smartphone size={14} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-[var(--text-main)] truncate block">
                        {dev.deviceLabel || "Browser Device"}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block truncate">
                        Last active: {new Date(dev.lastUsed || dev.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => revokeDevice(dev.id)}
                    className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                    title="Revoke push notifications on this device"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
