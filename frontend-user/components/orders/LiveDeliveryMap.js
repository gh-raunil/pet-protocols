"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Truck,
  MapPin,
  Clock,
  Phone,
  AlertTriangle,
  RefreshCw,
  Gauge,
  Navigation,
  Compass,
  Store,
  ShieldAlert,
  Maximize2,
  Minimize2,
  WifiOff,
  Radio,
  CheckCircle2,
  Info,
} from "lucide-react";

const TRACKING_POLL_INTERVAL_MS = 9000; // 9 seconds (in the 8-10s range)

// SVG data URI for custom delivery driver marker
const DRIVER_ICON_SVG = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="%232563EB" stroke="%23FFFFFF" stroke-width="3"/><path d="M14 26a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm14 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm-8-6h5l2 4h-9l2-4zm11 4h-2l-2-5h-4l-1-2h-5a1 1 0 0 0-1 1v1h3l2 4h-4v2h3.2a5 5 0 0 1 9.6 0H33v-2z" fill="%23FFFFFF"/></svg>`;

// SVG data URI for custom restaurant kitchen marker
const RESTAURANT_ICON_SVG = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="%23F59E0B" stroke="%23FFFFFF" stroke-width="3"/><path d="M16 16h16v3H16zm0 6h16v10H16zm2 2v6h12v-6z" fill="%23FFFFFF"/></svg>`;

