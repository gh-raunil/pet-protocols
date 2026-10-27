"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";
import Tooltip from "./Tooltip";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <div className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-white/5 border border-white/10 ${className}`} />
    );
  }

  const isDark = theme === "dark";

  return (
    <Tooltip
      content={isDark ? "Switch to daylight mode" : "Switch to dark mode"}
      placement="bottom"
    >
      <button
        onClick={toggleTheme}
        type="button"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] p-2 sm:p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-95 border border-[var(--border-color)] bg-[var(--bg-sub)] hover:bg-[var(--bg-card)] hover:border-[var(--brand-accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:outline-none shrink-0 ${className}`}
      >
        {isDark ? (
          <Sun size={19} className="text-amber-400 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon size={19} className="text-[var(--text-main)] transition-transform duration-300 hover:-rotate-12" />
        )}
      </button>
    </Tooltip>
  );
}
