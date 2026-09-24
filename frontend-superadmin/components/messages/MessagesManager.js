"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  Bell,
  Send,
  Calendar,
  Clock,
  Search,
  Filter,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Users,
  Building2,
  Radio,
  Tag,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

export default function MessagesManager({ restaurants = [] }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sentCount: 0, scheduledCount: 0, draftCount: 0, disabledCount: 0 });
  const [activeTab, setActiveTab] = useState("sent"); // 'sent' | 'scheduled' | 'draft' | 'disabled'
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewMessage, setViewMessage] = useState(null);

  // New message form state
  const [form, setForm] = useState({
    title: "",
    content: "",
    messageType: "announcement",
    priority: "normal",
    recipientType: "restaurants",
    recipientSelection: "all",
    recipients: [],
    scheduledFor: "",
    expiresAt: "",
  });

  async function loadMessages() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("status", activeTab);
      if (search.trim()) params.append("search", search.trim());
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);

      const res = await fetch(`/api/superadmin/messages?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        if (data.stats) setStats(data.stats);
      } else {
        toast.error(data.message || "Failed to load messages");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error loading messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
  }, [activeTab, typeFilter, priorityFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadMessages();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function handleCreate(statusToSet = "sent") {
    if (!form.title.trim()) {
      toast.error("Please enter a message title.");
      return;
    }
    if (!form.content.trim()) {
      toast.error("Please enter message content.");
      return;
    }
    if (statusToSet === "scheduled" && !form.scheduledFor) {
      toast.error("Please select a date and time to schedule.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        status: statusToSet,
      };

      const res = await fetch("/api/superadmin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setCreateOpen(false);
        setForm({
          title: "",
          content: "",
          messageType: "announcement",
          priority: "normal",
          recipientType: "restaurants",
          recipientSelection: "all",
          recipients: [],
          scheduledFor: "",
          expiresAt: "",
        });
        loadMessages();
      } else {
        toast.error(data.message || "Failed to create message");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error creating message");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      const res = await fetch(`/api/superadmin/messages/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Message deleted successfully.");
        loadMessages();
      } else {
        toast.error(data.message || "Delete failed");
      }
    } catch (err) {
      toast.error("Error deleting message");
    }
  }

  async function handleCancelScheduled(id) {
    if (!confirm("Cancel this scheduled broadcast?")) return;
    try {
      const res = await fetch(`/api/superadmin/messages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Scheduled message cancelled.");
        loadMessages();
      }
    } catch (err) {
      toast.error("Error cancelling message");
    }
  }

  async function handleSendNow(id) {
    if (!confirm("Dispatch this message immediately to recipients?")) return;
    try {
      const res = await fetch(`/api/superadmin/messages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_now" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Message dispatched immediately!");
        loadMessages();
      }
    } catch (err) {
      toast.error("Error sending message");
    }
  }

  async function handleDisableMessage(id) {
    if (!id) {
      toast.error("Invalid message ID");
      return;
    }
    if (!confirm("Disable this message? It will be removed from active broadcast feeds and saved to Expired/Disabled messages.")) return;
    try {
      const res = await fetch(`/api/superadmin/messages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Message disabled and moved to Expired/Disabled.");
        loadMessages();
      } else {
        toast.error(data.message || data.error || "Failed to disable message");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error disabling message");
    }
  }

  async function handleEnableMessage(id) {
    if (!id) {
      toast.error("Invalid message ID");
      return;
    }
    try {
      const res = await fetch(`/api/superadmin/messages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Message re-enabled and restored to active broadcasts!");
        loadMessages();
      } else {
        toast.error(data.message || data.error || "Failed to re-enable message");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error re-enabling message");
    }
  }

  const typeBadges = {
    general: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    announcement: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40",
    important: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
    warning: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
    promotion: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    maintenance: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40",
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & ACTIONS ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20">
              <Bell className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Platform Messages & Directives
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dispatch announcements, maintenance alerts, and operational standards to restaurants & customers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm shadow-indigo-200 dark:shadow-indigo-950"
          >
            <Plus size={15} />
            <span>Create Message</span>
          </button>
        </div>
      </div>

      {/* ── STATS & TABS BAR ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("sent")}
            className={`px-4 py-1.5 rounded-lg transition flex items-center gap-2 ${
              activeTab === "sent"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Sent Messages</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
              {stats.sentCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("scheduled")}
            className={`px-4 py-1.5 rounded-lg transition flex items-center gap-2 ${
              activeTab === "scheduled"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Scheduled</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {stats.scheduledCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("draft")}
            className={`px-4 py-1.5 rounded-lg transition flex items-center gap-2 ${
              activeTab === "draft"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Drafts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {stats.draftCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("disabled")}
            className={`px-4 py-1.5 rounded-lg transition flex items-center gap-2 ${
              activeTab === "disabled"
                ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span>Disabled / Expired</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
              {stats.disabledCount || 0}
            </span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Search title, content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-52 bg-white dark:bg-slate-950/70 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 pl-8 transition outline-none shadow-sm"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white dark:bg-slate-950/70 text-xs text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 outline-none"
          >
            <option value="all">All Types</option>
            <option value="announcement">Announcement</option>
            <option value="important">Important</option>
            <option value="warning">Warning</option>
            <option value="general">General</option>
            <option value="promotion">Promotion</option>
            <option value="maintenance">Maintenance</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-white dark:bg-slate-950/70 text-xs text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="normal">Normal Priority</option>
          </select>
        </div>
      </div>

      {/* ── CATEGORY FILTER BAR ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 scrollbar-none">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5 mr-1">
          <Tag size={13} className="text-indigo-500" />
          Category Filter:
        </span>
        {[
          { id: "all", label: "All Categories" },
          { id: "announcement", label: "Announcements" },
          { id: "important", label: "Important" },
          { id: "warning", label: "Warnings" },
          { id: "general", label: "General" },
          { id: "promotion", label: "Promotions" },
          { id: "maintenance", label: "Maintenance" },
        ].map((cat) => {
          const isSelected = typeFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setTypeFilter(cat.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-xs font-bold"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── MESSAGES TABLE ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-5">Title & Message</th>
                <th className="py-3 px-5">Target Audience</th>
                <th className="py-3 px-5">Type / Priority</th>
                <th className="py-3 px-5">Date / Scheduled</th>
                <th className="py-3 px-5">Read / Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading messages...</span>
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">
                      No {activeTab} messages found
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Create a message to notify restaurants or customers across the platform.
                    </p>
                  </td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg._id || msg.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                    {/* Title & Preview */}
                    <td className="py-3.5 px-5 max-w-[280px]">
                      <div className="font-semibold text-slate-900 dark:text-white truncate" title={msg.title}>
                        {msg.title}
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate mt-0.5" title={msg.content}>
                        {msg.content}
                      </p>
                    </td>

                    {/* Audience */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5">
                        {msg.recipientType === "restaurants" ? (
                          <Building2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        ) : msg.recipientType === "customers" ? (
                          <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        ) : (
                          <Radio className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        )}
                        <span className="capitalize font-medium text-slate-800 dark:text-slate-200">
                          {msg.recipientType}
                        </span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded font-mono text-slate-500">
                          {msg.recipientSelection === "all" ? "All" : `${msg.recipientCount} selected`}
                        </span>
                      </div>
                    </td>

                    {/* Type & Priority */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            typeBadges[msg.messageType] || typeBadges.general
                          }`}
                        >
                          {msg.messageType}
                        </span>
                        {msg.priority === "high" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            HIGH
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-5 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                      {msg.status === "scheduled" ? (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <Clock size={12} />
                          <span>
                            {msg.scheduledFor ? new Date(msg.scheduledFor).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "Scheduled"}
                          </span>
                        </div>
                      ) : (
                        <span>
                          {msg.sentAt ? new Date(msg.sentAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Draft"}
                        </span>
                      )}
                    </td>

                    {/* Delivery & Read Status */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      {msg.status === "disabled" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          Disabled
                        </span>
                      ) : msg.status === "expired" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Expired
                        </span>
                      ) : msg.status === "cancelled" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30">
                          Cancelled
                        </span>
                      ) : msg.status === "sent" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 size={13} />
                          <span>{msg.readCount} viewed</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Pending dispatch</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewMessage(msg)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="View Message Details"
                        >
                          <Eye size={14} />
                        </button>

                        {msg.status === "sent" && (
                          <button
                            onClick={() => handleDisableMessage(msg._id || msg.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
                            title="Disable Message (Move to Expired/Disabled)"
                          >
                            <EyeOff size={14} />
                          </button>
                        )}

                        {(msg.status === "disabled" || msg.status === "expired" || msg.status === "cancelled") && (
                          <button
                            onClick={() => handleEnableMessage(msg._id || msg.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 font-bold hover:bg-emerald-100 transition text-[11px]"
                            title="Re-enable and restore to active Sent"
                          >
                            Re-enable
                          </button>
                        )}

                        {msg.status === "draft" && (
                          <button
                            onClick={() => handleSendNow(msg._id || msg.id)}
                            className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold hover:bg-indigo-100 transition"
                            title="Send Draft Now"
                          >
                            Send
                          </button>
                        )}

                        {msg.status === "scheduled" && (
                          <button
                            onClick={() => handleCancelScheduled(msg._id || msg.id)}
                            className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-100 transition"
                            title="Cancel Scheduled Broadcast"
                          >
                            Cancel
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(msg._id || msg.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          title="Delete Message Permanently"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE MESSAGE MODAL ─────────────────────────────────────── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Send size={15} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Broadcast</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Target restaurants or customers with live directives.</p>
                </div>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 py-4 pr-1 text-xs">
              {/* Recipient Type */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "restaurants", label: "Restaurants", icon: Building2 },
                  { id: "customers", label: "Customers", icon: Users },
                  { id: "all", label: "All Platform", icon: Radio },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setForm({ ...form, recipientType: id })}
                    className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 transition ${
                      form.recipientType === id
                        ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-700 dark:text-indigo-300"
                        : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Target Selection */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="recipientSelection"
                    checked={form.recipientSelection === "all"}
                    onChange={() => setForm({ ...form, recipientSelection: "all", recipients: [] })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>All in this group</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="recipientSelection"
                    checked={form.recipientSelection === "selected"}
                    onChange={() => setForm({ ...form, recipientSelection: "selected" })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Selected Specific Partners</span>
                </label>
              </div>

              {/* Multi-select if selected */}
              {form.recipientSelection === "selected" && form.recipientType === "restaurants" && (
                <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">
                    Choose Restaurants ({form.recipients.length} selected):
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {restaurants.map((r) => {
                      const isSelected = form.recipients.includes(r._id);
                      return (
                        <label
                          key={r._id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({ ...form, recipients: [...form.recipients, r._id] });
                              } else {
                                setForm({ ...form, recipients: form.recipients.filter((id) => id !== r._id) });
                              }
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{r.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Message Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mandatory 15-Minute Kitchen Preparation SLA Standard"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Message Content *
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter details of platform directive, operational guidelines, or promotional updates..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Type & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Message Type
                  </label>
                  <select
                    value={form.messageType}
                    onChange={(e) => setForm({ ...form, messageType: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="announcement">Announcement</option>
                    <option value="important">Important Directive</option>
                    <option value="warning">System Warning</option>
                    <option value="general">General Notice</option>
                    <option value="promotion">Promotion / Incentive</option>
                    <option value="maintenance">Maintenance Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Priority Level
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="high">High (Urgent Banner)</option>
                  </select>
                </div>
              </div>

              {/* Scheduling & Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Schedule for Later (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduledFor}
                    onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none"
                  >
                  </input>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleCreate("draft")}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition"
              >
                Save as Draft
              </button>

              <div className="flex items-center gap-2">
                {form.scheduledFor ? (
                  <button
                    type="button"
                    onClick={() => handleCreate("scheduled")}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow"
                  >
                    {submitting ? "Scheduling..." : "Schedule Broadcast"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCreate("sent")}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow shadow-indigo-200 dark:shadow-indigo-950"
                  >
                    {submitting ? "Broadcasting..." : "Send Immediately"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW MESSAGE DETAILS MODAL ──────────────────────────────── */}
      {viewMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-xs space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                    typeBadges[viewMessage.messageType] || typeBadges.general
                  }`}
                >
                  {viewMessage.messageType}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                  {viewMessage.title}
                </h3>
              </div>
              <button
                onClick={() => setViewMessage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 leading-relaxed text-sm whitespace-pre-wrap">
              {viewMessage.content}
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-500 dark:text-slate-400 text-[11px]">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Audience: </span>
                <span className="capitalize">{viewMessage.recipientType}</span> ({viewMessage.recipientSelection})
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Priority: </span>
                <span className="uppercase font-bold">{viewMessage.priority}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Sent Date: </span>
                <span>{viewMessage.sentAt ? new Date(viewMessage.sentAt).toLocaleString() : "Not sent yet"}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total Views: </span>
                <span className="text-emerald-500 font-bold">{viewMessage.readCount} partners</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewMessage(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
