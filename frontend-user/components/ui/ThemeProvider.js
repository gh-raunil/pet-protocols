"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";

export const THEME_KEY = "pet_protocols_customer_theme";
export const PALETTE_KEY = "pet_protocols_customer_palette";
const SHARED_KEY = "pet_protocols_theme";

export const PALETTES = [
  {
    id: "fresh-orange",
    name: "Fresh Orange",
    description: "Warm cream, burnt orange, and deep charcoal",
    swatches: ["#141518", "#20232A", "#EA580C", "#F97316", "#FAF7F2"],
    light: {
      accent: "#ea580c",
      accentHover: "#c2410c",
      bgMain: "#FAF7F2",
      bgSub: "#F3EFE8",
      bgCard: "#FFFFFF",
      bgCardHover: "#F7F3EC",
      borderColor: "rgba(44, 34, 25, 0.12)",
      textMain: "#1C1917",
      textMuted: "#6B645C",
    },
    dark: {
      accent: "#f97316",
      accentHover: "#ea580c",
      bgMain: "#141518",
      bgSub: "#1B1D22",
      bgCard: "#20232A",
      bgCardHover: "#282C35",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textMain: "#F8FAFC",
      textMuted: "#94A3B8",
    },
    preview: {
      primary: "#ea580c",
      bg: "#FAF7F2",
      card: "#20232A",
      accent: "#f97316",
    },
  },
  {
    id: "classic",
    name: "Classic",
    description: "Crisp white, deep charcoal, and orange accent",
    swatches: ["#121214", "#1E1E24", "#71717A", "#EA580C", "#FFFFFF"],
    light: {
      accent: "#f97316",
      accentHover: "#ea580c",
      bgMain: "#FFFFFF",
      bgSub: "#F4F4F6",
      bgCard: "#FFFFFF",
      bgCardHover: "#F8F8FA",
      borderColor: "rgba(0, 0, 0, 0.1)",
      textMain: "#18181B",
      textMuted: "#71717A",
    },
    dark: {
      accent: "#f97316",
      accentHover: "#ea580c",
      bgMain: "#121214",
      bgSub: "#18181C",
      bgCard: "#1E1E24",
      bgCardHover: "#26262E",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textMain: "#F4F4F5",
      textMuted: "#A1A1AA",
    },
    preview: {
      primary: "#f97316",
      bg: "#FFFFFF",
      card: "#1E1E24",
      accent: "#ea580c",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Soft cream, deep green, and warm neutral",
    swatches: ["#121714", "#1E2922", "#15803D", "#16A34A", "#22C55E", "#F5F7F4"],
    light: {
      accent: "#16a34a",
      accentHover: "#15803d",
      bgMain: "#F5F7F4",
      bgSub: "#EBF0EB",
      bgCard: "#FFFFFF",
      bgCardHover: "#F0F5F0",
      borderColor: "rgba(24, 45, 30, 0.12)",
      textMain: "#142017",
      textMuted: "#5F7063",
    },
    dark: {
      accent: "#22c55e",
      accentHover: "#16a34a",
      bgMain: "#121714",
      bgSub: "#18201A",
      bgCard: "#1E2922",
      bgCardHover: "#26352C",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textMain: "#F1F5F2",
      textMuted: "#92A898",
    },
    preview: {
      primary: "#16a34a",
      bg: "#F5F7F4",
      card: "#1E2922",
      accent: "#22c55e",
    },
  },
  {
    id: "berry",
    name: "Berry",
    description: "Soft neutral, rich berry red, and charcoal",
    swatches: ["#171214", "#291E24", "#BE123C", "#E11D48", "#FB7185", "#FAF6F7"],
    light: {
      accent: "#e11d48",
      accentHover: "#be123c",
      bgMain: "#FAF6F7",
      bgSub: "#F4ECEF",
      bgCard: "#FFFFFF",
      bgCardHover: "#F7EEF1",
      borderColor: "rgba(60, 20, 35, 0.12)",
      textMain: "#221318",
      textMuted: "#7A656C",
    },
    dark: {
      accent: "#fb7185",
      accentHover: "#f43f5e",
      bgMain: "#171214",
      bgSub: "#20191D",
      bgCard: "#291E24",
      bgCardHover: "#35272F",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textMain: "#FDF2F4",
      textMuted: "#A8939B",
    },
    preview: {
      primary: "#e11d48",
      bg: "#FAF6F7",
      card: "#291E24",
      accent: "#fb7185",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Soft blue, deep navy, and crisp white",
    swatches: ["#0F151C", "#1D2735", "#0369A1", "#0284C7", "#38BDF8", "#F0F6FA"],
    light: {
      accent: "#0284c7",
      accentHover: "#0369a1",
      bgMain: "#F0F6FA",
      bgSub: "#E3EEF6",
      bgCard: "#FFFFFF",
      bgCardHover: "#EBF3F8",
      borderColor: "rgba(15, 40, 65, 0.12)",
      textMain: "#0F172A",
      textMuted: "#627488",
    },
    dark: {
      accent: "#38bdf8",
      accentHover: "#0ea5e9",
      bgMain: "#0F151C",
      bgSub: "#161E28",
      bgCard: "#1D2735",
      bgCardHover: "#253346",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textMain: "#F0F6FA",
      textMuted: "#8BA0B5",
    },
    preview: {
      primary: "#0284c7",
      bg: "#F0F6FA",
      card: "#1D2735",
      accent: "#38bdf8",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm cream, coral rose, and deep espresso brown",
    swatches: ["#171311", "#2C2320", "#BE123C", "#F43F5E", "#FFA586", "#FAF5EF"],
    light: {
      accent: "#f43f5e",
      accentHover: "#e11d48",
      bgMain: "#FAF5EF",
      bgSub: "#F2EAE0",
      bgCard: "#FFFFFF",
      bgCardHover: "#F6EEE4",
      borderColor: "rgba(50, 30, 20, 0.12)",
      textMain: "#241814",
      textMuted: "#7D6B63",
    },
    dark: {
      accent: "#fb7185",
      accentHover: "#f43f5e",
      bgMain: "#171311",
      bgSub: "#221B18",
      bgCard: "#2C2320",
      bgCardHover: "#382D29",
      borderColor: "rgba(255, 255, 255, 0.1)",
      textMain: "#FAF4F0",
      textMuted: "#AA9A93",
    },
    preview: {
      primary: "#f43f5e",
      bg: "#FAF5EF",
      card: "#2C2320",
      accent: "#fb7185",
    },
  },
  {
    id: "nordic-blue",
    name: "Nordic Blue",
    description: "Ice blue, steel cerulean, and royal midnight navy",
    isPremium: true,
    swatches: ["#021024", "#052659", "#3E6692", "#5483B3", "#7DA0CA", "#C1E8FF"],
    light: {
      accent: "#0284C7",
      accentHover: "#0369A1",
      bgMain: "#F8FAFC",
      bgSub: "#F1F5F9",
      bgCard: "#FFFFFF",
      bgCardHover: "#F8FAFC",
      borderColor: "rgba(15, 23, 42, 0.08)",
      textMain: "#0F172A",
      textMuted: "#64748B",
    },
    dark: {
      accent: "#38BDF8",
      accentHover: "#0EA5E9",
      bgMain: "#0B0F17",
      bgSub: "#111726",
      bgCard: "#161F33",
      bgCardHover: "#1E2B45",
      borderColor: "rgba(255, 255, 255, 0.09)",
      textMain: "#F8FAFC",
      textMuted: "#94A3B8",
    },
    preview: {
      primary: "#0284C7",
      bg: "#F1F5F9",
      card: "#161F33",
      accent: "#38BDF8",
    },
  },
  {
    id: "holst-teal",
    name: "Holst Teal",
    description: "Soft mint cream, seafoam cyan, and deep spruce night",
    isPremium: true,
    swatches: ["#04222B", "#0A3D4A", "#10606F", "#1D8B94", "#4FB8B4", "#98D8D0", "#E2F4F0"],
    light: {
      accent: "#0D9488",
      accentHover: "#0F766E",
      bgMain: "#F6FAF9",
      bgSub: "#ECF5F3",
      bgCard: "#FFFFFF",
      bgCardHover: "#F4FAF8",
      borderColor: "rgba(13, 148, 136, 0.1)",
      textMain: "#0F172A",
      textMuted: "#64748B",
    },
    dark: {
      accent: "#2DD4BF",
      accentHover: "#14B8A6",
      bgMain: "#0A0F11",
      bgSub: "#10191C",
      bgCard: "#152226",
      bgCardHover: "#1B2D33",
      borderColor: "rgba(255, 255, 255, 0.09)",
      textMain: "#F8FAFC",
      textMuted: "#94A3B8",
    },
    preview: {
      primary: "#0D9488",
      bg: "#ECF5F3",
      card: "#152226",
      accent: "#2DD4BF",
    },
  },
  {
    id: "mocha-cream",
    name: "Mocha Cream",
    description: "Warm vanilla cream, cocoa almond, and dark roasted espresso",
    isPremium: true,
    swatches: ["#291C0E", "#6E473B", "#A78D78", "#BEB5A9", "#E1D4C2"],
    light: {
      accent: "#8C5338",
      accentHover: "#6E3F2A",
      bgMain: "#FAF7F4",
      bgSub: "#F3ECE4",
      bgCard: "#FFFFFF",
      bgCardHover: "#FAF5EE",
      borderColor: "rgba(41, 28, 14, 0.08)",
      textMain: "#1C1917",
      textMuted: "#78716C",
    },
    dark: {
      accent: "#E0A96D",
      accentHover: "#C68B50",
      bgMain: "#0F0E0D",
      bgSub: "#181513",
      bgCard: "#221D1A",
      bgCardHover: "#2C2622",
      borderColor: "rgba(255, 255, 255, 0.09)",
      textMain: "#FAF7F5",
      textMuted: "#A8A29E",
    },
    preview: {
      primary: "#8C5338",
      bg: "#F3ECE4",
      card: "#221D1A",
      accent: "#E0A96D",
    },
  },
  {
    id: "crimson-dusk",
    name: "Crimson Dusk",
    description: "Sunset coral, vivid ruby crimson, and midnight twilight",
    isPremium: true,
    swatches: ["#161E2F", "#242F49", "#384358", "#FFA586", "#B51A2B", "#541A2E"],
    light: {
      accent: "#E11D48",
      accentHover: "#BE123C",
      bgMain: "#FAFAFA",
      bgSub: "#F4F4F5",
      bgCard: "#FFFFFF",
      bgCardHover: "#F9F9FB",
      borderColor: "rgba(0, 0, 0, 0.08)",
      textMain: "#18181B",
      textMuted: "#71717A",
    },
    dark: {
      accent: "#FB7185",
      accentHover: "#F43F5E",
      bgMain: "#0F0D12",
      bgSub: "#18141F",
      bgCard: "#221C2B",
      bgCardHover: "#2D253A",
      borderColor: "rgba(255, 255, 255, 0.09)",
      textMain: "#FDF2F4",
      textMuted: "#A1A1AA",
    },
    preview: {
      primary: "#E11D48",
      bg: "#F4F4F5",
      card: "#221C2B",
      accent: "#FB7185",
    },
  },
  {
    id: "emerald-abyss",
    name: "Emerald Abyss",
    description: "Steel sky mist, luminous cyan teal, and deep emerald abyss",
    isPremium: true,
    swatches: ["#031716", "#032F30", "#0A7075", "#0C969C", "#6BA3BE", "#274D60"],
    light: {
      accent: "#059669",
      accentHover: "#047857",
      bgMain: "#F7FAF8",
      bgSub: "#EDF4F0",
      bgCard: "#FFFFFF",
      bgCardHover: "#F2F8F5",
      borderColor: "rgba(5, 150, 105, 0.1)",
      textMain: "#0F172A",
      textMuted: "#64748B",
    },
    dark: {
      accent: "#10B981",
      accentHover: "#059669",
      bgMain: "#080F0D",
      bgSub: "#0E1A17",
      bgCard: "#132521",
      bgCardHover: "#1A322C",
      borderColor: "rgba(255, 255, 255, 0.09)",
      textMain: "#F1FDF6",
      textMuted: "#94A3B8",
    },
    preview: {
      primary: "#059669",
      bg: "#EDF4F0",
      card: "#132521",
      accent: "#10B981",
    },
  },
];

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const v = "; " + document.cookie;
  const parts = v.split("; " + name + "=");
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
  return null;
}

function setCookie(name, value) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  const baseCookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = baseCookie;
}

export function applyThemeVariables(resolvedTheme, paletteId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const foundPalette = PALETTES.find((p) => p.id === paletteId) || PALETTES[0];
  const tokens = resolvedTheme === "light" ? foundPalette.light : foundPalette.dark;

  root.style.setProperty("--brand-accent", tokens.accent);
  root.style.setProperty("--brand-accent-hover", tokens.accentHover);
  root.style.setProperty("--bg-main", tokens.bgMain);
  root.style.setProperty("--bg-sub", tokens.bgSub);
  root.style.setProperty("--bg-card", tokens.bgCard);
  root.style.setProperty("--bg-card-hover", tokens.bgCardHover);
  root.style.setProperty("--border-color", tokens.borderColor);
  root.style.setProperty("--text-main", tokens.textMain);
  root.style.setProperty("--text-muted", tokens.textMuted);
  root.style.setProperty("--color-success", "#10B981");
  root.style.setProperty("--color-warning", "#F59E0B");
  root.style.setProperty("--color-error", "#EF4444");

  if (resolvedTheme === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
    root.classList.remove("light");
  }
}

export function ThemeScript() {
  const scriptContent = `
(function() {
  try {
    function getCookie(name) {
      var v = "; " + document.cookie;
      var parts = v.split("; " + name + "=");
      if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
      return null;
    }

    var theme = getCookie("${THEME_KEY}") ||
                getCookie("${SHARED_KEY}") ||
                localStorage.getItem("${THEME_KEY}") ||
                localStorage.getItem("${SHARED_KEY}") ||
                "dark";

    var palette = getCookie("${PALETTE_KEY}") ||
                  localStorage.getItem("${PALETTE_KEY}") ||
                  "fresh-orange";

    var resolved = theme;
    if (theme === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    var palettes = {
      "fresh-orange": {
        light: { accent: "#ea580c", accentHover: "#c2410c", bgMain: "#FAF7F2", bgSub: "#F3EFE8", bgCard: "#FFFFFF", bgCardHover: "#F7F3EC", border: "rgba(44,34,25,0.12)", textMain: "#1C1917", textMuted: "#6B645C" },
        dark: { accent: "#f97316", accentHover: "#ea580c", bgMain: "#141518", bgSub: "#1B1D22", bgCard: "#20232A", bgCardHover: "#282C35", border: "rgba(255,255,255,0.1)", textMain: "#F8FAFC", textMuted: "#94A3B8" }
      },
      "classic": {
        light: { accent: "#f97316", accentHover: "#ea580c", bgMain: "#FFFFFF", bgSub: "#F4F4F6", bgCard: "#FFFFFF", bgCardHover: "#F8F8FA", border: "rgba(0,0,0,0.1)", textMain: "#18181B", textMuted: "#71717A" },
        dark: { accent: "#f97316", accentHover: "#ea580c", bgMain: "#121214", bgSub: "#18181C", bgCard: "#1E1E24", bgCardHover: "#26262E", border: "rgba(255,255,255,0.1)", textMain: "#F4F4F5", textMuted: "#A1A1AA" }
      },
      "forest": {
        light: { accent: "#16a34a", accentHover: "#15803d", bgMain: "#F5F7F4", bgSub: "#EBF0EB", bgCard: "#FFFFFF", bgCardHover: "#F0F5F0", border: "rgba(24,45,30,0.12)", textMain: "#142017", textMuted: "#5F7063" },
        dark: { accent: "#22c55e", accentHover: "#16a34a", bgMain: "#121714", bgSub: "#18201A", bgCard: "#1E2922", bgCardHover: "#26352C", border: "rgba(255,255,255,0.1)", textMain: "#F1F5F2", textMuted: "#92A898" }
      },
      "berry": {
        light: { accent: "#e11d48", accentHover: "#be123c", bgMain: "#FAF6F7", bgSub: "#F4ECEF", bgCard: "#FFFFFF", bgCardHover: "#F7EEF1", border: "rgba(60,20,35,0.12)", textMain: "#221318", textMuted: "#7A656C" },
        dark: { accent: "#fb7185", accentHover: "#f43f5e", bgMain: "#171214", bgSub: "#20191D", bgCard: "#291E24", bgCardHover: "#35272F", border: "rgba(255,255,255,0.1)", textMain: "#FDF2F4", textMuted: "#A8939B" }
      },
      "ocean": {
        light: { accent: "#0284c7", accentHover: "#0369a1", bgMain: "#F0F6FA", bgSub: "#E3EEF6", bgCard: "#FFFFFF", bgCardHover: "#EBF3F8", border: "rgba(15,40,65,0.12)", textMain: "#0F172A", textMuted: "#627488" },
        dark: { accent: "#38bdf8", accentHover: "#0ea5e9", bgMain: "#0F151C", bgSub: "#161E28", bgCard: "#1D2735", bgCardHover: "#253346", border: "rgba(255,255,255,0.1)", textMain: "#F0F6FA", textMuted: "#8BA0B5" }
      },
      "sunset": {
        light: { accent: "#f43f5e", accentHover: "#e11d48", bgMain: "#FAF5EF", bgSub: "#F2EAE0", bgCard: "#FFFFFF", bgCardHover: "#F6EEE4", border: "rgba(50,30,20,0.12)", textMain: "#241814", textMuted: "#7D6B63" },
        dark: { accent: "#fb7185", accentHover: "#f43f5e", bgMain: "#171311", bgSub: "#221B18", bgCard: "#2C2320", bgCardHover: "#382D29", border: "rgba(255,255,255,0.1)", textMain: "#FAF4F0", textMuted: "#AA9A93" }
      },
      "nordic-blue": {
        light: { accent: "#0284C7", accentHover: "#0369A1", bgMain: "#F8FAFC", bgSub: "#F1F5F9", bgCard: "#FFFFFF", bgCardHover: "#F8FAFC", border: "rgba(15,23,42,0.08)", textMain: "#0F172A", textMuted: "#64748B" },
        dark: { accent: "#38BDF8", accentHover: "#0EA5E9", bgMain: "#0B0F17", bgSub: "#111726", bgCard: "#161F33", bgCardHover: "#1E2B45", border: "rgba(255,255,255,0.09)", textMain: "#F8FAFC", textMuted: "#94A3B8" }
      },
      "holst-teal": {
        light: { accent: "#0D9488", accentHover: "#0F766E", bgMain: "#F6FAF9", bgSub: "#ECF5F3", bgCard: "#FFFFFF", bgCardHover: "#F4FAF8", border: "rgba(13,148,136,0.1)", textMain: "#0F172A", textMuted: "#64748B" },
        dark: { accent: "#2DD4BF", accentHover: "#14B8A6", bgMain: "#0A0F11", bgSub: "#10191C", bgCard: "#152226", bgCardHover: "#1B2D33", border: "rgba(255,255,255,0.09)", textMain: "#F8FAFC", textMuted: "#94A3B8" }
      },
      "mocha-cream": {
        light: { accent: "#8C5338", accentHover: "#6E3F2A", bgMain: "#FAF7F4", bgSub: "#F3ECE4", bgCard: "#FFFFFF", bgCardHover: "#FAF5EE", border: "rgba(41,28,14,0.08)", textMain: "#1C1917", textMuted: "#78716C" },
        dark: { accent: "#E0A96D", accentHover: "#C68B50", bgMain: "#0F0E0D", bgSub: "#181513", bgCard: "#221D1A", bgCardHover: "#2C2622", border: "rgba(255,255,255,0.09)", textMain: "#FAF7F5", textMuted: "#A8A29E" }
      },
      "crimson-dusk": {
        light: { accent: "#E11D48", accentHover: "#BE123C", bgMain: "#FAFAFA", bgSub: "#F4F4F5", bgCard: "#FFFFFF", bgCardHover: "#F9F9FB", border: "rgba(0,0,0,0.08)", textMain: "#18181B", textMuted: "#71717A" },
        dark: { accent: "#FB7185", accentHover: "#F43F5E", bgMain: "#0F0D12", bgSub: "#18141F", bgCard: "#221C2B", bgCardHover: "#2D253A", border: "rgba(255,255,255,0.09)", textMain: "#FDF2F4", textMuted: "#A1A1AA" }
      },
      "emerald-abyss": {
        light: { accent: "#059669", accentHover: "#047857", bgMain: "#F7FAF8", bgSub: "#EDF4F0", bgCard: "#FFFFFF", bgCardHover: "#F2F8F5", border: "rgba(5,150,105,0.1)", textMain: "#0F172A", textMuted: "#64748B" },
        dark: { accent: "#10B981", accentHover: "#059669", bgMain: "#080F0D", bgSub: "#0E1A17", bgCard: "#132521", bgCardHover: "#1A322C", border: "rgba(255,255,255,0.09)", textMain: "#F1FDF6", textMuted: "#94A3B8" }
      }
    };

    var pal = palettes[palette] || palettes["fresh-orange"];
    var t = (resolved === "light") ? pal.light : pal.dark;

    var root = document.documentElement;
    root.style.setProperty("--brand-accent", t.accent);
    root.style.setProperty("--brand-accent-hover", t.accentHover);
    root.style.setProperty("--bg-main", t.bgMain);
    root.style.setProperty("--bg-sub", t.bgSub);
    root.style.setProperty("--bg-card", t.bgCard);
    root.style.setProperty("--bg-card-hover", t.bgCardHover);
    root.style.setProperty("--border-color", t.border);
    root.style.setProperty("--text-main", t.textMain);
    root.style.setProperty("--text-muted", t.textMuted);
    root.style.setProperty("--color-success", "#10B981");
    root.style.setProperty("--color-warning", "#F59E0B");
    root.style.setProperty("--color-error", "#EF4444");

    if (resolved === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  } catch (e) {}
})();
  `;
  return (
    <script
      id="theme-initializer"
      dangerouslySetInnerHTML={{ __html: scriptContent }}
    />
  );
}

const ThemeContext = createContext({
  theme: "dark",
  resolvedTheme: "dark",
  palette: "fresh-orange",
  setTheme: () => {},
  setPalette: () => {},
  toggleTheme: () => {},
  palettes: PALETTES,
  mounted: false,
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");
  const [palette, setPaletteState] = useState("fresh-orange");
  const [resolvedTheme, setResolvedTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme from storage
  useEffect(() => {
    let savedTheme = "dark";
    let savedPalette = "fresh-orange";

    try {
      const cookieTheme = getCookie(THEME_KEY) || getCookie(SHARED_KEY);
      const localTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem(SHARED_KEY);
      if (cookieTheme) savedTheme = cookieTheme;
      else if (localTheme) savedTheme = localTheme;

      const cookiePalette = getCookie(PALETTE_KEY);
      const localPalette = localStorage.getItem(PALETTE_KEY);
      if (cookiePalette) savedPalette = cookiePalette;
      else if (localPalette) savedPalette = localPalette;
    } catch (e) {}

    let resTheme = savedTheme;
    if (savedTheme === "system") {
      resTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    setThemeState(savedTheme);
    setPaletteState(savedPalette);
    setResolvedTheme(resTheme);
    applyThemeVariables(resTheme, savedPalette);
    setMounted(true);

    // Listen to OS system color-scheme changes if 'system'
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e) => {
      if (theme === "system") {
        const nextResolved = e.matches ? "dark" : "light";
        setResolvedTheme(nextResolved);
        applyThemeVariables(nextResolved, palette);
      }
    };
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, []);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    setCookie(THEME_KEY, newTheme);
    setCookie(SHARED_KEY, newTheme);
    try {
      localStorage.setItem(THEME_KEY, newTheme);
      localStorage.setItem(SHARED_KEY, newTheme);
    } catch (e) {}

    let res = newTheme;
    if (newTheme === "system") {
      res = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    setResolvedTheme(res);
    applyThemeVariables(res, palette);
  };

  const setPalette = (newPalette) => {
    setPaletteState(newPalette);
    setCookie(PALETTE_KEY, newPalette);
    try {
      localStorage.setItem(PALETTE_KEY, newPalette);
    } catch (e) {}
    applyThemeVariables(resolvedTheme, newPalette);
  };

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        palette,
        setTheme,
        setPalette,
        toggleTheme,
        palettes: PALETTES,
        mounted,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
