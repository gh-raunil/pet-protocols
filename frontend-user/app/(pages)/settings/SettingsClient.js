"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@/components/ui/ThemeProvider";
import { toast } from "@/components/ui/ToastProvider";
import {
  Sun,
  Moon,
  Laptop,
  Check,
  Palette,
  Sparkles,
  Bell,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Smartphone,
  AlertCircle,
  Send,
  Volume2,
} from "lucide-react";
import PWAInstallButton from "@/components/pwa/PWAInstallButton";
import { useWebPush } from "@/hooks/useWebPush";

export default function SettingsClient() {
  const { theme, setTheme, palette, setPalette, palettes, mounted } = useTheme();

  // Web Push Notifications Hook
  const {
    isSupported: isPushSupported,
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    sendTest: sendTestPush,
  } = useWebPush();

  // Local notifications preferences
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [offerAlerts, setOfferAlerts] = useState(true);
  const [paletteFilter, setPaletteFilter] = useState("all");

  useEffect(() => {
    try {
      const savedOrders = localStorage.getItem("pet_pref_orders");
      const savedOffers = localStorage.getItem("pet_pref_offers");
      if (savedOrders !== null) setOrderAlerts(savedOrders === "true");
      if (savedOffers !== null) setOfferAlerts(savedOffers === "true");
    } catch (e) {}
  }, []);

  const handleToggleOrders = (val) => {
    setOrderAlerts(val);
    try {
      localStorage.setItem("pet_pref_orders", String(val));
    } catch (e) {}
    toast.info(`Order status alerts ${val ? "enabled" : "disabled"}`);
  };

  const handleToggleOffers = (val) => {
    setOfferAlerts(val);
    try {
      localStorage.setItem("pet_pref_offers", String(val));
    } catch (e) {}
    toast.info(`Offer promotions ${val ? "enabled" : "disabled"}`);
  };

  const filteredPalettes = palettes.filter((p) => {
    if (paletteFilter === "premium") return Boolean(p.isPremium);
    if (paletteFilter === "standard") return !p.isPremium;
    return true;
  });

  if (!mounted) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="h-10 w-48 bg-[var(--bg-card)] rounded-2xl animate-pulse mb-8" />
      </main>
    );
  }

  const themeOptions = [
    { id: "light", label: "Light", icon: Sun, desc: "Warm Cream & Soft Off-White" },
    { id: "dark", label: "Dark", icon: Moon, desc: "Deep Charcoal & Soft White" },
    { id: "system", label: "System", icon: Laptop, desc: "Match device OS appearance" },
  ];

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-[var(--text-main)] transition-colors">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="mb-10 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 text-[var(--brand-accent)] text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles size={14} /> Personalization & Appearance
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[var(--text-main)]">
          Settings
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-muted)] mt-1.5">
          Make Pet Protocols feel right for you.
        </p>
      </div>

      <div className="space-y-10">
        {/* ── SECTION A: APPEARANCE MODE ───────────────────────────── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <Sun size={20} className="text-[var(--brand-accent)]" />
              Appearance Mode
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Choose between light, dark, or synchronized with your system.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => {
                    setTheme(opt.id);
                    toast.success(`Theme set to ${opt.label}`);
                  }}
                  className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 ring-2 ring-[var(--brand-accent)]/30"
                      : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? "bg-[var(--brand-accent)] text-white"
                          : "bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]"
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[var(--brand-accent)] text-white flex items-center justify-center">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-main)]">{opt.label}</h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── SECTION B: COLOR THEME / PALETTES ──────────────────────── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Palette size={20} className="text-[var(--brand-accent)]" />
                <h2 className="text-lg font-extrabold text-[var(--text-main)]">
                  Color Palette
                </h2>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Select a curated palette to customize accents, buttons, highlights, and borders.
              </p>
            </div>

            {/* Controls: Reset Default & Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {palette !== "fresh-orange" && (
                <button
                  type="button"
                  onClick={() => {
                    setPalette("fresh-orange");
                    toast.success("Restored Fresh Orange default palette");
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/10 transition border border-[var(--brand-accent)]/30 flex items-center gap-1.5"
                >
                  <RotateCcw size={12} />
                  Reset Default
                </button>
              )}

              {/* Filter Pills */}
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setPaletteFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    paletteFilter === "all"
                      ? "bg-[var(--brand-accent)] text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  All ({palettes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter("premium")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    paletteFilter === "premium"
                      ? "bg-[var(--brand-accent)] text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  <Sparkles size={12} />
                  Premium (5)
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter("standard")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    paletteFilter === "standard"
                      ? "bg-[var(--brand-accent)] text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  Standard (6)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPalettes.map((pal) => {
              const isSelected = palette === pal.id;
              return (
                <div
                  key={pal.id}
                  onClick={() => {
                    setPalette(pal.id);
                    toast.success(`Applied ${pal.name} palette`);
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between group ${
                    isSelected
                      ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 ring-2 ring-[var(--brand-accent)]/30 shadow-md"
                      : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40 hover:bg-[var(--bg-card-hover)]"
                  }`}
                >
                  {/* Visual Swatch Preview - Stacked Capsule Pills */}
                  <div
                    className="p-3 mb-3.5 rounded-xl border border-black/10 shadow-inner relative overflow-hidden flex flex-col gap-1.5"
                    style={{ backgroundColor: pal.preview.bg }}
                  >
                    {/* Simulated miniature header / capsules */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs"
                        style={{
                          backgroundColor: pal.preview.card,
                          color: pal.preview.accent,
                        }}
                      >
                        {pal.name}
                      </span>
                      {pal.isPremium && (
                        <span className="flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-xs">
                          <Sparkles size={10} className="text-amber-300" />
                          PRO
                        </span>
                      )}
                    </div>

                    {/* Stacked Color Chips / Swatches */}
                    <div className="flex items-center gap-1 mt-1 pt-1 border-t border-black/5">
                      {pal.swatches?.map((hex, sIdx) => (
                        <div
                          key={sIdx}
                          title={hex}
                          className="flex-1 h-5 rounded-full shadow-xs border border-black/10 transition-transform group-hover:scale-105"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-1.5">
                        {pal.name}
                        {pal.id === "fresh-orange" && (
                          <span className="text-[10px] font-bold text-[var(--brand-accent)]">
                            (Default)
                          </span>
                        )}
                        {pal.isPremium && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30 flex items-center gap-0.5">
                            <Sparkles size={9} />
                            Premium
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                        {pal.description}
                      </p>
                    </div>

                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[var(--brand-accent)] text-white flex items-center justify-center shrink-0 ml-2">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── SECTION C: NOTIFICATIONS & PRIVACY ─────────────────────── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
                <Bell size={20} className="text-[var(--brand-accent)]" />
                Notification Preferences
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Manage Web Push updates and real-time alerts sent by Pet Protocols.
              </p>
            </div>
            {isPushSupported && (
              <div className="flex items-center gap-2">
                {isPushSubscribed ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold">
                    <CheckCircle2 size={13} /> Push Enabled
                  </span>
                ) : pushPermission === "denied" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold">
                    <AlertCircle size={13} /> Blocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-bold">
                    <Bell size={13} /> Disabled
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-5 divide-y divide-[var(--border-color)]">
            {/* Live Web Push Toggle */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                  <span>Web Push Order Notifications</span>
                  {isPushSubscribed && (
                    <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      Live
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Receive native lock-screen & desktop push alerts when your order is confirmed, cooking, and out for delivery.
                </p>
                {pushPermission === "denied" && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1.5">
                    <AlertCircle size={13} /> Notifications are blocked in your browser. Tap the padlock icon next to the URL to enable.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {isPushSubscribed && (
                  <button
                    type="button"
                    onClick={sendTestPush}
                    disabled={isPushLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] hover:border-[var(--brand-accent)] text-[var(--text-main)] text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <Send size={13} className="text-[var(--brand-accent)]" />
                    <span>Test Notification</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isPushLoading || !isPushSupported}
                  onClick={() => {
                    if (isPushSubscribed) {
                      unsubscribePush();
                    } else {
                      subscribePush();
                    }
                  }}
                  className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer disabled:opacity-50 ${
                    isPushSubscribed ? "bg-[var(--brand-accent)]" : "bg-[var(--bg-sub)] border border-[var(--border-color)]"
                  }`}
                  aria-label="Toggle Web Push Notifications"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      isPushSubscribed ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Special Kitchen Deals Promo Toggle */}
            <div className="pt-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  Special Kitchen Deals & Promo Vouchers
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Get notified when seasonal discount vouchers and kitchen specials go live.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleOffers(!offerAlerts)}
                className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${
                  offerAlerts ? "bg-[var(--brand-accent)]" : "bg-[var(--bg-sub)] border border-[var(--border-color)]"
                }`}
                aria-label="Toggle Promotional Alerts"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    offerAlerts ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* ── SECTION D: APP & INSTALLATION ──────────────────────────── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <Smartphone size={20} className="text-[var(--brand-accent)]" />
              App Installation & Offline Support
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Install Pet Protocols directly to your home screen or desktop for fast ordering and offline shell resilience.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
            <div className="space-y-1">
              <div className="text-sm font-bold text-[var(--text-main)]">
                Pet Protocols PWA
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Standalone mobile experience, instant navigation, and zero app store downloads required.
              </p>
            </div>
            <div>
              <PWAInstallButton variant="settings" />
            </div>
          </div>
        </section>

        {/* Info card */}
        <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
          <span>
            Preferences are saved locally to your device and maintained across sessions and navigation.
          </span>
        </div>
      </div>
    </main>
  );
}
