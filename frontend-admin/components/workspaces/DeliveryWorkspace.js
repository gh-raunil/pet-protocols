"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
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
  Navigation,
  Radio,
  Signal,
  ShieldAlert,
  Compass,
  Gauge,
  AlertTriangle,
  Power,
  WifiOff,
  Lock,
  Banknote,
  Wallet,
  FileSpreadsheet,
  BadgeCheck,
} from "lucide-react";
import {
  useDeliveryGpsTransmitter,
  isPickupOrder,
} from "@/hooks/useDeliveryGpsTransmitter";

export default function DeliveryWorkspace({ restaurantName = "" }) {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const staffRoles = Array.isArray(session?.user?.staffRoles) ? session.user.staffRoles : [];
  const isLeadAdmin =
    userRole === "restaurant_admin" ||
    userRole === "admin" ||
    userRole === "lead_admin" ||
    userRole === "superadmin";
  const isManager = isLeadAdmin || staffRoles.includes("Manager");
  const isDeliveryOnlyStaff =
    userRole === "staff" &&
    staffRoles.includes("Delivery") &&
    !staffRoles.includes("Kitchen") &&
    !staffRoles.includes("Manager");
  const currentStaffName = session?.user?.name || "Delivery Staff";
  const currentStaffPhone = session?.user?.phone || "";
  const currentStaffId = session?.user?.id || session?.user?._id;

  const [activeTab, setActiveTab] = useState("deliveries"); // "deliveries" | "cod_register"
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // "active", "preparing", "out_for_delivery", "delivered", "all"
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedMapOrderIds, setExpandedMapOrderIds] = useState(new Set());
  const [updatingId, setUpdatingId] = useState(null);
  const [deliveryNote, setDeliveryNote] = useState({});

  const toggleDoorstepMap = (orderId) => {
    setExpandedMapOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const gpsTransmitter = useDeliveryGpsTransmitter();

  const isOrderCod = (order) => {
    if (!order) return false;
    const method = String(order.paymentMethod || "").toLowerCase();
    return method.includes("cod") || method.includes("cash") || order.paymentStatus === "pending";
  };

  const isCashCollected = (order) => {
    if (!order) return false;
    return Boolean(order.codPaymentHandler?.collected || order.paymentStatus === "paid");
  };

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

  // Teardown GPS if active tracked order gets marked delivered or cancelled elsewhere
  useEffect(() => {
    if (gpsTransmitter.activeOrderId && orders.length > 0) {
      const activeObj = orders.find(
        (o) => o._id === gpsTransmitter.activeOrderId || o.orderId === gpsTransmitter.activeOrderId
      );
      if (activeObj && (activeObj.status === "delivered" || activeObj.status === "cancelled")) {
        gpsTransmitter.stopTracking("stopped");
      }
    }
  }, [orders, gpsTransmitter.activeOrderId, gpsTransmitter.stopTracking]);

  async function updateOrderStatus(orderId, newStatus, extra = {}) {
    try {
      const currentOrder = orders.find((o) => o._id === orderId);

      // Lock delivered status for unpaid COD orders
      if (newStatus === "delivered") {
        if (currentOrder && isOrderCod(currentOrder) && !isCashCollected(currentOrder)) {
          toast.error("Cash on Delivery must be collected before marking order delivered!");
          return;
        }
      }

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

        if (newStatus === "delivered") {
          toast.success("Order marked delivered! Customer and Kitchen Manager notified.", { icon: "🎉" });
        }

        // Auto-start GPS when transitioning to out_for_delivery if not pickup
        if (newStatus === "out_for_delivery") {
          if (!isPickupOrder(currentOrder)) {
            gpsTransmitter.startTracking(currentOrder?.orderId || orderId, {
              ...currentOrder,
              status: "out_for_delivery",
            });
            toast.success("Transit started: Device GPS tracking activated.");
          } else {
            toast("Counter pickup: Live GPS tracking is not required.", { icon: "🛍️" });
          }
        } else if (newStatus === "delivered" || newStatus === "cancelled") {
          // Teardown GPS when delivered or cancelled
          if (
            gpsTransmitter.activeOrderId === orderId ||
            (currentOrder && gpsTransmitter.activeOrderId === currentOrder.orderId)
          ) {
            gpsTransmitter.stopTracking("stopped");
          }
        }
      } else {
        toast.error(data.message || "Failed to update delivery status.");
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Network error updating delivery status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCollectCash(order) {
    const amount = Number(order.totalAmount || 0);
    if (!confirm(`Confirm collecting ₹${amount.toFixed(2)} in cash from customer for order #${order.orderId || order._id}?`)) {
      return;
    }
    try {
      setUpdatingId(order._id);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order._id,
          paymentStatus: "paid",
          codPaymentHandler: {
            id: currentStaffId,
            name: currentStaffName,
            phone: currentStaffPhone,
            amount: amount,
            collected: true,
            collectedAt: new Date(),
            settledWithManager: false,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`₹${amount.toFixed(2)} cash collected! "Mark Handed Over / Delivered" is now unlocked.`);
        setOrders((prev) =>
          prev.map((o) =>
            o._id === order._id
              ? {
                  ...o,
                  paymentStatus: "paid",
                  codPaymentHandler: {
                    id: currentStaffId,
                    name: currentStaffName,
                    phone: currentStaffPhone,
                    amount: amount,
                    collected: true,
                    collectedAt: new Date().toISOString(),
                    settledWithManager: false,
                  },
                }
              : o
          )
        );
      } else {
        toast.error(data.message || "Failed to record cash collection.");
      }
    } catch (err) {
      console.error("Cash collection error:", err);
      toast.error("Network error recording cash collection.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSettleCash(orderIds, staffName = "") {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    if (!ids.length) return;
    const promptMsg = staffName
      ? `Confirm receiving cash handover from ${staffName} for ${ids.length} order(s)? This will mark the cash as settled and clear the driver's pending cash balance.`
      : `Confirm receiving cash handover for ${ids.length} order(s)?`;
    if (!confirm(promptMsg)) return;
    try {
      setUpdatingId(ids[0]);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: ids,
          action: "settle_cod_cash",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "COD cash marked as settled with manager.", { icon: "🤝" });
        setOrders((prev) =>
          prev.map((o) =>
            ids.includes(o._id)
              ? {
                  ...o,
                  codPaymentHandler: {
                    ...(o.codPaymentHandler || {}),
                    settledWithManager: true,
                    settledAt: new Date().toISOString(),
                    settledBy: {
                      id: currentStaffId,
                      name: currentStaffName,
                    },
                  },
                }
              : o
          )
        );
      } else {
        toast.error(data.message || "Failed to settle cash.");
      }
    } catch (err) {
      console.error("Settle cash error:", err);
      toast.error("Network error settling cash.");
    } finally {
      setUpdatingId(null);
    }
  }

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter === "active") {
        if (o.status !== "preparing" && o.status !== "ready" && o.status !== "out_for_delivery") return false;
      } else if (statusFilter !== "all" && o.status !== statusFilter) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = o.address?.fullName?.toLowerCase().includes(q);
      const matchPhone = o.address?.phone?.includes(q);
      const matchRecipientName = o.address?.recipientName?.toLowerCase().includes(q);
      const matchRecipientPhone = o.address?.recipientPhone?.includes(q);
      const matchOrderId = o.orderId?.toLowerCase().includes(q);
      const matchCity = o.address?.city?.toLowerCase().includes(q);
      const matchStreet = o.address?.street?.toLowerCase().includes(q);
      return (
        matchName ||
        matchPhone ||
        matchRecipientName ||
        matchRecipientPhone ||
        matchOrderId ||
        matchCity ||
        matchStreet
      );
    });
  }, [orders, statusFilter, searchQuery]);

  // Operational metrics
  const metrics = useMemo(() => {
    const ready = orders.filter((o) => o.status === "preparing" || o.status === "ready").length;
    const inTransit = orders.filter((o) => o.status === "out_for_delivery").length;
    const deliveredToday = orders.filter((o) => o.status === "delivered").length;
    const codToCollect = orders
      .filter((o) => o.status === "out_for_delivery" && o.paymentStatus !== "paid")
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    return { ready, inTransit, deliveredToday, codToCollect };
  }, [orders]);

  // Comprehensive COD cash summary & manager reconciliation dataset
  const codSummary = useMemo(() => {
    const codOrders = orders.filter((o) => {
      const mode = String(o.paymentMethod || "").toLowerCase();
      return (
        mode.includes("cod") ||
        mode.includes("cash") ||
        o.paymentStatus === "pending" ||
        o.codPaymentHandler?.collected
      );
    });

    const collectedOrders = codOrders.filter((o) => o.codPaymentHandler?.collected || o.paymentStatus === "paid");
    const totalCollected = collectedOrders.reduce(
      (sum, o) => sum + (o.codPaymentHandler?.amount || o.totalAmount || 0),
      0
    );

    const unsettledOrders = collectedOrders.filter((o) => !o.codPaymentHandler?.settledWithManager);
    const totalUnsettled = unsettledOrders.reduce(
      (sum, o) => sum + (o.codPaymentHandler?.amount || o.totalAmount || 0),
      0
    );

    const settledOrders = collectedOrders.filter((o) => o.codPaymentHandler?.settledWithManager);
    const totalSettled = settledOrders.reduce(
      (sum, o) => sum + (o.codPaymentHandler?.amount || o.totalAmount || 0),
      0
    );

    // Group by staff
    const staffMap = {};
    collectedOrders.forEach((o) => {
      const staffName = o.codPaymentHandler?.name || "General Delivery Staff";
      const staffId = o.codPaymentHandler?.id || "unknown";
      const key = `${staffName}_${staffId}`;
      if (!staffMap[key]) {
        staffMap[key] = {
          staffId,
          staffName,
          staffPhone: o.codPaymentHandler?.phone || "",
          orderIds: [],
          totalCollected: 0,
          unsettledAmount: 0,
          settledAmount: 0,
        };
      }
      const amt = o.codPaymentHandler?.amount || o.totalAmount || 0;
      staffMap[key].orderIds.push(o._id);
      staffMap[key].totalCollected += amt;
      if (o.codPaymentHandler?.settledWithManager) {
        staffMap[key].settledAmount += amt;
      } else {
        staffMap[key].unsettledAmount += amt;
      }
    });

    return {
      codOrders,
      collectedOrders,
      unsettledOrders,
      settledOrders,
      totalCollected,
      totalUnsettled,
      totalSettled,
      staffList: Object.values(staffMap),
    };
  }, [orders]);

  // Export COD Cash Audit Ledger to CSV
  function downloadCodReport() {
    const exportTarget = codSummary.collectedOrders;
    if (!exportTarget || exportTarget.length === 0) {
      toast.error("No collected COD orders to export.");
      return;
    }

    const headers = [
      "Order ID",
      "Customer Name",
      "Customer Phone",
      "Delivery Address",
      "Amount Collected (INR)",
      "Collected By Staff",
      "Staff Phone",
      "Collection Date & Time",
      "Settled With Manager",
      "Settlement Time",
    ];

    const rows = exportTarget.map((o) => {
      const handler = o.codPaymentHandler || {};
      const uniqueId = o.orderId || o._id;
      const customer = o.address?.fullName || "Customer";
      const phone = o.address?.phone || "";
      const address = `${o.address?.street || ""}, ${o.address?.city || ""}`.replace(/"/g, '""');
      const amount = handler.amount || o.totalAmount || 0;
      const staffName = handler.name || "Delivery Staff";
      const staffPhone = handler.phone || "";
      const collectedAt = handler.collectedAt ? new Date(handler.collectedAt).toLocaleString() : "";
      const isSettled = handler.settledWithManager ? "Yes" : "No";
      const settledAt = handler.settledAt ? new Date(handler.settledAt).toLocaleString() : "";

      return [
        `"${uniqueId}"`,
        `"${customer.replace(/"/g, '""')}"`,
        `"${phone}"`,
        `"${address}"`,
        amount,
        `"${staffName.replace(/"/g, '""')}"`,
        `"${staffPhone}"`,
        `"${collectedAt}"`,
        `"${isSettled}"`,
        `"${settledAt}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pet_protocols_cod_cash_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("COD Cash Audit Ledger downloaded.");
  }

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

      {/* ── WORKSPACE TABS: DELIVERIES VS COD CASH REGISTER ─────────── */}
      <div className="flex items-center gap-2 border-b border-stone-200/80 dark:border-white/10 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab("deliveries")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
            activeTab === "deliveries"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white dark:bg-[#10141f] text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5 border border-stone-200 dark:border-white/10"
          }`}
        >
          <Truck size={16} />
          <span>Live Deliveries & Transit</span>
          <span
            className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
              activeTab === "deliveries"
                ? "bg-white/20 text-white"
                : "bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300"
            }`}
          >
            {metrics.ready + metrics.inTransit}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("cod_register")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer ${
            activeTab === "cod_register"
              ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
              : "bg-white dark:bg-[#10141f] text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5 border border-stone-200 dark:border-white/10"
          }`}
        >
          <Wallet size={16} />
          <span>COD Cash Register & Manager Reconciliation</span>
          {codSummary.totalUnsettled > 0 && (
            <span
              className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                activeTab === "cod_register"
                  ? "bg-white/20 text-white"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}
            >
              ₹{codSummary.totalUnsettled.toFixed(0)} to Settle
            </span>
          )}
        </button>
      </div>

      {activeTab === "deliveries" && (
        <>

      {/* ── LIVE DELIVERY GPS STATUS PANEL ───────────────────────────── */}
      {gpsTransmitter.trackingStatus === "permission_denied" && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-rose-900 dark:text-rose-200">
                  Location Permission Denied
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-700 dark:text-rose-300">
                  GPS Blocked
                </span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-2xl leading-relaxed">
                Device location access is required to transmit live coordinates to customers during transit. Please tap the lock / settings icon in your browser address bar, enable Location permissions, and retry.
              </p>
            </div>
          </div>
          <button
            onClick={() => gpsTransmitter.stopTracking("idle")}
            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition shrink-0 cursor-pointer"
          >
            Dismiss Alert
          </button>
        </div>
      )}

      {gpsTransmitter.trackingStatus === "unsupported" && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <strong className="block font-bold">Geolocation Unsupported</strong>
            This device browser does not provide standard GPS geolocation APIs.
          </div>
        </div>
      )}

      {gpsTransmitter.activeOrderId && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-[#101928] to-indigo-950/40 border border-emerald-500/30 dark:border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg shadow-emerald-500/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 relative">
                <Radio size={20} className={gpsTransmitter.trackingStatus === "sharing" ? "animate-pulse" : ""} />
                {gpsTransmitter.trackingStatus === "sharing" && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Live GPS Transmission Active
                  </span>
                  <span className="text-stone-400 text-xs">•</span>
                  <span className="font-extrabold text-sm text-white">
                    Order #{gpsTransmitter.activeOrderId}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      gpsTransmitter.trackingStatus === "sharing"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : gpsTransmitter.trackingStatus === "requesting_permission"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    {gpsTransmitter.trackingStatus === "sharing" && "● Sharing live location"}
                    {gpsTransmitter.trackingStatus === "requesting_permission" && "⏳ Requesting permission..."}
                    {gpsTransmitter.trackingStatus === "unavailable" && "⚠️ GPS signal unavailable or stale"}
                    {gpsTransmitter.trackingStatus === "permission_denied" && "❌ Location permission denied"}
                    {gpsTransmitter.trackingStatus === "stopped" && "⏹️ Delivery completed / tracking stopped"}
                    {gpsTransmitter.trackingStatus === "unauthorized" && "🚫 Driver reassigned / unauthorized"}
                  </span>

                  {gpsTransmitter.wakeLockActive && (
                    <span className="text-[10px] font-bold text-blue-300 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
                      📱 Screen Awake
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => gpsTransmitter.stopTracking("stopped")}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
            >
              <Power size={13} />
              <span>Stop GPS Transmission</span>
            </button>
          </div>

          {/* Telemetry Pills */}
          {gpsTransmitter.lastLocation && (
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap pt-2 border-t border-white/10 text-xs">
              <span className="font-mono text-emerald-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                📍 {gpsTransmitter.lastLocation.latitude.toFixed(5)}, {gpsTransmitter.lastLocation.longitude.toFixed(5)}
              </span>

              {typeof gpsTransmitter.lastLocation.accuracy === "number" && (
                <span
                  className={`font-semibold px-2 py-1 rounded-lg border text-[11px] ${
                    gpsTransmitter.lastLocation.accuracy <= 20
                      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                      : gpsTransmitter.lastLocation.accuracy <= 50
                      ? "text-amber-300 bg-amber-500/10 border-amber-500/20"
                      : "text-rose-300 bg-rose-500/10 border-rose-500/20"
                  }`}
                >
                  🎯 ±{Math.round(gpsTransmitter.lastLocation.accuracy)}m accuracy
                </span>
              )}

              {typeof gpsTransmitter.lastLocation.speed === "number" && gpsTransmitter.lastLocation.speed > 0 && (
                <span className="text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1">
                  <Gauge size={12} />
                  <span>{Math.round(gpsTransmitter.lastLocation.speed * 3.6)} km/h</span>
                </span>
              )}

              {typeof gpsTransmitter.lastLocation.heading === "number" && gpsTransmitter.lastLocation.heading >= 0 && (
                <span className="text-stone-300 bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1">
                  <Compass size={12} />
                  <span>{Math.round(gpsTransmitter.lastLocation.heading)}°</span>
                </span>
              )}

              {gpsTransmitter.lastSentTime && (
                <span className="text-stone-400 text-[11px] ml-auto">
                  Sent: {new Date(gpsTransmitter.lastSentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
          )}

          {gpsTransmitter.errorMessage && (
            <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{gpsTransmitter.errorMessage}</span>
            </div>
          )}

          {/* Device and Background GPS Note */}
          <p className="text-[11px] text-stone-400 leading-relaxed pt-1">
            ⚠️ <strong>Staff Note:</strong> Device location permission is required. Live updates are throttled to every 8–10 seconds. Note: GPS transmission runs in this active browser tab; background transmission may pause if your phone screen locks or the browser is minimized.
          </p>
        </div>
      )}

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
            const isPickup = isPickupOrder(order);
            const isOrderTracking =
              gpsTransmitter.activeOrderId === order._id ||
              gpsTransmitter.activeOrderId === order.orderId;

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

                        {/* Pickup or GPS Tracking Status Pill */}
                        {isPickup ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            🛍️ COUNTER PICKUP
                          </span>
                        ) : order.status === "out_for_delivery" ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border flex items-center gap-1.5 ${
                              isOrderTracking
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20"
                            }`}
                          >
                            {isOrderTracking ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                                <span>LIVE GPS ACTIVE</span>
                              </>
                            ) : (
                              <>
                                <Navigation size={10} className="text-stone-400" />
                                <span>GPS INACTIVE</span>
                              </>
                            )}
                          </span>
                        ) : null}

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
                  <div className="flex items-center gap-2 self-end md:self-auto flex-wrap justify-end">
                    {(order.status === "preparing" || order.status === "ready") && (
                      <button
                        onClick={() =>
                          updateOrderStatus(order._id, "out_for_delivery", {
                            assignedDeliveryStaff: {
                              id: currentStaffId,
                              name: currentStaffName,
                              phone: currentStaffPhone,
                            },
                          })
                        }
                        disabled={isUpdating}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Truck size={14} />
                        <span>Pick Up & Start Transit</span>
                      </button>
                    )}

                    {order.status === "out_for_delivery" && (
                      <>
                        {!isPickup && (
                          isOrderTracking ? (
                            <button
                              onClick={() => gpsTransmitter.stopTracking("stopped")}
                              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                              title="Stop sending GPS coordinates for this order"
                            >
                              <Power size={13} />
                              <span>Stop GPS</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => gpsTransmitter.startTracking(order.orderId || order._id, order)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                              title="Start transmitting real device GPS for this active delivery"
                            >
                              <Navigation size={13} />
                              <span>Share Live GPS</span>
                            </button>
                          )
                        )}

                        {/* COD Cash Collection requirement check */}
                        {isOrderCod(order) && !isCashCollected(order) ? (
                          <>
                            <button
                              onClick={() => handleCollectCash(order)}
                              disabled={isUpdating}
                              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer animate-pulse"
                            >
                              <Banknote size={14} />
                              <span>Collect ₹{(order.totalAmount || 0).toFixed(2)} Cash</span>
                            </button>

                            <button
                              disabled={true}
                              title={`Please collect ₹${(order.totalAmount || 0).toFixed(2)} cash from customer first`}
                              className="bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-500 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-not-allowed border border-stone-300 dark:border-white/5 opacity-70"
                            >
                              <Lock size={14} className="text-amber-500" />
                              <span>Mark Handed Over / Delivered</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {isOrderCod(order) && (
                              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-bold">
                                <Check size={12} className="text-emerald-500" />
                                <span>₹{(order.codPaymentHandler?.amount || order.totalAmount || 0).toFixed(2)} Cash Collected</span>
                              </div>
                            )}

                            <button
                              onClick={() => updateOrderStatus(order._id, "delivered")}
                              disabled={isUpdating}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} />
                              <span>Mark Handed Over / Delivered</span>
                            </button>
                          </>
                        )}
                      </>
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
                  <div className="bg-white dark:bg-[#151926] p-4 rounded-xl border border-stone-200/80 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-stone-900 dark:text-white">
                        <MapPin size={14} className="text-blue-500" />
                        <span>Delivery Destination</span>
                      </div>

                      {/* Alternate Recipient Badge if applicable */}
                      {(order.address?.isDifferentRecipient || order.address?.recipientPhone) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 flex items-center gap-1">
                          🎁 Alternate Recipient
                        </span>
                      )}
                    </div>

                    {/* Recipient Details & Quick Call */}
                    {(order.address?.isDifferentRecipient || order.address?.recipientPhone) ? (
                      <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-800/30 space-y-2 text-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-extrabold text-purple-800 dark:text-purple-300 block">
                              Deliver To Recipient:
                            </span>
                            <span className="font-black text-sm text-stone-900 dark:text-white">
                              {order.address?.recipientName || order.address?.fullName || "Recipient"}
                            </span>
                          </div>

                          {order.address?.recipientPhone && (
                            <a
                              href={`tel:${order.address.recipientPhone}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition"
                            >
                              <Phone size={12} />
                              <span>Call Recipient ({order.address.recipientPhone})</span>
                            </a>
                          )}
                        </div>

                        {order.address?.phone && order.address.phone !== order.address.recipientPhone && (
                          <div className="pt-1.5 border-t border-purple-200/50 dark:border-purple-800/20 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                            <span>Ordered by: <strong>{order.address.fullName || "Customer"}</strong></span>
                            <a href={`tel:${order.address.phone}`} className="hover:underline text-stone-600 dark:text-stone-300">
                              📞 {order.address.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-stone-900 dark:text-white">
                          {order.address?.fullName || "Valued Customer"}
                        </div>
                        {order.address?.phone && (
                          <a
                            href={`tel:${order.address.phone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-500/20 transition"
                          >
                            <Phone size={11} />
                            <span>Call ({order.address.phone})</span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Street Address */}
                    <div className="text-xs text-stone-700 dark:text-stone-300">
                      <p className="leading-relaxed">
                        {order.address?.street}, {order.address?.city}
                        {order.address?.state ? `, ${order.address?.state}` : ""}
                        {order.address?.pincode ? ` - ${order.address?.pincode}` : ""}
                      </p>
                    </div>

                    {/* GPS Coordinates & Google Maps Navigation */}
                    {(() => {
                      const hasCustomerLiveGps = Boolean(order.customerLocation?.latitude && order.customerLocation?.longitude);
                      const hasPinnedGps = Boolean(order.address?.latitude && order.address?.longitude);
                      const navLat = order.customerLocation?.latitude || order.address?.latitude;
                      const navLng = order.customerLocation?.longitude || order.address?.longitude;

                      if (!navLat || !navLng) return null;

                      const isMapOpen = expandedMapOrderIds.has(order._id);

                      return (
                        <div className="pt-2 border-t border-stone-100 dark:border-white/5 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            {hasCustomerLiveGps ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                🎯 Customer Live GPS (±{Math.round(order.customerLocation.accuracy || 10)}m)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                📍 Pinned Doorstep GPS
                              </span>
                            )}
                            <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                              {Number(navLat).toFixed(5)}, {Number(navLng).toFixed(5)}
                            </span>
                          </div>

                          {/* Toggle Inline Doorstep Map */}
                          <button
                            type="button"
                            onClick={() => toggleDoorstepMap(order._id)}
                            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-extrabold text-xs shadow-xs transition cursor-pointer ${
                              isMapOpen
                                ? "bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 text-white border border-stone-600/30"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                            }`}
                          >
                            <Navigation size={13} className={isMapOpen ? "text-blue-400" : ""} />
                            <span>{isMapOpen ? "🗺️ Hide Doorstep Map" : "🗺️ Navigate to Doorstep (Google Maps)"}</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 opacity-80 ${isMapOpen ? "rotate-180" : ""}`} />
                          </button>

                          {/* Inline Map Window Below Section on Same Page */}
                          {isMapOpen && (
                            <div className="mt-2.5 rounded-2xl overflow-hidden border border-blue-500/30 bg-stone-950 shadow-lg">
                              <div className="flex items-center justify-between px-3.5 py-2.5 bg-stone-900/95 border-b border-white/10 text-xs">
                                <div className="flex items-center gap-2 font-bold text-white text-[11px]">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                  </span>
                                  <span>Accurate Doorstep Location</span>
                                </div>
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${navLat},${navLng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-400 hover:text-blue-300 transition underline underline-offset-2"
                                >
                                  <span>Open Maps App</span>
                                  <ExternalLink size={11} />
                                </a>
                              </div>

                              <div className="relative w-full h-[280px] bg-stone-900">
                                <iframe
                                  title={`Doorstep Map for Order ${order.orderId || order._id}`}
                                  width="100%"
                                  height="100%"
                                  style={{ border: 0 }}
                                  loading="lazy"
                                  allowFullScreen
                                  referrerPolicy="no-referrer-when-downgrade"
                                  src={`https://maps.google.com/maps?q=${navLat},${navLng}&hl=en&z=17&output=embed`}
                                />
                              </div>

                              <div className="px-3 py-1.5 bg-stone-900/95 border-t border-white/5 flex items-center justify-between text-[10px] text-stone-400">
                                <span className="font-mono">Lat: {Number(navLat).toFixed(5)}, Lng: {Number(navLng).toFixed(5)}</span>
                                <span className="text-emerald-400 font-bold">Interactive • Zoomable</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <AlertTriangle size={13} />
                          <span>Collect ₹{(order.totalAmount || 0).toFixed(2)} in Cash</span>
                        </span>
                        <button
                          onClick={() => handleCollectCash(order)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <Banknote size={13} />
                          <span>Record Cash Collection</span>
                        </button>
                      </div>
                    )}

                    {isPaid && isOrderCod(order) && order.codPaymentHandler?.collected && (
                      <div className="pt-2 border-t border-stone-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                        <span className="text-stone-600 dark:text-stone-300 flex items-center gap-1 text-[11px]">
                          <BadgeCheck size={13} className="text-emerald-500 shrink-0" />
                          <span>Collected by <strong>{order.codPaymentHandler?.name || currentStaffName}</strong></span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.codPaymentHandler?.settledWithManager
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          }`}>
                            {order.codPaymentHandler?.settledWithManager ? "✓ Settled with Manager" : "In Driver's Hand (Pending Handover)"}
                          </span>
                          {isManager && !order.codPaymentHandler?.settledWithManager && (
                            <button
                              onClick={() => handleSettleCash(order._id)}
                              disabled={updatingId !== null}
                              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                            >
                              Settle Now
                            </button>
                          )}
                        </div>
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
      </>
      )}

      {/* ── TAB 2: COD CASH RECONCILIATION & MANAGER REGISTER ───────── */}
      {activeTab === "cod_register" && (
        <div className="space-y-6">
          {/* ── DELIVERY STAFF PERSONAL HANDOVER STATUS CARD ────────── */}
          {(() => {
            const myCollectedOrders = codSummary.collectedOrders.filter(
              (o) =>
                (currentStaffId && String(o.codPaymentHandler?.id) === String(currentStaffId)) ||
                (currentStaffPhone && o.codPaymentHandler?.phone === currentStaffPhone) ||
                (currentStaffName && o.codPaymentHandler?.name === currentStaffName)
            );

            const myUnsettledOrders = myCollectedOrders.filter((o) => !o.codPaymentHandler?.settledWithManager);
            const myUnsettledTotal = myUnsettledOrders.reduce(
              (sum, o) => sum + (o.codPaymentHandler?.amount || o.totalAmount || 0),
              0
            );
            const mySettledOrders = myCollectedOrders.filter((o) => o.codPaymentHandler?.settledWithManager);
            const mySettledTotal = mySettledOrders.reduce(
              (sum, o) => sum + (o.codPaymentHandler?.amount || o.totalAmount || 0),
              0
            );

            if (myCollectedOrders.length === 0 && isManager) return null;

            return (
              <div
                className={`p-4 sm:p-5 rounded-2xl border transition shadow-sm ${
                  myUnsettledTotal > 0
                    ? "bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border-amber-500/30"
                    : "bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 border-emerald-500/30"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        myUnsettledTotal > 0
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      <Wallet size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-stone-900 dark:text-white">
                          My Cash Collection & Handover Status
                        </span>
                        <span className="text-xs text-stone-400">•</span>
                        <span className="text-xs text-stone-500 dark:text-stone-300 font-semibold">
                          Staff: <strong>{currentStaffName}</strong>
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 max-w-xl leading-relaxed">
                        {myUnsettledTotal > 0
                          ? `You currently hold ₹${myUnsettledTotal.toFixed(2)} cash in hand from ${myUnsettledOrders.length} COD order(s). Please deposit this cash with the manager at the counter to clear your balance.`
                          : `All cash collected by you today (₹${mySettledTotal.toFixed(2)}) has been handed over and confirmed settled by the manager! Your cash balance is completely clear.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        {myUnsettledTotal > 0 ? "Cash to Hand Over" : "Balance in Hand"}
                      </span>
                      <span
                        className={`text-xl font-black ${
                          myUnsettledTotal > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        ₹{myUnsettledTotal.toFixed(2)}
                      </span>
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 border ${
                        myUnsettledTotal > 0
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {myUnsettledTotal > 0 ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                          <span>Pending Handover</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} className="text-emerald-500" />
                          <span>All Handed Over</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Reconciliation Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#10141f] p-5 rounded-2xl border border-stone-200/90 dark:border-white/10 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Total COD Cash Collected
              </span>
              <div className="text-2xl font-black text-stone-900 dark:text-white">
                ₹{codSummary.totalCollected.toFixed(2)}
              </div>
              <span className="text-[11px] text-stone-400">{codSummary.collectedOrders.length} orders recorded</span>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-200 dark:border-amber-500/30 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                Pending Manager Handover
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                ₹{codSummary.totalUnsettled.toFixed(2)}
              </div>
              <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                {codSummary.unsettledOrders.length} orders in drivers' hands
              </span>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                Settled with Manager
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{codSummary.totalSettled.toFixed(2)}
              </div>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                {codSummary.settledOrders.length} orders settled & deposited
              </span>
            </div>

            <div className="bg-white dark:bg-[#10141f] p-5 rounded-2xl border border-stone-200/90 dark:border-white/10 shadow-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Active Drivers with Cash
              </span>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {codSummary.staffList.filter((s) => s.unsettledAmount > 0).length}
              </div>
              <span className="text-[11px] text-stone-400">across {codSummary.staffList.length} staff members</span>
            </div>
          </div>

          {/* Staff Breakdown Table / Cards */}
          <div className="bg-white dark:bg-[#10141f] rounded-2xl border border-stone-200/90 dark:border-white/10 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-stone-900 dark:text-white flex items-center gap-2">
                  <Wallet size={18} className="text-amber-500" />
                  <span>Delivery Staff Cash Balances & Handover</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Real-time record of which delivery boy collected what cash amount and handover status.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {isManager && codSummary.totalUnsettled > 0 && (
                  <button
                    onClick={() =>
                      handleSettleCash(
                        codSummary.unsettledOrders.map((o) => o._id),
                        "All Active Drivers"
                      )
                    }
                    disabled={updatingId !== null}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>Settle All Pending (₹{codSummary.totalUnsettled.toFixed(2)})</span>
                  </button>
                )}

                <button
                  onClick={downloadCodReport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-white/10 hover:bg-stone-200 dark:hover:bg-white/15 text-stone-800 dark:text-stone-200 text-xs font-bold transition cursor-pointer"
                >
                  <FileSpreadsheet size={14} className="text-emerald-500" />
                  <span>Export CSV Report</span>
                </button>
              </div>
            </div>

            {codSummary.staffList.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">
                No COD cash collections recorded yet today.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-white/5">
                {codSummary.staffList.map((staff, idx) => (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-stone-50/50 dark:hover:bg-white/[0.01] transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
                        <User size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-stone-900 dark:text-white">
                            {staff.staffName}
                          </span>
                          {staff.staffPhone && (
                            <span className="text-xs text-stone-400 font-mono">
                              ({staff.staffPhone})
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-stone-500 dark:text-stone-400">
                          Handled {staff.orderIds.length} COD orders • Total Collected: ₹{staff.totalCollected.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                          Cash in Hand
                        </span>
                        <span
                          className={`text-base font-black ${
                            staff.unsettledAmount > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          ₹{staff.unsettledAmount.toFixed(2)}
                        </span>
                      </div>

                      {isManager && staff.unsettledAmount > 0 ? (
                        <button
                          onClick={() => handleSettleCash(staff.orderIds, staff.staffName)}
                          disabled={updatingId !== null}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Check size={14} />
                          <span>Confirm Handover & Settle (₹{staff.unsettledAmount.toFixed(2)})</span>
                        </button>
                      ) : (
                        staff.unsettledAmount === 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                            <Check size={14} className="text-emerald-500" />
                            <span>All Cash Handed Over</span>
                          </span>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order-by-Order COD Cash Log */}
          <div className="bg-white dark:bg-[#10141f] rounded-2xl border border-stone-200/90 dark:border-white/10 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-white/10">
              <h3 className="font-extrabold text-sm text-stone-900 dark:text-white uppercase tracking-wider">
                Individual COD Orders Cash Audit Log ({codSummary.collectedOrders.length})
              </h3>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-white/5">
              {codSummary.collectedOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  No collected COD orders found.
                </div>
              ) : (
                codSummary.collectedOrders.map((o) => {
                  const handler = o.codPaymentHandler || {};
                  const isSettled = Boolean(handler.settledWithManager);
                  return (
                    <div
                      key={o._id}
                      className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-stone-900 dark:text-white bg-stone-100 dark:bg-white/10 px-2 py-0.5 rounded">
                            #{o.orderId || o._id}
                          </span>
                          <span className="font-bold text-stone-800 dark:text-stone-200">
                            {o.address?.fullName || "Customer"}
                          </span>
                          <span className="text-stone-400">•</span>
                          <span className="text-stone-500 dark:text-stone-400">
                            {o.address?.city || o.address?.street || "Destination"}
                          </span>
                        </div>
                        <div className="text-stone-500 dark:text-stone-400 flex items-center gap-2 flex-wrap">
                          <span>
                            Collected by: <strong className="text-stone-700 dark:text-stone-300">{handler.name || "Delivery Staff"}</strong>
                          </span>
                          {handler.collectedAt && (
                            <span>
                              • {new Date(handler.collectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                          {isSettled && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              • Settled with Manager {handler.settledAt ? `at ${new Date(handler.settledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto flex-wrap justify-end">
                        <div className="text-right">
                          <span className="text-sm font-black text-stone-900 dark:text-white">
                            ₹{(handler.amount || o.totalAmount || 0).toFixed(2)}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {isSettled ? (
                              <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                                <Check size={11} />
                                <span>Handed Over & Settled</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                ⚠️ In Driver's Wallet (Pending Handover)
                              </span>
                            )}
                          </div>
                        </div>

                        {isManager && !isSettled && (
                          <button
                            onClick={() => handleSettleCash(o._id, handler.name || "Delivery Staff")}
                            disabled={updatingId !== null}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer transition shadow-xs disabled:opacity-50 flex items-center gap-1"
                          >
                            <Check size={13} />
                            <span>Confirm Handover</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
