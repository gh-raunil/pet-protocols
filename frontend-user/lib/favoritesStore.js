import { create } from "zustand";

const GUEST_STORAGE_KEY = "pet_protocols_favs_guest";

function getUserStorageKey(userIdentifier) {
  if (!userIdentifier) return GUEST_STORAGE_KEY;
  const clean = String(userIdentifier).toLowerCase().trim();
  return `pet_protocols_favs_${clean}`;
}

export const useFavoritesStore = create((set, get) => ({
  favorites: [], // array of product objects for currently active user / guest
  currentUserId: null, // email or id of active user (null = guest)
  isLoaded: false,

  // Check if a product is favorited by the active user or guest
  isFavorite: (productId) => {
    if (!productId) return false;
    const id = typeof productId === "object" ? String(productId._id || productId.id) : String(productId);
    return get().favorites.some((item) => String(item._id || item.id) === id);
  },

  // Toggle favorite for the active user or guest
  toggleFavorite: async (product) => {
    if (!product) return;
    const id = String(product._id || product.id);
    const prevList = get().favorites;
    const exists = prevList.some((item) => String(item._id || item.id) === id);

    // 1. Optimistic local update
    let updated;
    if (exists) {
      updated = prevList.filter((item) => String(item._id || item.id) !== id);
    } else {
      updated = [product, ...prevList].slice(0, 100);
    }
    set({ favorites: updated });

    const activeUser = get().currentUserId;

    // 2. If guest or not yet loaded, persist strictly to user's device and attempt silent sync if authenticated session exists
    if (!activeUser) {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
        }
      } catch (e) {
        console.warn("Could not cache guest favorites locally:", e);
      }

      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.favorites)) {
            set({ favorites: data.favorites });
          }
        }
      } catch (e) {
        // Unauthenticated guest or offline
      }
      return;
    }

    // 3. If authenticated user, save to user-specific cache and sync with MongoDB
    const activeKey = getUserStorageKey(activeUser);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(activeKey, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Could not cache user favorites locally:", e);
    }

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.favorites)) {
          set({ favorites: data.favorites });
          if (typeof window !== "undefined") {
            localStorage.setItem(activeKey, JSON.stringify(data.favorites));
          }
        }
      }
    } catch (err) {
      console.warn("Failed to sync favorite with server:", err);
    }
  },

  // Load favorites specifically for a logged-in user or guest
  loadFavorites: async (userIdentifier) => {
    const cleanId = userIdentifier ? String(userIdentifier).toLowerCase().trim() : null;

    // 1. GUEST MODE — strictly load from local device storage, zero server calls
    if (!cleanId) {
      let cachedGuest = [];
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(GUEST_STORAGE_KEY);
          if (raw) cachedGuest = JSON.parse(raw);
        } catch (e) {
          cachedGuest = [];
        }
      }

      set({
        currentUserId: null,
        favorites: Array.isArray(cachedGuest) ? cachedGuest : [],
        isLoaded: true,
      });
      return;
    }

    // 2. AUTHENTICATED USER MODE
    const activeKey = getUserStorageKey(cleanId);

    // Check if there are local guest favorites that need to be migrated to this logged-in account
    let guestFavsToMigrate = [];
    if (typeof window !== "undefined") {
      try {
        const rawGuest = localStorage.getItem(GUEST_STORAGE_KEY);
        if (rawGuest) {
          const parsed = JSON.parse(rawGuest);
          if (Array.isArray(parsed) && parsed.length > 0) {
            guestFavsToMigrate = parsed;
          }
        }
      } catch (e) {}
    }

    // Instant UI restore from this user's local cache
    let cached = [];
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(activeKey);
        if (raw) cached = JSON.parse(raw);
      } catch (e) {
        cached = [];
      }
    }

    set({
      currentUserId: cleanId,
      favorites: Array.isArray(cached) ? cached : [],
      isLoaded: true,
    });

    // If guest favorites exist, merge them into user's account on MongoDB and clear guest storage
    if (guestFavsToMigrate.length > 0) {
      try {
        const guestIds = guestFavsToMigrate
          .map((p) => p?._id || p?.id)
          .filter(Boolean);

        if (guestIds.length > 0) {
          await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds: guestIds }),
          });
        }
        if (typeof window !== "undefined") {
          localStorage.removeItem(GUEST_STORAGE_KEY);
        }
      } catch (migErr) {
        console.warn("Failed to migrate guest favorites to user account:", migErr);
      }
    }

    // Fetch fresh authoritative favorites list from DB for this user
    try {
      const res = await fetch("/api/favorites", {
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.favorites)) {
          set({ favorites: data.favorites });
          if (typeof window !== "undefined") {
            localStorage.setItem(activeKey, JSON.stringify(data.favorites));
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load user favorites from backend:", err);
    }
  },

  // Clear favorites locally on logout (does NOT delete user's cloud favorites)
  clearFavoritesLocal: () => {
    set({
      currentUserId: null,
      favorites: [],
      isLoaded: false,
    });
    // Ensure guest storage is also clean on explicit logout
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      } catch (e) {}
    }
  },

  // Delete all favorites from active user's account
  clearFavorites: async () => {
    const activeUser = get().currentUserId;
    set({ favorites: [] });

    if (!activeUser) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
      return;
    }

    const activeKey = getUserStorageKey(activeUser);
    if (typeof window !== "undefined") {
      localStorage.removeItem(activeKey);
    }
    try {
      await fetch("/api/favorites", { method: "DELETE" });
    } catch (err) {
      console.error("Failed to clear favorites from server:", err);
    }
  },
}));

export function useIsFavorite(productId) {
  return useFavoritesStore((state) => {
    if (!productId) return false;
    const targetId = typeof productId === "object" ? String(productId._id || productId.id) : String(productId);
    return state.favorites.some((item) => String(item._id || item.id) === targetId);
  });
}

export default useFavoritesStore;
