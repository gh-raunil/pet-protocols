"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Settings,
  LogOut,
  Building,
  Bell,
  Award,
  User,
  X,
  ArrowRight,
  ShieldCheck,
  Truck,
  ChefHat,
  Receipt,
  Package,
  Headphones,
  Tag,
  BarChart3,
} from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle";
import { useTheme } from "../ui/ThemeProvider";

export default function RestaurantAdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const hidden = useHideOnScroll();
  const { accentColor } = useTheme();
  const effectiveAccentColor = accentColor || "var(--brand-accent, #f97316)";

  const [activeNotice, setActiveNotice] = useState(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState(null);

  const isLeadAdmin =
    session?.user?.role === "restaurant_admin" || session?.user?.role === "admin";
  const isStaff = session?.user?.role === "staff";
  const isRestaurantAdmin = isLeadAdmin || isStaff;

  const userPermissions = Array.isArray(session?.user?.permissions) ? session.user.permissions : [];
  const staffRoles = Array.isArray(session?.user?.staffRoles)
    ? session.user.staffRoles
    : session?.user?.staffRole
    ? [session.user.staffRole]
    : [];

  const handleLogout = async () => {
    try {
      localStorage.removeItem("pet_protocols_manager_profile");
      if (session?.user?.id || session?.user?.email) {
        localStorage.removeItem(`pet_protocols_staff_profile_${session.user.id || session.user.email}`);
      }
      await signOut({ redirect: false });
    } catch (e) {}
    window.location.href = isStaff ? "/login/staff" : "/login";
  };

  // Sync avatar from scoped storage and backend
  useEffect(() => {
    setProfileAvatar(null);

    if (!session?.user) return;

    if (isStaff) {
      // 1. Staff scoped storage (never manager storage)
      try {
        const staffKey = `pet_protocols_staff_profile_${session.user.id || session.user.email}`;
        const stored = localStorage.getItem(staffKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.image) {
            setProfileAvatar(parsed.image);
            return;
          }
        }
      } catch (e) {}

      // 2. Fallback to session image if present
      if (session.user.image) {
        setProfileAvatar(session.user.image);
      }

      // 3. Backend profile sync for this staff user
      fetch("/api/restaurant/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setProfileAvatar(data.user?.image || null);
          }
        })
        .catch(() => {});
      return;
    }

    if (isLeadAdmin) {
      try {
        const stored = localStorage.getItem("pet_protocols_manager_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          // Only use if email matches current admin or no email stored yet
          if (!parsed.email || !session?.user?.email || parsed.email.toLowerCase() === session.user.email.toLowerCase()) {
            if (parsed.image) setProfileAvatar(parsed.image);
          }
        }
      } catch (e) {}

      fetch("/api/restaurant/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user?.image) {
            setProfileAvatar(data.user.image);
          }
        })
        .catch(() => {});
    }
  }, [session?.user?.id, session?.user?.email, isStaff, isLeadAdmin]);

  // Real-time synchronization when photo is uploaded
  useEffect(() => {
    function handleProfileUpdate(e) {
      if (isStaff) {
        if (e.detail?.isStaff !== undefined && !e.detail.isStaff) return;
        if (e.detail?.email && session?.user?.email && e.detail.email.toLowerCase() !== session.user.email.toLowerCase()) return;
        setProfileAvatar(e.detail?.image || null);
      } else if (isLeadAdmin) {
        if (e.detail?.isStaff) return;
        if (e.detail?.email && session?.user?.email && e.detail.email.toLowerCase() !== session.user.email.toLowerCase()) return;
        if (e.detail?.image) setProfileAvatar(e.detail.image);
      }
    }

    function handleStorage(e) {
      if (isLeadAdmin && e.key === "pet_protocols_manager_profile" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (!parsed.email || !session?.user?.email || parsed.email.toLowerCase() === session.user.email.toLowerCase()) {
            if (parsed.image) setProfileAvatar(parsed.image);
          }
        } catch (err) {}
      }

      if (
        isStaff &&
        session?.user &&
        e.key === `pet_protocols_staff_profile_${session.user.id || session.user.email}` &&
        e.newValue
      ) {
        try {
          const parsed = JSON.parse(e.newValue);
          setProfileAvatar(parsed.image || null);
        } catch (err) {}
      }
    }

    window.addEventListener("pet_protocols_profile_updated", handleProfileUpdate);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("pet_protocols_profile_updated", handleProfileUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [isStaff, isLeadAdmin, session?.user?.id, session?.user?.email]);

  const effectiveAvatar = isStaff
    ? (profileAvatar || session?.user?.image || null)
    : (profileAvatar || session?.user?.image || null);

  const userInitial = (
    session?.user?.name?.trim()?.charAt(0) || (isStaff ? "S" : "M")
  ).toUpperCase();

  // Superadmin broadcast notice — ONLY visible and loaded if restaurant is logged in
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
            setNoticeDismissed(true);
          }
        } else {
          setNoticeDismissed(true);
        }
      } catch (err) {
        console.error("Failed to load notice", err);
      }
    }
    loadNotice();
  }, [isRestaurantAdmin]);

  // When visiting the messages page, dismiss notice
  useEffect(() => {
    if (pathname === "/updates" && activeNotice) {
      handleDismissNotice();
    }
  }, [pathname, activeNotice]);

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
    } catch (e) {
      console.error(e);
    }
    setNoticeDismissed(true);
  }

  // Handle protected link clicks when not logged in
  function handleProtectedNav(e, href) {
    if (!isRestaurantAdmin) {
      e.preventDefault();
      router.push(`/login?callbackUrl=${encodeURIComponent(href)}`);
    }
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const [enabledFeatures, setEnabledFeatures] = useState(
    session?.user?.enabledFeatures !== undefined ? session.user.enabledFeatures : null
  );

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

  // Logged-in navigation tabs dynamically tailored to role & Superadmin feature permissions
  const authNavLinks = useMemo(() => {
    let rawLinks = [];
    if (isLeadAdmin) {
      rawLinks = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/orders", label: "Orders", icon: ShoppingBag },
        { href: "/products", label: "Menu", icon: UtensilsCrossed },
        { href: "/kitchen", label: "Kitchen KDS", icon: ChefHat },
        { href: "/delivery", label: "Delivery", icon: Truck },
        { href: "/cashier", label: "Cashier", icon: Receipt },
        { href: "/inventory", label: "Inventory", icon: Package },
        { href: "/standards", label: "Standards", icon: ShieldCheck },
        { href: "/offers", label: "Offers", icon: Tag },
        { href: "/support", label: "Support", icon: Headphones },
        { href: "/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/updates", label: "Messages", icon: Bell },
        { href: "/settings", label: "Settings", icon: Settings },
      ];
    } else if (isStaff) {
      // Front page Station
      rawLinks.push({ href: "/", label: "Front Station", icon: LayoutDashboard });

      if (staffRoles.includes("Delivery")) {
        rawLinks.push({ href: "/delivery", label: "Delivery", icon: Truck });
      }
      if (staffRoles.includes("Kitchen")) {
        rawLinks.push({ href: "/kitchen", label: "Kitchen KDS", icon: ChefHat });
      }
      if (staffRoles.includes("Cashier")) {
        rawLinks.push({ href: "/cashier", label: "Cashier", icon: Receipt });
      }
      if (staffRoles.includes("Inventory")) {
        rawLinks.push({ href: "/inventory", label: "Inventory", icon: Package });
      }
      if (staffRoles.includes("Support")) {
        rawLinks.push({ href: "/support", label: "Support", icon: Headphones });
      }
      if (staffRoles.includes("Manager")) {
        rawLinks.push({ href: "/orders", label: "Orders", icon: ShoppingBag });
        rawLinks.push({ href: "/products", label: "Menu", icon: UtensilsCrossed });
        rawLinks.push({ href: "/kitchen", label: "Kitchen KDS", icon: ChefHat });
        rawLinks.push({ href: "/delivery", label: "Delivery", icon: Truck });
        rawLinks.push({ href: "/cashier", label: "Cashier", icon: Receipt });
        rawLinks.push({ href: "/inventory", label: "Inventory", icon: Package });
        rawLinks.push({ href: "/standards", label: "Standards", icon: ShieldCheck });
        rawLinks.push({ href: "/offers", label: "Offers", icon: Tag });
        rawLinks.push({ href: "/support", label: "Support", icon: Headphones });
        rawLinks.push({ href: "/analytics", label: "Analytics", icon: BarChart3 });
        rawLinks.push({ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard });
      }
    }

    const FEATURE_MAP = {
      "/inventory": "inventory",
      "/kitchen": "kitchen",
      "/delivery": "delivery",
      "/cashier": "cashier",
      "/standards": "standards",
      "/offers": "offers",
      "/support": "support",
      "/analytics": "analytics",
    };

    const activeFeatures = enabledFeatures !== null
      ? enabledFeatures
      : (Array.isArray(session?.user?.enabledFeatures) ? session.user.enabledFeatures : null);

    if (activeFeatures !== null) {
      return rawLinks.filter((link) => {
        const featKey = FEATURE_MAP[link.href];
        if (featKey) {
          return activeFeatures.includes(featKey);
        }
        return true;
      });
    }

    return rawLinks;
  }, [isLeadAdmin, isStaff, staffRoles, enabledFeatures, session?.user?.enabledFeatures]);

  // Mobile full links including Profile
  const mobileNavLinks = useMemo(() => {
    return [...authNavLinks, { href: "/profile", label: "Profile", icon: User }];
  }, [authNavLinks]);

  // Public links when not logged in
  const publicNavLinks = [
    { href: "/", label: "Overview", requiresAuth: false },
    { href: "/orders", label: "Orders", requiresAuth: true },
    { href: "/products", label: "Menu", requiresAuth: true },
    { href: "/updates", label: "Messages", requiresAuth: true },
    { href: "/standards", label: "Standards", requiresAuth: true },
  ];

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#07090e]/95 backdrop-blur-md border-b border-stone-200/80 dark:border-white/10 shadow-xs dark:shadow-none transition-transform duration-300 ease-in-out font-jakarta ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        {/* ── LIVE SUPERADMIN NOTICE TICKER (ONLY FOR LOGGED-IN RESTAURANT ADMIN) ── */}
        {isRestaurantAdmin && !noticeDismissed && activeNotice && (
          <div className="bg-orange-500 text-white text-xs font-semibold py-1.5 px-4 shadow-sm transition-all duration-300">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-hidden">
              <div className="flex items-center gap-2 truncate">
                <span className="bg-black/25 text-white uppercase px-2 py-0.5 rounded text-[9px] tracking-wider shrink-0 font-bold flex items-center gap-1">
                  <Bell size={10} className="text-yellow-200 animate-pulse" />
                  {activeNotice.tag || "NOTICE"}
                </span>
                <span className="truncate text-white font-medium">
                  <strong className="font-bold">{activeNotice.title}</strong> — {activeNotice.summary || activeNotice.content}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/updates"
                  onClick={handleDismissNotice}
                  className="hidden sm:inline-flex items-center gap-1 text-xs underline font-bold hover:text-orange-100 transition"
                >
                  <span>View</span>
                  <ArrowRight size={11} />
                </Link>
                <button
                  onClick={handleDismissNotice}
                  className="text-white/80 hover:text-white transition p-0.5 rounded hover:bg-black/20"
                  title="Dismiss notice"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TOPBAR ─────────────────────────────────── */}
        <header className="px-4 sm:px-6 py-2.5 max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand with Hindi पेट and Storefront logo identity */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
                <Image src="/images/logo1.png" alt="Logo" width={32} height={32} className="w-full h-full object-cover rounded-full" />
              </div>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center gap-1">
                <span className="text-orange-500 font-extrabold text-2xl leading-none">पेट</span>
                <span className="text-[#111827] dark:text-white">Protocols</span>
              </span>
            </Link>

            {isRestaurantAdmin && session?.user?.restaurantName && (
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 px-2.5 py-0.5 rounded-full">
                <Building className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-semibold text-stone-900 dark:text-stone-200">{session.user.restaurantName}</span>
              </div>
            )}
          </div>

          {/* Desktop Navigation Tabs with Thin Horizontal Scrollbar */}
          <style>{`
            .nav-scrollbar-ultra-thin::-webkit-scrollbar {
              height: 2px !important;
            }
            .nav-scrollbar-ultra-thin::-webkit-scrollbar-track {
              background: transparent !important;
            }
            .nav-scrollbar-ultra-thin::-webkit-scrollbar-thumb {
              background: ${effectiveAccentColor} !important;
              border-radius: 9999px !important;
            }
          `}</style>
          <nav
            className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-thin-accent nav-scrollbar-ultra-thin py-1 min-w-0"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: `${effectiveAccentColor} transparent`,
            }}
          >
            {isRestaurantAdmin
              ? authNavLinks.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      style={isActive ? { backgroundColor: effectiveAccentColor } : undefined}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap outline-none ${
                        isActive
                          ? "text-white shadow-sm font-bold"
                          : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </Link>
                  );
                })
              : publicNavLinks.map(({ href, label, requiresAuth }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={(e) => {
                        if (requiresAuth) handleProtectedNav(e, href);
                      }}
                      style={isActive ? { backgroundColor: effectiveAccentColor } : undefined}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap outline-none ${
                        isActive
                          ? "text-white shadow-sm font-bold"
                          : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/5"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Desktop Light/Dark Toggle */}
            <div className="hidden md:flex items-center">
              <ThemeToggle />
            </div>

            {isRestaurantAdmin ? (
              <div className="flex items-center gap-2">
                {/* Desktop Profile Pill — Scoped for Staff or Manager */}
                <Link
                  href="/profile"
                  className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold ${
                    pathname === "/profile"
                      ? isStaff
                        ? "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/40 text-orange-600 dark:text-orange-400 ring-2 ring-orange-500/20 shadow-xs"
                      : "bg-stone-100/90 dark:bg-white/5 hover:bg-stone-200/80 dark:hover:bg-white/10 border-stone-200/80 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white"
                  }`}
                  title={isStaff ? "Staff Profile" : "Manager Profile"}
                >
                  <div
                    className={`w-6 h-6 rounded-full overflow-hidden font-bold flex items-center justify-center text-[11px] shrink-0 ring-1 ${
                      isStaff
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30"
                        : "bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-orange-500/30"
                    }`}
                  >
                    {effectiveAvatar ? (
                      <img
                        src={effectiveAvatar}
                        alt={session?.user?.name || (isStaff ? "Staff" : "Manager")}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span>{userInitial}</span>
                    )}
                  </div>
                  <span className="truncate max-w-[85px]">
                    {session?.user?.name?.split(" ")[0] || (isStaff ? "Staff" : "Profile")}
                  </span>
                  {isStaff && staffRoles.length > 0 && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                      {staffRoles[0]}
                    </span>
                  )}
                </Link>

                {/* Mobile Profile Avatar — Scoped for Staff or Manager */}
                <Link
                  href="/profile"
                  className={`md:hidden relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                    pathname === "/profile"
                      ? isStaff
                        ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-[#07090e]"
                        : "ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-[#07090e]"
                      : "border border-stone-200/90 dark:border-white/15"
                  }`}
                  title={isStaff ? "Staff Profile" : "Manager Profile"}
                >
                  {effectiveAvatar ? (
                    <img
                      src={effectiveAvatar}
                      alt={session?.user?.name || (isStaff ? "Staff" : "Manager")}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div
                      className={`w-full h-full font-bold flex items-center justify-center text-xs ${
                        isStaff
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                      }`}
                    >
                      <span>{userInitial}</span>
                    </div>
                  )}
                </Link>

                <button
                  onClick={handleLogout}
                  className="hidden md:flex items-center gap-1.5 bg-stone-100/90 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-stone-200/80 dark:border-white/10 text-stone-600 dark:text-stone-400 hover:text-rose-600 px-3 py-1.5 rounded-full text-xs font-semibold transition"
                  title="Sign out"
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>

                {/* Mobile Hamburger Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden flex items-center justify-center p-2 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-white/20 transition"
                  aria-label="Toggle Navigation Menu"
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login/staff"
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 transition border border-stone-200/80 dark:border-white/10"
                >
                  <ChefHat size={13} className="text-emerald-500" />
                  <span>Staff Login</span>
                </Link>
                <Link
                  href="/login"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition shadow-sm"
                >
                  Sign In
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden flex items-center justify-center p-2 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-white/20 transition"
                  aria-label="Toggle Navigation Menu"
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        </header>
      </div>

      {/* ── RESPONSIVE MOBILE DRAWER / HAMBURGER MENU ─────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Menu Surface */}
          <div className="relative ml-auto w-[285px] sm:w-[320px] max-w-[85vw] h-full max-h-screen bg-white dark:bg-[#0c0e14] shadow-2xl flex flex-col justify-between p-4 sm:p-5 border-l border-stone-200 dark:border-white/10 animate-in slide-in-from-right duration-200 overflow-hidden">
            {/* Header info (fixed at top of drawer) */}
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <Image src="/images/logo1.png" alt="Logo" width={28} height={28} className="w-full h-full object-cover" />
                </div>
                <span className="font-extrabold text-base">
                  <span className="text-orange-500">पेट</span> Protocols
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-white/10 text-stone-500 hover:text-stone-900 dark:hover:text-white"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 overflow-y-auto min-h-0 py-2.5 space-y-2 pr-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {isRestaurantAdmin && (
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group block p-3 rounded-2xl border transition-all cursor-pointer ${
                    pathname === "/profile"
                      ? isStaff
                        ? "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30 shadow-xs"
                        : "bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/40 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/30 shadow-xs"
                      : "bg-stone-50 dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 border-stone-200/80 dark:border-white/5 text-stone-900 dark:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full font-bold flex items-center justify-center shrink-0 overflow-hidden ring-2 ${
                          isStaff
                            ? "bg-emerald-500/20 text-emerald-500 ring-emerald-500/30"
                            : "bg-orange-500/20 text-orange-500 ring-orange-500/30"
                        }`}
                      >
                        {effectiveAvatar ? (
                          <img
                            src={effectiveAvatar}
                            alt={session?.user?.name || (isStaff ? "Staff" : "Manager")}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <span>{userInitial}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                          {session?.user?.name || (isStaff ? "Staff Member" : "Kitchen Admin")}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 truncate flex items-center gap-1.5">
                          <span>{session?.user?.restaurantName || "Branch Operations"}</span>
                          {isStaff && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              • {staffRoles.join(", ") || "Staff"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
                        isStaff
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white"
                          : "text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/20 group-hover:bg-orange-500 group-hover:text-white"
                      }`}
                    >
                      <span>Profile</span>
                      <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              )}

              {/* Display Mode / Theme Switcher in Mobile Drawer */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200/80 dark:border-white/5">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Display Mode
                </span>
                <ThemeToggle />
              </div>

              {/* Navigation Links List */}
              <nav className="flex flex-col gap-0.5 pt-0.5">
                {isRestaurantAdmin
                  ? authNavLinks.map(({ href, label, icon: Icon }) => {
                      const isActive = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                            isActive
                              ? "bg-orange-500 text-white shadow-xs font-bold"
                              : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5"
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{label}</span>
                        </Link>
                      );
                    })
                  : publicNavLinks.map(({ href, label, requiresAuth }) => {
                      const isActive = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={(e) => {
                            setMobileMenuOpen(false);
                            if (requiresAuth) handleProtectedNav(e, href);
                          }}
                          className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                            isActive
                              ? "bg-orange-500 text-white shadow-xs font-bold"
                              : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5"
                          }`}
                        >
                          <span>{label}</span>
                        </Link>
                      );
                    })}
              </nav>
            </div>

            {/* Bottom Actions (fixed at bottom of drawer) */}
            <div className="shrink-0 pt-3 border-t border-stone-200 dark:border-white/10 flex flex-col gap-2">
              {isRestaurantAdmin ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-950/40 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Exit Session / Logout</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-orange-500 text-white font-bold text-xs shadow-sm hover:bg-orange-600 transition"
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

