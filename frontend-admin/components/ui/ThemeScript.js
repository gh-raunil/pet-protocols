import React from "react";

const STORAGE_KEY = "pet_protocols_admin_theme";
const SHARED_KEY = "pet_protocols_theme";
const ACCENT_STORAGE_KEY = "pet_protocols_accent";

/**
 * Server Component: Inlines the theme and accent initialization script
 * directly into the head before initial render to prevent FOUC.
 * Kept outside 'use client' so React 19 does not log client script warnings.
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
    var mode = getCookie("${STORAGE_KEY}") ||
               getCookie("${SHARED_KEY}") ||
               localStorage.getItem("${STORAGE_KEY}") ||
               localStorage.getItem("${SHARED_KEY}") ||
               "dark";
    var resolvedTheme = mode;
    if (mode === "system") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    if (resolvedTheme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }

    var accent = getCookie("${ACCENT_STORAGE_KEY}") ||
                 localStorage.getItem("${ACCENT_STORAGE_KEY}") ||
                 "#f97316";
    if (accent) {
      document.documentElement.style.setProperty("--brand-accent", accent);
    }
  } catch (e) {}
})();
  `;

  return (
    <script
      id="admin-theme-initializer"
      dangerouslySetInnerHTML={{ __html: scriptContent }}
    />
  );
}

export default ThemeScript;
