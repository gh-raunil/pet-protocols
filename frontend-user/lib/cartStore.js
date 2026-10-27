import { create } from "zustand";

export const MAX_ITEM_QUANTITY = 20;
const GUEST_CART_KEY = "pet_protocols_cart_guest";

function getUserCartKey(userEmail) {
  if (!userEmail) return GUEST_CART_KEY;
  const clean = String(userEmail).toLowerCase().trim();
  return `pet_protocols_cart_${clean}`;
}

// Synchronization controller variables (store-compatible, non-React)
let syncTimer = null;
let isSyncing = false;
let syncPending = false;

export function getCartItemKey(item) {
  if (!item) return "";
  if (item.cartItemId) return String(item.cartItemId);
  const baseId = (item._id || item.product)?.toString() || "";
  if (item.variantName && typeof item.variantName === "string" && item.variantName.trim()) {
    return `${baseId}__${item.variantName.trim()}`;
  }
  return baseId;
}

function cleanCartItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const key = getCartItemKey(item);
    return {
      _id: (item._id || item.product)?.toString(),
      cartItemId: key,
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
      variantName: item.variantName ? String(item.variantName).trim() : null,
      portionQuantity: item.portionQuantity !== undefined && item.portionQuantity !== null ? Number(item.portionQuantity) : null,
      portionUnit: item.portionUnit ? String(item.portionUnit).trim() : null,
      servingLabel: item.servingLabel ? String(item.servingLabel).trim() : null,
      size: item.size ? String(item.size).trim() : null,
    };
  });
}

function mergeItems(baseItems = [], guestItems = []) {
  const map = new Map();
  for (const item of baseItems) {
    if (!item || !item._id) continue;
    const key = getCartItemKey(item);
    map.set(key, { ...item, cartItemId: key, quantity: Number(item.quantity) || 1 });
  }
  for (const guest of guestItems) {
    if (!guest || !guest._id) continue;
    const key = getCartItemKey(guest);
    if (map.has(key)) {
      const existing = map.get(key);
      const combined = Math.min(
        MAX_ITEM_QUANTITY,
        (Number(existing.quantity) || 1) + (Number(guest.quantity) || 1)
      );
      map.set(key, { ...existing, quantity: combined });
    } else {
      map.set(key, {
        ...guest,
        cartItemId: key,
        quantity: Math.min(MAX_ITEM_QUANTITY, Number(guest.quantity) || 1),
      });
    }
  }
  return cleanCartItems(Array.from(map.values()));
}

function getInitialGuestItems() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return cleanCartItems(parsed);
    }
  } catch (e) {}
  return [];
}

function persistCartForCurrentContext(items, currentUserId) {
  if (typeof window === "undefined") return;
  try {
    const key = getUserCartKey(currentUserId);
    localStorage.setItem(key, JSON.stringify(cleanCartItems(items)));
  } catch (e) {
    console.warn("Could not cache cart locally:", e);
  }
}

function scheduleSaveCart(get, set) {
  const currentUserId = get().currentUserId;
  // If user is guest, NEVER sync to backend server
  if (!currentUserId) {
    persistCartForCurrentContext(get().items, null);
    return;
  }

  // User is authenticated, cache locally and sync with MongoDB
  persistCartForCurrentContext(get().items, currentUserId);

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
    set({ isSyncing: true });

    try {
      const activeUser = get().currentUserId;
      if (!activeUser) return;

      const cleanItems = cleanCartItems(get().items);

      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cleanItems }),
      });

      if (res.status === 401) {
        set({ currentUserId: null });
      }
    } catch (err) {
      console.error("Cart save failed:", err);
    } finally {
      isSyncing = false;
      set({ isSyncing: false });
      if (syncPending) {
        syncPending = false;
        scheduleSaveCart(get, set);
      }
    }
  }, 350);
}

