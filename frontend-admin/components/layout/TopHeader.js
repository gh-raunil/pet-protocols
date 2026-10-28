"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Menu,
  Volume2,
  VolumeX,
  Bell,
  ChevronRight,
  User,
  LogOut,
  AlertTriangle,
  Check,
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
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pet_kitchen_sound_alerts");
      setSoundEnabled(stored !== "false");
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [profileDropdownOpen]);

  useEffect(() => {
    setProfileDropdownOpen(false);
  }, [pathname]);

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
      "/": { group: "Operations", label: "Front Station" },
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
  }, [pathname]);

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

  const displayName = session?.user?.name?.split(" ")[0] || "Boy";
  const userInitial = (
    session?.user?.name?.trim()?.charAt(0) || "B"
  ).toUpperCase();

  const primaryRoleLabel = isStaff
    ? staffRoles[0] || "Staff"
    : "Manager";

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#0b0f19] border-b border-stone-200/80 dark:border-white/10 px-4 sm:px-6 transition-colors font-jakarta">
      <div className="h-full flex items-center justify-between gap-3">
        {/* Left Section: Mobile Trigger & Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
          {/* Mobile hamburger button */}
          <button
            onClick={onOpenMobileMenu}
            type="button"
            className="md:hidden min-w-[40px] min-h-[40px] p-2 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-white/15 transition cursor-pointer flex items-center justify-center active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-2 text-xs sm:text-sm truncate min-w-0">
            <span className="text-stone-400 dark:text-stone-500 font-medium hidden sm:inline">
              {breadcrumb.group}
            </span>
            <ChevronRight size={13} className="text-stone-400 dark:text-stone-500 hidden sm:inline shrink-0" />
            <h1 className="font-bold text-stone-900 dark:text-white truncate text-xs sm:text-sm">
              <span className="sm:hidden">{breadcrumb.mobileLabel || breadcrumb.label}</span>
              <span className="hidden sm:inline">{breadcrumb.label}</span>
            </h1>
          </div>
        </div>

        {/* Center / Right Section */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Unread Notifications Bell with Badge */}
          <Tooltip content={`${unrespondedCount || 2} operational alerts & notifications`} placement="bottom">
            <Link
              href="/updates"
              className="relative p-2 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="View notifications"
            >
              <Bell size={18} />
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ea580c] text-white text-[10px] font-bold flex items-center justify-center shadow-2xs leading-none">
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
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer select-none active:scale-95 ${
                soundEnabled
                  ? "bg-white dark:bg-transparent border-stone-200 dark:border-white/15 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-white/5"
                  : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400"
              }`}
              aria-label="Toggle kitchen audio chime alerts"
            >
              {soundEnabled ? (
                <>
                  <Volume2 size={15} className="text-orange-500 shrink-0" />
                  <span>Chimes On</span>
                </>
              ) : (
                <>
                  <VolumeX size={15} className="shrink-0 text-stone-400" />
                  <span>Muted</span>
                </>
              )}
            </button>
          </Tooltip>

          {/* User Profile Pill */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              type="button"
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-stone-100 dark:hover:bg-white/5 transition cursor-pointer select-none active:scale-95"
              aria-expanded={profileDropdownOpen}
              aria-label="User account menu"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden bg-[#ffedd5] dark:bg-orange-950/60 text-[#ea580c] dark:text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 border border-[#fed7aa] dark:border-orange-500/30">
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
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate max-w-[100px]">
                {displayName}
              </span>
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-[#111622] shadow-xl border border-stone-200/80 dark:border-white/10 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-stone-100 dark:border-white/10 mb-1">
                  <div className="text-xs font-bold text-stone-900 dark:text-white truncate">
                    {session?.user?.name || "Boy (Staff)"}
                  </div>
                  <div className="text-[10px] text-stone-400 truncate mt-0.5">
                    {session?.user?.email || `${primaryRoleLabel} • Active`}
                  </div>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10 transition"
                >
                  <User size={14} className="text-orange-500" />
                  <span>Profile & Identity</span>
                </Link>

                <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl text-stone-700 dark:text-stone-300">
                  <span>Theme Mode</span>
                  <ThemeToggle />
                </div>

                {isRestaurantAdmin ? (
                  <button
                    onClick={handleLogout}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer mt-1 border-t border-stone-100 dark:border-white/10"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition cursor-pointer mt-1 border-t border-stone-100 dark:border-white/10"
                  >
                    <User size={14} />
                    <span>Sign In</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