// SVG data URI for destination marker (used only if valid coordinates exist)
const DESTINATION_ICON_SVG = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="%2310B981" stroke="%23FFFFFF" stroke-width="3"/><path d="M24 13c-4.4 0-8 3.6-8 8 0 5.3 8 14 8 14s8-8.7 8-14c0-4.4-3.6-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" fill="%23FFFFFF"/></svg>`;

function isValidCoordinate(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const secondsAgo = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (secondsAgo < 10) return "Just now";
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) return `${minutesAgo}m ago`;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function LiveDeliveryMap({
  orderId,
  initialStatus = "pending",
  isPickup = false,
  restaurant = null,
  destination = null,
  onStatusUpdate = null,
}) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [sdkStatus, setSdkStatus] = useState("idle"); // "idle" | "loading" | "ready" | "missing_key" | "error"
  const [isExpanded, setIsExpanded] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const restaurantMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const isFetchingRef = useRef(false);
  const pollTimerRef = useRef(null);

  const mapKey = process.env.NEXT_PUBLIC_MAPPLS_MAP_KEY;

  /**
   * Fetch live tracking data from authenticated customer endpoint
   */
  const fetchTracking = useCallback(
    async (isManual = false) => {
      if (!orderId || isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (isManual) setIsRefreshing(true);

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/tracking`);
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          setTracking(data);
          setFetchError("");
          if (typeof onStatusUpdate === "function" && data.status) {
            onStatusUpdate(data.status, data);
          }
        } else if (res.status === 401) {
          setFetchError("Please sign in to view live delivery tracking.");
        } else if (res.status === 404) {
          setFetchError("Order tracking not found or unauthorized.");
        } else {
          setFetchError(data.message || "Unable to fetch live delivery tracking.");
        }
      } catch (err) {
        console.warn("Live tracking fetch failed:", err?.message);
        if (isManual) {
          setFetchError("Network connection issue while refreshing tracking.");
        }
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        if (isManual) setIsRefreshing(false);
      }
    },
    [orderId, onStatusUpdate]
  );

  /**
   * Initial tracking fetch & visibility-aware polling
   */
  useEffect(() => {
    fetchTracking(false);

    function startPolling() {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return; // Pause polling when tab is hidden
        }
        fetchTracking(false);
      }, TRACKING_POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    startPolling();

    function handleVisibilityChange() {
      if (typeof document !== "undefined") {
        if (document.visibilityState === "visible") {
          fetchTracking(false);
          startPolling();
        } else {
          stopPolling();
        }
      }
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stopPolling();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [fetchTracking]);

  /**
   * Stop polling if order has reached a terminal state or pickup
   */
  useEffect(() => {
    if (
      tracking?.status === "delivered" ||
      tracking?.status === "cancelled" ||
      tracking?.isPickup ||
      isPickup
    ) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [tracking?.status, tracking?.isPickup, isPickup]);

  /**
   * Load Mappls Web Maps JavaScript SDK dynamically (client-side only)
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!mapKey) {
      setSdkStatus("missing_key");
      return;
    }

    if (window.mappls && typeof window.mappls.Map === "function") {
      setSdkStatus("ready");
      return;
    }

    setSdkStatus("loading");
    const scriptId = "mappls-maps-sdk-script";
    let script = document.getElementById(scriptId);

    const timeoutId = setTimeout(() => {
      setSdkStatus((current) => (current === "loading" ? "error" : current));
    }, 8000);

    const loadScriptWithFallback = (src, fallbackSrc) => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();

      const newScript = document.createElement("script");
      newScript.id = scriptId;
      newScript.src = src;
      newScript.async = true;

      newScript.onload = () => {
        clearTimeout(timeoutId);
        if (window.mappls && typeof window.mappls.Map === "function") {
          setSdkStatus("ready");
        } else if (fallbackSrc) {
          loadScriptWithFallback(fallbackSrc, null);
        } else {
          setSdkStatus("error");
        }
      };

      newScript.onerror = () => {
        if (fallbackSrc) {
          loadScriptWithFallback(fallbackSrc, null);
        } else {
          clearTimeout(timeoutId);
          setSdkStatus("error");
        }
      };

      document.head.appendChild(newScript);
    };

    if (!script) {
      loadScriptWithFallback(
        `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(mapKey)}/map_sdk?v=3.0`,
        `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(mapKey)}`
      );
    } else {
      const checkInterval = setInterval(() => {
        if (window.mappls && typeof window.mappls.Map === "function") {
          clearTimeout(timeoutId);
          clearInterval(checkInterval);
          setSdkStatus("ready");
        }
      }, 200);
      return () => {
        clearTimeout(timeoutId);
        clearInterval(checkInterval);
      };
    }

    return () => clearTimeout(timeoutId);
  }, [mapKey]);

  /**
   * Safely retry loading Mappls SDK on demand
   */
  const retryMapSdk = useCallback(() => {
    if (typeof window === "undefined" || !mapKey) return;
    setSdkStatus("loading");
    const scriptId = "mappls-maps-sdk-script";

    const timeoutId = setTimeout(() => {
      setSdkStatus((current) => (current === "loading" ? "error" : current));
    }, 8000);

    const loadScript = (src, fallbackSrc) => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = src;
      script.async = true;

      script.onload = () => {
        clearTimeout(timeoutId);
        if (window.mappls && typeof window.mappls.Map === "function") {
          setSdkStatus("ready");
        } else if (fallbackSrc) {
          loadScript(fallbackSrc, null);
        } else {
          setSdkStatus("error");
        }
      };

      script.onerror = () => {
        if (fallbackSrc) {
          loadScript(fallbackSrc, null);
        } else {
          clearTimeout(timeoutId);
          setSdkStatus("error");
        }
      };

      document.head.appendChild(script);
    };

    loadScript(
      `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(mapKey)}/map_sdk?v=3.0`,
      `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(mapKey)}`
    );
  }, [mapKey]);

  /**
   * Determine available coordinate data
   */
  const currentStatus = tracking?.status || initialStatus;
  const isActivelyDelivering =
    !isPickup &&
    !tracking?.isPickup &&
    currentStatus === "out_for_delivery" &&
    Boolean(tracking?.isLive) &&
    Boolean(tracking?.location);

  const driverLat = tracking?.location?.latitude;
  const driverLng = tracking?.location?.longitude;
  const hasValidDriverCoords = isActivelyDelivering && isValidCoordinate(driverLat, driverLng);

  const restAddress = tracking?.restaurant?.address || restaurant?.address;
  const restLat = restAddress?.latitude;
  const restLng = restAddress?.longitude;
  const hasValidRestaurantCoords = isValidCoordinate(restLat, restLng);

  const destObj = tracking?.destination || destination;
  const destLat = destObj?.latitude;
  const destLng = destObj?.longitude;
  const hasValidDestCoords = isValidCoordinate(destLat, destLng);

  /**
   * Initialize or update Mappls Map instance and markers
   */
  useEffect(() => {
    if (sdkStatus !== "ready" || !mapContainerRef.current || typeof window === "undefined" || !window.mappls) {
      return;
    }

    // Determine initial center
    let initialCenter = [28.6139, 77.209]; // Default New Delhi fallback
    if (hasValidDriverCoords) {
      initialCenter = [driverLat, driverLng];
    } else if (hasValidRestaurantCoords) {
      initialCenter = [restLat, restLng];
    }

    // 1. Initialize Map once
    if (!mapInstanceRef.current) {
      try {
        const map = new window.mappls.Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: hasValidDriverCoords ? 15 : 14,
          placemark: false,
          zoomControl: true,
          hybrid: false,
        });
        mapInstanceRef.current = map;
      } catch (err) {
        console.warn("Failed to initialize Mappls Map:", err?.message);
        return;
      }
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // 2. Manage Restaurant Marker
    if (hasValidRestaurantCoords) {
      const restPos = { lat: restLat, lng: restLng };
      const restName = tracking?.restaurant?.name || restaurant?.name || "Kitchen";
      const popupContent = `<div style="font-family:sans-serif;font-size:12px;padding:4px;"><strong>${restName}</strong><br/>Order Preparation Location</div>`;

      if (!restaurantMarkerRef.current) {
        try {
          restaurantMarkerRef.current = new window.mappls.Marker({
            map,
            position: restPos,
            icon: RESTAURANT_ICON_SVG,
            width: 36,
            height: 36,
            popupHtml: popupContent,
          });
        } catch (e) {
          console.warn("Could not create restaurant marker:", e?.message);
        }
      } else {
        try {
          restaurantMarkerRef.current.setPosition(restPos);
        } catch {}
      }
    }

    // 3. Manage Live Driver Marker
    if (hasValidDriverCoords) {
      const driverPos = { lat: driverLat, lng: driverLng };
      const driverName = tracking?.driver?.name || "Delivery Partner";
      const accuracyStr = typeof tracking?.location?.accuracy === "number" ? `±${Math.round(tracking.location.accuracy)}m` : "";
      const speedStr = typeof tracking?.location?.speed === "number" && tracking.location.speed > 0
        ? ` • ${Math.round(tracking.location.speed * 3.6)} km/h`
        : "";
      const popupContent = `<div style="font-family:sans-serif;font-size:12px;padding:4px;"><strong>${driverName} (Live)</strong><br/>${accuracyStr}${speedStr}</div>`;

      if (!driverMarkerRef.current) {
        try {
          driverMarkerRef.current = new window.mappls.Marker({
            map,
            position: driverPos,
            icon: DRIVER_ICON_SVG,
            width: 40,
            height: 40,
            popupHtml: popupContent,
          });
        } catch (e) {
          console.warn("Could not create driver marker:", e?.message);
        }
      } else {
        try {
          driverMarkerRef.current.setPosition(driverPos);
        } catch {}
      }
    } else {
      // Non-transit or terminal: remove driver marker if exists
      if (driverMarkerRef.current) {
        try {
          if (typeof driverMarkerRef.current.remove === "function") {
            driverMarkerRef.current.remove();
          }
        } catch {}
        driverMarkerRef.current = null;
      }
    }

    // 4. Manage Destination Marker (only if reliable coordinates exist)
    if (hasValidDestCoords) {
      const destPos = { lat: destLat, lng: destLng };
      const popupContent = `<div style="font-family:sans-serif;font-size:12px;padding:4px;"><strong>Delivery Destination</strong><br/>${destObj?.street || "Customer Address"}</div>`;

      if (!destinationMarkerRef.current) {
        try {
          destinationMarkerRef.current = new window.mappls.Marker({
            map,
            position: destPos,
            icon: DESTINATION_ICON_SVG,
            width: 36,
            height: 36,
            popupHtml: popupContent,
          });
        } catch (e) {
          console.warn("Could not create destination marker:", e?.message);
        }
      }
    }

    // 5. Adjust Viewport Bounds
    if (hasValidDriverCoords && hasValidRestaurantCoords) {
      try {
        const bounds = [
          [Math.min(driverLat, restLat), Math.min(driverLng, restLng)],
          [Math.max(driverLat, restLat), Math.max(driverLng, restLng)],
        ];
        if (typeof window.mappls.fitBounds === "function") {
          new window.mappls.fitBounds({
            map,
            bounds,
            options: { padding: 80, duration: 800 },
          });
        } else if (typeof map.fitBounds === "function") {
          map.fitBounds(bounds, { padding: 80 });
        }
      } catch {
        try {
          map.setCenter([driverLat, driverLng]);
        } catch {}
      }
    } else if (hasValidDriverCoords) {
      try {
        map.setCenter([driverLat, driverLng]);
      } catch {}
    } else if (hasValidRestaurantCoords) {
      try {
        map.setCenter([restLat, restLng]);
      } catch {}
    }
  }, [
    sdkStatus,
    hasValidDriverCoords,
    driverLat,
    driverLng,
    hasValidRestaurantCoords,
    restLat,
    restLng,
    hasValidDestCoords,
    destLat,
    destLng,
    tracking,
    restaurant,
    destObj,
  ]);

  /**
   * Teardown map on component unmount
   */
  useEffect(() => {
    return () => {
      if (driverMarkerRef.current && typeof driverMarkerRef.current.remove === "function") {
        try {
          driverMarkerRef.current.remove();
        } catch {}
      }
      if (restaurantMarkerRef.current && typeof restaurantMarkerRef.current.remove === "function") {
        try {
          restaurantMarkerRef.current.remove();
        } catch {}
      }
      if (destinationMarkerRef.current && typeof destinationMarkerRef.current.remove === "function") {
        try {
          destinationMarkerRef.current.remove();
        } catch {}
      }
      if (mapInstanceRef.current && typeof mapInstanceRef.current.remove === "function") {
        try {
          mapInstanceRef.current.remove();
        } catch {}
      }
      mapInstanceRef.current = null;
    };
  }, []);

  // ── 1. Counter Pickup View (No Live Delivery Map Needed) ───────────────────
  if (isPickup || tracking?.isPickup) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center justify-center shrink-0">
            <Store size={24} />
          </div>
          <div className="space-y-1 min-w-0">
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/30">
              Counter Self-Pickup Order
            </span>
            <h4 className="text-base font-bold text-[var(--text-main)]">
              Pickup at Restaurant Counter
            </h4>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Your meal is being prepared for takeaway. Please collect directly from{" "}
              <strong>{tracking?.restaurant?.name || restaurant?.name || "the restaurant"}</strong>{" "}
              when marked ready. Live road GPS tracking is not applicable for pickup orders.
            </p>
          </div>
        </div>

        {restAddress?.street && (
          <div className="pt-3 border-t border-[var(--border-color)]/60 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5 font-medium">
              <MapPin size={14} className="text-amber-500" />
              {restAddress.street}, {restAddress.city}
            </span>
            {tracking?.restaurant?.phone && (
              <a
                href={`tel:${tracking.restaurant.phone}`}
                className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
              >
                Call Kitchen
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── 2. Terminal Order States (Delivered / Cancelled) ──────────────────────
  if (currentStatus === "delivered") {
    return (
      <div className="bg-[var(--bg-card)] border border-emerald-500/30 rounded-3xl p-6 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/30">
          <CheckCircle2 size={24} />
        </div>
        <div className="space-y-1">
          <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
            Order Delivered
          </span>
          <h4 className="text-base font-bold text-[var(--text-main)]">
            Meal Handed Over Successfully
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            Live delivery tracking has completed. Thank you for ordering with Pet Protocols!
          </p>
        </div>
      </div>
    );
  }

  if (currentStatus === "cancelled") {
    return null; // Cancelled state is cleanly represented by OrderStatusTracker
  }

  // ── 3. Kitchen Preparing / Order Placed (Pre-Transit) ──────────────────────
  if (currentStatus === "pending" || currentStatus === "confirmed" || currentStatus === "preparing" || currentStatus === "ready") {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center shrink-0">
              <Store size={18} />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[var(--brand-accent)]">
                Kitchen Stage
              </span>
              <h5 className="text-sm font-bold text-[var(--text-main)]">
                Live GPS Activates on Dispatch
              </h5>
            </div>
          </div>

          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)]">
            Awaiting Driver Pickup
          </span>
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          The culinary team is preparing your order fresh. Real-time GPS location of your delivery partner will appear on this interactive map as soon as your meal is handed over and transit begins.
        </p>

        {restAddress?.street && (
          <div className="pt-2 border-t border-[var(--border-color)]/60 text-[11px] text-[var(--text-muted)] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-[var(--brand-accent)]" />
              Kitchen: {restAddress.street}, {restAddress.city}
            </span>
            {hasValidRestaurantCoords && (
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                GPS: {restLat.toFixed(3)}, {restLng.toFixed(3)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── 4. Actively Out For Delivery (Interactive Live Map View) ──────────────
  const isStale = Boolean(tracking?.isStale);
  const driver = tracking?.driver;
  const lastRecordedAt = tracking?.location?.recordedAt || tracking?.lastUpdatedAt;

  return (
    <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-md space-y-0 transition-all">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .animate-pulse,
          .animate-ping,
          .animate-spin {
            animation: none !important;
          }
        }
      `}</style>

      {/* ── LIVE HEADER BAR ────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 border-b border-[var(--border-color)] bg-[var(--bg-sub)]/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left Block: Icon + Tracking Status & Order ID */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Delivery Icon */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 relative">
              <Truck size={18} className="animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            </div>

            {/* Status & Order ID Group */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 shrink-0">
                  Live Delivery in Transit
                </span>
                <span className="text-[var(--text-muted)] text-xs shrink-0">•</span>
                <span
                  className="font-bold text-xs sm:text-sm text-[var(--text-main)] truncate max-w-[160px] sm:max-w-[220px]"
                  title={`Order #${orderId}`}
                >
                  Order #{orderId}
                </span>
              </div>

              {/* Status Badge & Timestamp */}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${
                    isStale
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : hasValidDriverCoords
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 animate-pulse"
                  }`}
                >
                  {isStale
                    ? "⚠️ GPS Signal Stale"
                    : hasValidDriverCoords
                    ? "● Live GPS Connected"
                    : "⏳ Acquiring Driver GPS Fix..."}
                </span>

                {lastRecordedAt && (
                  <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] font-mono">
                    {formatRelativeTime(lastRecordedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Block: Consistent Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => fetchTracking(true)}
              disabled={isRefreshing}
              className="h-8.5 px-2.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--border-color)]/50 text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer border border-[var(--border-color)] disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs font-semibold"
              title="Refresh live position"
              aria-label="Refresh live position"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
              <span className="hidden xs:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8.5 px-2.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--border-color)]/50 text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer border border-[var(--border-color)] flex items-center gap-1.5 text-xs font-semibold"
              title={isExpanded ? "Standard Map View" : "Enlarge Map View"}
            >
              {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isExpanded ? "Collapse" : "Enlarge"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── STALE GPS WARNING BANNER ───────────────────────────────────── */}
      {isStale && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 p-3 sm:px-5 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={15} className="shrink-0 text-amber-500" />
          <span>
            <strong>Signal Stale:</strong> Location has not updated in over 3 minutes. The delivery partner may be travelling through a tunnel, basement, or low-connectivity zone.
          </span>
        </div>
      )}

      {/* ── MAP CANVAS CONTAINER ───────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden bg-stone-100 dark:bg-stone-900">
        {/* Interactive Mappls Map */}
        <div
          ref={mapContainerRef}
          className={`w-full transition-all duration-300 ${
            isExpanded ? "h-[450px] sm:h-[550px]" : "h-[300px] sm:h-[380px]"
          }`}
          style={{ minHeight: "280px" }}
        />

        {/* Missing Key Fallback Overlay */}
        {sdkStatus === "missing_key" && (
          <div className="absolute inset-0 bg-[var(--bg-card)]/95 backdrop-blur-sm flex items-center justify-center p-6 text-center z-10">
            <div className="max-w-md w-full mx-auto p-5 rounded-2xl bg-[var(--bg-sub)]/80 border border-[var(--border-color)] shadow-xs flex flex-col items-center space-y-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <Info size={22} className="stroke-[1.75]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[var(--text-main)]">
                  Interactive Map Awaiting Mappls Key
                </h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Live coordinate ingestion is actively functioning. To enable the interactive street map rendering, configure your browser-restricted map key in{" "}
                  <code className="bg-[var(--bg-card)] px-1.5 py-0.5 rounded font-mono text-[11px] text-[var(--brand-accent)] border border-[var(--border-color)]">
                    NEXT_PUBLIC_MAPPLS_MAP_KEY
                  </code>
                  .
                </p>
              </div>
              {hasValidDriverCoords && (
                <div className="font-mono text-xs bg-[var(--bg-card)] px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-[var(--text-main)]">
                  📍 Driver GPS: {driverLat.toFixed(5)}, {driverLng.toFixed(5)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SDK Loading State */}
        {sdkStatus === "loading" && (
          <div className="absolute inset-0 bg-[var(--bg-card)]/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10 text-xs text-[var(--text-muted)]">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <span>Loading Mappls Vector Maps...</span>
          </div>
        )}

        {/* SDK Load Error */}
        {sdkStatus === "error" && (
          <div className="absolute inset-0 bg-[var(--bg-card)]/95 backdrop-blur-sm flex items-center justify-center p-6 text-center z-10">
            <div className="max-w-sm w-full mx-auto p-5 rounded-2xl bg-[var(--bg-sub)]/80 border border-[var(--border-color)] shadow-xs flex flex-col items-center space-y-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <WifiOff size={20} className="stroke-[1.75]" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-bold text-[var(--text-main)]">
                  Map temporarily unavailable
                </h5>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  The map service could not be reached. Live delivery coordinates and telemetry continue to be tracked accurately below.
                </p>
              </div>
              {mapKey && (
                <button
                  type="button"
                  onClick={retryMapSdk}
                  className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-[var(--bg-card)] hover:bg-[var(--border-color)]/50 text-[var(--text-main)] border border-[var(--border-color)] transition cursor-pointer shadow-2xs"
                >
                  <RefreshCw size={12} />
                  <span>Retry Map</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Waiting for First Driver GPS Fix Overlay */}
        {!hasValidDriverCoords && sdkStatus === "ready" && (
          <div className="absolute top-4 left-4 right-4 sm:right-auto bg-[var(--bg-card)]/95 border border-[var(--border-color)] rounded-2xl p-3.5 shadow-lg backdrop-blur-md flex items-center gap-3 z-10 max-w-md">
            <Radio size={18} className="text-blue-500 animate-pulse shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-[var(--text-main)] block">
                Connecting to Delivery Partner...
              </span>
              <span className="text-[var(--text-muted)]">
                Waiting for the driver device to broadcast its first GPS fix.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── DRIVER & DESTINATION TELEMETRY FOOTER ───────────────────────── */}
      <div className="p-3.5 sm:p-4 bg-[var(--bg-sub)]/30 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
          {/* Driver Information Card */}
          <div className="bg-[var(--bg-card)] p-3.5 sm:p-4 rounded-xl border border-[var(--border-color)] flex items-center justify-between gap-3 shadow-2xs h-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold text-base border border-blue-500/15">
                🛵
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  Delivery Partner
                </span>
                <p
                  className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate"
                  title={driver?.name || "Assigned Driver"}
                >
                  {driver?.name || "Assigned Driver"}
                </p>
                {typeof tracking?.location?.speed === "number" && tracking.location.speed > 0 ? (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 mt-0.5">
                    <Gauge size={11} />
                    <span>In Motion ({Math.round(tracking.location.speed * 3.6)} km/h)</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                    Active Delivery Transit
                  </span>
                )}
              </div>
            </div>

            {driver?.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition shrink-0 border border-emerald-500/20"
                title={`Call driver: ${driver.phone}`}
                aria-label={`Call driver: ${driver.phone}`}
              >
                <Phone size={13} />
                <span>Call Driver</span>
              </a>
            )}
          </div>

          {/* Destination Notice Card */}
          {(() => {
            const streetText = destObj?.street || "Customer Address";
            const cityPinText = destObj?.city ? `${destObj.city}${destObj.pincode ? ` - ${destObj.pincode}` : ""}` : "Destination on file";
            const fullAddress = [destObj?.street, destObj?.city, destObj?.pincode].filter(Boolean).join(", ") || "Customer Address";

            return (
              <div className="bg-[var(--bg-card)] p-3.5 sm:p-4 rounded-xl border border-[var(--border-color)] flex items-start gap-3 shadow-2xs h-full">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/15">
                  <MapPin size={18} />
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                    Delivering To
                  </span>
                  <p
                    className="font-bold text-xs sm:text-sm text-[var(--text-main)] line-clamp-1 break-words"
                    title={fullAddress}
                  >
                    {streetText}
                  </p>
                  <p
                    className="text-[11px] text-[var(--text-muted)] line-clamp-1 break-words mt-0.5"
                    title={fullAddress}
                  >
                    {cityPinText}
                  </p>
                  {!hasValidDestCoords && (
                    <div className="text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
                      <Info size={11} className="shrink-0 text-stone-400 dark:text-stone-500" />
                      <span className="line-clamp-1" title="Destination pin omitted without GPS geocoding">
                        Destination pin omitted without GPS geocoding
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Real GPS Telemetry Chips (When Active) */}
        {hasValidDriverCoords && (
          <div className="flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-[var(--border-color)]/60">
            <span className="font-mono text-[11px] text-[var(--text-muted)] bg-[var(--bg-card)] px-2.5 py-1 rounded-lg border border-[var(--border-color)]">
              📍 Driver: {driverLat.toFixed(5)}, {driverLng.toFixed(5)}
            </span>

            {typeof tracking?.location?.accuracy === "number" && (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                🎯 ±{Math.round(tracking.location.accuracy)}m accuracy
              </span>
            )}

            {typeof tracking?.location?.speed === "number" && tracking.location.speed > 0 && (
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <Gauge size={12} />
                <span>{Math.round(tracking.location.speed * 3.6)} km/h</span>
              </span>
            )}

            {hasValidRestaurantCoords && (
              <span className="text-[11px] text-[var(--text-muted)] ml-auto font-mono">
                🍳 Origin: {tracking?.restaurant?.name || "Kitchen"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
