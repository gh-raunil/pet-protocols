"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/components/ui/ThemeProvider";
import SettingsNav from "@/components/settings/SettingsNav";
import {
  Palette,
  Sun,
  Moon,
  Laptop,
  Bell,
  Globe,
  Smartphone,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Clock,
  Layers,
  ArrowUpRight,
} from "lucide-react";

export default function SettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, palette, palettes, mounted } = useTheme();
  const [liveTime, setLiveTime] = useState("");
  const [currentTimezone, setCurrentTimezone] = useState("Asia/Kolkata");

  // Sync tab query param if someone accesses /settings?tab=...
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "palette" || tab === "color-palette") {
      router.replace("/settings/palette");
    } else if (tab === "theme" || tab === "appearance") {
      router.replace("/settings/theme");
    } else if (tab === "notifications") {
      router.replace("/settings/notifications");
    } else if (tab === "timezone" || tab === "time-zone") {
      router.replace("/settings/timezone");
    } else if (tab === "app" || tab === "installation") {
      router.replace("/settings/app");
    }
  }, [searchParams, router]);

  // Read saved timezone from cookie or localStorage for the preview badge
  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|;\s*)customer_tz=([^;]*)/);
      if (match && match[1]) {
        setCurrentTimezone(decodeURIComponent(match[1]));
      } else {
        const local = localStorage.getItem("pet_protocols_timezone");
        if (local) setCurrentTimezone(local);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Live time ticker for timezone preview card
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-IN", {
          timeZone: currentTimezone,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        setLiveTime(formatter.format(now));
      } catch (e) {
        setLiveTime("");
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [currentTimezone]);

  if (!mounted) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="h-10 w-48 bg-[var(--bg-card)] rounded-2xl animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 bg-[var(--bg-card)] rounded-3xl animate-pulse" />
          <div className="h-44 bg-[var(--bg-card)] rounded-3xl animate-pulse" />
          <div className="h-44 bg-[var(--bg-card)] rounded-3xl animate-pulse" />
          <div className="h-44 bg-[var(--bg-card)] rounded-3xl animate-pulse" />
        </div>
      </main>
    );
  }

  const activePaletteObj = palettes.find((p) => p.id === palette) || palettes[0];

  const ThemeIcon = theme === "dark" ? Moon : theme === "system" ? Laptop : Sun;
  const themeLabel = theme === "dark" ? "Dark Mode" : theme === "system" ? "System Synced" : "Light Mode";

  const settingsCards = [
    {
      id: "palette",
      title: "Color Palette",
      subtitle: "Select a curated palette to customize accents, buttons, highlights, and borders.",
      href: "/settings/palette",
      icon: Palette,
      badge: (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30 text-xs font-bold">
          <Sparkles size={11} />
          {activePaletteObj?.name}
          {activePaletteObj?.isPremium && " (PRO)"}
        </span>
      ),
      preview: (
        <div className="flex items-center gap-1.5 pt-1">
          {activePaletteObj?.swatches?.map((hex, i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-full border border-black/10 shadow-xs transition-transform hover:scale-110"
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
          <span className="text-[11px] text-[var(--text-muted)] ml-2">11 palettes available</span>
        </div>
      ),
    },
    {
      id: "theme",
      title: "Appearance Mode",
      subtitle: "Choose between light, dark, or synchronized with your system OS appearance.",
      href: "/settings/theme",
      icon: ThemeIcon,
      badge: (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-xs font-bold capitalize">
          <ThemeIcon size={12} className="text-[var(--brand-accent)]" />
          {themeLabel}
        </span>
      ),
      preview: (
        <p className="text-xs text-[var(--text-muted)]">
          {theme === "light" && "Warm cream and crisp off-white interface with dark typography."}
          {theme === "dark" && "Deep charcoal and midnight surface colors with soft white text."}
          {theme === "system" && "Dynamically matches your device's daytime and nighttime schedule."}
        </p>
      ),
    },
    {
      id: "notifications",
      title: "Notification Preferences",
      subtitle: "Manage live lock-screen push alerts, order milestone notifications, and active devices.",
      href: "/settings/notifications",
      icon: Bell,
      badge: (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold">
          Push Enabled
        </span>
      ),
      preview: (
        <p className="text-xs text-[var(--text-muted)]">
          Order placed, cooking prep, courier delivery, and emergency cancellations.
        </p>
      ),
    },
    {
      id: "timezone",
      title: "Time Zone & Operational Clock",
      subtitle: "Control which time zone is used to compute kitchen opening hours and delivery timestamps.",
      href: "/settings/timezone",
      icon: Globe,
      badge: (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-500 text-xs font-bold">
          <Clock size={11} />
          {liveTime ? `${liveTime}` : currentTimezone}
        </span>
      ),
      preview: (
        <p className="text-xs text-[var(--text-muted)]">
          Active: <strong className="text-[var(--text-main)]">{currentTimezone}</strong> • Synchronized
        </p>
      ),
    },
    {
      id: "app",
      title: "App & Installation",
      subtitle: "Install पेट Protocols directly to your home screen or desktop for fast ordering and offline support.",
      href: "/settings/app",
      icon: Smartphone,
      badge: (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-xs font-bold">
          PWA Ready
        </span>
      ),
      preview: (
        <p className="text-xs text-[var(--text-muted)]">
          Standalone shell, zero app store downloads, offline caching.
        </p>
      ),
    },
  ];

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-[var(--text-main)] transition-colors">
      <SettingsNav
        activeKey="overview"
        title="Settings"
        subtitle="Manage your appearance, notifications, operational time zone, and app preferences across dedicated views."
      />

      <div className="space-y-6">
        {/* ── SETTINGS CATEGORIES GRID ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settingsCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.id}
                href={card.href}
                className="group p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm hover:shadow-xl hover:border-[var(--brand-accent)]/40 transition flex flex-col justify-between cursor-pointer active:scale-99 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:outline-none"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] group-hover:bg-[var(--brand-accent)] group-hover:text-white transition-colors flex items-center justify-center text-[var(--brand-accent)] shadow-xs">
                      <Icon size={22} />
                    </div>
                    {card.badge}
                  </div>

                  <h2 className="text-base sm:text-lg font-black text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition-colors flex items-center gap-1.5">
                    {card.title}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                    {card.subtitle}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-[var(--border-color)] flex items-center justify-between">
                  <div className="flex-1">{card.preview}</div>
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-sub)] group-hover:bg-[var(--brand-accent)] group-hover:text-white text-[var(--text-muted)] flex items-center justify-center transition-all ml-3 shrink-0">
                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── SECURITY & LOCAL STORAGE GUARANTEE ───────────────────────── */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center gap-3.5 text-xs text-[var(--text-muted)] shadow-xs">
          <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
          <span>
            Preferences and customizations are saved securely on your device and applied instantly across all pages and sessions.
          </span>
        </div>
      </div>
    </main>
  );
}
