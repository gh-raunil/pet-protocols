"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const NavLinks = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  const links = [
    { href: "/menu", label: "Explore Menu" },
    { href: "/offers", label: "Offers" },
    ...(session ? [{ href: "/orders", label: "Orders" }] : []),
    { href: "/about", label: "About" },
  ];

  return (
    <div className="flex items-center gap-6 lg:gap-8">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-semibold transition-colors duration-150 py-1 border-b-2 ${
              isActive
                ? "text-[var(--brand-accent)] border-[var(--brand-accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)] border-transparent"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
};

export default NavLinks;