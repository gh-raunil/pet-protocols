import { signOut } from "next-auth/react";

/**
 * Cleanly logs out admin/staff and removes push notification subscription from both
 * the local device and backend database so notifications cease immediately upon logout.
 */
export async function performLogout(options = { redirect: false, callbackUrl: null }) {
  try {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      const swReadyPromise = navigator.serviceWorker.ready;
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 1200));
      const reg = await Promise.race([swReadyPromise, timeoutPromise]);

      if (reg && reg.pushManager) {
        const sub = await reg.pushManager.getSubscription().catch(() => null);
        if (sub) {
          const endpoint = sub.endpoint;
          // Unlink and delete from backend DB
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          }).catch((err) => console.warn("[Logout] Push backend unsubscribe failed:", err));

          // Unsubscribe in browser
          await sub.unsubscribe().catch((err) => console.warn("[Logout] Local push unsubscribe failed:", err));
        }
      }
    }
  } catch (error) {
    console.warn("[Logout] Push cleanup error on logout:", error);
  }

  try {
    if (options.callbackUrl) {
      await signOut({ callbackUrl: options.callbackUrl });
    } else {
      await signOut({ redirect: options.redirect ?? false });
    }
  } catch (e) {
    console.warn("[Logout] SignOut error:", e);
    if (options.callbackUrl) {
      window.location.href = options.callbackUrl;
    }
  }
}
