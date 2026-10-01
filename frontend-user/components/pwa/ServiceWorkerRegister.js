"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Check for updates periodically
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener("statechange", () => {
              if (
                installingWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New update available, silent ready state
                if (process.env.NODE_ENV === "development") {
                  console.log("[PWA] New service worker content available.");
                }
              }
            });
          }
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[PWA] Service worker registration failed:", error);
        }
      }
    };

    // Register immediately on component mount without blocking
    registerSW();
  }, []);

  return null;
}
