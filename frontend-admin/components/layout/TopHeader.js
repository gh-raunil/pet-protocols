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
      "/delivery": { group: "Operations", label: "Delivery & Dispatch" },
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
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger button */}
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-1.5 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-white/15 transition cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-1.5 text-xs truncate">
            <span className="text-stone-400 dark:text-stone-500 font-medium hidden sm:inline">
              {breadcrumb.group}
            </span>
            <ChevronRight size={12} className="text-stone-300 dark:text-stone-600 hidden sm:inline shrink-0" />
            <h1 className="font-bold text-stone-900 dark:text-white truncate text-xs sm:text-sm">
              {breadcrumb.label}
            </h1>
          </div>
        </div>

        {/* Center / Right Section */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Superadmin Broadcast Banner Pill (if unread message exists) */}
          {activeNotice && (
            <Tooltip content={activeNotice.title} placement="bottom">
              <Link
                href="/updates"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[11px] font-bold transition animate-pulse"
              >
                <Bell size={12} className="shrink-0" />
                <span className="truncate max-w-[130px]">{activeNotice.title}</span>
              </Link>
            </Tooltip>
          )}

          {/* Kitchen Accepting Orders / Paused Toggle Pill */}
          {isRestaurantAdmin && onToggleKitchenActive && (
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
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                  kitchenActive
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 hover:bg-rose-100"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    kitchenActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                  }`}
                />
                <span>{kitchenActive ? "Accepting" : "Paused"}</span>
              </button>
            </Tooltip>
          )}

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
              className={`p-1.5 sm:px-2 sm:py-1 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                soundEnabled
                  ? "bg-stone-100 dark:bg-white/5 border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:text-orange-500"
                  : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400"
              }`}
              aria-label="Toggle kitchen audio chime alerts"
            >
              {soundEnabled ? (
                <>
                  <Volume2 size={14} className="text-orange-500" />
                  <span className="hidden xl:inline text-[11px] font-bold">Chimes On</span>
                </>
              ) : (
                <>
                  <VolumeX size={14} />
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
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 border border-stone-200 dark:border-white/10 transition text-xs font-semibold text-stone-800 dark:text-stone-200"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-orange-500/15 text-orange-600 dark:text-orange-400 font-black flex items-center justify-center text-[10px] shrink-0 border border-orange-500/30">
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
                  <span className="hidden sm:inline text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-white/10 text-stone-600 dark:text-stone-300">
                    {primaryRoleLabel}
                  </span>
                </Link>
              </Tooltip>

              <Tooltip content="Sign out of restaurant partner account" placement="bottom">
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-stone-500 hover:text-rose-600 border border-stone-200 dark:border-white/10 transition cursor-pointer"
                  aria-label="Logout"
                >
                  <LogOut size={14} />
                </button>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login/staff"
                className="hidden sm:inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 transition border border-stone-200 dark:border-white/10"
              >
                Staff Login
              </Link>
              <Link
                href="/login"
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition shadow-xs"
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
