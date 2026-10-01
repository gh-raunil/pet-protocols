"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  Phone,
  ShoppingBag,
  IndianRupee,
  MapPin,
  Calendar,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

export default function CustomersManager() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  async function loadCustomers(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const res = await fetch("/api/superadmin/customers");
      const data = await res.json();
      if (data.success && Array.isArray(data.customers)) {
        setCustomers(data.customers);
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to load customers." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Network error loading customer directory." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function handleToggleStatus(customerId, currentStatus) {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      setUpdatingId(customerId);
      const res = await fetch("/api/superadmin/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomers((prev) =>
          prev.map((c) => (c._id === customerId ? { ...c, status: nextStatus } : c))
        );
        setFeedback({
          type: "success",
          message: `Customer ${data.customer?.name} marked as ${nextStatus}.`,
        });
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to update status." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to update customer status." });
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        !searchQuery.trim() ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery);

      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [customers, searchQuery, statusFilter]);

  const activeCount = customers.filter((c) => c.status === "active").length;
  const suspendedCount = customers.filter((c) => c.status === "suspended").length;
  const totalSpendSum = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);

  return (
    <div className="space-y-6">
      {/* ── HEADER & STATS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Customer Directory & Accounts</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Oversee registered food lovers, total order frequency, and account security.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadCustomers(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* ── METRIC TILES ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Customers</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {customers.length}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {activeCount} active • {suspendedCount} suspended
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Customer Spend</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{totalSpendSum.toLocaleString("en-IN")}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Across all delivered orders
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Spend Per User</p>
          <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            ₹{customers.length > 0 ? Math.round(totalSpendSum / customers.length).toLocaleString("en-IN") : 0}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Platform customer lifetime value
          </span>
        </div>
      </div>

      {/* ── FEEDBACK ALERT ── */}
      {feedback.message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600" />
            )}
            <p className="text-xs sm:text-sm font-semibold">{feedback.message}</p>
          </div>
          <button
            onClick={() => setFeedback({ type: "", message: "" })}
            className="text-xs opacity-70 hover:opacity-100 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer by name, email, or phone number..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-500 hidden sm:inline">Status:</span>
          {["all", "active", "suspended"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                statusFilter === st
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABLE VIEW ── */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold">Loading platform customers...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-400">
          <Users size={32} className="mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Customers Found</h3>
          <p className="text-xs mt-1">Try adjusting your search criteria or status filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Orders</th>
                <th className="py-3 px-4">Total Spend</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCustomers.map((customer) => {
                const isSuspended = customer.status === "suspended";
                const isUpdating = updatingId === customer._id;

                return (
                  <tr
                    key={customer._id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                          {customer.name?.charAt(0)?.toUpperCase() || "C"}
                        </div>
                        <div>
                          <div className="font-bold leading-tight">{customer.name}</div>
                          <div className="text-[11px] text-slate-400 font-normal">
                            {customer.addressesCount} saved address{customer.addressesCount !== 1 ? "es" : ""}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Mail size={12} className="text-slate-400" />
                          <span>{customer.email}</span>
                        </div>
                        {customer.phone && (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                            <Phone size={12} className="text-slate-400" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-xs">
                        <ShoppingBag size={11} className="text-indigo-500" />
                        <span>{customer.totalOrders || 0}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                      ₹{(customer.totalSpent || 0).toLocaleString("en-IN")}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-xs">
                      {new Date(customer.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          isSuspended
                            ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40"
                            : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                        }`}
                      >
                        {isSuspended ? (
                          <>
                            <ShieldAlert size={11} /> Suspended
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={11} /> Active
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(customer._id, customer.status)}
                        disabled={isUpdating}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 ${
                          isSuspended
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                            : "bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {isUpdating ? "Saving..." : isSuspended ? "Reactivate" : "Suspend"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
