"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ShoppingBag,
  ChefHat,
  Truck,
  Receipt,
  Headphones,
  UtensilsCrossed,
  ToggleLeft,
  Package,
  BarChart3,
  Tag,
  ShieldCheck,
  Bell,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building,
  Store,
  Sparkles,
  ExternalLink,
  CircleDot,
  Flame,
  X,
  Star,
  Bike,
} from "lucide-react";
import Tooltip from "../ui/Tooltip";
import { useTheme } from "../ui/ThemeProvider";
import { performLogout } from "@/lib/logoutHelper";

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  kitchenActive,
  activeNotice,
  unrespondedCount = 0,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { accentColor } = useTheme();
  const effectiveAccent = accentColor || "var(--brand-accent, #f97316)";

  const isLeadAdmin =
    session?.user?.role === "restaurant_admin" || session?.user?.role === "admin";
  const isStaff = session?.user?.role === "staff";
  const isRestaurantAdmin = isLeadAdmin || isStaff;

  const staffRoles = Array.isArray(session?.user?.staffRoles)
    ? session.user.staffRoles
    : session?.user?.staffRole
    ? [session.user.staffRole]
    : [];

  const [enabledFeatures, setEnabledFeatures] = useState(
    session?.user?.enabledFeatures !== undefined ? session.user.enabledFeatures : null
  );

  const [effectivePendingCount, setEffectivePendingCount] = useState(unrespondedCount);

  useEffect(() => {
    setEffectivePendingCount(unrespondedCount);
  }, [unrespondedCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleCountUpdate(e) {
      if (e.detail && typeof e.detail.count === "number") {
        setEffectivePendingCount(e.detail.count);
      }
    }
    window.addEventListener("pet_protocols_unresponded_orders_count", handleCountUpdate);
    return () => {
      window.removeEventListener("pet_protocols_unresponded_orders_count", handleCountUpdate);
    };
  }, []);

  useEffect(() => {
    if (session?.user?.enabledFeatures !== undefined) {
      setEnabledFeatures(session.user.enabledFeatures);
    }
  }, [session?.user?.enabledFeatures]);

  useEffect(() => {
    if (!isRestaurantAdmin) return;
    function refreshFeatures() {
      fetch("/api/restaurant/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.restaurant?.enabledFeatures)) {
            setEnabledFeatures(data.restaurant.enabledFeatures);
          }
        })
        .catch(() => {});
    }
    refreshFeatures();
    window.addEventListener("focus", refreshFeatures);
    window.addEventListener("pet_protocols_features_updated", refreshFeatures);
    return () => {
      window.removeEventListener("focus", refreshFeatures);
      window.removeEventListener("pet_protocols_features_updated", refreshFeatures);
    };
  }, [isRestaurantAdmin]);

  // Master Navigation Groups Definition
  const navigationGroups = useMemo(() => {
    const FEATURE_MAP = {
      "/kitchen": "kitchen",
      "/delivery": "delivery",
      "/delivery/assign": "delivery",
      "/cashier": "cashier",
      "/inventory": "inventory",
      "/standards": "standards",
      "/offers": "offers",
      "/support": "support",
      "/analytics": "analytics",
    };

    const isFeatureEnabled = (href) => {
      const featKey = FEATURE_MAP[href];
      if (!featKey) return true;
      if (enabledFeatures === null) return true;
      return enabledFeatures.includes(featKey);
    };

    if (isLeadAdmin) {
      return [
        {
          title: "Operations",
          items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: "Hub" },
            {
              href: "/orders",
              label: "Live Orders",
              icon: ShoppingBag,
              badge: effectivePendingCount > 0 ? `${effectivePendingCount} NEW` : "Live",
              isAlertBadge: effectivePendingCount > 0,
              alertCount: effectivePendingCount,
            },
            { href: "/kitchen", label: "Kitchen KDS", icon: ChefHat, badge: "KDS" },
            { href: "/delivery", label: "Delivery & Dispatch", icon: Truck },
            { href: "/delivery/assign", label: "Assign Delivery Boy", icon: Bike, badge: "Assign" },
          ].filter((item) => isFeatureEnabled(item.href)),
        },
        {
          title: "Front Desk & Billing",
          items: [
            { href: "/cashier", label: "Cashier & Billing", icon: Receipt, badge: "POS" },
            { href: "/feedback", label: "Feedback & Reviews", icon: Star, badge: "Reviews" },
            { href: "/support", label: "Customer Support", icon: Headphones },
          ].filter((item) => isFeatureEnabled(item.href)),
        },
        {
          title: "Catalog & Stock",
          items: [
            { href: "/products", label: "Dishes & Menu", icon: UtensilsCrossed },
            { href: "/products/availability", label: "Quick 86 Stock", icon: ToggleLeft, badge: "86" },
            { href: "/inventory", label: "Inventory ERP", icon: Package, badge: "ERP" },
          ].filter((item) => isFeatureEnabled(item.href)),
        },
        {
          title: "Management & Growth",
          items: [
            { href: "/analytics", label: "Sales & Analytics", icon: BarChart3 },
            { href: "/offers", label: "Offers & Coupons", icon: Tag },
            { href: "/standards", label: "Kitchen Standards", icon: ShieldCheck },
            {
              href: "/updates",
              label: "Partner Updates",
              icon: Bell,
              hasUnread: !!activeNotice,
            },
            { href: "/settings", label: "Branch Settings", icon: Settings },
          ].filter((item) => isFeatureEnabled(item.href)),
        },
      ];
    }

    if (isStaff) {
      const staffItems = [{ href: "/", label: "Front Station", icon: LayoutDashboard, badge: "Duty" }];

      if (staffRoles.includes("Delivery")) {
        staffItems.push({ href: "/delivery", label: "Delivery & Dispatch", icon: Truck });
      }
      if (staffRoles.includes("Kitchen")) {
        staffItems.push({ href: "/kitchen", label: "Kitchen KDS", icon: ChefHat, badge: "KDS" });
      }
      if (staffRoles.includes("Cashier")) {
        staffItems.push({ href: "/cashier", label: "Cashier & Billing", icon: Receipt, badge: "POS" });
      }
      if (staffRoles.includes("Inventory")) {
        staffItems.push({ href: "/inventory", label: "Inventory ERP", icon: Package, badge: "ERP" });
      }
      if (staffRoles.includes("Support")) {
        staffItems.push({ href: "/support", label: "Customer Support", icon: Headphones });
      }

      if (staffRoles.includes("Manager")) {
        // Manager role gets full station links
        return [
          {
            title: "Manager Operations",
            items: [
              { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
              {
                href: "/orders",
                label: "Live Orders",
                icon: ShoppingBag,
                badge: effectivePendingCount > 0 ? `${effectivePendingCount} NEW` : "Live",
                isAlertBadge: effectivePendingCount > 0,
                alertCount: effectivePendingCount,
              },
              { href: "/kitchen", label: "Kitchen KDS", icon: ChefHat, badge: "KDS" },
              { href: "/delivery", label: "Delivery & Dispatch", icon: Truck },
              { href: "/delivery/assign", label: "Assign Delivery Boy", icon: Bike, badge: "Assign" },
            ].filter((item) => isFeatureEnabled(item.href)),
          },
          {
            title: "Front Desk & POS",
            items: [
              { href: "/cashier", label: "Cashier & Billing", icon: Receipt, badge: "POS" },
              { href: "/feedback", label: "Feedback & Reviews", icon: Star, badge: "Reviews" },
              { href: "/support", label: "Customer Support", icon: Headphones },
            ].filter((item) => isFeatureEnabled(item.href)),
          },
          {
            title: "Menu & Inventory",
            items: [
              { href: "/products", label: "Dishes & Menu", icon: UtensilsCrossed },
              { href: "/products/availability", label: "Quick 86 Stock", icon: ToggleLeft, badge: "86" },
              { href: "/inventory", label: "Inventory ERP", icon: Package, badge: "ERP" },
            ].filter((item) => isFeatureEnabled(item.href)),
          },
          {
            title: "Insights & Standards",
            items: [
              { href: "/analytics", label: "Sales & Analytics", icon: BarChart3 },
              { href: "/offers", label: "Offers & Coupons", icon: Tag },
              { href: "/standards", label: "Kitchen Standards", icon: ShieldCheck },
              { href: "/updates", label: "Partner Updates", icon: Bell, hasUnread: !!activeNotice },
            ].filter((item) => isFeatureEnabled(item.href)),
          },
        ];
      }

      return [
        {
          title: "Your Assigned Duty",
          items: staffItems.filter((item) => isFeatureEnabled(item.href)),
        },
      ];
    }

    // Public links when not logged in
    return [
      {
        title: "Platform Overview",
        items: [
          { href: "/", label: "Partner Portal", icon: Store },
          { href: "/orders", label: "Orders Demo", icon: ShoppingBag },
          { href: "/products", label: "Menu Demo", icon: UtensilsCrossed },
          { href: "/standards", label: "Kitchen Standards", icon: ShieldCheck },
        ],
      },
    ];
  }, [isLeadAdmin, isStaff, staffRoles, enabledFeatures, activeNotice, effectivePendingCount]);

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

  const restaurantName = session?.user?.restaurantName || "Partner Kitchen";

  // Sidebar navigation item component
  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;

    const content = (
      <Link
        href={item.href}
        onClick={mobileOpen ? onCloseMobile : undefined}
        style={
          isActive
            ? {
                backgroundColor: "var(--sidebar-active-bg, rgba(249, 115, 22, 0.12))",
                borderColor: effectiveAccent,
              }
            : undefined
        }
        className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all outline-none ${
          collapsed && !mobileOpen ? "justify-center px-2 py-2.5" : ""
        } ${
          isActive
            ? "text-orange-600 dark:text-orange-400 font-bold border-l-3 shadow-xs"
            : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100/80 dark:hover:bg-white/5 border-l-3 border-transparent"
        }`}
      >
        <div className="relative shrink-0 flex items-center justify-center">
          <Icon
            size={18}
            className={`transition-colors ${
              isActive
                ? "text-orange-600 dark:text-orange-400"
                : "text-stone-400 dark:text-stone-500 group-hover:text-stone-800 dark:group-hover:text-white"
            }`}
          />
          {collapsed && !mobileOpen && item.alertCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-black px-1 min-w-[15px] h-[15px] rounded-full flex items-center justify-center animate-pulse shadow-xs border border-white dark:border-[#0b0f19]">
              {item.alertCount > 99 ? "99+" : item.alertCount}
            </span>
          )}
        </div>

        {(!collapsed || mobileOpen) && (
          <span className="truncate flex-1">{item.label}</span>
        )}

        {(!collapsed || mobileOpen) && item.badge && (
          <span
            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md shrink-0 transition-all ${
              item.isAlertBadge
                ? "bg-rose-500 text-white animate-pulse shadow-xs font-black tracking-wide"
                : isActive
                ? "bg-orange-500 text-white"
                : "bg-stone-100 dark:bg-white/10 text-stone-500 dark:text-stone-400"
            }`}
          >
            {item.badge}
          </span>
        )}

        {item.hasUnread && (
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
        )}
      </Link>
    );

    if (collapsed && !mobileOpen) {
      return (
        <Tooltip
          content={
            item.alertCount > 0
              ? `${item.label} (${item.alertCount} unresponded)`
              : item.label
          }
          placement="right"
        >
          <div>{content}</div>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR ────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex fixed top-0 left-0 bottom-0 z-40 bg-white dark:bg-[#0b0f19] border-r border-stone-200/80 dark:border-white/10 flex-col justify-between transition-all duration-200 font-jakarta ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {/* Brand Header */}
        <div className="shrink-0 p-3.5 border-b border-stone-200/80 dark:border-white/10">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className={`flex items-center gap-2.5 overflow-hidden ${
                collapsed ? "justify-center w-full" : ""
              }`}
            >
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
                <Image
                  src="/images/logo1.png"
                  alt="पेट Protocols Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>

              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-base font-extrabold tracking-tight flex items-center gap-1 leading-tight">
                    <span className="text-orange-500 font-black text-xl leading-none">पेट</span>
                    <span className="text-stone-900 dark:text-white">Protocols</span>
                  </div>
                  <div className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 truncate flex items-center gap-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        kitchenActive ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    <span className="truncate">{restaurantName}</span>
                  </div>
                </div>
              )}
            </Link>

            {!collapsed && onToggleCollapse && (
              <Tooltip content="Collapse sidebar" placement="bottom">
                <button
                  onClick={onToggleCollapse}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/10 transition cursor-pointer"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft size={16} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {navigationGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!collapsed ? (
                <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  {group.title}
                </div>
              ) : (
                <div className="w-6 mx-auto my-1 border-t border-stone-200 dark:border-white/10" />
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer: Profile & Expand Toggle */}
        <div className="shrink-0 p-2.5 border-t border-stone-200/80 dark:border-white/10 space-y-2 bg-stone-50/50 dark:bg-black/20">
          {/* User Profile Card */}
          {isRestaurantAdmin && (
            <Link
              href="/profile"
              className={`flex items-center gap-2.5 p-2 rounded-xl transition ${
                collapsed ? "justify-center" : "bg-white dark:bg-white/5 border border-stone-200/80 dark:border-white/10 hover:border-orange-500/40"
              }`}
            >
              <div className="w-7 h-7 rounded-full overflow-hidden bg-orange-500/15 text-orange-600 dark:text-orange-400 font-black flex items-center justify-center text-xs shrink-0 border border-orange-500/30">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt="User"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-stone-900 dark:text-white truncate leading-tight">
                    {session?.user?.name || "Kitchen Staff"}
                  </div>
                  <div className="text-[10px] text-stone-400 truncate">
                    {isStaff ? staffRoles.join(", ") || "Staff" : "Store Manager"}
                  </div>
                </div>
              )}
            </Link>
          )}

          {/* Bottom Expand Toggle (when collapsed) */}
          {collapsed && onToggleCollapse && (
            <Tooltip content="Expand sidebar" placement="right">
              <button
                onClick={onToggleCollapse}
                className="w-full flex items-center justify-center p-2 rounded-xl text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/10 transition cursor-pointer"
                aria-label="Expand sidebar"
              >
                <ChevronRight size={18} />
              </button>
            </Tooltip>
          )}
        </div>
      </aside>

      {/* ── MOBILE DRAWER ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          {/* Backdrop Overlay */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Body */}
          <div className="relative ml-0 w-[280px] max-w-[85vw] h-full bg-white dark:bg-[#0b0f19] shadow-2xl flex flex-col justify-between p-4 border-r border-stone-200 dark:border-white/10 animate-in slide-in-from-left duration-200 font-jakarta">
            {/* Drawer Header */}
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <Image
                    src="/images/logo1.png"
                    alt="Logo"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <span className="font-extrabold text-base tracking-tight">
                    <span className="text-orange-500">पेट</span> Protocols
                  </span>
                  <div className="text-[10px] text-stone-400 font-semibold truncate">
                    {restaurantName}
                  </div>
                </div>
              </div>

              <button
                onClick={onCloseMobile}
                type="button"
                className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-500 hover:text-stone-900 dark:hover:text-white transition flex items-center justify-center cursor-pointer active:scale-95"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Groups */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {navigationGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-1.5">
                  <div className="px-2 text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    {group.title}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <NavItem key={item.href} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Mobile Drawer Actions */}
            <div className="shrink-0 pt-3 pb-safe border-t border-stone-200 dark:border-white/10 flex flex-col gap-2">
              {isRestaurantAdmin ? (
                <>
                  <Link
                    href="/profile"
                    onClick={onCloseMobile}
                    className="min-h-[44px] flex items-center gap-2 px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 text-xs font-bold text-stone-800 dark:text-stone-200 active:scale-95"
                  >
                    <User size={16} className="text-orange-500 shrink-0" />
                    <span className="truncate flex-1">
                      {session?.user?.name || "Profile & Settings"}
                    </span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    type="button"
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 transition cursor-pointer active:scale-95"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={onCloseMobile}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 p-2.5 rounded-xl bg-orange-500 text-white font-bold text-xs shadow-xs hover:bg-orange-600 transition active:scale-95"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
