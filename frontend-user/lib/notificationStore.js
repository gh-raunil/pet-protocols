import { create } from "zustand";

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

  fetchNotifications: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetch("/api/messages", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load messages (Status ${res.status})`);
      }

      const data = await res.json();
      if (data.success) {
        const msgs = data.messages || [];
        const count = typeof data.unreadCount === "number"
          ? data.unreadCount
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
      console.error("Error fetching notifications:", err);
      set({ error: err.message || "Error loading notifications", loading: false });
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
}));

export default useNotificationStore;
