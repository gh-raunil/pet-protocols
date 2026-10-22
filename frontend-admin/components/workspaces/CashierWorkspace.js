"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Info,
  ArrowUpRight,
  ShieldCheck,
  CheckCheck,
  MoreVertical,
  SlidersHorizontal,
  ArrowUpDown,
  Copy,
  ChevronLeft,
  Eye,
  Truck,
  ChefHat,
  Filter,
  Layers,
} from "lucide-react";

// ── DATE UTILITIES (Local Timezone Safe) ─────────────────────────────────
function getLocalDateString(dateInput = new Date()) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

function formatDisplayDate(dateInput) {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDisplayTime(dateInput) {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDisplayDateTime(dateInput) {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";
  return `${formatDisplayDate(d)}, ${formatDisplayTime(d)}`;
}

// Format shortened visual Order ID with suffix
function getShortOrderId(order) {
  if (!order) return "#—";
  const rawId = order.orderId || (order._id ? order._id.toString() : "");
  if (!rawId) return "#0000";
  // Suffix of last 4-5 chars
  const parts = rawId.split("_");
  const suffix = parts[parts.length - 1];
  return `#${suffix.slice(-5).toUpperCase()}`;
}

// ── REFINED OPERATIONAL STATUS RESOLVERS ────────────────────────────────
function getOperationalStatus(order) {
  if (!order) {
    return {
      paymentState: "pending",
      paymentLabel: "Pending",
      paymentMethod: "—",
      collectionState: "awaiting",
      collectionLabel: "Awaiting Collection",
      collectionTimestamp: null,
      collector: "",
      settlementState: "not_applicable",
      settlementLabel: "Not Applicable",
      settlementTimestamp: null,
      settledBy: "",
      isCancelled: false,
      cancellationReason: "",
      refundState: "none",
    };
  }

  const isCancelled = order.status === "cancelled";
  const rawPaymentStatus = order.paymentStatus || "pending";
  const isPaid = rawPaymentStatus === "paid" || rawPaymentStatus === "test_paid";
  const isFailed = rawPaymentStatus === "failed";
  const isRefunded =
    rawPaymentStatus === "refunded" ||
    order.refundDetails?.status === "processed" ||
    order.refundDetails?.status === "refunded";
  const isRefundPending =
    rawPaymentStatus === "refund_pending" ||
    order.refundDetails?.status === "pending" ||
    order.refundDetails?.status === "processing";

  // 1. Payment State
  let paymentState = "pending";
  let paymentLabel = "Pending";
  if (isCancelled && isRefunded) {
    paymentState = "refunded";
    paymentLabel = "Refunded";
  } else if (isCancelled && isRefundPending) {
    paymentState = "refund_pending";
    paymentLabel = "Refund Pending";
  } else if (isCancelled) {
    paymentState = "cancelled";
    paymentLabel = "Cancelled";
  } else if (isRefunded) {
    paymentState = "refunded";
    paymentLabel = "Refunded";
  } else if (isPaid) {
    paymentState = "paid";
    paymentLabel = "Paid";
  } else if (isFailed) {
    paymentState = "failed";
    paymentLabel = "Failed";
  }

  // 2. Collection State
  const isCod =
    /cod|cash/i.test(order.paymentMethod || "") &&
    !order.isPickup &&
    order.orderType !== "pickup";
  const codCollected = Boolean(order.codPaymentHandler?.collected);
  const codCollectedAt = order.codPaymentHandler?.collectedAt;
  const collectorName = order.codPaymentHandler?.name || "Delivery Partner";

  let collectionState = "not_applicable";
  let collectionLabel = "Not Applicable";
  let collectionTimestamp = null;
  let collector = "";

  if (isCancelled && !isPaid) {
    collectionState = "not_applicable";
    collectionLabel = "Void";
  } else if (isCod) {
    if (codCollected) {
      collectionState = "collected";
      collectionLabel = "Cash Collected";
      collectionTimestamp = codCollectedAt || order.updatedAt;
      collector = collectorName;
    } else {
      collectionState = "awaiting";
      collectionLabel = "Awaiting Driver Collection";
    }
  } else if (isPaid) {
    collectionState = "collected";
    collectionLabel =
      String(order.paymentMethod || "").toLowerCase().includes("online") ||
      String(order.paymentMethod || "").toLowerCase().includes("razorpay")
        ? "Online Captured"
        : "Counter Collected";
    collectionTimestamp = order.paidAt || order.createdAt;
  } else {
    collectionState = "awaiting";
    collectionLabel = "Awaiting Payment";
  }

  // 3. Settlement State
  let settlementState = "not_applicable";
  let settlementLabel = "Not Applicable";
  let settlementTimestamp = null;
  let settledBy = "";

  if (isCancelled) {
    if (order.codPaymentHandler?.settledWithManager) {
      settlementState = "settled";
      settlementLabel = "Settled (Void)";
      settlementTimestamp =
        order.codPaymentHandler.settledAt || order.settledAt || order.updatedAt;
      settledBy = order.codPaymentHandler.settledBy?.name || "Manager";
    } else {
      settlementState = "not_applicable";
      settlementLabel = "Void";
      settledBy = "Order Cancelled";
    }
  } else if (isCod) {
    if (order.codPaymentHandler?.settledWithManager) {
      settlementState = "settled";
      settlementLabel = "Settled with Manager";
      settlementTimestamp =
        order.codPaymentHandler.settledAt || order.settledAt || order.updatedAt;
      settledBy = order.codPaymentHandler.settledBy?.name || "Manager";
    } else if (codCollected) {
      settlementState = "pending";
      settlementLabel = "Pending Settlement";
      settlementTimestamp = codCollectedAt;
      settledBy = `Cash with ${collectorName}`;
    } else {
      settlementState = "awaiting_collection";
      settlementLabel = "Awaiting Collection";
    }
  } else if (isPaid) {
    settlementState = "settled";
    settlementLabel =
      String(order.paymentMethod || "").toLowerCase().includes("online") ||
      String(order.paymentMethod || "").toLowerCase().includes("razorpay")
        ? "Gateway Settled"
        : "Register Settled";
    settlementTimestamp = order.settledAt || order.paidAt || order.createdAt;
    settledBy = "Direct Account Deposit";
  }

  return {
    paymentState,
    paymentLabel,
    paymentMethod: order.paymentMethod || "COD",
    collectionState,
    collectionLabel,
    collectionTimestamp,
    collector,
    settlementState,
    settlementLabel,
    settlementTimestamp,
    settledBy,
    isCancelled,
    cancellationReason: order.cancellationReason || "",
    refundState: order.refundDetails?.status || (isRefunded ? "processed" : "none"),
    canSettleCodWithManager:
      !isCancelled &&
      order.status !== "cancelled" &&
      !["refunded", "failed"].includes(order.paymentStatus) &&
      isCod &&
      codCollected &&
      !order.codPaymentHandler?.settledWithManager,
  };
}

export default function CashierWorkspace({ restaurantName = "" }) {
  // ── CORE DATA & SERVER STATE ──────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [restaurantObj, setRestaurantObj] = useState(null);

  // ── SEARCH & FILTER CONTROLS ──────────────────────────────────────────
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const yesterdayStr = useMemo(() => getYesterdayDateString(), []);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState("today"); // "today", "yesterday", "all", "custom"
  const [customDate, setCustomDate] = useState(() => getLocalDateString(new Date()));

  // Operational status filters
  const [orderTypeFilter, setOrderTypeFilter] = useState("all"); // "all", "delivery", "pickup"
  const [paymentFilter, setPaymentFilter] = useState("all"); // "all", "paid", "pending", "failed", "refunded"
  const [collectionFilter, setCollectionFilter] = useState("all"); // "all", "collected", "awaiting"
  const [settlementFilter, setSettlementFilter] = useState("all"); // "all", "settled", "pending"
  const [cancellationFilter, setCancellationFilter] = useState("all"); // "all", "active_only", "cancelled_only"

  // ── PAGINATION & SORTING ──────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25); // default 25
  const [sortBy, setSortBy] = useState("createdAt"); // "createdAt", "totalAmount"
  const [sortOrder, setSortOrder] = useState("desc"); // "desc", "asc"

  // ── DISPLAY DENSITY SETTING (Requirement 2) ───────────────────────────
  const [density, setDensity] = useState("compact"); // "compact" (default), "comfortable"

  // ── MODALS & DRAWER STATES ────────────────────────────────────────────
  const [drawerOrder, setDrawerOrder] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [settlingOrder, setSettlingOrder] = useState(null);
  const [tenderedAmount, setTenderedAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("Cash");
  const [updatingId, setUpdatingId] = useState(null);
  const [copySuccessId, setCopySuccessId] = useState(null);

  // Active contextual menu dropdown state
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1); // reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Click outside listener for action menu
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut listener for receipt printing & drawer
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        if (receiptOrder) setReceiptOrder(null);
        else if (drawerOrder) setDrawerOrder(null);
        else if (settlingOrder) setSettlingOrder(null);
        else if (openMenuId) setOpenMenuId(null);
      } else if (receiptOrder && (e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        window.print();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [receiptOrder, drawerOrder, settlingOrder, openMenuId]);

  // ── SERVER DATA FETCHING ──────────────────────────────────────────────
  const fetchOrders = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        setError("");

        const params = new URLSearchParams();

        // Date param handling
        if (dateRange === "today") params.append("date", todayStr);
        else if (dateRange === "yesterday") params.append("date", yesterdayStr);
        else if (dateRange === "custom" && customDate) params.append("date", customDate);
        else params.append("date", "all");

        if (debouncedSearch) params.append("search", debouncedSearch);
        if (orderTypeFilter !== "all") params.append("orderType", orderTypeFilter);
        if (paymentFilter !== "all") params.append("paymentStatus", paymentFilter);

        // Sorting params
        params.append("sortBy", sortBy);
        params.append("sortOrder", sortOrder);

        const res = await fetch(`/api/restaurant/orders?${params.toString()}`);
        let data = {};
        try {
          if (res.ok) {
            const text = await res.text();
            data = JSON.parse(text);
          } else {
            data = { success: false, message: `Server status: ${res.status}` };
          }
        } catch {
          data = { success: false, message: "Server connection temporarily interrupted." };
        }

        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
          setTotalOrdersCount(data.totalOrders || data.orders.length);
          if (data.restaurant) setRestaurantObj(data.restaurant);
        } else {
          setError(data.message || data.error || "Failed to load orders.");
        }
      } catch (err) {
        console.error("[Cashier Fetch Error]", err);
        setError("Network error fetching orders.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateRange, todayStr, yesterdayStr, customDate, debouncedSearch, orderTypeFilter, paymentFilter, sortBy, sortOrder]
  );

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 20000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Copy order ID to clipboard
  const handleCopyOrderId = (e, orderId) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(orderId);
    setCopySuccessId(orderId);
    setTimeout(() => setCopySuccessId(null), 2000);
  };

  // ── ACTIONS: CASHIER SETTLE BILL & MANAGER COD CASH ───────────────────
  async function handleSettlePayment(orderId, paymentMethod) {
    const targetOrder = orders.find((o) => o._id === orderId);
    if (targetOrder?.status === "cancelled") {
      alert("Cancelled orders cannot be settled.");
      setSettlingOrder(null);
      return;
    }

    try {
      setUpdatingId(orderId);
      const chosenMethod = paymentMethod || selectedMethod || "Cash (Front Desk POS)";
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentStatus: "paid",
          paymentMethod: chosenMethod,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const nowIso = new Date().toISOString();
        setOrders((prev) =>
          prev.map((o) =>
            o._id === orderId
              ? {
                  ...o,
                  paymentStatus: "paid",
                  paymentMethod: chosenMethod,
                  paidAt: nowIso,
                  settledAt: nowIso,
                }
              : o
          )
        );
        if (drawerOrder?._id === orderId) {
          setDrawerOrder((prev) => ({
            ...prev,
            paymentStatus: "paid",
            paymentMethod: chosenMethod,
            paidAt: nowIso,
            settledAt: nowIso,
          }));
        }
        setSettlingOrder(null);
      } else {
        alert(data.message || "Failed to settle payment.");
      }
    } catch (err) {
      console.error("[Settle Error]", err);
      alert("Network error settling payment.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSettleCodCash(orderId) {
    const targetOrder = orders.find((o) => o._id === orderId) || (drawerOrder?._id === orderId ? drawerOrder : null);
    if (targetOrder?.status === "cancelled") {
      alert("Cancelled orders cannot be settled for COD cash.");
      return;
    }

    if (!confirm("Confirm settling COD cash from delivery partner into the cashier register?")) {
      return;
    }

    try {
      setUpdatingId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "settle_cod_cash",
          orderId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const nowIso = new Date().toISOString();
        setOrders((prev) =>
          prev.map((o) =>
            o._id === orderId
              ? {
                  ...o,
                  settledAt: nowIso,
                  codPaymentHandler: {
                    ...(o.codPaymentHandler || {}),
                    settledWithManager: true,
                    settledAt: nowIso,
                  },
                }
              : o
          )
        );
        if (drawerOrder?._id === orderId) {
          setDrawerOrder((prev) => ({
            ...prev,
            settledAt: nowIso,
            codPaymentHandler: {
              ...(prev.codPaymentHandler || {}),
              settledWithManager: true,
              settledAt: nowIso,
            },
          }));
        }
      } else {
        alert(data.message || "Failed to settle COD cash with manager.");
      }
    } catch (err) {
      console.error("[Settle COD Error]", err);
      alert("Network error settling COD cash.");
    } finally {
      setUpdatingId(null);
    }
  }

  // ── IN-MEMORY FILTER PIPELINE ─────────────────────────────────────────
  const processedOrders = useMemo(() => {
    return orders.filter((order) => {
      const op = getOperationalStatus(order);

      // Collection filter
      if (collectionFilter === "collected" && op.collectionState !== "collected") return false;
      if (collectionFilter === "awaiting" && op.collectionState !== "awaiting") return false;

      // Settlement filter
      if (settlementFilter === "settled" && op.settlementState !== "settled") return false;
      if (settlementFilter === "pending" && op.settlementState !== "pending") return false;

      // Cancellation filter
      if (cancellationFilter === "active_only" && op.isCancelled) return false;
      if (cancellationFilter === "cancelled_only" && !op.isCancelled) return false;

      return true;
    });
  }, [orders, collectionFilter, settlementFilter, cancellationFilter]);

  // Client-side pagination slices
  const totalPages = Math.max(1, Math.ceil(processedOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedOrders.slice(start, start + pageSize);
  }, [processedOrders, page, pageSize]);

  // High-level metrics for quick header cards
  const metrics = useMemo(() => {
    const active = processedOrders.filter((o) => o.status !== "cancelled");
    const totalCollected = processedOrders
      .filter((o) => o.paymentStatus === "paid" || o.paymentStatus === "test_paid")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const pendingSettlementAmount = processedOrders
      .filter((o) => {
        const op = getOperationalStatus(o);
        return op.settlementState === "pending";
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const pendingCollectionAmount = active
      .filter((o) => o.paymentStatus !== "paid" && o.paymentStatus !== "test_paid")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const settledCount = processedOrders.filter((o) => {
      const op = getOperationalStatus(o);
      return op.settlementState === "settled";
    }).length;

    const pendingSettlementCount = processedOrders.filter((o) => {
      const op = getOperationalStatus(o);
      return op.settlementState === "pending";
    }).length;

    return {
      totalCollected,
      pendingSettlementAmount,
      pendingCollectionAmount,
      settledCount,
      pendingSettlementCount,
      totalCount: processedOrders.length,
    };
  }, [processedOrders]);

  // Check if any secondary filter is currently active
  const hasActiveFilters =
    orderTypeFilter !== "all" ||
    paymentFilter !== "all" ||
    collectionFilter !== "all" ||
    settlementFilter !== "all" ||
    cancellationFilter !== "all" ||
    debouncedSearch.length > 0;

  const resetAllFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setOrderTypeFilter("all");
    setPaymentFilter("all");
    setCollectionFilter("all");
    setSettlementFilter("all");
    setCancellationFilter("all");
    setPage(1);
  };

  // Change Due calculation for Cash Settle modal
  const changeDue = useMemo(() => {
    if (!settlingOrder || !tenderedAmount) return 0;
    const tendered = parseFloat(tenderedAmount) || 0;
    const total = settlingOrder.totalAmount || 0;
    return Math.max(0, tendered - total);
  }, [settlingOrder, tenderedAmount]);

  const activeRestaurantName =
    restaurantObj?.name || restaurantName || "पेट Protocols Kitchen";

  // Date label indicator
  const activeDateLabel = useMemo(() => {
    if (dateRange === "today") return `Today (${formatDisplayDate(todayStr)})`;
    if (dateRange === "yesterday") return `Yesterday (${formatDisplayDate(yesterdayStr)})`;
    if (dateRange === "custom") return formatDisplayDate(customDate);
    return "All Time (All History)";
  }, [dateRange, todayStr, yesterdayStr, customDate]);

  return (
    <>
      <div className={`space-y-4 cashier-page-content pb-12 ${receiptOrder ? "no-print print:hidden" : ""}`}>
        {/* ── 1. OPERATIONAL REGISTER HEADER ──────────────────────────── */}
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold mb-1 border border-emerald-500/20">
                <Receipt size={12} className="text-emerald-500" />
                <span>ORDER MANAGEMENT & CASHIER REGISTER</span>
                {activeRestaurantName && <span>• {activeRestaurantName}</span>}
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900 dark:text-white">
                Orders & Settlement Register
              </h1>
              <p className="text-stone-500 dark:text-stone-400 text-xs mt-0.5">
                High-density operational console for high-volume order dispatch, cash collection, and reconciliation.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {/* Density Toggle */}
              <div className="inline-flex rounded-xl bg-stone-100 dark:bg-white/5 p-1 border border-stone-200/60 dark:border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setDensity("compact")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    density === "compact"
                      ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                  }`}
                  title="Compact density for fast operational scanning"
                >
                  <Layers size={12} />
                  <span>Compact</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDensity("comfortable")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    density === "comfortable"
                      ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                  }`}
                  title="Comfortable density with relaxed padding"
                >
                  <span>Comfortable</span>
                </button>
              </div>

              {/* Refresh Sync Button */}
              <button
                type="button"
                onClick={() => fetchOrders(false)}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-70"
                title="Refresh orders and reconciliation ledger"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                <span>{refreshing ? "Syncing..." : "Sync"}</span>
              </button>
            </div>
          </div>

          {/* ── 4 COMPACT REVENUE & RECONCILIATION CARDS ───────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4 pt-3.5 border-t border-stone-100 dark:border-white/5">
            <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3 border border-stone-200/60 dark:border-white/5">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Total Revenue Settled
              </span>
              <div className="text-xl sm:text-2xl font-black mt-0.5 text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{metrics.totalCollected.toFixed(2)}
              </div>
              <span className="text-[10px] text-stone-400 block truncate">
                {metrics.settledCount} bill(s) in scope
              </span>
            </div>

            <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3 border border-stone-200/60 dark:border-white/5">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block flex items-center gap-1">
                <AlertTriangle size={11} /> Pending Settlement
              </span>
              <div className="text-xl sm:text-2xl font-black mt-0.5 text-amber-600 dark:text-amber-400 font-mono">
                ₹{metrics.pendingSettlementAmount.toFixed(2)}
              </div>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-bold block truncate">
                {metrics.pendingSettlementCount} COD ticket(s) with drivers
              </span>
            </div>

            <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3 border border-stone-200/60 dark:border-white/5">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                Pending Collection
              </span>
              <div className="text-xl sm:text-2xl font-black mt-0.5 text-rose-600 dark:text-rose-400 font-mono">
                ₹{metrics.pendingCollectionAmount.toFixed(2)}
              </div>
              <span className="text-[10px] text-stone-400 block truncate">
                Due upon delivery or counter handoff
              </span>
            </div>

            <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3 border border-stone-200/60 dark:border-white/5">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                Orders In View
              </span>
              <div className="text-xl sm:text-2xl font-black mt-0.5 text-stone-900 dark:text-white font-mono">
                {metrics.totalCount}
              </div>
              <span className="text-[10px] text-stone-400 block truncate">
                {activeDateLabel}
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. OPERATIONAL CONTROLS: SEARCH, CALENDAR & MULTI-FILTERS ── */}
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
          {/* Top Control Bar: Search + Date Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full lg:w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search order ID, customer name, phone, dish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Date Scope Selection: Today (Default), Yesterday, All Time, Calendar Picker */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="inline-flex rounded-xl bg-stone-100 dark:bg-white/5 p-0.5 border border-stone-200/60 dark:border-white/10 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDateRange("today");
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    dateRange === "today"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDateRange("yesterday");
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    dateRange === "yesterday"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                  }`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDateRange("all");
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    dateRange === "all"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                  }`}
                >
                  All Dates
                </button>
              </div>

              {/* Custom Date Input */}
              <div className="flex items-center gap-1 bg-stone-100 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 rounded-xl px-2 py-1 text-xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <input
                  type="date"
                  value={customDate}
                  max={todayStr}
                  onChange={(e) => {
                    if (e.target.value) {
                      setCustomDate(e.target.value);
                      setDateRange("custom");
                      setPage(1);
                    }
                  }}
                  className="bg-transparent text-stone-900 dark:text-white font-mono font-bold outline-none cursor-pointer text-xs"
                />
              </div>

              {/* Active Date Label Pill */}
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 hidden sm:inline ml-1">
                {activeDateLabel}
              </span>
            </div>
          </div>

          {/* Operational Filter Dropdowns Bar */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-stone-100 dark:border-white/5 text-xs">
            {/* Filter: Order Type */}
            <select
              value={orderTypeFilter}
              onChange={(e) => {
                setOrderTypeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200 font-semibold cursor-pointer outline-none text-xs"
            >
              <option value="all">Type: All</option>
              <option value="delivery">Type: Delivery</option>
              <option value="pickup">Type: Pickup</option>
            </select>

            {/* Filter: Payment Status */}
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
              className="bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200 font-semibold cursor-pointer outline-none text-xs"
            >
              <option value="all">Payment: All</option>
              <option value="paid">Payment: Paid</option>
              <option value="pending">Payment: Pending</option>
              <option value="failed">Payment: Failed</option>
              <option value="refunded">Payment: Refunded</option>
            </select>

            {/* Filter: Cash Collection Status */}
            <select
              value={collectionFilter}
              onChange={(e) => {
                setCollectionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200 font-semibold cursor-pointer outline-none text-xs"
            >
              <option value="all">Collection: All</option>
              <option value="collected">Collection: Collected</option>
              <option value="awaiting">Collection: Awaiting</option>
            </select>

            {/* Filter: Settlement Status */}
            <select
              value={settlementFilter}
              onChange={(e) => {
                setSettlementFilter(e.target.value);
                setPage(1);
              }}
              className="bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200 font-semibold cursor-pointer outline-none text-xs"
            >
              <option value="all">Settlement: All</option>
              <option value="settled">Settlement: Settled</option>
              <option value="pending">Settlement: Pending</option>
            </select>

            {/* Filter: Cancellation */}
            <select
              value={cancellationFilter}
              onChange={(e) => {
                setCancellationFilter(e.target.value);
                setPage(1);
              }}
              className="bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-2.5 py-1 text-stone-800 dark:text-stone-200 font-semibold cursor-pointer outline-none text-xs"
            >
              <option value="all">Status: All</option>
              <option value="active_only">Status: Active Orders</option>
              <option value="cancelled_only">Status: Cancelled Only</option>
            </select>

            {/* Reset All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
              >
                <X size={12} />
                <span>Reset Filters</span>
              </button>
            )}

            {/* Page Size Dropdown */}
            <div className="ml-auto flex items-center gap-1.5 text-[11px] text-stone-500">
              <span className="hidden sm:inline">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg px-2 py-0.5 text-stone-800 dark:text-stone-200 font-bold cursor-pointer outline-none text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── 3. HIGH-DENSITY COMPACT TABLE ───────────────────────────── */}
        {loading ? (
          <div className="py-20 text-center text-stone-500 dark:text-stone-400">
            <RefreshCw size={28} className="animate-spin mx-auto text-emerald-500 mb-3" />
            <p className="text-sm font-semibold">Loading orders register...</p>
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-3xl p-12 text-center">
            <Receipt className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              No orders found matching criteria
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? "Try clearing filters or adjusting your date range."
                : "No order records for this selected period."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs table-auto">
                {/* Sticky Column Headers */}
                <thead className="sticky top-0 z-10 bg-stone-100/95 dark:bg-[#151a28]/95 backdrop-blur-md border-b border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    {/* 1. Order Col with Sort */}
                    <th className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortBy === "createdAt") {
                            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                          } else {
                            setSortBy("createdAt");
                            setSortOrder("desc");
                          }
                        }}
                        className="inline-flex items-center gap-1 hover:text-stone-900 dark:hover:text-white cursor-pointer font-bold uppercase"
                      >
                        <span>Order</span>
                        <ArrowUpDown size={11} className={sortBy === "createdAt" ? "text-emerald-500" : "opacity-40"} />
                      </button>
                    </th>

                    {/* 2. Customer Col */}
                    <th className="py-2.5 px-3">Customer</th>

                    {/* 3. Items Col */}
                    <th className="py-2.5 px-3">Items</th>

                    {/* 4. Amount Col with Sort */}
                    <th className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortBy === "totalAmount") {
                            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                          } else {
                            setSortBy("totalAmount");
                            setSortOrder("desc");
                          }
                        }}
                        className="inline-flex items-center gap-1 hover:text-stone-900 dark:hover:text-white cursor-pointer font-bold uppercase"
                      >
                        <span>Amount</span>
                        <ArrowUpDown size={11} className={sortBy === "totalAmount" ? "text-emerald-500" : "opacity-40"} />
                      </button>
                    </th>

                    {/* 5. Payment Col */}
                    <th className="py-2.5 px-3">Payment</th>

                    {/* 6. Settlement Col */}
                    <th className="py-2.5 px-3">Settlement</th>

                    {/* 7. Actions Col */}
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-100 dark:divide-white/5">
                  {paginatedOrders.map((order) => {
                    const shortId = getShortOrderId(order);
                    const fullOrderId = order.orderId || order._id.toString();
                    const op = getOperationalStatus(order);
                    const isPickup =
                      order.isPickup ||
                      order.orderType === "pickup" ||
                      order.address?.addressType === "Takeaway" ||
                      order.address?.addressType === "pickup";

                    const isCopied = copySuccessId === fullOrderId;
                    const isRowMenuOpen = openMenuId === order._id;

                    const rowPadding = density === "compact" ? "py-2 px-3" : "py-3 px-3";

                    return (
                      <tr
                        key={order._id}
                        onClick={() => setDrawerOrder(order)}
                        className={`transition-colors cursor-pointer group ${
                          op.isCancelled
                            ? "bg-rose-500/[0.02] hover:bg-rose-500/[0.05]"
                            : "hover:bg-stone-50/80 dark:hover:bg-white/[0.03]"
                        }`}
                      >
                        {/* ── 1. ORDER COLUMN ── */}
                        <td className={rowPadding}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-stone-900 dark:text-white text-xs">
                              {shortId}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyOrderId(e, fullOrderId)}
                              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition p-0.5"
                              title={`Copy full ID: ${fullOrderId}`}
                            >
                              {isCopied ? (
                                <Check size={11} className="text-emerald-500" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                            {isPickup ? (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                Pickup
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                                Delivery
                              </span>
                            )}
                          </div>
                          <span className="block text-[10px] font-mono text-stone-500 dark:text-stone-400 mt-0.5 whitespace-nowrap">
                            {formatDisplayDateTime(order.createdAt)}
                          </span>
                        </td>

                        {/* ── 2. CUSTOMER COLUMN ── */}
                        <td className={rowPadding}>
                          <div className="font-semibold text-stone-900 dark:text-stone-200 text-xs truncate max-w-[130px]">
                            {order.address?.fullName || order.user?.name || "Walk-in Guest"}
                          </div>
                          {(order.address?.phone || order.user?.phone) && (
                            <span className="text-[10px] text-stone-400 font-mono block">
                              {order.address?.phone || order.user?.phone}
                            </span>
                          )}
                        </td>

                        {/* ── 3. ITEMS COLUMN ── */}
                        <td className={rowPadding}>
                          <span className="font-bold text-stone-700 dark:text-stone-300 text-xs">
                            {order.items?.length || 0} item(s)
                          </span>
                          <span className="block text-[10px] text-stone-400 truncate max-w-[160px]">
                            {order.items?.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                          </span>
                        </td>

                        {/* ── 4. AMOUNT COLUMN ── */}
                        <td className={`${rowPadding} font-black text-stone-900 dark:text-white font-mono text-xs whitespace-nowrap`}>
                          ₹{(order.totalAmount || 0).toFixed(2)}
                        </td>

                        {/* ── 5. PAYMENT COLUMN (Separate Operational States) ── */}
                        <td className={rowPadding}>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  op.paymentState === "paid"
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                    : op.paymentState === "refunded"
                                    ? "bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30"
                                    : op.paymentState === "failed" || op.paymentState === "cancelled"
                                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                }`}
                              >
                                {op.paymentLabel}
                              </span>
                              <span className="text-[10px] text-stone-500 font-semibold truncate max-w-[80px]">
                                {op.paymentMethod}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-400 block whitespace-nowrap">
                              {op.collectionLabel}
                            </span>
                          </div>
                        </td>

                        {/* ── 6. SETTLEMENT COLUMN (Prominent Pending Guard) ── */}
                        <td className={rowPadding}>
                          {op.settlementState === "settled" ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                                <CheckCircle2 size={10} />
                                Settled
                              </span>
                              <span className="block text-[10px] font-mono text-stone-400">
                                {formatDisplayDateTime(op.settlementTimestamp)}
                              </span>
                            </div>
                          ) : op.settlementState === "pending" ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 animate-pulse">
                                <AlertTriangle size={10} className="text-amber-600" />
                                Pending Settle
                              </span>
                              <span className="block text-[10px] font-semibold text-amber-700 dark:text-amber-300 truncate max-w-[140px]">
                                {op.settledBy}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-stone-400">
                              {op.settlementLabel}
                            </span>
                          )}
                        </td>

                        {/* ── 7. ACTIONS COLUMN (Single Accessible Menu) ── */}
                        <td className={`${rowPadding} text-right relative`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {/* Fast Direct Settle COD Button if Pending and Not Cancelled */}
                            {!op.isCancelled && op.canSettleCodWithManager && (
                              <button
                                type="button"
                                onClick={() => handleSettleCodCash(order._id)}
                                disabled={updatingId === order._id}
                                className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shadow-xs cursor-pointer disabled:opacity-50"
                                title="Reconcile and settle driver collected cash"
                              >
                                Settle COD
                              </button>
                            )}

                            {/* Direct Print Receipt Button */}
                            <button
                              type="button"
                              onClick={() => setReceiptOrder(order)}
                              className="p-1.5 rounded-lg bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition cursor-pointer"
                              title="Print Thermal 80mm Receipt"
                              aria-label="Print Receipt"
                            >
                              <Printer size={13} />
                            </button>

                            {/* Contextual Action Menu Button */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenMenuId(isRowMenuOpen ? null : order._id)}
                                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition cursor-pointer"
                                aria-label="Open Order Actions Menu"
                              >
                                <MoreVertical size={13} />
                              </button>

                              {/* Dropdown Menu Popover */}
                              {isRowMenuOpen && (
                                <div
                                  ref={menuRef}
                                  className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 shadow-xl py-1 z-30 text-left"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setDrawerOrder(order);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Eye size={12} className="text-emerald-500" />
                                    <span>View Details</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setReceiptOrder(order);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Printer size={12} className="text-blue-500" />
                                    <span>Print Receipt Slip</span>
                                  </button>

                                  {!op.isCancelled && op.paymentState !== "paid" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setSettlingOrder(order);
                                        setTenderedAmount((order.totalAmount || 0).toString());
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-bold flex items-center gap-2 cursor-pointer"
                                    >
                                      <CreditCard size={12} />
                                      <span>Settle Bill</span>
                                    </button>
                                  )}

                                  {!op.isCancelled && op.canSettleCodWithManager && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleSettleCodCash(order._id);
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 font-bold flex items-center gap-2 cursor-pointer"
                                    >
                                      <Banknote size={12} />
                                      <span>Settle COD Cash</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      setOpenMenuId(null);
                                      handleCopyOrderId(e, fullOrderId);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 flex items-center gap-2 cursor-pointer border-t border-stone-100 dark:border-white/5"
                                  >
                                    <Copy size={12} />
                                    <span>Copy Order ID</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── PAGINATION BAR ────────────────────────────────────────── */}
            <div className="bg-stone-50 dark:bg-white/5 border-t border-stone-200 dark:border-white/10 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-stone-500 font-mono">
                Showing {processedOrders.length === 0 ? 0 : (page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, processedOrders.length)} of {processedOrders.length} records
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-white/10 text-stone-700 dark:text-stone-300 font-bold border border-stone-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
                  title="First Page"
                >
                  «
                </button>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 text-stone-700 dark:text-stone-300 font-bold border border-stone-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
                  title="Previous Page"
                >
                  ‹ Prev
                </button>

                <span className="px-2 font-mono font-bold text-stone-800 dark:text-stone-200">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 text-stone-700 dark:text-stone-300 font-bold border border-stone-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
                  title="Next Page"
                >
                  Next ›
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-white/10 text-stone-700 dark:text-stone-300 font-bold border border-stone-200 dark:border-white/10 disabled:opacity-40 cursor-pointer"
                  title="Last Page"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. ORDER DETAILS DRAWER (Requirement 4) ──────────────────── */}
      {drawerOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 order-details-drawer no-print print:hidden">
          <div
            className="w-full max-w-lg bg-white dark:bg-[#121624] border-l border-stone-200 dark:border-white/10 h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-white/10 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-stone-900 dark:text-white text-base">
                    #{drawerOrder.orderId || drawerOrder._id.slice(-6).toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyOrderId(e, drawerOrder.orderId || drawerOrder._id.toString())}
                    className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded"
                    title="Copy full order ID"
                  >
                    {copySuccessId === (drawerOrder.orderId || drawerOrder._id.toString()) ? (
                      <Check size={13} className="text-emerald-500" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-white/10">
                    {drawerOrder.status?.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-stone-400">
                  📅 Placed: {formatDisplayDateTime(drawerOrder.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOrder(null)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/10 transition cursor-pointer"
                title="Close Drawer (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* Financial & Settlement Breakdown Card */}
              {(() => {
                const op = getOperationalStatus(drawerOrder);
                return (
                  <div className="bg-stone-50 dark:bg-white/5 rounded-2xl p-4 border border-stone-200/60 dark:border-white/5 space-y-2.5">
                    <h4 className="font-black text-stone-900 dark:text-white text-xs uppercase tracking-wider flex items-center justify-between">
                      <span>Billing & Ledger Summary</span>
                      <span className="font-mono text-emerald-600 text-sm">
                        ₹{(drawerOrder.totalAmount || 0).toFixed(2)}
                      </span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200/50 dark:border-white/5 text-[11px]">
                      <div>
                        <span className="text-stone-400 block">Payment State:</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          {op.paymentLabel} ({op.paymentMethod})
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Cash Collection:</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          {op.collectionLabel}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Settlement State:</span>
                        <span
                          className={`font-bold ${
                            op.settlementState === "pending"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-stone-800 dark:text-stone-200"
                          }`}
                        >
                          {op.settlementLabel}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block">Settlement Time:</span>
                        <span className="font-mono text-stone-800 dark:text-stone-200">
                          {formatDisplayDateTime(op.settlementTimestamp)}
                        </span>
                      </div>
                    </div>

                    {!op.isCancelled && op.canSettleCodWithManager && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleSettleCodCash(drawerOrder._id)}
                          disabled={updatingId === drawerOrder._id}
                          className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                        >
                          Reconcile & Settle COD Cash with Manager
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Itemized Dish Breakdown */}
              <div className="space-y-2">
                <h4 className="font-black text-stone-900 dark:text-white text-xs uppercase tracking-wider">
                  Itemized Order Dishes ({drawerOrder.items?.length || 0})
                </h4>
                <div className="divide-y divide-stone-100 dark:divide-white/5 border border-stone-200/60 dark:border-white/5 rounded-xl bg-stone-50/50 dark:bg-white/[0.02]">
                  {drawerOrder.items?.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="font-mono font-bold text-xs bg-stone-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-stone-800 dark:text-stone-200">
                          {item.quantity}×
                        </span>
                        <div>
                          <p className="font-bold text-stone-900 dark:text-white">{item.name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px] mt-0.5">
                            {item.variantName && (
                              <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                                {item.variantName}
                              </span>
                            )}
                            {(item.servingLabel || item.portionQuantity || item.size) && (
                              <span className="text-stone-500">
                                {item.servingLabel || (item.portionQuantity ? `${item.portionQuantity} ${item.portionUnit || ''}` : '')}
                                {item.size ? ` • ${item.size}` : ''}
                              </span>
                            )}
                          </div>
                          {Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 && (
                            <p className="text-[10px] text-stone-400">
                              {item.selectedOptions.map((o) => o.name || o).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-stone-900 dark:text-white shrink-0">
                        ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer & Delivery Destination Details */}
              <div className="space-y-2">
                <h4 className="font-black text-stone-900 dark:text-white text-xs uppercase tracking-wider">
                  Customer & Delivery Location
                </h4>
                <div className="p-3 rounded-xl border border-stone-200/60 dark:border-white/5 bg-stone-50/50 dark:bg-white/[0.02] space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Name:</span>
                    <span className="font-bold text-stone-900 dark:text-white">
                      {drawerOrder.address?.fullName || drawerOrder.user?.name || "Walk-in Guest"}
                    </span>
                  </div>
                  {(drawerOrder.address?.phone || drawerOrder.user?.phone) && (
                    <div className="flex justify-between">
                      <span className="text-stone-400">Phone:</span>
                      <a
                        href={`tel:${drawerOrder.address?.phone || drawerOrder.user?.phone}`}
                        className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {drawerOrder.address?.phone || drawerOrder.user?.phone}
                      </a>
                    </div>
                  )}
                  {drawerOrder.address?.street && (
                    <div className="flex justify-between">
                      <span className="text-stone-400">Address:</span>
                      <span className="text-right text-stone-700 dark:text-stone-300 max-w-[240px]">
                        {drawerOrder.address.street}, {drawerOrder.address.city}{" "}
                        {drawerOrder.address.pincode}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Driver & Handover Verification */}
              {drawerOrder.orderType !== "pickup" && (
                <div className="space-y-2">
                  <h4 className="font-black text-stone-900 dark:text-white text-xs uppercase tracking-wider">
                    Assigned Dispatch Partner
                  </h4>
                  <div className="p-3 rounded-xl border border-stone-200/60 dark:border-white/5 bg-stone-50/50 dark:bg-white/[0.02] space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-stone-400">Delivery Driver:</span>
                      <span className="font-bold text-stone-900 dark:text-white">
                        {drawerOrder.assignedDeliveryStaff?.name || "Awaiting Driver Claim"}
                      </span>
                    </div>
                    {drawerOrder.assignedDeliveryStaff?.phone && (
                      <div className="flex justify-between">
                        <span className="text-stone-400">Driver Phone:</span>
                        <a
                          href={`tel:${drawerOrder.assignedDeliveryStaff.phone}`}
                          className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {drawerOrder.assignedDeliveryStaff.phone}
                        </a>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-stone-400">Handover OTP State:</span>
                      <span className="font-bold text-stone-700 dark:text-stone-300">
                        {drawerOrder.status === "delivered"
                          ? "✓ Verified via Customer OTP"
                          : "Awaiting Doorstep Handover Verification"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cancellation & Refund Info (If Cancelled) */}
              {drawerOrder.status === "cancelled" && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                  <p className="font-bold uppercase tracking-wider text-[10px]">Order Cancelled</p>
                  <p>Reason: {drawerOrder.cancellationReason || "Cancelled by staff/customer"}</p>
                  <p className="text-[10px] text-stone-500">
                    Refund Status: {drawerOrder.refundDetails?.status || "none"}
                  </p>
                </div>
              )}

              {/* Chronological Lifecycle Timeline */}
              {Array.isArray(drawerOrder.statusHistory) && drawerOrder.statusHistory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-black text-stone-900 dark:text-white text-xs uppercase tracking-wider">
                    Order Event Log
                  </h4>
                  <div className="space-y-2 border-l-2 border-stone-200 dark:border-white/10 pl-3 ml-1 text-[11px] font-mono">
                    {drawerOrder.statusHistory.map((sh, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-stone-800 dark:text-stone-200 font-bold">
                          <span>[{sh.status?.toUpperCase()}]</span>
                          <span className="text-stone-400 text-[10px]">
                            {formatDisplayDateTime(sh.changedAt || sh.timestamp)}
                          </span>
                        </div>
                        <p className="text-stone-500 text-[10px]">{sh.note || "State transitioned"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Bottom Action Bar */}
            <div className="p-4 border-t border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-[#10141f] flex gap-2">
              <button
                type="button"
                onClick={() => setReceiptOrder(drawerOrder)}
                className="flex-1 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer size={14} />
                <span>Print Tax Receipt Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawerOrder(null)}
                className="px-4 py-2 rounded-xl bg-stone-200 dark:bg-white/10 text-stone-700 dark:text-stone-300 font-bold text-xs cursor-pointer hover:bg-stone-300 dark:hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. SETTLEMENT MODAL (Cash Calculator) ──────────────────────── */}
      {settlingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs pos-calculator-modal no-print print:hidden">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Receipt className="text-emerald-500 w-5 h-5" />
                <h3 className="font-extrabold text-base text-stone-900 dark:text-white">
                  Settle Bill #{getShortOrderId(settlingOrder)}
                </h3>
              </div>
              <button
                onClick={() => setSettlingOrder(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-stone-50 dark:bg-white/5 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-xs text-stone-600 dark:text-stone-400 font-semibold">
                  Total Bill Amount:
                </span>
                <span className="text-2xl font-black text-stone-900 dark:text-white font-mono">
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
                      className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-sm font-black text-stone-900 dark:text-white font-mono outline-none"
                  />
                  <div className="flex justify-between items-center text-xs font-bold p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                    <span>Change Due to Customer:</span>
                    <span className="text-base font-black font-mono">₹{changeDue.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-stone-200 dark:border-white/10 flex gap-2">
              <button
                type="button"
                onClick={() => setSettlingOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSettlePayment(settlingOrder._id, selectedMethod)}
                disabled={updatingId === settlingOrder._id}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {updatingId === settlingOrder._id ? "Settling..." : "Confirm Settlement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. PROFESSIONAL THERMAL RECEIPT MODAL ─────────────────────── */}
      {receiptOrder && (
        <div className="pos-receipt-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="pos-receipt-modal relative bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl my-auto space-y-4">
            <div className="no-print print:hidden flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Printer className="text-emerald-500 w-5 h-5" />
                <div>
                  <h3 className="font-extrabold text-sm text-stone-900 dark:text-white">
                    Official Tax Invoice & Receipt
                  </h3>
                  <p className="text-[10px] text-stone-400">80mm POS Thermal Slip</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                  title="Print Thermal Receipt (Ctrl + P)"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptOrder(null)}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white transition cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Thermal Paper Slip */}
            <div className="pos-receipt-paper bg-white text-stone-900 border border-stone-300/80 rounded-xl p-4 sm:p-5 shadow-inner font-mono text-xs select-none">
              {(() => {
                const restInfo = receiptOrder.restaurant || restaurantObj || {};
                const restDisplayName = restInfo.name || activeRestaurantName;
                const restAddress = restInfo.address?.street
                  ? `${restInfo.address.street}${restInfo.address.city ? `, ${restInfo.address.city}` : ""}`
                  : (restInfo.address?.addressLine1 || "");
                const restPhone = restInfo.phone || "";
                const restGstin = restInfo.gstin || "33AAAAA0000A1Z5";
                const restFssai = restInfo.fssai || "12423008000123";

                const itemsSubtotal = (receiptOrder.items || []).reduce(
                  (sum, it) => sum + (it.price || 0) * (it.quantity || 1),
                  0
                );
                const recordedTax = receiptOrder.tax ?? Math.round(itemsSubtotal * 0.05 * 100) / 100;
                const cgst = (recordedTax / 2).toFixed(2);
                const sgst = (recordedTax / 2).toFixed(2);
                const deliveryFee = receiptOrder.deliveryFee ?? (receiptOrder.orderType === "delivery" ? 40 : 0);
                const packagingFee = receiptOrder.packagingFee ?? 15;
                const discount = receiptOrder.discount || 0;
                const op = getOperationalStatus(receiptOrder);

                const custName = receiptOrder.address?.fullName || receiptOrder.user?.name || "Walk-in Guest";
                const custPhone = receiptOrder.address?.phone || receiptOrder.user?.phone || receiptOrder.phone || "—";
                const custAddress = [
                  receiptOrder.address?.street,
                  receiptOrder.address?.city,
                  receiptOrder.address?.pincode,
                ]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <>
                    <div className="text-center space-y-1 pb-2">
                      <h2 className="font-black text-base tracking-tight uppercase text-black">
                        {restDisplayName}
                      </h2>
                      <div className="text-[10px] font-semibold text-stone-600 uppercase tracking-widest">
                        OFFICIAL TAX INVOICE & CASH MEMO
                      </div>
                      {restAddress && <p className="text-[10px] text-stone-500">{restAddress}</p>}
                      <div className="text-[9px] text-stone-500 flex flex-wrap justify-center gap-x-2">
                        {restPhone && <span>Tel: {restPhone}</span>}
                        <span>GSTIN: {restGstin}</span>
                        <span>FSSAI: {restFssai}</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-stone-400 my-2" />

                    <div className="space-y-0.5 text-[11px] text-stone-700">
                      <div className="flex justify-between">
                        <span className="font-semibold text-stone-500">Invoice No:</span>
                        <span className="font-bold text-black font-mono">
                          INV-{(receiptOrder.orderId || receiptOrder._id).slice(-8).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-stone-500">Order ID:</span>
                        <span className="font-bold text-black font-mono">
                          #{receiptOrder.orderId || receiptOrder._id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-stone-500">Date & Time:</span>
                        <span className="text-stone-800 font-mono">
                          {formatDisplayDateTime(receiptOrder.createdAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-stone-500">Order Channel:</span>
                        <span className="font-bold text-black uppercase">
                          {receiptOrder.orderType || "DELIVERY"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-stone-500">Customer:</span>
                        <span className="font-bold text-black">{custName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-stone-500">Phone:</span>
                        <span className="font-mono text-stone-800">{custPhone}</span>
                      </div>
                      {custAddress && (
                        <div className="pt-0.5 text-[10px] text-stone-600">
                          <span className="font-semibold text-stone-500">Delivery Address: </span>
                          <span>{custAddress}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-b border-dashed border-stone-400 my-2" />

                    {/* Items Table Header */}
                    <div className="flex justify-between text-[10px] font-bold text-stone-600 pb-1 border-b border-stone-300">
                      <span className="w-8">QTY</span>
                      <span className="flex-1 text-left">ITEM</span>
                      <span className="w-14 text-right">RATE</span>
                      <span className="w-16 text-right">AMT</span>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-stone-200/70 text-[11px] py-1">
                      {receiptOrder.items?.map((item, idx) => {
                        const portionStr = item.servingLabel || (item.portionQuantity ? `${item.portionQuantity} ${item.portionUnit || ''}` : '') + (item.size ? ` (${item.size})` : '');
                        return (
                          <div key={idx} className="py-1 flex justify-between items-start gap-1">
                            <span className="w-8 font-bold text-black">{item.quantity}×</span>
                            <div className="flex-1 text-left">
                              <span className="font-semibold text-black">{item.name}</span>
                              {(item.variantName || portionStr) && (
                                <div className="text-[9px] text-stone-500 leading-tight">
                                  {item.variantName && <span className="font-bold text-stone-700 mr-1">[{item.variantName}]</span>}
                                  {portionStr}
                                </div>
                              )}
                            </div>
                            <span className="w-14 text-right text-stone-600 font-mono">
                              ₹{(item.price || 0).toFixed(2)}
                            </span>
                            <span className="w-16 text-right font-bold text-black font-mono">
                              ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-b border-dashed border-stone-400 my-1.5" />

                    {/* Financial Breakdown */}
                    <div className="space-y-0.5 text-[11px] text-stone-700">
                      <div className="flex justify-between">
                        <span>Items Subtotal:</span>
                        <span className="font-mono">₹{itemsSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-500">
                        <span>CGST (2.5%):</span>
                        <span className="font-mono">₹{cgst}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-500">
                        <span>SGST (2.5%):</span>
                        <span className="font-mono">₹{sgst}</span>
                      </div>
                      {deliveryFee > 0 && (
                        <div className="flex justify-between text-[10px]">
                          <span>Delivery Charge:</span>
                          <span className="font-mono">₹{deliveryFee.toFixed(2)}</span>
                        </div>
                      )}
                      {packagingFee > 0 && (
                        <div className="flex justify-between text-[10px]">
                          <span>Packaging & Handling:</span>
                          <span className="font-mono">₹{packagingFee.toFixed(2)}</span>
                        </div>
                      )}
                      {discount > 0 && (
                        <div className="flex justify-between text-[10px] text-emerald-600">
                          <span>Discount Applied:</span>
                          <span className="font-mono">-₹{discount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-b-2 border-stone-900 my-1.5" />

                    <div className="flex justify-between items-center text-sm font-black text-black py-0.5">
                      <span>TOTAL PAYABLE:</span>
                      <span className="text-base font-mono">₹{(receiptOrder.totalAmount || 0).toFixed(2)}</span>
                    </div>

                    <div className="border-b-2 border-stone-900 my-1.5" />

                    {/* Operational Status */}
                    <div className="pt-1 space-y-1 text-[11px]">
                      <div className="flex justify-between text-stone-600">
                        <span>Payment State:</span>
                        <span className="font-bold text-black uppercase">{op.paymentLabel}</span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Payment Method:</span>
                        <span className="font-bold text-black">{op.paymentMethod}</span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Cash Collection:</span>
                        <span className="font-bold text-black">
                          {op.collectionLabel}
                          {receiptOrder.codPaymentHandler?.name ? ` (${receiptOrder.codPaymentHandler.name})` : ""}
                        </span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Settlement State:</span>
                        <span className="font-bold text-black">{op.settlementLabel}</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-stone-400 my-2.5" />

                    <div className="text-center text-[10px] text-stone-500 pt-1 space-y-0.5">
                      <p className="font-semibold text-stone-600">
                        • Authentic Computer Generated Tax Invoice •
                      </p>
                      <p className="text-[9px] text-stone-400">
                        GST Compliant B2C Supply under Section 31 of CGST Act
                      </p>
                      <p className="font-bold text-stone-800 pt-1">*** THANK YOU FOR VISITING! ***</p>
                      <p className="text-[9px] text-stone-400">
                        Powered by पेट Protocols POS Kitchen OS
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="no-print print:hidden flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold text-xs"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
