import React from "react";
import Logo from "./Logo";
import Link from "next/link";
import { Sparkles } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[var(--bg-sub)] border-t border-[var(--border-color)] text-[var(--text-main)] transition-colors">
      <div className="max-w-7xl mx-auto px-6 py-14">
        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1 — Brand info */}
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <Logo />
              <span className="font-extrabold text-lg text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition">
                Pet Protocols
              </span>
            </Link>
            <p className="text-sm font-semibold text-[var(--brand-accent)] flex items-center gap-1.5 pt-1">
              <Sparkles size={14} /> Fresh food. Zero compromises.
            </p>
            <p className="text-[var(--text-muted)] text-xs leading-relaxed max-w-xs">
              Discover top partnered kitchens, explore chef-crafted dishes, and order hot gourmet food delivered straight to your doorstep.
            </p>
          </div>

          {/* Column 2 — Quick Explore */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              Explore
            </h3>
            <div className="flex flex-col gap-2.5 text-xs text-[var(--text-muted)]">
              <Link href="/" className="hover:text-[var(--brand-accent)] transition">Home</Link>
              <Link href="/menu" className="hover:text-[var(--brand-accent)] transition">Full Menu</Link>
              <Link href="/download" className="hover:text-[var(--brand-accent)] transition">Download Android App</Link>
              <Link href="/offers" className="hover:text-[var(--brand-accent)] transition">Active Offers & Discounts</Link>
              <Link href="/orders" className="hover:text-[var(--brand-accent)] transition">Order Tracking</Link>
              <Link href="/settings" className="hover:text-[var(--brand-accent)] transition">Appearance & Palettes</Link>
            </div>
          </div>

          {/* Column 3 — Top Categories */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              Popular Cravings
            </h3>
            <div className="flex flex-col gap-2.5 text-xs text-[var(--text-muted)]">
              <Link href="/menu?category=Burger" className="hover:text-[var(--brand-accent)] transition">Gourmet Burgers</Link>
              <Link href="/menu?category=Pizza" className="hover:text-[var(--brand-accent)] transition">Stone-Baked Pizza</Link>
              <Link href="/menu?category=Fries" className="hover:text-[var(--brand-accent)] transition">Crispy Loaded Fries</Link>
              <Link href="/menu?category=Momos" className="hover:text-[var(--brand-accent)] transition">Steamed & Fried Momos</Link>
              <Link href="/menu?category=Cold Drinks" className="hover:text-[var(--brand-accent)] transition">Chilled Drinks & Shakes</Link>
            </div>
          </div>

          {/* Column 4 — Platform & Contact */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] mb-3">
              Support & Kitchens
            </h3>
            <div className="flex flex-col gap-2.5 text-xs text-[var(--text-muted)]">
              <Link href="/about" className="hover:text-[var(--brand-accent)] transition">About Platform</Link>
              <Link href="/contact" className="hover:text-[var(--brand-accent)] transition">Contact Kitchens & Support</Link>
              <Link href="/notifications" className="hover:text-[var(--brand-accent)] transition">Service Announcements</Link>
              <Link href="/profile" className="hover:text-[var(--brand-accent)] transition">Customer Account</Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[var(--border-color)] mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <p>© {new Date().getFullYear()} Pet Protocols. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Designed for food lovers • Zero compromises.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;