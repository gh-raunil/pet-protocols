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
  Check,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Sparkles,
  MessageSquare,
  ExternalLink,
  XCircle,
  AlertTriangle,
  Star,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import OrderStatusTracker from "@/components/orders/OrderStatusTracker";
import LiveDeliveryMap from "@/components/orders/LiveDeliveryMap";
import DeliveryPushPrompt from "@/components/notifications/DeliveryPushPrompt";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import { toast } from "@/components/ui/ToastProvider";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

function ConfirmedOrderDishItem({ item }) {
  const [imgSrc, setImgSrc] = useState(item.image || FALLBACK_IMAGE);

  useEffect(() => {
    setImgSrc(item.image || FALLBACK_IMAGE);
  }, [item.image]);

  const portionText =
    item.servingLabel ||
    (item.portionQuantity ? `${item.portionQuantity} ${item.portionUnit || ""}` : "") +
      (item.size ? ` • ${item.size}` : "");

  return (
    <div className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-[var(--bg-sub)] shrink-0 border border-[var(--border-color)]">
          <Image
            src={imgSrc}
            alt={item.name || "Dish item"}
            fill
            className="object-cover"
            sizes="44px"
            onError={() => setImgSrc(FALLBACK_IMAGE)}
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate">
            {item.name}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {item.variantName && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20">
                {item.variantName}
              </span>
            )}
            {portionText && (
              <span className="text-[10px] text-[var(--text-muted)] truncate">
                {portionText}
              </span>
            )}
          </div>
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
  const guestTokenParam = searchParams.get("guestToken") || searchParams.get("guestAccessToken");

  const [guestToken, setGuestToken] = useState(() => {
    if (guestTokenParam && typeof guestTokenParam === "string" && guestTokenParam.trim()) {
      return guestTokenParam.trim();
    }
    if (typeof window !== "undefined") {
      try {
        return (
          sessionStorage.getItem(`pet_protocols_guest_token_${orderIdParam}`) ||
          sessionStorage.getItem("pet_protocols_latest_guest_token") ||
          ""
        );
      } catch (e) {}
    }
    return "";
  });
  const [order, setOrder] = useState(null);
  const [restaurantDetails, setRestaurantDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isAuthError, setIsAuthError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  // GUEST-URL-01: Capture token, persist to sessionStorage, verify storage, and strip from URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (guestTokenParam && typeof guestTokenParam === "string" && guestTokenParam.trim()) {
      const cleanToken = guestTokenParam.trim();

      try {
        if (orderIdParam) {
          sessionStorage.setItem(`pet_protocols_guest_token_${orderIdParam}`, cleanToken);
        }
        sessionStorage.setItem("pet_protocols_latest_guest_token", cleanToken);
      } catch (e) {
        console.warn("[GuestAccess] sessionStorage unavailable or restricted");
      }

      setGuestToken(cleanToken);

      if (window.history && window.location) {
        try {
          const currentUrl = new URL(window.location.href);
          let paramsModified = false;

          if (currentUrl.searchParams.has("guestToken")) {
            currentUrl.searchParams.delete("guestToken");
            paramsModified = true;
          }
          if (currentUrl.searchParams.has("guestAccessToken")) {
            currentUrl.searchParams.delete("guestAccessToken");
            paramsModified = true;
          }

          if (paramsModified) {
            const sanitizedPath =
              currentUrl.pathname + (currentUrl.search ? currentUrl.search : "") + currentUrl.hash;
            window.history.replaceState(window.history.state, document.title, sanitizedPath);
          }
        } catch (urlErr) {}
      }
    } else if (!guestToken) {
      try {
        const stored =
          sessionStorage.getItem(`pet_protocols_guest_token_${orderIdParam}`) ||
          sessionStorage.getItem("pet_protocols_latest_guest_token");
        if (stored) setGuestToken(stored);
      } catch (e) {}
    }
  }, [orderIdParam, guestTokenParam, guestToken]);

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
        const effectiveToken =
          guestToken ||
          (typeof window !== "undefined"
            ? sessionStorage.getItem(`pet_protocols_guest_token_${orderIdParam}`) ||
              sessionStorage.getItem("pet_protocols_latest_guest_token")
            : null);

        const url = orderIdParam
          ? `/api/orders?orderId=${encodeURIComponent(orderIdParam)}`
          : "/api/orders";

        const headers = {};
        if (effectiveToken) {
          headers["x-guest-access-token"] = effectiveToken;
        }

        const res = await fetch(url, { headers });
        const data = await res.json();

        if (res.status === 401 || data.message === "Unauthorized") {
          setIsAuthError(true);
          setError("Unauthorized");
          return;
        }

        if (data.success) {
          setIsAuthError(false);
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
    [orderIdParam, guestToken]
  );

  useEffect(() => {
    fetchOrder(false);

    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (order?.status !== "delivered" && order?.status !== "cancelled" && !isAuthError) {
        fetchOrder(false);
      }
    }, POLL_INTERVAL);

    const handleVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        order?.status !== "delivered" &&
        order?.status !== "cancelled" &&
        !isAuthError
      ) {
        fetchOrder(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchOrder, order?.status, isAuthError]);

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
          Retrieving live order details...
        </p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen pt-32 pb-20 px-4 max-w-md mx-auto text-[var(--text-main)] flex flex-col items-center justify-center text-center gap-5">
        <div className="w-16 h-16 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-3xl">
          {isAuthError ? "🔒" : "📦"}
        </div>
        <h1 className="text-2xl font-black">{isAuthError ? "Sign In Required" : "Order Confirmation"}</h1>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          {isAuthError
            ? "Your login session has expired or you are not signed in. Please sign in to view and track this order."
            : error || "We couldn't retrieve the details for this order. You can view all your orders in your account."}
        </p>
        <div className="flex gap-3">
          {isAuthError ? (
            <Link
              href={`/auth/login?callbackUrl=${encodeURIComponent(
                typeof window !== "undefined" ? window.location.pathname + window.location.search : "/orders"
              )}`}
              className="px-5 py-2.5 rounded-xl bg-[var(--brand-accent)] text-white font-bold text-xs shadow-md shadow-[var(--brand-accent)]/20"
            >
              Sign In to View Order
            </Link>
          ) : (
            <Link
              href="/orders"
              className="px-5 py-2.5 rounded-xl bg-[var(--brand-accent)] text-white font-bold text-xs shadow-md shadow-[var(--brand-accent)]/20"
            >
              Go to My Orders
            </Link>
          )}
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
  const displayOrderCode = order.orderId
    ? order.orderId.replace(/^ORD_/, "PP")
    : `PP${(order._id || "").slice(-5).toUpperCase()}`;

  const handleTrackOrder = () => {
    const el = document.getElementById("order-tracking-details");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const activeRest = restaurantDetails || (typeof order.restaurant === "object" ? order.restaurant : null);
  const restaurantName =
    activeRest?.name ||
    (typeof order.restaurant === "object" ? order.restaurant?.name : "पेट Protocols Kitchen") ||
    "Partner Kitchen";

  const isPickup =
    Boolean(order.notes?.includes("[PICKUP]")) ||
    Boolean(order.paymentMethod?.toLowerCase().includes("pickup")) ||
    order.deliveryFee === 0;

  const rawRestAddr = activeRest?.address;
  const restaurantAddressStr =
    typeof rawRestAddr === "object" && rawRestAddr
      ? [
          rawRestAddr.street,
          rawRestAddr.buildingFloor,
          rawRestAddr.landmark,
          rawRestAddr.city,
          rawRestAddr.state,
          rawRestAddr.pincode,
        ]
          .filter(Boolean)
          .join(", ")
      : typeof rawRestAddr === "string"
      ? rawRestAddr
      : null;

  const restPhone =
    activeRest?.phone && activeRest?.showPhoneToCustomers !== false ? activeRest.phone : null;
  const restWhatsapp =
    activeRest?.whatsappNumber && activeRest?.showWhatsappToCustomers !== false
      ? activeRest.whatsappNumber
      : null;
  const cleanWaDigits = restWhatsapp ? restWhatsapp.replace(/\D/g, "") : "";

  const cancelSettings =
    activeRest?.cancellationSettings ||
    (typeof order.restaurant === "object" ? order.restaurant?.cancellationSettings : {}) ||
    {};
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
      setOrder((prev) => ({
        ...prev,
        status: "cancelled",
        cancelReason: cancelReason.trim() || "Cancelled by customer",
      }));
    } catch (err) {
      setCancelError("Network error while cancelling order.");
      toast.error("Network error while cancelling order.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <main className="min-h-screen pt-24 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-[var(--text-main)] space-y-6 sm:space-y-8 transition-colors">
      {/* ── 1. ORDER SUCCESS HEADER (Compact, Modern, Food-Delivery Inspired) ─────────────────────────── */}
      <section className="w-full bg-[var(--bg-card)] rounded-3xl p-5 sm:p-7 border border-[var(--border-color)] shadow-sm relative overflow-hidden transition-all">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-8">
          {/* Left Details */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left min-w-0 flex-1">
            {/* Mint Green Circle with Emerald Check */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#E2F7E9] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <Check size={32} strokeWidth={3.5} className="text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Confirmed
                </span>
                <span className="text-xs font-mono font-bold text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 px-2.5 py-0.5 rounded-full border border-[var(--brand-accent)]/20">
                  #{displayOrderCode}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-main)] mt-1.5">
                Order Confirmed!
              </h1>

              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 leading-relaxed max-w-lg">
                Your order #{displayOrderCode} has been placed successfully with{" "}
                <strong className="text-[var(--text-main)]">{restaurantName}</strong>.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-4 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleTrackOrder}
                  className="py-2.5 px-6 rounded-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Clock size={15} />
                  <span>Track Order</span>
                </button>
                <Link
                  href="/"
                  className="py-2.5 px-5 rounded-full bg-[var(--bg-sub)] hover:bg-[var(--border-color)] text-[var(--text-main)] border border-[var(--border-color)] font-bold text-xs sm:text-sm transition duration-150 active:scale-95 text-center inline-block"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>

          {/* Delivery Rider Scooter Illustration */}
          <div className="relative w-36 sm:w-48 h-24 sm:h-28 shrink-0 flex items-center justify-center">
            <Image
              src="/images/order-confirmed-scooter-clean.png"
              alt="Delivery on the way"
              width={192}
              height={112}
              className="object-contain drop-shadow-sm select-none pointer-events-none max-h-full"
              priority
            />
          </div>
        </div>
      </section>

      {/* ── 2-COLUMN BALANCED LAYOUT (Mobile: 1 Column, Desktop: 2 Columns) ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* ── PRIMARY COLUMN (Desktop: 7/12, Mobile: Full Width) ─────────────────────────── */}
        <div id="order-tracking-details" className="lg:col-span-7 xl:col-span-8 space-y-6 scroll-mt-24">
          {/* Quick status bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] text-[11px]">Status Ref:</span>
              <span className="font-mono font-bold text-[var(--text-main)] text-[11px]">
                #{orderIdDisplay}
              </span>
              <span className="text-[var(--border-color)]">•</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-accent)] capitalize">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)] animate-pulse" />
                {order.status?.replace(/_/g, " ")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchOrder(true)}
                disabled={isRefreshing}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 font-sans text-[11px] font-semibold transition cursor-pointer px-2 py-1 rounded-lg hover:bg-[var(--bg-sub)]"
                title="Refresh order status"
              >
                <RefreshCw size={12} className={isRefreshing ? "animate-spin text-[var(--brand-accent)]" : ""} />
                <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
              </button>

              {canCancel && (
                <button
                  type="button"
                  onClick={(e) => {
                    triggerRef.current = e.currentTarget;
                    setShowCancelModal(true);
                    setCancelReason("");
                    setCancelError("");
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-[11px] font-bold transition shadow-xs cursor-pointer"
                  title="Cancel order within grace window"
                >
                  <XCircle size={12} />
                  <span>Cancel ({remainingMinDisplay}:{remainingSecDisplay})</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Live Order Tracking & Handover OTP Card */}
          <OrderStatusTracker
            orderId={order.orderId || order._id}
            status={order.status}
            paymentStatus={order.paymentStatus}
            isPickup={isPickup}
            cancellationReason={order.cancellationReason || order.cancelReason || ""}
            statusHistory={order.statusHistory || []}
            notes={order.notes || ""}
            createdAt={order.createdAt}
            assignedDeliveryStaff={order.assignedDeliveryStaff}
            guestToken={guestToken}
          />

          {/* Live Delivery Map */}
          <LiveDeliveryMap
            orderId={order.orderId || order._id}
            initialStatus={order.status}
            isPickup={isPickup}
            restaurant={order.restaurant || restaurantDetails}
            destination={order.address}
            guestToken={guestToken}
            onStatusUpdate={(newStatus) => {
              if (newStatus && newStatus !== order.status) {
                setOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
              }
            }}
          />

          {/* Contextual Assistance & Grace Window Banner */}
          {order.status === "pending" && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 transition-all">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    canCancel
                      ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      : "bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)]"
                  }`}
                >
                  <Clock size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">
                      {canCancel ? "Need to make changes to your order?" : "Cancellation window expired"}
                    </h4>
                    {canCancel && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                        {remainingMinDisplay}:{remainingSecDisplay} grace remaining
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    {canCancel
                      ? "You can cancel your order within the 1-minute window before the kitchen starts preparation."
                      : "The kitchen is already preparing your meal. If you need urgent assistance, contact the kitchen partner."}
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
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm shadow-rose-600/20 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <XCircle size={14} />
                  <span>Cancel Order</span>
                </button>
              ) : restPhone ? (
                <a
                  href={`tel:${restPhone.replace(/\s+/g, "")}`}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[var(--bg-sub)] hover:border-[var(--brand-accent)] text-[var(--text-main)] border border-[var(--border-color)] font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Phone size={13} className="text-[var(--brand-accent)]" />
                  <span>Call Kitchen</span>
                </a>
              ) : null}
            </div>
          )}

          {/* Feedback Banner for Delivered Orders */}
          {order.status === "delivered" && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Star size={18} className="fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-[var(--text-main)]">
                    How was your order from {restaurantName}?
                  </h4>
                  <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    Your ratings help {restaurantName} maintain quality and taste consistency.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm shadow-amber-500/20 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Star size={13} className="fill-white text-white" />
                <span>Leave Feedback</span>
              </button>
            </div>
          )}

          {/* Push Notification Opt-in Prompt */}
          <DeliveryPushPrompt />
        </div>

        {/* ── SECONDARY COLUMN (Desktop: 5/12 Sticky Sidebar, Mobile: Stacked Below) ─────────────────────────── */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-28">
          {/* 4. Compact Order Summary & Receipt Card */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
            {/* Header / Mobile Toggle Accordion */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Receipt size={17} className="text-[var(--brand-accent)]" />
                <h3 className="text-sm font-extrabold text-[var(--text-main)]">Order Receipt</h3>
                <span className="text-[10px] font-mono text-[var(--brand-accent)] font-bold bg-[var(--brand-accent)]/10 px-2 py-0.5 rounded-full border border-[var(--brand-accent)]/20">
                  {order.items?.length || 0} {order.items?.length === 1 ? "dish" : "dishes"}
                </span>
              </div>

              {/* Mobile collapse toggle */}
              <button
                type="button"
                onClick={() => setIsSummaryOpen((prev) => !prev)}
                className="sm:hidden text-xs font-semibold text-[var(--brand-accent)] flex items-center gap-1 cursor-pointer"
                aria-expanded={isSummaryOpen}
                aria-label="Toggle dish items breakdown"
              >
                <span>{isSummaryOpen ? "Hide Items" : "View Items"}</span>
                {isSummaryOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Dishes list: Collapsible on mobile, always visible on tablet/desktop */}
            <div
              className={`space-y-1 divide-y divide-[var(--border-color)]/60 ${
                isSummaryOpen ? "block" : "hidden sm:block"
              }`}
            >
              {order.items?.map((item, idx) => (
                <ConfirmedOrderDishItem key={idx} item={item} />
              ))}
            </div>

            {/* Price Calculations */}
            <div className="pt-3 border-t border-[var(--border-color)] space-y-2 text-xs">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Subtotal</span>
                <span className="font-mono text-[var(--text-main)] font-semibold">
                  ₹{order.subtotal || order.totalAmount}
                </span>
              </div>

              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Delivery Charges</span>
                <span className="font-mono text-[var(--text-main)] font-semibold">
                  {order.deliveryFee === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                      FREE
                    </span>
                  ) : (
                    `₹${order.deliveryFee || 0}`
                  )}
                </span>
              </div>

              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Discount Applied</span>
                  <span className="font-mono">-₹{order.discount}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-3 border-t border-[var(--border-color)]">
                <div>
                  <span className="font-extrabold text-sm text-[var(--text-main)]">Total Paid</span>
                  <p className="text-[10px] text-[var(--text-muted)]">Verified final invoice</p>
                </div>
                <span className="font-mono font-black text-[var(--brand-accent)] text-lg sm:text-xl">
                  ₹{order.totalAmount}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Unified Kitchen Partner & Delivery Details Card */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
            {/* Part A: Kitchen Partner */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <Building size={13} className="text-[var(--brand-accent)]" />
                  Kitchen Partner
                </span>
                {typeof activeRest?.rating === "number" && activeRest?.numRatings > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    ★ {activeRest.rating}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-stone-500/10 text-stone-500 border border-stone-500/20">
                    Verified Kitchen
                  </span>
                )}
              </div>

              <p className="font-extrabold text-sm sm:text-base text-[var(--text-main)]">
                {restaurantName}
              </p>

              {activeRest?.cuisineType?.length > 0 && (
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {activeRest.cuisineType.slice(0, 3).join(" • ")}
                </p>
              )}

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

              {/* Direct Kitchen Contact Actions */}
              <div className="pt-3 flex flex-wrap gap-2">
                {restPhone && (
                  <a
                    href={`tel:${restPhone.replace(/\s+/g, "")}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-sub)] hover:border-[var(--brand-accent)] text-[var(--text-main)] border border-[var(--border-color)] text-xs font-bold transition shadow-xs"
                  >
                    <Phone size={12} className="text-[var(--brand-accent)]" />
                    <span>Call Kitchen</span>
                  </a>
                )}
                {cleanWaDigits && (
                  <a
                    href={`https://wa.me/${cleanWaDigits}?text=${encodeURIComponent(
                      `Hi ${restaurantName}, I'm checking on my order #${displayOrderCode} on पेट Protocols.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                  >
                    <MessageSquare size={12} />
                    <span>WhatsApp</span>
                    <ExternalLink size={10} className="opacity-70" />
                  </a>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--border-color)]" />

            {/* Part B: Delivery Destination or Pickup Counter */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5 mb-2">
                {isPickup ? (
                  <>
                    <ShoppingBag size={13} className="text-[var(--brand-accent)]" /> Self Pickup Counter
                  </>
                ) : (
                  <>
                    <MapPin size={13} className="text-[var(--brand-accent)]" /> Delivery Destination
                  </>
                )}
              </span>

              {isPickup ? (
                <div className="text-xs text-[var(--text-muted)] space-y-1">
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                    Pick Up In Person
                  </span>
                  <p className="font-bold text-[var(--text-main)]">
                    Recipient: {order.address?.fullName || "Guest Customer"}
                  </p>
                  {restaurantAddressStr && (
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      Collect at counter: <strong className="text-[var(--text-main)]">{restaurantName}</strong>
                    </p>
                  )}
                  {order.address?.phone && (
                    <p className="font-mono text-[11px] pt-0.5">📞 {order.address.phone}</p>
                  )}
                </div>
              ) : order.address ? (
                <div className="text-xs text-[var(--text-muted)] space-y-1">
                  <p className="font-bold text-[var(--text-main)]">{order.address.fullName}</p>
                  <p className="leading-relaxed">{order.address.street}</p>
                  <p>
                    {order.address.city}, {order.address.state} - {order.address.pincode}
                  </p>
                  {order.address.phone && (
                    <p className="font-mono pt-1 text-[11px]">📞 {order.address.phone}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Address details on file</p>
              )}
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="space-y-2 pt-1">
            <Link
              href="/orders"
              className="w-full py-3 px-4 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-[var(--brand-accent)]/20 active:scale-98"
            >
              <span>View Past Orders</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/menu"
              className="w-full py-2.5 px-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--brand-accent)]/30 text-center font-semibold text-xs transition block active:scale-98"
            >
              Explore More Dishes
            </Link>
          </div>
        </div>
      </div>

      {/* Cancellation Modal (Preserves Focus Trap, Accessibility, and Security Safeguards) */}
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

            <div className="space-y-2">
              <label
                htmlFor="cancel-reason-input"
                className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block"
              >
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

      {order && (
        <FeedbackModal
          order={order}
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </main>
  );
}
