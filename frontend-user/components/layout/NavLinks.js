"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useNavBadges } from "@/hooks/useNavBadges";

const NavLinks = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const {
    menuBadge,
    offersBadge,
    ordersBadge,
    clearMenuBadge,
    clearOffersBadge,
    clearOrdersBadge,
  } = useNavBadges();

  const links = [
    {
      href: "/",
      label: "Home",
      badge: 0,
    },
    {
      href: "/menu",
      label: "Menu",
      badge: menuBadge,
      onClear: clearMenuBadge,
    },
    {
      href: "/restaurants",
      label: "Restaurants",
      badge: 0,
    },
    {
      href: "/offers",
      label: "Offers",
      badge: offersBadge,
      onClear: clearOffersBadge,
    },
  ];

  return (
    <div className="flex items-center gap-2 lg:gap-2.5 xl:gap-5 2xl:gap-6">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={link.onClear}
            className={`text-xs xl:text-sm font-semibold transition-colors duration-150 py-1 border-b-2 flex items-center gap-1 shrink-0 ${
              isActive
                ? "text-[var(--brand-accent)] border-[var(--brand-accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)] border-transparent"
            }`}
          >
            <span>{link.label}</span>
            {link.badge > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 text-[10px] font-black rounded-full bg-amber-500 text-white shadow-xs animate-pulse leading-none"
                title={`${link.badge} new`}
              >
                {link.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
};

export default NavLinks;