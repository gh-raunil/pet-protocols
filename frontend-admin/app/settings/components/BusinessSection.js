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
  ArrowDown,
  ChevronDown,
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
  { label: "Standard dining", open: "09:00", close: "23:00", desc: "09:00 AM – 11:00 PM" },
  { label: "Breakfast to dinner", open: "08:00", close: "22:00", desc: "08:00 AM – 10:00 PM" },
  { label: "Casual hours", open: "10:00", close: "22:00", desc: "10:00 AM – 10:00 PM" },
  { label: "Late night", open: "11:00", close: "02:00", desc: "11:00 AM – 02:00 AM" },
  { label: "24 hours", open: "00:00", close: "23:59", desc: "Open 24 Hours" },
];

// Helper to convert "21:00" to "09:00 PM", "00:00" to "12:00 AM", etc.
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
      const label = is12Hour ? formatTime12(val) : val;
      options.push({ value: val, label });
    }
  }
  options.push({
    value: "23:59",
    label: is12Hour ? "11:59 PM" : "23:59",
  });
  return options;
}

// Sleek, compact time selector matching modern SaaS admin proportions
function TimeSelect({ value, onChange, is12Hour, disabled = false, className = "", id }) {
  const options = useMemo(() => generateTimeOptions(is12Hour), [is12Hour]);

  const hasValue = options.some((o) => o.value === value);
  const displayOptions = useMemo(() => {
    if (!value || hasValue) return options;
    const customLabel = is12Hour ? formatTime12(value) : value;
    return [{ value, label: customLabel }, ...options];
  }, [options, value, hasValue, is12Hour]);

  return (
    <div className="relative w-full">
      <select
        id={id}
        value={value || "08:00"}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={id || "Select time"}
        className={`w-full appearance-none bg-zinc-900/90 dark:bg-[#0c0e14] border border-zinc-700/70 dark:border-zinc-800 hover:border-zinc-500 dark:hover:border-zinc-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-lg px-3 py-1.5 sm:py-2 pr-8 text-xs font-medium text-zinc-100 outline-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs h-8.5 sm:h-9 ${className}`}
      >
        {displayOptions.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-zinc-900 text-white py-1"
          >
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-zinc-400">
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </div>
    </div>
  );
}

export default function BusinessSection({ form, onChange, onSave, saving, hasUnsavedChanges }) {
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

  // Master Builder bulk actions
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
    const targetLabel =
      target === "weekdays"
        ? "Weekdays (Mon–Fri)"
        : target === "weekends"
        ? "Weekends (Sat–Sun)"
        : "All 7 Days";
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
    const timeLabel = source.isOpen
      ? `${formatTime12(source.slots[0]?.open)} – ${formatTime12(source.slots[0]?.close)}`
      : "Closed";
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
    <div className="max-w-3xl space-y-4 pb-16 sm:pb-6">
      {/* ── STORE STATUS RIGHT NOW (EMERGENCY / LIVE OVERRIDE) ──────────────── */}
      <section className="bg-zinc-900/60 dark:bg-[#12141c] border border-zinc-800 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3 transition-colors">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-zinc-800/80">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
            <Store className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Store Status Right Now</h2>
            <p className="text-[11px] text-zinc-400">Master switch to accept or pause incoming orders</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Open / Closed Master Switch */}
          <button
            type="button"
            onClick={() => onChange("isOpen", !form.isOpen)}
            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              form.isOpen && !form.isTemporarilyClosed
                ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
                : "bg-zinc-950/40 border-zinc-800 text-zinc-400"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    form.isOpen && !form.isTemporarilyClosed ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                  }`}
                />
                <span className="text-xs font-bold text-white">
                  Restaurant is: {form.isOpen && !form.isTemporarilyClosed ? "Open" : "Closed"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {form.isOpen && !form.isTemporarilyClosed
                  ? "Dishes are active and customers can order"
                  : "Ordering paused across customer app"}
              </p>
            </div>
          </button>

          {/* Temporarily Closed Switch */}
          <button
            type="button"
            onClick={() => onChange("isTemporarilyClosed", !form.isTemporarilyClosed)}
            className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              form.isTemporarilyClosed
                ? "bg-amber-950/20 border-amber-500/40 text-amber-200"
                : "bg-zinc-950/40 border-zinc-800 text-zinc-400"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-3.5 h-3.5 ${form.isTemporarilyClosed ? "text-amber-400" : "text-zinc-500"}`} />
                <span className="text-xs font-bold text-white">Temporarily Closed</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {form.isTemporarilyClosed ? "Kitchen paused for event or maintenance" : "Click for short breaks or holiday closure"}
              </p>
            </div>
          </button>
        </div>

        {form.isTemporarilyClosed && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <label className="block text-[11px] font-semibold text-amber-300">
              Select reason displayed to customers:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {["Holiday", "Kitchen Maintenance", "Private Event", "Heavy Rain", "Staff Shortage"].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onChange("closureReason", reason)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                    form.closureReason === reason
                      ? "bg-amber-500 text-white border-amber-500 font-semibold shadow-xs"
                      : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-amber-400"
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
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs outline-none focus:border-amber-500"
            />
          </div>
        )}
      </section>

      {/* ── NOTIFICATION BANNER ─────────────────────────────────────────────── */}
      {notification && (
        <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center justify-between shadow-xs animate-in fade-in">
          <span className="flex items-center gap-1.5 font-semibold">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            {notification}
          </span>
          <button
            type="button"
            onClick={() => setNotification("")}
            className="text-emerald-400 hover:underline font-bold ml-2 cursor-pointer text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── WEEKLY OPERATING SCHEDULE CARD ──────────────────────────────────── */}
      <section className="bg-zinc-900/60 dark:bg-[#12141c] border border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition-colors">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
              Weekly Operating Schedule
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Manage opening hours for every day of the week.
            </p>
          </div>

          <div className="shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Schedule active
            </span>
          </div>
        </div>

        {/* Timezone Selector Bar */}
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl bg-zinc-950/70 dark:bg-[#0c0e14] border border-zinc-800 text-xs text-zinc-300">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-[11px] text-zinc-400 font-medium shrink-0">Timezone</span>
            <div className="relative flex-1 min-w-0 max-w-xs">
              <select
                value={currentTimezone}
                onChange={(e) => updateTimezone(e.target.value)}
                aria-label="Restaurant timezone"
                className="w-full appearance-none bg-transparent text-zinc-100 font-semibold outline-none cursor-pointer text-xs hover:text-orange-400 transition-colors pr-5"
              >
                <option value="Asia/Kolkata" className="bg-zinc-900 text-white">Asia/Kolkata (IST)</option>
                <option value="Asia/Dubai" className="bg-zinc-900 text-white">Asia/Dubai (GST)</option>
                <option value="Asia/Singapore" className="bg-zinc-900 text-white">Asia/Singapore (SGT)</option>
                <option value="Asia/Bangkok" className="bg-zinc-900 text-white">Asia/Bangkok (ICT)</option>
                <option value="Europe/London" className="bg-zinc-900 text-white">Europe/London (GMT)</option>
                <option value="Europe/Paris" className="bg-zinc-900 text-white">Europe/Paris (CET)</option>
                <option value="America/New_York" className="bg-zinc-900 text-white">America/New_York (EST)</option>
                <option value="America/Chicago" className="bg-zinc-900 text-white">America/Chicago (CST)</option>
                <option value="America/Los_Angeles" className="bg-zinc-900 text-white">America/Los_Angeles (PST)</option>
                <option value="UTC" className="bg-zinc-900 text-white">UTC (Universal)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-zinc-400">
                <ChevronDown className="w-3 h-3 opacity-60" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            {/* 12h / 24h toggle */}
            <div className="inline-flex rounded-lg border border-zinc-800 p-0.5 bg-zinc-900 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setTimeFormat("12-hour")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  is12Hour ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-400 hover:text-white"
                }`}
              >
                12h
              </button>
              <button
                type="button"
                onClick={() => setTimeFormat("24-hour")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  !is12Hour ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-400 hover:text-white"
                }`}
              >
                24h
              </button>
            </div>

            {/* Live clock */}
            {liveTime && (
              <span className="font-mono text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                {liveTime}
              </span>
            )}
          </div>
        </div>

        {/* ── QUICK SCHEDULE BUILDER CARD ──────────────────────────────────── */}
        <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-950/80 dark:bg-[#0c0e14] border border-zinc-800 space-y-3">
          {/* Card Top Title Row */}
          <div className="flex items-start justify-between gap-2.5">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                Quick Schedule Builder
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Set hours once, then apply to selected days.
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Zap className="w-4 h-4 text-orange-500" />
            </div>
          </div>

          {/* Opening & Closing time inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div>
              <label htmlFor="builder-open" className="text-[11px] text-zinc-400 font-medium mb-1 block">
                Opening time
              </label>
              <TimeSelect
                id="builder-open"
                value={builderOpen}
                onChange={setBuilderOpen}
                is12Hour={is12Hour}
              />
            </div>

            <div>
              <label htmlFor="builder-close" className="text-[11px] text-zinc-400 font-medium mb-1 block">
                Closing time
              </label>
              <TimeSelect
                id="builder-close"
                value={builderClose}
                onChange={setBuilderClose}
                is12Hour={is12Hour}
              />
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => applyBuilderSchedule("all")}
            className="w-full py-2 sm:py-2.5 rounded-full bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-[0.99] cursor-pointer"
            title="Apply hours to all 7 days"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-800" />
            <span>Apply hours to all 7 days</span>
          </button>

          {/* Secondary Actions (Mon-Fri and Sat-Sun) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => applyBuilderSchedule("weekdays")}
              className="py-1.5 sm:py-2 rounded-full border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center transition active:scale-[0.99] cursor-pointer"
              title="Apply to Monday through Friday"
            >
              Mon–Fri
            </button>

            <button
              type="button"
              onClick={() => applyBuilderSchedule("weekends")}
              className="py-1.5 sm:py-2 rounded-full border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center transition active:scale-[0.99] cursor-pointer"
              title="Apply to Saturday and Sunday"
            >
              Sat–Sun
            </button>
          </div>

          {/* Presets and Open/Close All Row */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-medium">Quick presets</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllDays(true)}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-emerald-400 transition cursor-pointer"
                >
                  Open all
                </button>
                <span className="text-zinc-600 text-xs">•</span>
                <button
                  type="button"
                  onClick={() => toggleAllDays(false)}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                >
                  Close all
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                  title={`Apply ${p.desc}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── TIMEZONE INFORMATION BANNER ─────────────────────────────────── */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-zinc-950/60 dark:bg-[#0c0e14] border border-zinc-800/80 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-zinc-300">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span>
              Storefront active clock: <strong className="text-white font-semibold">{currentTimezone}</strong>. Customers see:{" "}
              <strong className="text-orange-400 font-bold">{activeSyncedHours}</strong>
            </span>
          </div>
          {currentTimezone !== "Asia/Kolkata" && (
            <button
              type="button"
              onClick={() => updateTimezone("Asia/Kolkata")}
              className="text-[11px] font-bold text-orange-400 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset to India (IST)
            </button>
          )}
        </div>

        {/* ── DAILY HOURS SECTION ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
              Daily hours
            </h2>
            <span className="text-[11px] text-zinc-400 font-medium">7 days</span>
          </div>

          <div className="space-y-2">
            {DAYS_OF_WEEK.map(({ key, label, isWeekend }, idx) => {
              const dayData = weeklyHours[key] || { isOpen: true, slots: [{ open: "08:00", close: "21:00" }] };
              const isOpen = dayData.isOpen ?? true;
              const slot = dayData.slots?.[0] || { open: "08:00", close: "21:00" };

              return (
                <div key={key}>
                  <div
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                      isOpen
                        ? "bg-zinc-950/70 dark:bg-[#0c0e14] border-zinc-800 hover:border-zinc-700/80"
                        : "bg-zinc-950/30 dark:bg-[#090b10] border-zinc-800/40 opacity-70"
                    }`}
                  >
                    {/* Day Name, Badge & Open/Closed Status Button */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                          {label}
                        </h3>
                        <div className="mt-0.5">
                          {isWeekend ? (
                            <span className="text-[10px] font-medium text-violet-400">
                              Weekend
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-zinc-400">
                              Weekday
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Interactive Open/Closed Status Badge */}
                      <button
                        type="button"
                        onClick={() => updateDayIsOpen(key, !isOpen)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isOpen
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                        }`}
                        title={`Click to mark ${label} as ${isOpen ? "Closed" : "Open"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOpen ? "bg-emerald-400" : "bg-zinc-500"
                          }`}
                        />
                        <span>{isOpen ? "Open" : "Closed"}</span>
                      </button>
                    </div>

                    {/* Opening & Closing Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 mt-2">
                      <div>
                        <label htmlFor={`${key}-open`} className="text-[10px] text-zinc-400 font-medium mb-0.5 block">
                          Opens
                        </label>
                        <TimeSelect
                          id={`${key}-open`}
                          value={slot.open || "08:00"}
                          onChange={(val) => updateDaySlot(key, "open", val)}
                          is12Hour={is12Hour}
                          disabled={!isOpen}
                        />
                      </div>

                      <div>
                        <label htmlFor={`${key}-close`} className="text-[10px] text-zinc-400 font-medium mb-0.5 block">
                          Closes
                        </label>
                        <TimeSelect
                          id={`${key}-close`}
                          value={slot.close || "21:00"}
                          onChange={(val) => updateDaySlot(key, "close", val)}
                          is12Hour={is12Hour}
                          disabled={!isOpen}
                        />
                      </div>
                    </div>

                    {/* Bottom Row: Copy hours */}
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => copyDayToAll(key)}
                        disabled={!isOpen}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={`Copy ${label}'s timing to all 7 days`}
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy hours</span>
                      </button>
                    </div>
                  </div>

                  {/* Down-Arrow Connector between consecutive days */}
                  {idx < DAYS_OF_WEEK.length - 1 && (
                    <div className="flex justify-center -my-1.5 relative z-10 pointer-events-none">
                      <div className="w-5 h-5 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 shadow-2xs">
                        <ArrowDown className="w-2.5 h-2.5" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </section>
    </div>
  );
}
