"use client";

import React, { useEffect, useState, useRef } from "react";
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
      setScrolled(window.scrollY > 20);
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
    <nav className={`
      w-full fixed top-0 z-50 border-b border-white/10
      transition-transform duration-300 ease-in-out
      ${scrolled ? 'bg-black/95 backdrop-blur-xl shadow-lg shadow-black/40' : 'bg-black'}
      ${hidden && !mobileSearchOpen ? '-translate-y-full' : 'translate-y-0'}
    `}>
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2 sm:gap-4">
        <Logo />
        <div className="hidden md:flex">
          <NavLinks />
        </div>
        <div className="hidden md:flex flex-1 max-w-xs">
          <SearchBar />
        </div>
        <div className="flex gap-2 sm:gap-3 items-center">
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
          className="md:hidden fixed inset-0 z-[100] bg-black/95 light:bg-white/95 backdrop-blur-xl flex flex-col"
        >
          <SearchBar
            isMobile={true}
            onClose={handleCloseMobileSearch}
            autoFocus={true}
          />
        </div>
      )}
    </nav>
  );
};

export default Navbar;