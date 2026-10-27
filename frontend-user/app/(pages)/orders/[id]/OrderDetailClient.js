"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Building,
  Clock,
  MapPin,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Phone,
  XCircle,
  AlertTriangle,
  ShoppingBag,
  Truck,
  Tag,
  RefreshCw,
  Star,
  CreditCard,
  Receipt,
  FileText,
  ChevronRight,
  Store,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import OrderStatusTracker from "@/components/orders/OrderStatusTracker";
import LiveDeliveryMap from "@/components/orders/LiveDeliveryMap";
import DeliveryPushPrompt from "@/components/notifications/DeliveryPushPrompt";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import useCartStore from "@/lib/cartStore";
import { toast } from "@/components/ui/ToastProvider";
import { formatDateInTimeZone } from "@/lib/timeZone";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";
import Tooltip from "@/components/ui/Tooltip";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

function OrderItemRow({ item }) {
  const [imgSrc, setImgSrc] = useState(item.image || FALLBACK_IMAGE);

  useEffect(() => {
    setImgSrc(item.image || FALLBACK_IMAGE);
  }, [item.image]);

  const portionText =
    item.servingLabel ||
    (item.portionQuantity ? `${item.portionQuantity} ${item.portionUnit || ""}` : "") +
      (item.size ? ` • ${item.size}` : "");

  return (
    <div className="flex items-center gap-3.5 p-3.5 bg-[var(--bg-sub)] rounded-2xl border border-[var(--border-color)] transition-all hover:border-[var(--brand-accent)]/20">
      <Image
        src={imgSrc}
        alt={item.name || "Dish item"}
        width={56}
        height={56}
        onError={() => setImgSrc(FALLBACK_IMAGE)}
        className="w-14 h-14 rounded-xl object-cover border border-[var(--border-color)] shrink-0 bg-[var(--bg-card)]"
      />
      <div className="flex-1 min-w-0">
        <h4 className="text-[var(--text-main)] font-bold text-sm sm:text-base truncate">
          {item.name}
        </h4>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {item.variantName && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20">
              {item.variantName}
            </span>
          )}
          {portionText && (
            <span className="text-xs text-[var(--text-muted)] truncate font-medium">
              {portionText}
            </span>
          )}
        </div>
        <p className="text-[var(--text-muted)] text-xs mt-1 font-medium">
          ₹{item.price} × {item.quantity}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[var(--brand-accent)] font-mono font-bold text-sm sm:text-base">
          ₹{(item.price || 0) * (item.quantity || 1)}
        </p>
      </div>
    </div>
  );
}

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return formatDateInTimeZone(dateStr, undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function OrderDetailClient({ orderId }) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const addBatch = useCartStore((s) => s.addBatch);
  const openCart = useCartStore((s) => s.openCart);

  const [order, setOrder] = useState(null);
  const [subOrders, setSubOrders] = useState([]);
  const [selectedSubOrderId, setSelectedSubOrderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isNotFound, setIsNotFound] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [reordering, setReordering] = useState(false);
  const [activeFeedbackOrder, setActiveFeedbackOrder] = useState(null);

  // Cancellation State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const isFetchingRef = useRef(false);

  // Live timer for cancellation countdown
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Order Details
  const fetchOrderDetail = useCallback(
    async (isManual = false) => {
      if (!orderId || isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (isManual) setIsRefreshing(true);

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
        const data = await res.json();

        if (res.status === 401) {
          setError("Unauthorized. Please log in to view this order.");
          return;
        }

        if (res.status === 404) {
          setIsNotFound(true);
          setError(data.message || "Order not found.");
          return;
        }

        if (data.success && data.order) {
          setOrder(data.order);
          setIsNotFound(false);
          setError("");

          if (Array.isArray(data.subOrders) && data.subOrders.length > 0) {
            setSubOrders(data.subOrders);
            // Default selected sub-order to current order or first sub-order
            setSelectedSubOrderId((prev) => prev || data.order._id);
          } else {
            setSubOrders([data.order]);
            setSelectedSubOrderId(data.order._id);
          }
        } else {
          setError(data.message || "Failed to load order details.");
        }
      } catch (err) {
        console.error("Order detail fetch error:", err);
        setError("Network error while checking order details.");
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [orderId]
  );

  // Initial fetch on authentication
  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchOrderDetail(false);
    } else if (authStatus === "unauthenticated") {
      router.push(`/auth/login?callbackUrl=/orders/${encodeURIComponent(orderId)}`);
    }
  }, [authStatus, orderId, fetchOrderDetail, router]);

  // Background polling for in-progress orders (30 seconds, pauses when tab is hidden)
  useEffect(() => {
    if (!order || !session) return;
    const activeStatuses = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"];
    if (!activeStatuses.includes(order.status)) return;

    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      fetchOrderDetail(false);
    }, 20000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchOrderDetail(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [order?.status, session, fetchOrderDetail]);

  // Active displayed sub-order
  const activeOrder =
    subOrders.find((so) => so._id === selectedSubOrderId) || order;

  // Reorder Handler
  const handleReorder = async (targetOrder) => {
    if (!targetOrder?.items || targetOrder.items.length === 0) return;

    setReordering(true);
    try {
      const restId =
        targetOrder.restaurant?._id?.toString() ||
        targetOrder.restaurant?.toString() ||
        targetOrder.restaurantId;

      const queryUrl = restId
        ? `/api/products?restaurant=${encodeURIComponent(restId)}`
        : "/api/products";

      const res = await fetch(queryUrl);
      if (!res.ok) {
        toast.error("Could not verify dish availability. Please check the menu to reorder.");
        return;
      }

      const data = await res.json();
      if (!data.success || !Array.isArray(data.products)) {
        toast.error("Could not verify dish availability. Please check the menu to reorder.");
        return;
      }

      const liveProducts = data.products;
      const availableItems = [];
      const unavailableItems = [];

      for (const item of targetOrder.items) {
        const itemId = (item.productId || item.product?._id || item.product || item._id)?.toString();
        const itemName = item.name?.trim().toLowerCase();

        const matched = liveProducts.find((p) => {
          if (itemId && p._id?.toString() === itemId) return true;
          if (itemName && p.name?.trim().toLowerCase() === itemName) return true;
          return false;
        });

        if (!matched) {
          unavailableItems.push({ name: item.name || "Dish", reason: "No longer on the menu" });
          continue;
        }

        if (matched.isAvailable === false) {
          unavailableItems.push({ name: matched.name, reason: "Currently sold out" });
          continue;
        }

        // Verify kitchen operational status
        const restObj = matched.restaurant || targetOrder.restaurant;
        if (restObj && typeof restObj === "object") {
          const opStatus = getRestaurantOperationalStatus(restObj);
          if (!opStatus.isOpen) {
            unavailableItems.push({
              name: matched.name,
              reason: `Kitchen closed (${opStatus.reason || "Currently Closed"})`,
            });
            continue;
          }
        }

        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        availableItems.push({
          _id: matched._id?.toString(),
          name: matched.name,
          price: Number(matched.price),
          image: matched.image || item.image,
          category: matched.category,
          type: matched.type,
          isAvailable: true,
          isFeatured: matched.isFeatured,
          description: matched.description,
          quantity: qty,
          restaurant: matched.restaurant?._id?.toString() || matched.restaurant?.toString() || restId,
          restaurantId: matched.restaurantId || matched.restaurant?._id?.toString() || matched.restaurant?.toString() || restId,
        });
      }

      if (availableItems.length > 0) {
        addBatch(availableItems);
        openCart();
        if (unavailableItems.length === 0) {
          toast.success(`Reordered ${availableItems.length} dishes into your cart!`);
        } else {
          toast.info(`Added ${availableItems.length} available dishes to cart.`);
        }
      }

      if (unavailableItems.length > 0) {
        const details = unavailableItems.map((u) => `${u.name} (${u.reason})`).join(", ");
        if (availableItems.length === 0) {
          toast.error(`Cannot reorder items: ${details}`);
        } else {
          toast.error(`Some items could not be reordered: ${details}`);
        }
      }
    } catch (err) {
      console.error("Reorder failed:", err);
      toast.error("Could not verify dish availability. Please check the menu to reorder.");
    } finally {
      setReordering(false);
    }
  };

  // Cancellation Handler
  const handleCancelOrder = async () => {
    if (!activeOrder?._id) return;

    setSubmittingCancel(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: activeOrder._id,
          reason: cancelReason.trim() || "Cancelled by customer",
        }),
      });

      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Failed to cancel order.");
        return;
      }

      toast.success("Order cancelled successfully.");
      setOrder((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      setSubOrders((prev) =>
        prev.map((o) => (o._id === activeOrder._id ? { ...o, status: "cancelled" } : o))
      );
      setShowCancelModal(false);
      setCancelReason("");
    } catch (err) {
      console.error("Cancel order error:", err);
      toast.error("Network error while cancelling order.");
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Loading Skeleton State
  if (loading || authStatus === "loading") {
    return (
      <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-[var(--text-main)]">
        <div className="h-6 w-32 bg-[var(--bg-card)] rounded-lg animate-pulse mb-6" />
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="h-8 bg-[var(--bg-sub)] rounded-xl w-64 animate-pulse" />
          <div className="h-24 bg-[var(--bg-sub)] rounded-2xl animate-pulse" />
          <div className="h-48 bg-[var(--bg-sub)] rounded-2xl animate-pulse" />
        </div>
      </main>
    );
  }

  // Not Found State
  if (isNotFound) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-md mx-auto flex flex-col items-center justify-center text-center gap-4 text-[var(--text-main)]">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
          <FileText size={32} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Order Not Found</h2>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
          The requested order could not be located, or does not belong to your account.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <Link
            href="/orders"
            className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)] text-[var(--text-main)] font-bold px-6 py-3 rounded-2xl text-xs uppercase tracking-wider transition"
          >
            ← Order History
          </Link>
          <Link
            href="/menu"
            className="bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold px-6 py-3 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-[var(--brand-accent)]/20"
          >
            Explore Menu
          </Link>
        </div>
      </main>
    );
  }

  // Generic Error State
  if (error && !order) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-md mx-auto flex flex-col items-center justify-center text-center gap-4 text-[var(--text-main)]">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Unable to Load Order</h2>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={() => fetchOrderDetail(true)}
          className="mt-2 bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-[var(--brand-accent)]/20 cursor-pointer"
        >
          Try Again
        </button>
      </main>
    );
  }

  const isDelivered = activeOrder?.status === "delivered";
  const isCancelled = activeOrder?.status === "cancelled";
  const isPending = activeOrder?.status === "pending";
  const isPickup =
    activeOrder?.orderType === "pickup" ||
    activeOrder?.notes?.includes("[PICKUP]") ||
    activeOrder?.paymentMethod?.toLowerCase().includes("pickup") ||
    activeOrder?.deliveryFee === 0;

  // Cancellation window calculation
  const cancelSettings = activeOrder?.restaurant?.cancellationSettings || {};
  const allowCancel = cancelSettings.allowCustomerCancel !== false;
  const windowMinutes = Number(cancelSettings.customerCancelWindowMinutes) || 1;
  const createdAtMs = activeOrder?.createdAt ? new Date(activeOrder.createdAt).getTime() : 0;
  const effectiveCurrentTime = currentTime > 0 ? currentTime : createdAtMs;
  const remainingMs = Math.max(0, createdAtMs + windowMinutes * 60 * 1000 - effectiveCurrentTime);
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const canCancel = isPending && allowCancel && remainingSeconds > 0;
  const remainingMinDisplay = Math.floor(remainingSeconds / 60);
  const remainingSecDisplay = (remainingSeconds % 60).toString().padStart(2, "0");

  const displayOrderId = activeOrder?.orderId || activeOrder?._id?.slice(-8) || "—";

  return (
    <main className="min-h-screen pt-28 sm:pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-[var(--text-main)] transition-colors">
      {/* Top Breadcrumb & Return to History */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--text-muted)] hover:text-[var(--brand-accent)] transition-colors group cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back to Order History</span>
        </Link>

        <button
          type="button"
          onClick={() => fetchOrderDetail(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition shadow-xs cursor-pointer"
          title="Refresh live status"
        >
          <RefreshCw
            size={12}
            className={isRefreshing ? "animate-spin text-[var(--brand-accent)]" : ""}
          />
          <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
        </button>
      </div>

      {/* Closed-Tab Delivery Alerts Prompt */}
      <DeliveryPushPrompt className="mb-6" />

      {/* Multi-Restaurant Sibling Kitchen Selector (if multi-kitchen checkout) */}
      {subOrders.length > 1 && (
        <div className="mb-6 p-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Store size={14} className="text-[var(--brand-accent)]" /> Multi-Kitchen Order ({subOrders.length} Kitchens)
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">Select kitchen to inspect</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {subOrders.map((so) => {
              const isSelected = so._id === activeOrder?._id;
              const restName = so.restaurant?.name || "Kitchen Partner";
              return (
                <button
                  key={so._id}
                  type="button"
                  onClick={() => setSelectedSubOrderId(so._id)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? "bg-[var(--brand-accent)]/10 border-[var(--brand-accent)] shadow-xs"
                      : "bg-[var(--bg-sub)] border-[var(--border-color)] hover:border-[var(--brand-accent)]/40"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-[var(--text-main)] truncate">
                      {restName}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <span>₹{so.totalAmount}</span>
                      <span>•</span>
                      <span className="capitalize">{so.status}</span>
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-[var(--brand-accent)] text-white"
                        : "bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]"
                    }`}
                  >
                    {isSelected ? "Viewing" : "View"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Order Card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Order Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[var(--border-color)]">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-mono text-[var(--brand-accent)] font-bold bg-[var(--brand-accent)]/10 px-3 py-1 rounded-lg border border-[var(--brand-accent)]/20">
                #{displayOrderId}
              </span>

              {/* Fulfillment Badge */}
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 border ${
                  isPickup
                    ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
                    : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                }`}
              >
                {isPickup ? <ShoppingBag size={12} /> : <Truck size={12} />}
                {isPickup ? "Self Pickup" : "Doorstep Delivery"}
              </span>

              {/* Status Pill */}
              <span
                className={`text-xs font-extrabold uppercase tracking-wide px-3 py-1 rounded-full border ${
                  isDelivered
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                    : isCancelled
                    ? "bg-rose-500/15 text-rose-500 border-rose-500/30"
                    : "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border-[var(--brand-accent)]/30"
                }`}
              >
                ● {activeOrder?.status}
              </span>
            </div>

            {/* Restaurant Name & Call Link */}
            <div className="flex items-center gap-2.5 flex-wrap mt-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text-main)] flex items-center gap-2">
                <Building size={20} className="text-[var(--brand-accent)]" />
                {activeOrder?.restaurant?.name || "Kitchen Partner"}
              </h1>

              {activeOrder?.restaurant?.phone && (
                <a
                  href={`tel:${activeOrder.restaurant.phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1 text-xs text-[var(--brand-accent)] font-bold hover:underline bg-[var(--brand-accent)]/10 px-2.5 py-1 rounded-lg border border-[var(--brand-accent)]/20"
                >
                  <Phone size={12} /> Call Kitchen
                </a>
              )}
            </div>

            <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-2 font-medium">
              <Clock size={13} /> Placed on {formatDate(activeOrder?.createdAt)}
            </p>
          </div>

          {/* Payment Status Summary Box */}
          <div className="sm:text-right bg-[var(--bg-sub)] p-4 rounded-2xl border border-[var(--border-color)] min-w-[180px]">
            <span className="text-[11px] text-[var(--text-muted)] font-semibold block uppercase tracking-wider">
              Payment Summary
            </span>
            <p className="text-xl sm:text-2xl font-mono font-black text-[var(--brand-accent)] mt-0.5">
              ₹{activeOrder?.totalAmount}
            </p>
            <p className="text-xs font-semibold text-[var(--text-main)] mt-1 truncate">
              {activeOrder?.paymentMethod || "Online Payment"}
            </p>
            <div className="mt-1">
              <span
                className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                  activeOrder?.paymentStatus === "paid" || activeOrder?.paymentStatus === "test_paid"
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                    : activeOrder?.paymentStatus === "pending"
                    ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                    : "bg-rose-500/15 text-rose-500 border-rose-500/30"
                }`}
              >
                Status: {activeOrder?.paymentStatus || "pending"}
              </span>
            </div>
          </div>
        </div>

        {/* Status Tracker Timeline */}
        <div className="py-2">
          <OrderStatusTracker
            orderId={activeOrder?.orderId || activeOrder?._id}
            status={activeOrder?.status}
            paymentStatus={activeOrder?.paymentStatus}
            isPickup={isPickup}
            cancellationReason={activeOrder?.cancellationReason || ""}
            statusHistory={activeOrder?.statusHistory || []}
            notes={activeOrder?.notes || ""}
            createdAt={activeOrder?.createdAt}
            assignedDeliveryStaff={activeOrder?.assignedDeliveryStaff}
          />
        </div>

        {/* Live Delivery Map (when actively out for delivery) */}
        {activeOrder?.status === "out_for_delivery" && !isPickup && (
          <div className="pt-2">
            <h3 className="text-sm font-bold text-[var(--text-main)] mb-3 flex items-center gap-1.5">
              <Truck size={16} className="text-[var(--brand-accent)]" /> Live Doorstep Delivery Tracking
            </h3>
            <LiveDeliveryMap
              orderId={activeOrder?.orderId || activeOrder?._id}
              initialStatus={activeOrder?.status}
              isPickup={isPickup}
              restaurant={activeOrder?.restaurant}
              destination={activeOrder?.address}
            />
          </div>
        )}

        {/* Itemized Order Summary */}
        <div className="pt-4 border-t border-[var(--border-color)] space-y-3">
          <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
            <Receipt size={16} className="text-[var(--brand-accent)]" /> Itemized Dishes (
            {activeOrder?.items?.length || 0})
          </h3>
          <div className="space-y-2.5">
            {activeOrder?.items?.map((item, idx) => (
              <OrderItemRow key={idx} item={item} />
            ))}
          </div>
        </div>

        {/* Receipt & Financial Charges Breakdown */}
        <div className="pt-4 border-t border-[var(--border-color)] grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Fulfillment Address */}
          <div className="space-y-2 text-xs text-[var(--text-muted)] bg-[var(--bg-sub)] p-4 rounded-2xl border border-[var(--border-color)]">
            <h4 className="font-bold text-[var(--text-main)] text-xs uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={13} className="text-[var(--brand-accent)]" />
              {isPickup ? "Pickup Location & Customer" : "Doorstep Delivery Destination"}
            </h4>
            <p className="font-semibold text-[var(--text-main)] text-sm">
              {activeOrder?.address?.fullName || "Valued Customer"}
            </p>
            {activeOrder?.address?.phone && (
              <p className="flex items-center gap-1">
                <Phone size={11} /> +91 {activeOrder.address.phone}
              </p>
            )}
            {!isPickup && (
              <p className="leading-relaxed">
                {activeOrder?.address?.street}, {activeOrder?.address?.city}
                {activeOrder?.address?.pincode ? ` - ${activeOrder.address.pincode}` : ""}
              </p>
            )}
            {activeOrder?.notes && (
              <p className="pt-1 text-[11px] text-[var(--text-muted)] italic border-t border-[var(--border-color)] mt-2">
                Special instructions: {activeOrder.notes}
              </p>
            )}
          </div>

          {/* Cost Summary Table */}
          <div className="space-y-2 text-xs bg-[var(--bg-sub)] p-4 rounded-2xl border border-[var(--border-color)]">
            <h4 className="font-bold text-[var(--text-main)] text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <CreditCard size={13} className="text-[var(--brand-accent)]" /> Price Breakdown
            </h4>
            <div className="flex justify-between items-center text-[var(--text-muted)]">
              <span>Items Subtotal</span>
              <span className="font-mono font-medium text-[var(--text-main)]">
                ₹{activeOrder?.subtotal || activeOrder?.items?.reduce((s, i) => s + i.price * i.quantity, 0) || 0}
              </span>
            </div>
            <div className="flex justify-between items-center text-[var(--text-muted)]">
              <span>Delivery Fee</span>
              <span className="font-mono font-medium text-[var(--text-main)]">
                {activeOrder?.deliveryFee > 0 ? `₹${activeOrder.deliveryFee}` : "FREE"}
              </span>
            </div>
            {activeOrder?.discount > 0 && (
              <div className="flex justify-between items-center text-emerald-500 font-medium">
                <span className="flex items-center gap-1">
                  <Tag size={12} /> Promo Discount {activeOrder.couponCode ? `(${activeOrder.couponCode})` : ""}
                </span>
                <span className="font-mono">-₹{activeOrder.discount}</span>
              </div>
            )}
            <div className="pt-2 border-t border-[var(--border-color)] flex justify-between items-center text-sm font-bold text-[var(--text-main)]">
              <span>Total Paid</span>
              <span className="text-base font-mono font-black text-[var(--brand-accent)]">
                ₹{activeOrder?.totalAmount}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Cancellation Inline Form (if active) */}
        {showCancelModal && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                <AlertTriangle size={15} /> Confirm Order Cancellation
              </p>
              <span className="text-[11px] font-mono text-rose-500 font-bold">
                {remainingMinDisplay}:{remainingSecDisplay} left
              </span>
            </div>
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
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition cursor-pointer ${
                    cancelReason === reason
                      ? "bg-[var(--brand-accent)] text-white border-[var(--brand-accent)]"
                      : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-main)] outline-none focus:border-rose-500"
            />
            <div className="flex justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={submittingCancel}
                onClick={handleCancelOrder}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submittingCancel ? (
                  <span>Cancelling...</span>
                ) : (
                  <>
                    <XCircle size={13} /> Confirm Cancellation
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-6 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/orders"
            className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] inline-flex items-center gap-1.5"
          >
            ← View All Orders
          </Link>

          <div className="flex items-center gap-2.5 ml-auto">
            {/* Customer Cancellation Button */}
            {canCancel && !showCancelModal && (
              <Tooltip
                content="Cancel this order before kitchen starts preparation. If paid online, a full refund is automatically issued."
                placement="top"
              >
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <XCircle size={13} />
                  <span>Cancel Order ({remainingMinDisplay}:{remainingSecDisplay})</span>
                </button>
              </Tooltip>
            )}

            {/* Rate Order Button for Delivered Orders */}
            {isDelivered && (
              <button
                type="button"
                onClick={() => setActiveFeedbackOrder(activeOrder)}
                className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span>Rate Order</span>
              </button>
            )}

            {/* Reorder Button */}
            <Tooltip
              content="Add all available dishes from this kitchen back to your cart for quick re-ordering"
              placement="top"
            >
              <button
                type="button"
                disabled={reordering}
                onClick={() => handleReorder(activeOrder)}
                className="px-4 py-2 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[var(--brand-accent)]/20 transition cursor-pointer disabled:opacity-50"
              >
                <RotateCcw size={13} className={reordering ? "animate-spin" : ""} />
                {reordering ? "Checking..." : "Reorder Dishes"}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {activeFeedbackOrder && (
        <FeedbackModal
          order={activeFeedbackOrder}
          isOpen={Boolean(activeFeedbackOrder)}
          onClose={() => setActiveFeedbackOrder(null)}
        />
      )}
    </main>
  );
}
