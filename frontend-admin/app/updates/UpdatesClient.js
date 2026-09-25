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
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      {/* Soft warm ambient background glow for light mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-100/60 via-amber-50/30 to-transparent dark:from-orange-500/5 dark:via-transparent dark:to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      <main className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 pb-6 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
              Kitchen <span className="text-orange-500">Messages</span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
              Platform announcements and kitchen directives from Super Admin.
            </p>
          </div>

          <button
            onClick={fetchMessages}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition shadow-xs active:scale-95 w-fit"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 mb-6">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap active:scale-95 ${
                activeCategory === cat.id
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-500/25"
                  : "bg-white/90 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/80 dark:border-white/10"
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
          <div className="bg-white/90 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-12 text-center text-stone-500 shadow-sm shadow-stone-200/40 dark:shadow-none">
            <Inbox className="w-10 h-10 mx-auto mb-2 text-stone-400 dark:text-stone-600" />
            <p className="font-semibold text-sm text-stone-800 dark:text-stone-200">No messages in this category</p>
            <p className="text-xs text-stone-500 mt-0.5">New notices from the platform will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((msg) => {
              const isRead = readNotices.includes(msg.id || msg._id);
              return (
                <div
                  key={msg.id || msg._id}
                  className={`bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border rounded-2xl p-5 sm:p-6 transition shadow-sm shadow-stone-200/40 dark:shadow-none ${
                    isRead
                      ? "border-stone-200/80 dark:border-white/5 opacity-80"
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
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                          <CheckCircle2 size={12} /> Acknowledged
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
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
                        className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition shadow-sm shadow-orange-500/20 flex items-center gap-1.5 active:scale-95"
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
      </main>
    </div>
  );
}
