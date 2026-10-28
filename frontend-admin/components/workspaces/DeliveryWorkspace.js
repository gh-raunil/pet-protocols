"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import Tooltip, { HelpTooltip } from "@/components/ui/Tooltip";
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
  Copy,
  ShieldCheck,
  KeyRound,
  X,
  Bike,
} from "lucide-react";
import {
  useDeliveryGpsTransmitter,
  isPickupOrder,
} from "@/hooks/useDeliveryGpsTransmitter";
import { getOrderDistanceInfo, buildMapplsDirectionUrl } from "@/lib/geoDistance";
import DeliveryRouteMap from "./DeliveryRouteMap";

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

  // Handover Verification (OTP) Modal State
  const [handoverModalOrder, setHandoverModalOrder] = useState(null);
  const [handoverOtpCode, setHandoverOtpCode] = useState("");
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);
  const [handoverError, setHandoverError] = useState("");
  const [handoverRemainingAttempts, setHandoverRemainingAttempts] = useState(null);

  const handleVerifyHandoverModal = async (e) => {
    if (e) e.preventDefault();
    if (!handoverModalOrder) return;
    const sanitizedCode = handoverOtpCode.trim();
    if (sanitizedCode.length !== 4 || !/^\d{4}$/.test(sanitizedCode)) {
      setHandoverError("Please enter the complete 4-digit code provided by the customer.");
      return;
    }

    setHandoverSubmitting(true);
    setHandoverError("");

    try {
      const order = handoverModalOrder;
      const isCod = isOrderCod(order);
      const isCollected = isCashCollected(order);
      const amount = Number(order.totalAmount || 0);

      const payload = {
        otpCode: sanitizedCode,
        notes: "Delivered to customer following successful OTP handover verification",
      };

      if (isCod && !isCollected) {
        payload.codPaymentHandler = {
          id: currentStaffId,
          name: currentStaffName,
          phone: currentStaffPhone,
          amount: amount,
          collected: true,
          collectedAt: new Date(),
          settledWithManager: false,
        };
      }

      const res = await fetch(`/api/restaurant/orders/${order._id}/verify-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setOrders((prev) => prev.map((o) => (o._id === order._id ? data.order : o)));

        if (
          gpsTransmitter.activeOrderId === order._id ||
          gpsTransmitter.activeOrderId === order.orderId
        ) {
          gpsTransmitter.stopTracking("stopped");
        }

        toast.success("Handover verified! Order marked delivered.", { icon: "🎉" });
        setHandoverModalOrder(null);
        setHandoverOtpCode("");
        setHandoverError("");
        setHandoverRemainingAttempts(null);
      } else {
        setHandoverError(data.message || "Failed to verify handover code.");
        if (data.remainingAttempts !== undefined) {
          setHandoverRemainingAttempts(data.remainingAttempts);
        }
      }
    } catch (err) {
      setHandoverError("Network error while verifying handover. Please check connection and retry.");
    } finally {
      setHandoverSubmitting(false);
    }
  };

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
  const [staffDeviceCoords, setStaffDeviceCoords] = useState(null);

  // Auto-acquire and watch staff device geolocation ONLY for delivery staff (managers do not share live GPS)
  useEffect(() => {
    if (isManager || typeof window === "undefined" || !navigator.geolocation) return;

    let isCancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isCancelled && pos?.coords) {
          setStaffDeviceCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        }
      },
      (err) => console.warn("Staff device GPS prompt:", err?.message),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isCancelled && pos?.coords) {
          setStaffDeviceCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      isCancelled = true;
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
      }
    };
  }, [isManager]);

  const isOrderCod = (order) => {
    if (!order) return false;
    const method = String(order.paymentMethod || "").toLowerCase();
    return method.includes("cod") || method.includes("cash") || order.paymentStatus === "pending";
  };

  const isCashCollected = (order) => {
    if (!order) return false;
    if (isOrderCod(order)) {
      return (order.status === "out_for_delivery" || order.status === "delivered") && Boolean(order.codPaymentHandler?.collected || order.paymentStatus === "paid");
    }
    return Boolean(order.paymentStatus === "paid" || order.paymentStatus === "test_paid");
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

      // Handle COD cash collection when marking delivered
      let codExtra = {};
      if (newStatus === "delivered") {
        if (currentOrder && isOrderCod(currentOrder) && !isCashCollected(currentOrder)) {
          const amount = Number(currentOrder.totalAmount || 0);
          if (!confirm(`Confirm collecting ₹${amount.toFixed(2)} in cash from customer and marking order delivered?`)) {
            return;
          }
          codExtra = {
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
          };
        }
      }

      setUpdatingId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          status: newStatus,
          ...codExtra,
          ...extra,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update locally
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, status: newStatus, ...codExtra, ...extra } : o))
        );

        if (newStatus === "delivered") {
          toast.success("Order marked delivered! Customer and Kitchen Manager notified.", { icon: "🎉" });
        }

        if (newStatus === "out_for_delivery") {
          toast.success("Order dispatched! Live GPS tracking activated for delivery.");
          if (!isManager && currentOrder) {
            gpsTransmitter.startTracking(orderId, currentOrder);
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
    if (order.status !== "out_for_delivery") {
      toast.error("Cash collection cannot be recorded before picking up the order.");
      return;
    }
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
        toast.success(`₹${amount.toFixed(2)} cash collected! Cash recorded in hand.`);
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

  // Helper: check if an order belongs to this particular staff member
  const isMyOrder = useCallback(
    (o) => {
      if (!o) return false;
      const staff = o.assignedDeliveryStaff;
      const handler = o.codPaymentHandler;

      if (currentStaffId) {
        if (staff?.id && String(staff.id) === String(currentStaffId)) return true;
        if (handler?.id && String(handler.id) === String(currentStaffId)) return true;
      }
      if (currentStaffPhone) {
        const cleanMy = String(currentStaffPhone).replace(/\D/g, "");
        if (cleanMy) {
          if (staff?.phone && String(staff.phone).replace(/\D/g, "") === cleanMy) return true;
          if (handler?.phone && String(handler.phone).replace(/\D/g, "") === cleanMy) return true;
        }
      }
      if (currentStaffName) {
        const sName = currentStaffName.toLowerCase().trim();
        if (sName) {
          if (staff?.name && staff.name.toLowerCase().trim() === sName) return true;
          if (handler?.name && handler.name.toLowerCase().trim() === sName) return true;
        }
      }
      return false;
    },
    [currentStaffId, currentStaffPhone, currentStaffName]
  );

  // Helper: check if order is explicitly in-progress/claimed by another named driver
  const isAssignedToOtherStaff = useCallback(
    (o) => {
      if (!o) return false;
      const staff = o.assignedDeliveryStaff;
      if (!staff || !staff.name) return false;
      const staffName = staff.name.toLowerCase().trim();
      if (staffName === "general delivery staff" || staffName === "delivery staff") return false;
      return !isMyOrder(o);
    },
    [isMyOrder]
  );

  // Auto-start live GPS tracking if delivery staff has an active transit order
  useEffect(() => {
    if (isManager || typeof window === "undefined" || !navigator.geolocation) return;
    if (gpsTransmitter.activeOrderId) return;

    const myActiveTransitOrder = orders.find(
      (o) => o.status === "out_for_delivery" && isMyOrder(o)
    );

    if (myActiveTransitOrder) {
      gpsTransmitter.startTracking(myActiveTransitOrder.orderId || myActiveTransitOrder._id, myActiveTransitOrder);
    }
  }, [orders, isManager, isMyOrder, gpsTransmitter.activeOrderId, gpsTransmitter.startTracking]);

  // Filtered orders: scoped so staff only sees unassigned pickup tasks or their own orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // In staff dashboard, do not show orders claimed/in-transit by other drivers
      if (!isManager && isAssignedToOtherStaff(o)) {
        return false;
      }

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
  }, [orders, statusFilter, searchQuery, isManager, isAssignedToOtherStaff]);

  // Operational metrics: scoped to this particular staff member when !isManager
  const metrics = useMemo(() => {
    const ready = orders.filter(
      (o) => (o.status === "preparing" || o.status === "ready") && (isManager || !isAssignedToOtherStaff(o))
    ).length;
    const inTransit = orders.filter(
      (o) => o.status === "out_for_delivery" && (isManager || isMyOrder(o))
    ).length;
    const deliveredToday = orders.filter(
      (o) => o.status === "delivered" && (isManager || isMyOrder(o))
    ).length;
    const codToCollect = orders
      .filter((o) => o.status === "out_for_delivery" && o.paymentStatus !== "paid" && (isManager || isMyOrder(o)))
      .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    return { ready, inTransit, deliveredToday, codToCollect };
  }, [orders, isManager, isAssignedToOtherStaff, isMyOrder]);

  // Comprehensive COD cash summary & reconciliation dataset: scoped to this particular staff member
  const codSummary = useMemo(() => {
    const allCodOrders = orders.filter((o) => {
      const mode = String(o.paymentMethod || "").toLowerCase();
      return (
        mode.includes("cod") ||
        mode.includes("cash") ||
        o.paymentStatus === "pending" ||
        o.codPaymentHandler?.collected
      );
    });

    // When viewing as staff (not manager), restrict COD dataset strictly to orders collected by this staff member
    const codOrders = isManager ? allCodOrders : allCodOrders.filter(isMyOrder);

    const collectedOrders = codOrders.filter((o) => o.status === "delivered" && (o.codPaymentHandler?.collected || o.paymentStatus === "paid"));
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

    let staffList = Object.values(staffMap);
    if (!isManager) {
      // In staff dashboard, only show this particular staff member's record
      staffList = staffList.filter(
        (s) =>
          (currentStaffId && String(s.staffId) === String(currentStaffId)) ||
          (currentStaffPhone && s.staffPhone === currentStaffPhone) ||
          (currentStaffName && s.staffName.toLowerCase().trim() === currentStaffName.toLowerCase().trim())
      );
    }

    return {
      codOrders,
      collectedOrders,
      unsettledOrders,
      settledOrders,
      totalCollected,
      totalUnsettled,
      totalSettled,
      staffList,
    };
  }, [orders, isManager, isMyOrder, currentStaffId, currentStaffPhone, currentStaffName]);

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
      {/* ── TOP ROLE OPERATIONAL HEADER ───────────────────────────── */}
      <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold mb-2 border border-blue-500/20">
              <Truck size={14} className="text-blue-500" />
              <span>DELIVERY & TRANSIT DISPATCH</span>
              {restaurantName && <span>• {restaurantName}</span>}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-white">
              Delivery Operations Portal
            </h1>
            <p className="text-stone-500 dark:text-stone-400 text-xs sm:text-sm mt-1 max-w-xl">
              Complete visibility into order contents, customer addresses, contact numbers, and payment collection status.
            </p>
          </div>

          <button
            onClick={() => loadOrders(false)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-70 self-start md:self-auto"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Sync Live Orders"}</span>
          </button>
        </div>

        {/* ── 4 KEY METRICS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5 pt-5 border-t border-stone-100 dark:border-white/5">
          <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              In Kitchen / Ready
            </span>
            <div className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400 font-mono">{metrics.ready}</div>
          </div>
          <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              Out in Transit
            </span>
            <div className="text-2xl font-black mt-1 text-blue-600 dark:text-blue-400 font-mono">{metrics.inTransit}</div>
          </div>
          <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Delivered Today
            </span>
            <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400 font-mono">{metrics.deliveredToday}</div>
          </div>
          <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
              COD To Collect
            </span>
            <div className="text-2xl font-black mt-1 text-stone-900 dark:text-white font-mono">
              ₹{metrics.codToCollect.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE TABS: DELIVERIES VS COD CASH REGISTER ─────────── */}
      <div className="flex items-center gap-2 border-b border-stone-200/80 dark:border-white/10 pb-3 flex-wrap">
        <Tooltip content="View active delivery tasks, turn-by-turn navigation, and customer doorstep orders" position="bottom">
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
        </Tooltip>

        <Tooltip content="Audit cash collected at doorsteps and reconcile cash deposits to the restaurant register" position="bottom">
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
        </Tooltip>
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
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50/50 dark:from-emerald-950/40 dark:via-[#101928] dark:to-indigo-950/40 border border-emerald-500/30 dark:border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-lg dark:shadow-emerald-500/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 relative">
                <Radio size={20} className={gpsTransmitter.trackingStatus === "sharing" ? "animate-pulse" : ""} />
                {gpsTransmitter.trackingStatus === "sharing" && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-ping" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    Live GPS Transmission Active
                  </span>
                  <span className="text-stone-400 dark:text-stone-500 text-xs">•</span>
                  <span className="font-extrabold text-sm text-stone-900 dark:text-white">
                    Order #{gpsTransmitter.activeOrderId}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      gpsTransmitter.trackingStatus === "sharing"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40"
                        : gpsTransmitter.trackingStatus === "requesting_permission"
                        ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 animate-pulse"
                        : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40"
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
                    <Tooltip content="Keeps phone screen on while driving to prevent background GPS transmission pauses" position="top">
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-300 dark:text-blue-300 dark:bg-blue-500/15 dark:border-blue-500/30 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1 cursor-help">
                        📱 Screen Awake
                      </span>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            <Tooltip content="Stop sharing your real-time GPS coordinates with the customer" position="left">
              <button
                onClick={() => gpsTransmitter.stopTracking("stopped")}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 dark:text-rose-300 dark:border-rose-500/40 font-bold px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-xs active:scale-95"
              >
                <Power size={13} />
                <span>Stop GPS Transmission</span>
              </button>
            </Tooltip>
          </div>

          {/* Telemetry Pills */}
          {gpsTransmitter.lastLocation && (
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap pt-2 border-t border-emerald-500/20 dark:border-white/10 text-xs">
              <span className="font-mono text-emerald-900 bg-white/90 border border-emerald-500/25 dark:text-emerald-300 dark:bg-white/5 dark:border-white/10 px-2.5 py-1 rounded-lg shadow-xs font-semibold">
                📍 {gpsTransmitter.lastLocation.latitude.toFixed(5)}, {gpsTransmitter.lastLocation.longitude.toFixed(5)}
              </span>

              {typeof gpsTransmitter.lastLocation.accuracy === "number" && (
                <span
                  className={`font-semibold px-2 py-1 rounded-lg border text-[11px] ${
                    gpsTransmitter.lastLocation.accuracy <= 20
                      ? "text-emerald-800 bg-emerald-100/80 border-emerald-300/80 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                      : gpsTransmitter.lastLocation.accuracy <= 50
                      ? "text-amber-800 bg-amber-100/80 border-amber-300/80 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20"
                      : "text-rose-800 bg-rose-100/80 border-rose-300/80 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20"
                  }`}
                >
                  🎯 ±{Math.round(gpsTransmitter.lastLocation.accuracy)}m accuracy
                </span>
              )}

              {typeof gpsTransmitter.lastLocation.speed === "number" && gpsTransmitter.lastLocation.speed > 0 && (
                <span className="text-blue-800 bg-blue-100/80 border border-blue-300/80 dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/20 px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1">
                  <Gauge size={12} />
                  <span>{Math.round(gpsTransmitter.lastLocation.speed * 3.6)} km/h</span>
                </span>
              )}

              {typeof gpsTransmitter.lastLocation.heading === "number" && gpsTransmitter.lastLocation.heading >= 0 && (
                <span className="text-stone-700 bg-white/90 border border-emerald-500/20 dark:text-stone-300 dark:bg-white/5 dark:border-white/10 px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1">
                  <Compass size={12} />
                  <span>{Math.round(gpsTransmitter.lastLocation.heading)}°</span>
                </span>
              )}

              {gpsTransmitter.lastSentTime && (
                <span className="text-stone-600 dark:text-stone-400 text-[11px] ml-auto font-medium">
                  Sent: {new Date(gpsTransmitter.lastSentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
          )}

          {gpsTransmitter.errorMessage && (
            <div className="text-xs text-amber-900 bg-amber-100 border border-amber-300 dark:text-amber-300/90 dark:bg-amber-500/10 dark:border-amber-500/20 rounded-xl p-2.5 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{gpsTransmitter.errorMessage}</span>
            </div>
          )}

          {/* Device and Background GPS Note */}
          <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed pt-1">
            ⚠️ <strong className="text-stone-800 dark:text-stone-200">Staff Note:</strong> Device location permission is required. Live updates are throttled to every 8–10 seconds. Note: GPS transmission runs in this active browser tab; background transmission may pause if your phone screen locks or the browser is minimized.
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
            const isCOD = isOrderCod(order);
            const isPaid = isCOD
              ? (order.status === "out_for_delivery" || order.status === "delivered") && (order.paymentStatus === "paid" || order.codPaymentHandler?.collected)
              : (order.paymentStatus === "paid" || order.paymentStatus === "test_paid");
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
                            isCOD
                              ? isPaid
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : order.status === "out_for_delivery"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 animate-pulse"
                                : "bg-stone-500/15 text-stone-700 dark:text-stone-300 border-stone-500/30"
                              : isPaid
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {isCOD
                            ? isPaid
                              ? "✓ CASH COLLECTED"
                              : order.status === "out_for_delivery"
                              ? "⚠️ COLLECT CASH AT DOORSTEP"
                              : "💵 CASH ON DELIVERY"
                            : isPaid
                            ? "✓ PAID ONLINE"
                            : "⚠️ PAYMENT PENDING"}
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

                      {order.assignedDeliveryStaff?.name && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          <span>🛵</span>
                          <span>
                            {isMyOrder(order)
                              ? "Assigned to You"
                              : `Delivery Boy: ${order.assignedDeliveryStaff.name}`}
                            {order.assignedDeliveryStaff.phone ? ` (${order.assignedDeliveryStaff.phone})` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Button for Delivery Flow */}
                  <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap justify-start sm:justify-end mt-2 sm:mt-0">
                    {(order.status === "preparing" || order.status === "ready") && (
                      isManager ? (
                        order.assignedDeliveryStaff?.id ? (
                          <Tooltip content="Dispatch packed food parcel for delivery transit" position="top">
                            <button
                              onClick={() => updateOrderStatus(order._id, "out_for_delivery")}
                              disabled={isUpdating}
                              className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
                            >
                              <Truck size={15} />
                              <span>Dispatch Order</span>
                            </button>
                          </Tooltip>
                        ) : (
                          <a
                            href="/delivery/assign"
                            className="min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 flex-1 sm:flex-none"
                          >
                            <Bike size={15} />
                            <span>Assign Driver First</span>
                          </a>
                        )
                      ) : isMyOrder(order) ? (
                        <Tooltip content="Pick up packed food parcel from kitchen and start transit to customer" position="top">
                          <button
                            onClick={() => updateOrderStatus(order._id, "out_for_delivery")}
                            disabled={isUpdating}
                            className="min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
                          >
                            <Truck size={15} />
                            <span>Dispatch Order</span>
                          </button>
                        </Tooltip>
                      ) : (
                        <Tooltip content="Pick up this packed food parcel directly from kitchen counter and deliver to customer" position="top">
                          <button
                            onClick={() => updateOrderStatus(order._id, "out_for_delivery", { selfPickup: true })}
                            disabled={isUpdating}
                            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
                          >
                            <Bike size={15} />
                            <span>Pick Up Parcel</span>
                          </button>
                        </Tooltip>
                      )
                    )}

                    {order.status === "out_for_delivery" && (
                      <>
                        {!isPickup && (
                          isManager ? (
                            <span className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border bg-stone-100 dark:bg-white/5 border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300">
                              {order.deliveryTracking?.isLive ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Driver Live GPS Active</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-stone-400" />
                                  <span>Awaiting Driver Live GPS</span>
                                </>
                              )}
                            </span>
                          ) : isOrderTracking ? (
                            <Tooltip content="Stop sharing your live GPS coordinates for this delivery" position="top">
                              <button
                                onClick={() => gpsTransmitter.stopTracking("stopped")}
                                className="min-h-[44px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Stop sending GPS coordinates for this order"
                              >
                                <Power size={14} />
                                <span>Stop Sharing GPS</span>
                              </button>
                            </Tooltip>
                          ) : (
                            <Tooltip content="Transmit your phone's real-time GPS location to the customer and restaurant manager" position="top">
                              <button
                                onClick={() => gpsTransmitter.startTracking(order.orderId || order._id, order)}
                                className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 flex-1 sm:flex-none"
                                title="Start transmitting real device GPS for this active delivery"
                              >
                                <Navigation size={14} />
                                <span>Share Live GPS</span>
                              </button>
                            </Tooltip>
                          )
                        )}

                        {/* Dual-Party Handover OTP View */}
                        <Tooltip content="View active 4-digit handover OTP code for customer coordination" position="top">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/restaurant/orders/${order._id}/otp`);
                                const data = await res.json();
                                if (data.success && data.otpCode) {
                                  toast(
                                    (t) => (
                                      <div className="flex flex-col gap-1">
                                        <span className="font-bold text-xs">Customer Handover Code:</span>
                                        <span className="text-2xl font-mono font-black text-emerald-600 tracking-widest">
                                          {data.otpCode}
                                        </span>
                                      </div>
                                    ),
                                    { duration: 6000, icon: "🔑" }
                                  );
                                } else {
                                  toast.error(data.message || "Failed to retrieve OTP.");
                                }
                              } catch {
                                toast.error("Network error retrieving OTP.");
                              }
                            }}
                            className="min-h-[44px] bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-700 dark:hover:bg-stone-600 font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <KeyRound size={14} />
                            <span>View OTP</span>
                          </button>
                        </Tooltip>

                        {/* Delivery Handover Action (Requires Customer OTP Verification) */}
                        <Tooltip content="Verify customer's 4-digit handover code at doorstep and complete delivery." position="top">
                          <button
                            onClick={() => {
                              setHandoverModalOrder(order);
                              setHandoverOtpCode("");
                              setHandoverError("");
                              setHandoverRemainingAttempts(null);
                            }}
                            disabled={isUpdating}
                            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 flex-1 sm:flex-none"
                          >
                            <KeyRound size={15} />
                            <span>Verify Handover (OTP)</span>
                          </button>
                        </Tooltip>
                      </>
                    )}

                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order._id)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{isExpanded ? "Hide Details" : "View Full Details"}</span>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
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

                    {/* GPS Coordinates & Mappls Navigation */}
                    {(() => {
                      const hasCustomerLiveGps = Boolean(order.customerLocation?.latitude && order.customerLocation?.longitude);
                      const hasPinnedGps = Boolean(order.address?.latitude && order.address?.longitude);
                      const navLat = order.address?.latitude || order.customerLocation?.latitude;
                      const navLng = order.address?.longitude || order.customerLocation?.longitude;

                      if (!navLat || !navLng) return null;

                      const isMapOpen = expandedMapOrderIds.has(order._id);
                      const distInfo = getOrderDistanceInfo(order);

                      // Determine staff / rider live origin coordinates
                      const effectiveStaffLat =
                        gpsTransmitter.lastLocation?.latitude ??
                        staffDeviceCoords?.latitude ??
                        order.deliveryTracking?.currentLocation?.latitude ??
                        distInfo?.restCoords?.lat;

                      const effectiveStaffLng =
                        gpsTransmitter.lastLocation?.longitude ??
                        staffDeviceCoords?.longitude ??
                        order.deliveryTracking?.currentLocation?.longitude ??
                        distInfo?.restCoords?.lng;

                      const hasLiveStaff = Boolean(
                        gpsTransmitter.lastLocation?.latitude ||
                        staffDeviceCoords?.latitude ||
                        order.deliveryTracking?.currentLocation?.latitude
                      );

                      const staffLabel = hasLiveStaff
                        ? (currentStaffName || "Staff Location")
                        : (restaurantName || "Restaurant Kitchen");

                      const customerLabel =
                        order.recipientName ||
                        order.address?.recipientName ||
                        order.address?.fullName ||
                        order.user?.name ||
                        "Customer Destination";

                      const mapplsUrl = buildMapplsDirectionUrl({
                        startLat: effectiveStaffLat,
                        startLng: effectiveStaffLng,
                        startLabel: staffLabel,
                        destLat: navLat,
                        destLng: navLng,
                        destLabel: customerLabel,
                        mode: "driving",
                      });

                      const handleStartMappls = (e) => {
                        // If we already have full Mappls URL with live staff coordinates, proceed directly
                        if (mapplsUrl && effectiveStaffLat && effectiveStaffLng) return;

                        // If staff device GPS was still acquiring, request high-accuracy position before launching
                        if (typeof window !== "undefined" && navigator.geolocation) {
                          e.preventDefault();
                          const newTab = window.open("about:blank", "_blank");
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              const sLat = pos.coords.latitude;
                              const sLng = pos.coords.longitude;
                              setStaffDeviceCoords({
                                latitude: sLat,
                                longitude: sLng,
                                accuracy: pos.coords.accuracy,
                              });
                              const freshUrl = buildMapplsDirectionUrl({
                                startLat: sLat,
                                startLng: sLng,
                                startLabel: currentStaffName || "Staff Location",
                                destLat: navLat,
                                destLng: navLng,
                                destLabel: customerLabel,
                                mode: "driving",
                              });
                              if (newTab) {
                                newTab.location.href = freshUrl || mapplsUrl;
                              }
                            },
                            () => {
                              if (newTab) {
                                newTab.location.href = mapplsUrl;
                              }
                            },
                            { enableHighAccuracy: true, timeout: 4000, maximumAge: 10000 }
                          );
                        }
                      };

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

                            {distInfo?.isOutOfRange ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                ⚠️ Out of Range: {distInfo.distanceKm} km
                              </span>
                            ) : distInfo?.distanceKm ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-stone-300">
                                🛵 {distInfo.distanceKm} km away
                              </span>
                            ) : null}

                            <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                              {Number(navLat).toFixed(5)}, {Number(navLng).toFixed(5)}
                            </span>
                          </div>

                          {/* Action Buttons: 1-Tap Mappls Navigation & Toggle Full-Width Map */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {/* Primary: Turn-by-Turn Voice Navigation in Native Mappls */}
                            <Tooltip content="Launch turn-by-turn voice directions directly to the doorstep in Mappls" position="top">
                              <a
                                href={mapplsUrl}
                                onClick={handleStartMappls}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-extrabold text-xs shadow-xs transition cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98"
                                title="Launch turn-by-turn voice directions directly in Mappls"
                              >
                                <Navigation size={13} />
                                <span>🚀 Start Mappls Navigation</span>
                                <ExternalLink size={11} className="opacity-75" />
                              </a>
                            </Tooltip>

                            {/* Secondary: Toggle Full-Width Screen Map */}
                            <Tooltip content={isMapOpen ? "Collapse doorstep route map" : "Display interactive route map with customer pin"} position="top">
                              <button
                                type="button"
                                onClick={() => toggleDoorstepMap(order._id)}
                                className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-extrabold text-xs shadow-xs transition cursor-pointer ${
                                  isMapOpen
                                    ? "bg-stone-800 dark:bg-stone-700 hover:bg-stone-900 text-white border border-stone-600/30"
                                    : "bg-blue-600 hover:bg-blue-700 text-white"
                                }`}
                              >
                                <MapPin size={13} className={isMapOpen ? "text-blue-400" : ""} />
                                <span>{isMapOpen ? "🗺️ Hide Doorstep Map" : "🗺️ View Live Map (Mappls)"}</span>
                                <ChevronDown size={14} className={`transition-transform duration-200 opacity-80 ${isMapOpen ? "rotate-180" : ""}`} />
                              </button>
                            </Tooltip>
                          </div>
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
                              : isCOD
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isCOD
                            ? isPaid
                              ? "Fully Paid (Cash Collected)"
                              : order.status === "out_for_delivery"
                              ? "Due at Doorstep"
                              : "Cash on Delivery (Pending Handover)"
                            : isPaid
                            ? "Fully Paid (No Cash Required)"
                            : "Unpaid / Payment Pending"}
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

                    {isCOD && !isPaid && (
                      <div className="pt-2 border-t border-stone-100 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
                        {order.status === "out_for_delivery" ? (
                          <>
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                              <AlertTriangle size={13} className="shrink-0" />
                              <span>Cash Pending Collection</span>
                            </span>
                            <Tooltip content="Record that cash was physically collected from customer at doorstep" position="top">
                              <button
                                type="button"
                                onClick={() => handleCollectCash(order)}
                                disabled={updatingId !== null}
                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                              >
                                <Banknote size={14} />
                                <span>Record Cash Collection</span>
                              </button>
                            </Tooltip>
                          </>
                        ) : (
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 font-semibold flex items-center gap-1.5">
                            <Receipt size={13} className="text-stone-400 shrink-0" />
                            <span>Cash collection available upon doorstep delivery (After pickup)</span>
                          </span>
                        )}
                      </div>
                    )}

                    {!isCOD && !isPaid && (
                      <div className="pt-2 border-t border-stone-100 dark:border-white/5 flex items-center justify-between">
                        <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                          <AlertTriangle size={13} />
                          <span>Online payment incomplete</span>
                        </span>
                      </div>
                    )}

                    {isPaid && isOrderCod(order) && (order.status === "out_for_delivery" || order.status === "delivered") && order.codPaymentHandler?.collected && (
                      <div className="pt-2 border-t border-stone-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                        <span className="text-stone-600 dark:text-stone-300 flex items-center gap-1 text-[11px]">
                          <BadgeCheck size={13} className="text-emerald-500 shrink-0" />
                          <span>Collected by <strong>{order.codPaymentHandler?.name || currentStaffName}</strong></span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === "cancelled"
                              ? "bg-stone-500/10 text-stone-600 dark:text-stone-400"
                              : order.codPaymentHandler?.settledWithManager
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          }`}>
                            {order.status === "cancelled"
                              ? "Void (Cancelled)"
                              : order.codPaymentHandler?.settledWithManager
                              ? "✓ Settled with Manager"
                              : "In Driver's Hand (Pending Handover)"}
                          </span>
                          {isManager && order.status !== "cancelled" && !order.codPaymentHandler?.settledWithManager && (
                            <Tooltip content="Acknowledge cash deposit into the restaurant cash register" position="top">
                              <button
                                onClick={() => handleSettleCash(order._id)}
                                disabled={updatingId !== null}
                                className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                              >
                                Settle Now
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── FULL-WIDTH BIG DOORSTEP NAVIGATION MAP SCREEN ────── */}
                {(() => {
                  const navLat = order.address?.latitude || order.customerLocation?.latitude;
                  const navLng = order.address?.longitude || order.customerLocation?.longitude;
                  const isMapOpen = expandedMapOrderIds.has(order._id);

                  if (!isMapOpen || !navLat || !navLng) return null;

                  const customerPhone = order.address?.recipientPhone || order.address?.phone;
                  const customerName = order.address?.recipientName || order.address?.fullName || "Customer";
                  const fullAddress = [
                    order.address?.street,
                    order.address?.city,
                    order.address?.state,
                    order.address?.pincode ? `- ${order.address.pincode}` : "",
                  ]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <div className="border-t border-stone-200/80 dark:border-white/10 p-3 sm:p-5 bg-stone-100/60 dark:bg-black/25 w-full transition-all space-y-3">
                      {/* Clean Map Toolbar (prevents repeating customer contact/address already shown in the card above) */}
                      <div className="flex items-center justify-between px-1 py-0.5 flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                            <MapPin size={13} className="text-blue-500" />
                            <span>Interactive Route Map</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof navigator !== "undefined" && navigator.clipboard) {
                                navigator.clipboard.writeText(`${navLat}, ${navLng}`);
                                toast.success("GPS coordinates copied to clipboard!");
                              }
                            }}
                            className="inline-flex items-center gap-1 font-mono text-[10px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 bg-white dark:bg-white/10 px-2 py-0.5 rounded border border-stone-200 dark:border-white/10 transition cursor-pointer"
                            title="Click to copy GPS coordinates"
                          >
                            <Copy size={10} />
                            <span>{Number(navLat).toFixed(4)}, {Number(navLng).toFixed(4)}</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleDoorstepMap(order._id)}
                          className="text-[11px] font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/10 transition"
                        >
                          ✕ Close Map
                        </button>
                      </div>

                      <DeliveryRouteMap
                        origin={
                          !isManager && gpsTransmitter.lastLocation?.latitude
                            ? {
                                lat: gpsTransmitter.lastLocation.latitude,
                                lng: gpsTransmitter.lastLocation.longitude,
                                heading: gpsTransmitter.lastLocation.heading,
                              }
                            : !isManager && staffDeviceCoords?.latitude
                            ? {
                                lat: staffDeviceCoords.latitude,
                                lng: staffDeviceCoords.longitude,
                                heading: 0,
                              }
                            : order.deliveryTracking?.currentLocation?.latitude
                            ? {
                                lat: order.deliveryTracking.currentLocation.latitude,
                                lng: order.deliveryTracking.currentLocation.longitude,
                                heading: order.deliveryTracking.currentLocation.heading,
                              }
                            : null
                        }
                        isManagerView={isManager}
                        restaurant={order.restaurant}
                        deliveryTracking={order.deliveryTracking}
                        destination={{
                          lat: navLat,
                          lng: navLng,
                          latitude: navLat,
                          longitude: navLng,
                          street: order.address?.street,
                          city: order.address?.city,
                          pincode: order.address?.pincode,
                          phone: order.address?.phone,
                          recipientPhone: order.address?.recipientPhone,
                        }}
                        customerLocation={order.customerLocation}
                        orderId={order.orderId || order._id}
                        initialStatus={order.status}
                        recipientName={order.address?.recipientName || order.address?.fullName}
                      />
                    </div>
                  );
                })()}

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

          {isManager && (
            <>
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
                  <span className="text-[11px] text-stone-400">
                    across {codSummary.staffList.length} staff members
                  </span>
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
                    {codSummary.totalUnsettled > 0 && (
                      <Tooltip content="Confirm deposit of all collected cash into the restaurant cash register" position="top">
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
                      </Tooltip>
                    )}

                    <Tooltip content="Export an Excel/CSV audit spreadsheet of all COD orders, handlers, and settlement logs" position="top">
                      <button
                        onClick={downloadCodReport}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-white/10 hover:bg-stone-200 dark:hover:bg-white/15 text-stone-800 dark:text-stone-200 text-xs font-bold transition cursor-pointer"
                      >
                        <FileSpreadsheet size={14} className="text-emerald-500" />
                        <span>Export CSV Report</span>
                      </button>
                    </Tooltip>
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

                          {staff.unsettledAmount > 0 ? (
                            <Tooltip content={`Confirm receipt of physical cash from ${staff.staffName} into register`} position="top">
                              <button
                                onClick={() => handleSettleCash(staff.orderIds, staff.staffName)}
                                disabled={updatingId !== null}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                              >
                                <Check size={14} />
                                <span>Confirm Handover & Settle (₹{staff.unsettledAmount.toFixed(2)})</span>
                              </button>
                            </Tooltip>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                              <Check size={14} className="text-emerald-500" />
                              <span>All Cash Handed Over</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Order-by-Order COD Cash Log */}
          <div className="bg-white dark:bg-[#10141f] rounded-2xl border border-stone-200/90 dark:border-white/10 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-stone-900 dark:text-white uppercase tracking-wider">
                  {isManager ? "Individual COD Orders Cash Audit Log" : "My COD Orders Cash Audit Log"} ({codSummary.collectedOrders.length})
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  {isManager
                    ? "Order-by-order breakdown of collected cash and settlement status."
                    : "Order-by-order history of cash collected by you and manager verification."}
                </p>
              </div>
              <button
                onClick={downloadCodReport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-white/10 hover:bg-stone-200 dark:hover:bg-white/15 text-stone-800 dark:text-stone-200 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                <FileSpreadsheet size={14} className="text-emerald-500" />
                <span>Export CSV Report</span>
              </button>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-white/5">
              {codSummary.collectedOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400">
                  {isManager ? "No collected COD orders found." : "No collected COD orders found for your profile today."}
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
      {/* ── SECURE DELIVERY HANDOVER OTP MODAL ────────────────────────── */}
      {handoverModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#151926] rounded-3xl border border-stone-200 dark:border-white/10 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 overflow-hidden relative">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                    Verify Customer Handover
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                    Order #{handoverModalOrder.orderId || handoverModalOrder._id.slice(-6).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!handoverSubmitting) {
                    setHandoverModalOrder(null);
                    setHandoverOtpCode("");
                    setHandoverError("");
                    setHandoverRemainingAttempts(null);
                  }
                }}
                disabled={handoverSubmitting}
                aria-label="Close Handover Dialog"
                className="min-w-[44px] min-h-[44px] -mr-1 -mt-1 rounded-2xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-500 transition cursor-pointer disabled:opacity-40 flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>

            {/* Recipient / Address Summary */}
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold text-stone-900 dark:text-white">
                <span className="truncate">{handoverModalOrder.address?.fullName || "Customer"}</span>
                {handoverModalOrder.address?.phone && (
                  <span className="font-mono text-stone-500 text-[11px]">{handoverModalOrder.address.phone}</span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                {[handoverModalOrder.address?.street, handoverModalOrder.address?.city].filter(Boolean).join(", ")}
              </p>
            </div>

            {/* COD Cash Collection Notice if applicable */}
            {isOrderCod(handoverModalOrder) && !isCashCollected(handoverModalOrder) && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <Banknote size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                  <p className="font-extrabold">Cash Collection Required</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    Collect <span className="font-bold underline">₹{Number(handoverModalOrder.totalAmount || 0).toFixed(2)}</span> in cash from customer upon verifying the code.
                  </p>
                </div>
              </div>
            )}

            {/* Verification Form */}
            <form onSubmit={handleVerifyHandoverModal} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  4-Digit Handover Code (OTP)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoFocus
                  value={handoverOtpCode}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setHandoverOtpCode(clean);
                    if (handoverError) setHandoverError("");
                  }}
                  placeholder="0000"
                  className="w-full text-center font-mono text-3xl font-black tracking-[0.5em] py-3.5 px-4 min-h-[56px] rounded-2xl border-2 border-emerald-500/40 focus:border-emerald-500 focus:outline-hidden bg-stone-50 dark:bg-black/30 text-stone-900 dark:text-white transition shadow-inner"
                  disabled={handoverSubmitting}
                />
                <p className="text-[11px] text-stone-500 text-center">
                  Ask the customer to read the 4-digit code displayed on their live tracking screen.
                </p>
              </div>

              {/* Error / Attempt Warning Banner */}
              {handoverError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{handoverError}</p>
                    {handoverRemainingAttempts !== null && (
                      <p className="text-[11px] mt-0.5">
                        {handoverRemainingAttempts} verification attempt{handoverRemainingAttempts === 1 ? "" : "s"} remaining before lockout.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setHandoverModalOrder(null);
                    setHandoverOtpCode("");
                    setHandoverError("");
                    setHandoverRemainingAttempts(null);
                  }}
                  disabled={handoverSubmitting}
                  className="flex-1 min-h-[48px] py-3.5 px-4 rounded-xl border border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300 font-bold text-xs sm:text-sm hover:bg-stone-100 dark:hover:bg-white/5 transition cursor-pointer disabled:opacity-40 flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={handoverSubmitting || handoverOtpCode.trim().length !== 4}
                  className="flex-1 min-h-[48px] py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {handoverSubmitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Verify & Deliver</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
