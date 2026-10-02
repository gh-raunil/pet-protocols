"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "@/components/ui/ToastProvider";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getDeviceLabel() {
  if (typeof window === "undefined" || !navigator?.userAgent) return "Current Device";
  const ua = navigator.userAgent.toLowerCase();
  const isTWA = document.referrer.includes("android-app://") ||
    (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(display-mode: standalone)").matches && /android/i.test(navigator.userAgent));

  let browser = "Browser";
  let os = "Device";

  if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("safari")) browser = "Safari";

  if (ua.includes("android")) os = isTWA ? "Android App (TWA)" : "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("windows")) os = "Windows PC";
  else if (ua.includes("macintosh") || ua.includes("mac os")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";

  return `${browser} on ${os}`;
}

export function useWebPush() {
  const { data: session, status: authStatus } = useSession();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const syncedForUserRef = useRef(null);

  // Sync active subscription with currently logged in user
  const syncSubscriptionWithUser = useCallback(async (sub) => {
    if (!sub || typeof window === "undefined") return;
    try {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
          deviceLabel: getDeviceLabel(),
        }),
      });
    } catch (e) {
      console.warn("[WebPush] Session subscription sync error:", e);
    }
  }, []);

  // Check support and current subscription status on mount
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    setIsSupported(true);
    setPermission(Notification.permission);

    async function checkSubscription() {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();

        if (existingSub) {
          setSubscription(existingSub);
          setIsSubscribed(true);

          // If user is authenticated and not yet synced this session, sync with user account
          const currentEmail = session?.user?.email;
          if (authStatus === "authenticated" && currentEmail && syncedForUserRef.current !== currentEmail) {
            syncedForUserRef.current = currentEmail;
            syncSubscriptionWithUser(existingSub);
          }
        } else {
          setIsSubscribed(false);
          // If permission is already granted (e.g. Android TWA delegation), attempt background auto-activation
          if (Notification.permission === "granted") {
            autoSubscribe(registration);
          }
        }
      } catch (err) {
        console.warn("[WebPush] Error inspecting push manager:", err);
      } finally {
        setIsLoading(false);
      }
    }

    async function autoSubscribe(registration) {
      try {
        let vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          const res = await fetch("/api/push/vapid-public-key");
          const data = await res.json();
          vapidKey = data?.publicKey;
        }
        if (!vapidKey) return;

        const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
        const newSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });

        if (newSub) {
          setSubscription(newSub);
          setIsSubscribed(true);
          await syncSubscriptionWithUser(newSub);
        }
      } catch (autoErr) {
        console.warn("[WebPush] Silent auto-subscribe warning:", autoErr.message);
      }
    }

    checkSubscription();
  }, [authStatus, session, syncSubscriptionWithUser]);

  // Subscribe to Web Push
  const subscribe = useCallback(async (options = { showToast: true }) => {
    if (!isSupported) {
      if (options.showToast) toast.warning("Push notifications are not supported on this browser.");
      return false;
    }

    setIsLoading(true);
    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === "denied") {
        if (options.showToast) {
          toast.warning(
            "Notification permission was denied. Please allow notifications in your browser or device settings to receive order alerts."
          );
        }
        setIsLoading(false);
        return false;
      }

      if (perm !== "granted") {
        setIsLoading(false);
        return false;
      }

      // 2. Fetch VAPID Public Key from env or backend fallback
      let vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        try {
          const res = await fetch("/api/push/vapid-public-key");
          const data = await res.json();
          if (data?.publicKey) {
            vapidKey = data.publicKey;
          }
        } catch (e) {
          console.warn("[WebPush] Could not fetch public key from api:", e);
        }
      }

      if (!vapidKey) {
        if (options.showToast) toast.error("VAPID public key is not configured.");
        setIsLoading(false);
        return false;
      }

      // 3. Register push subscription with service worker
      const registration = await navigator.serviceWorker.ready;
      const convertedVapidKey = urlBase64ToUint8Array(vapidKey);

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      // 4. Send subscription to backend to persist linked to user
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
          deviceLabel: getDeviceLabel(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to store push subscription on server.");
      }

      setSubscription(sub);
      setIsSubscribed(true);
      if (options.showToast) toast.success("Live order push notifications enabled!");
      return true;
    } catch (error) {
      console.error("[WebPush] Subscription error:", error);
      if (options.showToast) toast.error(`Push subscription failed: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  // Unsubscribe from Web Push
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        // Notify backend to remove this specific device subscription
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      setSubscription(null);
      setIsSubscribed(false);
      toast.info("Push notifications disabled on this device.");
      return true;
    } catch (error) {
      console.error("[WebPush] Unsubscribe error:", error);
      toast.error(`Failed to unsubscribe: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send a test notification
  const sendTest = useCallback(async () => {
    if (!isSubscribed || !subscription) {
      toast.warning("Please enable notifications first before testing.");
      return;
    }

    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Test notification dispatched! Check your device notifications.");
      } else {
        toast.warning(data.message || "Failed to trigger test notification.");
      }
    } catch (err) {
      toast.error("Network error sending test notification.");
    }
  }, [isSubscribed, subscription]);

  // Fetch registered devices for the current user
  const fetchDevices = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    setLoadingDevices(true);
    try {
      const res = await fetch("/api/push/devices");
      const data = await res.json();
      if (data.success && Array.isArray(data.devices)) {
        setDevices(data.devices);
      }
    } catch (e) {
      console.warn("[WebPush] Failed to load devices:", e);
    } finally {
      setLoadingDevices(false);
    }
  }, [authStatus]);

  // Revoke a specific device
  const revokeDevice = useCallback(async (deviceId) => {
    if (!deviceId) return false;
    try {
      const res = await fetch(`/api/push/devices?id=${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Device notification access revoked.");
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
        return true;
      } else {
        toast.error(data.message || "Failed to revoke device.");
        return false;
      }
    } catch (e) {
      toast.error("Network error revoking device.");
      return false;
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscription,
    subscribe,
    unsubscribe,
    sendTest,
    devices,
    loadingDevices,
    fetchDevices,
    revokeDevice,
  };
}
