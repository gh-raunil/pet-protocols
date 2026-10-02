"use client";

import { useEffect } from "react";

export default function AdminServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Auto-check for updates
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn("[AdminServiceWorkerRegister] Service Worker registration failed:", err);
      });
  }, []);

  return null;
}
