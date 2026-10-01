"use client";
import { useState, useEffect, useRef } from "react";
import useCartStore from "@/lib/cartStore";
import { useSession, signOut } from "next-auth/react";
import {
  ShoppingCart,
  ChevronDown,
  User,
  Package,
  LogOut,
  Store,
  ShieldCheck,
  UtensilsCrossed,
  ClipboardList,
  Settings,
  ArrowRight,
  Award,
  Bell,
} from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle";
import NotificationBell from "../notifications/NotificationBell";
import useNotificationStore from "@/lib/notificationStore";
import Link from "next/link";
import Image from "next/image";

const RightSection = () => {
  const { getTotalItems, openCart, clearCartLocal } = useCartStore();
  const { openNotifications, unreadCount } = useNotificationStore();
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalItems = getTotalItems();

  const handleLogout = () => {
    clearCartLocal();
    signOut({ callbackUrl: "/" });
  };

  const role = session?.user?.role;
  const isRestaurantAdmin = role === "restaurant_admin" || role === "admin";
  const isSuperadmin = role === "superadmin";

  const defaultAdminUrl = typeof window !== "undefined" && !window.location.hostname.includes("localhost")
    ? "https://pet-protocols-restaurant.vercel.app"
    : "http://localhost:3001";
  const defaultSuperadminUrl = typeof window !== "undefined" && !window.location.hostname.includes("localhost")
    ? "https://pet-protocols-superadmin.vercel.app"
    : "http://localhost:3002";

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || defaultAdminUrl;
  const superadminUrl = process.env.NEXT_PUBLIC_SUPERADMIN_URL || defaultSuperadminUrl;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
      {/* Light / Dark Mode Quick Toggle */}
      <ThemeToggle />

      {/* Customer Notifications (Desktop) */}
      {!isRestaurantAdmin && !isSuperadmin && (
        <div className="hidden sm:block">
          <NotificationBell />
        </div>
      )}

      {/* Cart Icon Button */}
      {!isRestaurantAdmin && !isSuperadmin && (
        <button
          className="relative hover:text-[var(--brand-accent)] transition duration-200 hover:scale-105 p-2 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center min-w-[38px] min-h-[38px]"
          onClick={() => openCart()}
          aria-label="Open Cart"
        >
          <ShoppingCart size={19} />
          {isMounted && totalItems > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[var(--brand-accent)] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-md shadow-[var(--brand-accent)]/30">
              {totalItems}
            </span>
          )}
        </button>
      )}

      {/* Auth Dropdown or Login Button (Visible on sm+ screens; on mobile, managed in Hamburger Drawer) */}
      {session ? (
        <div className="hidden sm:block relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-label="Account Menu"
            className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-full pl-1 pr-3 py-1 hover:border-[var(--brand-accent)] transition shadow-sm"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] font-bold flex items-center justify-center text-xs overflow-hidden">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  width={28}
                  height={28}
                  unoptimized={session.user.image.startsWith("data:")}
                  className="rounded-full object-cover w-7 h-7"
                />
              ) : (
                <span>{session.user.name?.charAt(0)?.toUpperCase() || "U"}</span>
              )}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs text-[var(--text-main)] font-semibold leading-tight truncate max-w-[85px]">
                {session.user.name?.split(" ")[0]}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--brand-accent)]">
                {isSuperadmin ? "Superadmin" : isRestaurantAdmin ? "Kitchen Admin" : "Foodie"}
              </span>
            </div>
            <ChevronDown
              size={13}
              className={`text-[var(--text-muted)] transition-transform duration-200 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-11 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-2xl z-50 py-1">
              {/* Account Header */}
              <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-sub)]">
                <p className="text-xs font-bold text-[var(--text-main)] truncate">{session.user.name}</p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">{session.user.email}</p>
                {isRestaurantAdmin && (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30">
                    🏢 {session.user.restaurantName || "Partner Kitchen"}
                  </span>
                )}
                {isSuperadmin && (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-500 border border-red-500/30">
                    🛡️ Root Platform Owner
                  </span>
                )}
              </div>

              {/* ── RESTAURANT ADMIN LINKS ── */}
              {isRestaurantAdmin && (
                <>
                  <div className="p-2">
                    <a
                      href={`${adminUrl}/dashboard`}
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-xs transition shadow-md shadow-[var(--brand-accent)]/20"
                    >
                      <span className="flex items-center gap-2">
                        <Store size={15} /> Open Kitchen Dashboard
                      </span>
                      <ArrowRight size={13} />
                    </a>
                  </div>
                  <a
                    href={`${adminUrl}/orders`}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition"
                  >
                    <ClipboardList size={14} className="text-blue-400" /> Live Kitchen Orders (KDS)
                  </a>
                  <a
                    href={`${adminUrl}/products`}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition"
                  >
                    <UtensilsCrossed size={14} className="text-[var(--brand-accent)]" /> Dish Menu Catalog
                  </a>
                </>
              )}

              {/* ── SUPERADMIN LINKS ── */}
              {isSuperadmin && (
                <>
                  <div className="p-2">
                    <a
                      href={`${superadminUrl}/`}
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition shadow-md shadow-red-600/20"
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={15} /> Platform Control Center
                      </span>
                      <ArrowRight size={13} />
                    </a>
                  </div>
                </>
              )}

              {/* ── NORMAL CUSTOMER LINKS ── */}
              {!isRestaurantAdmin && !isSuperadmin && (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--text-main)] hover:bg-[var(--bg-sub)] hover:text-[var(--brand-accent)] transition"
                  >
                    <User size={15} className="text-[var(--brand-accent)]" /> My Profile & Addresses
                  </Link>
                  <Link
                    href="/orders"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--text-main)] hover:bg-[var(--bg-sub)] hover:text-[var(--brand-accent)] transition"
                  >
                    <Package size={15} className="text-[var(--brand-accent)]" /> My Food Orders
                  </Link>
                  <Link
                    href="/notifications"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 text-xs text-[var(--text-main)] hover:bg-[var(--bg-sub)] hover:text-[var(--brand-accent)] transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Bell size={15} className="text-[var(--brand-accent)]" /> Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="bg-[var(--brand-accent)] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </>
              )}

              {/* Common: Settings Link */}
              <Link
                href="/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-[var(--text-main)] hover:bg-[var(--bg-sub)] hover:text-[var(--brand-accent)] transition"
              >
                <Settings size={15} className="text-[var(--text-muted)]" /> Settings & Appearance
              </Link>

              <div className="border-t border-[var(--border-color)] my-1" />
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-500/10 transition"
              >
                <LogOut size={14} /> Log Out
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden sm:flex items-center gap-2">
          <Link
            href="/auth/login"
            className="bg-[var(--brand-accent)] hover:opacity-90 text-white px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition shadow-md shadow-[var(--brand-accent)]/20"
          >
            Sign In
          </Link>
        </div>
      )}
    </div>
  );
};

export default RightSection;
