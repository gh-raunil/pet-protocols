"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const STORAGE_KEYS = {
  MENU: "pet_protocols_seen_menu_time",
  OFFERS: "pet_protocols_seen_offers_time",
  ORDERS: "pet_protocols_seen_orders_time",
};

// Module-level shared state & deduplication
let sharedBadges = {
  menuBadge: 0,
  offersBadge: 0,
  ordersBadge: 0,
};

const listeners = new Set();

function notifyListeners() {
  for (const listener of listeners) {
    listener({ ...sharedBadges });
  }
}

// 3-minute catalog & offers cache
const CACHE_TTL_MS = 180000;
let cachedProducts = null;
let cachedProductsTime = 0;
let cachedOffers = null;
let cachedOffersTime = 0;

let inFlightPromise = null;
let globalTimer = null;
let activeSubscriberCount = 0;

async function fetchProductsCached() {
  const now = Date.now();
  if (cachedProducts && now - cachedProductsTime < CACHE_TTL_MS) {
    return cachedProducts;
  }
  try {
    const res = await fetch("/api/products").then((r) => r.json());
    if (res?.success && Array.isArray(res.products)) {
      cachedProducts = res.products;
      cachedProductsTime = now;
      return cachedProducts;
    }
  } catch {}
  return cachedProducts || [];
}

async function fetchOffersCached() {
  const now = Date.now();
  if (cachedOffers && now - cachedOffersTime < CACHE_TTL_MS) {
    return cachedOffers;
  }
  try {
    const res = await fetch("/api/offers").then((r) => r.json());
    if (res?.success && Array.isArray(res.offers)) {
      cachedOffers = res.offers;
      cachedOffersTime = now;
      return cachedOffers;
    }
  } catch {}
  return cachedOffers || [];
}

