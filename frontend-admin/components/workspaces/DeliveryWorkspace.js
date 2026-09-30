"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Truck,
  Package,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  DollarSign,
  User,
  Check,
  Send,
  Calendar,
} from "lucide-react";

export default function DeliveryWorkspace({ restaurantName = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // "active", "preparing", "out_for_delivery", "delivered", "all"
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [deliveryNote, setDeliveryNote] = useState({});

  async function loadOrders(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError("");

      const res = await fetch("/api/restaurant/orders");
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        setError(data.message || data.error || "Failed to load delivery orders.");
      }
    } catch (err) {
      console.error("Delivery load error:", err);
      setError("Network error fetching live delivery tasks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders(true), 20000); // Polling every 20s
    return () => clearInterval(interval);
  }, []);

  async function updateOrderStatus(orderId, newStatus, extra = {}) {
    try {
      setUpdatingId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          status: newStatus,
          ...extra,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update locally
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, status: newStatus, ...extra } : o))
        );
      } else {
        alert(data.message || "Failed to update delivery status.");
      }
    } catch (err) {
      console.error("Update error:", err);
      alert("Network error updating delivery status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function markCashPaid(orderId) {
    if (!confirm("Confirm cash collected from customer?")) return;
    try {
      setUpdatingId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentStatus: "paid",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, paymentStatus: "paid" } : o))
        );
      } else {
        alert(data.message || "Failed to update payment status.");
      }
    } catch (err) {
      console.error("Payment update error:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter === "active") {
        if (o.status !== "preparing" && o.status !== "out_for_delivery") return false;
      } else if (statusFilter !== "all" && o.status !== statusFilter) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = o.address?.fullName?.toLowerCase().includes(q);
      const matchPhone = o.address?.phone?.includes(q);
      const matchOrderId = o.orderId?.toLowerCase().includes(q);
      const matchCity = o.address?.city?.toLowerCase().includes(q);
      const matchStreet = o.address?.street?.toLowerCase().includes(q);
      return matchName || matchPhone || matchOrderId || matchCity || matchStreet;
    });
  }, [orders, statusFilter, searchQuery]);

  // Operational metrics
  const metrics = useMemo(() => {
    const ready = orders.filter((o) => o.status === "preparing").length;
    const inTransit = orders.filter((o) => o.status === "out_for_delivery").length;
    const deliveredToday = orders.filter((o) => o.status === "delivered").length;
    const codToCollect = orders
      .filter((o) => o.status === "out_for_delivery" && o.paymentStatus !== "paid")
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    return { ready, inTransit, deliveredToday, codToCollect };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* ── TOP ROLE BANNER ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-500/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-md mb-3 border border-white/20">
              <Truck size={14} className="animate-pulse" />
              <span>DELIVERY & TRANSIT DISPATCH</span>
              {restaurantName && <span>• {restaurantName}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Delivery Operations Portal
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1.5 max-w-xl font-medium leading-relaxed">
              Complete visibility into order contents, customer addresses, contact numbers, and payment collection status for accurate fulfillment.
            </p>
          </div>

          <button
            onClick={() => loadOrders(false)}
            disabled={refreshing || loading}
            className="self-start md:self-auto inline-flex items-center gap-2 bg-white text-blue-900 hover:bg-blue-50 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition active:scale-95 cursor-pointer disabled:opacity-70"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Sync Live Orders"}</span>
          </button>
        </div>

        {/* ── 4 KEY METRICS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/15">
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider block">
              In Kitchen / Ready
            </span>
            <div className="text-2xl font-black mt-1 text-amber-300">{metrics.ready}</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider block">
              Out in Transit
            </span>
            <div className="text-2xl font-black mt-1 text-white">{metrics.inTransit}</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider block">
              Delivered
            </span>
            <div className="text-2xl font-black mt-1 text-emerald-300">{metrics.deliveredToday}</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider block">
              COD To Collect
            </span>
            <div className="text-2xl font-black mt-1 text-yellow-300">
              ₹{metrics.codToCollect.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ─────────────────────────────────── */}
      <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search customer, phone, order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs sm:text-sm text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "active", label: "Active Deliveries" },
            { id: "preparing", label: "Ready at Kitchen" },
            { id: "out_for_delivery", label: "Out in Transit" },
            { id: "delivered", label: "Delivered" },
            { id: "all", label: "All Tasks" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ORDERS LIST ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-stone-500 dark:text-stone-400">
          <RefreshCw size={28} className="animate-spin mx-auto text-blue-500 mb-3" />
          <p className="text-sm font-medium">Loading live delivery tasks...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-3xl p-12 text-center">
          <Package className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-900 dark:text-white">
            No delivery orders found
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No deliveries matching "${searchQuery}".`
              : "All delivery dispatches for this filter have been completed."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order._id;
            const isCOD = order.paymentMethod?.toLowerCase().includes("cash") || order.paymentMethod?.toLowerCase().includes("cod");
            const isPaid = order.paymentStatus === "paid" || order.paymentStatus === "test_paid";
            const isUpdating = updatingId === order._id;

            return (
              <div
                key={order._id}
                className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-blue-500/40"
              >
                {/* ── CARD HEADER ───────────────────────────────────── */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 dark:border-white/5">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Truck size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-white">
                          #{order.orderId || order._id.slice(-6).toUpperCase()}
                        </span>
                        {/* Status Badge */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            order.status === "out_for_delivery"
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 animate-pulse"
                              : order.status === "preparing"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : order.status === "delivered"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30"
                          }`}
                        >
                          {order.status === "out_for_delivery"
                            ? "🛵 OUT FOR DELIVERY"
                            : order.status === "preparing"
                            ? "🍳 KITCHEN PREPARING"
                            : order.status === "delivered"
                            ? "✅ DELIVERED"
                            : order.status?.toUpperCase()}
                        </span>

                        {/* Payment Status Pill */}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                            isPaid
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {isPaid ? "✓ PAID ONLINE" : "⚠️ COLLECT PAYMENT (COD)"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>•</span>
                        <span>{order.items?.length || 0} Dishes</span>
                        <span>•</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          Total: ₹{(order.totalAmount || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Button for Delivery Flow */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {order.status === "preparing" && (
                      <button
                        onClick={() => updateOrderStatus(order._id, "out_for_delivery")}
                        disabled={isUpdating}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Truck size={14} />
                        <span>Pick Up & Start Transit</span>
                      </button>
                    )}

                    {order.status === "out_for_delivery" && (
                      <button
                        onClick={() => updateOrderStatus(order._id, "delivered")}
                        disabled={isUpdating}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark Handed Over / Delivered</span>
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order._id)}
                      className="p-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? "Hide Details" : "View Full Details"}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* ── CARD SUMMARY ROW ──────────────────────────────── */}
                <div className="p-4 sm:p-5 bg-stone-50/50 dark:bg-white/[0.02] grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Delivery Location & Contact */}
                  <div className="bg-white dark:bg-[#151926] p-4 rounded-xl border border-stone-200/80 dark:border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xs text-stone-900 dark:text-white">
                        <MapPin size={14} className="text-blue-500" />
                        <span>Delivery Destination</span>
                      </div>
                      {order.address?.phone && (
                        <a
                          href={`tel:${order.address.phone}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-500/20 transition"
                        >
                          <Phone size={11} />
                          <span>Call Customer</span>
                        </a>
                      )}
                    </div>

                    <div className="text-xs text-stone-700 dark:text-stone-300">
                      <div className="font-bold text-stone-900 dark:text-white">
                        {order.address?.fullName || "Valued Customer"}
                      </div>
                      <p className="mt-0.5 leading-relaxed">
                        {order.address?.street}, {order.address?.city}
                        {order.address?.state ? `, ${order.address?.state}` : ""}
                        {order.address?.pincode ? ` - ${order.address?.pincode}` : ""}
                      </p>
                      {order.address?.phone && (
                        <div className="mt-1 font-semibold text-stone-600 dark:text-stone-400">
                          📞 {order.address.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Details (Mandatory for Delivery as specified) */}
                  <div className="bg-white dark:bg-[#151926] p-4 rounded-xl border border-stone-200/80 dark:border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xs text-stone-900 dark:text-white">
                        <Receipt size={14} className="text-emerald-500" />
                        <span>Payment & Settlement Details</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-stone-400">
                        {order.paymentMethod || "Online"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-medium">
                          Payment Status:
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            isPaid
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isPaid ? "Fully Paid (No Cash Required)" : "Unpaid / Cash on Delivery"}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-medium">
                          {isPaid ? "Order Total" : "Amount to Collect"}
                        </span>
                        <span className="text-base font-black text-stone-900 dark:text-white">
                          ₹{(order.totalAmount || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {!isPaid && (
                      <div className="pt-2 border-t border-stone-100 dark:border-white/5 flex items-center justify-between">
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                          ⚠️ Collect ₹{(order.totalAmount || 0).toFixed(2)} in Cash
                        </span>
                        <button
                          onClick={() => markCashPaid(order._id)}
                          disabled={isUpdating}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer"
                        >
                          Mark Cash Collected
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── EXPANDED FULL DETAILS (Order items & Instructions) ─── */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#10141f] space-y-4">
                    <h4 className="font-extrabold text-xs text-stone-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Package size={14} className="text-orange-500" />
                      <span>Order Items Breakdown & Special Instructions</span>
                    </h4>

                    {/* Items table */}
                    <div className="divide-y divide-stone-100 dark:divide-white/5 border border-stone-200/80 dark:border-white/5 rounded-xl overflow-hidden">
                      {order.items?.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-stone-50/50 dark:bg-white/[0.02] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-md bg-stone-200 dark:bg-white/10 font-black flex items-center justify-center text-xs">
                              {item.quantity}x
                            </span>
                            <div>
                              <span className="font-bold text-stone-900 dark:text-white">
                                {item.name}
                              </span>
                              {item.foodType && (
                                <span
                                  className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                    item.foodType === "veg"
                                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                      : "bg-red-500/10 text-red-600 border border-red-500/20"
                                  }`}
                                >
                                  {item.foodType}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-stone-800 dark:text-stone-200">
                            ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Customer Notes */}
                    {order.notes && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                        <span className="font-bold block">Delivery / Food Instructions:</span>
                        <p className="mt-0.5">{order.notes}</p>
                      </div>
                    )}

                    {/* Financial Breakdown */}
                    <div className="bg-stone-50 dark:bg-white/5 p-3 rounded-xl space-y-1 text-xs text-stone-600 dark:text-stone-400">
                      <div className="flex justify-between">
                        <span>Dishes Subtotal:</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          ₹{(order.subtotal || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Fee:</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200">
                          ₹{(order.deliveryFee || 0).toFixed(2)}
                        </span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Discount Applied:</span>
                          <span className="font-semibold">-₹{order.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-stone-200 dark:border-white/10 font-bold text-stone-900 dark:text-white text-sm">
                        <span>Final Payable:</span>
                        <span>₹{(order.totalAmount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
