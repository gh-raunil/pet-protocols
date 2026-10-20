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
  Printer,
  Banknote,
  User,
  ChefHat,
  AlertTriangle,
  Receipt,
  Store,
} from "lucide-react";
import { getOrderElapsedInfo, handlePrintKOT } from "../orders/OrdersClient";

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
  const [kitchenActive, setKitchenActive] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("restaurant_kitchen_active") !== "false";
    }
    return true;
  });

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
  const restaurantCreatedAt = stats?.restaurantCreatedAt;
  const minSelectableDate = useMemo(() => {
    if (restaurantCreatedAt) {
      try {
        return new Date(restaurantCreatedAt).toISOString().split("T")[0];
      } catch (e) {}
    }
    return "2024-01-01";
  }, [restaurantCreatedAt]);

  const isTodaySelected = selectedDate === todayStr;

  // Filter recent orders client-side for instantaneous feedback
  const displayedRecentOrders = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return recentOrders;
    const q = searchQuery.trim().toLowerCase().replace(/^#/, "");
    const cleanQ = q.replace(/^pet-/i, "").replace(/^ord_/i, "");
    return recentOrders.filter((order) => {
      const formatted = formatOrderId(order).toLowerCase().replace(/^#/, "");
      const rawId = (order.orderId || "").toLowerCase();
      const mongoId = (order._id || "").toString().toLowerCase();
      const customer = (order.address?.fullName || order.user?.name || "").toLowerCase();
      const phone = (order.address?.phone || order.user?.phone || "").toLowerCase();
      return (
        formatted.includes(q) ||
        formatted.includes(cleanQ) ||
        rawId.includes(q) ||
        rawId.includes(cleanQ) ||
        mongoId.includes(q) ||
        mongoId.includes(cleanQ) ||
        customer.includes(q) ||
        phone.includes(q)
      );
    });
  }, [recentOrders, searchQuery]);

  const statusStyles = {
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
    preparing: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
    out_for_delivery: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20",
    delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
    cancelled: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-jakarta">
      {/* ── STICKY KITCHEN PAUSED WARNING BANNER ─────────────────── */}
      {!kitchenActive && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 rounded-2xl p-4 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 font-bold">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-rose-900 dark:text-rose-100">
                Kitchen is currently PAUSED
              </h4>
              <p className="text-xs text-rose-700/90 dark:text-rose-300">
                Your storefront is temporarily not accepting incoming customer orders.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setKitchenActive(true);
              if (typeof window !== "undefined") {
                localStorage.setItem("restaurant_kitchen_active", "true");
              }
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition active:scale-95 shrink-0 cursor-pointer"
          >
            Resume Orders Now
          </button>
        </div>
      )}

      {/* ── TOP OPERATIONAL COMMAND HEADER ──────────────────────────── */}
      <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
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
              onClick={() => {
                const nextState = !kitchenActive;
                setKitchenActive(nextState);
                if (typeof window !== "undefined") {
                  localStorage.setItem("restaurant_kitchen_active", String(nextState));
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border active:scale-95 cursor-pointer ${
                kitchenActive
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  kitchenActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
              />
              <span>{kitchenActive ? "Accepting Orders" : "Kitchen Paused"}</span>
            </button>

            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition shadow-xs active:scale-95"
            >
              <PlusCircle size={14} />
              <span>Add Dish</span>
            </Link>

            <Link
              href="/orders"
              className="inline-flex items-center gap-1.5 bg-stone-100 dark:bg-white/5 hover:bg-stone-200/80 dark:hover:bg-white/10 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-white/10 font-bold px-3.5 py-2 rounded-xl text-xs transition active:scale-95"
            >
              <ShoppingBag size={14} />
              <span>Live Queue</span>
            </Link>

            <Link
              href="/kitchen"
              className="inline-flex items-center gap-1.5 bg-stone-100 dark:bg-white/5 hover:bg-stone-200/80 dark:hover:bg-white/10 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-white/10 font-bold px-3.5 py-2 rounded-xl text-xs transition active:scale-95"
            >
              <ChefHat size={14} />
              <span>KDS Screen</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 5 ESSENTIAL KPI CARDS ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Total Revenue */}
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-orange-500/40">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Total Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <IndianRupee size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white font-mono">
            ₹{stats?.totalRevenue || 0}
          </p>
          <span className="text-[10px] text-stone-400 mt-0.5 block">All-time lifetime</span>
        </div>

        {/* 2. Total Orders */}
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-orange-500/40">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Total Orders
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <ShoppingBag size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white font-mono">
            {stats?.totalOrders || 0}
          </p>
          <span className="text-[10px] text-stone-400 mt-0.5 block">All-time tickets</span>
        </div>

        {/* 3. Menu Dishes */}
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-orange-500/40">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Menu Dishes
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              <UtensilsCrossed size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white font-mono">
            {stats?.totalProducts || 0}
          </p>
          <span className="text-[10px] text-stone-400 mt-0.5 block">Catalog items</span>
        </div>

        {/* 4. Today's Revenue */}
        <div className="bg-white dark:bg-[#10141f] border border-orange-500/30 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-orange-500">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1">
              <TrendingUp size={12} /> Today's Rev
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold">
              <IndianRupee size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-orange-600 dark:text-orange-400 font-mono">
            ₹{stats?.todayRevenue || 0}
          </p>
          <span className="text-[10px] font-bold text-orange-600/80 dark:text-orange-400/80 mt-0.5 block">
            Today's collection
          </span>
        </div>

        {/* 5. Today's Orders */}
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-[#10141f] border border-blue-500/30 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-blue-500">
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Today's Orders
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <ShoppingBag size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {stats?.todayOrders || 0}
          </p>
          <span className="text-[10px] font-bold text-blue-600/80 dark:text-blue-400/80 mt-0.5 block">
            Received today
          </span>
        </div>
      </div>

      {/* ── FILTER TOOLBAR: DATE SELECTION & SEARCH BAR ─────────────── */}
      <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Date Picker */}
        <div className="flex items-center gap-2 flex-wrap">
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
            className={`px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              isTodaySelected
                ? "bg-orange-500 text-white shadow-xs"
                : "bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300"
            }`}
          >
            Today
          </button>

          {!isTodaySelected && stats?.selectedDateRevenue !== undefined && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-xs font-bold text-orange-700 dark:text-orange-400">
              <span>
                Selected Date: {stats.selectedDateOrders || 0} orders (₹{stats.selectedDateRevenue || 0})
              </span>
            </div>
          )}
        </div>

        {/* Search by Order ID or Customer Name */}
        <form onSubmit={handleSearch} className="flex items-center gap-1.5 sm:gap-2 flex-1 w-full max-w-md">
          <div className="flex items-center flex-1 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-2.5 sm:px-3 py-2 focus-within:border-orange-500 transition min-w-0">
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order # or customer..."
              className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 text-xs outline-none min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  fetchDashboard(selectedDate, "");
                }}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-white text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-xs shrink-0 active:scale-95 cursor-pointer"
          >
            Search
          </button>

          <button
            type="button"
            onClick={() => fetchDashboard(selectedDate, searchQuery)}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-white/10 font-bold text-xs transition shadow-xs shrink-0 active:scale-95 flex items-center gap-1.5 cursor-pointer"
            title="Refresh Dashboard data"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-orange-500" : ""} />
            <span className="hidden md:inline">Refresh</span>
          </button>
        </form>
      </div>

      {/* ── OPERATIONAL ORDERS TABLE & FEED ─────────────────────────── */}
      <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white tracking-tight">
              {isTodaySelected ? "Today's Live Orders" : `Orders for ${selectedDate}`}
            </h2>
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 px-2 py-0.5 rounded-full">
              {displayedRecentOrders.length} {displayedRecentOrders.length === 1 ? "ticket" : "tickets"}
            </span>
          </div>

          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition"
          >
            <span>Open Kitchen Queue</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-orange-500">
            <RefreshCw className="animate-spin w-6 h-6" />
            <p className="text-xs text-stone-500">Refreshing kitchen stream...</p>
          </div>
        ) : displayedRecentOrders.length === 0 ? (
          <div className="text-center py-12 px-4">
            <ShoppingBag className="w-9 h-9 mx-auto mb-2 text-stone-400" />
            <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
              {searchQuery
                ? "No matching orders found"
                : isTodaySelected
                ? "No orders placed today yet"
                : `No orders found for ${selectedDate}`}
            </p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {searchQuery
                ? "Try searching with a different order ID or customer name."
                : "Incoming customer orders will appear automatically."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Operational Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 dark:bg-white/[0.02] text-stone-400 dark:text-stone-500 font-bold uppercase text-[10px] tracking-wider border-b border-stone-100 dark:border-white/5">
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Ordered Items</th>
                    <th className="py-3 px-4">Timer</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-white/5 font-medium">
                  {displayedRecentOrders.map((order) => {
                    const uniqueId = formatOrderId(order);
                    const shortCode = order.orderId?.includes("_")
                      ? `#PET-${order.orderId.split("_")[1]}`
                      : uniqueId;
                    const isCod =
                      (order.paymentMethod || "").toLowerCase().includes("cod") ||
                      (order.paymentMethod || "").toLowerCase().includes("cash") ||
                      order.paymentStatus === "pending";
                    const elapsedInfo = getOrderElapsedInfo(
                      order.createdAt,
                      order.status,
                      order.updatedAt
                    );

                    return (
                      <tr
                        key={order._id}
                        className="hover:bg-stone-50/80 dark:hover:bg-white/[0.02] transition"
                      >
                        <td className="py-3 px-4">
                          <span
                            title={uniqueId}
                            className="font-mono text-xs font-bold text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-white/10 px-2 py-0.5 rounded border border-stone-200 dark:border-white/10"
                          >
                            {shortCode}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-stone-900 dark:text-stone-100">
                            {order.address?.fullName || order.user?.name || "Customer"}
                          </div>
                          {order.address?.phone && (
                            <div className="text-[10px] text-stone-400 font-mono">
                              {order.address.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-[240px]">
                          <span className="truncate block text-stone-700 dark:text-stone-300">
                            {order.items
                              ?.map((item) => `${item.quantity}× ${item.name}`)
                              .join(", ") || "No items specified"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${elapsedInfo.color}`}
                          >
                            <Clock size={10} />
                            <span>{elapsedInfo.text}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-extrabold text-stone-900 dark:text-white">
                              ₹{order.totalAmount}
                            </span>
                            {isCod ? (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                COD
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Paid
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              statusStyles[order.status] || "bg-stone-200 text-stone-700"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintKOT(order)}
                              title="Print KOT Slip"
                              className="p-1.5 rounded-lg bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-white/10 transition cursor-pointer"
                            >
                              <Printer size={13} />
                            </button>
                            <Link
                              href="/orders"
                              className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-xs flex items-center gap-1"
                            >
                              <span>Manage</span>
                              <ArrowRight size={10} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-stone-100 dark:divide-white/5">
              {displayedRecentOrders.map((order) => {
                const uniqueId = formatOrderId(order);
                const shortCode = order.orderId?.includes("_")
                  ? `#PET-${order.orderId.split("_")[1]}`
                  : uniqueId;
                const isCod =
                  (order.paymentMethod || "").toLowerCase().includes("cod") ||
                  (order.paymentMethod || "").toLowerCase().includes("cash") ||
                  order.paymentStatus === "pending";
                const elapsedInfo = getOrderElapsedInfo(
                  order.createdAt,
                  order.status,
                  order.updatedAt
                );

                return (
                  <div key={order._id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-white/10 px-2 py-0.5 rounded border border-stone-200 dark:border-white/10">
                          {shortCode}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${elapsedInfo.color}`}
                        >
                          <Clock size={10} />
                          <span>{elapsedInfo.text}</span>
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          statusStyles[order.status] || "bg-stone-200 text-stone-700"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-stone-900 dark:text-stone-100">
                          {order.address?.fullName || order.user?.name || "Customer"}
                        </div>
                        {order.address?.phone && (
                          <div className="text-[10px] text-stone-400 font-mono">
                            {order.address.phone}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-stone-900 dark:text-white">
                          ₹{order.totalAmount}
                        </div>
                        <div className="text-[10px] text-stone-400 uppercase">
                          {isCod ? "COD" : "Paid"}
                        </div>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/60 dark:border-white/5 text-xs text-stone-700 dark:text-stone-300 truncate">
                      {order.items
                        ?.map((item) => `${item.quantity}× ${item.name}`)
                        .join(", ") || "No items specified"}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handlePrintKOT(order)}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-white/10 text-xs font-bold"
                      >
                        Print KOT
                      </button>
                      <Link
                        href="/orders"
                        className="px-3 py-1 rounded-lg bg-orange-500 text-white font-bold text-xs"
                      >
                        Manage Order
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
