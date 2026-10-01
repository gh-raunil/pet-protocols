import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useRecentStore = create(
  persist(
    (set, get) => ({
      recentDishes: [], // array of product objects

      addRecentDish: (product) => {
        if (!product || (!product._id && !product.id)) return;
        const id = product._id || product.id;
        const current = get().recentDishes.filter((item) => (item._id || item.id) !== id);
        set({
          recentDishes: [product, ...current].slice(0, 10),
        });
      },

      clearRecentDishes: () => set({ recentDishes: [] }),
    }),
    {
      name: "pet_protocols_recent_dishes",
    }
  )
);

export default useRecentStore;
