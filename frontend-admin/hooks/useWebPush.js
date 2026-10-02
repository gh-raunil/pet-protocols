"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

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
  if (typeof window === "undefined" || !navigator?.userAgent) return "Kitchen Terminal";
  const ua = navigator.userAgent.toLowerCase();

  let browser = "Browser";
  let os = "Device";

  if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("safari")) browser = "Safari";

  if (ua.includes("android")) os = "Android Tablet/Phone";
  else if (ua.includes("ipad")) os = "iPad Kitchen Display";
  else if (ua.includes("iphone")) os = "iPhone";
  else if (ua.includes("windows")) os = "Windows PC / POS";
  else if (ua.includes("macintosh") || ua.includes("mac os")) os = "Mac";
  else if (ua.includes("linux")) os = "Linux POS";

  return `${browser} on ${os}`;
}

export function useWebPush() {
  const { data: session, status: authStatus } = useSession();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);

  // Registered devices for the authenticated account
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const syncedForUserRef = useRef(null);

  // Sync existing browser subscription with backend
  const syncSubscriptionWithBackend = useCallback(async (sub, notify = false) => {
    try {
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON ? sub.toJSON() : sub,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          deviceLabel: getDeviceLabel(),
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to persist subscription on server");
      }
      if (notify) {
        toast.success("Desktop alerts active on this device!");
      }
      return true;
    } catch (err) {
      console.warn("[AdminWebPush] Failed to sync subscription with backend:", err);
      return false;
    }
  }, []);

  // Fetch registered devices for this account
  const fetchDevices = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    try {
      setLoadingDevices(true);
      const res = await fetch("/api/push/devices");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.devices)) {
          setDevices(data.devices);
        }
      }
    } catch (e) {
      console.warn("[AdminWebPush] Failed to fetch registered devices:", e);
    } finally {
      setLoadingDevices(false);
    }
  }, [authStatus]);

  // Revoke a device
  const revokeDevice = useCallback(async (subscriptionId) => {
    try {
      const res = await fetch(`/api/push/devices?id=${encodeURIComponent(subscriptionId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Device revoked successfully.");
        setDevices((prev) => prev.filter((d) => d.id !== subscriptionId));

        // If revoking the current device's subscription, update local status
        if (subscription && subscription.endpoint && subscription.endpoint === data.revokedEndpoint) {
          try {
            await subscription.unsubscribe();
          } catch (e) {}
          setSubscription(null);
          setIsSubscribed(false);
        }
      } else {
        toast.error(data.message || "Failed to revoke device.");
      }
    } catch (e) {
      toast.error("Error revoking device.");
    }
  }, [subscription]);

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
        } else {
          setIsSubscribed(false);
        }
      } catch (err) {
        console.warn("[AdminWebPush] Error inspecting push manager:", err);
      } finally {
        setIsLoading(false);
      }
    }

    checkSubscription();
  }, []);

  // Sync push subscription whenever user logs in or auth state changes
  useEffect(() => {
    const currentUserId = session?.user?.id || session?.user?.email;
    if (
      authStatus === "authenticated" &&
      currentUserId &&
      subscription &&
      syncedForUserRef.current !== currentUserId
    ) {
      syncedForUserRef.current = currentUserId;
      syncSubscriptionWithBackend(subscription, false).then(() => {
        fetchDevices();
      });
    }
  }, [authStatus, session, subscription, syncSubscriptionWithBackend, fetchDevices]);

  // Subscribe to Web Push
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error("Push notifications are not supported on this browser.");
      return false;
    }

    setIsLoading(true);
    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === "denied") {
        toast.error("Notification permission denied. Please allow notifications in site settings to receive order alerts.");
        setIsLoading(false);
        return false;
      }

      if (perm !== "granted") {
        setIsLoading(false);
        return false;
      }

      // 2. Fetch VAPID Public Key from backend or env
      let vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        try {
          const res = await fetch("/api/push/vapid-public-key");
          const data = await res.json();
          if (data?.publicKey) {
            vapidKey = data.publicKey;
          }
        } catch (e) {
          console.warn("[AdminWebPush] Could not fetch public key from api:", e);
        }
      }

      if (!vapidKey) {
        toast.error("VAPID public key is not configured on the server.");
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
      await syncSubscriptionWithBackend(sub, true);

      setSubscription(sub);
      setIsSubscribed(true);
      fetchDevices();
      return true;
    } catch (error) {
      console.error("[AdminWebPush] Subscription error:", error);
      toast.error(`Push subscription failed: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, syncSubscriptionWithBackend, fetchDevices]);

  // Unsubscribe from Web Push
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        // Notify backend to remove
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      setSubscription(null);
      setIsSubscribed(false);
      toast.success("Desktop alerts disabled on this device.");
      fetchDevices();
      return true;
    } catch (error) {
      console.error("[AdminWebPush] Unsubscribe error:", error);
      toast.error(`Failed to unsubscribe: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchDevices]);

  // Send a test notification
  const sendTest = useCallback(async () => {
    if (!isSubscribed || !subscription) {
      toast.error("Please enable desktop alerts on this device first.");
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
        toast.success("Test notification dispatched! Check your desktop notifications.");
      } else {
        toast.error(data.message || "Failed to trigger test notification.");
      }
    } catch (err) {
      toast.error("Network error sending test notification.");
    }
  }, [isSubscribed, subscription]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    sendTest,
    devices,
    loadingDevices,
    fetchDevices,
    revokeDevice,
  };
}
