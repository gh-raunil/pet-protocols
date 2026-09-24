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
  Search
} from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle";
import NotificationBell from "../notifications/NotificationBell";
import useNotificationStore from "@/lib/notificationStore";
import Link from "next/link";
import Image from "next/image";

const RightSection = ({
  onOpenMobileSearch,
  mobileSearchButtonRef,
  isMobileSearchOpen,
}) => {
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

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001";
  const superadminUrl = process.env.NEXT_PUBLIC_SUPERADMIN_URL || "http://localhost:3002";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
      {/* Light / Dark Mode Toggle */}
      <ThemeToggle />

      {/* Customer Notifications (Only relevant for normal customers/visitors) */}
      {!isRestaurantAdmin && !isSuperadmin && (
        <NotificationBell />
      )}

      {/* Mobile Search Button (visible only below md breakpoint) */}
      {onOpenMobileSearch && (
        <button
          ref={mobileSearchButtonRef}
          type="button"
          onClick={onOpenMobileSearch}
          aria-label="Search dishes and menu"
          aria-expanded={Boolean(isMobileSearchOpen)}
          className="md:hidden relative hover:text-orange-500 light:hover:text-orange-500 transition duration-200 hover:scale-105 p-1.5 rounded-xl text-gray-200 light:text-stone-700 hover:bg-white/5 light:hover:bg-stone-200 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none flex items-center justify-center min-w-[36px] min-h-[36px]"
        >
          <Search size={21} />
        </button>
      )}

      {/* Cart Icon (Only relevant for normal customers) */}
      {!isRestaurantAdmin && !isSuperadmin && (
        <button
          className="relative hover:text-orange-500 transition duration-200 hover:scale-105 p-1.5 rounded-xl text-gray-200 light:text-stone-700 hover:bg-white/5 light:hover:bg-stone-200"
          onClick={() => openCart()}
          aria-label="Open Cart"
        >
          <ShoppingCart size={21} />
          {isMounted && totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[11px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-md shadow-orange-500/30">
              {totalItems}
            </span>
          )}
        </button>
      )}

      {/* Auth State Button / Dropdown */}
      {session ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 bg-[#121214] light:bg-[#ffffff] border border-white/10 light:border-stone-300 rounded-full pl-1 pr-3 py-1 hover:border-orange-500 transition shadow-sm"
          >
            <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-xs overflow-hidden">
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
                <span>{session.user.name?.charAt(0) || "U"}</span>
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs text-white light:text-stone-900 font-semibold leading-tight truncate max-w-[80px]">
                {session.user.name?.split(" ")[0]}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400">
                {isSuperadmin ? "Superadmin" : isRestaurantAdmin ? "Kitchen Admin" : "Foodie"}
              </span>
            </div>
            <ChevronDown
              size={13}
              className={`text-gray-400 transition-transform duration-200 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-11 w-64 bg-[#121214] light:bg-[#ffffff] border border-white/15 light:border-stone-300 rounded-2xl overflow-hidden shadow-2xl z-50 py-1">
              
              {/* Account Header */}
              <div className="px-4 py-3 border-b border-white/10 light:border-stone-200 bg-neutral-900/50 light:bg-stone-50">
                <p className="text-xs font-bold text-white light:text-stone-900 truncate">{session.user.name}</p>
                <p className="text-[11px] text-gray-400 light:text-stone-500 truncate">{session.user.email}</p>
                {isRestaurantAdmin && (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
                    🏢 {session.user.restaurantName || "Partner Kitchen"}
                  </span>
                )}
                {isSuperadmin && (
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
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
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-md shadow-orange-500/20"
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
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-gray-300 light:text-stone-700 hover:text-white light:hover:text-stone-900 hover:bg-white/5 light:hover:bg-stone-100 transition"
                  >
                    <ClipboardList size={14} className="text-blue-400" /> Live Kitchen Orders (KDS)
                  </a>
                  <a
                    href={`${adminUrl}/products`}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-gray-300 light:text-stone-700 hover:text-white light:hover:text-stone-900 hover:bg-white/5 light:hover:bg-stone-100 transition"
                  >
                    <UtensilsCrossed size={14} className="text-orange-400" /> Dish Menu Catalog
                  </a>
                  <a
                    href={`${adminUrl}/profile`}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-gray-300 light:text-stone-700 hover:text-white light:hover:text-stone-900 hover:bg-white/5 light:hover:bg-stone-100 transition"
                  >
                    <User size={14} className="text-emerald-400" /> Branch Manager Profile
                  </a>
                  <a
                    href={`${adminUrl}/standards`}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-gray-300 light:text-stone-700 hover:text-white light:hover:text-stone-900 hover:bg-white/5 light:hover:bg-stone-100 transition"
                  >
                    <Award size={14} className="text-amber-400" /> Kitchen Standards & SOPs
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
                  <a
                    href={`${superadminUrl}/profile`}
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-gray-300 light:text-stone-700 hover:text-white light:hover:text-stone-900 hover:bg-white/5 light:hover:bg-stone-100 transition"
                  >
                    <ShieldCheck size={14} className="text-red-400" /> Root Architecture Profile
                  </a>
                </>
              )}

              {/* ── NORMAL CUSTOMER LINKS ── */}
              {!isRestaurantAdmin && !isSuperadmin && (
                <>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      openNotifications();
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-300 light:text-stone-700 hover:text-white light:hover:text-stone-900 hover:bg-white/5 light:hover:bg-stone-100 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Bell size={15} className="text-orange-400" /> Notifications & Updates
                    </span>
                    {unreadCount > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-gray-300 light:text-stone-700 hover:text-white light:hover:text-stone-900 hover:bg-white/5 light:hover:bg-stone-100 transition"
                  >
                    <User size={15} className="text-orange-400" /> My Foodie VIP Profile
                  </Link>
                  <Link
                    href="/orders"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-gray-300 light:text-stone-700 hover:text-white light:hover:text-stone-900 hover:bg-white/5 light:hover:bg-stone-100 transition"
                  >
                    <Package size={15} className="text-orange-400" /> My Food Orders
                  </Link>
                </>
              )}

              <div className="border-t border-white/10 light:border-stone-200 my-1" />
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition"
              >
                <LogOut size={14} /> Log Out
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/auth/login"
          className="bg-orange-500 hover:bg-orange-600 text-white px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs font-bold transition shadow-md shadow-orange-500/20"
        >
          Login
        </Link>
      )}
    </div>
  );
};

export default RightSection;
