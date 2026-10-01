"use client";

import React, { useState } from "react";
import { Menu } from "lucide-react";
import MobileNavDrawer from "./MobileNavDrawer";
import useNotificationStore from "@/lib/notificationStore";

const HamburgerIcon = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotificationStore();

  return (
    <div className="lg:hidden shrink-0">
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open mobile menu"
        aria-expanded={isOpen}
        className="relative p-2 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] transition flex items-center justify-center min-w-[38px] min-h-[38px]"
      >
        <Menu size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--brand-accent)] ring-2 ring-[var(--bg-main)]" />
        )}
      </button>

      <MobileNavDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
};

export default HamburgerIcon;