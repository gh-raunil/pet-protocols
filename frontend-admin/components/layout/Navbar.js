"use client";

import React, { useEffect, useState } from "react";
import Logo from "./Logo";
import NavLinks from "./NavLinks";
import RightSection from "./RightSection";
import HamburgerIcon from "./HamburgerIcon";
import SearchBar from "../ui/SearchBar";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

const Navbar = () => {
  const hidden = useHideOnScroll();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`
      w-full fixed top-0 z-50 border-b border-brand-border
      transition-transform duration-300 ease-in-out
      ${scrolled ? 'bg-brand-dark/95 backdrop-blur-xl' : 'bg-brand-dark'}
      ${hidden ? '-translate-y-full' : 'translate-y-0'}
    `}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
        <Logo />
        <div className="hidden md:flex">
          <NavLinks />
        </div>
        <div className="hidden md:flex flex-1 max-w-xs">
          <SearchBar />
        </div>
        <div className="flex gap-3 items-center">
          <RightSection />
          <HamburgerIcon />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;