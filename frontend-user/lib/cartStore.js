import { create } from "zustand";
import { persist } from "zustand/middleware";

// Synchronization controller variables (store-compatible, non-React)
let syncTimer = null;
let isSyncing = false;
let syncPending = false;
let sessionCache = { isAuthenticated: null, expiresAt: 0 };

async function checkSession() {
  const now = Date.now();
  if (sessionCache.isAuthenticated !== null && now < sessionCache.expiresAt) {
    return sessionCache.isAuthenticated;
  }

  try {
    const sessionRes = await fetch("/api/auth/session");
    if (!sessionRes.ok) {
      sessionCache = { isAuthenticated: false, expiresAt: now + 15000 };
      return false;
    }
    const sessionData = await sessionRes.json();
    const isAuth = Boolean(sessionData?.user?.email);
    sessionCache = {
      isAuthenticated: isAuth,
      expiresAt: now + (isAuth ? 60000 : 15000),
    };
    return isAuth;
  } catch {
    return false;
  }
}

export const MAX_ITEM_QUANTITY = 20;

function cleanCartItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    _id: item._id?.toString(),
    name: item.name,
    price: Number(item.price),
    image: item.image,
    category: item.category,
    type: item.type,
    isAvailable: item.isAvailable,
    isFeatured: item.isFeatured,
    description: item.description,
    quantity: Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.floor(Number(item.quantity) || 1))),
    restaurant: item.restaurant?._id?.toString() || item.restaurant?.toString() || item.restaurantId,
    restaurantId: item.restaurantId || item.restaurant?._id?.toString() || item.restaurant?.toString(),
  }));
}

function scheduleSaveCart(get) {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(async () => {
    syncTimer = null;

    if (isSyncing) {
      syncPending = true;
      return;
    }

    isSyncing = true;
    syncPending = false;

    try {
      const isAuth = await checkSession();
      if (!isAuth) {
        return;
      }

      // Always snapshot current items right before saving
      const cleanItems = cleanCartItems(get().items);

      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cleanItems }),
      });

      if (res.status === 401) {
        sessionCache = { isAuthenticated: false, expiresAt: Date.now() + 30000 };
      }
    } catch (err) {
      console.error("Cart save failed:", err);
      // Local cart is safely preserved in Zustand / localStorage
    } finally {
      isSyncing = false;
      if (syncPending) {
        syncPending = false;
        scheduleSaveCart(get);
      }
    }
  }, 350);
}

const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      // Quantity-aware add: supports adding N items in a single store update up to MAX_ITEM_QUANTITY
      addItem: (product, qty = 1) => {
        if (!product || !product._id) return;
        const addQty = Math.max(1, Math.floor(Number(qty) || 1));
        const items = get().items;
        const existing = items.find((item) => item._id === product._id);
        let newItems;

        if (existing) {
          const newQty = Math.min(MAX_ITEM_QUANTITY, (Number(existing.quantity) || 0) + addQty);
          newItems = items.map((item) =>
            item._id === product._id
              ? { ...item, quantity: newQty }
              : item,
          );
        } else {
          const initialQty = Math.min(MAX_ITEM_QUANTITY, addQty);
          newItems = [...items, { ...product, quantity: initialQty }];
        }

        set({ items: newItems });
        scheduleSaveCart(get);
      },

      // Batch operation: add multiple distinct items in a single store action
      addBatch: (entries) => {
        if (!Array.isArray(entries) || entries.length === 0) return;
        const currentItems = [...get().items];

        for (const entry of entries) {
          if (!entry || !entry._id) continue;
          const addQty = Math.max(1, Math.floor(Number(entry.quantity) || 1));
          const existingIndex = currentItems.findIndex((item) => item._id === entry._id);

          if (existingIndex > -1) {
            const newQty = Math.min(
              MAX_ITEM_QUANTITY,
              (Number(currentItems[existingIndex].quantity) || 0) + addQty
            );
            currentItems[existingIndex] = {
              ...currentItems[existingIndex],
              quantity: newQty,
            };
          } else {
            currentItems.push({
              ...entry,
              quantity: Math.min(MAX_ITEM_QUANTITY, addQty),
            });
          }
        }

        set({ items: currentItems });
        scheduleSaveCart(get);
      },

      removeItem: (productId) => {
        const newItems = get().items.filter((item) => item._id !== productId);
        set({ items: newItems });
        scheduleSaveCart(get);
      },

      increaseQty: (productId) => {
        const items = get().items;
        const existing = items.find((item) => item._id === productId);
        if (!existing || (Number(existing.quantity) || 0) >= MAX_ITEM_QUANTITY) return;

        const newItems = items.map((item) =>
          item._id === productId
            ? { ...item, quantity: Math.min(MAX_ITEM_QUANTITY, (Number(item.quantity) || 0) + 1) }
            : item,
        );
        set({ items: newItems });
        scheduleSaveCart(get);
      },

      decreaseQty: (productId) => {
        const items = get().items;
        const item = items.find((i) => i._id === productId);
        if (!item) return;
        let newItems;

        if (item.quantity <= 1) {
          newItems = items.filter((i) => i._id !== productId);
        } else {
          newItems = items.map((i) =>
            i._id === productId ? { ...i, quantity: item.quantity - 1 } : i,
          );
        }

        set({ items: newItems });
        scheduleSaveCart(get);
      },

      // Save cart to DB safely via scheduler
      saveCart: async () => {
        scheduleSaveCart(get);
      },

      loadCart: async () => {
        try {
          const res = await fetch("/api/cart");
          const data = await res.json();

          if (data.success) {
            sessionCache = { isAuthenticated: true, expiresAt: Date.now() + 60000 };
            if (data.items?.length > 0) {
              // Normalize items — ensure _id is a string and quantity is clamped
              const normalizedItems = data.items.map((item) => ({
                ...item,
                _id: item._id?.toString() || item._id,
                quantity: Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.floor(Number(item.quantity) || 1))),
              }));
              set({ items: normalizedItems });
            }
          }
        } catch (err) {
          console.error("Cart load failed:", err);
        }
      },

      // Clear cart locally only (on logout)
      clearCartLocal: () => {
        if (syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        syncPending = false;
        sessionCache = { isAuthenticated: false, expiresAt: 0 };
        set({ items: [] });
      },

      // Clear cart from DB + locally (after order placed)
      clearCart: async () => {
        if (syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        syncPending = false;
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
    {
      name: "pet-protocols-cart",
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...persistedState,
        items: cleanCartItems(persistedState?.items || []),
      }),
    },
  ),
);

export default useCartStore;
