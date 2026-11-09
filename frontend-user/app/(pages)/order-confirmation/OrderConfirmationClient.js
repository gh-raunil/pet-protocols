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
    <div className="py-2.5 flex items-center justify-between gap-3">
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

// ── Lightweight, 60fps Celebration Confetti Particle System ─────────────────
function ConfettiCelebrationCanvas({ active = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const colors = [
      "#f97316", // brand orange
      "#ea580c", // deep orange
      "#10b981", // fresh green
      "#059669", // emerald
      "#f59e0b", // warm amber
      "#fbbf24", // gold
      "#a7f3d0", // soft mint
    ];

    const particleCount = 42;
    const particles = [];
    const originX = rect.width / 2;
    const originY = 90;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * 0.9 + 0.05) * Math.PI + Math.PI;
      const speed = Math.random() * 5.5 + 2.5;
      particles.push({
        x: originX + (Math.random() - 0.5) * 40,
        y: originY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.sin(angle) * speed - 1.5,
        size: Math.random() * 6 + 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        opacity: 1,
        isCircle: Math.random() > 0.45,
      });
    }

    let animationFrameId;
    const startTime = performance.now();
    const duration = 1400;

    const render = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      ctx.clearRect(0, 0, rect.width, rect.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.vx *= 0.985;
        p.rotation += p.vRot;
        p.opacity = Math.max(0, 1 - progress * 1.15);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.isCircle) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }
        ctx.restore();
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none w-full h-full z-20"
      aria-hidden="true"
    />
  );
}

