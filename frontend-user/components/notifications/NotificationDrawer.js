"use client";

import { useEffect, useState } from "react";
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
  Tag,
  Flame,
  Info,
  ChevronRight,
} from "lucide-react";
import useNotificationStore from "@/lib/notificationStore";

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
  } = useNotificationStore();

  const [markingAll, setMarkingAll] = useState(false);

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
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    }
    switch (type) {
      case "promotion":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "warning":
      case "important":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "maintenance":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      default:
        return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeNotifications}
        className={`fixed inset-0 bg-black/65 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed top-0 right-0 h-screen w-full sm:w-[440px] bg-[#0c0d0e] border-l border-white/10 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out font-jakarta ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-[#121316] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {selectedMessage ? (
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
                aria-label="Back to messages"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
                <Bell size={16} />
              </div>
            )}
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                {selectedMessage ? "Notification Details" : "Notifications & Updates"}
                {!selectedMessage && unreadCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white shadow-sm">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-gray-400">
                {selectedMessage
                  ? "Read platform message"
                  : "Platform alerts, promotions & kitchen updates"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!selectedMessage && (
              <button
                onClick={() => fetchNotifications()}
                disabled={loading}
                title="Refresh notifications"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? "animate-spin text-orange-400" : ""} />
              </button>
            )}
            <button
              onClick={closeNotifications}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
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
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border ${getTagColor(
                    selectedMessage.messageType,
                    selectedMessage.priority
                  )}`}
                >
                  {selectedMessage.messageType || "ANNOUNCEMENT"}
                </span>
                {selectedMessage.priority === "high" && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <Flame size={11} /> High Priority
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={12} /> {selectedMessage.date}
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-lg font-bold text-white leading-snug">
                {selectedMessage.title}
              </h1>
            </div>

            <div className="p-4 rounded-xl bg-[#14161a] border border-white/5 text-gray-200 text-sm leading-relaxed whitespace-pre-line">
              {selectedMessage.content}
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Read on this device
              </span>
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition"
              >
                Back to Inbox
              </button>
            </div>
          </div>
        ) : (
          /* Message List & Filter View */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter Tabs & Quick Action */}
            <div className="px-4 py-3 border-b border-white/10 bg-[#0e1013] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
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
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                      activeFilter === tab.id
                        ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  disabled={markingAll}
                  className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition whitespace-nowrap flex items-center gap-1 pl-2 border-l border-white/10 shrink-0"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Notification Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && messages.length === 0 ? (
                /* Loading State */
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <RefreshCw className="animate-spin text-orange-500 w-7 h-7" />
                  <p className="text-xs text-gray-400">Loading your notifications...</p>
                </div>
              ) : error ? (
                /* Error State */
                <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3 my-6">
                  <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                  <p className="text-xs font-semibold text-rose-300">{error}</p>
                  <button
                    onClick={() => fetchNotifications()}
                    className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition"
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredMessages.length === 0 ? (
                /* Empty State */
                <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-3">
                    <Inbox size={26} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    {activeFilter === "unread" ? "You're all caught up!" : "No notifications yet"}
                  </h3>
                  <p className="text-xs text-gray-400 max-w-xs">
                    {activeFilter === "unread"
                      ? "There are no unread messages waiting for your attention."
                      : "Broadcast messages, kitchen alerts, and exclusive pet promotions will appear here."}
                  </p>
                </div>
              ) : (
                /* Message Cards */
                filteredMessages.map((msg) => {
                  const isRead = msg.isRead;
                  const msgId = msg.id || msg._id;

                  return (
                    <div
                      key={msgId}
                      onClick={() => handleOpenMessage(msg)}
                      className={`group relative p-4 rounded-xl border transition cursor-pointer ${
                        isRead
                          ? "bg-[#121316] border-white/5 hover:border-white/15 opacity-80 hover:opacity-100"
                          : "bg-[#16181d] border-orange-500/30 hover:border-orange-500/60 shadow-sm"
                      }`}
                    >
                      {/* Unread indicator bar */}
                      {!isRead && (
                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-orange-500 rounded-r" />
                      )}

                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${getTagColor(
                              msg.messageType,
                              msg.priority
                            )}`}
                          >
                            {msg.messageType || "ANNOUNCEMENT"}
                          </span>
                          {msg.priority === "high" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              High Priority
                            </span>
                          )}
                          {!isRead && (
                            <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1">
                              ● New
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Clock size={11} />
                          {msg.date}
                        </span>
                      </div>

                      <h3
                        className={`text-sm font-bold mb-1.5 leading-snug line-clamp-1 transition ${
                          isRead ? "text-gray-300" : "text-white group-hover:text-orange-400"
                        }`}
                      >
                        {msg.title}
                      </h3>

                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                        {msg.content}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                        <span className="text-orange-400 font-semibold group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                          Read details <ChevronRight size={12} />
                        </span>

                        {!isRead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(msgId);
                            }}
                            className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-orange-500/20 text-gray-300 hover:text-orange-300 transition text-[11px] flex items-center gap-1"
                          >
                            <CheckCircle2 size={12} />
                            Mark read
                          </button>
                        )}
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
