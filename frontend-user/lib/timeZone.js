/**
 * Time Zone Utility for Pet Protocols.
 * Default: "Asia/Kolkata" (India Standard Time / IST, UTC+5:30).
 * Provides functions to get, set, and format dates in India time or user-selected timezone.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST)", offset: "UTC+5:30", region: "India 🇮🇳" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST)", offset: "UTC+4:00", region: "UAE / Gulf 🇦🇪" },
  { value: "Asia/Singapore", label: "Singapore Standard Time (SGT)", offset: "UTC+8:00", region: "Singapore 🇸🇬" },
  { value: "Asia/Bangkok", label: "Indochina Time (ICT)", offset: "UTC+7:00", region: "Thailand 🇹🇭" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT/BST)", offset: "UTC+0:00 / +1:00", region: "UK 🇬🇧" },
  { value: "Europe/Paris", label: "Central European Time (CET/CEST)", offset: "UTC+1:00 / +2:00", region: "Europe 🇪🇺" },
  { value: "America/New_York", label: "Eastern Time (EST/EDT)", offset: "UTC-5:00 / -4:00", region: "US East 🇺🇸" },
  { value: "America/Chicago", label: "Central Time (CST/CDT)", offset: "UTC-6:00 / -5:00", region: "US Central 🇺🇸" },
  { value: "America/Los_Angeles", label: "Pacific Time (PST/PDT)", offset: "UTC-8:00 / -7:00", region: "US West 🇺🇸" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)", offset: "UTC+0:00", region: "Universal 🌐" },
];

/**
 * Get active timezone from localStorage or fallback to India Standard Time.
 */
export function getTimeZone() {
  if (typeof window === "undefined") {
    return DEFAULT_TIMEZONE;
  }
  try {
    const saved = localStorage.getItem("pet_user_timezone");
    return saved || DEFAULT_TIMEZONE;
  } catch (e) {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Set active timezone in localStorage and notify all components.
 */
export function setTimeZone(tz) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("pet_user_timezone", tz || DEFAULT_TIMEZONE);
    window.dispatchEvent(new CustomEvent("timezone-change", { detail: tz || DEFAULT_TIMEZONE }));
  } catch (e) {
    console.warn("Could not save timezone:", e);
  }
}

/**
 * Get weekday and time parts for a given Date in the target timezone.
 * Returns { weekday: 'sunday'..'saturday', hour, minute, second, minutes: hour*60+minute, timeZone }
 */
export function getZonedDateParts(date = new Date(), targetTz) {
  const tz = targetTz || getTimeZone() || DEFAULT_TIMEZONE;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(date instanceof Date ? date : new Date(date));
    const partMap = {};
    for (const part of parts) {
      partMap[part.type] = part.value;
    }

    const weekday = (partMap.weekday || "monday").toLowerCase();
    const hour = parseInt(partMap.hour || "0", 10) % 24;
    const minute = parseInt(partMap.minute || "0", 10);
    const second = parseInt(partMap.second || "0", 10);
    const minutes = hour * 60 + minute;

    return {
      weekday,
      hour,
      minute,
      second,
      minutes,
      timeZone: tz,
    };
  } catch (err) {
    // Fallback to India Time offset (UTC+5:30)
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    const istDate = new Date(utcMs + 5.5 * 3600000);
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return {
      weekday: days[istDate.getDay()],
      hour: istDate.getHours(),
      minute: istDate.getMinutes(),
      second: istDate.getSeconds(),
      minutes: istDate.getHours() * 60 + istDate.getMinutes(),
      timeZone: DEFAULT_TIMEZONE,
    };
  }
}

/**
 * Format date in target or active timezone with standard Indian locale presentation.
 */
export function formatDateInTimeZone(date, targetTz, options = {}) {
  const tz = targetTz || getTimeZone() || DEFAULT_TIMEZONE;
  const d = date instanceof Date ? date : new Date(date);

  const defaultOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
    ...options,
  };

  try {
    return new Intl.DateTimeFormat("en-IN", defaultOptions).format(d);
  } catch (e) {
    return d.toLocaleString("en-IN", defaultOptions);
  }
}
