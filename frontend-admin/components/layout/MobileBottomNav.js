"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, ShoppingBag, ChefHat, User, Wallet } from "lucide-react";
import { useSession } from "next-auth/react";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Hide on authentication screens
  if (pathname === "/login" || pathname === "/login/staff") {
    return null;
  }

  const isStaff = session?.user?.role === "staff";
  const staffRole = session?.user?.staffRole || "";

  // Core navigation items for delivery & operations staff on mobile
  const navItems = [
    {
      label: "Deliveries",
      href: "/delivery",
      icon: Bike,
      active: pathname === "/delivery",
    },
    {
      label: "Orders",
      href: "/orders",
      icon: ShoppingBag,
      active: pathname === "/orders",
    },
    {
      label: isStaff && staffRole.toLowerCase().includes("cashier") ? "Billing" : "Kitchen",
      href: isStaff && staffRole.toLowerCase().includes("cashier") ? "/cashier" : "/kitchen",
      icon: isStaff && staffRole.toLowerCase().includes("cashier") ? Wallet : ChefHat,
      active: pathname === "/kitchen" || pathname === "/cashier",
    },
    {
      label: "Profile",
      href: "/profile",
      icon: User,
      active: pathname === "/profile",
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md border-t border-stone-200/80 dark:border-white/10 px-2 pt-1 pb-[env(safe-area-inset-bottom,8px)] shadow-lg"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 min-h-[46px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
                isActive
                  ? "text-[#ff5e00] dark:text-[#ff5e00] font-bold"
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 font-medium"
              }`}
            >
              <div
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                  isActive
                    ? "bg-orange-500/10 dark:bg-orange-500/20"
                    : ""
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? "text-[#ff5e00]" : "text-stone-500 dark:text-stone-400"}
                />
              </div>
              <span className="text-[10px] tracking-tight leading-tight mt-0.5">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
