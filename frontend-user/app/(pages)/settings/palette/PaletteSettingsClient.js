"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/components/ui/ThemeProvider";
import { toast } from "@/components/ui/ToastProvider";
import SettingsNav from "@/components/settings/SettingsNav";
import {
  Palette,
  Sparkles,
  Check,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Layers,
} from "lucide-react";

export default function PaletteSettingsClient() {
  const { palette, setPalette, palettes, mounted, theme } = useTheme();
  const [paletteFilter, setPaletteFilter] = useState("all");

  const filteredPalettes = palettes.filter((p) => {
    if (paletteFilter === "premium") return Boolean(p.isPremium);
    if (paletteFilter === "standard") return !p.isPremium;
    return true;
  });

  const activePaletteObj = palettes.find((p) => p.id === palette) || palettes[0];

  if (!mounted) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="h-10 w-48 bg-[var(--bg-card)] rounded-2xl animate-pulse mb-8" />
        <div className="h-64 bg-[var(--bg-card)] rounded-3xl animate-pulse" />
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-[var(--text-main)] transition-colors">
      <SettingsNav
        activeKey="palette"
        title="Color Palette"
        subtitle="Select a curated palette to customize accents, buttons, highlights, and borders."
      />

      <div className="space-y-8">
        {/* ── ACTIVE PALETTE SHOWCASE / LIVE PREVIEW BANNER ─────────── */}
        <section className="p-5 sm:p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <Layers size={14} className="text-[var(--brand-accent)]" /> Active Accent Theme
                </span>
                {activePaletteObj?.isPremium && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30 flex items-center gap-1">
                    <Sparkles size={10} /> Premium
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
                {activePaletteObj?.name || "Default Palette"}
                {activePaletteObj?.id === "fresh-orange" && (
                  <span className="text-xs font-bold text-[var(--brand-accent)]">(Default)</span>
                )}
              </h2>
              <p className="text-xs text-[var(--text-muted)] max-w-lg">
                {activePaletteObj?.description}
              </p>
            </div>

            {/* Live Interactive Samples in this Palette */}
            <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide mr-1">
                Preview:
              </span>
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[var(--brand-accent)] shadow-xs transition hover:brightness-105 active:scale-95"
              >
                Primary Button
              </button>
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--brand-accent)] bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30">
                Badge
              </span>
              <div className="flex items-center gap-1 pl-1">
                {activePaletteObj?.swatches?.map((hex, i) => (
                  <div
                    key={i}
                    title={hex}
                    className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PALETTE GRID CARD ─────────────────────────────────────── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
            <div>
              <div className="flex items-center gap-2">
                <Palette size={20} className="text-[var(--brand-accent)]" />
                <h3 className="text-lg font-extrabold text-[var(--text-main)]">
                  Available Palettes ({palettes.length})
                </h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Choose a palette that fits your mood or branding. Applied instantly across the shell.
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
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/10 transition border border-[var(--brand-accent)]/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
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

          {/* Palettes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPalettes.map((pal) => {
              const isSelected = palette === pal.id;
              return (
                <button
                  type="button"
                  key={pal.id}
                  onClick={() => {
                    setPalette(pal.id);
                    toast.success(`Applied ${pal.name} palette`);
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${pal.name} color palette`}
                  className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between group active:scale-98 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:outline-none ${
                    isSelected
                      ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 ring-2 ring-[var(--brand-accent)]/30 shadow-md"
                      : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40 hover:bg-[var(--bg-card)]"
                  }`}
                >
                  {/* Visual Swatch Preview - Stacked Capsule Pills */}
                  <div
                    className="p-3 mb-3.5 rounded-xl border border-black/10 shadow-inner relative overflow-hidden flex flex-col gap-1.5 w-full"
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

                  <div className="flex items-center justify-between w-full">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-1.5">
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
                      </h4>
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
                </button>
              );
            })}
          </div>
        </section>

        {/* ── QUICK LINK TO APPEARANCE MODE ────────────────────────── */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
            <div className="text-xs text-[var(--text-muted)]">
              Palettes adjust automatically to both Light and Dark appearance modes.
            </div>
          </div>
          <Link
            href="/settings/theme"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-accent)] hover:underline shrink-0"
          >
            <span>Adjust Appearance Mode</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </main>
  );
}
