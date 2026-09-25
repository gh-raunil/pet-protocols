"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Clock,
  Phone,
  MapPin,
  CheckCircle,
  RefreshCw,
  ChefHat,
  Truck,
  XCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Bell,
  Sparkles,
  AlertTriangle,
  Calendar,
  Download,
  Search,
  FileSpreadsheet,
  ArrowRight,
  Radio,
} from "lucide-react";
import { playChime } from "@/lib/soundChimes";
import { formatOrderId } from "../dashboard/DashboardClient";

const POLL_INTERVAL = 10000; // Poll every 10 seconds

export default function OrdersClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const todayStr = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedDate, setSelectedDate] = useState(todayStr); // Default to current date
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurantCreatedAt, setRestaurantCreatedAt] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Kitchen Alert & Audio States
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState(new Set());

  // Refs for polling and concurrency management
  const isFetchingRef = useRef(false);
  const knownOrderIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/orders");
    }
  }, [status, router]);

  // Load orders from backend
  const fetchOrders = useCallback(
    async (isManual = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isManual) {
        setIsRefreshing(true);
      }

      try {
        const params = new URLSearchParams();
        if (filterStatus && filterStatus !== "all") params.append("status", filterStatus);
        if (selectedDate) params.append("date", selectedDate);
        if (searchQuery.trim()) params.append("search", searchQuery.trim());

        const res = await fetch(`/api/restaurant/orders?${params.toString()}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.orders)) {
          const incomingOrders = data.orders;
          if (data.restaurantCreatedAt) {
            setRestaurantCreatedAt(data.restaurantCreatedAt);
          }

          if (isInitialLoadRef.current) {
            incomingOrders.forEach((o) => knownOrderIdsRef.current.add(o._id));
            isInitialLoadRef.current = false;
          } else {
            // Check for new pending orders
            const newPendingOrders = incomingOrders.filter(
              (o) => o.status === "pending" && !knownOrderIdsRef.current.has(o._id)
            );

            if (newPendingOrders.length > 0) {
              // Sound alert
              if (soundEnabled) {
                playChime(null, 1.0);
              }

              const newest = newPendingOrders[0];
              const totalItems = newest.items?.reduce(
                (sum, it) => sum + (it.quantity || 1),
                0
              ) || 1;

              setNewOrderAlert({
                id: newest._id,
                orderId: formatOrderId(newest),
                customerName: newest.address?.fullName || "Customer",
                totalAmount: newest.totalAmount,
                itemCount: totalItems,
                count: newPendingOrders.length,
              });

              setHighlightedOrderIds((prev) => {
                const next = new Set(prev);
                newPendingOrders.forEach((o) => next.add(o._id));
                return next;
              });

              setTimeout(() => {
                setNewOrderAlert(null);
              }, 10000);

              newPendingOrders.forEach((o) => knownOrderIdsRef.current.add(o._id));
            }

            incomingOrders.forEach((o) => knownOrderIdsRef.current.add(o._id));
          }

          setOrders(incomingOrders);
        }
      } catch (err) {
        console.error("Order polling failed:", err);
        if (isManual) {
          setFeedback({ type: "error", message: "Failed to load orders." });
        }
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [filterStatus, selectedDate, searchQuery, soundEnabled]
  );

  // Initial load and periodic polling interval
  useEffect(() => {
    if (!session?.user) return;

    setLoading(true);
    fetchOrders(false);

    const intervalId = setInterval(() => {
      fetchOrders(false);
    }, POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [session, filterStatus, selectedDate, fetchOrders]);

  async function handleUpdateStatus(orderId, nextStatus) {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus }),
      });

      const data = await res.json();
      if (data.success) {
        const orderObj = orders.find((o) => o._id === orderId);
        const displayId = formatOrderId(orderObj || { _id: orderId });
        setFeedback({
          type: "success",
          message: `Order ${displayId} updated to ${nextStatus.toUpperCase()}`,
        });
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, status: nextStatus } : o))
        );
        setHighlightedOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to update order status." });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // Filter orders client-side for instantaneous feedback across orderId, #PET-xxx, mongo _id, customer name & phone
  const displayedOrders = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return orders;
    const q = searchQuery.trim().toLowerCase().replace(/^#/, "");
    const cleanQ = q.replace(/^pet-/i, "").replace(/^ord_/i, "");
    return orders.filter((order) => {
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
  }, [orders, searchQuery]);

  function handleSearch(e) {
    if (e) e.preventDefault();
    fetchOrders(true);
  }

  // Export orders to CSV using Blob with BOM (prevents truncation on # fragments and supports Excel)
  function downloadOrdersReport() {
    const exportTarget = displayedOrders.length > 0 ? displayedOrders : orders;
    if (!exportTarget || exportTarget.length === 0) {
      alert("No orders to download for this selection.");
      return;
    }

    const headers = [
      "Order ID",
      "Date",
      "Time",
      "Customer Name",
      "Phone",
      "Items Count",
      "Dishes Summary",
      "Total Amount (INR)",
      "Status",
      "Payment Status",
      "Delivery Address",
    ];

    const rows = exportTarget.map((o) => {
      const orderDate = new Date(o.createdAt);
      const formattedDate = !isNaN(orderDate) ? orderDate.toISOString().split("T")[0] : "";
      const formattedTime = !isNaN(orderDate) ? orderDate.toLocaleTimeString() : "";
      const uniqueId = formatOrderId(o);
      const itemsCount = o.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0;
      const itemsSummary = (o.items || [])
        .map((it) => `${it.quantity || 1}x ${it.name || "Dish"}`)
        .join(" | ")
        .replace(/"/g, '""');
      const address = `${o.address?.street || ""}, ${o.address?.city || ""}`.replace(/"/g, '""');
      const customerName = (o.address?.fullName || o.user?.name || "Customer").replace(/"/g, '""');
      const phone = (o.address?.phone || o.user?.phone || "").replace(/"/g, '""');

      return [
        `"${uniqueId}"`,
        `"${formattedDate}"`,
        `"${formattedTime}"`,
        `"${customerName}"`,
        `"${phone}"`,
        itemsCount,
        `"${itemsSummary}"`,
        o.totalAmount || 0,
        `"${o.status}"`,
        `"${o.paymentStatus || "paid"}"`,
        `"${address}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pet_protocols_orders_${selectedDate || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Min selectable date: restaurant createdAt date
  const minSelectableDate = useMemo(() => {
    if (restaurantCreatedAt) {
      try {
        return new Date(restaurantCreatedAt).toISOString().split("T")[0];
      } catch (e) {}
    }
    return "2024-01-01";
  }, [restaurantCreatedAt]);

  const isTodaySelected = selectedDate === todayStr;

  const statusTabs = [
    { id: "all", label: "All Orders" },
    { id: "pending", label: "Pending" },
    { id: "preparing", label: "Preparing" },
    { id: "out_for_delivery", label: "Out for Delivery" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const statusBadgeStyles = {
    pending:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    preparing:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
    out_for_delivery:
      "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30",
    delivered:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
    cancelled:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  };

  return (
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      {/* Soft warm ambient background glow for light mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-100/60 via-amber-50/30 to-transparent dark:from-orange-500/5 dark:via-transparent dark:to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      <main className="pt-24 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6">
        
        {/* ── HEADER & LIVE STATUS CHIP ───────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
                Kitchen Display <span className="text-orange-500">System</span>
              </h1>
              
              {/* Professional Live Status Indicator */}
              <div
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs"
                title="Live connection active: Kitchen orders poll every 10 seconds automatically"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="tracking-wide">Live Kitchen Sync</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
              Live incoming kitchen tickets with instant alerts and date history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chime sound test / toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playChime(null, 1.0);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs active:scale-95 ${
                soundEnabled
                  ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30"
                  : "bg-white dark:bg-white/5 text-stone-500 border-stone-200 dark:border-white/10"
              }`}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{soundEnabled ? "Chime On 🔊" : "Chime Muted"}</span>
            </button>

            {/* Download Report Button */}
            <button
              onClick={downloadOrdersReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-white/10 text-xs font-bold transition shadow-xs active:scale-95"
              title="Download Orders CSV Report"
            >
              <Download size={13} className="text-orange-500" />
              <span>Export CSV</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchOrders(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-xs active:scale-95"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── DATE FILTER BAR & SEARCH BAR ────────────────────────── */}
        <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Date Picker bounded between restaurant creation date and today */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs">
              <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="font-bold text-stone-700 dark:text-stone-300 shrink-0">Order Date:</span>
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

            <button
              type="button"
              onClick={() => setSelectedDate("all")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedDate === "all"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300"
              }`}
            >
              All Dates
            </button>
          </div>

          {/* Search by Order ID or Customer Name */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="flex items-center flex-1 bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 focus-within:border-orange-500 transition">
              <Search className="w-4 h-4 text-stone-400 shrink-0 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order ID (#PET-...) or customer name..."
                className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 text-xs outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    fetchOrders(true);
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

        {/* ── NEW ORDER VISUAL NOTIFICATION BANNER ─────────────────── */}
        {newOrderAlert && (
          <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 rounded-2xl p-4 text-white shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl shrink-0">
                🛎️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded text-orange-200">
                    New Order Received!
                  </span>
                  <span className="font-mono font-bold text-xs">
                    {newOrderAlert.orderId}
                  </span>
                </div>
                <p className="text-xs text-orange-100 font-medium mt-0.5">
                  {newOrderAlert.customerName} ordered {newOrderAlert.itemCount} dish(es) •{" "}
                  <span className="font-bold text-white">₹{newOrderAlert.totalAmount}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setNewOrderAlert(null)}
              className="text-xs bg-black/30 hover:bg-black/40 text-white px-3 py-1.5 rounded-lg font-bold transition shrink-0"
            >
              Acknowledge ✓
            </button>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`p-3.5 rounded-xl flex items-center justify-between border text-xs font-semibold ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback({ type: "", message: "" })}
              className="opacity-70 hover:opacity-100 ml-4 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                filterStatus === tab.id
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-500/25"
                  : "bg-white/90 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/80 dark:border-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── ORDERS LIST ─────────────────────────────────────────── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-orange-500">
            <RefreshCw className="animate-spin w-8 h-8" />
            <p className="text-xs text-stone-500 font-semibold">Loading live kitchen orders...</p>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl bg-white/50 dark:bg-[#10141f]/50 p-8">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-stone-400" />
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              {searchQuery
                ? "No matching orders found"
                : isTodaySelected
                ? "No orders placed today yet"
                : `No orders found for ${selectedDate}`}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "Check your spelling or try searching by customer name."
                : isTodaySelected
                ? "Incoming customer orders for today will appear here in real-time."
                : "You can switch to another date or choose 'All Dates' above."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedOrders.map((order) => {
              const uniqueId = formatOrderId(order);
              const isNewlyArrived = highlightedOrderIds.has(order._id);

              return (
                <div
                  key={order._id}
                  className={`bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 transition-all duration-200 border ${
                    isNewlyArrived
                      ? "border-orange-500 shadow-lg shadow-orange-500/10 ring-2 ring-orange-500/20"
                      : "border-stone-200/90 dark:border-white/10 shadow-xs hover:border-orange-500/40"
                  }`}
                >
                  {/* Top Bar: Order ID, Timestamp, Status & Total */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-white/10">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-extrabold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 rounded-xl border border-orange-200 dark:border-orange-500/20">
                        {uniqueId}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-mono flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        • {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          statusBadgeStyles[order.status] || "bg-stone-200 text-stone-700"
                        }`}
                      >
                        ● {order.status.replace("_", " ")}
                      </span>
                      <span className="text-lg font-black text-stone-900 dark:text-white font-mono">
                        ₹{order.totalAmount}
                      </span>
                    </div>
                  </div>

                  {/* Order Details Body */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4">
                    {/* Customer & Address Details */}
                    <div className="space-y-2 bg-stone-50/70 dark:bg-white/[0.02] p-4 rounded-2xl border border-stone-200/60 dark:border-white/5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                        Customer Details
                      </span>
                      <div className="text-sm font-bold text-stone-900 dark:text-white">
                        {order.address?.fullName || order.user?.name || "Customer"}
                      </div>
                      {order.address?.phone && (
                        <div className="text-xs text-stone-600 dark:text-stone-300 flex items-center gap-2">
                          <Phone size={13} className="text-stone-400" />
                          <a
                            href={`tel:${order.address.phone}`}
                            className="font-mono hover:text-orange-500 underline"
                          >
                            {order.address.phone}
                          </a>
                        </div>
                      )}
                      {order.address?.street && (
                        <div className="text-xs text-stone-500 dark:text-stone-400 flex items-start gap-2">
                          <MapPin size={13} className="text-stone-400 shrink-0 mt-0.5" />
                          <span>
                            {order.address.street}, {order.address.city || ""}{" "}
                            {order.address.pincode ? `(${order.address.pincode})` : ""}
                          </span>
                        </div>
                      )}
                      {order.notes && (
                        <div className="text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-2 rounded-xl mt-2 border border-amber-200 dark:border-amber-500/20">
                          <strong>Note:</strong> {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Ordered Items List */}
                    <div className="space-y-2 bg-stone-50/70 dark:bg-white/[0.02] p-4 rounded-2xl border border-stone-200/60 dark:border-white/5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                        Ordered Items ({order.items?.length || 0})
                      </span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {order.items?.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-0.5 border-b border-stone-200/40 dark:border-white/5 last:border-0"
                          >
                            <span className="font-semibold text-stone-800 dark:text-stone-200">
                              <span className="text-orange-500 font-bold">{item.quantity}x</span>{" "}
                              {item.name}
                            </span>
                            <span className="font-mono text-stone-600 dark:text-stone-400">
                              ₹{(item.price || 0) * (item.quantity || 1)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs text-stone-500 border-t border-stone-200/60 dark:border-white/5">
                        <span>Payment: {order.paymentMethod || "Test Payment"}</span>
                        <span className="font-bold text-emerald-600 uppercase text-[10px]">
                          {order.paymentStatus || "Paid"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Controls for Status Advancement */}
                  <div className="pt-3 border-t border-stone-100 dark:border-white/10 flex flex-wrap items-center justify-end gap-2.5">
                    {order.status === "pending" && (
                      <>
                        <button
                          type="button"
                          disabled={updatingOrderId === order._id}
                          onClick={() => handleUpdateStatus(order._id, "preparing")}
                          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center gap-1.5"
                        >
                          <ChefHat size={14} />
                          <span>Start Preparing</span>
                        </button>
                        <button
                          type="button"
                          disabled={updatingOrderId === order._id}
                          onClick={() => handleUpdateStatus(order._id, "cancelled")}
                          className="px-3 py-2 rounded-xl border border-rose-500/20 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold text-xs transition active:scale-95"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {order.status === "preparing" && (
                      <button
                        type="button"
                        disabled={updatingOrderId === order._id}
                        onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center gap-1.5"
                      >
                        <Truck size={14} />
                        <span>Dispatch (Out for Delivery)</span>
                      </button>
                    )}

                    {order.status === "out_for_delivery" && (
                      <button
                        type="button"
                        disabled={updatingOrderId === order._id}
                        onClick={() => handleUpdateStatus(order._id, "delivered")}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center gap-1.5"
                      >
                        <CheckCircle size={14} />
                        <span>Mark Delivered</span>
                      </button>
                    )}

                    {order.status === "delivered" && (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={14} /> Order Fulfilled
                      </span>
                    )}

                    {order.status === "cancelled" && (
                      <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                        <XCircle size={14} /> Order Cancelled
                      </span>
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
