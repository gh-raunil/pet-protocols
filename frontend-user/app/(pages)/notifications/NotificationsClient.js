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
  ChevronRight,
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
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto font-jakarta">
      {/* Back button and page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition mb-3"
          >
            <ArrowLeft size={14} /> Back to Store
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
                Notification Inbox
                {unreadCount > 0 && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-500 text-white shadow-sm shadow-orange-500/30">
                    {unreadCount} unread
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Platform updates, order alerts, exclusive pet dining offers & announcements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-white transition text-xs font-semibold shadow-sm"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>
          )}

          <button
            onClick={() => fetchNotifications()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 transition shadow-sm"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-orange-400" : ""} />
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
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              activeFilter === tab.id
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white/5 text-gray-400 hover:text-white border border-white/5 hover:border-white/15"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Message Feed */}
      {loading && messages.length === 0 ? (
        /* Loading State */
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-orange-500">
          <RefreshCw className="animate-spin w-8 h-8" />
          <p className="text-xs text-gray-400">Loading your inbox messages...</p>
        </div>
      ) : error ? (
        /* Error State */
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3 my-8">
          <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
          <h3 className="text-sm font-bold text-rose-300">Unable to load notifications</h3>
          <p className="text-xs text-rose-300/80 max-w-sm mx-auto">{error}</p>
          <button
            onClick={() => fetchNotifications()}
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition shadow-sm"
          >
            Try Again
          </button>
        </div>
      ) : filteredMessages.length === 0 ? (
        /* Empty State */
        <div className="bg-[#101216] border border-white/10 rounded-2xl p-16 text-center text-gray-400 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mx-auto mb-4">
            <Inbox size={28} />
          </div>
          <h3 className="font-bold text-base text-white">
            {activeFilter === "unread" ? "No unread messages" : "No messages in this category"}
          </h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            {activeFilter === "unread"
              ? "All your notifications have been marked as read. Check back soon for new announcements."
              : "Whenever our kitchen chefs or platform admins send notifications, they'll appear here."}
          </p>
        </div>
      ) : (
        /* List of Cards */
        <div className="space-y-4">
          {filteredMessages.map((msg) => {
            const isRead = msg.isRead;
            const msgId = msg.id || msg._id;
            const isExpanded = expandedId === msgId;

            return (
              <div
                key={msgId}
                className={`bg-[#121316] border rounded-2xl p-5 sm:p-6 transition shadow-sm relative ${
                  isRead
                    ? "border-white/5 opacity-85 hover:opacity-100"
                    : "border-orange-500/40 bg-[#16181d] shadow-md shadow-orange-500/5"
                }`}
              >
                {!isRead && (
                  <div className="absolute left-0 top-4 bottom-4 w-1 bg-orange-500 rounded-r" />
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${getTagColor(
                        msg.messageType,
                        msg.priority
                      )}`}
                    >
                      {msg.messageType || "ANNOUNCEMENT"}
                    </span>

                    {msg.priority === "high" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                        <Flame size={10} /> High Priority
                      </span>
                    )}

                    {isRead ? (
                      <span className="text-[11px] text-emerald-400 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> Read
                      </span>
                    ) : (
                      <span className="text-[11px] text-orange-400 font-bold flex items-center gap-1">
                        ● Unread
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                    <Clock size={12} /> {msg.date}
                  </span>
                </div>

                <h3
                  onClick={() => handleToggleExpand(msg)}
                  className="text-base font-bold text-white mt-1 mb-2 cursor-pointer hover:text-orange-400 transition"
                >
                  {msg.title}
                </h3>

                <p
                  className={`text-xs sm:text-sm text-gray-300 leading-relaxed ${
                    isExpanded ? "whitespace-pre-line" : "line-clamp-2"
                  }`}
                >
                  {msg.content}
                </p>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleExpand(msg)}
                    className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition flex items-center gap-1"
                  >
                    <span>{isExpanded ? "Show less" : "Read full message"}</span>
                    <ChevronRight
                      size={13}
                      className={`transition-transform duration-200 ${
                        isExpanded ? "-rotate-90" : "rotate-90"
                      }`}
                    />
                  </button>

                  <div className="flex items-center gap-2">
                    {!isRead ? (
                      <button
                        onClick={() => markAsRead(msgId)}
                        className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={13} />
                        <span>Mark as read</span>
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500 font-medium">Acknowledged</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
