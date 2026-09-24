import { create } from "zustand";
import { persist } from "zustand/middleware";

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product) => {
        const items = get().items;
        const existing = items.find((item) => item._id === product._id);
        let newItems;

        if (existing) {
          newItems = items.map((item) =>
            item._id === product._id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        } else {
          newItems = [...items, { ...product, quantity: 1 }];
        }

        set({ items: newItems });
        get().saveCart(newItems);
      },

      removeItem: (productId) => {
        const newItems = get().items.filter((item) => item._id !== productId);
        set({ items: newItems });
        get().saveCart(newItems);
      },

      increaseQty: (productId) => {
        const newItems = get().items.map((item) =>
          item._id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
        set({ items: newItems });
        get().saveCart(newItems);
      },

      decreaseQty: (productId) => {
        const items = get().items;
        const item = items.find((i) => i._id === productId);
        let newItems;

        if (item.quantity === 1) {
          newItems = items.filter((i) => i._id !== productId);
        } else {
          newItems = items.map((i) =>
            i._id === productId ? { ...i, quantity: i.quantity - 1 } : i,
          );
        }

        set({ items: newItems });
        get().saveCart(newItems);
      },

      // Save cart to DB silently
      saveCart: async (items) => {
        try {
          const sessionRes = await fetch("/api/auth/session");
          const sessionData = await sessionRes.json();
          if (!sessionData?.user?.email) return;

          // Clean items before saving — ensure all fields are plain values
          const cleanItems = items.map((item) => ({
            _id: item._id?.toString(),
            name: item.name,
            price: Number(item.price),
            image: item.image,
            category: item.category,
            type: item.type,
            isAvailable: item.isAvailable,
            isFeatured: item.isFeatured,
            description: item.description,
            quantity: Number(item.quantity),
          }));

          await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: cleanItems }),
          });
        } catch (err) {
          console.error("Cart save failed:", err);
        }
      },

      loadCart: async () => {
        try {
          const res = await fetch("/api/cart");
          const data = await res.json();
          console.log("Load result:", data);

          if (data.success && data.items?.length > 0) {
            // Normalize items — ensure _id is a string
            const normalizedItems = data.items.map((item) => ({
              ...item,
              _id: item._id?.toString() || item._id,
            }));
            set({ items: normalizedItems });
            console.log("Cart restored:", normalizedItems.length, "items");
          }
        } catch (err) {
          console.error("Cart load failed:", err);
        }
      },

      // Clear cart locally + from DB
      // Clear cart locally only (on logout)
      clearCartLocal: () => {
        set({ items: [] });
      },

      // Clear cart from DB + locally (after order placed)
      clearCart: async () => {
        set({ items: [] });
        try {
          await fetch("/api/cart", { method: "DELETE" });
        } catch (err) {
          console.error("Cart clear failed:", err);
        }
      },

      getTotalItems: () =>
        get().items.reduce((t, i) => {
          return t + (Number(i.quantity) || 0);
        }, 0),
      getTotalPrice: () =>
        get().items.reduce((t, i) => {
          const price = Number(i.price) || 0;
          const qty = Number(i.quantity) || 0;
          return t + price * qty;
        }, 0),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
    }),
    { name: "pet-protocols-cart" },
  ),
);

export default useCartStore;
