"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Store,
  AlertTriangle,
  Globe,
  RotateCcw,
  Copy,
  Zap,
  Check,
  Calendar,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday", isWeekend: false },
  { key: "tuesday", label: "Tuesday", isWeekend: false },
  { key: "wednesday", label: "Wednesday", isWeekend: false },
  { key: "thursday", label: "Thursday", isWeekend: false },
  { key: "friday", label: "Friday", isWeekend: false },
  { key: "saturday", label: "Saturday", isWeekend: true },
  { key: "sunday", label: "Sunday", isWeekend: true },
];

const QUICK_PRESETS = [
  { label: "Standard Dining", open: "09:00", close: "23:00", desc: "09:00 AM – 11:00 PM" },
  { label: "Breakfast to Dinner", open: "08:00", close: "22:00", desc: "08:00 AM – 10:00 PM" },
  { label: "Casual Hours", open: "10:00", close: "22:00", desc: "10:00 AM – 10:00 PM" },
  { label: "Late Night", open: "11:00", close: "02:00", desc: "11:00 AM – 02:00 AM" },
  { label: "24 Hours Open", open: "00:00", close: "23:59", desc: "Open 24 Hours" },
];

// Helper to convert "21:00" to "09:00 PM"
function formatTime12(timeStr) {
  if (!timeStr) return "";
  const parts = String(timeStr).split(":");
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = (parts[1] || "00").padStart(2, "0");
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

// Generate standard 30-minute intervals for clean time selection
function generateTimeOptions(is12Hour) {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hStr = String(h).padStart(2, "0");
      const mStr = String(m).padStart(2, "0");
      const val = `${hStr}:${mStr}`;
      let label = val;
      if (is12Hour) {
        label = formatTime12(val);
      }
      options.push({ value: val, label });
    }
  }
  options.push({
    value: "23:59",
    label: is12Hour ? "11:59 PM (Midnight)" : "23:59",
  });
  return options;
}

