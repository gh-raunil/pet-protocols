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
} from "lucide-react";
import { getOrderDistanceInfo } from "@/lib/geoDistance";
import OutOfRangeOrderModal from "@/components/orders/OutOfRangeOrderModal";
import Tooltip from "@/components/ui/Tooltip";

export default function KitchenWorkspace({ restaurantName = "" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [viewTab, setViewTab] = useState("all_kds"); // "all_kds", "pending", "preparing", "ready"
  const [outOfRangePrompt, setOutOfRangePrompt] = useState(null);
  const [restaurantObj, setRestaurantObj] = useState(null);

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
    const interval = setInterval(() => loadOrders(true), 15000);
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

  // Filter kitchen-relevant orders
  const activeTickets = useMemo(() => {
    return orders.filter(
      (o) => o.status === "pending" || o.status === "preparing" || o.status === "ready" || o.status === "out_for_delivery"
    );
  }, [orders]);

  const displayedOrders = useMemo(() => {
    if (viewTab === "all_kds") {
      return activeTickets;
    }
    return orders.filter((o) => o.status === viewTab);
  }, [orders, activeTickets, viewTab]);

  const metrics = useMemo(() => {
    const pendingCount = orders.filter((o) => o.status === "pending").length;
    const cookingCount = orders.filter((o) => o.status === "preparing").length;
    const readyCount = orders.filter((o) => o.status === "out_for_delivery").length;
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

          <Tooltip content="Fetch newly arrived kitchen orders immediately" placement="bottom">
            <button
              onClick={() => loadOrders(false)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-70 self-start md:self-auto"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Syncing..." : "Sync Tickets"}</span>
            </button>
          </Tooltip>
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

            // Elapsed time
            const diffMinutes = Math.floor(
              (new Date() - new Date(order.createdAt)) / 60000
            );

            return (
              <div
                key={order._id}
                className={`bg-white dark:bg-[#10141f] rounded-2xl border flex flex-col justify-between shadow-xs overflow-hidden transition-all ${
                  isPending
                    ? "border-amber-400 dark:border-amber-500/40 ring-2 ring-amber-400/20"
                    : isPreparing
                    ? "border-orange-500/50 dark:border-orange-500/40"
                    : "border-stone-200 dark:border-white/10"
                }`}
              >
                {/* Header */}
                <div
                  className={`p-3.5 border-b flex items-center justify-between ${
                    isPending
                      ? "bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/20"
                      : isPreparing
                      ? "bg-orange-500/10 text-orange-950 dark:text-orange-200 border-orange-500/20"
                      : "bg-stone-100 dark:bg-white/5 border-stone-200 dark:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-stone-900 dark:text-white">
                      #{order.orderId || order._id.slice(-6).toUpperCase()}
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
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full cursor-help ${
                          isPending
                            ? "bg-amber-500 text-white"
                            : isPreparing
                            ? "bg-orange-500 text-white"
                            : "bg-emerald-500 text-white"
                        }`}
                      >
                        {isPending ? "NEW TICKET" : isPreparing ? "COOKING" : "READY"}
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
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 cursor-help ${
                            order.acceptedOutOfRange
                              ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                              : "bg-rose-500 text-white animate-pulse"
                          }`}
                        >
                          <AlertTriangle size={9} />
                          <span>{order.acceptedOutOfRange ? `Out of Range (${order.deliveryDistanceKm}k)` : `⚠️ Out of Range (${order.deliveryDistanceKm}k)`}</span>
                        </span>
                      </Tooltip>
                    )}
                  </div>

                  <Tooltip content="Time elapsed since the customer placed this order" position="top">
                    <div className="flex items-center gap-1 text-xs font-bold cursor-help">
                      <Timer size={13} className={diffMinutes > 20 ? "text-red-500 animate-pulse" : ""} />
                      <span className={diffMinutes > 20 ? "text-red-600 font-black" : "text-stone-600 dark:text-stone-400"}>
                        {diffMinutes}m ago
                      </span>
                    </div>
                  </Tooltip>
                </div>

                {/* Items List */}
                <div className="p-4 flex-1 space-y-3">
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
                            <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white block truncate">
                              {item.name}
                            </span>
                            {item.category && (
                              <span className="text-[10px] text-stone-500 dark:text-stone-400">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.foodType && (
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                              item.foodType === "veg"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-red-500/10 text-red-600"
                            }`}
                          >
                            {item.foodType}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Special Cooking Instructions */}
                  {order.notes && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-[11px] text-amber-800 dark:text-amber-300">
                      <span className="font-bold block flex items-center gap-1">
                        <Info size={11} /> Chef Note:
                      </span>
                      <p className="mt-0.5 font-medium">{order.notes}</p>
                    </div>
                  )}
                </div>

                {/* Status Advancement Actions */}
                <div className="p-3 border-t border-stone-100 dark:border-white/5 bg-stone-50/50 dark:bg-white/[0.01]">
                  {isPending && (
                    <Tooltip content="Accept ticket and begin preparing food on the cooking line" position="top">
                      <button
                        onClick={() => handleStartCooking(order)}
                        disabled={isUpdating}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Flame size={14} />
                        <span>Start Cooking</span>
                      </button>
                    </Tooltip>
                  )}

                  {isPreparing && (
                    <Tooltip content="Mark dishes completed and ready for driver pickup or counter collection" position="top">
                      <button
                        onClick={() => updateStatus(order._id, "out_for_delivery")}
                        disabled={isUpdating}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <PackageCheck size={14} />
                        <span>Mark Ready for Pickup</span>
                      </button>
                    </Tooltip>
                  )}

                  {isReady && (
                    <Tooltip content="Food is boxed and waiting for driver or customer handover" position="top">
                      <div className="text-center py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 cursor-default">
                        <CheckCircle2 size={14} />
                        <span>Ready & Awaiting Delivery Pickup</span>
                      </div>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
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
