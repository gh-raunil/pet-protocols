"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import NavLinks from "./NavLinks";
import NavbarLocationSelector from "./NavbarLocationSelector";
import RightSection from "./RightSection";
import HamburgerIcon from "./HamburgerIcon";
import SearchBar from "../ui/SearchBar";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

const Navbar = () => {
  const hidden = useHideOnScroll();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchButtonRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleOpen = () => setMobileSearchOpen(true);
    window.addEventListener("open_mobile_search", handleOpen);
    return () => window.removeEventListener("open_mobile_search", handleOpen);
  }, []);

  const handleCloseMobileSearch = () => {
    setMobileSearchOpen(false);
    setTimeout(() => {
      searchButtonRef.current?.focus();
    }, 50);
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
      setScrolledPastHero(window.scrollY > 280);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isHome = pathname === "/";
  const isMenu = pathname === "/menu";
  const isRestaurants = pathname === "/restaurants";
  const showDesktopSearch = !isMenu && !isRestaurants;

  return (
    <header
      className={`w-full max-w-full fixed top-0 z-50 border-b border-[var(--border-color)] transition-all duration-300 ${
        scrolled
          ? "bg-[var(--bg-main)]/95 backdrop-blur-xl shadow-lg shadow-black/5"
          : "bg-[var(--bg-main)]/80 backdrop-blur-md"
      } ${hidden && !mobileSearchOpen ? '-translate-y-full' : 'translate-y-0'}`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3.5 flex justify-between items-center gap-1 sm:gap-2 lg:gap-3 xl:gap-5 w-full">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 shrink min-w-0 group" aria-label="पेट Protocols Home">
          <Logo />
          <div className="flex flex-col min-w-0">
            <span className="font-extrabold text-xs sm:text-base tracking-tight text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition leading-tight truncate">
              पेट Protocols
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-normal hidden xl:inline leading-tight">
              Fresh food. Zero compromises.
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center shrink-0">
          <NavLinks />
        </div>

        {/* Desktop Location Selector */}
        <NavbarLocationSelector />

        {/* Desktop SearchBar */}
        <div
          className={`hidden md:flex flex-1 max-w-xs min-w-[120px] lg:max-w-[190px] xl:max-w-[260px] 2xl:max-w-[300px] shrink mx-0.5 lg:mx-1 transition-all duration-300 ${
            showDesktopSearch
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-95 pointer-events-none invisible"
          }`}
        >
          <SearchBar />
        </div>

        {/* Right Section: Theme Toggle, Notifications, Cart, Profile */}
        <div className="flex gap-1.5 sm:gap-2 xl:gap-2.5 items-center shrink-0">
          <RightSection
            onOpenMobileSearch={() => setMobileSearchOpen(true)}
            isMobileSearchOpen={mobileSearchOpen}
            mobileSearchButtonRef={searchButtonRef}
          />
          <HamburgerIcon />
        </div>
      </div>

      {/* Mobile Full-Screen Search Dialog */}
      {mobileSearchOpen && mounted && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search dishes and menu"
          className="md:hidden fixed inset-0 z-[100] bg-[var(--bg-main)] w-screen h-[100dvh] overflow-hidden"
        >
          <SearchBar
            isMobile={true}
            onClose={handleCloseMobileSearch}
            autoFocus={true}
          />
        </div>,
        document.body
      )}
    </header>
  );
};

export default Navbar;