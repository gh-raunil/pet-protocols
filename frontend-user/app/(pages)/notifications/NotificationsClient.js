"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  Clock,
  RefreshCw,
  Inbox,
  AlertTriangle,
  Flame,
  ArrowLeft,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import useNotificationStore from "@/lib/notificationStore";

export default function NotificationsClient() {
  const {
    messages,
    unreadCount,
    loading,
    error,
    activeFilter,
    setActiveFilter,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  const [expandedId, setExpandedId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleToggleExpand = (msg) => {
    const msgId = msg.id || msg._id;
    if (expandedId === msgId) {
      setExpandedId(null);
    } else {
      setExpandedId(msgId);
      if (!msg.isRead) {
        markAsRead(msgId);
      }
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    await markAllAsRead();
    setMarkingAll(false);
  };

  const filteredMessages = messages.filter((msg) => {
    if (activeFilter === "unread") return !msg.isRead;
    if (activeFilter === "announcements") return msg.messageType === "announcement" || msg.messageType === "general";
    if (activeFilter === "promotions") return msg.messageType === "promotion";
    if (activeFilter === "important") return msg.priority === "high" || msg.messageType === "important" || msg.messageType === "warning";
    return true;
  });

  const getTagColor = (type, priority) => {
    if (priority === "high") {
      return "bg-rose-500/15 text-rose-500 border-rose-500/30";
    }
    switch (type) {
      case "promotion":
        return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
      case "warning":
      case "important":
        return "bg-amber-500/15 text-amber-500 border-amber-500/30";
      case "maintenance":
        return "bg-blue-500/15 text-blue-500 border-blue-500/30";
      default:
        return "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border-[var(--brand-accent)]/30";
    }
  };

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-[var(--text-main)] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-6 mb-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition mb-3"
          >
            <ArrowLeft size={14} /> Back to Store
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] flex items-center gap-3">
                Notification Inbox
                {unreadCount > 0 && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-accent)] text-white shadow-sm shadow-[var(--brand-accent)]/30">
                    {unreadCount} unread
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                Kitchen announcements, order alerts, and dining specials.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] hover:bg-[var(--brand-accent)] hover:text-white transition text-xs font-bold shadow-sm"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>
          )}

          <button
            onClick={() => fetchNotifications()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition shadow-sm"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--brand-accent)]" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 mb-6">
        {[
          { id: "all", label: "All Messages" },
          { id: "unread", label: `Unread (${unreadCount})` },
          { id: "announcements", label: "Announcements" },
          { id: "promotions", label: "Special Offers" },
          { id: "important", label: "Urgent & High Priority" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
              activeFilter === tab.id
                ? "bg-[var(--brand-accent)] text-white shadow-md shadow-[var(--brand-accent)]/20"
                : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Message Feed */}
      {loading && messages.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-[var(--brand-accent)]">
          <RefreshCw className="animate-spin w-8 h-8" />
          <p className="text-xs text-[var(--text-muted)]">Loading your inbox messages...</p>
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-red-500/10 border border-red-500/20 text-center space-y-3 my-8">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-sm font-bold text-red-500">Unable to load notifications</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">{error}</p>
          <button
            onClick={() => fetchNotifications()}
            className="px-4 py-2 rounded-xl bg-red-500 hover:opacity-95 text-white text-xs font-bold transition"
          >
            Try Again
          </button>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-16 text-center text-[var(--text-muted)] shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] mx-auto mb-4">
            <Inbox size={26} />
          </div>
          <h3 className="font-bold text-base text-[var(--text-main)]">
            {activeFilter === "unread" ? "No unread messages" : "No messages in this category"}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
            {activeFilter === "unread"
              ? "All your notifications have been marked as read."
              : "Whenever our kitchen chefs or platform admins send notifications, they'll appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((msg) => {
            const isRead = msg.isRead;
            const msgId = msg.id || msg._id;
            const isExpanded = expandedId === msgId;

            return (
              <div
                key={msgId}
                className={`bg-[var(--bg-card)] border rounded-3xl p-5 sm:p-6 transition shadow-sm relative ${
                  isRead
                    ? "border-[var(--border-color)] opacity-85 hover:opacity-100"
                    : "border-[var(--brand-accent)]/50 bg-[var(--bg-sub)] shadow-md shadow-[var(--brand-accent)]/5"
                }`}
              >
                {!isRead && (
                  <div className="absolute left-0 top-6 bottom-6 w-1.5 bg-[var(--brand-accent)] rounded-r-full" />
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${getTagColor(
                        msg.messageType,
                        msg.priority
                      )}`}
                    >
                      {msg.messageType || "ANNOUNCEMENT"}
                    </span>

                    {msg.priority === "high" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center gap-1">
                        <Flame size={11} /> High Priority
                      </span>
                    )}

                    {isRead ? (
                      <span className="text-[11px] text-emerald-500 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> Read
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--brand-accent)] font-bold flex items-center gap-1">
                        ● Unread
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-1">
                    <Clock size={12} /> {msg.date}
                  </span>
                </div>

                <h3
                  onClick={() => handleToggleExpand(msg)}
                  className="text-base font-bold text-[var(--text-main)] mt-1 mb-2 cursor-pointer hover:text-[var(--brand-accent)] transition flex items-center justify-between"
                >
                  <span>{msg.title}</span>
                  <ChevronDown
                    size={16}
                    className={`text-[var(--text-muted)] transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </h3>

                <p
                  className={`text-xs text-[var(--text-muted)] leading-relaxed transition-all ${
                    isExpanded ? "" : "line-clamp-2"
                  }`}
                >
                  {msg.content}
                </p>

                {msg.senderName && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
                    <span>Sent by: <strong className="text-[var(--text-main)]">{msg.senderName}</strong></span>
                    {!isRead && (
                      <button
                        onClick={() => markAsRead(msgId)}
                        className="text-xs font-bold text-[var(--brand-accent)] hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
