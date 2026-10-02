import { create } from "zustand";

function getUserStorageKey(userIdentifier) {
  if (!userIdentifier) return "pet_protocols_favs_guest";
  const clean = String(userIdentifier).toLowerCase().trim();
  return `pet_protocols_favs_${clean}`;
}

export const useFavoritesStore = create((set, get) => ({
  favorites: [], // array of product objects for currently active user
  currentUserId: null, // email or id of active user (null = uninitialized / guest)
  isLoaded: false,

  // Check if a product is favorited by the active user
  isFavorite: (productId) => {
    if (!productId) return false;
    const id = typeof productId === "object" ? String(productId._id || productId.id) : String(productId);
    return get().favorites.some((item) => String(item._id || item.id) === id);
  },

  // Toggle favorite for the active user
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

    // 2. Save to user-specific localStorage cache
    const activeKey = getUserStorageKey(get().currentUserId);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(activeKey, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Could not cache favorites locally:", e);
    }

    // 3. Persist to MongoDB for authenticated user
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
    const activeKey = getUserStorageKey(cleanId);

    // 1. Instant restore from user-specific local cache
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

    // 2. If logged in, fetch from DB to get fresh server truth
    if (cleanId) {
      try {
        const res = await fetch("/api/favorites");
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
    }
  },

  // Clear favorites locally on logout (does NOT delete user's cloud favorites)
  clearFavoritesLocal: () => {
    set({
      currentUserId: null,
      favorites: [],
      isLoaded: false,
    });
  },

  // Delete all favorites from active user's account
  clearFavorites: async () => {
    const activeKey = getUserStorageKey(get().currentUserId);
    set({ favorites: [] });
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

export default useFavoritesStore;
