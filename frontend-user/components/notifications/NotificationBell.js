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
      fetchNotifications();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchNotifications, session]);

  if (!isMounted) {
    return (
      <div className="p-1.5 text-gray-400 opacity-60">
        <Bell size={20} />
      </div>
    );
  }

  return (
    <button
      onClick={toggleNotifications}
      aria-label="Open notifications"
      className="relative p-1.5 rounded-xl text-gray-200 light:text-stone-700 hover:text-orange-500 light:hover:text-orange-500 hover:bg-white/5 light:hover:bg-stone-200 transition duration-200 hover:scale-105"
    >
      <Bell size={21} />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold shadow-md shadow-orange-500/30 animate-pulse"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
