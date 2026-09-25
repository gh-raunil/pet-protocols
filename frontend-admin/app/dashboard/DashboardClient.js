"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag,
  IndianRupee,
  UtensilsCrossed,
  PlusCircle,
  ArrowRight,
  Clock,
  RefreshCw,
  Calendar,
  Search,
  CheckCircle2,
  CalendarDays,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export function formatOrderId(order) {
  if (!order) return "#PET-0000";
  if (order.orderId) {
    if (order.orderId.startsWith("PET-")) return `#${order.orderId}`;
    if (order.orderId.startsWith("ORD_")) return `#${order.orderId.replace("ORD_", "PET-")}`;
    return `#PET-${order.orderId.slice(-6).toUpperCase()}`;
  }
  const idStr = (order._id || "").toString();
  return `#PET-${idStr.slice(-6).toUpperCase()}`;
}

export default function DashboardClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kitchenActive, setKitchenActive] = useState(true);

  // Today's date in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState("");

  // Route protection
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  async function fetchDashboard(date = selectedDate, query = searchQuery) {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (date) params.append("date", date);
      if (query) params.append("search", query.trim());

      const res = await fetch(`/api/restaurant/stats?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setRecentOrders(data.recentOrders || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchDashboard(selectedDate, searchQuery);
    }
  }, [session, selectedDate]);

  // Handle Search submit / change
  function handleSearch(e) {
    e.preventDefault();
    fetchDashboard(selectedDate, searchQuery);
  }

  const restaurantName = stats?.restaurantName || session?.user?.restaurantName || "Partner Kitchen";

  // Min selectable date: restaurant createdAt date
  const minSelectableDate = useMemo(() => {
    if (stats?.restaurantCreatedAt) {
      try {
        return new Date(stats.restaurantCreatedAt).toISOString().split("T")[0];
      } catch (e) {}
    }
    return "2024-01-01";
  }, [stats?.restaurantCreatedAt]);

  const isTodaySelected = selectedDate === todayStr;

  const statusStyles = {
    pending: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30",
    preparing: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30",
    out_for_delivery: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30",
    delivered: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30",
    cancelled: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30",
  };

  return (
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      {/* Soft warm ambient background glow for light mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-100/60 via-amber-50/30 to-transparent dark:from-orange-500/5 dark:via-transparent dark:to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      <main className="pt-24 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6">
        
        {/* ── TOP HEADER / KITCHEN CONTROL PANEL ──────────────────────── */}
        <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm shadow-stone-200/40 dark:shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white tracking-tight">
                  {restaurantName}
                </h1>
                <span className="text-[11px] font-mono text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-500/20 font-bold">
                  #{session?.user?.restaurantId?.slice(-6) || "PARTNER"}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Kitchen operations overview, daily revenue, and real-time order stream.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setKitchenActive(!kitchenActive)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border active:scale-95 ${
                  kitchenActive
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${kitchenActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <span>{kitchenActive ? "Accepting Orders" : "Kitchen Paused"}</span>
              </button>

              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition shadow-sm shadow-orange-500/20 active:scale-95"
              >
                <PlusCircle size={14} />
                <span>Add Dish</span>
              </Link>

              <Link
                href="/orders"
                className="inline-flex items-center gap-1.5 bg-stone-100 dark:bg-white/5 hover:bg-stone-200/80 dark:hover:bg-white/10 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-white/10 font-bold px-3.5 py-2 rounded-xl text-xs transition active:scale-95"
              >
                <ShoppingBag size={14} />
                <span>Orders</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── 5 ESSENTIAL KPI CARDS (Total Revenue, Total Orders, Menu Dishes, Today's Revenue, Today's Orders) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* 1. Total Revenue */}
          <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-orange-500/40">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Revenue</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <IndianRupee size={15} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white font-mono">
              ₹{stats?.totalRevenue || 0}
            </p>
            <span className="text-[10px] text-stone-400">All-time lifetime</span>
          </div>

          {/* 2. Total Orders */}
          <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-orange-500/40">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Orders</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShoppingBag size={15} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white font-mono">
              {stats?.totalOrders || 0}
            </p>
            <span className="text-[10px] text-stone-400">All-time tickets</span>
          </div>

          {/* 3. Menu Dishes */}
          <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-orange-500/40">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Menu Dishes</span>
              <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <UtensilsCrossed size={15} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white font-mono">
              {stats?.totalProducts || 0}
            </p>
            <span className="text-[10px] text-stone-400">Catalog items</span>
          </div>

          {/* 4. Today's Revenue */}
          <div className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/30 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-orange-500">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <TrendingUp size={12} /> Today's Rev
              </span>
              <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold">
                <IndianRupee size={15} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-orange-600 dark:text-orange-400 font-mono">
              ₹{stats?.todayRevenue || 0}
            </p>
            <span className="text-[10px] font-bold text-orange-600/80 dark:text-orange-400/80">Today's collection</span>
          </div>

          {/* 5. Today's Orders */}
          <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/30 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-blue-500">
            <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Today's Orders
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                <ShoppingBag size={15} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {stats?.todayOrders || 0}
            </p>
            <span className="text-[10px] font-bold text-blue-600/80 dark:text-blue-400/80">Received today</span>
          </div>
        </div>

        {/* ── FILTER TOOLBAR: DATE SELECTION & SEARCH BAR ────────────────────── */}
        <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Date Picker bounded between restaurant creation date and today */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="font-bold text-stone-700 dark:text-stone-300 shrink-0">Filter Date:</span>
              <input
                type="date"
                value={selectedDate}
                min={minSelectableDate}
                max={todayStr}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-stone-900 dark:text-white font-mono font-bold outline-none cursor-pointer text-xs"
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                isTodaySelected
                  ? "bg-orange-500 text-white shadow-xs"
                  : "bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300"
              }`}
            >
              Today
            </button>

            {!isTodaySelected && stats?.selectedDateRevenue !== undefined && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-xs font-bold text-orange-700 dark:text-orange-400">
                <span>Selected Date: {stats.selectedDateOrders || 0} orders (₹{stats.selectedDateRevenue || 0})</span>
              </div>
            )}
          </div>

          {/* Search by Order ID or Customer Name */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="flex items-center flex-1 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 focus-within:border-orange-500 transition">
              <Search className="w-4 h-4 text-stone-400 shrink-0 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order ID (#PET-...) or customer name..."
                className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 text-xs outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    fetchDashboard(selectedDate, "");
                  }}
                  className="text-stone-400 hover:text-stone-700 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-xs shrink-0 active:scale-95"
            >
              Search
            </button>
          </form>
        </div>

        {/* ── ORDERS FEED / RECENT ORDERS ────────────────────────────── */}
        <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                {isTodaySelected ? "Today's Live Orders" : `Orders for ${selectedDate}`}
              </h2>
              <span className="text-xs font-mono text-stone-400 bg-stone-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                {recentOrders.length} {recentOrders.length === 1 ? "ticket" : "tickets"}
              </span>
            </div>

            <Link
              href="/orders"
              className="text-xs font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition"
            >
              <span>Open Kitchen Display</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-orange-500">
              <RefreshCw className="animate-spin w-6 h-6" />
              <p className="text-xs text-stone-500">Loading orders...</p>
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl bg-stone-50/50 dark:bg-transparent">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-stone-400" />
              <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
                {searchQuery ? "No matching orders found" : isTodaySelected ? "No orders placed today yet" : `No orders found for ${selectedDate}`}
              </p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                {searchQuery ? "Try searching with a different order ID or customer name." : "Incoming customer orders will appear automatically."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => {
                const uniqueId = formatOrderId(order);

                return (
                  <div
                    key={order._id}
                    className="p-4 rounded-2xl bg-stone-50/70 dark:bg-white/[0.02] border border-stone-200/80 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-orange-500/40 transition"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-extrabold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-200 dark:border-orange-500/20">
                          {uniqueId}
                        </span>
                        <span className="text-stone-300 dark:text-stone-700">•</span>
                        <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${statusStyles[order.status] || "bg-stone-200 text-stone-700"}`}>
                          {order.status}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-2">
                        <span>👤 {order.address?.fullName || order.user?.name || "Customer"}</span>
                        {order.address?.phone && (
                          <span className="text-stone-400 font-mono text-[11px] font-normal">
                            ({order.address.phone})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                        {order.items?.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-200/60 dark:border-white/5">
                      <span className="text-sm font-black text-stone-900 dark:text-white font-mono">
                        ₹{order.totalAmount}
                      </span>
                      <Link
                        href="/orders"
                        className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-white/5 hover:bg-orange-500 hover:text-white transition text-xs font-bold text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-white/10 shadow-xs"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
