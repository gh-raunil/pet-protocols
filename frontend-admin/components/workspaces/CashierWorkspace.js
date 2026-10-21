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
  XCircle,
  Check,
  AlertTriangle,
} from "lucide-react";

export default function CashierWorkspace({ restaurantName = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "unpaid", "paid", "cancelled"
  const [updatingId, setUpdatingId] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [restaurantObj, setRestaurantObj] = useState(null);

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
        if (data.restaurant) {
          setRestaurantObj(data.restaurant);
        }
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

  // Keyboard shortcut listener for receipt printing & modal closing
  useEffect(() => {
    function handleKeyDown(e) {
      if (!receiptOrder) return;
      if (e.key === "Escape") {
        setReceiptOrder(null);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        window.print();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [receiptOrder]);

  async function handleSettlePayment(orderId, paymentMethod) {
    const targetOrder = orders.find((o) => o._id === orderId);
    if (targetOrder?.status === "cancelled") {
      alert("Cancelled orders cannot be settled.");
      setSettlingOrder(null);
      return;
    }

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

  const metrics = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== "cancelled");
    const cancelledOrders = orders.filter((o) => o.status === "cancelled");

    const totalCollected = orders
      .filter((o) => o.paymentStatus === "paid" || o.paymentStatus === "test_paid")
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    const pendingCollection = activeOrders
      .filter((o) => o.paymentStatus !== "paid" && o.paymentStatus !== "test_paid")
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    const settledCount = orders.filter(
      (o) => o.paymentStatus === "paid" || o.paymentStatus === "test_paid"
    ).length;

    const unpaidCount = activeOrders.filter(
      (o) => o.paymentStatus !== "paid" && o.paymentStatus !== "test_paid"
    ).length;

    const cancelledCount = cancelledOrders.length;

    return { totalCollected, pendingCollection, settledCount, unpaidCount, cancelledCount };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const isCancelled = o.status === "cancelled";
      const isPaid = o.paymentStatus === "paid" || o.paymentStatus === "test_paid";

      if (statusFilter === "unpaid") {
        if (isPaid || isCancelled) return false;
      } else if (statusFilter === "paid") {
        if (!isPaid) return false;
      } else if (statusFilter === "cancelled") {
        if (!isCancelled) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const orderIdClean = (o.orderId || "").toLowerCase();
      const customerName = (o.address?.fullName || o.user?.name || "").toLowerCase();
      const phone = (o.address?.phone || o.user?.phone || "").toLowerCase();
      const dishes = (o.items || []).map((it) => it.name?.toLowerCase()).join(" ");

      return (
        orderIdClean.includes(q) ||
        customerName.includes(q) ||
        phone.includes(q) ||
        dishes.includes(q)
      );
    });
  }, [orders, statusFilter, searchQuery]);

  const changeDue = useMemo(() => {
    if (!settlingOrder || !tenderedAmount) return 0;
    const tendered = parseFloat(tenderedAmount) || 0;
    const total = settlingOrder.totalAmount || 0;
    return Math.max(0, tendered - total);
  }, [settlingOrder, tenderedAmount]);

  const activeRestaurantName =
    restaurantObj?.name || restaurantName || "पेट Protocols Kitchen";

  return (
    <>
      {/* ── MAIN CASHIER WORKSPACE (Hidden during @media print) ─────── */}
      <div className="space-y-6 no-print print:hidden">
        {/* ── TOP CASHIER OPERATIONAL HEADER ──────────────────────── */}
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-2 border border-emerald-500/20">
                <Receipt size={14} className="text-emerald-500" />
                <span>CASHIER & BILLING REGISTER</span>
                {activeRestaurantName && <span>• {activeRestaurantName}</span>}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-white">
                Front Counter POS Terminal
              </h1>
              <p className="text-stone-500 dark:text-stone-400 text-xs sm:text-sm mt-1 max-w-xl">
                Order billing, cash collection, digital settlement, and tax invoice receipt printing.
              </p>
            </div>

            <button
              onClick={() => loadOrders(false)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-70 self-start md:self-auto"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Refreshing..." : "Sync Billing"}</span>
            </button>
          </div>

          {/* ── 4 STATS CARDS ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5 pt-5 border-t border-stone-100 dark:border-white/5">
            <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Total Revenue Settled
              </span>
              <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{metrics.totalCollected.toFixed(2)}
              </div>
            </div>
            <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Pending Settlement
              </span>
              <div className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400 font-mono">
                ₹{metrics.pendingCollection.toFixed(2)}
              </div>
            </div>
            <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                Bills Settled
              </span>
              <div className="text-2xl font-black mt-1 text-stone-900 dark:text-white font-mono">
                {metrics.settledCount}
              </div>
            </div>
            <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                Unpaid Tickets
              </span>
              <div className="text-2xl font-black mt-1 text-rose-600 dark:text-rose-400 font-mono">
                {metrics.unpaidCount}
              </div>
            </div>
          </div>
        </div>

        {/* ── FILTER & SEARCH TOOLBAR ───────────────────────────────── */}
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search invoice #, customer name, dish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs sm:text-sm text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
            {[
              { id: "all", label: `All Bills (${orders.length})` },
              { id: "unpaid", label: `Unsettled (${metrics.unpaidCount})` },
              { id: "paid", label: `Settled (${metrics.settledCount})` },
              { id: "cancelled", label: `Cancelled (${metrics.cancelledCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? tab.id === "cancelled"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-emerald-600 text-white shadow-xs"
                    : "bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BILLING ORDERS TABLE ──────────────────────────────────── */}
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
                    const isCancelled = order.status === "cancelled";
                    const isPaid =
                      order.paymentStatus === "paid" || order.paymentStatus === "test_paid";
                    const isUpdating = updatingId === order._id;

                    return (
                      <tr
                        key={order._id}
                        className={`transition-colors ${
                          isCancelled
                            ? "bg-rose-500/[0.02] hover:bg-rose-500/[0.05]"
                            : "hover:bg-stone-50/70 dark:hover:bg-white/[0.02]"
                        }`}
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
                          {order.paymentMethod || "Cash on Delivery (COD)"}
                        </td>

                        {/* ── PAYMENT STATUS BADGE ── */}
                        <td className="py-3.5 px-4">
                          {isCancelled ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <XCircle size={11} className="text-rose-500" />
                              CANCELLED
                            </span>
                          ) : isPaid ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 size={11} />
                              PAID & SETTLED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                              <AlertCircle size={11} />
                              UNPAID / DUE
                            </span>
                          )}
                        </td>

                        {/* ── REGISTER ACTION ── */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isCancelled ? (
                              <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-white/5 text-stone-400 dark:text-stone-500 text-[11px] font-semibold flex items-center gap-1 border border-stone-200/50 dark:border-white/5">
                                <X size={12} />
                                Order Cancelled
                              </span>
                            ) : !isPaid ? (
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
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                                <CheckCircle2 size={13} />
                                Settled
                              </span>
                            )}

                            <button
                              onClick={() => setReceiptOrder(order)}
                              className="p-1.5 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition cursor-pointer"
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

        {/* ── SETTLEMENT MODAL (Cash Calculator) ──────────────────────── */}
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
      </div>

      {/* ── PROFESSIONAL THERMAL RECEIPT MODAL & PRINT CONTAINER ───── */}
      {receiptOrder && (
        <div className="pos-receipt-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="pos-receipt-modal relative bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl my-auto space-y-4">
            {/* Modal Controls Header (Hidden in @media print) */}
            <div className="no-print print:hidden flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Printer className="text-emerald-500 w-5 h-5" />
                <div>
                  <h3 className="font-extrabold text-sm text-stone-900 dark:text-white">
                    Tax Invoice & Receipt Slip
                  </h3>
                  <p className="text-[10px] text-stone-400">
                    Standard 80mm POS Thermal Receipt
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                  title="Print Thermal Receipt (Ctrl + P)"
                >
                  <Printer size={13} />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setReceiptOrder(null)}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/10 transition cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* ── THERMAL RECEIPT PAPER PREVIEW & PRINT CARD ────────── */}
            <div className="pos-receipt-paper bg-white text-stone-900 border border-stone-300/80 rounded-xl p-4 sm:p-5 shadow-inner font-mono text-xs select-none">
              {/* Receipt Header */}
              <div className="text-center space-y-1 pb-2">
                <h2 className="font-black text-base tracking-tight uppercase text-black">
                  {receiptOrder.restaurant?.name || activeRestaurantName}
                </h2>
                <div className="text-[10px] font-semibold text-stone-600 uppercase tracking-widest">
                  OFFICIAL TAX INVOICE / CASH MEMO
                </div>
                {receiptOrder.restaurant?.address?.street && (
                  <p className="text-[10px] text-stone-500 leading-tight">
                    {receiptOrder.restaurant.address.street}
                    {receiptOrder.restaurant.address.city ? `, ${receiptOrder.restaurant.address.city}` : ""}
                  </p>
                )}
                {receiptOrder.restaurant?.phone && (
                  <p className="text-[10px] text-stone-500">
                    Phone: {receiptOrder.restaurant.phone}
                  </p>
                )}
                <p className="text-[10px] text-stone-500">
                  POS Front Counter Register #1
                </p>
              </div>

              {/* Dotted Divider */}
              <div className="border-b border-dashed border-stone-400 my-2" />

              {/* Order Metadata */}
              <div className="space-y-0.5 text-[11px] text-stone-700">
                <div className="flex justify-between">
                  <span className="font-semibold text-stone-500">Order ID:</span>
                  <span className="font-bold text-black font-mono">
                    #{receiptOrder.orderId || receiptOrder._id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-stone-500">Date & Time:</span>
                  <span className="text-stone-800">
                    {new Date(receiptOrder.createdAt).toLocaleDateString([], {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    {new Date(receiptOrder.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-stone-500">Customer:</span>
                  <span className="font-bold text-black">
                    {receiptOrder.address?.fullName || receiptOrder.user?.name || "Walk-in Guest"}
                  </span>
                </div>
                {(receiptOrder.address?.phone || receiptOrder.user?.phone) && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-stone-500">Phone:</span>
                    <span className="text-stone-800 font-mono">
                      {receiptOrder.address?.phone || receiptOrder.user?.phone}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-semibold text-stone-500">Order Channel:</span>
                  <span className="font-semibold text-stone-800 uppercase text-[10px]">
                    {receiptOrder.address?.addressType || "Delivery / Store Pickup"}
                  </span>
                </div>
              </div>

              {/* ── PROMINENT CANCELLED / VOID BANNER IF ORDER IS CANCELLED ── */}
              {receiptOrder.status === "cancelled" && (
                <div className="my-2.5 p-2 rounded-lg bg-rose-50 border-2 border-dashed border-rose-500 text-center">
                  <div className="text-xs font-black text-rose-700 uppercase tracking-wider">
                    *** ORDER CANCELLED / VOID BILL ***
                  </div>
                  {receiptOrder.cancellationReason && (
                    <div className="text-[10px] text-rose-600 mt-0.5">
                      Reason: {receiptOrder.cancellationReason}
                    </div>
                  )}
                  <div className="text-[9px] text-stone-500 mt-0.5">
                    VOID SLIP — NOT VALID FOR PAYMENT OR TAX RECONCILIATION
                  </div>
                </div>
              )}

              {/* Dotted Divider */}
              <div className="border-b border-dashed border-stone-400 my-2" />

              {/* Itemized Table Header */}
              <div className="flex justify-between text-[10px] font-bold uppercase text-stone-500 pb-1 border-b border-stone-300">
                <span className="w-10">QTY</span>
                <span className="flex-1 text-left">ITEM</span>
                <span className="w-16 text-right">AMOUNT</span>
              </div>

              {/* Itemized List */}
              <div className="divide-y divide-stone-200/70 text-[11px] py-1">
                {receiptOrder.items?.map((item, idx) => (
                  <div key={idx} className="py-1.5 flex justify-between items-start gap-1">
                    <span className="w-10 font-bold text-black">{item.quantity}×</span>
                    <div className="flex-1 text-left">
                      <span className="font-semibold text-black leading-tight block">
                        {item.name}
                      </span>
                      {Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 && (
                        <span className="text-[9px] text-stone-500 block">
                          {item.selectedOptions.map((o) => o.name || o).join(", ")}
                        </span>
                      )}
                    </div>
                    <span className="w-16 text-right font-bold text-black font-mono">
                      ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Dotted Divider */}
              <div className="border-b border-dashed border-stone-400 my-2" />

              {/* Summary Calculations */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{(receiptOrder.subtotal || 0).toFixed(2)}</span>
                </div>
                {(receiptOrder.deliveryFee || 0) > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Delivery Charge:</span>
                    <span className="font-mono">₹{(receiptOrder.deliveryFee || 0).toFixed(2)}</span>
                  </div>
                )}
                {(receiptOrder.discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount / Savings:</span>
                    <span className="font-mono">-₹{(receiptOrder.discount || 0).toFixed(2)}</span>
                  </div>
                )}

                {/* Double Line for Grand Total */}
                <div className="border-b-2 border-stone-900 my-1.5" />

                <div className="flex justify-between items-center text-sm font-black text-black pt-0.5">
                  <span className="uppercase tracking-tight">TOTAL AMOUNT:</span>
                  <span className="text-base font-mono">
                    ₹{(receiptOrder.totalAmount || 0).toFixed(2)}
                  </span>
                </div>

                <div className="border-b-2 border-stone-900 my-1.5" />
              </div>

              {/* Payment Details */}
              <div className="pt-1.5 space-y-1 text-[11px]">
                <div className="flex justify-between text-stone-600">
                  <span>Payment Mode:</span>
                  <span className="font-bold text-black">
                    {receiptOrder.paymentMethod || "Cash on Delivery (COD)"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="font-semibold text-stone-600">Payment Status:</span>
                  <span
                    className={`font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-sm border ${
                      receiptOrder.status === "cancelled"
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : receiptOrder.paymentStatus === "paid" || receiptOrder.paymentStatus === "test_paid"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : "bg-amber-100 text-amber-900 border-amber-300"
                    }`}
                  >
                    {receiptOrder.status === "cancelled"
                      ? "CANCELLED (VOID)"
                      : receiptOrder.paymentStatus === "paid" || receiptOrder.paymentStatus === "test_paid"
                      ? "PAID & SETTLED"
                      : "UNPAID / PENDING"}
                  </span>
                </div>
              </div>

              {/* Dotted Divider */}
              <div className="border-b border-dashed border-stone-400 my-2.5" />

              {/* Barcode Mockup Aesthetic */}
              <div className="text-center py-1">
                <div className="inline-flex items-center gap-[2px] h-7 px-4 justify-center">
                  {[3, 1, 4, 1, 2, 5, 1, 3, 2, 4, 1, 3, 1, 4, 2, 3, 1, 5, 2, 1, 3, 4, 1, 2, 3].map(
                    (w, i) => (
                      <span
                        key={i}
                        className="bg-black inline-block h-full"
                        style={{ width: `${w}px` }}
                      />
                    )
                  )}
                </div>
                <p className="text-[9px] font-mono tracking-widest text-stone-500 mt-1 uppercase">
                  *{receiptOrder.orderId || receiptOrder._id}*
                </p>
              </div>

              {/* Receipt Footer */}
              <div className="text-center text-[10px] text-stone-500 pt-1 space-y-0.5">
                <p className="font-bold text-stone-700">*** THANK YOU FOR YOUR VISIT! ***</p>
                <p>Please visit us again • Have a wonderful day</p>
                <p className="text-[9px] text-stone-400">
                  Powered by पेट Protocols Cloud POS Kitchen OS
                </p>
              </div>
            </div>

            {/* Bottom Actions Bar (Hidden in @media print) */}
            <div className="no-print print:hidden flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 font-bold text-xs transition cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Thermal Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
