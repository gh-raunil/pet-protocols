"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { OrderCardSkeleton } from "@/components/ui/Skeleton";
import {
  Building,
  Package,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Phone,
  XCircle,
  AlertTriangle,
  ShoppingBag,
  Truck,
  Tag,
  RefreshCw,
  Calendar,
  Star,
  FileText,
  CreditCard,
  ChevronDown,
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

function OrderHistoryDishItem({ item }) {
  const [imgSrc, setImgSrc] = useState(item.image || FALLBACK_IMAGE);

  useEffect(() => {
    setImgSrc(item.image || FALLBACK_IMAGE);
  }, [item.image]);

  const portionText =
    item.servingLabel ||
    (item.portionQuantity ? `${item.portionQuantity} ${item.portionUnit || ""}` : "") +
      (item.size ? ` • ${item.size}` : "");

  return (
    <div className="flex items-center gap-3.5 bg-[var(--bg-sub)] p-3 rounded-2xl border border-[var(--border-color)]">
      <Image
        src={imgSrc}
        alt={item.name || "Dish item"}
        width={52}
        height={52}
        onError={() => setImgSrc(FALLBACK_IMAGE)}
        className="w-13 h-13 rounded-xl object-cover border border-[var(--border-color)] shrink-0 bg-[var(--bg-card)]"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[var(--text-main)] font-bold text-xs sm:text-sm truncate">
          {item.name}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {item.variantName && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20">
              {item.variantName}
            </span>
          )}
          {portionText && (
            <span className="text-[11px] text-[var(--text-muted)] truncate font-medium">
              {portionText}
            </span>
          )}
        </div>
        <p className="text-[var(--text-muted)] text-xs mt-0.5">
          ₹{item.price} × {item.quantity}
        </p>
      </div>
      <p className="text-[var(--brand-accent)] font-mono font-bold text-xs sm:text-sm shrink-0">
        ₹{(item.price || 0) * (item.quantity || 1)}
      </p>
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

export default function OrdersClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const addBatch = useCartStore((s) => s.addBatch);
  const openCart = useCartStore((s) => s.openCart);

  // Orders State & Pagination
  const [orders, setOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [reorderingOrderId, setReorderingOrderId] = useState(null);
  const [activeFeedbackOrder, setActiveFeedbackOrder] = useState(null);

  // Cancellation State
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Date filter state: "today" (default) | "date" | "all"
  const [dateFilterMode, setDateFilterMode] = useState("today");
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  });

  const todayDateStr = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  const getOrderDateStr = useCallback((dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch {
      return "";
    }
  }, []);

  const todayOrdersCount = useMemo(() => {
    return orders.filter((o) => getOrderDateStr(o.createdAt) === todayDateStr).length;
  }, [orders, todayDateStr, getOrderDateStr]);

  // Client-side date filter fallback for currently loaded orders
  const filteredOrders = useMemo(() => {
    if (dateFilterMode === "all") {
      return orders;
    }
    if (dateFilterMode === "today") {
      return orders.filter((o) => getOrderDateStr(o.createdAt) === todayDateStr);
    }
    if (dateFilterMode === "date" && selectedDate) {
      return orders.filter((o) => getOrderDateStr(o.createdAt) === selectedDate);
    }
    return orders;
  }, [orders, dateFilterMode, todayDateStr, selectedDate, getOrderDateStr]);

  // Auth Guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/orders");
    }
  }, [status, router]);

  // Live timer for cancellation countdown
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isFetchingRef = useRef(false);
  const fetchSeqRef = useRef(0);

  // Unified fetchOrders with backend pagination and date filtering
  const fetchOrders = useCallback(
    async (
      isManual = false,
      targetPage = 1,
      append = false,
      overrideFilterMode = null,
      overrideDate = null
    ) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      const currentSeq = ++fetchSeqRef.current;

      if (isManual) setIsRefreshing(true);
      if (append) setLoadingMore(true);

      const activeMode = overrideFilterMode || dateFilterMode;
      const activeDate = overrideDate !== undefined ? overrideDate : selectedDate;

      let queryParams = `?page=${targetPage}&limit=20`;
      if (activeMode === "today") {
        queryParams += "&date=today";
      } else if (activeMode === "date" && activeDate) {
        queryParams += `&date=${encodeURIComponent(activeDate)}`;
      } else {
        queryParams += "&date=all";
      }

      try {
        const res = await fetch(`/api/orders${queryParams}`);
        const data = await res.json();

        // Discard stale responses if a newer request was dispatched
        if (currentSeq !== fetchSeqRef.current) return;

        if (data.success) {
          const incoming = Array.isArray(data.orders) ? data.orders : [];
          const pagination = data.pagination || {};

          if (append) {
            setOrders((prev) => {
              const existingIds = new Set(prev.map((o) => (o._id || o.orderId)?.toString()));
              const newItems = incoming.filter(
                (o) => !existingIds.has((o._id || o.orderId)?.toString())
              );
              return [...prev, ...newItems];
            });
            setCurrentPage(targetPage);
          } else {
            // If background polling refresh while on higher page, merge updates in place
            if (!isManual && targetPage === 1 && currentPage > 1) {
              setOrders((prev) => {
                const incomingMap = new Map(
                  incoming.map((o) => [(o._id || o.orderId)?.toString(), o])
                );
                return prev.map((oldOrder) => {
                  const idKey = (oldOrder._id || oldOrder.orderId)?.toString();
                  return incomingMap.get(idKey) || oldOrder;
                });
              });
            } else {
              setOrders(incoming);
              setCurrentPage(targetPage);
            }
          }

          setHasMore(Boolean(pagination.hasMore));
          setTotalOrdersCount(pagination.totalOrders ?? incoming.length);
          setError("");
        } else {
          setError(data.message || "Failed to load orders.");
        }
      } catch (err) {
        if (currentSeq !== fetchSeqRef.current) return;
        console.error("Orders fetch error:", err);
        setError("Network error while loading your order history.");
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
        setLoadingMore(false);
      }
    },
    [dateFilterMode, selectedDate, currentPage]
  );

  // 1. Initial fetch when authenticated session is available or session changes
  // Note: Must remain strictly decoupled from orders array reference per F-01 contract
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      fetchOrders(false);
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, session?.user?.email, fetchOrders]);

  // 2. Stable primitive fingerprint of active in-progress orders
  const activeOrdersFingerprint = useMemo(() => {
    if (!Array.isArray(orders) || orders.length === 0) return "";
    return orders
      .filter((o) =>
        ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)
      )
      .map((o) => `${o._id || o.orderId}:${o.status}`)
      .sort()
      .join("|");
  }, [orders]);

  // 3. Background polling for active in-progress orders (pauses on hidden tab)
  useEffect(() => {
    if (!session || !activeOrdersFingerprint) return;

    const intervalId = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      fetchOrders(false, 1, false);
    }, 30000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchOrders(false, 1, false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session, fetchOrders, activeOrdersFingerprint]);

  // Load More Handler for Pagination
  const handleLoadMore = () => {
    if (loadingMore || !hasMore || isFetchingRef.current) return;
    fetchOrders(false, currentPage + 1, true);
  };

  // Filter Change Handlers (Reset pagination to page 1)
  const handleSelectFilterMode = (mode) => {
    if (mode === dateFilterMode && mode !== "date") return;
    setDateFilterMode(mode);
    setCurrentPage(1);
    const targetDate = mode === "today" ? todayDateStr : mode === "date" ? selectedDate : null;
    if (mode === "today") setSelectedDate(todayDateStr);
    fetchOrders(false, 1, false, mode, targetDate);
  };

  const handleDateChange = (newDate) => {
    if (!newDate) return;
    setSelectedDate(newDate);
    setDateFilterMode("date");
    setCurrentPage(1);
    fetchOrders(false, 1, false, "date", newDate);
  };

  // Reorder Handler
  const handleReorder = async (order) => {
    if (!order.items || order.items.length === 0) return;

    setReorderingOrderId(order._id);
    try {
      const restId =
        order.restaurant?._id?.toString() ||
        order.restaurant?.toString() ||
        order.restaurantId;

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

      for (const item of order.items) {
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
        const restObj = matched.restaurant || order.restaurant;
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
      setReorderingOrderId(null);
    }
  };

  // Cancellation Handler
  const handleCancelOrder = async (orderId) => {
    if (!orderId) return;

    setSubmittingCancel(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason: cancelReason.trim() || "Cancelled by customer",
        }),
      });

      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Failed to cancel order.");
        return;
      }

      toast.success("Order cancelled successfully.");
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, status: "cancelled" } : o))
      );
      setCancellingOrderId(null);
      setCancelReason("");
    } catch (err) {
      console.error(err);
      toast.error("Network error while cancelling order.");
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Initial Loading Skeleton
  if (loading || status === "loading") {
    return (
      <main className="min-h-screen pt-32 pb-20 px-4 sm:px-6 max-w-4xl mx-auto text-[var(--text-main)]">
        <div className="mb-8 space-y-2">
          <div className="h-8 bg-[var(--bg-card)] rounded-xl w-48 animate-pulse" />
          <div className="h-4 bg-[var(--bg-card)] rounded-lg w-28 animate-pulse" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  // Error State
  if (error && orders.length === 0) {
    return (
      <main className="min-h-screen pt-32 pb-20 px-4 sm:px-6 max-w-md mx-auto flex flex-col items-center justify-center text-center gap-4 text-[var(--text-main)]">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black">Unable to load orders</h2>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
          {error}
        </p>
        <button
          type="button"
          onClick={() => fetchOrders(true, 1, false)}
          className="mt-2 bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-[var(--brand-accent)]/20 cursor-pointer"
        >
          Try Again
        </button>
      </main>
    );
  }

  // Empty State
  if (orders.length === 0) {
    return (
      <main className="min-h-screen pt-32 pb-20 px-4 sm:px-6 max-w-md mx-auto flex flex-col items-center justify-center text-center gap-4 text-[var(--text-main)]">
        <div className="w-20 h-20 rounded-3xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 flex items-center justify-center text-[var(--brand-accent)]">
          <Package size={36} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black">No orders yet</h2>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
          Explore delicious offerings from our partner kitchens and place your first feast.
        </p>
        <Link
          href="/menu"
          className="mt-2 bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-[var(--brand-accent)]/20"
        >
          Explore Menu & Order
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-[var(--text-main)] transition-colors">
      {/* Editorial Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[var(--brand-accent)] text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles size={14} /> Order History & Live Tracking
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold mt-1 tracking-tight">
            My <span className="text-[var(--brand-accent)]">Orders</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {totalOrdersCount || orders.length}{" "}
            {(totalOrdersCount || orders.length) === 1 ? "order" : "orders"} recorded on पेट Protocols
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchOrders(true, 1, false)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition shadow-xs cursor-pointer self-start sm:self-auto"
          title="Refresh order history & live statuses"
        >
          <RefreshCw
            size={13}
            className={isRefreshing ? "animate-spin text-[var(--brand-accent)]" : ""}
          />
          <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
        </button>
      </div>

      {/* Closed-Tab Delivery Alerts Permission Prompt */}
      <DeliveryPushPrompt className="mb-6" />

      {/* Date Filter & Range Toolbar */}
      <div className="mb-6 p-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Today Button */}
          <button
            type="button"
            onClick={() => handleSelectFilterMode("today")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              dateFilterMode === "today"
                ? "bg-[var(--brand-accent)] text-white shadow-md shadow-[var(--brand-accent)]/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)]"
            }`}
          >
            <Calendar size={13} />
            <span>Today ({todayOrdersCount})</span>
          </button>

          {/* All Orders Button */}
          <button
            type="button"
            onClick={() => handleSelectFilterMode("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              dateFilterMode === "all"
                ? "bg-[var(--brand-accent)] text-white shadow-md shadow-[var(--brand-accent)]/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)]"
            }`}
          >
            <span>All Orders ({totalOrdersCount || orders.length})</span>
          </button>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
            <span>Filter by Date:</span>
          </label>
          <input
            type="date"
            value={selectedDate}
            max={todayDateStr}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-2.5 py-1 text-xs font-medium rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)] cursor-pointer w-auto min-w-0 max-w-[130px] sm:max-w-none"
            title="Pick a specific date to view orders"
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 sm:p-10 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center mx-auto">
            <Calendar size={26} />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-main)]">
            {dateFilterMode === "today"
              ? "No orders placed today"
              : `No orders on ${selectedDate}`}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {dateFilterMode === "today"
              ? `You haven't placed any orders today. You have other orders across past dates.`
              : `No orders match this date. Select another date or view all your orders.`}
          </p>
          <button
            type="button"
            onClick={() => handleSelectFilterMode("all")}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 hover:opacity-90 transition cursor-pointer"
          >
            <span>View All Orders</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => {
            const isDelivered = order.status === "delivered";
            const isCancelled = order.status === "cancelled";
            const isPending = order.status === "pending";
            const isPickup =
              order.orderType === "pickup" ||
              order.notes?.includes("[PICKUP]") ||
              order.paymentMethod?.toLowerCase().includes("pickup") ||
              order.deliveryFee === 0;

            const orderDetailUrl = `/orders/${order._id || order.orderId}`;

            // Cancellation window calculations
            const cancelSettings = order.restaurant?.cancellationSettings || {};
            const allowCancel = cancelSettings.allowCustomerCancel !== false;
            const windowMinutes = Number(cancelSettings.customerCancelWindowMinutes) || 1;
            const createdAtMs = new Date(order.createdAt).getTime();
            const effectiveCurrentTime = currentTime > 0 ? currentTime : createdAtMs;
            const remainingMs = Math.max(0, createdAtMs + windowMinutes * 60 * 1000 - effectiveCurrentTime);
            const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
            const canCancel = isPending && allowCancel && remainingSeconds > 0;
            const remainingMinDisplay = Math.floor(remainingSeconds / 60);
            const remainingSecDisplay = (remainingSeconds % 60).toString().padStart(2, "0");

            return (
              <div
                key={order._id || order.orderId}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-7 hover:border-[var(--brand-accent)]/40 transition-all duration-300 shadow-xl space-y-4"
              >
                {/* Top Bar */}
                <div className="flex justify-between items-start flex-wrap gap-3 pb-4 border-b border-[var(--border-color)]">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link
                        href={orderDetailUrl}
                        className="text-xs font-mono text-[var(--brand-accent)] font-bold bg-[var(--brand-accent)]/10 px-2.5 py-0.5 rounded-md border border-[var(--brand-accent)]/20 hover:underline cursor-pointer"
                        title="View order details"
                      >
                        #{order.orderId || order._id.slice(-8)}
                      </Link>

                      {/* Fulfillment badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                          isPickup
                            ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
                            : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                        }`}
                      >
                        {isPickup ? <ShoppingBag size={11} /> : <Truck size={11} />}
                        {isPickup ? "Self Pickup" : "Doorstep Delivery"}
                      </span>

                      {order.restaurant?.name && (
                        <span className="flex items-center gap-1 text-xs text-[var(--text-main)] font-semibold bg-[var(--bg-sub)] px-2.5 py-0.5 rounded-md border border-[var(--border-color)]">
                          <Building size={12} className="text-[var(--brand-accent)]" />
                          {order.restaurant.name}
                        </span>
                      )}

                      {order.restaurant?.phone && (
                        <a
                          href={`tel:${order.restaurant.phone.replace(/\s+/g, "")}`}
                          className="flex items-center gap-1 text-[11px] text-[var(--brand-accent)] font-semibold hover:underline bg-[var(--brand-accent)]/10 px-2 py-0.5 rounded border border-[var(--brand-accent)]/20"
                        >
                          <Phone size={10} /> Call Kitchen
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-1 font-medium">
                      <Clock size={12} /> {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <span
                      className={`inline-block text-[11px] px-3 py-1 rounded-full font-extrabold uppercase tracking-wide border ${
                        isDelivered
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                          : isCancelled
                          ? "bg-red-500/15 text-red-500 border-red-500/30"
                          : "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border-[var(--brand-accent)]/30"
                      }`}
                    >
                      ● {order.status}
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      {order.paymentMethod || "Online Payment"}
                      {order.paymentStatus && ` (${order.paymentStatus})`}
                    </p>
                  </div>
                </div>

                {/* Order Items */}
                <div className="py-2 space-y-2.5">
                  {order.items?.map((item, idx) => (
                    <OrderHistoryDishItem key={idx} item={item} />
                  ))}
                </div>

                {/* Status Progression Tracker */}
                <div className="py-2">
                  <OrderStatusTracker
                    orderId={order.orderId || order._id}
                    status={order.status}
                    paymentStatus={order.paymentStatus}
                    isPickup={isPickup}
                    cancellationReason={order.cancellationReason || ""}
                    statusHistory={order.statusHistory || []}
                    notes={order.notes || ""}
                    createdAt={order.createdAt}
                    assignedDeliveryStaff={order.assignedDeliveryStaff}
                  />
                  {order.status === "out_for_delivery" && !isPickup && (
                    <div className="pt-3">
                      <LiveDeliveryMap
                        orderId={order.orderId || order._id}
                        initialStatus={order.status}
                        isPickup={isPickup}
                        restaurant={order.restaurant}
                        destination={order.address}
                      />
                    </div>
                  )}
                </div>

                {/* Customer Cancellation Inline Form (if active) */}
                {cancellingOrderId === order._id && (
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
                        onClick={() => setCancellingOrderId(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-sub)] transition cursor-pointer"
                      >
                        Keep Order
                      </button>
                      <button
                        type="button"
                        disabled={submittingCancel}
                        onClick={() => handleCancelOrder(order._id)}
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

                {/* Footer Actions, Delivery Info, and Total */}
                <div className="pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="text-xs text-[var(--text-muted)] space-y-1">
                    <p className="font-semibold text-[var(--text-main)]">
                      {isPickup ? "Pickup Customer: " : "Delivery to: "}
                      {order.address?.fullName}
                    </p>
                    {!isPickup && (
                      <p className="flex items-center gap-1">
                        <MapPin size={12} className="text-[var(--brand-accent)] shrink-0" />
                        {order.address?.street}, {order.address?.city}
                      </p>
                    )}
                    {order.discount > 0 && (
                      <p className="text-emerald-500 font-semibold flex items-center gap-1">
                        <Tag size={12} /> Promo discount applied: -₹{order.discount}
                      </p>
                    )}
                    <div className="pt-1 flex items-center gap-3">
                      <Link
                        href={orderDetailUrl}
                        className="text-xs font-bold text-[var(--brand-accent)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        View Order Details & Itemized Receipt <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-[var(--text-muted)] block">Total Paid</span>
                      <span className="text-[var(--brand-accent)] font-black text-xl sm:text-2xl font-mono">
                        ₹{order.totalAmount}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Customer Cancellation Button */}
                      {canCancel && cancellingOrderId !== order._id && (
                        <Tooltip
                          content="Cancel this order before kitchen starts preparation. If paid online, full refund is automatically issued."
                          placement="top"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setCancellingOrderId(order._id);
                              setCancelReason("");
                            }}
                            className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                            aria-label="Cancel order within grace period"
                          >
                            <XCircle size={13} />
                            <span>Cancel ({remainingMinDisplay}:{remainingSecDisplay})</span>
                          </button>
                        </Tooltip>
                      )}

                      {/* Rate Order Button for Delivered Orders */}
                      {isDelivered && (
                        <button
                          type="button"
                          onClick={() => setActiveFeedbackOrder(order)}
                          className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                          aria-label="Rate and review this order"
                        >
                          <Star size={13} className="fill-amber-400 text-amber-400" />
                          <span>Rate Order</span>
                        </button>
                      )}

                      {/* Reorder Button */}
                      <Tooltip
                        content="Add all available dishes from this order back to your cart for quick re-ordering"
                        placement="top"
                      >
                        <button
                          type="button"
                          disabled={reorderingOrderId === order._id}
                          onClick={() => handleReorder(order)}
                          className="px-4 py-2 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[var(--brand-accent)]/20 transition cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw
                            size={13}
                            className={reorderingOrderId === order._id ? "animate-spin" : ""}
                          />
                          {reorderingOrderId === order._id ? "Checking..." : "Reorder"}
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls & Loading States */}
          {hasMore && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)] text-xs font-bold text-[var(--text-main)] shadow-sm hover:shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-[var(--brand-accent)]" />
                    <span>Loading more orders...</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} className="text-[var(--brand-accent)]" />
                    <span>
                      Load More Orders (Showing {filteredOrders.length}
                      {totalOrdersCount ? ` of ${totalOrdersCount}` : ""})
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {!hasMore && orders.length > 0 && (
            <div className="pt-6 text-center text-xs text-[var(--text-muted)] font-medium">
              <span>You have reached the beginning of your order history.</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link
          href="/menu"
          className="inline-block bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-[var(--brand-accent)]/20"
        >
          Explore More Menus 🍔
        </Link>
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