"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  RefreshCw,
  ShoppingBag,
  Building,
  Clock,
  Phone,
  MapPin,
  CheckCircle,
  ArrowRight,
  Receipt,
  Sparkles,
  CreditCard,
  MessageSquare,
  ExternalLink,
  XCircle,
  AlertTriangle,
  X,
} from "lucide-react";
import OrderStatusTracker from "@/components/orders/OrderStatusTracker";
import DeliveryPushPrompt from "@/components/notifications/DeliveryPushPrompt";
import { toast } from "@/components/ui/ToastProvider";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

function ConfirmedOrderDishItem({ item }) {
  const [imgSrc, setImgSrc] = useState(item.image || FALLBACK_IMAGE);

  useEffect(() => {
    setImgSrc(item.image || FALLBACK_IMAGE);
  }, [item.image]);

  return (
    <div className="pt-3 first:pt-0 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[var(--bg-sub)] shrink-0 border border-[var(--border-color)]">
          <Image
            src={imgSrc}
            alt={item.name || "Dish item"}
            fill
            className="object-cover"
            sizes="48px"
            onError={() => setImgSrc(FALLBACK_IMAGE)}
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate">
            {item.name}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
            ₹{item.price} × {item.quantity}
          </p>
        </div>
      </div>

      <span className="text-xs sm:text-sm font-mono font-bold text-[var(--brand-accent)] shrink-0">
        ₹{(item.price || 0) * (item.quantity || 1)}
      </span>
    </div>
  );
}

const POLL_INTERVAL = 15000; // Poll status every 15s to keep UI lightweight

