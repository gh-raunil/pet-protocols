"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Clock,
  Phone,
  MapPin,
  CheckCircle,
  RefreshCw,
  ChefHat,
  Truck,
  XCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Bell,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

const POLL_INTERVAL = 10000; // Poll approximately every 10 seconds

export default function OrdersClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  
  // Kitchen Alert & Audio States
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState(new Set());

  // Refs for polling and concurrency management
  const isFetchingRef = useRef(false);
  const knownOrderIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);
  const audioContextRef = useRef(null);
  const audioBlockedRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/orders");
    }
  }, [status, router]);

  // Gentle kitchen notification sound synthesizer (Web Audio API)
  const playKitchenChime = useCallback(() => {
    if (!soundEnabled || audioBlockedRef.current) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;

      const triggerTones = () => {
        const now = ctx.currentTime;

        // Tone 1: Gentle high bell (587.33 Hz - D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.5);

        // Tone 2: Harmonious chime (880 Hz - A5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0.25, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.7);
      };

      if (ctx.state === "suspended") {
        ctx
          .resume()
          .then(() => {
            audioBlockedRef.current = false;
            setAudioBlocked(false);
            triggerTones();
          })
          .catch(() => {
            // Autoplay blocked by browser policy — do not continuously attempt
            audioBlockedRef.current = true;
            setAudioBlocked(true);
          });
        return;
      }

      triggerTones();
    } catch (err) {
      console.warn("Could not play kitchen chime:", err);
      audioBlockedRef.current = true;
      setAudioBlocked(true);
    }
  }, [soundEnabled]);

  // Unlock audio context on user interaction
  const handleEnableAudio = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioCtx();
      }

      audioContextRef.current.resume().then(() => {
        audioBlockedRef.current = false;
        setAudioBlocked(false);
        setSoundEnabled(true);
        // Play sample chime to confirm
        playKitchenChime();
      });
    } catch (err) {
      console.warn("Error unlocking audio:", err);
    }
  }, [playKitchenChime]);

  // Load / Poll orders from backend
  const fetchOrders = useCallback(
    async (isManual = false) => {
      // Avoid duplicate concurrent network requests
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isManual) {
        setIsRefreshing(true);
      }

      try {
        const url =
          filterStatus === "all"
            ? "/api/restaurant/orders"
            : `/api/restaurant/orders?status=${filterStatus}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success && Array.isArray(data.orders)) {
          const incomingOrders = data.orders;

          if (isInitialLoadRef.current) {
            // Seed existing order IDs on first page load without alerting
            incomingOrders.forEach((o) => knownOrderIdsRef.current.add(o._id));
            isInitialLoadRef.current = false;
          } else {
            // Detect genuinely new pending orders that we haven't alerted for
            const newPendingOrders = incomingOrders.filter(
              (o) => o.status === "pending" && !knownOrderIdsRef.current.has(o._id)
            );

            if (newPendingOrders.length > 0) {
              // Trigger gentle audio chime
              playKitchenChime();

              // High-visibility visual notification
              const newest = newPendingOrders[0];
              const totalItems = newest.items?.reduce(
                (sum, it) => sum + (it.quantity || 1),
                0
              ) || 1;

              setNewOrderAlert({
                id: newest._id,
                orderId: newest.orderId || newest._id.slice(-6),
                customerName: newest.address?.fullName || "Customer",
                totalAmount: newest.totalAmount,
                itemCount: totalItems,
                count: newPendingOrders.length,
              });

              // Add newly arrived order IDs to highlighted set
              setHighlightedOrderIds((prev) => {
                const next = new Set(prev);
                newPendingOrders.forEach((o) => next.add(o._id));
                return next;
              });

              // Auto-dismiss alert banner after 10 seconds
              setTimeout(() => {
                setNewOrderAlert(null);
              }, 10000);

              // Mark all new pending orders as known so we never alert repeatedly
              newPendingOrders.forEach((o) => knownOrderIdsRef.current.add(o._id));
            }

            // Track all incoming order IDs
            incomingOrders.forEach((o) => knownOrderIdsRef.current.add(o._id));
          }

          setOrders(incomingOrders);
        }
      } catch (err) {
        console.error("Order polling failed:", err);
        if (isManual) {
          setFeedback({ type: "error", message: "Failed to load orders." });
        }
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [filterStatus, playKitchenChime]
  );

  // Initial load and periodic polling interval with cleanup
  useEffect(() => {
    if (!session?.user) return;

    // Reset initial loading state when status filter changes
    setLoading(true);
    fetchOrders(false);

    // Setup polling every 10 seconds
    const intervalId = setInterval(() => {
      fetchOrders(false);
    }, POLL_INTERVAL);

    // Clean up interval and audio context on unmount
    return () => {
      clearInterval(intervalId);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [session, filterStatus, fetchOrders]);

  async function handleUpdateStatus(orderId, nextStatus) {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: "success",
          message: `Order #${orderId.slice(-6)} updated to ${nextStatus.toUpperCase()}`,
        });
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, status: nextStatus } : o))
        );
        // Clear highlight if order was acknowledged
        setHighlightedOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to update order status." });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const statusTabs = [
    { id: "all", label: "All Orders" },
    { id: "pending", label: "Pending" },
    { id: "preparing", label: "Preparing" },
    { id: "out_for_delivery", label: "Out for Delivery" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const statusBadgeStyles = {
    pending:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    preparing:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
    out_for_delivery:
      "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30",
    delivered:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
    cancelled:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  };

  return (
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      {/* Soft warm ambient background glow for light mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-100/60 via-amber-50/30 to-transparent dark:from-orange-500/5 dark:via-transparent dark:to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      <main className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
                Kitchen Display <span className="text-orange-500">System</span>
              </h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live 10s Poll
              </span>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
              Live orders received for your kitchen with automatic incoming chime alerts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                if (audioBlocked) {
                  handleEnableAudio();
                } else {
                  setSoundEnabled(!soundEnabled);
                }
              }}
              title={soundEnabled ? "Mute order chime" : "Unmute order chime"}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition shadow-xs active:scale-95 ${
                soundEnabled && !audioBlocked
                  ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30"
                  : "bg-white dark:bg-white/5 text-stone-500 border-stone-200 dark:border-white/10"
              }`}
            >
              {soundEnabled && !audioBlocked ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{soundEnabled && !audioBlocked ? "Chime On" : "Chime Muted"}</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchOrders(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition shadow-xs active:scale-95"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Autoplay Restriction Warning & Fallback Banner */}
        {audioBlocked && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 p-3.5 rounded-2xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <VolumeX className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="font-bold block text-stone-900 dark:text-white text-xs">Audio chime is paused by browser autoplay policy</span>
                <span className="text-[11px] text-stone-600 dark:text-amber-200/80">Visual alerts are active. Tap below to enable kitchen chime.</span>
              </div>
            </div>
            <button
              onClick={handleEnableAudio}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition shrink-0 cursor-pointer shadow-sm active:scale-95"
            >
              Enable Sound Alerts 🔊
            </button>
          </div>
        )}

        {/* New Order Visual Notification Banner */}
        {newOrderAlert && (
          <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 rounded-2xl p-4 text-white shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl shrink-0">
                🛎️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded text-orange-200">
                    New Order Received!
                  </span>
                  <span className="font-mono font-bold text-xs">
                    #{newOrderAlert.orderId}
                  </span>
                </div>
                <p className="text-xs text-orange-100 font-medium mt-0.5">
                  {newOrderAlert.customerName} ordered {newOrderAlert.itemCount} dish(es) •{" "}
                  <span className="font-bold text-white">₹{newOrderAlert.totalAmount}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setNewOrderAlert(null)}
              className="text-xs bg-black/30 hover:bg-black/40 text-white px-3 py-1.5 rounded-lg font-bold transition shrink-0"
            >
              Acknowledge ✓
            </button>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`p-3.5 rounded-xl flex items-center justify-between border text-xs font-semibold ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback({ type: "", message: "" })}
              className="opacity-70 hover:opacity-100 ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                filterStatus === tab.id
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-500/25"
                  : "bg-white/90 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/80 dark:border-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders Feed */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-orange-500">
            <RefreshCw className="animate-spin w-7 h-7" />
            <p className="text-xs text-stone-500">Connecting to Kitchen Feed...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-white/90 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl shadow-sm shadow-stone-200/40 dark:shadow-none">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-stone-400 dark:text-stone-600" />
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">No orders found</p>
            <p className="text-xs text-stone-500 mt-0.5">Orders with status &quot;{filterStatus}&quot; will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isNewlyArrived = highlightedOrderIds.has(order._id);
              return (
                <div
                  key={order._id}
                  className={`bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border rounded-2xl p-5 sm:p-6 shadow-sm shadow-stone-200/40 dark:shadow-none transition duration-300 relative ${
                    isNewlyArrived
                      ? "border-orange-500 ring-2 ring-orange-500/30 bg-orange-500/[0.03]"
                      : "border-stone-200/90 dark:border-white/10 hover:border-orange-500/40"
                  }`}
                >
                  {/* Top Info Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-lg border border-orange-200 dark:border-orange-500/20">
                        #{order.orderId || order._id.slice(-6)}
                      </span>
                      {isNewlyArrived && (
                        <span className="animate-pulse px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-orange-500 text-white rounded">
                          NEW
                        </span>
                      )}
                      <span className="text-xs text-stone-400 flex items-center gap-1 font-mono">
                        <Clock size={12} />
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          statusBadgeStyles[order.status] || "bg-stone-100 text-stone-700"
                        }`}
                      >
                        ● {order.status}
                      </span>
                      <span className="text-sm font-extrabold text-stone-900 dark:text-white font-mono ml-2">
                        ₹{order.totalAmount}
                      </span>
                    </div>
                  </div>

                  {/* Items & Customer Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {/* Customer */}
                    <div className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 bg-stone-50/80 dark:bg-white/[0.02] p-3 rounded-xl border border-stone-200/70 dark:border-white/5">
                      <span className="text-[10px] font-bold uppercase text-stone-400 dark:text-stone-500 tracking-wider block">
                        Customer Details
                      </span>
                      <p className="font-bold text-stone-900 dark:text-white text-xs">
                        {order.address?.fullName || "Customer"}
                      </p>
                      <p className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
                        <Phone size={12} className="text-orange-500" />{" "}
                        {order.address?.phone || "No phone"}
                      </p>
                      <p className="flex items-start gap-1.5 text-stone-600 dark:text-stone-400">
                        <MapPin size={12} className="text-orange-500 shrink-0 mt-0.5" />{" "}
                        {order.address?.street}, {order.address?.city}
                      </p>
                    </div>

                    {/* Items List */}
                    <div className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 bg-stone-50/80 dark:bg-white/[0.02] p-3 rounded-xl border border-stone-200/70 dark:border-white/5">
                      <span className="text-[10px] font-bold uppercase text-stone-400 dark:text-stone-500 tracking-wider block">
                        Ordered Items
                      </span>
                      <div className="divide-y divide-stone-100 dark:divide-white/5">
                        {order.items?.map((item, i) => (
                          <div key={i} className="py-1 flex items-center justify-between text-xs">
                            <span className="font-medium text-stone-900 dark:text-stone-200">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-mono text-stone-500">
                              ₹{(item.price || 0) * (item.quantity || 1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-stone-100 dark:border-white/5 flex flex-wrap items-center justify-end gap-2">
                    {order.status === "pending" && (
                      <button
                        onClick={() => handleUpdateStatus(order._id, "preparing")}
                        disabled={updatingOrderId === order._id}
                        className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm shadow-orange-500/20 active:scale-95"
                      >
                        <ChefHat size={13} />
                        <span>Start Preparing</span>
                      </button>
                    )}

                    {order.status === "preparing" && (
                      <button
                        onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
                        disabled={updatingOrderId === order._id}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm shadow-purple-600/20 active:scale-95"
                      >
                        <Truck size={13} />
                        <span>Dispatch Order</span>
                      </button>
                    )}

                    {order.status === "out_for_delivery" && (
                      <button
                        onClick={() => handleUpdateStatus(order._id, "delivered")}
                        disabled={updatingOrderId === order._id}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-95"
                      >
                        <CheckCircle2 size={13} />
                        <span>Mark Delivered</span>
                      </button>
                    )}

                    {order.status !== "delivered" && order.status !== "cancelled" && (
                      <button
                        onClick={() => handleUpdateStatus(order._id, "cancelled")}
                        disabled={updatingOrderId === order._id}
                        className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-stone-600 hover:text-rose-600 dark:text-stone-400 text-xs font-semibold transition border border-stone-200 dark:border-white/10 active:scale-95"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
