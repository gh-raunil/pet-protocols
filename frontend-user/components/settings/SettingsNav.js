"use client";

import React from "react";
import Link from "next/link";
import {
  LayoutGrid,
  Palette,
  Sun,
  Bell,
  Globe,
  Smartphone,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

export const SETTINGS_TABS = [
  {
    key: "overview",
    href: "/settings",
    label: "Overview",
    icon: LayoutGrid,
    description: "Settings hub & quick overview",
  },
  {
    key: "palette",
    href: "/settings/palette",
    label: "Color Palette",
    icon: Palette,
    badge: "11 Palettes",
    description: "Curated accents & themes",
  },
  {
    key: "theme",
    href: "/settings/theme",
    label: "Appearance",
    icon: Sun,
    description: "Light, dark, & system modes",
  },
  {
    key: "notifications",
    href: "/settings/notifications",
    label: "Notifications",
    icon: Bell,
    description: "Push alerts & device management",
  },
  {
    key: "timezone",
    href: "/settings/timezone",
    label: "Time Zone",
    icon: Globe,
    description: "Operational clock & region",
  },
  {
    key: "app",
    href: "/settings/app",
    label: "App & Offline",
    icon: Smartphone,
    badge: "PWA",
    description: "PWA install & offline shell",
  },
];

export default function SettingsNav({ activeKey = "overview", title, subtitle }) {
  const activeTab = SETTINGS_TABS.find((t) => t.key === activeKey) || SETTINGS_TABS[0];
  const displayTitle = title || (activeKey === "overview" ? "Settings" : activeTab.label);
  const displaySubtitle =
    subtitle || (activeKey === "overview" ? "Make पेट Protocols feel right for you." : activeTab.description);

  return (
    <div className="mb-8 space-y-6">
      {/* ── BREADCRUMB & BACK LINK ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium">
          <Link
            href="/settings"
            className="hover:text-[var(--brand-accent)] transition flex items-center gap-1.5 text-[var(--text-main)] font-semibold"
          >
            Settings
          </Link>
          {activeKey !== "overview" && (
            <>
              <span className="opacity-40">/</span>
              <span className="text-[var(--brand-accent)] font-bold">{activeTab.label}</span>
            </>
          )}
        </div>

        {activeKey !== "overview" && (
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 hover:bg-[var(--brand-accent)]/20 border border-[var(--brand-accent)]/25 transition cursor-pointer active:scale-95"
          >
            <ArrowLeft size={13} />
            <span>All Settings</span>
          </Link>
        )}
      </div>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 text-[var(--brand-accent)] text-xs font-bold uppercase tracking-wider mb-2.5">
          <Sparkles size={13} /> Personalization & Preferences
        </div>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-[var(--text-main)]">
          {displayTitle}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1.5">
          {displaySubtitle}
        </p>
      </div>

      {/* ── TABS NAVIGATION ────────────────────────────────────────── */}
      <nav
        aria-label="Settings Categories"
        className="p-1.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs overflow-x-auto no-scrollbar"
      >
        <ul className="flex items-center gap-1.5 min-w-max">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeKey;

            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                    isActive
                      ? "bg-[var(--brand-accent)] text-white shadow-sm ring-1 ring-white/10"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)]"
                  }`}
                >
                  <Icon size={15} className={isActive ? "text-white" : "text-[var(--brand-accent)]"} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
