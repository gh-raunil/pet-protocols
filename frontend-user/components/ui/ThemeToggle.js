"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";
import Tooltip from "./Tooltip";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-full bg-white/5 border border-white/10 ${className}`} />
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
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`p-2 rounded-xl transition-all duration-300 flex items-center justify-center ${
          isDark
            ? "bg-[#141414] hover:bg-[#202022] text-yellow-400 border border-white/10 shadow-inner"
            : "bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 shadow-sm"
        } ${className}`}
      >
        {isDark ? (
          <Sun size={17} className="transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon size={17} className="transition-transform duration-300 hover:-rotate-12" />
        )}
      </button>
    </Tooltip>
  );
}
