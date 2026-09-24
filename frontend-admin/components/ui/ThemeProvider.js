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

const ThemeContext = createContext({
  theme: "dark",
  toggleTheme: () => {},
  mounted: false,
});

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
    var theme = getCookie("${STORAGE_KEY}") ||
                getCookie("${SHARED_KEY}") ||
                localStorage.getItem("${STORAGE_KEY}") ||
                localStorage.getItem("${SHARED_KEY}") ||
                "dark";
    if (theme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
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
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = getStoredTheme();
    setTheme(savedTheme);
    if (savedTheme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);

    // Save to cookies (both portal-specific and shared domain)
    setCookie(STORAGE_KEY, newTheme);
    setCookie(SHARED_KEY, newTheme);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
      localStorage.setItem(SHARED_KEY, newTheme);
    } catch (e) {}

    // Apply class to HTML root
    if (newTheme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
