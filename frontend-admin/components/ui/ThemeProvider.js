"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "pet_protocols_admin_theme";
const SHARED_KEY = "pet_protocols_theme";

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

  // Always set standard host cookie
  document.cookie = baseCookie;

  // Attempt shared root-domain cookie if on a multi-part domain (e.g. *.petprotocols.com)
  try {
    const hostname = window.location.hostname;
    if (
      hostname &&
      hostname !== "localhost" &&
      !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) &&
      hostname.includes(".")
    ) {
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        const rootDomain = parts.slice(-2).join(".");
        document.cookie = `${baseCookie}; domain=.${rootDomain}`;
      }
    }
  } catch (e) {}
}

function getStoredTheme() {
  if (typeof window === "undefined") return "dark";
  try {
    // 1. Check cookies (portal-specific or shared domain)
    const portalCookie = getCookie(STORAGE_KEY);
    if (portalCookie === "light" || portalCookie === "dark") return portalCookie;

    const sharedCookie = getCookie(SHARED_KEY);
    if (sharedCookie === "light" || sharedCookie === "dark") return sharedCookie;

    // 2. Check localStorage
    const localPortal = localStorage.getItem(STORAGE_KEY);
    if (localPortal === "light" || localPortal === "dark") return localPortal;

    const localShared = localStorage.getItem(SHARED_KEY);
    if (localShared === "light" || localShared === "dark") return localShared;
  } catch (e) {}
  return "dark";
}

const ACCENT_STORAGE_KEY = "pet_protocols_accent";

const ThemeContext = createContext({
  theme: "dark",
  themeMode: "dark",
  accentColor: "#f97316",
  toggleTheme: () => {},
  setThemeMode: () => {},
  setAccentColor: () => {},
  mounted: false,
});

function getSystemTheme() {
  if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
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
      id="theme-initializer"
      dangerouslySetInnerHTML={{ __html: scriptContent }}
    />
  );
}

export function ThemeProvider({ children }) {
  const [themeMode, setMode] = useState("dark");
  const [theme, setTheme] = useState("dark");
  const [accentColor, setAccent] = useState("#f97316");
  const [mounted, setMounted] = useState(false);

  // Apply theme to document
  const applyTheme = (resolvedTheme) => {
    setTheme(resolvedTheme);
    if (resolvedTheme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  };

  const setAccentColor = (newAccent) => {
    if (!newAccent) return;
    setAccent(newAccent);
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--brand-accent", newAccent);
    }
    setCookie(ACCENT_STORAGE_KEY, newAccent);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, newAccent);
    } catch (e) {}
  };

  useEffect(() => {
    let savedMode = "dark";
    let savedAccent = "#f97316";
    try {
      const portalCookie = getCookie(STORAGE_KEY);
      const sharedCookie = getCookie(SHARED_KEY);
      const localPortal = localStorage.getItem(STORAGE_KEY);
      const localShared = localStorage.getItem(SHARED_KEY);
      savedMode = portalCookie || sharedCookie || localPortal || localShared || "dark";

      const accentCookie = getCookie(ACCENT_STORAGE_KEY);
      const localAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
      savedAccent = accentCookie || localAccent || "#f97316";
    } catch (e) {}

    setMode(savedMode);
    const resolved = savedMode === "system" ? getSystemTheme() : (savedMode === "light" ? "light" : "dark");
    applyTheme(resolved);
    setAccentColor(savedAccent);
    setMounted(true);

    // Fetch restaurant's saved appearance from API to sync authentic restaurant accent
    fetch("/api/restaurant/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.restaurant?.appearance?.primaryColor) {
          setAccentColor(data.restaurant.appearance.primaryColor);
        }
      })
      .catch(() => {});

    // Listen to system changes if in system mode
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e) => {
        const currentMode = localStorage.getItem(STORAGE_KEY);
        if (currentMode === "system") {
          applyTheme(e.matches ? "dark" : "light");
        }
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, []);

  const setThemeMode = (newMode) => {
    setMode(newMode);
    setCookie(STORAGE_KEY, newMode);
    setCookie(SHARED_KEY, newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
      localStorage.setItem(SHARED_KEY, newMode);
    } catch (e) {}

    const resolved = newMode === "system" ? getSystemTheme() : (newMode === "light" ? "light" : "dark");
    applyTheme(resolved);
  };

  const toggleTheme = () => {
    const nextMode = theme === "dark" ? "light" : "dark";
    setThemeMode(nextMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, accentColor, toggleTheme, setThemeMode, setAccentColor, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
