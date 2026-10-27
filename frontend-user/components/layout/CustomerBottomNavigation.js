"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Home, UtensilsCrossed, Package, User } from "lucide-react";
import { useNavBadges } from "@/hooks/useNavBadges";

export default function CustomerBottomNavigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { ordersBadge, clearOrdersBadge } = useNavBadges();

  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      label: "Menu",
      href: "/menu",
      icon: UtensilsCrossed,
      isActive: pathname.startsWith("/menu"),
    },
    {
      label: "Orders",
      href: "/orders",
      icon: Package,
      isActive: pathname.startsWith("/orders"),
      badge: ordersBadge,
      onClear: clearOrdersBadge,
    },
    {
      label: "Profile",
      href: session ? "/profile" : "/auth/login",
      icon: User,
      isActive: pathname.startsWith("/profile") || pathname.startsWith("/auth"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-card)]/95 backdrop-blur-xl border-t border-[var(--border-color)] px-4 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-lg transition-colors"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => {
                if (item.onClear && item.badge > 0) {
                  item.onClear();
                }
              }}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl transition-all duration-200 active:scale-95 relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] ${
                active
                  ? "text-[var(--brand-accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <div className="relative">
                <Icon
                  size={20}
                  className={`transition-transform duration-200 ${
                    active ? "scale-110 stroke-[2.5]" : "stroke-[1.8] group-hover:scale-105"
                  }`}
                />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-[var(--brand-accent)] text-white text-[9px] font-black flex items-center justify-center ring-2 ring-[var(--bg-card)]">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight ${
                  active ? "font-bold text-[var(--brand-accent)]" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
