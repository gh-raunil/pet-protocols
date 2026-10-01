"use client";

import React, { useState, useEffect } from "react";
import { Clock, Globe, Check, RotateCcw } from "lucide-react";
import {
  TIMEZONE_OPTIONS,
  DEFAULT_TIMEZONE,
  getTimeZone,
  setTimeZone,
  formatDateInTimeZone,
} from "@/lib/timeZone";
import { toast } from "./ToastProvider";

export default function TimezoneSelector({ variant = "card" }) {
  const [activeTz, setActiveTz] = useState(DEFAULT_TIMEZONE);
  const [liveTime, setLiveTime] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActiveTz(getTimeZone());

    const handleTzChange = (e) => {
      setActiveTz(e.detail || DEFAULT_TIMEZONE);
    };
    window.addEventListener("timezone-change", handleTzChange);

    const updateClock = () => {
      const now = new Date();
      const current = getTimeZone();
      const formatted = formatDateInTimeZone(now, current, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setLiveTime(formatted);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => {
      window.removeEventListener("timezone-change", handleTzChange);
      clearInterval(interval);
    };
  }, []);

  const handleChangeTimezone = (tz) => {
    setTimeZone(tz);
    setActiveTz(tz);
    const selectedOpt = TIMEZONE_OPTIONS.find((t) => t.value === tz);
    toast.success(`Time zone updated to ${selectedOpt?.label || tz}`);
  };

  const handleResetToIndia = () => {
    handleChangeTimezone("Asia/Kolkata");
  };

  if (!mounted) {
    return (
      <div className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] animate-pulse h-24" />
    );
  }

  const currentOption =
    TIMEZONE_OPTIONS.find((t) => t.value === activeTz) || {
      value: activeTz,
      label: activeTz,
      offset: "",
      region: "Custom",
    };

  // Compact variant (e.g. for footer or small widgets)
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Clock size={14} className="text-[var(--brand-accent)] shrink-0" />
        <select
          value={activeTz}
          onChange={(e) => handleChangeTimezone(e.target.value)}
          className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-2.5 py-1 text-xs text-[var(--text-main)] outline-none focus:border-[var(--brand-accent)] cursor-pointer"
        >
          {TIMEZONE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.region} — {opt.label} ({opt.offset})
            </option>
          ))}
        </select>
        {liveTime && (
          <span className="font-mono text-[11px] text-[var(--brand-accent)] font-semibold hidden sm:inline">
            {liveTime}
          </span>
        )}
      </div>
    );
  }

  // Full Card variant (for Settings page)
  return (
    <div className="bg-[var(--bg-card)] rounded-3xl p-6 sm:p-8 border border-[var(--border-color)] shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center shrink-0">
            <Globe size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[var(--text-main)] flex items-center gap-2">
              Time Zone & Operational Clock
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Control which time zone is used to compute kitchen opening hours and order delivery timestamps.
            </p>
          </div>
        </div>

        {activeTz !== "Asia/Kolkata" && (
          <button
            type="button"
            onClick={handleResetToIndia}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 hover:bg-[var(--brand-accent)]/20 text-[var(--brand-accent)] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Switch to India Time (IST 🇮🇳)</span>
          </button>
        )}
      </div>

      {/* Live Time Display */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-main)]">
                Active Clock ({currentOption.region})
              </span>
              {activeTz === "Asia/Kolkata" && (
                <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Default (India)
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {currentOption.label} • {currentOption.offset}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="font-mono text-lg sm:text-xl font-black text-[var(--brand-accent)] tracking-wider block">
            {liveTime || "--:--:--"}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">Live Zoned Synchronization</span>
        </div>
      </div>

      {/* Timezone Grid Selection */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
          Select Your Preferred Time Zone
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIMEZONE_OPTIONS.map((opt) => {
            const isSelected = activeTz === opt.value;
            return (
              <div
                key={opt.value}
                onClick={() => handleChangeTimezone(opt.value)}
                className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 ring-1 ring-[var(--brand-accent)]"
                    : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-main)] truncate">
                      {opt.label}
                    </span>
                    {opt.value === "Asia/Kolkata" && (
                      <span className="text-[9px] font-bold text-[var(--brand-accent)] bg-[var(--brand-accent)]/15 px-1.5 py-0.2 rounded shrink-0">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {opt.region} • {opt.offset}
                  </p>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white"
                      : "border-[var(--border-color)]"
                  }`}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
