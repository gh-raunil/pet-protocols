"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShoppingBag,
  Search,
  RefreshCw,
  Building,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Truck,
  ChefHat,
  ChevronDown,
  X,
  CreditCard,
  MapPin,
} from "lucide-react";

export default function OrdersManager({ restaurants = [] }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [restaurantFilter, setRestaurantFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  async function loadOrders(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (restaurantFilter !== "all") params.set("restaurantId", restaurantFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/superadmin/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to load orders." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Network error loading platform orders." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [statusFilter, restaurantFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadOrders();
  };

  const statusColors = {
    pending: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
    preparing: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
    out_for_delivery: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/40",
    delivered: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
    cancelled: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40",
  };

  const totalGMV = orders.reduce(
    (sum, o) => sum + (o.status !== "cancelled" ? o.totalAmount || 0 : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* ── HEADER & STATS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Platform-Wide Orders</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time multi-restaurant dispatch, payment reconciliation, and kitchen order pipeline.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadOrders(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* ── QUICK METRICS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Orders (Loaded)</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {orders.length}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Across {restaurants.length} active partners
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform GMV</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{totalGMV.toLocaleString("en-IN")}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Excluding cancelled orders
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivered Orders</p>
          <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {orders.filter((o) => o.status === "delivered").length}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {orders.length > 0
              ? `${Math.round((orders.filter((o) => o.status === "delivered").length / orders.length) * 100)}% fulfillment rate`
              : "0%"}
          </span>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm"
      >
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order ID, customer name, or phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Restaurant Filter */}
          <select
            value={restaurantFilter}
            onChange={(e) => setRestaurantFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="all">All Restaurants</option>
            {restaurants.map((r) => (
              <option key={r._id || r.id} value={r._id || r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none capitalize"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition shadow-xs"
          >
            Filter
          </button>
        </div>
      </form>

      {/* ── ORDERS TABLE ── */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold">Loading platform orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-400">
          <ShoppingBag size={32} className="mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Orders Found</h3>
          <p className="text-xs mt-1">Try clearing your filters or search term.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Restaurant</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {orders.map((order) => (
                <tr
                  key={order._id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                    {order.orderId || order._id?.slice(-8)}
                  </td>

                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Building size={13} className="text-indigo-500 shrink-0" />
                      <span>{order.restaurant?.name || "Kitchen"}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {order.address?.fullName || order.user?.name || "Guest"}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {order.address?.phone || order.user?.phone || "—"}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-black font-mono text-slate-900 dark:text-white">
                    ₹{order.totalAmount}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <CreditCard size={11} className="text-slate-400" />
                      <span>{order.paymentMethod || "COD"}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                        statusColors[order.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {order.status?.replace("_", " ")}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ORDER DETAIL MODAL ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Order Details
                </h3>
                <p className="text-xs font-mono text-slate-400">{selectedOrder.orderId}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs sm:text-sm">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Building size={14} className="text-indigo-500" />
                  <span>{selectedOrder.restaurant?.name}</span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <MapPin size={12} />
                  <span>
                    {selectedOrder.address?.street}, {selectedOrder.address?.city} - {selectedOrder.address?.pincode}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Items ({selectedOrder.items?.length || 0})
                </h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="font-medium text-slate-900 dark:text-white">
                        <span className="font-bold text-indigo-600 mr-2">{item.quantity}x</span>
                        {item.name}
                      </div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-base font-black text-slate-900 dark:text-white">
                <span>Total Amount:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{selectedOrder.totalAmount}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition"
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
