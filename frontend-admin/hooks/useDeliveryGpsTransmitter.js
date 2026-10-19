"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";

/**
 * Calculates Great Circle distance between two points in meters using Haversine formula
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return 0;
  }
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Identifies if an order is a counter pickup rather than a delivery dispatch
 */
export function isPickupOrder(order) {
  if (!order) return false;
  const method = String(order.paymentMethod || "").toLowerCase();
  const notes = String(order.notes || "").toLowerCase();
  const addressType = String(order.address?.addressType || "").toLowerCase();
  return (
    method.includes("pickup") ||
    method.includes("cop") ||
    notes.includes("[pickup]") ||
    addressType.includes("pickup")
  );
}

// Throttling configuration
const MIN_UPDATE_INTERVAL_MS = 8000; // 8 seconds target cadence
const SIGNIFICANT_MOVE_METERS = 25; // 25 meters meaningful movement
const FAST_UPDATE_INTERVAL_MS = 4000; // Allow 4s updates if moving rapidly
const HEARTBEAT_INTERVAL_MS = 25000; // Send heartbeat at 25s even if stationary to prevent staleness

export function useDeliveryGpsTransmitter() {
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [trackingStatus, setTrackingStatus] = useState("idle");
  // Statuses: "idle" | "requesting_permission" | "sharing" | "unavailable" | "permission_denied" | "stopped" | "unauthorized" | "unsupported"

  const [lastLocation, setLastLocation] = useState(null);
  const [lastSentTime, setLastSentTime] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // References for mutable state without triggering rerenders
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const activeOrderIdRef = useRef(null);
  const lastSentLocationRef = useRef(null);
  const lastSentTimeRef = useRef(0);
  const isSendingRef = useRef(false);
  const pendingPositionRef = useRef(null);
  const throttleTimerRef = useRef(null);

  // Sync ref with state
  useEffect(() => {
    activeOrderIdRef.current = activeOrderId;
  }, [activeOrderId]);

  /**
   * Screen Wake Lock management (prevents mobile screen sleep during transit)
   */
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof window === "undefined" || !("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setWakeLockActive(true);
      wakeLockRef.current.addEventListener("release", () => {
        setWakeLockActive(false);
      });
    } catch (err) {
      // Wake lock request can fail due to low battery or system policy; non-critical
      console.warn("Screen wake lock could not be acquired:", err?.message);
    }
  }, []);

  /**
   * Internal teardown helper
   */
  const stopTrackingInternal = useCallback(
    (reason = "stopped") => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      pendingPositionRef.current = null;
      isSendingRef.current = false;
      releaseWakeLock();

      setTrackingStatus(reason);
      if (reason === "stopped" || reason === "unauthorized") {
        setActiveOrderId(null);
        setActiveOrder(null);
        lastSentLocationRef.current = null;
        lastSentTimeRef.current = 0;
      }
    },
    [releaseWakeLock]
  );

  /**
   * Public stop tracking method
   */
  const stopTracking = useCallback(
    (reason = "stopped") => {
      stopTrackingInternal(reason);
      if (reason === "stopped") {
        toast("Live GPS transmission stopped.", { icon: "🛑" });
      }
    },
    [stopTrackingInternal]
  );

  /**
   * Sends location update to server
   */
  const sendLocationToServer = useCallback(
    async (orderId, coords, timestamp) => {
      if (!orderId || isSendingRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setTrackingStatus("unavailable");
        setErrorMessage("Device is currently offline. Will resume when network connects.");
        return;
      }

      isSendingRef.current = true;

      try {
        const payload = {
          latitude: Number(coords.latitude),
          longitude: Number(coords.longitude),
          accuracy: typeof coords.accuracy === "number" && Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          heading: typeof coords.heading === "number" && Number.isFinite(coords.heading) ? coords.heading : null,
          speed: typeof coords.speed === "number" && Number.isFinite(coords.speed) ? coords.speed : null,
          recordedAt: new Date(timestamp || Date.now()).toISOString(),
        };

        const res = await fetch(`/api/restaurant/orders/${orderId}/location`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          lastSentTimeRef.current = Date.now();
          lastSentLocationRef.current = coords;
          setLastSentTime(Date.now());
          setTrackingStatus("sharing");
          setErrorMessage("");
        } else if (res.status === 403) {
          // Driver unassigned or authorization lost
          setTrackingStatus("unauthorized");
          const msg = data.message || "You are not assigned to this delivery or authorization was revoked.";
          setErrorMessage(msg);
          toast.error(`GPS Stopped: ${msg}`);
          stopTrackingInternal("unauthorized");
        } else if (res.status === 400) {
          // Order delivered, cancelled, not live, or pickup
          const msg = data.message || "Tracking is not active for this delivery.";
          setErrorMessage(msg);
          if (
            msg.includes("delivered") ||
            msg.includes("cancelled") ||
            msg.includes("not active") ||
            msg.includes("Pickup orders")
          ) {
            toast(msg, { icon: "ℹ️" });
            stopTrackingInternal("stopped");
          }
        } else if (res.status === 401) {
          setTrackingStatus("unauthorized");
          setErrorMessage("Staff session expired. Please re-login.");
          toast.error("Session expired. GPS transmission stopped.");
          stopTrackingInternal("unauthorized");
        } else {
          // Server or other transient error
          setTrackingStatus("unavailable");
          setErrorMessage(data.message || `Server returned HTTP ${res.status}`);
        }
      } catch (err) {
        console.warn("GPS transmission network failure:", err?.message);
        setTrackingStatus("unavailable");
        setErrorMessage("Network connection failure while transmitting GPS.");
      } finally {
        isSendingRef.current = false;
      }
    },
    [stopTrackingInternal]
  );

  /**
   * Geolocation watch callbacks
   */
  const handlePositionSuccess = useCallback(
    (position) => {
      if (!position || !position.coords) return;
      const { coords, timestamp } = position;
      const orderId = activeOrderIdRef.current;
      if (!orderId) return;

      const newLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        heading: coords.heading,
        speed: coords.speed,
        recordedAt: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      };
      setLastLocation(newLocation);

      const now = Date.now();
      const lastTime = lastSentTimeRef.current;
      const lastLoc = lastSentLocationRef.current;
      const elapsedMs = now - lastTime;

      let distance = Infinity;
      if (lastLoc) {
        distance = calculateDistanceMeters(
          lastLoc.latitude,
          lastLoc.longitude,
          coords.latitude,
          coords.longitude
        );
      }

      // Check throttling criteria:
      // 1. If never sent before -> send immediately
      // 2. If moved >= 25m and at least 4s passed -> send
      // 3. If at least 8s passed and moved >= 5m -> send
      // 4. If stationary but >= 25s passed -> send heartbeat update
      // 5. Otherwise skip and schedule delayed check
      const isFirst = !lastLoc || lastTime === 0;
      const isSignificantMove = distance >= SIGNIFICANT_MOVE_METERS && elapsedMs >= FAST_UPDATE_INTERVAL_MS;
      const isNormalUpdate = elapsedMs >= MIN_UPDATE_INTERVAL_MS && distance >= 5;
      const isHeartbeat = elapsedMs >= HEARTBEAT_INTERVAL_MS;

      if (isFirst || isSignificantMove || isNormalUpdate || isHeartbeat) {
        if (throttleTimerRef.current) {
          clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = null;
        }
        sendLocationToServer(orderId, coords, timestamp);
      } else {
        // Save pending position and schedule a flush when throttle window elapses
        pendingPositionRef.current = { orderId, coords, timestamp };
        if (!throttleTimerRef.current) {
          const waitTime = Math.max(1000, MIN_UPDATE_INTERVAL_MS - elapsedMs);
          throttleTimerRef.current = setTimeout(() => {
            throttleTimerRef.current = null;
            if (pendingPositionRef.current && activeOrderIdRef.current) {
              const { orderId: pendingId, coords: pendingCoords, timestamp: pendingTime } =
                pendingPositionRef.current;
              pendingPositionRef.current = null;
              sendLocationToServer(pendingId, pendingCoords, pendingTime);
            }
          }, waitTime);
        }
      }
    },
    [sendLocationToServer]
  );

  const handlePositionError = useCallback(
    (err) => {
      console.warn("Geolocation watch error:", err?.code, err?.message);
      if (err.code === 1) {
        // PERMISSION_DENIED
        setTrackingStatus("permission_denied");
        setErrorMessage(
          "Location permission denied. Please allow device location access in your browser settings to transmit GPS."
        );
        toast.error("Location permission denied. GPS tracking halted.");
        stopTrackingInternal("permission_denied");
      } else if (err.code === 2) {
        // POSITION_UNAVAILABLE
        setTrackingStatus("unavailable");
        setErrorMessage("GPS signal unavailable. Ensure location/GPS is enabled on your device.");
      } else if (err.code === 3) {
        // TIMEOUT
        setTrackingStatus("unavailable");
        setErrorMessage("GPS location acquisition timed out. Waiting for signal...");
      } else {
        setTrackingStatus("unavailable");
        setErrorMessage(err.message || "Unknown geolocation error.");
      }
    },
    [stopTrackingInternal]
  );

  /**
   * Public start tracking method
   */
  const startTracking = useCallback(
    (orderId, order = null) => {
      if (!orderId) {
        toast.error("Order ID is required to start live GPS transmission.");
        return;
      }

      // Check if order is counter pickup
      if (order && isPickupOrder(order)) {
        toast.error("Pickup orders do not require GPS delivery tracking.");
        return;
      }

      // Check if order is in valid transit status
      if (order && order.status !== "out_for_delivery") {
        toast.error(`Order is '${order.status}'. GPS is only active when 'out_for_delivery'.`);
        return;
      }

      // Check browser support
      if (typeof window === "undefined" || !navigator.geolocation) {
        setTrackingStatus("unsupported");
        setErrorMessage("Browser does not support geolocation.");
        toast.error("Geolocation is not supported by this browser.");
        return;
      }

      // Clear any existing session first
      if (watchIdRef.current !== null) {
        stopTrackingInternal("stopped");
      }

      setActiveOrderId(orderId);
      setActiveOrder(order);
      setTrackingStatus("requesting_permission");
      setErrorMessage("");
      lastSentLocationRef.current = null;
      lastSentTimeRef.current = 0;

      // Request screen wake lock
      requestWakeLock();

      // Start watching real position
      try {
        const id = navigator.geolocation.watchPosition(
          handlePositionSuccess,
          handlePositionError,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }
        );
        watchIdRef.current = id;
      } catch (err) {
        console.error("Failed to initiate watchPosition:", err);
        setTrackingStatus("unavailable");
        setErrorMessage("Failed to start device geolocation watch.");
      }
    },
    [handlePositionSuccess, handlePositionError, requestWakeLock, stopTrackingInternal]
  );

  /**
   * Re-acquire wake lock on visibility change if tracking is active
   */
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && watchIdRef.current !== null) {
        requestWakeLock();
      }
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [requestWakeLock]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopTrackingInternal("stopped");
    };
  }, [stopTrackingInternal]);

  return {
    activeOrderId,
    activeOrder,
    trackingStatus,
    lastLocation,
    lastSentTime,
    errorMessage,
    wakeLockActive,
    startTracking,
    stopTracking,
    isTracking: trackingStatus === "sharing" || trackingStatus === "requesting_permission",
  };
}
