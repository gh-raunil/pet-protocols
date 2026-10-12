"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const STORAGE_KEYS = {
  MENU: "pet_protocols_seen_menu_time",
  OFFERS: "pet_protocols_seen_offers_time",
  ORDERS: "pet_protocols_seen_orders_time",
};

export function useNavBadges() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [menuBadge, setMenuBadge] = useState(0);
  const [offersBadge, setOffersBadge] = useState(0);
  const [ordersBadge, setOrdersBadge] = useState(0);

  // Clear badge when user opens/navigates to that section
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (pathname === "/menu" || pathname.startsWith("/menu/")) {
      localStorage.setItem(STORAGE_KEYS.MENU, String(Date.now()));
      setMenuBadge(0);
    }
    if (pathname === "/offers" || pathname.startsWith("/offers/")) {
      localStorage.setItem(STORAGE_KEYS.OFFERS, String(Date.now()));
      setOffersBadge(0);
    }
    if (pathname === "/orders" || pathname.startsWith("/orders/")) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, String(Date.now()));
      setOrdersBadge(0);
    }
  }, [pathname]);

  // Compute unseen badges based on timestamps
  const evaluateBadges = useCallback(async () => {
    if (typeof window === "undefined") return;

    const lastSeenMenu = Number(localStorage.getItem(STORAGE_KEYS.MENU) || 0);
    const lastSeenOffers = Number(localStorage.getItem(STORAGE_KEYS.OFFERS) || 0);
    const lastSeenOrders = Number(localStorage.getItem(STORAGE_KEYS.ORDERS) || 0);

    // 1. Explore Menu Badge: count dishes added since last visit
    // If user has never visited, default to newly arrived dishes in past 14 days
    const isFirstMenuVisit = !localStorage.getItem(STORAGE_KEYS.MENU);

    try {
      const [prodRes, offRes] = await Promise.allSettled([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/offers").then((r) => r.json()),
      ]);

      if (prodRes.status === "fulfilled" && prodRes.value?.success && Array.isArray(prodRes.value.products)) {
        const products = prodRes.value.products;
        if (pathname.startsWith("/menu")) {
          setMenuBadge(0);
        } else if (isFirstMenuVisit) {
          // Highlight up to 5 newest dishes created in past 7 days
          const sevenDaysAgo = Date.now() - 7 * 86400000;
          const freshCount = products.filter((p) => new Date(p.createdAt || 0).getTime() > sevenDaysAgo).length;
          setMenuBadge(Math.min(freshCount, 9));
        } else {
          const newSinceVisit = products.filter(
            (p) => new Date(p.createdAt || 0).getTime() > lastSeenMenu
          ).length;
          setMenuBadge(Math.min(newSinceVisit, 9));
        }
      }

      // 2. Offers Badge: count active offers created since last visit
      const isFirstOffersVisit = !localStorage.getItem(STORAGE_KEYS.OFFERS);
      if (offRes.status === "fulfilled" && offRes.value?.success && Array.isArray(offRes.value.offers)) {
        const offers = offRes.value.offers;
        if (pathname.startsWith("/offers")) {
          setOffersBadge(0);
        } else if (isFirstOffersVisit) {
          setOffersBadge(Math.min(offers.length, 9));
        } else {
          const newOffers = offers.filter(
            (o) => new Date(o.createdAt || 0).getTime() > lastSeenOffers
          ).length;
          setOffersBadge(Math.min(newOffers, 9));
        }
      }

      // 3. Orders Badge: count active in-progress orders
      if (session?.user) {
        if (pathname.startsWith("/orders")) {
          setOrdersBadge(0);
        } else {
          const ordRes = await fetch("/api/orders").then((r) => r.json()).catch(() => null);
          if (ordRes?.success && Array.isArray(ordRes.orders)) {
            const activeStatuses = ["placed", "confirmed", "preparing", "out_for_delivery"];
            const activeOrders = ordRes.orders.filter((o) => activeStatuses.includes(o.status));
            // Badge shows active in-flight orders, or any updated since last visit
            const unacknowledged = activeOrders.filter(
              (o) => new Date(o.updatedAt || o.createdAt || 0).getTime() > lastSeenOrders
            );
            const count = unacknowledged.length > 0 ? unacknowledged.length : activeOrders.length;
            setOrdersBadge(Math.min(count, 9));
          }
        }
      } else {
        setOrdersBadge(0);
      }
    } catch (err) {
      console.warn("Could not evaluate nav notification badges:", err);
    }
  }, [pathname, session]);

  useEffect(() => {
    evaluateBadges();
    const interval = setInterval(evaluateBadges, 30000);
    return () => clearInterval(interval);
  }, [evaluateBadges]);

  return {
    menuBadge,
    offersBadge,
    ordersBadge,
    clearMenuBadge: () => {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.MENU, String(Date.now()));
      }
      setMenuBadge(0);
    },
    clearOffersBadge: () => {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.OFFERS, String(Date.now()));
      }
      setOffersBadge(0);
    },
    clearOrdersBadge: () => {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.ORDERS, String(Date.now()));
      }
      setOrdersBadge(0);
    },
  };
}
