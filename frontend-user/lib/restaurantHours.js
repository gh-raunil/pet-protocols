import { useState, useEffect } from "react";
import { getZonedDateParts } from "./timeZone.js";

/**
 * Convert 24-hour time "HH:mm" (e.g. "08:00", "21:00") into 12-hour formatted "08:00 AM", "09:00 PM".
 */
export function formatTime12(timeStr) {
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

/**
 * Format a slot range (e.g. "08:00" to "21:00" -> "08:00 AM – 09:00 PM").
 */
export function formatSlotRange(open, close) {
  if (!open || !close) return "";
  if ((open === "00:00" && close === "23:59") || (open === "00:00" && close === "00:00")) {
    return "Open 24 Hours";
  }
  return `${formatTime12(open)} – ${formatTime12(close)}`;
}

/**
 * Helper utility to determine whether a restaurant is currently open and accepting orders.
 * Evaluates in restaurant's configured timezone (defaults to Asia/Kolkata).
 * Checks:
 * - isTemporarilyClosed flag and closure reason
 * - isOpen business operational flag
 * - acceptingOrders flag
 * - weeklyHours schedule (day of week & opening slots)
 * - openingHours string fallback (e.g. "10:00 AM - 11:00 PM")
 */
export function getRestaurantOperationalStatus(restaurant) {
  if (!restaurant) {
    return { isOpen: true, reason: "", hoursText: "" };
  }

  // 1. Temporarily closed
  if (restaurant.isTemporarilyClosed) {
    return {
      isOpen: false,
      reason: restaurant.closureReason || "Temporarily Closed",
      hoursText: restaurant.openingHours || "Temporarily closed",
    };
  }

  // 2. Closed by master toggle
  if (restaurant.isOpen === false) {
    return {
      isOpen: false,
      reason: restaurant.closureReason || "Currently Closed",
      hoursText: restaurant.openingHours || "Closed",
    };
  }

  // 3. Not accepting online orders
  if (restaurant.acceptingOrders === false) {
    return {
      isOpen: false,
      reason: "Not Accepting Online Orders",
      hoursText: restaurant.openingHours || "Ordering paused",
    };
  }

  // 4. Timezone-aware Weekly schedule checking (India Standard Time / Asia/Kolkata by default)
  const tz = restaurant.regionalSettings?.timezone || "Asia/Kolkata";
  const zoned = getZonedDateParts(new Date(), tz);
  const currentDay = zoned.weekday;
  const currentMinutes = zoned.minutes;

  if (restaurant.weeklyHours && typeof restaurant.weeklyHours === "object") {
    const todaySchedule = restaurant.weeklyHours[currentDay];
    if (todaySchedule) {
      if (todaySchedule.isOpen === false) {
        return {
          isOpen: false,
          reason: "Closed Today",
          hoursText: "Closed today",
        };
      }

      const slots = Array.isArray(todaySchedule.slots) ? todaySchedule.slots : [];
      if (slots.length > 0) {
        let isWithinAnySlot = false;
        let activeSlot = null;

        for (const slot of slots) {
          if (!slot.open || !slot.close) continue;
          const [openH, openM] = slot.open.split(":").map(Number);
          const [closeH, closeM] = slot.close.split(":").map(Number);
          const slotOpenMin = openH * 60 + (openM || 0);
          const slotCloseMin = closeH * 60 + (closeM || 0);

          // Standard slot (e.g. 08:00 - 21:00)
          if (slotCloseMin >= slotOpenMin) {
            if (currentMinutes >= slotOpenMin && currentMinutes <= slotCloseMin) {
              isWithinAnySlot = true;
              activeSlot = slot;
              break;
            }
          } else {
            // Overnight slot (e.g. 18:00 - 02:00)
            if (currentMinutes >= slotOpenMin || currentMinutes <= slotCloseMin) {
              isWithinAnySlot = true;
              activeSlot = slot;
              break;
            }
          }
        }

        const firstSlot = slots[0];
        const formattedSlotRange = formatSlotRange(firstSlot?.open, firstSlot?.close);

        if (isWithinAnySlot) {
          return {
            isOpen: true,
            reason: "",
            hoursText: formattedSlotRange || restaurant.openingHours || "Open Now",
          };
        }

        // Not within open slot
        const [firstOpenH, firstOpenM] = (firstSlot?.open || "10:00").split(":").map(Number);
        const firstOpenMin = firstOpenH * 60 + (firstOpenM || 0);
        const [firstCloseH, firstCloseM] = (firstSlot?.close || "23:00").split(":").map(Number);
        const firstCloseMin = firstCloseH * 60 + (firstCloseM || 0);

        let reason = `Closed now (Opens at ${formatTime12(firstSlot?.open)})`;
        if (firstCloseMin >= firstOpenMin) {
          if (currentMinutes > firstCloseMin) {
            reason = `Closed for today (Closed at ${formatTime12(firstSlot?.close)})`;
          } else if (currentMinutes < firstOpenMin) {
            reason = `Closed now (Opens at ${formatTime12(firstSlot?.open)})`;
          }
        }

        return {
          isOpen: false,
          reason,
          hoursText: formattedSlotRange || restaurant.openingHours || "Closed",
        };
      }
    }
  }

  // 5. Fallback string check if openingHours matches standard "HH:MM AM - HH:MM PM" format
  if (restaurant.openingHours && typeof restaurant.openingHours === "string") {
    const hoursMatch = restaurant.openingHours.match(/(\d+):?(\d*)\s*(AM|PM)\s*-\s*(\d+):?(\d*)\s*(AM|PM)/i);
    if (hoursMatch) {
      let [, h1, m1, p1, h2, m2, p2] = hoursMatch;
      let startH = parseInt(h1, 10);
      if (p1.toUpperCase() === "PM" && startH < 12) startH += 12;
      if (p1.toUpperCase() === "AM" && startH === 12) startH = 0;
      const startMin = startH * 60 + (parseInt(m1, 10) || 0);

      let endH = parseInt(h2, 10);
      if (p2.toUpperCase() === "PM" && endH < 12) endH += 12;
      if (p2.toUpperCase() === "AM" && endH === 12) endH = 0;
      const endMin = endH * 60 + (parseInt(m2, 10) || 0);

      if (startMin < endMin) {
        if (currentMinutes < startMin || currentMinutes > endMin) {
          return {
            isOpen: false,
            reason: `Closed now (Opens at ${h1}${m1 ? `:${m1}` : ""} ${p1.toUpperCase()})`,
            hoursText: restaurant.openingHours,
          };
        }
      }
    }
  }

  return {
    isOpen: true,
    reason: "",
    hoursText: restaurant.openingHours || "10:00 AM - 11:00 PM",
  };
}

/**
 * React hook to evaluate restaurant operational status reactively in live time.
 * Automatically recalculates every 15 seconds so opening/closing time changes occur live.
 */
export function useOperationalStatus(restaurant) {
  const [status, setStatus] = useState(() => getRestaurantOperationalStatus(restaurant));

  useEffect(() => {
    setStatus(getRestaurantOperationalStatus(restaurant));

    // Re-check every 15 seconds to ensure live transitions on minute boundaries
    const interval = setInterval(() => {
      setStatus(getRestaurantOperationalStatus(restaurant));
    }, 15000);

    return () => clearInterval(interval);
  }, [
    restaurant?._id,
    restaurant?.isOpen,
    restaurant?.acceptingOrders,
    restaurant?.isTemporarilyClosed,
    restaurant?.openingHours,
    restaurant?.regionalSettings?.timezone,
    JSON.stringify(restaurant?.weeklyHours),
  ]);

  return status;
}
