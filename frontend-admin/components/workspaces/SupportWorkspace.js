"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Headphones,
  Search,
  Phone,
  MapPin,
  Clock,
  Package,
  Receipt,
  Truck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  User,
} from "lucide-react";

export default function SupportWorkspace({ restaurantName = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [supportNote, setSupportNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function loadOrders(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError("");

      const res = await fetch("/api/restaurant/orders");
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
        if (!selectedOrder && data.orders.length > 0) {
          setSelectedOrder(data.orders[0]);
        }
      } else {
        setError(data.message || data.error || "Failed to load orders.");
      }
    } catch (err) {
      console.error("Support load error:", err);
      setError("Network error fetching orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function handleSaveNote() {
    if (!selectedOrder || !supportNote.trim()) return;
    try {
      setSavingNote(true);
      const updatedNotes = selectedOrder.notes
        ? `${selectedOrder.notes} | [Support ${new Date().toLocaleTimeString()}]: ${supportNote}`
        : `[Support ${new Date().toLocaleTimeString()}]: ${supportNote}`;

      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder._id,
          notes: updatedNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === selectedOrder._id ? { ...o, notes: updatedNotes } : o))
        );
        setSelectedOrder((prev) => ({ ...prev, notes: updatedNotes }));
        setSupportNote("");
      } else {
        alert(data.message || "Failed to save support note.");
      }
    } catch (err) {
      console.error("Save note error:", err);
    } finally {
      setSavingNote(false);
    }
  }

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.orderId?.toLowerCase().includes(q) ||
        o.address?.fullName?.toLowerCase().includes(q) ||
        o.address?.phone?.includes(q)
    );
  }, [orders, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── TOP SUPPORT BANNER ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-pink-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-rose-500/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-md mb-3 border border-white/20">
              <Headphones size={14} />
              <span>CUSTOMER SUPPORT & ORDER LOOKUP</span>
              {restaurantName && <span>• {restaurantName}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Customer Inquiry & Issue Resolution
            </h1>
            <p className="text-rose-100 text-xs sm:text-sm mt-1.5 max-w-xl font-medium leading-relaxed">
              Fast order tracking, phone lookup, customer verification, and live order status timeline.
            </p>
          </div>

          <button
            onClick={() => loadOrders(false)}
            disabled={refreshing || loading}
            className="self-start md:self-auto inline-flex items-center gap-2 bg-white text-rose-950 hover:bg-rose-50 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition active:scale-95 cursor-pointer disabled:opacity-70"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Sync Orders"}</span>
          </button>
        </div>
      </div>

      {/* ── SEARCH & TWO COLUMN WORKSPACE ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Orders list search */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-3 shadow-xs">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Lookup phone, customer or order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-2 shadow-xs max-h-[600px] overflow-y-auto divide-y divide-stone-100 dark:divide-white/5">
            {loading ? (
              <div className="py-12 text-center text-stone-400 text-xs">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-xs">No matching orders found.</div>
            ) : (
              filteredOrders.map((o) => (
                <button
                  key={o._id}
                  onClick={() => setSelectedOrder(o)}
                  className={`w-full text-left p-3 rounded-xl transition cursor-pointer ${
                    selectedOrder?._id === o._id
                      ? "bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40"
                      : "hover:bg-stone-50 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-stone-900 dark:text-white">
                      #{o.orderId || o._id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-stone-300">
                      {o.status?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    {o.address?.fullName || "Guest Customer"}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1">
                    <span>📞 {o.address?.phone || "No phone"}</span>
                    <span className="font-bold text-stone-700 dark:text-stone-300">
                      ₹{(o.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Detailed Order Inspection & Support Log */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Order Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-stone-900 dark:text-white">
                      Order #{selectedOrder.orderId || selectedOrder._id.slice(-6).toUpperCase()}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                      {selectedOrder.status?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>

                {selectedOrder.address?.phone && (
                  <a
                    href={`tel:${selectedOrder.address.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                  >
                    <Phone size={13} />
                    <span>Call Customer</span>
                  </a>
                )}
              </div>

              {/* Customer & Address Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/60 dark:border-white/5 text-xs space-y-1">
                  <span className="font-bold text-stone-500 block uppercase tracking-wider text-[10px]">
                    Customer Details
                  </span>
                  <div className="font-bold text-stone-900 dark:text-white">
                    {selectedOrder.address?.fullName}
                  </div>
                  <div className="text-stone-600 dark:text-stone-300">
                    Phone: {selectedOrder.address?.phone}
                  </div>
                  {selectedOrder.user?.email && (
                    <div className="text-stone-400">Email: {selectedOrder.user.email}</div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/60 dark:border-white/5 text-xs space-y-1">
                  <span className="font-bold text-stone-500 block uppercase tracking-wider text-[10px]">
                    Delivery Address
                  </span>
                  <p className="text-stone-700 dark:text-stone-300">
                    {selectedOrder.address?.street}, {selectedOrder.address?.city}
                    {selectedOrder.address?.state ? `, ${selectedOrder.address?.state}` : ""}
                    {selectedOrder.address?.pincode ? ` - ${selectedOrder.address?.pincode}` : ""}
                  </p>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2">
                <span className="font-bold text-xs text-stone-900 dark:text-white uppercase tracking-wider block">
                  Items Ordered
                </span>
                <div className="divide-y divide-stone-100 dark:divide-white/5 border border-stone-200/80 dark:border-white/5 rounded-xl overflow-hidden text-xs">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between bg-stone-50/30 dark:bg-white/[0.01]">
                      <span>
                        {item.quantity}× {item.name}
                      </span>
                      <span className="font-bold text-stone-900 dark:text-white">
                        ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="p-2.5 bg-stone-50 dark:bg-white/5 flex justify-between font-bold text-stone-900 dark:text-white">
                    <span>Total Amount Paid / Due:</span>
                    <span>₹{(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Support Notes Log */}
              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-white/5">
                <span className="font-bold text-xs text-stone-900 dark:text-white uppercase tracking-wider block">
                  Order & Support Log
                </span>
                {selectedOrder.notes ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-900 dark:text-amber-200">
                    {selectedOrder.notes}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">No support notes recorded yet.</p>
                )}

                {/* Add note input */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Append support issue note (e.g. called customer, requested sauce)..."
                    value={supportNote}
                    onChange={(e) => setSupportNote(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-800 dark:text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote || !supportNote.trim()}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingNote ? "Saving..." : "Add Note"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-12 text-center text-stone-400 text-xs">
              Select an order from the left list to view support details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
