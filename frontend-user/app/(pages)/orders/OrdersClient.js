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
} from "lucide-react";
import OrderStatusTracker from "@/components/orders/OrderStatusTracker";
import useCartStore from "@/lib/cartStore";
import { toast } from "@/components/ui/ToastProvider";

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString("en-IN", {
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/orders");
    }
  }, [status, router]);

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
      // Re-add to cart using current item specifications
      for (let i = 0; i < (item.quantity || 1); i++) {
        addItem({
          _id: item.productId || item._id,
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
          Explore delicious offerings from our verified partner kitchens and place your first feast.
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

      {/* Orders List */}
      <div className="space-y-6">
        {orders.map((order) => {
          const isDelivered = order.status === "delivered";
          const isCancelled = order.status === "cancelled";

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

              {/* Footer Actions, Delivery Info, and Total */}
              <div className="pt-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="text-xs text-[var(--text-muted)] space-y-1">
                  <p className="font-semibold text-[var(--text-main)]">
                    Delivery to: {order.address?.fullName}
                  </p>
                  <p className="flex items-center gap-1">
                    <MapPin size={12} className="text-[var(--brand-accent)] shrink-0" />
                    {order.address?.street}, {order.address?.city}
                  </p>
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

                  {/* Reorder Button (Section 15.C) */}
                  <button
                    type="button"
                    onClick={() => handleReorder(order)}
                    className="px-4 py-2 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[var(--brand-accent)]/20 transition"
                  >
                    <RotateCcw size={13} /> Reorder
                  </button>
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