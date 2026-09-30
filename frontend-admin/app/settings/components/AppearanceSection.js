"use client";

import { useTheme } from "@/components/ui/ThemeProvider";
import { Sun, Moon, Laptop, Palette, Megaphone, Check } from "lucide-react";

const COLOR_PRESETS = [
  { name: "Pet Protocols Orange", hex: "#f97316" },
  { name: "Royal Amber", hex: "#d97706" },
  { name: "Ocean Emerald", hex: "#10b981" },
  { name: "Electric Cyan", hex: "#06b6d4" },
  { name: "Cobalt Blue", hex: "#3b82f6" },
  { name: "Petal Rose", hex: "#ec4899" },
  { name: "Warm Violet", hex: "#8b5cf6" },
];

export default function AppearanceSection({ form, onChange, onSave, saving }) {
  const { theme, themeMode, setThemeMode, accentColor, setAccentColor } = useTheme();

  const appearance = form.appearance || {
    primaryColor: accentColor || "#f97316",
    announcement: "",
  };

  function updateAppearance(field, val) {
    onChange("appearance", { ...appearance, [field]: val });
    if (field === "primaryColor") {
      setAccentColor(val);
    }
  }

  const themes = [
    {
      id: "light",
      label: "Light",
      desc: "A bright dashboard",
      icon: Sun,
      iconClass: "text-amber-500",
      previewBg: "bg-zinc-100 border-zinc-200",
    },
    {
      id: "dark",
      label: "Dark",
      desc: "A dark dashboard",
      icon: Moon,
      iconClass: "text-indigo-400",
      previewBg: "bg-zinc-900 border-zinc-800",
    },
    {
      id: "system",
      label: "System",
      desc: "Use your device setting",
      icon: Laptop,
      iconClass: "text-blue-500",
      previewBg: "bg-gradient-to-r from-zinc-100 to-zinc-900 border-zinc-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Appearance</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Choose how your restaurant dashboard looks.
        </p>
      </div>

      {/* 1. VISUAL THEME SELECTOR */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Dashboard Theme</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Instantly switch the portal appearance</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {themes.map((t) => {
            const Icon = t.icon;
            const isSelected = themeMode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setThemeMode(t.id);
                  updateAppearance("theme", t.id);
                }}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? "bg-orange-500/10 dark:bg-orange-500/20 border-orange-500 shadow-sm ring-1 ring-orange-500"
                    : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${t.iconClass}`} />
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">{t.label}</span>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-xs shadow-orange-500/50" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. BRAND COLOR */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Brand Accent Color</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Buttons and highlight color on your storefront</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2.5">
            Choose Accent Color ({appearance.primaryColor || "#f97316"})
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            {COLOR_PRESETS.map((color) => {
              const isSelected =
                (appearance.primaryColor || "#f97316").toLowerCase() === color.hex.toLowerCase();
              return (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => updateAppearance("primaryColor", color.hex)}
                  style={{ backgroundColor: color.hex }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform hover:scale-105 cursor-pointer shadow-xs ${
                    isSelected ? "ring-2 ring-[var(--brand-accent)] ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 scale-105" : ""
                  }`}
                  title={color.name}
                >
                  {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                </button>
              );
            })}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="color"
                value={appearance.primaryColor || "#f97316"}
                onChange={(e) => updateAppearance("primaryColor", e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">Custom</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. STOREFRONT ANNOUNCEMENT */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Announcement Banner</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Show a top greeting or special offer banner to customers</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Banner Message
          </label>
          <input
            type="text"
            value={appearance.announcement || ""}
            onChange={(e) => updateAppearance("announcement", e.target.value)}
            placeholder="e.g. 🎉 Sunday Special: Free pet cookies with every family combo!"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 outline-none"
          />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Leave empty if you do not want to show a banner.</p>
        </div>
      </section>
    </div>
  );
}
