"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import OrderStatusTracker from "@/components/orders/OrderStatusTracker";
import DeliveryPushPrompt from "@/components/notifications/DeliveryPushPrompt";
import useCartStore from "@/lib/cartStore";
import { toast } from "@/components/ui/ToastProvider";
import { formatDateInTimeZone } from "@/lib/timeZone";

const formatDate = (dateStr) => {
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
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Customer Cancellation Modal/State
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/orders");
    }
  }, [status, router]);

  // Live timer for cancellation window countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session) return;

    async function fetchOrders() {
      try {
        const res = await fetch("/api/orders");
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [session]);

  const handleReorder = (order) => {
    if (!order.items || order.items.length === 0) return;

    let addedCount = 0;
    order.items.forEach((item) => {
      for (let i = 0; i < (item.quantity || 1); i++) {
        addItem({
          _id: item.productId || item.product || item._id,
          name: item.name,
          price: item.price,
          image: item.image,
          isAvailable: true,
          restaurant: order.restaurant,
        });
      }
      addedCount++;
    });

    toast.success(`Reordered ${addedCount} dishes into your cart!`);
    openCart();
  };

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
      {/* Header */}
      <div className="mb-8">
        <span className="text-[var(--brand-accent)] text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles size={14} /> Order History & Tracking
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold mt-1 tracking-tight">
          My <span className="text-[var(--brand-accent)]">Orders</span>
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
          {orders.length} {orders.length === 1 ? "order" : "orders"} placed on Pet Protocols
        </p>
      </div>

      {/* Closed-Tab Delivery Alerts Permission Prompt */}
      <DeliveryPushPrompt className="mb-6" />

      {/* Orders List */}
      <div className="space-y-6">
        {orders.map((order) => {
          const isDelivered = order.status === "delivered";
          const isCancelled = order.status === "cancelled";
          const isPending = order.status === "pending";
          const isPickup =
            order.notes?.includes("[PICKUP]") ||
            order.paymentMethod?.toLowerCase().includes("pickup") ||
            order.deliveryFee === 0;

          // Cancellation window calculations
          const cancelSettings = order.restaurant?.cancellationSettings || {};
          const allowCancel = cancelSettings.allowCustomerCancel !== false;
          const windowMinutes = Number(cancelSettings.customerCancelWindowMinutes) || 5;
          const createdAtMs = new Date(order.createdAt).getTime();
          const remainingMs = createdAtMs + windowMinutes * 60 * 1000 - currentTime;
          const canCancel = isPending && allowCancel && remainingMs > 0;
          const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
          const remainingMinDisplay = Math.floor(remainingSeconds / 60);
          const remainingSecDisplay = (remainingSeconds % 60).toString().padStart(2, "0");

          return (
            <div
              key={order._id}
              className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-7 hover:border-[var(--brand-accent)]/40 transition-all duration-300 shadow-xl space-y-4"
            >
              {/* Top Bar */}
              <div className="flex justify-between items-start flex-wrap gap-3 pb-4 border-b border-[var(--border-color)]">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-[var(--brand-accent)] font-bold bg-[var(--brand-accent)]/10 px-2.5 py-0.5 rounded-md border border-[var(--brand-accent)]/20">
                      #{order.orderId || order._id.slice(-8)}
                    </span>

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
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div className="py-2 space-y-2.5">
                {order.items?.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3.5 bg-[var(--bg-sub)] p-3 rounded-2xl border border-[var(--border-color)]"
                  >
                    <Image
                      src={item.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200"}
                      alt={item.name}
                      width={52}
                      height={52}
                      className="w-13 h-13 rounded-xl object-cover border border-[var(--border-color)] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--text-main)] font-bold text-xs sm:text-sm truncate">
                        {item.name}
                      </p>
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">
                        ₹{item.price} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-[var(--brand-accent)] font-mono font-bold text-xs sm:text-sm shrink-0">
                      ₹{item.price * item.quantity}
                    </p>
                  </div>
                ))}
              </div>

              {/* Status Progression Tracker */}
              <div className="py-2">
                <OrderStatusTracker
                  status={order.status}
                  paymentStatus={order.paymentStatus}
                />
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
                  <input
                    type="text"
                    placeholder="Reason for cancellation (optional)"
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
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {submittingCancel ? (
                        <span>Cancelling...</span>
                      ) : (
                        <>
                          <XCircle size={13} /> Cancel Order
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
                      href={`/order-confirmation?orderId=${order._id}`}
                      className="text-xs font-bold text-[var(--brand-accent)] hover:underline inline-flex items-center gap-1"
                    >
                      View Live Tracker & Receipt <ArrowRight size={13} />
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
                      <button
                        type="button"
                        onClick={() => {
                          setCancellingOrderId(order._id);
                          setCancelReason("");
                        }}
                        className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        title="Cancel order within cancellation grace period"
                      >
                        <XCircle size={13} />
                        <span>Cancel ({remainingMinDisplay}:{remainingSecDisplay})</span>
                      </button>
                    )}

                    {/* Reorder Button */}
                    <button
                      type="button"
                      onClick={() => handleReorder(order)}
                      className="px-4 py-2 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[var(--brand-accent)]/20 transition cursor-pointer"
                    >
                      <RotateCcw size={13} /> Reorder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <Link
          href="/menu"
          className="inline-block bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-[var(--brand-accent)]/20"
        >
          Explore More Menus 🍔
        </Link>
      </div>
    </main>
  );
}