async function evaluateSharedBadges(pathname = "", session = null) {
  if (typeof window === "undefined") return;

  // Pause polling when browser tab is hidden
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const lastSeenMenu = Number(localStorage.getItem(STORAGE_KEYS.MENU) || 0);
      const lastSeenOffers = Number(localStorage.getItem(STORAGE_KEYS.OFFERS) || 0);
      const lastSeenOrders = Number(localStorage.getItem(STORAGE_KEYS.ORDERS) || 0);

      const isFirstMenuVisit = !localStorage.getItem(STORAGE_KEYS.MENU);
      const isFirstOffersVisit = !localStorage.getItem(STORAGE_KEYS.OFFERS);

      const [products, offers] = await Promise.all([
        fetchProductsCached(),
        fetchOffersCached(),
      ]);

      let newMenuBadge = 0;
      if (!pathname.startsWith("/menu")) {
        if (isFirstMenuVisit) {
          const sevenDaysAgo = Date.now() - 7 * 86400000;
          const freshCount = products.filter(
            (p) => new Date(p.createdAt || 0).getTime() > sevenDaysAgo
          ).length;
          newMenuBadge = Math.min(freshCount, 9);
        } else {
          const newSinceVisit = products.filter(
            (p) => new Date(p.createdAt || 0).getTime() > lastSeenMenu
          ).length;
          newMenuBadge = Math.min(newSinceVisit, 9);
        }
      }

      let newOffersBadge = 0;
      if (!pathname.startsWith("/offers")) {
        if (isFirstOffersVisit) {
          newOffersBadge = Math.min(offers.length, 9);
        } else {
          const newOffers = offers.filter(
            (o) => new Date(o.createdAt || 0).getTime() > lastSeenOffers
          ).length;
          newOffersBadge = Math.min(newOffers, 9);
        }
      }

      let newOrdersBadge = 0;
      if (session?.user && !pathname.startsWith("/orders")) {
        try {
          const ordRes = await fetch("/api/orders").then((r) => r.json());
          if (ordRes?.success && Array.isArray(ordRes.orders)) {
            const activeStatuses = ["pending", "placed", "confirmed", "preparing", "ready", "out_for_delivery"];
            const activeOrders = ordRes.orders.filter((o) => activeStatuses.includes(o.status));
            const unacknowledged = activeOrders.filter(
              (o) => new Date(o.updatedAt || o.createdAt || 0).getTime() > lastSeenOrders
            );
            const count = unacknowledged.length > 0 ? unacknowledged.length : activeOrders.length;
            newOrdersBadge = Math.min(count, 9);
          }
        } catch {}
      }

      // Only notify listeners if state changed to prevent unnecessary re-renders
      if (
        sharedBadges.menuBadge !== newMenuBadge ||
        sharedBadges.offersBadge !== newOffersBadge ||
        sharedBadges.ordersBadge !== newOrdersBadge
      ) {
        sharedBadges = {
          menuBadge: newMenuBadge,
          offersBadge: newOffersBadge,
          ordersBadge: newOrdersBadge,
        };
        notifyListeners();
      }
    } catch (err) {
      console.warn("Could not evaluate nav notification badges:", err);
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

export function useNavBadges() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [badges, setBadges] = useState(sharedBadges);
  const pathnameRef = useRef(pathname);
  const sessionRef = useRef(session);

  useEffect(() => {
    pathnameRef.current = pathname;
    sessionRef.current = session;
  }, [pathname, session]);

  // Clear badge when user opens/navigates to that section
  useEffect(() => {
    if (typeof window === "undefined") return;

    let changed = false;
    if (pathname === "/menu" || pathname.startsWith("/menu/")) {
      localStorage.setItem(STORAGE_KEYS.MENU, String(Date.now()));
      if (sharedBadges.menuBadge !== 0) {
        sharedBadges.menuBadge = 0;
        changed = true;
      }
    }
    if (pathname === "/offers" || pathname.startsWith("/offers/")) {
      localStorage.setItem(STORAGE_KEYS.OFFERS, String(Date.now()));
      if (sharedBadges.offersBadge !== 0) {
        sharedBadges.offersBadge = 0;
        changed = true;
      }
    }
    if (pathname === "/orders" || pathname.startsWith("/orders/")) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, String(Date.now()));
      if (sharedBadges.ordersBadge !== 0) {
        sharedBadges.ordersBadge = 0;
        changed = true;
      }
    }

    if (changed) {
      notifyListeners();
    }

    evaluateSharedBadges(pathname, session);
  }, [pathname, session]);

  // Subscribe to shared badge updates & maintain single global polling timer
  useEffect(() => {
    const handleUpdate = (updated) => {
      setBadges(updated);
    };

    listeners.add(handleUpdate);
    activeSubscriberCount++;

    if (activeSubscriberCount === 1) {
      evaluateSharedBadges(pathnameRef.current, sessionRef.current);

      globalTimer = setInterval(() => {
        evaluateSharedBadges(pathnameRef.current, sessionRef.current);
      }, 45000);

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          evaluateSharedBadges(pathnameRef.current, sessionRef.current);
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        listeners.delete(handleUpdate);
        activeSubscriberCount--;
        if (activeSubscriberCount === 0) {
          if (globalTimer) {
            clearInterval(globalTimer);
            globalTimer = null;
          }
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        }
      };
    }

    return () => {
      listeners.delete(handleUpdate);
      activeSubscriberCount--;
      if (activeSubscriberCount === 0) {
        if (globalTimer) {
          clearInterval(globalTimer);
          globalTimer = null;
        }
      }
    };
  }, []);

  const clearMenuBadge = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.MENU, String(Date.now()));
    }
    sharedBadges.menuBadge = 0;
    notifyListeners();
  }, []);

  const clearOffersBadge = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.OFFERS, String(Date.now()));
    }
    sharedBadges.offersBadge = 0;
    notifyListeners();
  }, []);

  const clearOrdersBadge = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.ORDERS, String(Date.now()));
    }
    sharedBadges.ordersBadge = 0;
    notifyListeners();
  }, []);

  return {
    menuBadge: badges.menuBadge,
    offersBadge: badges.offersBadge,
    ordersBadge: badges.ordersBadge,
    clearMenuBadge,
    clearOffersBadge,
    clearOrdersBadge,
  };
}
