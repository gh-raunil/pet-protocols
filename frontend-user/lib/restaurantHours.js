import { getZonedDateParts } from "@/lib/timeZone";

/**
 * Helper utility to determine whether a restaurant is currently open and accepting orders.
 * Evaluates in India Standard Time (Asia/Kolkata) or configured restaurant timezone.
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

  // 2. Closed by toggle
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
          hoursText: restaurant.openingHours || "Closed today",
        };
      }

      if (Array.isArray(todaySchedule.slots) && todaySchedule.slots.length > 0) {
        let isWithinAnySlot = false;
        for (const slot of todaySchedule.slots) {
          if (!slot.open || !slot.close) continue;
          const [openH, openM] = slot.open.split(":").map(Number);
          const [closeH, closeM] = slot.close.split(":").map(Number);
          const slotOpenMin = openH * 60 + (openM || 0);
          const slotCloseMin = closeH * 60 + (closeM || 0);

          if (currentMinutes >= slotOpenMin && currentMinutes <= slotCloseMin) {
            isWithinAnySlot = true;
            break;
          }
        }

        if (!isWithinAnySlot) {
          const firstSlot = todaySchedule.slots[0];
          return {
            isOpen: false,
            reason: `Closed now (Opens ${firstSlot?.open || "later"})`,
            hoursText: `${firstSlot?.open || "10:00"} - ${firstSlot?.close || "23:00"}`,
          };
        }
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
