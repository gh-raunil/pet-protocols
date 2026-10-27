"use client";

import { create } from "zustand";

export const LOCATION_STORAGE_KEY = "pet_protocols_delivery_location";
export const FIRST_TIME_SHOWN_KEY = "pet_protocols_location_first_prompt_seen";

/**
 * Validates that latitude and longitude are valid non-Null Island coordinates
 */
export function isValidClientCoordinate(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (typeof lat === "string" && lat.trim() === "") return false;
  if (typeof lng === "string" && lng.trim() === "") return false;

  const nLat = Number(lat);
  const nLng = Number(lng);

  if (isNaN(nLat) || isNaN(nLng) || !isFinite(nLat) || !isFinite(nLng)) return false;
  if (nLat === 0 && nLng === 0) return false;
  if (nLat < -90 || nLat > 90) return false;
  if (nLng < -180 || nLng > 180) return false;

  return true;
}

/**
 * Preset popular hubs / city search preferences.
 * Note: These are city-level preferences, NOT proof of delivery serviceability.
 * Exact delivery eligibility requires valid coordinates.
 */
export const SUGGESTED_LOCATIONS = [
  {
    id: "loc_vellore",
    name: "Vellore, Tamil Nadu",
    area: "VIT & Katpadi Area",
    city: "Vellore",
    state: "Tamil Nadu",
    hasExactCoordinates: false,
    isApproximate: true,
  },
  {
    id: "loc_indiranagar",
    name: "Indiranagar, Bangalore",
    area: "100ft Road & Defence Colony",
    city: "Bengaluru",
    state: "Karnataka",
    hasExactCoordinates: false,
    isApproximate: true,
  },
  {
    id: "loc_koramangala",
    name: "Koramangala, Bangalore",
    area: "5th Block & Sony World Jn",
    city: "Bengaluru",
    state: "Karnataka",
    hasExactCoordinates: false,
    isApproximate: true,
  },
  {
    id: "loc_jhumri",
    name: "Jhumri Telaiya, Jharkhand",
    area: "Ranchi-Patna Road",
    city: "Jhumri Telaiya",
    state: "Jharkhand",
    hasExactCoordinates: false,
    isApproximate: true,
  },
  {
    id: "loc_mumbai",
    name: "Bandra West, Mumbai",
    area: "Linking Road & Hill Road",
    city: "Mumbai",
    state: "Maharashtra",
    hasExactCoordinates: false,
    isApproximate: true,
  },
  {
    id: "loc_delhi",
    name: "Connaught Place, New Delhi",
    area: "Inner Circle & Rajiv Chowk",
    city: "New Delhi",
    state: "Delhi",
    hasExactCoordinates: false,
    isApproximate: true,
  },
];

const DEFAULT_LOCATION = SUGGESTED_LOCATIONS[0];

