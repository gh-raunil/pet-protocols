"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle";

export default function RestaurantAdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const hidden = useHideOnScroll();

  const [activeNotice, setActiveNotice] = useState(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const isRestaurantAdmin =
    session?.user?.role === "restaurant_admin" || session?.user?.role === "admin";

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

  // Logged-in navigation tabs (clean, simple labels)
  const authNavLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orders", label: "Orders", icon: ShoppingBag },
    { href: "/products", label: "Menu", icon: UtensilsCrossed },
    { href: "/updates", label: "Messages", icon: Bell },
    { href: "/standards", label: "Standards", icon: ShieldCheck },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  // Mobile full links including Profile
  const mobileNavLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orders", label: "Orders", icon: ShoppingBag },
    { href: "/products", label: "Menu", icon: UtensilsCrossed },
    { href: "/updates", label: "Messages", icon: Bell },
    { href: "/standards", label: "Standards", icon: ShieldCheck },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/profile", label: "Profile", icon: User },
  ];

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
          <div className="bg-[#F97316] text-white text-xs font-semibold py-1.5 px-4 shadow-sm transition-all duration-300">
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
                <span className="text-[#F97316] font-extrabold text-2xl leading-none">पेट</span>
                <span className="text-[#111827] dark:text-white">Protocols</span>
              </span>
            </Link>

            {isRestaurantAdmin && session?.user?.restaurantName && (
              <div className="hidden lg:flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 px-2.5 py-0.5 rounded-full">
                <Building className="w-3.5 h-3.5 text-[#F97316]" />
                <span className="font-semibold text-stone-900 dark:text-stone-200">{session.user.restaurantName}</span>
              </div>
            )}
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
            {isRestaurantAdmin
              ? authNavLinks.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap outline-none ${
                        isActive
                          ? "bg-[#F97316] text-white shadow-sm font-bold"
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap outline-none ${
                        isActive
                          ? "bg-[#F97316] text-white shadow-sm font-bold"
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
                <Link
                  href="/profile"
                  className="hidden sm:flex items-center gap-2 bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 border border-stone-200 dark:border-white/10 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-800 dark:text-stone-200 transition"
                >
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 text-[#F97316] font-bold flex items-center justify-center text-[10px] overflow-hidden">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      session?.user?.name?.charAt(0) || "M"
                    )}
                  </div>
                  <span className="truncate max-w-[80px] font-semibold">{session?.user?.name?.split(" ")[0] || "Manager"}</span>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="hidden sm:flex items-center gap-1.5 bg-stone-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-400 hover:text-rose-600 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
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
                  href="/login"
                  className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold px-4 py-1.5 rounded-xl text-xs transition shadow-sm"
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
          <div className="relative ml-auto w-[280px] sm:w-[320px] max-w-[85vw] h-full bg-white dark:bg-[#0c0e14] shadow-2xl flex flex-col justify-between p-5 border-l border-stone-200 dark:border-white/10 animate-in slide-in-from-right duration-200">
            {/* Header info */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
                    <Image src="/images/logo1.png" alt="Logo" width={28} height={28} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-extrabold text-base">
                    <span className="text-[#F97316]">पेट</span> Protocols
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg bg-stone-100 dark:bg-white/10 text-stone-500 hover:text-stone-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isRestaurantAdmin && (
                <div className="py-3 px-3 my-3 bg-stone-50 dark:bg-white/5 rounded-xl border border-stone-200/80 dark:border-white/5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-500/20 text-[#F97316] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      session?.user?.name?.charAt(0) || "M"
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                      {session?.user?.name || "Kitchen Admin"}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                      {session?.user?.restaurantName || "Branch Operations"}
                    </div>
                  </div>
                </div>
              )}

              {/* Display Mode / Theme Switcher in Mobile Drawer */}
              <div className="flex items-center justify-between p-3 my-2.5 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200/80 dark:border-white/5">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Display Mode
                </span>
                <ThemeToggle />
              </div>

              {/* Navigation Links List */}
              <nav className="flex flex-col gap-1 mt-1">
                {isRestaurantAdmin
                  ? mobileNavLinks.map(({ href, label, icon: Icon }) => {
                      const isActive = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                            isActive
                              ? "bg-[#F97316] text-white shadow-sm font-bold"
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
                          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                            isActive
                              ? "bg-[#F97316] text-white shadow-sm font-bold"
                              : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5"
                          }`}
                        >
                          <span>{label}</span>
                        </Link>
                      );
                    })}
              </nav>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-stone-200 dark:border-white/10 flex flex-col gap-2">
              {isRestaurantAdmin ? (
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-950/40 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Exit Session / Logout</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#F97316] text-white font-bold text-xs shadow-sm hover:bg-[#EA580C] transition"
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

