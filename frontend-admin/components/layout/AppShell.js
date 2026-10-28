"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import GlobalKitchenOrderListener from "./GlobalKitchenOrderListener";
import MobileBottomNav from "./MobileBottomNav";

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isLeadAdmin =
    session?.user?.role === "restaurant_admin" || session?.user?.role === "admin";
  const isStaff = session?.user?.role === "staff";
  const isRestaurantAdmin = isLeadAdmin || isStaff;

  // Sidebar collapsed state for desktop (persisted in localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Kitchen active status state
  const [kitchenActive, setKitchenActive] = useState(true);

  // Real-time unresponded new orders count
  const [unrespondedOrdersCount, setUnrespondedOrdersCount] = useState(0);

  // Superadmin broadcast notice
  const [activeNotice, setActiveNotice] = useState(null);

  // Check auth routes
  const isAuthPage = pathname === "/login" || pathname === "/login/staff";

  // Hydrate collapsed state and pending count from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pet_admin_sidebar_collapsed");
      if (stored === "true") {
        setSidebarCollapsed(true);
      }
      const storedKitchen = localStorage.getItem("restaurant_kitchen_active");
      if (storedKitchen !== null) {
        setKitchenActive(storedKitchen !== "false");
      }
      const storedCount = localStorage.getItem("pet_protocols_pending_orders_count");
      if (storedCount !== null) {
        setUnrespondedOrdersCount(Number(storedCount) || 0);
      }

      function handleCountEvent(e) {
        if (e.detail && typeof e.detail.count === "number") {
          setUnrespondedOrdersCount(e.detail.count);
        }
      }

      function handleStorage(e) {
        if (e.key === "restaurant_kitchen_active") {
          setKitchenActive(e.newValue !== "false");
        } else if (e.key === "pet_protocols_pending_orders_count") {
          setUnrespondedOrdersCount(Number(e.newValue) || 0);
        }
      }

      window.addEventListener("pet_protocols_unresponded_orders_count", handleCountEvent);
      window.addEventListener("storage", handleStorage);
      return () => {
        window.removeEventListener("pet_protocols_unresponded_orders_count", handleCountEvent);
        window.removeEventListener("storage", handleStorage);
      };
    }
  }, []);

  function toggleSidebarCollapse() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("pet_admin_sidebar_collapsed", String(next));
      }
      return next;
    });
  }

  function toggleKitchenActive() {
    setKitchenActive((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("restaurant_kitchen_active", String(next));
      }
      return next;
    });
  }

  // Superadmin broadcast notice loader
  useEffect(() => {
    if (!isRestaurantAdmin) {
      setActiveNotice(null);
      return;
    }

    async function loadNotice() {
      try {
        const res = await fetch("/api/messages?target=restaurants");
        const data = await res.json();
        if (data.success && data.messages?.length > 0) {
          const dismissedList = JSON.parse(
            localStorage.getItem("dismissed_partner_notices") || "[]"
          );
          const unread = data.messages.find((m) => !dismissedList.includes(m.id || m._id));
          if (unread) {
            setActiveNotice(unread);
          } else {
            setActiveNotice(null);
          }
        } else {
          setActiveNotice(null);
        }
      } catch (err) {
        // Silent background check
      }
    }

    loadNotice();
    const interval = setInterval(loadNotice, 60000);
    return () => clearInterval(interval);
  }, [isRestaurantAdmin]);

  // Dismiss notice
  function handleDismissNotice() {
    if (!activeNotice) return;
    try {
      const noticeId = activeNotice.id || activeNotice._id;
      const dismissedList = JSON.parse(
        localStorage.getItem("dismissed_partner_notices") || "[]"
      );
      if (!dismissedList.includes(noticeId)) {
        dismissedList.push(noticeId);
        localStorage.setItem("dismissed_partner_notices", JSON.stringify(dismissedList));
      }
      fetch(`/api/messages/${noticeId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: session?.user?.restaurantId || "partner" }),
      }).catch(() => {});
    } catch (e) {}
    setActiveNotice(null);
  }

  // Automatically close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Auth pages (login, staff login) render with clean distraction-free layout
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] font-jakarta flex flex-col justify-center items-center">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] font-jakarta flex">
      {/* Background kitchen order listener & sound alert manager */}
      <GlobalKitchenOrderListener onPendingCountChange={setUnrespondedOrdersCount} />

      {/* Main SaaS Collapsible Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        kitchenActive={kitchenActive}
        activeNotice={activeNotice}
        unrespondedCount={unrespondedOrdersCount}
      />

      {/* Main Content Area with Dynamic Padding for Collapsed vs Expanded Sidebar */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-200 ${
          sidebarCollapsed ? "md:pl-[72px]" : "md:pl-[260px]"
        }`}
      >
        <TopHeader
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebarCollapse}
          onOpenMobileMenu={() => setMobileOpen(true)}
          kitchenActive={kitchenActive}
          onToggleKitchenActive={isRestaurantAdmin ? toggleKitchenActive : undefined}
          activeNotice={activeNotice}
          onDismissNotice={handleDismissNotice}
          unrespondedCount={unrespondedOrdersCount}
        />

        <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
      </div>

      {/* Mobile Bottom Shortcut Dock */}
      <MobileBottomNav />
    </div>
  );
}
