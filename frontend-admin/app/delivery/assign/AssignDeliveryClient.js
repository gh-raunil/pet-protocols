"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Bike,
  Truck,
  UserCheck,
  UserX,
  Phone,
  PhoneCall,
  MapPin,
  Clock,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  Send,
  User,
  KeyRound,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  DollarSign,
  Package,
} from "lucide-react";
import FeatureGuard from "@/components/auth/FeatureGuard";
import Tooltip from "@/components/ui/Tooltip";

export default function AssignDeliveryClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const userRole = session?.user?.role;
  const staffRoles = Array.isArray(session?.user?.staffRoles) ? session.user.staffRoles : [];
  const isLeadAdmin =
    userRole === "restaurant_admin" ||
    userRole === "admin" ||
    userRole === "lead_admin" ||
    userRole === "superadmin";
  const isManager = isLeadAdmin || staffRoles.includes("Manager");
  const currentManagerName = session?.user?.name || "Manager";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/delivery/assign");
    }
  }, [status, router]);

  // Data states
  const [orders, setOrders] = useState([]);
  const [deliveryStaff, setDeliveryStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'unassigned' | 'assigned' | 'self_delivery' | 'ready' | 'in_transit'

  // Modals state
  const [assignModalOrder, setAssignModalOrder] = useState(null);
  const [selectedStaffForAssign, setSelectedStaffForAssign] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const [selfDeliveryModalOrder, setSelfDeliveryModalOrder] = useState(null);
  const [selfDeliverySubmitting, setSelfDeliverySubmitting] = useState(false);

  // OTP inspection modal state
  const [otpModalOrder, setOtpModalOrder] = useState(null);
  const [inspectingOtp, setInspectingOtp] = useState(false);
  const [activeOtpData, setActiveOtpData] = useState(null);
  const [otpError, setOtpError] = useState("");

  // Manager completion / handover modal
  const [completeHandoverModalOrder, setCompleteHandoverModalOrder] = useState(null);
  const [handoverOtpInput, setHandoverOtpInput] = useState("");
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);
  const [handoverError, setHandoverError] = useState("");

  // Load Data
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError("");

      const [ordersRes, staffRes] = await Promise.all([
        fetch("/api/restaurant/orders"),
        fetch("/api/restaurant/delivery-staff"),
      ]);

      const ordersData = await ordersRes.json();
      const staffData = await staffRes.json();

      if (ordersData.success && Array.isArray(ordersData.orders)) {
        // Filter strictly to delivery orders (pickups do not need delivery assignment)
        const deliveryOrders = ordersData.orders.filter(
          (o) => o.orderType !== "pickup" && o.status !== "cancelled"
        );
        setOrders(deliveryOrders);
      } else {
        setError(ordersData.message || "Failed to load restaurant orders.");
      }

      if (staffData.success && Array.isArray(staffData.deliveryStaff)) {
        setDeliveryStaff(staffData.deliveryStaff);
      }
    } catch (err) {
      console.error("[AssignDeliveryClient Load Error]", err);
      setError("Network error fetching delivery assignment data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Filtered orders awaiting assignment or active in delivery
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Tab filter
      const isSelf = o.deliveryAssignmentMode === "manager_self_delivery";
      const hasDriver = Boolean(o.assignedDeliveryStaff?.id);

      if (filterTab === "unassigned" && hasDriver) return false;
      if (filterTab === "assigned" && (!hasDriver || isSelf)) return false;
      if (filterTab === "self_delivery" && !isSelf) return false;
      if (filterTab === "ready" && o.status !== "ready") return false;
      if (filterTab === "in_transit" && o.status !== "out_for_delivery") return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const cleanOrderId = (o.orderId || o._id || "").toLowerCase();
      const custName = (o.address?.fullName || "").toLowerCase();
      const custPhone = (o.address?.phone || "").toLowerCase();
      const street = (o.address?.street || "").toLowerCase();
      const driverName = (o.assignedDeliveryStaff?.name || "").toLowerCase();

      return (
        cleanOrderId.includes(q) ||
        custName.includes(q) ||
        custPhone.includes(q) ||
        street.includes(q) ||
        driverName.includes(q)
      );
    });
  }, [orders, filterTab, searchQuery]);

  // Operational metrics
  const metrics = useMemo(() => {
    const unassignedCount = orders.filter(
      (o) => !o.assignedDeliveryStaff?.id && ["confirmed", "preparing", "ready"].includes(o.status)
    ).length;
    const readyCount = orders.filter((o) => o.status === "ready").length;
    const inTransitCount = orders.filter((o) => o.status === "out_for_delivery").length;
    const selfDeliveryCount = orders.filter(
      (o) => o.deliveryAssignmentMode === "manager_self_delivery" && o.status !== "delivered"
    ).length;
    const activeStaffCount = deliveryStaff.filter((s) => s.isActive).length;

    return {
      unassignedCount,
      readyCount,
      inTransitCount,
      selfDeliveryCount,
      activeStaffCount,
    };
  }, [orders, deliveryStaff]);

  // Handler: Assign Staff Member to Order
  async function handleConfirmAssignStaff() {
    if (!assignModalOrder || !selectedStaffForAssign) return;

    setAssignSubmitting(true);
    try {
      const res = await fetch(`/api/restaurant/orders/${assignModalOrder._id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryStaffId: selectedStaffForAssign._id,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        toast.success(
          `Order #${data.order.orderId || data.order._id.slice(-6).toUpperCase()} assigned to ${selectedStaffForAssign.name}!`,
          { icon: "🛵" }
        );
        setOrders((prev) => prev.map((o) => (o._id === data.order._id ? data.order : o)));
        setAssignModalOrder(null);
        setSelectedStaffForAssign(null);
        loadData(true);
      } else {
        toast.error(data.message || "Failed to assign delivery person.");
      }
    } catch (err) {
      toast.error("Network error submitting assignment.");
    } finally {
      setAssignSubmitting(false);
    }
  }

  // Handler: Manager "Deliver This Order Myself"
  async function handleConfirmSelfDelivery() {
    if (!selfDeliveryModalOrder) return;

    setSelfDeliverySubmitting(true);
    try {
      const res = await fetch(`/api/restaurant/orders/${selfDeliveryModalOrder._id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfDelivery: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        toast.success(
          `Self-delivery confirmed! You are assigned to deliver Order #${data.order.orderId || data.order._id.slice(-6).toUpperCase()}.`,
          { icon: "🚗" }
        );
        setOrders((prev) => prev.map((o) => (o._id === data.order._id ? data.order : o)));
        setSelfDeliveryModalOrder(null);
        loadData(true);
      } else {
        toast.error(data.message || "Failed to set manager self-delivery.");
      }
    } catch (err) {
      toast.error("Network error submitting self-delivery.");
    } finally {
      setSelfDeliverySubmitting(false);
    }
  }

  // Handler: Manager Dispatch Order (Assisted or Self-Delivery)
  async function handleManagerDispatch(order) {
    if (!order.assignedDeliveryStaff?.id) {
      toast.error("Cannot dispatch order without an assigned delivery person. Please assign first.");
      return;
    }

    const confirmMsg =
      order.deliveryAssignmentMode === "manager_self_delivery"
        ? `Confirm dispatching Order #${order.orderId || order._id} for your personal delivery? Live GPS tracking and customer OTP will become active.`
        : `Confirm dispatching Order #${order.orderId || order._id} assigned to ${order.assignedDeliveryStaff.name}? The driver will proceed with delivery transit.`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order._id,
          status: "out_for_delivery",
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        toast.success("Order dispatched out for delivery! Handover OTP is now active.", { icon: "🚀" });
        setOrders((prev) => prev.map((o) => (o._id === data.order._id ? data.order : o)));
        loadData(true);
      } else {
        toast.error(data.message || "Failed to dispatch order.");
      }
    } catch (err) {
      toast.error("Network error dispatching order.");
    }
  }

  // Handler: Inspect Active Delivery OTP
  async function handleInspectOtp(order) {
    setOtpModalOrder(order);
    setInspectingOtp(true);
    setActiveOtpData(null);
    setOtpError("");

    try {
      const res = await fetch(`/api/restaurant/orders/${order._id}/otp`);
      const data = await res.json();
      if (data.success && data.otpCode) {
        setActiveOtpData(data);
      } else {
        setOtpError(data.message || "Unable to retrieve active delivery OTP.");
      }
    } catch (err) {
      setOtpError("Network error retrieving OTP.");
    } finally {
      setInspectingOtp(false);
    }
  }

  // Handler: Complete Delivery (Verify OTP as Manager)
  async function handleVerifyOtpSubmit(e) {
    if (e) e.preventDefault();
    if (!completeHandoverModalOrder) return;

    const sanitized = handoverOtpInput.trim();
    if (sanitized.length !== 4 || !/^\d{4}$/.test(sanitized)) {
      setHandoverError("Please enter the complete 4-digit numeric code.");
      return;
    }

    setHandoverSubmitting(true);
    setHandoverError("");

    try {
      const res = await fetch(`/api/restaurant/orders/${completeHandoverModalOrder._id}/verify-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otpCode: sanitized,
          notes: `Delivery verified and completed by manager ${currentManagerName}`,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        toast.success("Delivery completed successfully! Handover OTP verified.", { icon: "🎉" });
        setOrders((prev) => prev.map((o) => (o._id === data.order._id ? data.order : o)));
        setCompleteHandoverModalOrder(null);
        setHandoverOtpInput("");
        loadData(true);
      } else {
        setHandoverError(data.message || "Failed to verify handover OTP.");
      }
    } catch (err) {
      setHandoverError("Network error verifying handover OTP.");
    } finally {
      setHandoverSubmitting(false);
    }
  }

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const mins = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (mins < 1) return "Just now";
    if (mins === 1) return "1 min ago";
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  };

  return (
    <FeatureGuard featureKey="delivery" featureName="Delivery Operations">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-jakarta space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 dark:border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Bike size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Assign Delivery Boy</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">
                    Manager Control
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                  Select and assign delivery staff, manage self-delivery, dispatch orders, and coordinate handover OTPs.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-white/5 text-stone-700 dark:text-stone-300 font-bold text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Awaiting Assignment
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white mt-1.5">
              {metrics.unassignedCount}
            </div>
            <p className="text-xs text-stone-400 mt-1">Orders requiring delivery staff</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Ready for Dispatch
              </span>
              <Package size={14} className="text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-1.5">
              {metrics.readyCount}
            </div>
            <p className="text-xs text-stone-400 mt-1">Packed food ready at counter</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Out for Delivery
              </span>
              <Truck size={14} className="text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">
              {metrics.inTransitCount}
            </div>
            <p className="text-xs text-stone-400 mt-1">In transit with live GPS & OTP</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Active Delivery Staff
              </span>
              <UserCheck size={14} className="text-purple-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 mt-1.5">
              {metrics.activeStaffCount}
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Registered drivers in team ({deliveryStaff.length} total)
            </p>
          </div>
        </div>

        {/* Two-Column Master Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SECTION A: Orders Awaiting Assignment & Active Orders (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Filter Tabs & Search Bar */}
            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-white/10 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                  />
                  <input
                    type="text"
                    placeholder="Search by order #, customer name, phone, address, or driver..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
                {[
                  { id: "all", label: "All Orders", count: orders.length },
                  { id: "unassigned", label: "Unassigned", count: metrics.unassignedCount },
                  { id: "ready", label: "Ready", count: metrics.readyCount },
                  { id: "in_transit", label: "Out for Delivery", count: metrics.inTransitCount },
                  { id: "self_delivery", label: "Self-Delivery", count: metrics.selfDeliveryCount },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterTab(tab.id)}
                    className={`px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      filterTab === tab.id
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        filterTab === tab.id ? "bg-white/20 text-white" : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Orders List */}
            {loading ? (
              <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-white/10">
                <RefreshCw size={28} className="animate-spin text-amber-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-stone-600 dark:text-stone-300">
                  Loading delivery orders...
                </p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-white/10 space-y-2">
                <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center mx-auto mb-2">
                  <Package size={24} />
                </div>
                <h3 className="text-base font-bold text-stone-800 dark:text-white">
                  No orders match this filter
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                  {filterTab === "unassigned"
                    ? "Great job! All active delivery orders currently have assigned delivery personnel."
                    : "No orders found matching your search or filter criteria."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const isAssigned = Boolean(order.assignedDeliveryStaff?.id);
                  const isSelfDelivery = order.deliveryAssignmentMode === "manager_self_delivery";
                  const canDispatch =
                    order.status === "ready" || order.status === "preparing" || order.status === "confirmed";
                  const isOutForDelivery = order.status === "out_for_delivery";
                  const isDelivered = order.status === "delivered";

                  return (
                    <div
                      key={order._id}
                      className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border transition shadow-xs ${
                        !isAssigned
                          ? "border-amber-400/60 dark:border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10"
                          : isSelfDelivery
                          ? "border-purple-300 dark:border-purple-500/30 bg-purple-50/10 dark:bg-purple-950/10"
                          : "border-stone-200 dark:border-white/10"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-stone-900 dark:text-white">
                              #{order.orderId || order._id.slice(-6).toUpperCase()}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                order.status === "ready"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                  : order.status === "out_for_delivery"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 animate-pulse"
                                  : order.status === "delivered"
                                  ? "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              }`}
                            >
                              {order.status.replace(/_/g, " ")}
                            </span>

                            {/* Assignment Status Pill */}
                            {!isAssigned ? (
                              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-white animate-bounce">
                                Needs Driver
                              </span>
                            ) : isSelfDelivery ? (
                              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                🚗 Manager Self-Delivery
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                🛵 {order.assignedDeliveryStaff?.name}
                              </span>
                            )}

                            <span className="text-xs text-stone-400">
                              • {formatTimeAgo(order.createdAt)}
                            </span>
                          </div>

                          <div className="mt-2 text-xs text-stone-600 dark:text-stone-300 space-y-1">
                            <div className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                              <span>Customer:</span>
                              <span>{order.address?.fullName || "Guest Customer"}</span>
                              {order.address?.phone && (
                                <a
                                  href={`tel:${order.address.phone}`}
                                  className="text-blue-600 dark:text-blue-400 underline ml-1 hover:text-blue-700 inline-flex items-center gap-0.5"
                                >
                                  <Phone size={11} />
                                  <span>{order.address.phone}</span>
                                </a>
                              )}
                            </div>

                            <div className="flex items-start gap-1.5 text-stone-500 dark:text-stone-400">
                              <MapPin size={13} className="shrink-0 mt-0.5 text-amber-500" />
                              <span>
                                {order.address?.street}, {order.address?.city} ({order.address?.pincode})
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400 pt-1">
                              <span>Items: {order.items?.length || 0}</span>
                              <span>•</span>
                              <span className="font-bold text-stone-800 dark:text-stone-200">
                                Total: ₹{(order.totalAmount || 0).toFixed(2)}
                              </span>
                              <span>•</span>
                              <span className="uppercase text-[11px] font-semibold">
                                {order.paymentMethod || "COD"} ({order.paymentStatus})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons Column */}
                        <div className="flex flex-col sm:items-end gap-2 shrink-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Reassign / Assign Button */}
                            {!isDelivered && (
                              <button
                                onClick={() => {
                                  setAssignModalOrder(order);
                                  setSelectedStaffForAssign(null);
                                }}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Bike size={13} />
                                <span>{isAssigned ? "Change Driver" : "Assign Driver"}</span>
                              </button>
                            )}

                            {/* Self-Delivery Button */}
                            {!isAssigned && !isDelivered && (
                              <button
                                onClick={() => setSelfDeliveryModalOrder(order)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Sparkles size={13} />
                                <span>Deliver Myself</span>
                              </button>
                            )}

                            {/* Manager Assisted Dispatch Button */}
                            {isAssigned && canDispatch && (
                              <button
                                onClick={() => handleManagerDispatch(order)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Truck size={13} />
                                <span>Dispatch Order</span>
                              </button>
                            )}

                            {/* View Handover OTP Button (Active during delivery) */}
                            {isOutForDelivery && (
                              <button
                                onClick={() => handleInspectOtp(order)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
                              >
                                <KeyRound size={13} />
                                <span>View Handover OTP</span>
                              </button>
                            )}

                            {/* Manager Complete Delivery (Self Delivery or Assistance) */}
                            {isOutForDelivery && (
                              <button
                                onClick={() => {
                                  setCompleteHandoverModalOrder(order);
                                  setHandoverOtpInput("");
                                  setHandoverError("");
                                }}
                                className="px-3 py-1.5 bg-stone-800 hover:bg-black text-white dark:bg-stone-700 dark:hover:bg-stone-600 font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 size={13} />
                                <span>Verify OTP & Complete</span>
                              </button>
                            )}
                          </div>

                          {/* Assignment Footnote */}
                          {order.assignedDeliveryStaff?.name && (
                            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                              <span>Assigned to:</span>
                              <strong className="text-stone-800 dark:text-stone-200">
                                {order.assignedDeliveryStaff.name}
                              </strong>
                              {order.assignedDeliveryStaff.phone && (
                                <a
                                  href={`tel:${order.assignedDeliveryStaff.phone}`}
                                  className="text-blue-500 hover:underline"
                                >
                                  ({order.assignedDeliveryStaff.phone})
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION B: Delivery Personnel Team (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-white/10 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                  <Bike size={18} className="text-amber-500" />
                  <span>Delivery Personnel</span>
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                  {deliveryStaff.length} Members
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Registered delivery staff for this restaurant. Tap the call icon to contact them directly before assigning.
              </p>
            </div>

            {/* Staff Cards List */}
            <div className="space-y-3">
              {deliveryStaff.length === 0 ? (
                <div className="p-6 text-center bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-white/10">
                  <UserX size={24} className="text-stone-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-stone-600 dark:text-stone-300">
                    No delivery personnel found.
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Add staff members with the "Delivery" role under Staff Settings.
                  </p>
                </div>
              ) : (
                deliveryStaff.map((staff) => (
                  <div
                    key={staff._id}
                    className={`p-3.5 rounded-2xl border transition shadow-xs ${
                      staff.isActive
                        ? "bg-white dark:bg-stone-900 border-stone-200 dark:border-white/10 hover:border-amber-400/60"
                        : "bg-stone-50 dark:bg-stone-900/40 border-stone-200 dark:border-white/5 opacity-75"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                            staff.isActive
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                          }`}
                        >
                          <User size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-stone-900 dark:text-white">
                              {staff.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                                staff.isActive
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                              }`}
                            >
                              {staff.status}
                            </span>
                          </div>

                          {/* Phone action */}
                          <div className="mt-1 flex items-center gap-2">
                            {staff.phone ? (
                              <a
                                href={`tel:${staff.phone}`}
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 group"
                                title="Click to call staff"
                              >
                                <PhoneCall size={12} className="group-hover:animate-bounce" />
                                <span>{staff.phone}</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-stone-400">No phone provided</span>
                            )}
                          </div>

                          {/* Workload metric */}
                          <div className="mt-1.5 text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                !staff.isActive
                                  ? "bg-stone-400"
                                  : staff.activeDeliveries === 0
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            <span>{staff.availabilityNote}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* MODAL 1: Assign Delivery Person Modal */}
        {assignModalOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl border border-stone-200 dark:border-white/10 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
                <div>
                  <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                    <Bike size={18} className="text-amber-500" />
                    <span>Assign Delivery Person</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Order #{assignModalOrder.orderId || assignModalOrder._id.slice(-6).toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setAssignModalOrder(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Order Info Summary */}
              <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl text-xs space-y-1">
                <div className="font-bold text-stone-900 dark:text-white">
                  Customer: {assignModalOrder.address?.fullName} ({assignModalOrder.address?.phone})
                </div>
                <div className="text-stone-500 dark:text-stone-400">
                  Address: {assignModalOrder.address?.street}, {assignModalOrder.address?.city}
                </div>
                <div className="text-stone-600 dark:text-stone-300 font-semibold pt-1">
                  Amount: ₹{(assignModalOrder.totalAmount || 0).toFixed(2)} ({assignModalOrder.paymentMethod})
                </div>
              </div>

              {/* Driver Selection List */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Select Delivery Boy
                </label>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {deliveryStaff.map((staff) => {
                    const isSelected = selectedStaffForAssign?._id === staff._id;
                    return (
                      <div
                        key={staff._id}
                        onClick={() => {
                          if (staff.isActive) setSelectedStaffForAssign(staff);
                        }}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                          !staff.isActive
                            ? "opacity-50 cursor-not-allowed bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-white/5"
                            : isSelected
                            ? "border-amber-500 bg-amber-500/10 cursor-pointer"
                            : "border-stone-200 dark:border-white/10 hover:border-stone-300 cursor-pointer bg-white dark:bg-stone-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="driver_choice"
                            checked={isSelected}
                            disabled={!staff.isActive}
                            onChange={() => setSelectedStaffForAssign(staff)}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <div className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                              <span>{staff.name}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                                  staff.isActive
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                }`}
                              >
                                {staff.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400">
                              {staff.phone || "No phone"} • {staff.availabilityNote}
                            </div>
                          </div>
                        </div>

                        {staff.phone && (
                          <a
                            href={`tel:${staff.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
                            title="Call to confirm availability"
                          >
                            <PhoneCall size={14} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informational Notice */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Note:</strong> Assignment delegates responsibility to the selected delivery person. The order will appear in their Delivery Workspace ready for them to dispatch and complete with the customer's OTP.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOrder(null)}
                  disabled={assignSubmitting}
                  className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignStaff}
                  disabled={!selectedStaffForAssign || assignSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {assignSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving Assignment...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Confirm & Assign</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: "Deliver This Order Myself" Confirmation Modal (Rule C) */}
        {selfDeliveryModalOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl border border-stone-200 dark:border-white/10 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
                <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-500" />
                  <span>Deliver This Order Myself</span>
                </h3>
                <button
                  onClick={() => setSelfDeliveryModalOrder(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300">
                You are choosing to personally deliver Order{" "}
                <strong>#{selfDeliveryModalOrder.orderId || selfDeliveryModalOrder._id.slice(-6).toUpperCase()}</strong>.
              </p>

              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-900 dark:text-purple-300 space-y-1.5">
                <div className="font-bold">What happens next:</div>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>You will be recorded as the authoritative delivery person.</li>
                  <li>Order delivery mode is set to <strong>manager-self-delivery</strong>.</li>
                  <li>You can dispatch the order and access the customer's delivery OTP.</li>
                  <li>You will verify the OTP at doorstep to mark the order delivered.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelfDeliveryModalOrder(null)}
                  disabled={selfDeliverySubmitting}
                  className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelfDelivery}
                  disabled={selfDeliverySubmitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {selfDeliverySubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Confirming Self-Delivery...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>Confirm Self-Delivery</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: Handover OTP Inspection Modal (Dual-Party OTP View) */}
        {otpModalOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl border border-stone-200 dark:border-white/10 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
                <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                  <KeyRound size={18} className="text-emerald-500" />
                  <span>Authorized Handover OTP</span>
                </h3>
                <button
                  onClick={() => {
                    setOtpModalOrder(null);
                    setActiveOtpData(null);
                  }}
                  className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-stone-500 dark:text-stone-400">
                Order #{otpModalOrder.orderId || otpModalOrder._id.slice(-6).toUpperCase()} • Assigned to{" "}
                <strong>{otpModalOrder.assignedDeliveryStaff?.name || "Delivery Staff"}</strong>
              </div>

              {inspectingOtp ? (
                <div className="py-8 text-center space-y-2">
                  <RefreshCw size={24} className="animate-spin text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-stone-600 dark:text-stone-300">
                    Retrieving active cryptographic OTP payload...
                  </p>
                </div>
              ) : otpError ? (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-700 dark:text-rose-400 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    <span>Failed to retrieve OTP</span>
                  </div>
                  <p>{otpError}</p>
                </div>
              ) : activeOtpData ? (
                <div className="space-y-4 text-center">
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Active Customer Handover Code
                    </span>
                    <div className="text-4xl font-mono font-black tracking-widest text-emerald-600 dark:text-emerald-400">
                      {activeOtpData.otpCode}
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      Single-use constant-time verified handover code.
                    </p>
                  </div>

                  <div className="text-xs text-stone-500 space-y-1 text-left bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl">
                    <div>
                      <strong>Delivery Mode:</strong>{" "}
                      {activeOtpData.deliveryAssignmentMode === "manager_self_delivery"
                        ? "Manager Self-Delivery"
                        : "Staff Delivery"}
                    </div>
                    <div>
                      <strong>Attempts Used:</strong> {activeOtpData.attemptCount} /{" "}
                      {activeOtpData.maxAttempts}
                    </div>
                    {activeOtpData.expiresAt && (
                      <div>
                        <strong>Expires At:</strong>{" "}
                        {new Date(activeOtpData.expiresAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOtpModalOrder(null);
                    setActiveOtpData(null);
                  }}
                  className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: Manager OTP Verification & Delivery Completion Modal */}
        {completeHandoverModalOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl border border-stone-200 dark:border-white/10 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-white/10">
                <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>Verify OTP & Complete Delivery</span>
                </h3>
                <button
                  onClick={() => setCompleteHandoverModalOrder(null)}
                  className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300">
                Enter the 4-digit handover OTP code provided by customer for Order{" "}
                <strong>
                  #{completeHandoverModalOrder.orderId || completeHandoverModalOrder._id.slice(-6).toUpperCase()}
                </strong>
                .
              </p>

              {handoverError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-medium">
                  {handoverError}
                </div>
              )}

              <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    4-Digit Handover Code
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    autoFocus
                    placeholder="0000"
                    value={handoverOtpInput}
                    onChange={(e) => setHandoverOtpInput(e.target.value.replace(/\D/g, ""))}
                    className="w-full text-center text-3xl font-mono font-black tracking-widest py-3 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-2xl text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCompleteHandoverModalOrder(null)}
                    disabled={handoverSubmitting}
                    className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={handoverOtpInput.length !== 4 || handoverSubmitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {handoverSubmitting ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Verify & Complete</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}
