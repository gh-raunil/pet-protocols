"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/ToastProvider";

// Utility to convert VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useWebPush() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);

  // Check support and current subscription status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);

      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) {
            setSubscription(sub);
            setIsSubscribed(true);
          } else {
            setIsSubscribed(false);
          }
        })
        .catch((err) => {
          console.warn("[WebPush] Error checking subscription:", err);
        });
    }
  }, []);

  // Subscribe to Web Push
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error("Web Push is not supported by your browser");
      return false;
    }

    try {
      setLoading(true);

      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        if (perm === "denied") {
          toast.error("Notification permission denied. Please allow notifications in site settings.");
        }
        setLoading(false);
        return false;
      }

      // 2. Fetch VAPID public key
      let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        const keyRes = await fetch("/api/push/vapid-public-key");
        const keyData = await keyRes.json();
        publicKey = keyData.publicKey;
      }

      if (!publicKey) {
        throw new Error("VAPID public key is missing on server.");
      }

      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // 3. Register push subscription with browser
      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();

      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 4. Send subscription to backend
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save subscription to server");
      }

      setSubscription(sub);
      setIsSubscribed(true);
      toast.success("Live order & push alerts enabled!");
      setLoading(false);
      return true;
    } catch (err) {
      console.error("[WebPush] Subscribe error:", err);
      toast.error(err.message || "Failed to enable push notifications");
      setLoading(false);
      return false;
    }
  }, [isSupported]);

  // Unsubscribe from Web Push
  const unsubscribe = useCallback(async () => {
    try {
      setLoading(true);
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        // Notify backend
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      setSubscription(null);
      setIsSubscribed(false);
      toast.info("Push notifications disabled");
      setLoading(false);
      return true;
    } catch (err) {
      console.error("[WebPush] Unsubscribe error:", err);
      toast.error("Failed to disable push notifications");
      setLoading(false);
      return false;
    }
  }, []);

  // Send a test push notification
  const sendTestNotification = useCallback(async () => {
    try {
      if (!isSubscribed) {
        toast.error("Please enable push notifications first");
        return;
      }

      toast.info("Sending test notification to this device...");
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription?.endpoint,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Test notification dispatched!");
      } else {
        toast.error(data.message || "Failed to trigger test notification");
      }
    } catch (err) {
      console.error("[WebPush] Test error:", err);
      toast.error("Error triggering test notification");
    }
  }, [isSubscribed, subscription]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}
