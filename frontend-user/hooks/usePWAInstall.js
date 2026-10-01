"use client";

import { useState, useEffect } from "react";

let deferredPrompt = null;
const listeners = new Set();

function emitChange() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e;
    emitChange();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emitChange();
  });
}

export function usePWAInstall() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleChange = () => setTick((t) => t + 1);
    listeners.add(handleChange);
    return () => listeners.delete(handleChange);
  }, []);

  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standaloneCheck =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://");

    setIsStandalone(Boolean(standaloneCheck));

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) && !window.MSStream && !standaloneCheck;
    setIsIOS(Boolean(isIOSDevice));
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) {
      return { outcome: "unavailable" };
    }
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        deferredPrompt = null;
        emitChange();
      }
      return choiceResult;
    } catch (err) {
      console.warn("[PWA] Prompt error:", err);
      return { outcome: "dismissed" };
    }
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled: isStandalone,
    isIOS,
    triggerInstall,
  };
}
