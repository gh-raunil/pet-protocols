"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Receipt,
  DollarSign,
  CreditCard,
  Banknote,
  Search,
  CheckCircle2,
  AlertCircle,
  Printer,
  RefreshCw,
  Clock,
  User,
  ShoppingBag,
  X,
  FileText,
} from "lucide-react";

export default function CashierWorkspace({ restaurantName = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);

  // Cash payment helper modal state
  const [settlingOrder, setSettlingOrder] = useState(null);
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("Cash");

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
        setError(data.message || data.error || "Failed to load orders.");
      }
    } catch (err) {
      console.error("Cashier load error:", err);
      setError("Network error fetching cashier orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => loadOrders(true), 20000);
    return () => clearInterval(interval);
  }, []);

  async function handleSettlePayment(orderId, paymentMethod) {
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
        setSettlingOrder(null);
      } else {
        alert(data.message || "Failed to settle payment.");
      }
    } catch (err) {
      console.error("Settle error:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === "unpaid") {
        if (o.paymentStatus === "paid" || o.paymentStatus === "test_paid") return false;
      } else if (statusFilter === "paid") {
        if (o.paymentStatus !== "paid" && o.paymentStatus !== "test_paid") return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        o.orderId?.toLowerCase().includes(q) ||
        o.address?.fullName?.toLowerCase().includes(q) ||
        o.address?.phone?.includes(q)
      );
    });
  }, [orders, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    const totalCollected = orders
      .filter((o) => o.paymentStatus === "paid" || o.paymentStatus === "test_paid")
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    const pendingCollection = orders
      .filter((o) => o.paymentStatus !== "paid" && o.paymentStatus !== "test_paid")
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    const settledCount = orders.filter(
      (o) => o.paymentStatus === "paid" || o.paymentStatus === "test_paid"
    ).length;

    const unpaidCount = orders.filter(
      (o) => o.paymentStatus !== "paid" && o.paymentStatus !== "test_paid"
    ).length;

    return { totalCollected, pendingCollection, settledCount, unpaidCount };
  }, [orders]);

  const changeDue = useMemo(() => {
    if (!settlingOrder || !tenderedAmount) return 0;
    const tendered = parseFloat(tenderedAmount) || 0;
    const total = settlingOrder.totalAmount || 0;
    return Math.max(0, tendered - total);
  }, [settlingOrder, tenderedAmount]);

  return (
    <div className="space-y-6">
      {/* ── TOP CASHIER BANNER ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-green-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-500/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-md mb-3 border border-white/20">
              <Receipt size={14} />
              <span>CASHIER & BILLING REGISTER</span>
              {restaurantName && <span>• {restaurantName}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Front Counter POS Terminal
            </h1>
            <p className="text-emerald-100 text-xs sm:text-sm mt-1.5 max-w-xl font-medium leading-relaxed">
              Order billing, cash collection, digital settlement, and tax invoice receipt printing.
            </p>
          </div>

          <button
            onClick={() => loadOrders(false)}
            disabled={refreshing || loading}
            className="self-start md:self-auto inline-flex items-center gap-2 bg-white text-emerald-950 hover:bg-emerald-50 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition active:scale-95 cursor-pointer disabled:opacity-70"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Sync Billing"}</span>
          </button>
        </div>

        {/* ── 4 STATS CARDS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/15">
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
              Total Revenue Settled
            </span>
            <div className="text-2xl font-black mt-1 text-white">
              ₹{metrics.totalCollected.toFixed(2)}
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
              Pending Settlement
            </span>
            <div className="text-2xl font-black mt-1 text-yellow-300">
              ₹{metrics.pendingCollection.toFixed(2)}
            </div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
              Bills Settled
            </span>
            <div className="text-2xl font-black mt-1 text-white">{metrics.settledCount}</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3.5 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
              Unpaid Tickets
            </span>
            <div className="text-2xl font-black mt-1 text-amber-300">{metrics.unpaidCount}</div>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ─────────────────────────────────── */}
      <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search invoice #, customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs sm:text-sm text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
          {[
            { id: "all", label: "All Bills" },
            { id: "unpaid", label: `Unsettled (${metrics.unpaidCount})` },
            { id: "paid", label: `Settled (${metrics.settledCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── BILLING ORDERS TABLE ────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-stone-500 dark:text-stone-400">
          <RefreshCw size={28} className="animate-spin mx-auto text-emerald-500 mb-3" />
          <p className="text-sm font-medium">Loading register bills...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-3xl p-12 text-center">
          <Receipt className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-900 dark:text-white">
            No bills found in this view
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No invoices matching "${searchQuery}".`
              : "Register has all transactions recorded."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 dark:bg-white/5 border-b border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice / Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Dishes</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4 text-right">Register Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-white/5">
                {filteredOrders.map((order) => {
                  const isPaid =
                    order.paymentStatus === "paid" || order.paymentStatus === "test_paid";
                  const isUpdating = updatingId === order._id;

                  return (
                    <tr
                      key={order._id}
                      className="hover:bg-stone-50/70 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white">
                        #{order.orderId || order._id.slice(-6).toUpperCase()}
                        <span className="block text-[10px] font-normal text-stone-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-stone-800 dark:text-stone-200">
                          {order.address?.fullName || "Walk-in Guest"}
                        </div>
                        {order.address?.phone && (
                          <span className="text-[11px] text-stone-400 block">
                            {order.address.phone}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-stone-700 dark:text-stone-300">
                          {order.items?.length || 0} items
                        </span>
                        <span className="block text-[10px] text-stone-400 truncate max-w-[150px]">
                          {order.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-black text-stone-900 dark:text-white text-sm">
                        ₹{(order.totalAmount || 0).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-stone-600 dark:text-stone-300">
                        {order.paymentMethod || "Online"}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                            isPaid
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {isPaid ? "Paid & Settled" : "Unpaid / Due"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid ? (
                            <button
                              onClick={() => {
                                setSettlingOrder(order);
                                setTenderedAmount((order.totalAmount || 0).toString());
                              }}
                              disabled={isUpdating}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              Settle Bill
                            </button>
                          ) : (
                            <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              Settled
                            </span>
                          )}

                          <button
                            onClick={() => setReceiptOrder(order)}
                            className="p-1.5 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition"
                            title="Print / View Receipt"
                          >
                            <Printer size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SETTLEMENT MODAL (Cash Calculator) ───────────────────────── */}
      {settlingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Receipt className="text-emerald-500 w-5 h-5" />
                <h3 className="font-extrabold text-base text-stone-900 dark:text-white">
                  Settle Bill #{settlingOrder.orderId || settlingOrder._id.slice(-6).toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setSettlingOrder(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-stone-50 dark:bg-white/5 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-xs text-stone-600 dark:text-stone-400 font-semibold">
                  Total Bill Amount:
                </span>
                <span className="text-2xl font-black text-stone-900 dark:text-white">
                  ₹{(settlingOrder.totalAmount || 0).toFixed(2)}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["Cash", "Card", "UPI / QR"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMethod(m)}
                      className={`p-2 rounded-xl text-xs font-bold border transition ${
                        selectedMethod === m
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash tendered calculator if Cash */}
              {selectedMethod === "Cash" && (
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                    Cash Tendered by Customer
                  </label>
                  <input
                    type="number"
                    value={tenderedAmount}
                    onChange={(e) => setTenderedAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-sm font-black text-stone-900 dark:text-white"
                  />
                  <div className="flex justify-between items-center text-xs font-bold p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                    <span>Change Due to Customer:</span>
                    <span className="text-base font-black">₹{changeDue.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-stone-200 dark:border-white/10 flex gap-2">
              <button
                type="button"
                onClick={() => setSettlingOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSettlePayment(settlingOrder._id, selectedMethod)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIPT MODAL ───────────────────────────────────────────── */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-white/10">
              <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
                TAX INVOICE RECEIPT
              </span>
              <button
                onClick={() => setReceiptOrder(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-center pb-2">
              <h4 className="font-extrabold text-base text-stone-900 dark:text-white">
                {restaurantName || "Pet Protocols Kitchen"}
              </h4>
              <p className="text-[11px] text-stone-400">
                Order #{receiptOrder.orderId || receiptOrder._id.slice(-6).toUpperCase()}
              </p>
              <p className="text-[11px] text-stone-400">
                {new Date(receiptOrder.createdAt).toLocaleString()}
              </p>
            </div>

            {/* Items */}
            <div className="divide-y divide-stone-100 dark:divide-white/5 text-xs">
              {receiptOrder.items?.map((item, idx) => (
                <div key={idx} className="py-1.5 flex justify-between">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span className="font-bold">
                    ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="pt-2 border-t border-dashed border-stone-300 dark:border-white/20 text-xs space-y-1">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal:</span>
                <span>₹{(receiptOrder.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Delivery:</span>
                <span>₹{(receiptOrder.deliveryFee || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-stone-900 dark:text-white pt-1 border-t">
                <span>Total Amount:</span>
                <span>₹{(receiptOrder.totalAmount || 0).toFixed(2)}</span>
              </div>
              <div className="text-center pt-2">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-extrabold text-[10px]">
                  STATUS: {receiptOrder.paymentStatus?.toUpperCase() || "PAID"}
                </span>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Thermal Receipt</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
