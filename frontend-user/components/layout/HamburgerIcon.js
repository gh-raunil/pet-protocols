"use client";

import React, { useState } from "react";
import { Menu } from "lucide-react";
import MobileNavDrawer from "./MobileNavDrawer";
import useNotificationStore from "@/lib/notificationStore";

const HamburgerIcon = () => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = React.useRef(null);
  const { unreadCount } = useNotificationStore();

  const handleClose = () => {
    setIsOpen(false);
    // Restore focus to hamburger trigger button
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 50);
  };

  return (
    <div className="lg:hidden shrink-0">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(true)}
        type="button"
        aria-label="Open mobile menu"
        aria-expanded={isOpen}
        className="relative p-2 sm:p-2.5 rounded-xl text-[var(--text-main)] bg-[var(--bg-sub)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/50 transition active:scale-95 flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:outline-none shrink-0"
      >
        <Menu size={21} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[var(--brand-accent)] ring-2 ring-[var(--bg-main)]" />
        )}
      </button>

      <MobileNavDrawer isOpen={isOpen} onClose={handleClose} triggerRef={triggerRef} />
    </div>
  );
};

export default HamburgerIcon;