"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Inbox,
  AlertTriangle,
  ArrowLeft,
  Flame,
  ChevronRight,
  Trash2,
} from "lucide-react";
import useNotificationStore from "@/lib/notificationStore";

/**
 * Validates and extracts a safe internal order URL from a notification message.
 * Strictly prevents open-redirect vulnerabilities (no external protocols, no '//' or '/\').
 */
function getSafeOrderUrl(message) {
  if (!message) return null;
  const rawUrl = message.url;

  if (
    typeof rawUrl === "string" &&
    rawUrl.startsWith("/") &&
    !rawUrl.startsWith("//") &&
    !rawUrl.startsWith("/\\")
  ) {
    const isOrderRelated =
      message.isInAppOrderNotif ||
      message.messageType === "order" ||
      Boolean(message.orderId) ||
      rawUrl.startsWith("/order-confirmation") ||
      rawUrl.startsWith("/orders");

    if (isOrderRelated) {
      return rawUrl;
    }
  } else if (
    message.orderId &&
    typeof message.orderId === "string" &&
    /^[a-zA-Z0-9_-]+$/.test(message.orderId)
  ) {
    return `/order-confirmation?orderId=${encodeURIComponent(message.orderId)}`;
  }
  return null;
}

export default function NotificationDrawer() {
  const {
    isOpen,
    closeNotifications,
    messages,
    unreadCount,
    loading,
    error,
    selectedMessage,
    setSelectedMessage,
    activeFilter,
    setActiveFilter,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotificationStore();

  const [markingAll, setMarkingAll] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        closeNotifications();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeNotifications]);

  const handleOpenMessage = (msg) => {
    setSelectedMessage(msg);
    if (!msg.isRead) {
      markAsRead(msg.id || msg._id);
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    await markAllAsRead();
    setMarkingAll(false);
  };

  const handleConfirmClearAll = async () => {
    await clearAllNotifications();
    setConfirmingClear(false);
  };

  const handleDeleteOne = async (e, msgId) => {
    e.stopPropagation();
    setDeletingId(msgId);
    await deleteNotification(msgId);
    setDeletingId(null);
  };

  const handleDeleteSelected = async () => {
    if (!selectedMessage) return;
    const msgId = selectedMessage.id || selectedMessage._id;
    await deleteNotification(msgId);
    setSelectedMessage(null);
  };

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    if (activeFilter === "unread") {
      return !msg.isRead;
    }
    if (activeFilter === "announcements") {
      return msg.messageType === "announcement" || msg.messageType === "general";
    }
    if (activeFilter === "promotions") {
      return msg.messageType === "promotion";
    }
    if (activeFilter === "important") {
      return msg.priority === "high" || msg.messageType === "important" || msg.messageType === "warning";
    }
    return true; // 'all'
  });

  const getTagColor = (type, priority) => {
    if (priority === "high") {
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    }
    switch (type) {
      case "promotion":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
      case "warning":
      case "important":
        return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
      case "order":
        return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
      case "maintenance":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
      default:
        return "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border-[var(--brand-accent)]/30";
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeNotifications}
        className={`fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm z-[80] transition-opacity duration-300 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      />

      {/* Drawer Panel — Big screen / computer optimized (480px width) */}
      <div
        className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[460px] md:w-[480px] bg-[var(--bg-main)] text-[var(--text-main)] border-l border-[var(--border-color)] z-[90] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out font-jakarta select-none ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header — Clean Light / Dark Theme Adaptive */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {selectedMessage ? (
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
                aria-label="Back to messages"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-[var(--brand-accent)]/12 border border-[var(--brand-accent)]/25 text-[var(--brand-accent)] flex items-center justify-center shrink-0 shadow-2xs">
                <Bell size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-[var(--text-main)] flex items-center gap-2 truncate">
                <span>{selectedMessage ? "Notification Details" : "Notifications & Updates"}</span>
                {!selectedMessage && unreadCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-accent)] text-white shadow-2xs shrink-0">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {selectedMessage
                  ? "Read platform message"
                  : "Platform alerts, promotions & kitchen updates"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!selectedMessage && (
              <button
                onClick={() => fetchNotifications()}
                disabled={loading}
                title="Refresh notifications"
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={16} className={loading ? "animate-spin text-[var(--brand-accent)]" : ""} />
              </button>
            )}
            <button
              onClick={closeNotifications}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
              aria-label="Close notification drawer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {selectedMessage ? (
          /* Single Message Detail View */
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider border ${getTagColor(
                    selectedMessage.messageType,
                    selectedMessage.priority
                  )}`}
                >
                  {selectedMessage.messageType || "ANNOUNCEMENT"}
                </span>
                {selectedMessage.priority === "high" && (
                  <span className="text-[10px] font-extrabold px-2 py-1 rounded-md uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <Flame size={11} /> High Priority
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Clock size={12} /> {selectedMessage.date}
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-lg sm:text-xl font-black text-[var(--text-main)] leading-snug">
                {selectedMessage.title}
              </h1>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] text-sm leading-relaxed whitespace-pre-line shadow-2xs">
              {selectedMessage.content}
            </div>

            {/* Clear "View Order" action if valid safe internal order URL exists */}
            {(() => {
              const safeOrderUrl = getSafeOrderUrl(selectedMessage);
              if (!safeOrderUrl) return null;
              return (
                <div className="pt-1">
                  <Link
                    href={safeOrderUrl}
                    onClick={closeNotifications}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--brand-accent)] hover:brightness-105 active:scale-[0.99] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-[var(--brand-accent)]/20"
                  >
                    <span>View Order</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              );
            })()}

            <div className="pt-4 border-t border-[var(--border-color)] flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>

              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                Back to Inbox
              </button>
            </div>
          </div>
        ) : (
          /* Message List & Filter View */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Tabs & Quick Actions */}
            <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-sub)]/60 backdrop-blur-xs flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {[
                    { id: "all", label: "All" },
                    { id: "unread", label: `Unread (${unreadCount})` },
                    { id: "announcements", label: "Updates" },
                    { id: "promotions", label: "Offers" },
                    { id: "important", label: "Urgent" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                        activeFilter === tab.id
                          ? "bg-[var(--brand-accent)] text-white shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-actions Row: Mark All Read & Clear All */}
              {messages.length > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]/60 text-xs">
                  {unreadCount > 0 ? (
                    <button
                      onClick={handleMarkAll}
                      disabled={markingAll}
                      className="text-[11px] font-semibold text-[var(--brand-accent)] hover:underline transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck size={13} />
                      <span>Mark all as read</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span>All caught up</span>
                    </span>
                  )}

                  {/* Clear All Notifications */}
                  {confirmingClear ? (
                    <div className="inline-flex items-center gap-1.5 animate-in fade-in duration-200">
                      <span className="text-[11px] text-rose-500 font-bold">Clear all?</span>
                      <button
                        onClick={handleConfirmClearAll}
                        className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-bold hover:bg-rose-600 transition cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmingClear(false)}
                        className="px-2 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] text-[10px] font-medium hover:text-[var(--text-main)] transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingClear(true)}
                      className="text-[11px] font-semibold text-rose-500/80 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 px-2 py-0.5 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                      title="Clear all notifications"
                    >
                      <Trash2 size={12} />
                      <span>Clear all</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Notification Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && messages.length === 0 ? (
                /* Loading State */
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                  <RefreshCw className="animate-spin text-[var(--brand-accent)] w-7 h-7" />
                  <p className="text-xs text-[var(--text-muted)]">Loading your notifications...</p>
                </div>
              ) : error ? (
                /* Error State */
                <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3 my-6">
                  <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>
                  <button
                    onClick={() => fetchNotifications()}
                    className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredMessages.length === 0 ? (
                /* Empty State */
                <div className="py-24 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] mb-3 shadow-2xs">
                    <Inbox size={24} />
                  </div>
                  <h3 className="text-sm font-black text-[var(--text-main)] mb-1">
                    {activeFilter === "unread" ? "You're all caught up!" : "No notifications yet"}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                    {activeFilter === "unread"
                      ? "There are no unread messages waiting for your attention."
                      : "Broadcast messages, kitchen alerts, and exclusive dining promotions will appear here."}
                  </p>
                </div>
              ) : (
                /* Message Cards — Theme-Adaptive, High-Contrast Light & Dark */
                filteredMessages.map((msg) => {
                  const isRead = msg.isRead;
                  const msgId = msg.id || msg._id;
                  const isDeleting = deletingId === msgId;

                  return (
                    <div
                      key={msgId}
                      onClick={() => handleOpenMessage(msg)}
                      className={`group relative p-4 rounded-2xl border transition-all cursor-pointer ${
                        isDeleting ? "opacity-30 scale-95" : ""
                      } ${
                        isRead
                          ? "bg-[var(--bg-card)]/80 hover:bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[var(--border-color)]/90 shadow-2xs opacity-90 hover:opacity-100"
                          : "bg-[var(--bg-card)] border-[var(--brand-accent)]/35 hover:border-[var(--brand-accent)]/70 shadow-xs hover:shadow-md"
                      }`}
                    >
                      {/* Unread indicator vertical pill */}
                      {!isRead && (
                        <div className="absolute left-0 top-3.5 bottom-3.5 w-1.5 bg-[var(--brand-accent)] rounded-r-full shadow-2xs" />
                      )}

                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider border ${getTagColor(
                              msg.messageType,
                              msg.priority
                            )}`}
                          >
                            {msg.messageType || "ANNOUNCEMENT"}
                          </span>
                          {msg.priority === "high" && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-0.5">
                              <Flame size={10} /> High Priority
                            </span>
                          )}
                          {!isRead && (
                            <span className="text-[10px] font-extrabold text-[var(--brand-accent)] flex items-center gap-1">
                              ● New
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 shrink-0 font-medium">
                          <Clock size={11} />
                          {msg.date}
                        </span>
                      </div>

                      <h3
                        className={`text-sm font-bold mb-1.5 leading-snug line-clamp-1 transition ${
                          isRead
                            ? "text-[var(--text-main)]/85"
                            : "text-[var(--text-main)] group-hover:text-[var(--brand-accent)]"
                        }`}
                      >
                        {msg.title}
                      </h3>

                      <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                        {msg.content}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-[var(--border-color)]/60 flex items-center justify-between text-[11px] gap-2">
                        <span className="text-[var(--brand-accent)] font-bold group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                          Read details <ChevronRight size={12} />
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isRead && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(msgId);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[var(--bg-sub)] hover:bg-[var(--brand-accent)]/10 text-[var(--text-muted)] hover:text-[var(--brand-accent)] border border-[var(--border-color)] transition text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 size={12} />
                              <span>Mark read</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleDeleteOne(e, msgId)}
                            title="Delete notification"
                            aria-label={`Delete notification ${msg.title}`}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