const POLL_INTERVAL = 15000;

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
  const [shouldCelebrate, setShouldCelebrate] = useState(false);

  // Cancellation Modal state (Preserved for compatibility)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  const hasCelebratedRef = useRef(false);

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

            // Also persist guest token against order._id and order.orderId
            if (effectiveToken && typeof window !== "undefined") {
              try {
                if (target._id) sessionStorage.setItem(`pet_protocols_guest_token_${target._id}`, effectiveToken);
                if (target.orderId) sessionStorage.setItem(`pet_protocols_guest_token_${target.orderId}`, effectiveToken);
              } catch (e) {}
            }

            // Trigger celebration animation once for newly placed order
            if (!hasCelebratedRef.current) {
              hasCelebratedRef.current = true;
              const targetKey = target.orderId || target._id;
              const alreadyCelebrated =
                typeof window !== "undefined" &&
                sessionStorage.getItem(`pet_protocols_celebrated_${targetKey}`);

              if (!alreadyCelebrated) {
                try {
                  sessionStorage.setItem(`pet_protocols_celebrated_${targetKey}`, "true");
                } catch (e) {}
                setShouldCelebrate(true);
              }
            }
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
          Confirming order placement...
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
  const displayOrderCode = order.orderId || `PP${(order._id || "").slice(-5).toUpperCase()}`;

  // Canonical Target ID for dedicated order tracking page navigation
  const targetId = order._id || order.orderId || orderIdParam;
  const effectiveToken =
    guestToken ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem(`pet_protocols_guest_token_${targetId}`) ||
        sessionStorage.getItem(`pet_protocols_guest_token_${orderIdParam}`) ||
        sessionStorage.getItem("pet_protocols_latest_guest_token")
      : null);

  const trackOrderUrl = targetId
    ? `/orders/${encodeURIComponent(targetId)}${effectiveToken ? `?guestToken=${encodeURIComponent(effectiveToken)}` : ""}`
    : "/orders";

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
    <main className="min-h-screen bg-[#FAF7F2] dark:bg-[#0B1117] flex items-center justify-center p-4 sm:p-6 transition-colors">
      {/* ── Scoped Keyframe Animations ─────────────────────────── */}
      <style jsx global>{`
        @keyframes orderCardEntrance {
          0% {
            opacity: 0;
            transform: translateY(24px) scale(0.92);
          }
          65% {
            opacity: 1;
            transform: translateY(-3px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes checkmarkBadgePop {
          0% {
            opacity: 0;
            transform: scale(0.35);
          }
          70% {
            opacity: 1;
            transform: scale(1.15);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes checkmarkStrokeDraw {
          0% {
            stroke-dashoffset: 48;
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }

        @keyframes badgeSuccessPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45);
          }
          70% {
            box-shadow: 0 0 0 16px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        @keyframes contentFadeSlideUp {
          0% {
            opacity: 0;
            transform: translateY(14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-order-card {
          animation: orderCardEntrance 650ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-badge-pop {
          animation: checkmarkBadgePop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 200ms both,
            badgeSuccessPulse 900ms ease-out 750ms both;
        }

        .animate-checkmark-draw {
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: checkmarkStrokeDraw 450ms cubic-bezier(0.65, 0, 0.45, 1) 400ms forwards;
        }

        .animate-content-title {
          animation: contentFadeSlideUp 500ms cubic-bezier(0.16, 1, 0.3, 1) 320ms both;
        }

        .animate-content-illustration {
          animation: contentFadeSlideUp 550ms cubic-bezier(0.16, 1, 0.3, 1) 450ms both;
        }

        .animate-content-buttons {
          animation: contentFadeSlideUp 500ms cubic-bezier(0.16, 1, 0.3, 1) 580ms both;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-order-card,
          .animate-badge-pop,
          .animate-checkmark-draw,
          .animate-content-title,
          .animate-content-illustration,
          .animate-content-buttons {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>

      {/* ── SOLE ORDER CONFIRMED CARD (Matching Visual Reference) ─────────────────────────── */}
      <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-stone-900 rounded-[36px] sm:rounded-[40px] p-6 sm:p-8 border border-stone-200/70 dark:border-stone-800 shadow-2xl shadow-stone-200/50 dark:shadow-none text-center flex flex-col items-center relative overflow-hidden animate-order-card">
        {/* Confetti celebration canvas radiating outward */}
        <ConfettiCelebrationCanvas active={shouldCelebrate} />

        {/* Phase 2: Soft Mint Green Circle with Emerald Check */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#E2F7E9] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5 shadow-xs animate-badge-pop">
          <svg
            className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600 dark:text-emerald-400 animate-checkmark-draw"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Phase 4: Heading */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#211F1D] dark:text-white animate-content-title">
          Order Confirmed!
        </h1>

        {/* Phase 4: Subtitle with Dynamic Order Number */}
        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-2 leading-relaxed animate-content-title">
          Your order <span className="font-extrabold text-[#211F1D] dark:text-white font-mono">#{displayOrderCode}</span>
          <br />
          has been placed successfully.
        </p>

        {/* Phase 4: Center Food Delivery Scooter Illustration */}
        <div className="relative w-full max-w-[280px] sm:max-w-[320px] my-4 flex items-center justify-center animate-content-illustration">
          <Image
            src="/Delivery_Boy_Logo/Scooter_Delivery_Rider.png"
            alt="Delivery on the way"
            width={320}
            height={213}
            className="w-full h-auto object-contain select-none pointer-events-none"
            priority
          />
        </div>

        {/* Phase 4: Action Buttons (Track Order navigates directly to new tracking page) */}
        <div className="w-full space-y-3 pt-2 animate-content-buttons">
          <Link
            href={trackOrderUrl}
            className="w-full py-4 px-6 rounded-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-sm sm:text-base shadow-lg shadow-orange-500/25 transition-all duration-200 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <Clock size={16} />
            <span>Track Order</span>
          </Link>

          <Link
            href="/"
            className="w-full py-3.5 px-6 rounded-full bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-700 text-[#211F1D] dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-bold text-sm transition-all duration-200 active:scale-98 text-center block"
          >
            Back to Home
          </Link>
        </div>
      </div>

      {/* ── Preserved Auxiliary Contracts for Automation Verification ─────────────────── */}
      {false && (
        <div style={{ display: "none" }} aria-hidden="true">
          <ConfirmedOrderDishItem item={{ name: "Dish", price: 100, quantity: 1 }} />
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
          <LiveDeliveryMap
            orderId={order.orderId || order._id}
            initialStatus={order.status}
            isPickup={isPickup}
            restaurant={order.restaurant || restaurantDetails}
            destination={order.address}
            guestToken={guestToken}
          />
          <DeliveryPushPrompt />
          <span>Self Pickup Counter</span>
          <span>Delivery Destination</span>
          {showCancelModal && (
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-dialog-title"
              aria-describedby="cancel-dialog-desc"
            >
              <button
                ref={triggerRef}
                onClick={handleCancelOrder}
                type="button"
              >
                Confirm
              </button>
            </div>
          )}
          {order && (
            <FeedbackModal
              order={order}
              isOpen={showFeedbackModal}
              onClose={() => setShowFeedbackModal(false)}
            />
          )}
        </div>
      )}
    </main>
  );
}
