"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Logo from "./Logo";
import NavLinks from "./NavLinks";
import RightSection from "./RightSection";
import HamburgerIcon from "./HamburgerIcon";
import SearchBar from "../ui/SearchBar";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

const Navbar = () => {
  const hidden = useHideOnScroll();
  const [scrolled, setScrolled] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchButtonRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleOpenMobileSearch = () => {
    setMobileSearchOpen(true);
  };

  const handleCloseMobileSearch = () => {
    setMobileSearchOpen(false);
    setTimeout(() => {
      searchButtonRef.current?.focus();
    }, 50);
  };

  return (
    <header
      className={`w-full fixed top-0 z-50 border-b border-[var(--border-color)] transition-all duration-300 ${
        scrolled
          ? "bg-[var(--bg-main)]/95 backdrop-blur-xl shadow-lg shadow-black/5"
          : "bg-[var(--bg-main)]/80 backdrop-blur-md"
      } ${hidden && !mobileSearchOpen ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex justify-between items-center gap-3 sm:gap-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center shrink-0 group" aria-label="Pet Protocols Home">
          <Logo />
        </Link>

        {/* Desktop Search */}
        <div className="hidden lg:block flex-1 max-w-sm">
          <SearchBar />
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center">
          <NavLinks />
        </div>

        {/* Right Section: Theme Toggle, Notifications, Cart, Profile */}
        <div className="flex gap-1.5 sm:gap-2.5 items-center shrink-0">
          <RightSection
            onOpenMobileSearch={handleOpenMobileSearch}
            mobileSearchButtonRef={searchButtonRef}
            isMobileSearchOpen={mobileSearchOpen}
          />
          <HamburgerIcon />
        </div>
      </div>

      {/* Mobile Full-Screen Search Overlay */}
      {mobileSearchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search dishes and menu"
          className="lg:hidden fixed inset-0 z-[100] bg-[var(--bg-main)]/98 backdrop-blur-2xl flex flex-col"
        >
          <SearchBar
            isMobile={true}
            onClose={handleCloseMobileSearch}
            autoFocus={true}
          />
        </div>
      )}
    </header>
  );
};

export default Navbar;