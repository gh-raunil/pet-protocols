import { create } from "zustand";

const STORAGE_KEY_DELETED = "pet_protocols_deleted_notifications";

function getDeletedIdsSet() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function persistDeletedIds(idsSet) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(Array.from(idsSet)));
  } catch (e) {}
}

const useNotificationStore = create((set, get) => ({
  isOpen: false,
  messages: [],
  unreadCount: 0,
  loading: false,
  error: null,
  selectedMessage: null,
  activeFilter: "all",

  openNotifications: () => set({ isOpen: true }),
  closeNotifications: () => set({ isOpen: false, selectedMessage: null }),
  toggleNotifications: () => set((state) => ({ isOpen: !state.isOpen, selectedMessage: null })),

  setSelectedMessage: (msg) => set({ selectedMessage: msg }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  fetchNotifications: async (options = {}) => {
    const { force = false } = options || {};
    if (!force && typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    if (get().loading) return;

    try {
      set({ loading: true, error: null });
      const res = await fetch("/api/messages", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        set({ error: `Failed to load messages (Status ${res.status})`, loading: false });
        return;
      }

      const data = await res.json();
      if (data.success) {
        const deletedSet = getDeletedIdsSet();
        const rawMsgs = data.messages || [];
        const msgs = rawMsgs.filter((m) => !deletedSet.has((m.id || m._id)?.toString()));
        const count = typeof data.unreadCount === "number"
          ? msgs.filter((m) => !m.isRead).length
          : msgs.filter((m) => !m.isRead).length;

        set({
          messages: msgs,
          unreadCount: count,
          loading: false,
          error: null,
        });
      } else {
        set({ error: data.message || "Failed to load notifications", loading: false });
      }
    } catch (err) {
      console.warn("[NotificationStore] Warning loading notifications:", err?.message || err);
      set({ error: err?.message || "Error loading notifications", loading: false });
    }
  },

  markAsRead: async (msgId) => {
    if (!msgId) return;

    // Optimistic UI update
    const prevMessages = get().messages;
    const targetMsg = prevMessages.find((m) => (m.id || m._id) === msgId);
    if (!targetMsg || targetMsg.isRead) return;

    const updatedMessages = prevMessages.map((m) =>
      (m.id || m._id) === msgId ? { ...m, isRead: true } : m
    );
    const newUnreadCount = Math.max(0, get().unreadCount - 1);

    set({
      messages: updatedMessages,
      unreadCount: newUnreadCount,
      selectedMessage: get().selectedMessage && (get().selectedMessage.id || get().selectedMessage._id) === msgId
        ? { ...get().selectedMessage, isRead: true }
        : get().selectedMessage,
    });

    try {
      await fetch(`/api/messages/${msgId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to mark message as read:", err);
    }
  },

  markAllAsRead: async () => {
    const prevMessages = get().messages;
    const updatedMessages = prevMessages.map((m) => ({ ...m, isRead: true }));

    set({
      messages: updatedMessages,
      unreadCount: 0,
      selectedMessage: get().selectedMessage
        ? { ...get().selectedMessage, isRead: true }
        : null,
    });

    try {
      await fetch("/api/messages/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to mark all messages as read:", err);
    }
  },

  deleteNotification: async (msgId) => {
    if (!msgId) return;

    const prevMessages = get().messages;
    const targetMsg = prevMessages.find((m) => (m.id || m._id)?.toString() === msgId.toString());
    const updatedMessages = prevMessages.filter((m) => (m.id || m._id)?.toString() !== msgId.toString());
    const wasUnread = targetMsg && !targetMsg.isRead;
    const newUnreadCount = wasUnread ? Math.max(0, get().unreadCount - 1) : get().unreadCount;

    // Persist deleted ID in client storage
    const deletedSet = getDeletedIdsSet();
    deletedSet.add(msgId.toString());
    persistDeletedIds(deletedSet);

    set({
      messages: updatedMessages,
      unreadCount: newUnreadCount,
      selectedMessage:
        get().selectedMessage && (get().selectedMessage.id || get().selectedMessage._id)?.toString() === msgId.toString()
          ? null
          : get().selectedMessage,
    });

    try {
      await fetch(`/api/messages/${msgId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to delete notification on server:", err);
    }
  },

  clearAllNotifications: async () => {
    const prevMessages = get().messages;
    const deletedSet = getDeletedIdsSet();
    prevMessages.forEach((m) => {
      const id = (m.id || m._id)?.toString();
      if (id) deletedSet.add(id);
    });
    persistDeletedIds(deletedSet);

    set({
      messages: [],
      unreadCount: 0,
      selectedMessage: null,
    });

    try {
      await fetch("/api/messages/clear-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to clear all notifications on server:", err);
    }
  },
}));

if (typeof window !== "undefined") {
  window.__notificationStore = useNotificationStore;
}

export default useNotificationStore;
