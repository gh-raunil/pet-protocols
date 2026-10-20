"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  Inbox,
  AlertCircle,
  Megaphone,
} from "lucide-react";

export default function UpdatesClient() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [readNotices, setReadNotices] = useState([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/updates");
    }
  }, [status, router]);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("dismissed_partner_notices") || "[]"
      );
      setReadNotices(stored);
    } catch (e) {
      setReadNotices([]);
    }
  }, []);

  async function fetchMessages() {
    try {
      setLoading(true);
      const res = await fetch("/api/messages?target=restaurants");
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchMessages();
    }
  }, [session]);

  async function markAsRead(msgId) {
    if (readNotices.includes(msgId)) return;
    const updated = [...readNotices, msgId];
    setReadNotices(updated);
    localStorage.setItem("dismissed_partner_notices", JSON.stringify(updated));

    try {
      await fetch(`/api/messages/${msgId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: session?.user?.restaurantId || "partner" }),
      });
    } catch (err) {
      console.error(err);
    }
  }

  const categories = [
    { id: "all", label: "All Messages" },
    { id: "announcement", label: "Announcements" },
    { id: "important", label: "Important" },
    { id: "general", label: "General" },
  ];

  const filtered = activeCategory === "all"
    ? messages
    : messages.filter((m) => m.messageType === activeCategory);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 font-jakarta">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold mb-2 border border-orange-500/20">
            <Megaphone size={14} className="text-orange-500" />
            <span>PLATFORM DIRECTIVES & BROADCASTS</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-white">
            Partner Updates & Messages
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Official announcements, menu directives, and system notices from Superadmin.
          </p>
        </div>

        <button
          onClick={fetchMessages}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-white/10 transition shadow-xs active:scale-95 w-fit cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-orange-500" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer active:scale-95 ${
              activeCategory === cat.id
                ? "bg-orange-500 text-white shadow-xs"
                : "bg-white dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/80 dark:border-white/10"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-orange-500">
          <RefreshCw className="animate-spin w-7 h-7" />
          <p className="text-xs text-stone-500">Loading messages...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-12 text-center text-stone-500 shadow-xs">
          <Inbox className="w-10 h-10 mx-auto mb-2 text-stone-400 dark:text-stone-600" />
          <p className="font-bold text-sm text-stone-800 dark:text-stone-200">No messages in this category</p>
          <p className="text-xs text-stone-500 mt-0.5">New notices from the platform will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((msg) => {
            const isRead = readNotices.includes(msg.id || msg._id);
            return (
              <div
                key={msg.id || msg._id}
                className={`bg-white dark:bg-[#10141f] border rounded-2xl p-5 sm:p-6 transition shadow-xs ${
                  isRead
                    ? "border-stone-200/80 dark:border-white/5 opacity-85"
                    : "border-orange-500/40 dark:border-orange-500/30 ring-1 ring-orange-500/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
                      {msg.messageType || "ANNOUNCEMENT"}
                    </span>
                    {msg.priority === "high" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                        High Priority
                      </span>
                    )}
                    {isRead ? (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                        <CheckCircle2 size={12} /> Acknowledged
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                        ● Unread
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-stone-400 font-medium flex items-center gap-1 font-mono">
                    <Clock size={12} /> {msg.date}
                  </span>
                </div>

                <h3 className="text-base font-bold text-stone-900 dark:text-white mt-1 mb-2">
                  {msg.title}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-4">
                  {msg.content}
                </p>

                <div className="pt-3 border-t border-stone-100 dark:border-white/5 flex items-center justify-end">
                  {!isRead ? (
                    <button
                      onClick={() => markAsRead(msg.id || msg._id)}
                      className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <span className="text-xs text-stone-400 font-medium">Recorded</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
