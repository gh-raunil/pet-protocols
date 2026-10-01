"use client";

import { useState, useEffect } from "react";
import {
  Headphones,
  Search,
  RefreshCw,
  Building,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MessageSquare,
  Send,
} from "lucide-react";

export default function SupportManager() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolutionText, setResolutionText] = useState("");
  const [savingResolution, setSavingResolution] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  async function loadTickets(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/superadmin/support?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        if (!selectedTicket && data.tickets.length > 0) {
          setSelectedTicket(data.tickets[0]);
        }
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to load support inquiries." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Network error loading tickets." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  async function handleAddResolution() {
    if (!selectedTicket || !resolutionText.trim()) return;

    try {
      setSavingResolution(true);
      const res = await fetch("/api/superadmin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedTicket.id,
          resolutionNote: resolutionText.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "Superadmin resolution note appended." });
        setResolutionText("");
        loadTickets(true);
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to save note." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to record resolution note." });
    } finally {
      setSavingResolution(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Headphones className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Customer & Escalation Support</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review customer order disputes, delivery delays, and kitchen resolution logs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadTickets(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {feedback.message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300"
          }`}
        >
          <p className="text-xs sm:text-sm font-semibold">{feedback.message}</p>
          <button onClick={() => setFeedback({ type: "", message: "" })} className="text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold">Loading support logs...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-400">
          <Headphones size={32} className="mx-auto mb-3 opacity-40 text-emerald-500" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">All Inquiries Resolved</h3>
          <p className="text-xs mt-1">There are no open order notes or customer complaints requiring intervention.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Ticket list */}
          <div className="lg:col-span-5 space-y-3">
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTicket(t)}
                className={`p-4 rounded-2xl border cursor-pointer transition ${
                  selectedTicket?.id === t.id
                    ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 shadow-sm"
                    : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {t.orderId}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {t.status}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                  <Building size={12} className="text-indigo-500" />
                  <span>{t.restaurantName}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Customer: {t.customerName} ({t.customerPhone || "No phone"})
                </div>
              </div>
            ))}
          </div>

          {/* Ticket details & resolution */}
          <div className="lg:col-span-7">
            {selectedTicket ? (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedTicket.orderId}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {selectedTicket.restaurantName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Customer: {selectedTicket.customerName} • {selectedTicket.customerPhone}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      ₹{selectedTicket.totalAmount}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Order Audit & Support Notes History
                  </h4>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                    {selectedTicket.notes || "No notes logged for this order yet."}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Add Superadmin Resolution / Administrative Note:
                  </label>
                  <textarea
                    rows={3}
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    placeholder="e.g. Verified customer payment. Instructed kitchen manager to dispatch priority item replacement."
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingResolution || !resolutionText.trim()}
                      onClick={handleAddResolution}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                    >
                      <Send size={13} />
                      <span>{savingResolution ? "Appending..." : "Submit Resolution Note"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                Select a ticket from the left to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
