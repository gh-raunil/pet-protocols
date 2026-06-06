"use client";
import { useState, useEffect, useRef } from "react";
import useCartStore from "@/lib/cartStore";
import { useSession, signOut } from "next-auth/react";
import { ShoppingCart, ChevronDown } from "lucide-react";
import Link from "next/link";

const RightSection = () => {
  const { getTotalItems, openCart, clearCartLocal } = useCartStore();
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => setIsMounted(true), []);

  // Close dropdown when clicking outside
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

  return (
    <div className="flex items-center gap-3">
      {/* Cart Icon */}
      <button
        className="relative hover:text-brand-orange transition duration-200 hover:scale-105"
        onClick={() => openCart()}
      >
        <ShoppingCart size={22} />
        {isMounted && totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {totalItems}
          </span>
        )}
      </button>

      {/* Auth */}
      {session ? (
        <div className="relative" ref={dropdownRef}>
          {/* User pill — click to open dropdown */}
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 bg-brand-card border border-brand-border rounded-full pl-1 pr-3 py-1 hover:border-brand-orange transition"
          >
            <img
              src={session.user.image || "/default-avatar.png"}
              alt={session.user.name}
              className="rounded-full object-cover w-7 h-7"
            />
            <span className="text-sm text-white font-medium">
              {session.user.name?.split(" ")[0]}
            </span>
            <ChevronDown
              size={14}
              className={`text-brand-muted transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-12 w-48 bg-brand-card border border-brand-border rounded-2xl overflow-hidden shadow-xl z-50">
              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm text-brand-muted hover:text-white hover:bg-brand-border transition"
              >
                👤 My Profile
              </Link>
              <Link
                href="/orders"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm text-brand-muted hover:text-white hover:bg-brand-border transition"
              >
                📦 My Orders
              </Link>
              {session.user.role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setDropdownOpen(false)}
                  className="
                    flex
                    items-center
                    gap-2
                    px-4
                    py-3
                    text-sm
                    text-brand-muted
                    hover:text-white
                    hover:bg-brand-border
                    transition
                  "
                >
                  🛠️ Admin Panel
                </Link>
              )}
              <div className="border-t border-brand-border" />
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-brand-border transition"
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/auth/login"
          className="bg-brand-orange text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition"
        >
          Login
        </Link>
      )}
    </div>
  );
};

export default RightSection;
