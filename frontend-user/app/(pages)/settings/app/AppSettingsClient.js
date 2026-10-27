"use client";

import React from "react";
import SettingsNav from "@/components/settings/SettingsNav";
import PWAInstallButton from "@/components/pwa/PWAInstallButton";
import {
  Smartphone,
  WifiOff,
  Zap,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Download,
} from "lucide-react";

export default function AppSettingsClient() {
  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-[var(--text-main)] transition-colors">
      <SettingsNav
        activeKey="app"
        title="App & Offline Support"
        subtitle="Install पेट Protocols directly to your home screen or desktop for fast ordering and offline shell resilience."
      />

      <div className="space-y-8">
        {/* ── INSTALL HERO CARD ─────────────────────────────────────── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone size={20} className="text-[var(--brand-accent)]" />
              <h2 className="text-lg font-extrabold text-[var(--text-main)]">
                Progressive Web App (PWA)
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Enjoy a fast, app-like experience without going through the Apple App Store or Google Play Store.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)]">
            <div className="space-y-1">
              <div className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                पेट Protocols Standalone Shell
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  Ready
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] max-w-md">
                Fast boot times, responsive animations, and instant navigation cached on your device.
              </p>
            </div>
            <div>
              <PWAInstallButton variant="settings" />
            </div>
          </div>
        </section>

        {/* ── FEATURE BREAKDOWN CARDS ───────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center">
              <Zap size={18} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
              Instant Startup
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Bypasses browser URL bars and tabs for a distraction-free, native fullscreen food ordering interface.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <WifiOff size={18} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
              Offline Shell Resilience
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Menu pages, cart contents, and recent order receipts remain viewable even if your connectivity drops momentarily.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <HardDrive size={18} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
              Zero Storage Footprint
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Uses lightweight browser cache instead of multi-gigabyte app store binaries. Updates automatically on every launch.
            </p>
          </div>
        </div>

        {/* Info card */}
        <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
          <span>
            PWA service workers are isolated and sandboxed strictly to the पेट Protocols origin with HTTPS security.
          </span>
        </div>
      </div>
    </main>
  );
}
