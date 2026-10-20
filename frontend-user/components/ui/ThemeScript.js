import React from "react";

const THEME_KEY = "pet_protocols_customer_theme";
const PALETTE_KEY = "pet_protocols_customer_palette";
const SHARED_KEY = "pet_protocols_theme";

/**
 * Server Component: Inlines the theme and palette initialization script directly
 * into the initial HTML head before paint to eliminate Flash of Unstyled Content (FOUC).
 *
 * Keeping this component outside of 'use client' files ensures React 19 does not
 * warn about script tags inside client-rendered components.
 */
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
                "light";

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

export default ThemeScript;
