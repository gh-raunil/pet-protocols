"use client";

import React from "react";
import Link from "next/link";
import { useTheme } from "@/components/ui/ThemeProvider";
import { toast } from "@/components/ui/ToastProvider";
import SettingsNav from "@/components/settings/SettingsNav";
import {
  Sun,
  Moon,
  Laptop,
  Check,
  Palette,
  ArrowRight,
  Sparkles,
  Eye,
  Sliders,
} from "lucide-react";

export default function ThemeSettingsClient() {
  const { theme, setTheme, palette, palettes, mounted } = useTheme();

  if (!mounted) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="h-10 w-48 bg-[var(--bg-card)] rounded-2xl animate-pulse mb-8" />
        <div className="h-64 bg-[var(--bg-card)] rounded-3xl animate-pulse" />
      </main>
    );
  }

  const themeOptions = [
    {
      id: "light",
      label: "Light",
      icon: Sun,
      desc: "Warm Cream & Soft Off-White background with crisp dark typography",
      badge: "High Contrast",
    },
    {
      id: "dark",
      label: "Dark",
      icon: Moon,
      desc: "Deep Charcoal & Midnight surfaces with comfortable ambient glow",
      badge: "OLED Friendly",
    },
    {
      id: "system",
      label: "System",
      icon: Laptop,
      desc: "Synchronizes automatically with your operating system day/night schedule",
      badge: "Auto Sync",
    },
  ];

  const activePaletteObj = palettes.find((p) => p.id === palette) || palettes[0];

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-[var(--text-main)] transition-colors">
      <SettingsNav
        activeKey="theme"
        title="Appearance Mode"
        subtitle="Choose between light, dark, or automatic system appearance synchronization."
      />

      <div className="space-y-8">
        {/* ── THEME SELECTION SECTION ───────────────────────────────── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <div className="pb-4 border-b border-[var(--border-color)]">
            <h2 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <Sun size={20} className="text-[var(--brand-accent)]" />
              Interface Theme
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Select your preferred lighting environment. Stored locally on this device.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => {
                    setTheme(opt.id);
                    toast.success(`Appearance set to ${opt.label}`);
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${opt.label} appearance mode`}
                  className={`p-5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer active:scale-98 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:outline-none min-h-[140px] group ${
                    isSelected
                      ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 ring-2 ring-[var(--brand-accent)]/30 shadow-md"
                      : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40 hover:bg-[var(--bg-card)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4 w-full">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-[var(--brand-accent)] text-white shadow-xs"
                          : "bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)] group-hover:text-[var(--text-main)]"
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-[var(--brand-accent)] text-white flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[var(--text-muted)] px-2 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)]">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-1.5">
                      {opt.label} Mode
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── LIVE PREVIEW CANVAS ───────────────────────────────────── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-[var(--brand-accent)]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">
                Live Theme Preview
              </h3>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              Current: <strong className="text-[var(--text-main)] capitalize">{theme}</strong>
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="space-y-1">
              <div className="text-xs font-bold text-[var(--text-main)]">Heading Sample</div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Secondary supporting text in current theme.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[var(--brand-accent)] shadow-xs"
              >
                Accent Action
              </button>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)]">
                Card Pill
              </span>
            </div>

            <div className="text-right sm:text-right text-xs text-[var(--text-muted)]">
              Accent Palette: <strong className="text-[var(--brand-accent)]">{activePaletteObj.name}</strong>
            </div>
          </div>
        </section>

        {/* ── CROSS-LINK TO COLOR PALETTES ──────────────────────────── */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              <Palette size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--text-main)]">
                Looking for Color Palettes?
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Pair your {theme} mode with one of 11 handcrafted accent palettes like Nordic Blue, Holst Teal, or Sunset.
              </p>
            </div>
          </div>

          <Link
            href="/settings/palette"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--brand-accent)] hover:brightness-105 shadow-xs transition shrink-0 active:scale-95"
          >
            <span>Explore 11 Palettes</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </main>
  );
}