// Sleek, unified single-select time component
function TimeSelect({ value, onChange, is12Hour, className = "" }) {
  const options = useMemo(() => generateTimeOptions(is12Hour), [is12Hour]);

  const hasValue = options.some((o) => o.value === value);
  const displayOptions = useMemo(() => {
    if (!value || hasValue) return options;
    const customLabel = is12Hour ? formatTime12(value) : value;
    return [{ value, label: `${customLabel}` }, ...options];
  }, [options, value, hasValue, is12Hour]);

  return (
    <select
      value={value || "08:00"}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 hover:border-orange-500 focus:border-orange-500 outline-none cursor-pointer transition-colors shadow-2xs min-w-[105px] ${className}`}
    >
      {displayOptions.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function BusinessSection({ form, onChange, onSave, saving }) {
  const [liveTime, setLiveTime] = useState("");
  const [notification, setNotification] = useState("");

  // Builder state for quick 1-click weekly schedule
  const [builderOpen, setBuilderOpen] = useState("08:00");
  const [builderClose, setBuilderClose] = useState("21:00");

  const regional = form.regionalSettings || { timezone: "Asia/Kolkata", timeFormat: "12-hour" };
  const currentTimezone = regional.timezone || "Asia/Kolkata";
  const is12Hour = (regional.timeFormat || "12-hour") === "12-hour";

  useEffect(() => {
    const updateTime = () => {
      try {
        const str = new Intl.DateTimeFormat("en-IN", {
          timeZone: currentTimezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: is12Hour,
        }).format(new Date());
        setLiveTime(str);
      } catch (e) {
        setLiveTime("");
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [currentTimezone, is12Hour]);

  function notify(msg) {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? "" : prev));
    }, 4000);
  }

  function updateTimezone(tz) {
    onChange("regionalSettings", {
      ...regional,
      timezone: tz,
    });
  }

  function setTimeFormat(format) {
    onChange("regionalSettings", {
      ...regional,
      timeFormat: format,
    });
    notify(`Switched to ${format === "12-hour" ? "12-Hour (AM/PM)" : "24-Hour"} mode.`);
  }

  const weeklyHours = form.weeklyHours || {
    monday: { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] },
    tuesday: { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] },
    wednesday: { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] },
    thursday: { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] },
    friday: { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] },
    saturday: { isOpen: true, slots: [{ open: "08:00", close: "20:00" }] },
    sunday: { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] },
  };

  // Derive storefront fallback openingHours string
  function deriveOpeningHours(hoursObj) {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const openDay = days.find((d) => hoursObj[d]?.isOpen && hoursObj[d]?.slots?.[0]?.open);
    if (!openDay) return "Closed";
    const slot = hoursObj[openDay].slots[0];
    if ((slot.open === "00:00" && slot.close === "23:59") || (slot.open === "00:00" && slot.close === "00:00")) {
      return "Open 24 Hours";
    }
    return `${formatTime12(slot.open)} - ${formatTime12(slot.close)}`;
  }

  function saveWeeklyWithSyncedOpening(updatedHours) {
    onChange("weeklyHours", updatedHours);
    const derived = deriveOpeningHours(updatedHours);
    onChange("openingHours", derived);
  }

  function updateDayIsOpen(dayKey, isOpen) {
    const day = weeklyHours[dayKey] || { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] };
    const updated = {
      ...weeklyHours,
      [dayKey]: { ...day, isOpen },
    };
    saveWeeklyWithSyncedOpening(updated);
  }

  function updateDaySlot(dayKey, field, val) {
    const day = weeklyHours[dayKey] || { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] };
    const slots = [...(day.slots || [{ open: "08:00", close: "21:00" }])];
    slots[0] = { ...slots[0], [field]: val };
    const updated = {
      ...weeklyHours,
      [dayKey]: { ...day, slots },
    };
    saveWeeklyWithSyncedOpening(updated);
  }

  // FAST MASTER BUILDER ACTIONS
  function applyBuilderSchedule(target = "all") {
    const updated = { ...weeklyHours };
    const targetDays =
      target === "weekdays"
        ? ["monday", "tuesday", "wednesday", "thursday", "friday"]
        : target === "weekends"
        ? ["saturday", "sunday"]
        : DAYS_OF_WEEK.map((d) => d.key);

    targetDays.forEach((key) => {
      updated[key] = {
        isOpen: true,
        slots: [{ open: builderOpen, close: builderClose }],
      };
    });

    saveWeeklyWithSyncedOpening(updated);
    const timeLabel = is12Hour
      ? `${formatTime12(builderOpen)} – ${formatTime12(builderClose)}`
      : `${builderOpen} – ${builderClose}`;
    const targetLabel = target === "weekdays" ? "Weekdays (Mon–Fri)" : target === "weekends" ? "Weekends (Sat–Sun)" : "All 7 Days";
    notify(`Applied ${timeLabel} to ${targetLabel}!`);
  }

  function copyDayToAll(sourceDayKey) {
    const source = weeklyHours[sourceDayKey] || { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] };
    const updated = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      updated[key] = {
        isOpen: source.isOpen,
        slots: JSON.parse(JSON.stringify(source.slots || [{ open: "08:00", close: "21:00" }])),
      };
    });
    saveWeeklyWithSyncedOpening(updated);
    const dayName = DAYS_OF_WEEK.find((d) => d.key === sourceDayKey)?.label || sourceDayKey;
    const timeLabel = source.isOpen ? `${formatTime12(source.slots[0]?.open)} – ${formatTime12(source.slots[0]?.close)}` : "Closed";
    notify(`Copied ${dayName} (${timeLabel}) to all 7 days!`);
  }

  function toggleAllDays(isOpen) {
    const updated = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      const current = weeklyHours[key] || { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] };
      updated[key] = { ...current, isOpen };
    });
    saveWeeklyWithSyncedOpening(updated);
    notify(isOpen ? "All 7 days marked as Open!" : "All 7 days marked as Closed!");
  }

  function applyPreset(preset) {
    setBuilderOpen(preset.open);
    setBuilderClose(preset.close);
    const updated = { ...weeklyHours };
    DAYS_OF_WEEK.forEach(({ key }) => {
      updated[key] = {
        isOpen: true,
        slots: [{ open: preset.open, close: preset.close }],
      };
    });
    saveWeeklyWithSyncedOpening(updated);
    notify(`Applied "${preset.label}" (${preset.desc}) to all 7 days!`);
  }

  const activeSyncedHours = deriveOpeningHours(weeklyHours);

  return (
    <div className="space-y-6 pb-24 sm:pb-8">
      {/* Page Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Operating Hours</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Set your live restaurant availability and weekly operating schedule.
        </p>
      </div>

      {/* QUICK STATUS CARD */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Store Status Right Now</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Master switch to accept or pause incoming orders</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Open / Closed Toggle */}
          <button
            type="button"
            onClick={() => onChange("isOpen", !form.isOpen)}
            className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              form.isOpen && !form.isTemporarilyClosed
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    form.isOpen && !form.isTemporarilyClosed ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                  }`}
                />
                <span className="text-sm font-bold">
                  Restaurant is: {form.isOpen && !form.isTemporarilyClosed ? "Open" : "Closed"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {form.isOpen && !form.isTemporarilyClosed
                  ? "Dishes are active and customers can order"
                  : "Ordering paused across customer app"}
              </p>
            </div>
          </button>

          {/* Temporarily Closed Toggle */}
          <button
            type="button"
            onClick={() => onChange("isTemporarilyClosed", !form.isTemporarilyClosed)}
            className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              form.isTemporarilyClosed
                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${form.isTemporarilyClosed ? "text-amber-500" : "text-zinc-400"}`} />
                <span className="text-sm font-bold">Temporarily Closed</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {form.isTemporarilyClosed ? "Kitchen paused for event or maintenance" : "Click for short breaks or holiday closure"}
              </p>
            </div>
          </button>
        </div>

        {form.isTemporarilyClosed && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300">
              Select reason displayed to customers:
            </label>
            <div className="flex flex-wrap gap-2">
              {["Holiday", "Kitchen Maintenance", "Private Event", "Heavy Rain", "Staff Shortage"].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onChange("closureReason", reason)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                    form.closureReason === reason
                      ? "bg-amber-500 text-white border-amber-500 font-semibold shadow-xs"
                      : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:border-amber-400"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.closureReason || ""}
              onChange={(e) => onChange("closureReason", e.target.value)}
              placeholder="Or custom message (e.g. Opening back up at 2 PM)"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-amber-500"
            />
          </div>
        )}
      </section>

      {/* WEEKLY SCHEDULE SECTION */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5 transition-colors">
        {/* Top Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Weekly Operating Schedule</h2>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Regular open & close times per day</p>
            </div>
          </div>

          {/* Header Controls: Timezone + 12h/24h toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 12-Hour vs 24-Hour Switcher */}
            <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-700/80 p-0.5 bg-zinc-100 dark:bg-zinc-800/90 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setTimeFormat("12-hour")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  is12Hour
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                12-Hour (AM/PM)
              </button>
              <button
                type="button"
                onClick={() => setTimeFormat("24-hour")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !is12Hour
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                24-Hour
              </button>
            </div>

            {/* Timezone Dropdown */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 text-xs">
              <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <select
                value={currentTimezone}
                onChange={(e) => updateTimezone(e.target.value)}
                className="bg-transparent text-zinc-900 dark:text-white font-bold outline-none cursor-pointer text-xs"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST 🇮🇳)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST 🇦🇪)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT 🇸🇬)</option>
                <option value="Asia/Bangkok">Asia/Bangkok (ICT 🇹🇭)</option>
                <option value="Europe/London">Europe/London (GMT 🇬🇧)</option>
                <option value="Europe/Paris">Europe/Paris (CET 🇪🇺)</option>
                <option value="America/New_York">America/New_York (EST 🇺🇸)</option>
                <option value="America/Chicago">America/Chicago (CST 🇺🇸)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST 🇺🇸)</option>
                <option value="UTC">UTC (Universal 🌐)</option>
              </select>
            </div>

            {/* Live Clock Badge */}
            {liveTime && (
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                🕒 {liveTime}
              </span>
            )}
          </div>
        </div>

        {/* Live Notification Banner */}
        {notification && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold">
              <Check className="w-4 h-4 text-emerald-500" />
              {notification}
            </span>
            <button
              type="button"
              onClick={() => setNotification("")}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* FAST SCHEDULE BUILDER CARD */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                Quick Schedule Builder
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden md:inline">
                — Choose hours once and apply instantly across your week
              </span>
            </div>

            {/* Bulk All Open / Close */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleAllDays(true)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Open All
              </button>
              <button
                type="button"
                onClick={() => toggleAllDays(false)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Close All
              </button>
            </div>
          </div>

          {/* Builder Controls Strip */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-3 py-1.5 shadow-xs">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Opens:</span>
              <TimeSelect value={builderOpen} onChange={setBuilderOpen} is12Hour={is12Hour} />
              <span className="text-zinc-400 font-bold text-xs">—</span>
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Closes:</span>
              <TimeSelect value={builderClose} onChange={setBuilderClose} is12Hour={is12Hour} />
            </div>

            {/* Apply Buttons */}
            <button
              type="button"
              onClick={() => applyBuilderSchedule("all")}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              title="Apply these hours to all 7 days"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Apply to All 7 Days</span>
            </button>

            <button
              type="button"
              onClick={() => applyBuilderSchedule("weekdays")}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
            >
              Mon–Fri Only
            </button>

            <button
              type="button"
              onClick={() => applyBuilderSchedule("weekends")}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
            >
              Sat–Sun Only
            </button>
          </div>

          {/* Quick Presets Row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-orange-500/10 dark:border-zinc-800">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mr-1">Presets:</span>
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/90 dark:bg-zinc-800/90 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-zinc-700 dark:text-zinc-300 hover:text-orange-600 dark:hover:text-orange-400 border border-zinc-200/80 dark:border-zinc-700/80 transition cursor-pointer"
              >
                <span className="font-bold">{p.label}</span>{" "}
                <span className="text-[10px] text-zinc-400 font-mono">
                  ({is12Hour ? p.desc : `${p.open} - ${p.close}`})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Customer Sync Notice */}
        <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-zinc-700 dark:text-zinc-300">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              Storefront active clock: <strong>{currentTimezone}</strong>. Customers see:{" "}
              <strong className="text-orange-600 dark:text-orange-400 font-bold">{activeSyncedHours}</strong>.
            </span>
          </div>
          {currentTimezone !== "Asia/Kolkata" && (
            <button
              type="button"
              onClick={() => updateTimezone("Asia/Kolkata")}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset to India (IST 🇮🇳)
            </button>
          )}
        </div>

        {/* DAYS OF THE WEEK LIST */}
        <div className="space-y-2.5">
          {DAYS_OF_WEEK.map(({ key, label, isWeekend }) => {
            const dayData = weeklyHours[key] || { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] };
            const isOpen = dayData.isOpen ?? true;
            const slot = dayData.slots?.[0] || { open: "08:00", close: "21:00" };

            return (
              <div
                key={key}
                className={`p-3 sm:p-3.5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-all ${
                  isOpen
                    ? "bg-zinc-50/70 dark:bg-zinc-900/40 border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                    : "bg-zinc-100/40 dark:bg-zinc-900/20 border-zinc-200/50 dark:border-zinc-800/50 opacity-60"
                }`}
              >
                {/* Left Side: Day Identity + Open/Closed Switch */}
                <div className="flex items-center justify-between sm:justify-start gap-3 shrink-0">
                  <div className="flex items-center gap-2 w-32 sm:w-36">
                    <span className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
                      {label}
                    </span>
                    {isWeekend ? (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        Weekend
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        Weekday
                      </span>
                    )}
                  </div>

                  {/* Open / Closed Toggle Pill */}
                  <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-700/80 p-0.5 bg-white dark:bg-zinc-800 text-xs shadow-2xs shrink-0">
                    <button
                      type="button"
                      onClick={() => updateDayIsOpen(key, true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isOpen
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDayIsOpen(key, false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !isOpen
                          ? "bg-zinc-600 dark:bg-zinc-700 text-white shadow-xs"
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      Closed
                    </button>
                  </div>
                </div>

                {/* Right Side: Hours Pickers + Copy Action (unified container with safe gap) */}
                <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                  {isOpen ? (
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-zinc-400">Opens:</span>
                        <TimeSelect
                          value={slot.open || "08:00"}
                          onChange={(val) => updateDaySlot(key, "open", val)}
                          is12Hour={is12Hour}
                        />
                      </div>

                      <span className="text-zinc-400 font-bold text-xs">—</span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-zinc-400">Closes:</span>
                        <TimeSelect
                          value={slot.close || "21:00"}
                          onChange={(val) => updateDaySlot(key, "close", val)}
                          is12Hour={is12Hour}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-1">
                      <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-800/50 px-3 py-1 rounded-lg">
                        Closed all day
                      </span>
                    </div>
                  )}

                  {/* Copy to All Button with guaranteed separation */}
                  <button
                    type="button"
                    onClick={() => copyDayToAll(key)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 border border-zinc-200 dark:border-zinc-700/80 hover:border-orange-500/40 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ml-auto sm:ml-0"
                    title={`Apply ${label}'s timing to all 7 days`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Copy to all</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