export const useLocationStore = create((set, get) => ({
  location: DEFAULT_LOCATION.name,
  locationDetails: DEFAULT_LOCATION,
  isModalOpen: false,
  status: "idle", // 'idle' | 'detecting' | 'checking' | 'available' | 'unavailable' | 'city_selected'
  statusMessage: "",
  isEvaluating: false,
  lastRequestId: 0,
  hasInitialized: false,

  openModal: () => set({ isModalOpen: true, status: "idle", statusMessage: "" }),
  openLocationModal: () => set({ isModalOpen: true, status: "idle", statusMessage: "" }),
  closeModal: () => set({ isModalOpen: false, status: "idle", statusMessage: "" }),
  closeLocationModal: () => set({ isModalOpen: false, status: "idle", statusMessage: "" }),

  initializeLocation: () => {
    if (get().hasInitialized) return;
    if (typeof window === "undefined") return;

    let savedLoc = null;
    try {
      const cached = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (cached) {
        savedLoc = JSON.parse(cached);
      }
    } catch {
      try {
        const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
        if (raw && typeof raw === "string") {
          savedLoc = { name: raw, hasExactCoordinates: false, isApproximate: true };
        }
      } catch {}
    }

    if (savedLoc?.name) {
      set({
        location: savedLoc.name,
        locationDetails: savedLoc,
        hasInitialized: true,
      });

      // If saved location has real coordinates, check live serviceability on initialization
      if (savedLoc.latitude && savedLoc.longitude && isValidClientCoordinate(savedLoc.latitude, savedLoc.longitude)) {
        get().evaluateServiceability(savedLoc.latitude, savedLoc.longitude);
      }
    } else {
      // First-time visitor check: keep modal closed so users can browse seamlessly
      set({
        location: DEFAULT_LOCATION.name,
        locationDetails: DEFAULT_LOCATION,
        hasInitialized: true,
        isModalOpen: false,
      });
      try {
        localStorage.setItem(FIRST_TIME_SHOWN_KEY, "true");
      } catch {}
    }
  },

  restaurantsServiceability: {}, // Keyed by restaurant ID, slug, and lowercased name

  getRestaurantServiceability: (key) => {
    if (!key) return null;
    const map = get().restaurantsServiceability || {};
    return map[String(key)] || map[String(key).toLowerCase().trim()] || null;
  },

  /**
   * Evaluates live restaurant serviceability using the authoritative backend endpoint
   * Protected with request ID generation tracking to prevent async race conditions.
   */
  evaluateServiceability: async (latitude, longitude) => {
    const nextReqId = (get().lastRequestId || 0) + 1;

    if (!isValidClientCoordinate(latitude, longitude)) {
      set({
        lastRequestId: nextReqId,
        isEvaluating: false,
        status: "unavailable",
        statusMessage: "Invalid GPS coordinates provided. Please pin your location on the map.",
        restaurantsServiceability: {},
      });
      return false;
    }

    set({
      lastRequestId: nextReqId,
      isEvaluating: true,
      status: "checking",
      statusMessage: "Checking delivery coverage for your location...",
      restaurantsServiceability: {},
    });

    try {
      const res = await fetch(`/api/restaurants?lat=${latitude}&lng=${longitude}`);
      const data = await res.json();

      // Discard stale responses if a newer location evaluation was launched
      if (get().lastRequestId !== nextReqId) {
        return false;
      }

      if (data.success && Array.isArray(data.restaurants)) {
        const isServiceable = Boolean(data.isAnyRestaurantServiceable);
        const count = data.serviceableCount || 0;

        // Build quick-lookup serviceability dictionary
        const serviceMap = {};
        for (const r of data.restaurants) {
          if (r._id) serviceMap[String(r._id)] = r.serviceability;
          if (r.slug) serviceMap[String(r.slug)] = r.serviceability;
          if (r.name) serviceMap[String(r.name).toLowerCase().trim()] = r.serviceability;
        }

        // Final check before committing state to avoid racing
        if (get().lastRequestId !== nextReqId) {
          return false;
        }

        if (isServiceable) {
          set({
            isEvaluating: false,
            status: "available",
            statusMessage: `${count} partner kitchen${count === 1 ? "" : "s"} deliver${count === 1 ? "s" : ""} to your exact location.`,
            restaurantsServiceability: serviceMap,
          });
        } else {
          set({
            isEvaluating: false,
            status: "unavailable",
            statusMessage: "We do not deliver here yet. Partner kitchens are currently outside your delivery area.",
            restaurantsServiceability: serviceMap,
          });
        }
        return isServiceable;
      } else {
        if (get().lastRequestId !== nextReqId) {
          return false;
        }
        set({
          isEvaluating: false,
          status: "unavailable",
          statusMessage: data.locationError?.message || data.error || "Unable to verify delivery serviceability for this location.",
          restaurantsServiceability: {},
        });
        return false;
      }
    } catch (err) {
      if (get().lastRequestId !== nextReqId) {
        return false;
      }
      console.warn("Delivery serviceability check error:", err);
      set({
        isEvaluating: false,
        status: "unavailable",
        statusMessage: "Network issue checking delivery coverage. You can still browse the menu.",
        restaurantsServiceability: {},
      });
      return false;
    }
  },

  /**
   * Sets exact coordinates (from device GPS or Leaflet Map pin) and triggers authoritative backend serviceability check
   */
  setCoordinatesAndCheck: async ({ latitude, longitude, name, area, isApproximate = false }) => {
    if (!isValidClientCoordinate(latitude, longitude)) {
      set({
        status: "unavailable",
        statusMessage: "Invalid coordinates provided. Please select or pin a valid location.",
      });
      return;
    }

    const nLat = Number(latitude);
    const nLng = Number(longitude);

    const displayName = name || `GPS Location (${nLat.toFixed(2)}°, ${nLng.toFixed(2)}°)`;
    const locObj = {
      id: `coords_${nLat.toFixed(4)}_${nLng.toFixed(4)}`,
      name: displayName,
      area: area || "Exact GPS Coordinates",
      latitude: nLat,
      longitude: nLng,
      hasExactCoordinates: true,
      isApproximate,
    };

    set({
      location: displayName,
      locationDetails: locObj,
      restaurantsServiceability: {},
      isEvaluating: true,
    });

    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locObj));
    } catch {}

    await get().evaluateServiceability(nLat, nLng);
  },

  /**
   * User selects a preset city or types an address text without exact coordinates.
   * Clears any stale coordinate-derived serviceability dictionary.
   */
  selectLocation: async (locObj) => {
    // If an object with exact coordinates is provided, use setCoordinatesAndCheck
    if (typeof locObj === "object" && locObj !== null && locObj.latitude && locObj.longitude) {
      return get().setCoordinatesAndCheck(locObj);
    }

    const nextReqId = (get().lastRequestId || 0) + 1;
    const locName = typeof locObj === "string" ? locObj : locObj.name;
    const match =
      typeof locObj === "object" && locObj !== null
        ? locObj
        : SUGGESTED_LOCATIONS.find((l) => l.name.toLowerCase() === locName.toLowerCase()) || {
            name: locName,
            area: "Selected Address",
            hasExactCoordinates: false,
            isApproximate: true,
          };

    // Preset cities / text addresses without GPS are treated as city preferences
    const updatedDetails = {
      ...match,
      hasExactCoordinates: false,
      isApproximate: true,
    };

    set({
      location: match.name,
      locationDetails: updatedDetails,
      status: "city_selected",
      statusMessage: `Showing kitchens in ${match.city || match.name}. Drop a pin on the map or use GPS to confirm doorstep delivery.`,
      restaurantsServiceability: {},
      isEvaluating: false,
      lastRequestId: nextReqId,
    });

    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(updatedDetails));
    } catch {}
  },

  /**
   * Resets location to default and clears all serviceability state
   */
  clearLocation: () => {
    const nextReqId = (get().lastRequestId || 0) + 1;
    set({
      location: DEFAULT_LOCATION.name,
      locationDetails: DEFAULT_LOCATION,
      status: "idle",
      statusMessage: "",
      restaurantsServiceability: {},
      isEvaluating: false,
      lastRequestId: nextReqId,
    });
    try {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch {}
  },

  confirmSelectedLocation: () => {
    set({ isModalOpen: false, status: "idle", statusMessage: "" });
  },

  /**
   * Detects current location via browser Geolocation API
   */
  detectCurrentLocation: () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      set({
        status: "unavailable",
        statusMessage: "Geolocation is not supported by your browser.",
      });
      return;
    }

    set({ status: "detecting", statusMessage: "Requesting device GPS position..." });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        if (!isValidClientCoordinate(latitude, longitude)) {
          set({
            status: "unavailable",
            statusMessage: "Device reported invalid GPS coordinates.",
          });
          return;
        }

        const detectedName = `Device GPS (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`;
        const detectedObj = {
          id: "gps_detected",
          name: detectedName,
          area: accuracy ? `Approximate GPS (within ~${Math.round(accuracy)}m)` : "Device GPS Position",
          latitude,
          longitude,
          accuracy: accuracy || null,
          hasExactCoordinates: true,
          isApproximate: true,
        };

        set({
          location: detectedName,
          locationDetails: detectedObj,
        });

        try {
          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(detectedObj));
        } catch {}

        await get().evaluateServiceability(latitude, longitude);
      },
      (err) => {
        let errorMsg = "Unable to detect GPS position. Please select or pin your location manually.";
        if (err.code === 1) {
          errorMsg = "Location permission denied. Please allow GPS access in your browser or select an area manually.";
        } else if (err.code === 2) {
          errorMsg = "Location position unavailable from device. Please select your location manually.";
        } else if (err.code === 3) {
          errorMsg = "Location request timed out. Please try again or select your location manually.";
        }

        set({
          status: "unavailable",
          statusMessage: errorMsg,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  },
}));

export default useLocationStore;
