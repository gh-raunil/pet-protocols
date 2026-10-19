"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";
import useNotificationStore from "@/lib/notificationStore";

export default function NotificationBell() {
  const { data: session } = useSession();
  const { unreadCount, toggleNotifications, fetchNotifications } = useNotificationStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchNotifications();

    // Poll periodically for any new broadcasts (every 60 seconds)
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      fetchNotifications();
    }, 60000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchNotifications();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNotifications, session]);

  if (!isMounted) {
    return (
      <div className="p-2 rounded-xl text-[var(--text-muted)] border border-transparent min-w-[36px] min-h-[36px] flex items-center justify-center opacity-60">
        <Bell size={20} />
      </div>
    );
  }

  return (
    <button
      onClick={toggleNotifications}
      aria-label="Open notifications"
      title="Notifications & Updates"
      className="relative hover:text-[var(--brand-accent)] transition duration-200 hover:scale-105 p-2 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center min-w-[36px] min-h-[36px] cursor-pointer"
    >
      <Bell size={20} />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 bg-[var(--brand-accent)] text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold shadow-md shadow-[var(--brand-accent)]/30 animate-pulse"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
