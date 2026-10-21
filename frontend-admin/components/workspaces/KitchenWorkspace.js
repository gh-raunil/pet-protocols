"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Check,
  RefreshCw,
  Utensils,
  PackageCheck,
  Timer,
  Info,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { getOrderDistanceInfo } from "@/lib/geoDistance";
import OutOfRangeOrderModal from "@/components/orders/OutOfRangeOrderModal";
import Tooltip from "@/components/ui/Tooltip";
import { formatOrderId } from "@/app/dashboard/DashboardClient";

export default function KitchenWorkspace({ restaurantName = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [viewTab, setViewTab] = useState("all_kds"); // "all_kds", "pending", "preparing", "ready"
  const [outOfRangePrompt, setOutOfRangePrompt] = useState(null);
  const [restaurantObj, setRestaurantObj] = useState(null);

  // Dismiss / Undelivered confirmation dialog state
  const [dismissPromptOrder, setDismissPromptOrder] = useState(null);
  const [dismissReason, setDismissReason] = useState("Uncollected: Customer / rider did not arrive");
  const [customReason, setCustomReason] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const timeoutMinutes = restaurantObj?.orderingSettings?.uncollectedTimeoutMinutes || 60;

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
        setError(data.message || data.error || "Failed to load kitchen tickets.");
      }
    } catch (err) {
      console.error("KDS load error:", err);
      setError("Network error fetching live kitchen orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => {
      setNow(Date.now());
      loadOrders(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(orderId, newStatus, extra = {}) {
    try {
      setUpdatingId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, status: newStatus, ...extra } : o))
        );
      } else {
        alert(data.message || "Failed to advance ticket status.");
      }
    } catch (err) {
      console.error("KDS update error:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleUpdateTimeout(newMinutes) {
    try {
      setRestaurantObj((prev) => ({
        ...prev,
        orderingSettings: {
          ...prev?.orderingSettings,
          uncollectedTimeoutMinutes: newMinutes,
        },
      }));
      await fetch("/api/restaurant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderingSettings: {
            ...restaurantObj?.orderingSettings,
            uncollectedTimeoutMinutes: newMinutes,
          },
        }),
      });
      // Refresh to apply newly configured cutoff
      loadOrders(true);
    } catch (err) {
      console.error("Failed to update timeout setting:", err);
    }
  }

  function handleStartCooking(order) {
    const distInfo = getOrderDistanceInfo(order, restaurantObj);
    const maxRange =
      order.restaurant?.deliverySettings?.deliveryRadiusKm ||
      restaurantObj?.deliverySettings?.deliveryRadiusKm ||
      10;

    const effectiveDist = order.deliveryDistanceKm ?? distInfo?.distanceKm;
    const isOutOfRange =
      (order.isOutOfRange || (effectiveDist !== null && effectiveDist > maxRange)) &&
      !(String(order.paymentMethod || "").toLowerCase().includes("pickup"));

    if (isOutOfRange && !order.acceptedOutOfRange) {
      setOutOfRangePrompt({
        order,
        distanceKm: effectiveDist || 10.1,
        maxRangeKm: maxRange,
      });
      return;
    }

    updateStatus(order._id, "preparing");
  }

  // Filter kitchen-relevant active orders
  const activeTickets = useMemo(() => {
    return orders.filter(
      (o) => o.status === "pending" || o.status === "preparing" || o.status === "ready" || o.status === "out_for_delivery"
    );
  }, [orders]);

  // Identify stale orders exceeding the manager-configured pickup timeout
  const staleOrders = useMemo(() => {
    return activeTickets.filter((order) => {
      const isReady = order.status === "out_for_delivery" || order.status === "ready";
      if (!isReady) return false;
      const elapsedMins = Math.floor((now - new Date(order.createdAt).getTime()) / 60000);
      return elapsedMins >= timeoutMinutes;
    });
  }, [activeTickets, timeoutMinutes, now]);

  async function handleDismissAllStale() {
    if (staleOrders.length === 0) return;
    const confirmed = confirm(
      `Are you sure you want to dismiss all ${staleOrders.length} uncollected order(s) exceeding ${timeoutMinutes} minutes?`
    );
    if (!confirmed) return;

    for (const ord of staleOrders) {
      await updateStatus(ord._id, "cancelled", {
        cancellationReason: `Auto-dismissed: Undelivered order timed out after >${timeoutMinutes}m waiting window`,
      });
    }
  }

  const displayedOrders = useMemo(() => {
    if (viewTab === "all_kds") {
      return activeTickets;
    }
    return orders.filter((o) => o.status === viewTab);
  }, [orders, activeTickets, viewTab]);

  const metrics = useMemo(() => {
    const pendingCount = orders.filter((o) => o.status === "pending").length;
    const cookingCount = orders.filter((o) => o.status === "preparing").length;
    const readyCount = orders.filter((o) => o.status === "out_for_delivery" || o.status === "ready").length;
    const completedToday = orders.filter((o) => o.status === "delivered").length;
    return { pendingCount, cookingCount, readyCount, completedToday };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* ── TOP KITCHEN OPERATIONAL HEADER ────────────────────────── */}
      <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold mb-2 border border-orange-500/20">
              <ChefHat size={14} className="text-orange-500" />
              <span>KITCHEN DISPLAY SYSTEM (KDS)</span>
              {restaurantName && <span>• {restaurantName}</span>}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-white">
              Cook & Prep Workstation
            </h1>
            <p className="text-stone-500 dark:text-stone-400 text-xs sm:text-sm mt-1 max-w-xl">
              Real-time ticket queue for food line preparation, dietary notes, and cooking timers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {/* Manager Timeout Selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 text-xs">
              <Timer size={13} className="text-orange-500 shrink-0" />
              <span className="text-stone-500 dark:text-stone-400 font-medium hidden lg:inline">
                Uncollected Timeout:
              </span>
              <select
                value={timeoutMinutes}
                onChange={(e) => handleUpdateTimeout(Number(e.target.value))}
                aria-label="Set uncollected order timeout"
                className="bg-transparent font-bold text-stone-900 dark:text-white outline-none cursor-pointer text-xs"
              >
                <option value={30} className="bg-stone-900 text-white">30 mins</option>
                <option value={45} className="bg-stone-900 text-white">45 mins</option>
                <option value={50} className="bg-stone-900 text-white">50 mins</option>
                <option value={60} className="bg-stone-900 text-white">60 mins (Default)</option>
                <option value={90} className="bg-stone-900 text-white">90 mins</option>
                <option value={120} className="bg-stone-900 text-white">120 mins</option>
              </select>
            </div>

            <Tooltip content="Fetch newly arrived kitchen orders immediately" placement="bottom">
              <button
                onClick={() => loadOrders(false)}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-70"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                <span>{refreshing ? "Syncing..." : "Sync Tickets"}</span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ── 4 STATS CARDS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5 pt-5 border-t border-stone-100 dark:border-white/5">
          <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              New Tickets
            </span>
            <div className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400 font-mono">
              {metrics.pendingCount}
            </div>
          </div>
          <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
              Cooking Now
            </span>
            <div className="text-2xl font-black mt-1 text-orange-600 dark:text-orange-400 font-mono">
              {metrics.cookingCount}
            </div>
          </div>
          <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Ready for Handover
            </span>
            <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
              {metrics.readyCount}
            </div>
          </div>
          <div className="bg-stone-50 dark:bg-white/5 rounded-xl p-3.5 border border-stone-200/60 dark:border-white/5">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
              Completed Shift
            </span>
            <div className="text-2xl font-black mt-1 text-stone-900 dark:text-white font-mono">
              {metrics.completedToday}
            </div>
          </div>
        </div>
      </div>

      {/* ── STALE ORDERS QUICK BULK ACTION BANNER ───────────────────── */}
      {staleOrders.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-950 dark:text-rose-200 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold block text-stone-900 dark:text-white">
                {staleOrders.length} ticket{staleOrders.length > 1 ? "s" : ""} waiting uncollected for over {timeoutMinutes}m
              </span>
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                These orders have exceeded the pickup window and are waiting indefinitely. Dismiss them to clear the kitchen line.
              </span>
            </div>
          </div>
          <button
            onClick={handleDismissAllStale}
            disabled={loading || refreshing || Boolean(updatingId)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
          >
            <XCircle size={14} />
            <span>Dismiss All Stale ({staleOrders.length})</span>
          </button>
        </div>
      )}

      {/* ── TICKET VIEW SELECTOR ────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-3 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-2">
          {[
            { id: "all_kds", label: `Active Kitchen Queue (${activeTickets.length})` },
            { id: "pending", label: `Incoming (${metrics.pendingCount})` },
            { id: "preparing", label: `In Cooking (${metrics.cookingCount})` },
            { id: "out_for_delivery", label: `Dispatched / Ready (${metrics.readyCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                viewTab === tab.id
                  ? "bg-orange-500 text-white shadow-xs"
                  : "bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-stone-500 dark:text-stone-400 font-bold shrink-0 hidden sm:block">
          Auto-updates every 15s
        </div>
      </div>

      {/* ── TICKETS GRID ────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-stone-500 dark:text-stone-400">
          <RefreshCw size={28} className="animate-spin mx-auto text-orange-500 mb-3" />
          <p className="text-sm font-medium">Loading live kitchen tickets...</p>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-3xl p-12 text-center">
          <Utensils className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-900 dark:text-white">
            All caught up! No active tickets
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            New orders from customers will appear here immediately as sound-alerted KDS tickets.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedOrders.map((order) => {
            const isPending = order.status === "pending";
            const isPreparing = order.status === "preparing";
            const isReady = order.status === "out_for_delivery" || order.status === "ready";
            const isUpdating = updatingId === order._id;
            const isPickup = Boolean(
              String(order.paymentMethod || "").toLowerCase().includes("pickup") ||
              order.deliveryType === "pickup" ||
              order.isPickup
            );
            const deliveryStaff = order.assignedDeliveryStaff || order.codPaymentHandler;
            const hasDeliveryStaff = Boolean(deliveryStaff?.name);

            // Elapsed time
            const diffMinutes = Math.floor(
              (now - new Date(order.createdAt).getTime()) / 60000
            );
            const isStale = isReady && diffMinutes >= timeoutMinutes;

            return (
              <div
                key={order._id}
                className={`bg-white dark:bg-[#10141f] rounded-2xl border flex flex-col justify-between shadow-xs overflow-hidden transition-all ${
                  isStale
                    ? "border-rose-500 ring-2 ring-rose-500/30"
                    : isPending
                    ? "border-amber-400 dark:border-amber-500/40 ring-2 ring-amber-400/20"
                    : isPreparing
                    ? "border-orange-500/50 dark:border-orange-500/40"
                    : "border-stone-200 dark:border-white/10"
                }`}
              >
                {/* Header */}
                <div
                  className={`p-3 border-b flex items-center justify-between gap-2 ${
                    isStale
                      ? "bg-rose-500/15 text-rose-950 dark:text-rose-200 border-rose-500/30"
                      : isPending
                      ? "bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/20"
                      : isPreparing
                      ? "bg-orange-500/10 text-orange-950 dark:text-orange-200 border-orange-500/20"
                      : "bg-stone-100 dark:bg-white/5 border-stone-200 dark:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                    <span
                      title={`Full Order ID: #${order.orderId || order._id}`}
                      className="font-mono font-bold text-xs text-stone-900 dark:text-white bg-stone-900/10 dark:bg-white/10 px-2 py-0.5 rounded-lg shrink-0 border border-stone-900/10 dark:border-white/10 tracking-tight select-all"
                    >
                      {formatOrderId(order)}
                    </span>
                    <Tooltip
                      content={
                        isPending
                          ? "New order placed by customer, waiting for kitchen acceptance"
                          : isPreparing
                          ? "Order is currently being cooked at the station"
                          : "Dishes are packed and ready for delivery driver pickup"
                      }
                      position="top"
                    >
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 cursor-help ${
                          isStale
                            ? "bg-rose-600 text-white animate-pulse"
                            : isPending
                            ? "bg-amber-500 text-white"
                            : isPreparing
                            ? "bg-orange-500 text-white"
                            : "bg-emerald-500 text-white"
                        }`}
                      >
                        {isStale ? "STALE" : isPending ? "NEW" : isPreparing ? "COOKING" : "READY"}
                      </span>
                    </Tooltip>
                    {order.isOutOfRange && (
                      <Tooltip
                        content={
                          order.acceptedOutOfRange
                            ? `Destination is ${order.deliveryDistanceKm}km away. Manager approved fulfillment.`
                            : `Destination (${order.deliveryDistanceKm}km) exceeds standard delivery radius. Manager review required before cooking.`
                        }
                        position="top"
                      >
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 cursor-help shrink-0 ${
                            order.acceptedOutOfRange
                              ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                              : "bg-rose-500 text-white animate-pulse"
                          }`}
                        >
                          <AlertTriangle size={9} />
                          <span>{order.acceptedOutOfRange ? `${order.deliveryDistanceKm}k` : `⚠️ ${order.deliveryDistanceKm}k`}</span>
                        </span>
                      </Tooltip>
                    )}
                  </div>

                  <Tooltip content="Time elapsed since the customer placed this order" position="top">
                    <div className="flex items-center gap-1 text-xs font-bold shrink-0 whitespace-nowrap cursor-help">
                      <Timer size={12} className={diffMinutes > 20 ? "text-red-500 animate-pulse shrink-0" : "text-stone-400 shrink-0"} />
                      <span className={diffMinutes > 20 ? "text-red-600 font-black" : "text-stone-600 dark:text-stone-400"}>
                        {diffMinutes}m ago
                      </span>
                    </div>
                  </Tooltip>
                </div>

                {/* Delivery Boy Details / Which Staff Took the Order */}
                <div className="px-3.5 py-2 bg-stone-50 dark:bg-white/[0.02] border-b border-stone-100 dark:border-white/5 flex items-center justify-between gap-2 text-xs">
                  {hasDeliveryStaff ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">🛵</span>
                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-stone-900 dark:text-white truncate">
                          Staff: {deliveryStaff.name}
                        </span>
                        {deliveryStaff.phone && (
                          <a
                            href={`tel:${deliveryStaff.phone}`}
                            className="text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                            title={`Call delivery staff: ${deliveryStaff.phone}`}
                          >
                            ({deliveryStaff.phone})
                          </a>
                        )}
                      </div>
                    </div>
                  ) : isPickup ? (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      <span>🛍️</span>
                      <span>Counter Self-Pickup</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 font-medium truncate">
                      <span>🛵</span>
                      <span className="truncate">Awaiting delivery staff</span>
                    </div>
                  )}

                  {order.address?.street && !isPickup && (
                    <span
                      title={order.address.street}
                      className="text-[10px] text-stone-400 dark:text-stone-500 truncate max-w-[150px] text-right font-medium shrink-0"
                    >
                      📍 {order.address.street}
                    </span>
                  )}
                </div>

                {/* Items List */}
                <div className="p-3.5 flex-1 space-y-2.5">
                  <div className="space-y-2">
                    {order.items?.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-2 p-2 rounded-xl bg-stone-50 dark:bg-white/[0.03] border border-stone-100 dark:border-white/5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 font-black flex items-center justify-center text-xs shrink-0">
                            {item.quantity}×
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-stone-900 dark:text-white block truncate">
                              {item.name}
                            </span>
                            {item.selectedVariants?.length > 0 && (
                              <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate">
                                {item.selectedVariants.map((v) => `${v.name}: ${v.value}`).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>

                        {item.type && (
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 ${
                              item.type === "veg"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {item.type}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Customer / Chef Notes */}
                  {order.notes && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                      <span className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        <Info size={12} /> Chef Note:
                      </span>
                      <p className="mt-0.5 font-medium">{order.notes}</p>
                    </div>
                  )}
                </div>

                {/* Status Advancement Actions */}
                <div className="p-3 border-t border-stone-100 dark:border-white/5 bg-stone-50/50 dark:bg-white/[0.01]">
                  {isPending && (
                    <Tooltip
                      fullWidth
                      className="w-full"
                      content="Accept ticket and begin preparing food on the cooking line"
                      position="top"
                    >
                      <button
                        type="button"
                        onClick={() => handleStartCooking(order)}
                        disabled={isUpdating}
                        className="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 active:scale-[0.99] transition-all duration-200 shadow-md shadow-orange-500/20 hover:shadow-orange-500/35 border border-orange-400/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <>
                            <RefreshCw size={14} className="animate-spin text-white" />
                            <span>Accepting Ticket...</span>
                          </>
                        ) : (
                          <>
                            <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                              <Flame size={13} className="text-white" />
                            </div>
                            <span className="tracking-wide">Start Cooking</span>
                          </>
                        )}
                      </button>
                    </Tooltip>
                  )}

                  {isPreparing && (
                    <Tooltip
                      fullWidth
                      className="w-full"
                      content="Mark dishes completed and ready for driver pickup or counter collection"
                      position="top"
                    >
                      <button
                        type="button"
                        onClick={() => updateStatus(order._id, "out_for_delivery")}
                        disabled={isUpdating}
                        className="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] transition-all duration-200 shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/35 border border-emerald-400/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <>
                            <RefreshCw size={14} className="animate-spin text-white" />
                            <span>Marking Ready...</span>
                          </>
                        ) : (
                          <>
                            <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                              <PackageCheck size={13} className="text-white" />
                            </div>
                            <span className="tracking-wide">Mark Ready for Pickup</span>
                            <span className="text-[10px] opacity-80 font-bold ml-0.5">✓</span>
                          </>
                        )}
                      </button>
                    </Tooltip>
                  )}

                  {isReady && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 size={14} />
                          <span>Ready for Pickup</span>
                        </span>
                        {isStale ? (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse flex items-center gap-1">
                            <AlertTriangle size={9} />
                            <span>Overdue ({diffMinutes}m)</span>
                          </span>
                        ) : hasDeliveryStaff ? (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate max-w-[170px]" title={`Hand over to ${deliveryStaff.name}`}>
                            🛵 Hand over to: {deliveryStaff.name}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-stone-400">
                            Awaiting handover
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Tooltip fullWidth className="w-full" content="Hand over food to driver or customer and complete ticket" position="top">
                          <button
                            type="button"
                            onClick={() => updateStatus(order._id, "delivered")}
                            disabled={isUpdating}
                            className="w-full py-2 px-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <PackageCheck size={13} />
                            <span>Hand Over</span>
                          </button>
                        </Tooltip>

                        <Tooltip fullWidth className="w-full" content="Dismiss uncollected or undelivered order from kitchen queue" position="top">
                          <button
                            type="button"
                            onClick={() => {
                              setDismissReason("Uncollected: Customer / rider did not arrive");
                              setCustomReason("");
                              setDismissPromptOrder(order);
                            }}
                            disabled={isUpdating}
                            className={`w-full font-bold text-xs py-2 rounded-xl border transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                              isStale
                                ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
                                : "bg-stone-100 hover:bg-rose-600 hover:text-white dark:bg-white/5 dark:hover:bg-rose-600 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:border-transparent"
                            }`}
                          >
                            <XCircle size={13} />
                            <span>Dismiss</span>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DISMISS / UNDELIVERED CONFIRMATION DIALOG ───────────────── */}
      {dismissPromptOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#10141f] border border-stone-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <XCircle size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">
                    Dismiss Order #{dismissPromptOrder.orderId || dismissPromptOrder._id.slice(-6).toUpperCase()}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Mark order as undelivered and clear from kitchen display
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDismissPromptOrder(null)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-white p-1 rounded-lg cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block">
                Select reason for dismissal:
              </label>
              {[
                "Uncollected: Customer / rider did not arrive",
                "Delivery cancelled / Rider no-show",
                "Customer refused delivery",
                "Food cold / spoiled after prolonged wait",
                "Other / Custom reason",
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setDismissReason(reason)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                    dismissReason === reason
                      ? "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-900 dark:text-rose-200 font-bold"
                      : "bg-stone-50 dark:bg-white/5 border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:border-stone-400"
                  }`}
                >
                  <span>{reason}</span>
                  {dismissReason === reason && <Check size={14} className="text-rose-500 shrink-0" />}
                </button>
              ))}

              {dismissReason === "Other / Custom reason" && (
                <input
                  type="text"
                  placeholder="Enter specific dismissal reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white outline-none focus:border-rose-500"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setDismissPromptOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingId === dismissPromptOrder._id}
                onClick={async () => {
                  const finalReason =
                    dismissReason === "Other / Custom reason"
                      ? customReason || "Undelivered: Order uncollected"
                      : dismissReason;
                  await updateStatus(dismissPromptOrder._id, "cancelled", {
                    cancellationReason: finalReason,
                  });
                  setDismissPromptOrder(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <XCircle size={14} />
                <span>Confirm Dismissal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Out-of-Range Order Manager Confirmation Dialog */}
      {outOfRangePrompt && (
        <OutOfRangeOrderModal
          isOpen={Boolean(outOfRangePrompt)}
          order={outOfRangePrompt.order}
          distanceKm={outOfRangePrompt.distanceKm}
          maxRangeKm={outOfRangePrompt.maxRangeKm}
          updating={updatingId === outOfRangePrompt.order._id}
          onAccept={() => {
            updateStatus(outOfRangePrompt.order._id, "preparing", {
              acceptedOutOfRange: true,
              deliveryDistanceKm: outOfRangePrompt.distanceKm,
            });
            setOutOfRangePrompt(null);
          }}
          onReject={() => {
            updateStatus(outOfRangePrompt.order._id, "cancelled", {
              cancellationReason: `Rejected by manager: Out of delivery range (${outOfRangePrompt.distanceKm} km > ${outOfRangePrompt.maxRangeKm} km limit)`,
            });
            setOutOfRangePrompt(null);
          }}
          onClose={() => setOutOfRangePrompt(null)}
        />
      )}
    </div>
  );
}
