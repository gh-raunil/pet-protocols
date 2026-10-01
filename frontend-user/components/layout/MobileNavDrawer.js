"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import {
  X,
  Home,
  UtensilsCrossed,
  Tag,
  PackageCheck,
  Bell,
  User,
  Settings,
  Info,
  PhoneCall,
  LogOut,
  LogIn,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import useNotificationStore from "@/lib/notificationStore";
import useCartStore from "@/lib/cartStore";
import PWAInstallButton from "@/components/pwa/PWAInstallButton";

export default function MobileNavDrawer({ isOpen, onClose }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { unreadCount } = useNotificationStore();
  const { clearCartLocal } = useCartStore();
  const drawerRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawer immediately on route navigation
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [pathname]);

  // Lock body scroll while open & handle Escape key
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  const handleLogout = () => {
    clearCartLocal();
    onClose();
    signOut({ callbackUrl: "/" });
  };

  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/menu", label: "Explore Menu", icon: UtensilsCrossed },
    { href: "/offers", label: "Offers & Deals", icon: Tag },
    { href: "/orders", label: "My Orders", icon: PackageCheck, authOnly: true },
    {
      href: "/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : null,
    },
    { href: "/profile", label: "Profile & Addresses", icon: User, authOnly: true },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/about", label: "About Pet Protocols", icon: Info },
    { href: "/contact", label: "Contact & Kitchens", icon: PhoneCall },
  ];

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      {/* Accessible Full-Screen Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[9998] bg-black/65 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-over Drawer Panel */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className={`fixed top-0 right-0 z-[9999] h-[100dvh] w-[85%] max-w-sm bg-[var(--bg-main)] border-l border-[var(--border-color)] shadow-2xl transition-transform duration-300 ease-out flex flex-col justify-between ${
          isOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-card)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--brand-accent)]/30">
              <Image src="/images/logo1.png" alt="Pet Protocols" width={32} height={32} className="object-cover" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-[var(--text-main)]">
              Pet Protocols
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Center Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Account Profile Card Header */}
          <div className="p-4 mx-4 my-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)]">
            {session?.user ? (
              <Link href="/profile" onClick={onClose} className="flex items-center gap-3 group">
                <div className="w-11 h-11 rounded-full bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] font-black flex items-center justify-center text-base shrink-0 overflow-hidden">
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      width={44}
                      height={44}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    session.user.name?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-main)] truncate group-hover:text-[var(--brand-accent)] transition">
                    {session.user.name || "Foodie"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {session.user.email}
                  </p>
                </div>
                <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition" />
              </Link>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--brand-accent)]">
                  <Sparkles size={14} /> Fresh food. Zero compromises.
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Sign in to track orders, save favorites, and enjoy personalized offers.
                </p>
                <div className="flex gap-2 pt-1">
                  <Link
                    href="/auth/login"
                    onClick={onClose}
                    className="flex-1 py-2 rounded-xl bg-[var(--brand-accent)] text-white text-center text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 hover:opacity-90 transition flex items-center justify-center gap-1.5"
                  >
                    <LogIn size={14} /> Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={onClose}
                    className="flex-1 py-2 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-center text-xs font-semibold hover:border-[var(--brand-accent)]/40 transition"
                  >
                    Register
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links List */}
          <nav className="px-3 py-2 space-y-1">
            {navLinks.map((item) => {
              if (item.authOnly && !session?.user) return null;
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/25"
                      : "text-[var(--text-main)] hover:bg-[var(--bg-card)] hover:text-[var(--brand-accent)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? "text-[var(--brand-accent)]" : "text-[var(--text-muted)]"} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[var(--brand-accent)] text-white">
                      {item.badge}
                    </span>
                  ) : (
                    <ChevronRight size={14} className="text-[var(--text-muted)] opacity-60" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Quick PWA App Installation Option */}
          <div className="px-3 pt-2 pb-1">
            <PWAInstallButton variant="nav" />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-card)] shrink-0">
          {session?.user && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/25 bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-bold transition"
            >
              <LogOut size={15} /> Sign Out
            </button>
          )}
          <p className="text-[11px] text-center text-[var(--text-muted)] mt-2">
            Pet Protocols • Fresh food. Zero compromises.
          </p>
        </div>
      </aside>
    </>,
    document.body
  );
}