const useCartStore = create((set, get) => ({
  items: getInitialGuestItems(),
  currentUserId: null, // null = guest, string = authenticated user email
  isOpen: false,
  isSyncing: false,

  // Quantity-aware add: supports adding N items in a single store update up to MAX_ITEM_QUANTITY
  addItem: (product, qty = 1) => {
    if (!product || !product._id) return;
    const addQty = Math.max(1, Math.floor(Number(qty) || 1));
    const targetKey = getCartItemKey(product);
    const items = get().items;
    const existing = items.find((item) => getCartItemKey(item) === targetKey);
    let newItems;

    if (existing) {
      const newQty = Math.min(MAX_ITEM_QUANTITY, (Number(existing.quantity) || 0) + addQty);
      newItems = items.map((item) =>
        getCartItemKey(item) === targetKey ? { ...item, quantity: newQty } : item
      );
    } else {
      const initialQty = Math.min(MAX_ITEM_QUANTITY, addQty);
      newItems = [...items, { ...product, cartItemId: targetKey, quantity: initialQty }];
    }

    const cleaned = cleanCartItems(newItems);
    set({ items: cleaned });
    scheduleSaveCart(get, set);
  },

  // Batch operation: add multiple distinct items in a single store action
  addBatch: (entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const currentItems = [...get().items];

    for (const entry of entries) {
      if (!entry || !entry._id) continue;
      const addQty = Math.max(1, Math.floor(Number(entry.quantity) || 1));
      const targetKey = getCartItemKey(entry);
      const existingIndex = currentItems.findIndex((item) => getCartItemKey(item) === targetKey);

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
          cartItemId: targetKey,
          quantity: Math.min(MAX_ITEM_QUANTITY, addQty),
        });
      }
    }

    const cleaned = cleanCartItems(currentItems);
    set({ items: cleaned });
    scheduleSaveCart(get, set);
  },

  removeItem: (keyOrId) => {
    const newItems = get().items.filter(
      (item) => getCartItemKey(item) !== keyOrId && item._id !== keyOrId && item.cartItemId !== keyOrId
    );
    set({ items: newItems });
    scheduleSaveCart(get, set);
  },

  increaseQty: (keyOrId) => {
    const items = get().items;
    const existing = items.find(
      (item) => getCartItemKey(item) === keyOrId || item.cartItemId === keyOrId || item._id === keyOrId
    );
    if (!existing || (Number(existing.quantity) || 0) >= MAX_ITEM_QUANTITY) return;

    const targetKey = getCartItemKey(existing);
    const newItems = items.map((item) =>
      getCartItemKey(item) === targetKey
        ? { ...item, quantity: Math.min(MAX_ITEM_QUANTITY, (Number(item.quantity) || 0) + 1) }
        : item
    );
    set({ items: newItems });
    scheduleSaveCart(get, set);
  },

  decreaseQty: (keyOrId) => {
    const items = get().items;
    const item = items.find(
      (i) => getCartItemKey(i) === keyOrId || i.cartItemId === keyOrId || i._id === keyOrId
    );
    if (!item) return;
    const targetKey = getCartItemKey(item);
    let newItems;

    if (item.quantity <= 1) {
      newItems = items.filter((i) => getCartItemKey(i) !== targetKey);
    } else {
      newItems = items.map((i) =>
        getCartItemKey(i) === targetKey ? { ...i, quantity: item.quantity - 1 } : i
      );
    }

    set({ items: newItems });
    scheduleSaveCart(get, set);
  },

  // Save cart to DB safely via scheduler
  saveCart: async () => {
    scheduleSaveCart(get, set);
  },

  // Load cart for either guest or authenticated user
  // If guest items exist when a user logs in, merge them into the user's DB cart and clear guest storage
  loadCart: async (userEmail = null) => {
    const cleanEmail = userEmail ? String(userEmail).toLowerCase().trim() : null;

    // 1. GUEST MODE
    if (!cleanEmail) {
      let guestItems = [];
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(GUEST_CART_KEY);
          if (raw) guestItems = JSON.parse(raw);
        } catch (e) {
          guestItems = [];
        }
      }
      set({
        currentUserId: null,
        items: cleanCartItems(guestItems),
      });
      return;
    }

    // 2. AUTHENTICATED USER MODE
    set({ currentUserId: cleanEmail });

    // Check if there are local guest items to migrate
    let guestItemsToMigrate = [];
    if (typeof window !== "undefined") {
      try {
        const rawGuest = localStorage.getItem(GUEST_CART_KEY);
        if (rawGuest) {
          const parsed = JSON.parse(rawGuest);
          if (Array.isArray(parsed) && parsed.length > 0) {
            guestItemsToMigrate = cleanCartItems(parsed);
          }
        }
      } catch (e) {}
    }

    // Fetch user's cart from MongoDB
    try {
      const res = await fetch("/api/cart", {
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json();

      let dbItems = [];
      if (data.success && Array.isArray(data.items)) {
        dbItems = cleanCartItems(data.items);
      }

      if (guestItemsToMigrate.length > 0) {
        // Merge guest items with user's DB cart
        const merged = mergeItems(dbItems, guestItemsToMigrate);
        set({ items: merged });
        persistCartForCurrentContext(merged, cleanEmail);

        // Save merged items to backend DB
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: merged }),
        });

        // Clear guest storage now that data is transferred to user's account
        if (typeof window !== "undefined") {
          localStorage.removeItem(GUEST_CART_KEY);
        }
      } else {
        set({ items: dbItems });
        persistCartForCurrentContext(dbItems, cleanEmail);
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
    set({ items: [], currentUserId: null });
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(GUEST_CART_KEY);
      } catch (e) {}
    }
  },

  // Clear cart from DB + locally (after order placed)
  clearCart: async () => {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    syncPending = false;
    const activeUser = get().currentUserId;
    set({ items: [] });

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(GUEST_CART_KEY);
        if (activeUser) {
          localStorage.removeItem(getUserCartKey(activeUser));
        }
      } catch (e) {}
    }

    if (activeUser) {
      try {
        await fetch("/api/cart", { method: "DELETE" });
      } catch (err) {
        console.error("Cart clear failed:", err);
      }
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
}));

if (typeof window !== "undefined") {
  window.useCartStore = useCartStore;
}

export default useCartStore;
