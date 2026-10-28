"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Menu,
  Volume2,
  VolumeX,
  Bell,
  ChevronRight,
  Building,
  User,
  LogOut,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle";
import Tooltip from "../ui/Tooltip";
import { performLogout } from "@/lib/logoutHelper";

export default function TopHeader({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileMenu,
  kitchenActive,
  onToggleKitchenActive,
  activeNotice,
  onDismissNotice,
  unrespondedCount = 0,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const isLeadAdmin =
    session?.user?.role === "restaurant_admin" || session?.user?.role === "admin";
  const isStaff = session?.user?.role === "staff";
  const isRestaurantAdmin = isLeadAdmin || isStaff;

  const staffRoles = Array.isArray(session?.user?.staffRoles)
    ? session.user.staffRoles
    : session?.user?.staffRole
    ? [session.user.staffRole]
    : [];

  // Sound chimes toggle state
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pet_kitchen_sound_alerts");
      setSoundEnabled(stored !== "false");
    }
  }, []);

  function toggleSound() {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("pet_kitchen_sound_alerts", String(nextVal));
    }
  }

  // Derived Breadcrumb navigation
  const breadcrumb = useMemo(() => {
    const routeMap = {
      "/": { group: "Operations", label: isStaff ? "Front Station" : "Partner Command" },
      "/dashboard": { group: "Operations", label: "Dashboard & Sales" },
      "/orders": { group: "Operations", label: "Live Orders Queue" },
      "/kitchen": { group: "Operations", label: "Kitchen KDS" },
      "/delivery": { group: "Operations", label: "Delivery & Dispatch", mobileLabel: "Deliveries" },
      "/cashier": { group: "Front Desk", label: "Cashier & Billing" },
      "/support": { group: "Front Desk", label: "Customer Support" },
      "/products": { group: "Catalog", label: "Dishes & Menu" },
      "/products/availability": { group: "Catalog", label: "Quick 86 Availability" },
      "/inventory": { group: "Catalog", label: "Inventory ERP" },
      "/analytics": { group: "Management", label: "Sales & Analytics" },
      "/offers": { group: "Management", label: "Offers & Coupons" },
      "/standards": { group: "Management", label: "Kitchen Standards" },
      "/updates": { group: "Management", label: "Partner Messages" },
      "/settings": { group: "Management", label: "Branch Settings" },
      "/profile": { group: "Account", label: "Profile & Identity" },
      "/workspace": { group: "Staff", label: "Station Workspace" },
    };

    return routeMap[pathname] || { group: "Restaurant", label: "Management" };
  }, [pathname, isStaff]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem("pet_protocols_manager_profile");
      if (session?.user?.id || session?.user?.email) {
        localStorage.removeItem(
          `pet_protocols_staff_profile_${session.user.id || session.user.email}`
        );
      }
      await performLogout({ redirect: false });
    } catch (e) {}
    window.location.href = isStaff ? "/login/staff" : "/login";
  };

  const userInitial = (
    session?.user?.name?.trim()?.charAt(0) || (isStaff ? "S" : "M")
  ).toUpperCase();

  const primaryRoleLabel = isStaff
    ? staffRoles[0] || "Staff"
    : "Manager";

  return (
    <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-[#0b0f19]/90 backdrop-blur-md border-b border-stone-200/80 dark:border-white/10 px-4 sm:px-6 transition-colors font-jakarta">
      <div className="h-full flex items-center justify-between gap-3">
        {/* Left Section: Mobile Trigger & Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
          {/* Mobile hamburger button */}
          <button
            onClick={onOpenMobileMenu}
            type="button"
            className="md:hidden min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-white/15 transition cursor-pointer flex items-center justify-center active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-1.5 text-xs truncate min-w-0">
            <span className="text-stone-400 dark:text-stone-500 font-medium hidden sm:inline">
              {breadcrumb.group}
            </span>
            <ChevronRight size={12} className="text-stone-300 dark:text-stone-600 hidden sm:inline shrink-0" />
            <h1 className="font-bold text-stone-900 dark:text-white truncate text-xs sm:text-sm">
              <span className="sm:hidden">{breadcrumb.mobileLabel || breadcrumb.label}</span>
              <span className="hidden sm:inline">{breadcrumb.label}</span>
            </h1>
          </div>
        </div>

        {/* Center / Right Section */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Zero Platform Commission Pill */}
          <div className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span>Zero platform commision</span>
          </div>

          {/* Kitchen Accepting Orders / Paused Toggle Pill */}
          {isRestaurantAdmin && (
            <Tooltip
              content={
                kitchenActive
                  ? "Kitchen is ACCEPTING orders. Click to pause."
                  : "Kitchen is PAUSED. Customers cannot order. Click to resume."
              }
              placement="bottom"
            >
              <button
                onClick={onToggleKitchenActive}
                type="button"
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition cursor-pointer min-h-[38px] active:scale-95 ${
                  kitchenActive
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 hover:bg-rose-100"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    kitchenActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
                <span>{kitchenActive ? "Accepting Orders" : "Kitchen Paused"}</span>
              </button>
            </Tooltip>
          )}

          {/* Unread Notifications Bell with Badge */}
          <Tooltip content={`${unrespondedCount || 2} operational alerts & notifications`} placement="bottom">
            <Link
              href="/updates"
              className="relative min-w-[40px] min-h-[40px] p-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition flex items-center justify-center cursor-pointer active:scale-95 border border-stone-200/60 dark:border-white/5"
              aria-label="View notifications"
            >
              <Bell size={16} />
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs border border-white dark:border-[#0b0f19]">
                {unrespondedCount > 0 ? (unrespondedCount > 9 ? "9+" : unrespondedCount) : "2"}
              </span>
            </Link>
          </Tooltip>

          {/* Sound Alert Toggle Button */}
          <Tooltip
            content={
              soundEnabled
                ? "Kitchen audio chimes are ON. Click to mute order alerts."
                : "Kitchen audio chimes are MUTED. Click to enable."
            }
            placement="bottom"
          >
            <button
              onClick={toggleSound}
              type="button"
              className={`min-w-[40px] min-h-[40px] p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                soundEnabled
                  ? "bg-stone-100 dark:bg-white/5 border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:text-orange-500"
                  : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400"
              }`}
              aria-label="Toggle kitchen audio chime alerts"
            >
              {soundEnabled ? (
                <>
                  <Volume2 size={16} className="text-orange-500 shrink-0" />
                  <span className="hidden xl:inline text-[11px] font-bold">Chimes On</span>
                </>
              ) : (
                <>
                  <VolumeX size={16} className="shrink-0" />
                  <span className="hidden xl:inline text-[11px] font-bold">Muted</span>
                </>
              )}
            </button>
          </Tooltip>

          {/* Theme Switcher Toggle */}
          <ThemeToggle />

          {/* User Profile Pill / Auth Button */}
          {isRestaurantAdmin ? (
            <div className="flex items-center gap-1.5">
              <Tooltip
                content={`Logged in as ${session?.user?.name || "User"} (${primaryRoleLabel}) • Click to view profile`}
                placement="bottom"
              >
                <Link
                  href="/profile"
                  className="min-h-[40px] flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 border border-stone-200 dark:border-white/10 transition text-xs font-semibold text-stone-800 dark:text-stone-200 active:scale-95"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-orange-500/15 text-orange-600 dark:text-orange-400 font-black flex items-center justify-center text-xs shrink-0 border border-orange-500/30">
                    {session?.user?.image ? (
                      <img
                        src={session.user.image}
                        alt="Profile"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span>{userInitial}</span>
                    )}
                  </div>
                  <span className="hidden md:inline truncate max-w-[90px] font-bold text-[11px]">
                    {session?.user?.name?.split(" ")[0] || "Profile"}
                  </span>
                </Link>
              </Tooltip>

              <Tooltip content="Sign out of restaurant partner account" placement="bottom">
                <button
                  onClick={handleLogout}
                  type="button"
                  className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-stone-500 hover:text-rose-600 border border-stone-200 dark:border-white/10 transition cursor-pointer flex items-center justify-center active:scale-95"
                  aria-label="Logout"
                >
                  <LogOut size={16} />
                </button>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login/staff"
                className="hidden sm:inline-flex items-center text-xs font-bold px-3 py-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 transition border border-stone-200 dark:border-white/10 min-h-[44px]"
              >
                Staff Login
              </Link>
              <Link
                href="/login"
                className="min-h-[44px] flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs active:scale-95 cursor-pointer"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
