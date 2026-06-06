"use client";

import React, { useEffect, useState } from "react";
import Logo from "./Logo";
import NavLinks from "./NavLinks";
import RightSection from "./RightSection";
import HamburgerIcon from "./HamburgerIcon";
import SearchBar from "../ui/SearchBar";

const Navbar = () => {
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Hide/show on scroll
      if (window.scrollY > lastScrollY && window.scrollY > 100) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }

      // Add background blur when scrolled
      setScrolled(window.scrollY > 20)

      setLastScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <nav className={`
      w-full fixed top-0 z-50 border-b border-brand-border
      transition-all duration-300
      ${scrolled ? 'bg-brand-dark/95 backdrop-blur-md' : 'bg-brand-dark'}
      ${showNavbar ? 'translate-y-0' : '-translate-y-full'}
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