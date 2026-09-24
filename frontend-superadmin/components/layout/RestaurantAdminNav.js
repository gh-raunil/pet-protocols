"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Settings,
  LogOut,
  Building,
} from "lucide-react";

export default function RestaurantAdminNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const links = [
    { href: "/restaurant/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/restaurant/products", label: "Products", icon: UtensilsCrossed },
    { href: "/restaurant/orders", label: "Orders", icon: ShoppingBag },
    { href: "/restaurant/settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/10 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <Link href="/restaurant/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              PET <span className="text-orange-500">PROTOCOLS</span>
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
              RESTAURANT ADMIN
            </span>
          </Link>

          {session?.user?.restaurantName && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
              <Building className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-semibold text-white">{session.user.restaurantName}</span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${isActive
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-white">{session?.user?.name}</p>
            <p className="text-[11px] text-gray-400">{session?.user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/restaurant/login" })}
            className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