export default function OrderConfirmationClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderIdParam = searchParams.get("orderId") || searchParams.get("id");

  const [order, setOrder] = useState(null);
  const [restaurantDetails, setRestaurantDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle focus trapping, focus restoration, Escape key, and body scroll lock for cancellation modal
  useEffect(() => {
    if (showCancelModal) {
      if (!triggerRef.current && typeof document !== "undefined") {
        triggerRef.current = document.activeElement;
      }
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Move focus into dialog upon opening
      const focusTimer = setTimeout(() => {
        if (modalRef.current) {
          const focusable = modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);

      const handleKeyDown = (e) => {
        if (e.key === "Escape" && !isCancelling) {
          e.preventDefault();
          setShowCancelModal(false);
          return;
        }

        if (e.key === "Tab" && modalRef.current) {
          const focusable = Array.from(
            modalRef.current.querySelectorAll(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          );

          if (focusable.length === 0) {
            e.preventDefault();
            modalRef.current.focus();
            return;
          }

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first || !modalRef.current.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last || !modalRef.current.contains(document.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        clearTimeout(focusTimer);
        document.body.style.overflow = prevOverflow;
        window.removeEventListener("keydown", handleKeyDown);

        // Restore focus to trigger element if it remains mounted and focusable
        const trigger = triggerRef.current;
        if (trigger && typeof trigger.focus === "function") {
          try {
            if (document.body.contains(trigger)) {
              trigger.focus();
            }
          } catch {}
          triggerRef.current = null;
        }
      };
    }
  }, [showCancelModal, isCancelling]);

  const fetchOrder = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);

      try {
        const url = orderIdParam
          ? `/api/orders?orderId=${encodeURIComponent(orderIdParam)}`
          : "/api/orders";

        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
          const target = data.order || (data.orders && data.orders[0]);
          if (target) {
            setOrder(target);
          } else {
            setError("No order details found.");
          }
        } else {
          setError(data.message || "Failed to load order.");
        }
      } catch (err) {
        console.error("Order confirmation fetch error:", err);
        if (isManual) {
          setError("Network error while checking order status.");
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [orderIdParam]
  );

  useEffect(() => {
    fetchOrder(false);

    // Stop polling if order reaches a final state or if window is hidden
    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (order?.status !== "delivered" && order?.status !== "cancelled") {
        fetchOrder(false);
      }
    }, POLL_INTERVAL);

    const handleVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        order?.status !== "delivered" &&
        order?.status !== "cancelled"
      ) {
        fetchOrder(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchOrder, order?.status]);

  useEffect(() => {
    if (!order) return;
    const rest = order.restaurant;
    if (rest && typeof rest === "object" && (rest.phone || rest.address || rest.whatsappNumber)) {
      setRestaurantDetails(rest);
      return;
    }

    async function loadRest() {
      try {
        const res = await fetch("/api/restaurants");
        const data = await res.json();
        if (data.success && Array.isArray(data.restaurants)) {
          const restId = typeof rest === "string" ? rest : rest?._id;
          const found = data.restaurants.find(
            (r) => r._id === restId || (rest?.name && r.name?.toLowerCase() === rest.name.toLowerCase())
          );
          if (found) {
            setRestaurantDetails(found);
          }
        }
      } catch (err) {
        console.error("Failed to enrich restaurant contact info", err);
      }
    }
    loadRest();
  }, [order]);

  if (loading) {
    return (
      <main className="min-h-screen pt-32 pb-20 px-4 max-w-3xl mx-auto text-[var(--text-main)] flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-[var(--brand-accent)] animate-spin" />
        <p className="text-xs sm:text-sm font-semibold text-[var(--text-muted)]">
          Retrieving kitchen order details...
        </p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen pt-32 pb-20 px-4 max-w-md mx-auto text-[var(--text-main)] flex flex-col items-center justify-center text-center gap-5">
        <div className="w-16 h-16 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-3xl">
          📦
        </div>
        <h1 className="text-2xl font-black">Order Confirmation</h1>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          {error || "We couldn't retrieve the details for this order. You can view all your orders in your account."}
        </p>
        <div className="flex gap-3">
          <Link
            href="/orders"
            className="px-5 py-2.5 rounded-xl bg-[var(--brand-accent)] text-white font-bold text-xs shadow-md shadow-[var(--brand-accent)]/20"
          >
            Go to My Orders
          </Link>
          <Link
            href="/menu"
            className="px-5 py-2.5 rounded-xl bg-[var(--bg-sub)] text-[var(--text-main)] font-semibold text-xs border border-[var(--border-color)]"
          >
            Explore Menu
          </Link>
        </div>
      </main>
    );
  }

  const orderIdDisplay = order.orderId || order._id?.slice(-8) || "N/A";
  const activeRest = restaurantDetails || (typeof order.restaurant === "object" ? order.restaurant : null);
  const restaurantName = activeRest?.name || (typeof order.restaurant === "object" ? order.restaurant?.name : "पेट Protocols Kitchen") || "Partner Kitchen";

  const isPickup =
    Boolean(order.notes?.includes("[PICKUP]")) ||
    Boolean(order.paymentMethod?.toLowerCase().includes("pickup")) ||
    order.deliveryFee === 0;

  const rawRestAddr = activeRest?.address;
  const restaurantAddressStr = typeof rawRestAddr === "object" && rawRestAddr
    ? [rawRestAddr.street, rawRestAddr.buildingFloor, rawRestAddr.landmark, rawRestAddr.city, rawRestAddr.state, rawRestAddr.pincode].filter(Boolean).join(", ")
    : typeof rawRestAddr === "string" ? rawRestAddr : null;

  const restPhone = activeRest?.phone && activeRest?.showPhoneToCustomers !== false ? activeRest.phone : null;
  const restWhatsapp = activeRest?.whatsappNumber && activeRest?.showWhatsappToCustomers !== false ? activeRest.whatsappNumber : null;
  const cleanWaDigits = restWhatsapp ? restWhatsapp.replace(/\D/g, "") : "";

  const cancelSettings = activeRest?.cancellationSettings || (typeof order.restaurant === "object" ? order.restaurant?.cancellationSettings : {}) || {};
  const allowCancel = cancelSettings.allowCustomerCancel !== false;
  const windowMinutes = Number(cancelSettings.customerCancelWindowMinutes) || 1;
  const createdAtMs = new Date(order.createdAt).getTime();
  const effectiveCurrentTime = currentTime > 0 ? currentTime : createdAtMs;
  const remainingMs = Math.max(0, createdAtMs + windowMinutes * 60 * 1000 - effectiveCurrentTime);
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const canCancel = order.status === "pending" && allowCancel && remainingSeconds > 0;
  const remainingMinDisplay = Math.floor(remainingSeconds / 60);
  const remainingSecDisplay = (remainingSeconds % 60).toString().padStart(2, "0");

  const handleCancelOrder = async () => {
    if (!order?._id) return;
    setIsCancelling(true);
    setCancelError("");
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order._id,
          reason: cancelReason.trim() || "Cancelled by customer within 1-minute window",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setCancelError(data.message || "Failed to cancel order.");
        toast.error(data.message || "Failed to cancel order.");
        return;
      }
      toast.success("Order cancelled successfully.");
      setShowCancelModal(false);
      setOrder((prev) => ({ ...prev, status: "cancelled", cancelReason: cancelReason.trim() || "Cancelled by customer" }));
    } catch (err) {
      setCancelError("Network error while cancelling order.");
      toast.error("Network error while cancelling order.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <main className="min-h-screen pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-[var(--text-main)] space-y-8 transition-colors">
      {/* Celebration Header */}
      <div className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-3xl shadow-xl shadow-[var(--brand-accent)]/10 mb-1">
          🎉
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[var(--text-main)]">
          Order <span className="text-[var(--brand-accent)]">Confirmed!</span>
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
          Your order has been received by <span className="font-bold text-[var(--text-main)]">{restaurantName}</span>.
          Follow preparation progress below.
        </p>

        {/* Quick status bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-mono shadow-sm">
            <span className="text-[var(--text-muted)]">Order ID:</span>
            <span className="text-[var(--brand-accent)] font-bold">#{orderIdDisplay}</span>
            <span className="text-[var(--border-color)]">•</span>
            <button
              onClick={() => fetchOrder(true)}
              disabled={isRefreshing}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 font-sans text-[11px] font-semibold transition cursor-pointer"
              title="Refresh order status"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin text-[var(--brand-accent)]" : ""} />
              <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
            </button>
          </div>

          {canCancel && (
            <button
              type="button"
              onClick={(e) => {
                triggerRef.current = e.currentTarget;
                setShowCancelModal(true);
                setCancelReason("");
                setCancelError("");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-bold transition shadow-sm cursor-pointer"
              title="Cancel order within 1-minute grace window"
            >
              <XCircle size={13} />
              <span>Cancel Order ({remainingMinDisplay}:{remainingSecDisplay})</span>
            </button>
          )}
        </div>
      </div>

      {/* Honest Order-Status Progress Tracker (No fake GPS) */}
      <section className="space-y-4">
        <OrderStatusTracker
          status={order.status}
          paymentStatus={order.paymentStatus}
          isPickup={isPickup}
          cancellationReason={order.cancellationReason || order.cancelReason || ""}
        />
        <DeliveryPushPrompt />

        {/* Prominent Cancellation Banner for Pending Orders */}
        {order.status === "pending" && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                <Clock size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    Need to cancel this order?
                  </h4>
                  {canCancel && (
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                      {remainingMinDisplay}:{remainingSecDisplay} grace window
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                  {canCancel
                    ? "You can cancel your order immediately before the kitchen accepts and starts cooking."
                    : "The 1-minute grace window has passed. If you need urgent assistance, contact the kitchen team directly."}
                </p>
              </div>
            </div>

            {canCancel ? (
              <button
                type="button"
                onClick={(e) => {
                  triggerRef.current = e.currentTarget;
                  setShowCancelModal(true);
                  setCancelReason("");
                  setCancelError("");
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/25 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <XCircle size={15} />
                <span>Cancel Order ({remainingMinDisplay}:{remainingSecDisplay})</span>
              </button>
            ) : restPhone ? (
              <a
                href={`tel:${restPhone.replace(/\s+/g, "")}`}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--bg-card)] hover:border-[var(--brand-accent)] text-[var(--text-main)] border border-[var(--border-color)] font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Phone size={14} className="text-[var(--brand-accent)]" />
                <span>Call Kitchen: {restPhone}</span>
              </a>
            ) : null}
          </div>
        )}
      </section>

      {/* Two-Column Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Items & Pricing Summary */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
                <Receipt size={16} className="text-[var(--brand-accent)]" />
                Order Summary
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                {order.items?.length || 0} {order.items?.length === 1 ? "dish" : "dishes"}
              </span>
            </div>

            {/* Dishes list */}
            <div className="space-y-3 divide-y divide-[var(--border-color)]">
              {order.items?.map((item, idx) => (
                <ConfirmedOrderDishItem key={idx} item={item} />
              ))}
            </div>

            {/* Price Calculations */}
            <div className="mt-5 pt-4 border-t border-[var(--border-color)] space-y-2 text-xs">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Subtotal</span>
                <span className="font-mono text-[var(--text-main)] font-semibold">
                  ₹{order.subtotal || order.totalAmount}
                </span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Delivery Fee</span>
                <span className="font-mono text-[var(--text-main)] font-semibold">
                  {order.deliveryFee === 0 ? "FREE" : `₹${order.deliveryFee || 0}`}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-500 font-semibold">
                  <span>Discount Applied</span>
                  <span className="font-mono">-₹{order.discount}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-[var(--border-color)] font-bold text-sm sm:text-base">
                <span className="text-[var(--text-main)]">Total Amount</span>
                <span className="font-mono font-black text-[var(--brand-accent)] text-lg sm:text-xl">
                  ₹{order.totalAmount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Kitchen & Delivery Details */}
        <div className="space-y-6">
          {/* Restaurant Details */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Building size={14} className="text-[var(--brand-accent)]" />
                Kitchen Partner
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                ★ {activeRest?.rating || "4.8"} Verified
              </span>
            </div>

            <div>
              <p className="font-extrabold text-base sm:text-lg text-[var(--text-main)]">
                {restaurantName}
              </p>
              {activeRest?.cuisineType?.length > 0 && (
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {activeRest.cuisineType.slice(0, 3).join(" • ")}
                </p>
              )}

              {/* Kitchen Address */}
              {restaurantAddressStr ? (
                <p className="text-xs text-[var(--text-muted)] flex items-start gap-1.5 mt-2 leading-relaxed">
                  <MapPin size={13} className="text-[var(--brand-accent)] shrink-0 mt-0.5" />
                  <span>{restaurantAddressStr}</span>
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-2">
                  <MapPin size={13} className="text-[var(--brand-accent)] shrink-0" />
                  <span>Central Cloud Kitchen Hub</span>
                </p>
              )}
            </div>

            {/* Direct Contact Options */}
            <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Direct Kitchen Contact
              </span>

              {restPhone ? (
                <a
                  href={`tel:${restPhone.replace(/\s+/g, "")}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/50 text-[var(--text-main)] border border-[var(--border-color)] text-xs font-bold transition shadow-sm"
                >
                  <Phone size={13} className="text-[var(--brand-accent)]" />
                  <span>Call Kitchen: {restPhone}</span>
                </a>
              ) : (
                <a
                  href="mailto:support@petprotocols.com"
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)] text-xs font-medium"
                >
                  <Phone size={12} className="text-[var(--text-muted)]" />
                  <span>Support: support@petprotocols.com</span>
                </a>
              )}

              {cleanWaDigits && (
                <a
                  href={`https://wa.me/${cleanWaDigits}?text=${encodeURIComponent(
                    `Hi ${restaurantName}, I'm checking on my order #${orderIdDisplay} on पेट Protocols.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                >
                  <MessageSquare size={13} />
                  <span>Chat on WhatsApp</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>
              )}
            </div>
          </div>

          {/* Destination Address / Pickup Details */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              {isPickup ? (
                <>
                  <ShoppingBag size={14} className="text-[var(--brand-accent)]" /> Self Pickup Counter
                </>
              ) : (
                <>
                  <MapPin size={14} className="text-[var(--brand-accent)]" /> Delivery Destination
                </>
              )}
            </h3>
            {isPickup ? (
              <div className="text-xs text-[var(--text-muted)] space-y-1.5">
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-500 border border-blue-500/30">
                  Pick Up In Person
                </span>
                <p className="font-bold text-[var(--text-main)]">
                  Customer: {order.address?.fullName || "Guest Customer"}
                </p>
                {restaurantAddressStr && (
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    Collect at: <strong className="text-[var(--text-main)]">{restaurantName}</strong> ({restaurantAddressStr})
                  </p>
                )}
                {order.address?.phone && (
                  <p className="font-mono pt-0.5 text-[11px]">📞 {order.address.phone}</p>
                )}
              </div>
            ) : order.address ? (
              <div className="text-xs text-[var(--text-muted)] space-y-1">
                <p className="font-bold text-[var(--text-main)]">{order.address.fullName}</p>
                <p>{order.address.street}</p>
                <p>
                  {order.address.city}, {order.address.state} - {order.address.pincode}
                </p>
                <p className="font-mono pt-1 text-[11px]">📞 {order.address.phone}</p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">Address details on file</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <Link
              href="/orders"
              className="w-full py-3.5 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-[var(--brand-accent)]/20"
            >
              <span>View All Past Orders</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/menu"
              className="w-full py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--brand-accent)]/30 text-center font-semibold text-xs transition block"
            >
              Explore More Dishes
            </Link>
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
          aria-describedby="cancel-dialog-desc"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn outline-none focus:outline-hidden"
        >
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div id="cancel-dialog-title" className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                <AlertTriangle size={18} />
                <span>Cancel Order</span>
              </div>
              <span className="font-mono text-xs font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md">
                {remainingMinDisplay}:{remainingSecDisplay} left
              </span>
            </div>

            <p id="cancel-dialog-desc" className="text-xs text-[var(--text-muted)] leading-relaxed">
              Are you sure you want to cancel this order? The restaurant has not started preparing your food yet.
            </p>

            {cancelError && (
              <p className="text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 font-medium">
                {cancelError}
              </p>
            )}

            <div className="space-y-2">
              <label htmlFor="cancel-reason-input" className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Quick Reason:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Ordered by mistake",
                  "Need to change address",
                  "Selected wrong dishes",
                  "Changed my mind",
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReason(reason)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                      cancelReason === reason
                        ? "bg-[var(--brand-accent)] text-white border-[var(--brand-accent)]"
                        : "bg-[var(--bg-sub)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <input
                id="cancel-reason-input"
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Or type cancellation reason..."
                className="w-full mt-2 bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-main)] outline-hidden focus:border-rose-500 focus-visible:ring-2 focus-visible:ring-rose-500"
              />
            </div>

            <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-sub)] transition cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-hidden"
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
