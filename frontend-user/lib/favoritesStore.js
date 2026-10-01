import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useFavoritesStore = create(
  persist(
    (set, get) => ({
      favorites: [], // array of product objects

      isFavorite: (productId) => {
        if (!productId) return false;
        const id = typeof productId === "object" ? productId._id || productId.id : productId;
        return get().favorites.some((item) => (item._id || item.id) === id);
      },

      toggleFavorite: (product) => {
        if (!product) return;
        const id = product._id || product.id;
        const exists = get().favorites.some((item) => (item._id || item.id) === id);

        if (exists) {
          set({
            favorites: get().favorites.filter((item) => (item._id || item.id) !== id),
          });
        } else {
          set({
            favorites: [product, ...get().favorites].slice(0, 50),
          });
        }
      },

      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: "pet_protocols_customer_favorites",
    }
  )
);

export default useFavoritesStore;
