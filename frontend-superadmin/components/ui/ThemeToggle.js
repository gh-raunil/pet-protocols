"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";
import Tooltip from "./Tooltip";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <div className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 ${className}`} />
    );
  }

  const isDark = theme === "dark";

  return (
    <Tooltip
      content={
        isDark
          ? "Switch to daylight mode for bright environments"
          : "Switch to dark mode for comfortable viewing in low-light environments"
      }
      position="bottom"
    >
      <button
        onClick={toggleTheme}
        type="button"
        aria-label="Toggle theme"
        className={`min-w-[44px] min-h-[44px] p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm cursor-pointer active:scale-95 flex items-center justify-center ${className}`}
      >
        {isDark ? (
          <Sun className="w-5 h-5 text-amber-400 transition" />
        ) : (
          <Moon className="w-5 h-5 text-slate-500 transition" />
        )}
      </button>
    </Tooltip>
  );
}
