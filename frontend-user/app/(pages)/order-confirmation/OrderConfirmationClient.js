"use client";

import { useEffect, useState, useCallback } from "react";
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
  MessageSquare,
} from "lucide-react";
import OrderStatusTracker from "@/components/orders/OrderStatusTracker";

const POLL_INTERVAL = 10000; // Poll status every 10s

export default function OrderConfirmationClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderIdParam = searchParams.get("orderId") || searchParams.get("id");

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

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

  // Initial fetch and 10s live polling with cleanup on unmount
  useEffect(() => {
    fetchOrder(false);

    const intervalId = setInterval(() => {
      fetchOrder(false);
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchOrder]);

  if (loading) {
    return (
      <main className="min-h-screen pt-32 pb-20 px-4 max-w-3xl mx-auto text-white flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-sm font-semibold text-gray-400">Loading order confirmation...</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen pt-32 pb-20 px-4 max-w-md mx-auto text-white flex flex-col items-center justify-center text-center gap-5">
        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
          📦
        </div>
        <h1 className="text-2xl font-black">Order Confirmation</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          {error || "We couldn't retrieve the details for this order. You can view all your orders in your account."}
        </p>
        <div className="flex gap-3">
          <Link
            href="/orders"
            className="px-6 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-orange-500/20"
          >
            Go to My Orders
          </Link>
          <Link
            href="/menu"
            className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider border border-white/10 transition"
          >
            Explore Menu
          </Link>
        </div>
      </main>
    );
  }

  const orderIdDisplay = order.orderId || order._id?.slice(-8) || "N/A";
  const restaurantName = order.restaurant?.name || "Pet Protocols Kitchen";

  return (
    <main className="min-h-screen pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-white space-y-8 font-jakarta">
      {/* Celebration Header */}
      <div className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-orange-500/20 to-amber-500/20 border border-orange-500/30 text-4xl shadow-xl shadow-orange-500/10 mb-1">
          🎉
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">
          Order <span className="text-orange-500">Confirmed!</span>
        </h1>
        <p className="text-xs sm:text-sm text-white/60 max-w-md mx-auto leading-relaxed">
          Your order has been received by <span className="font-bold text-white">{restaurantName}</span>.
          Follow real-time kitchen updates below.
        </p>

        {/* Quick status bar */}
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono">
          <span className="text-white/50">Order ID:</span>
          <span className="text-orange-400 font-bold">#{orderIdDisplay}</span>
          <span className="text-white/20">•</span>
          <button
            onClick={() => fetchOrder(true)}
            disabled={isRefreshing}
            className="text-white/70 hover:text-white flex items-center gap-1 font-sans text-[11px] font-semibold transition cursor-pointer"
            title="Refresh order status"
          >
            <RefreshCw size={11} className={isRefreshing ? "animate-spin text-orange-400" : ""} />
            <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Clean Order-Status Progress Tracker */}
      <section className="space-y-2">
        <OrderStatusTracker
          status={order.status}
          paymentStatus={order.paymentStatus}
        />
      </section>

      {/* Two-Column Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Items & Pricing Summary */}
        <div className="md:col-span-2 space-y-6">
          {/* Items Card */}
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-white/80 flex items-center gap-2">
                <Receipt size={16} className="text-orange-400" />
                Order Summary
              </h2>
              <span className="text-xs text-white/50 font-medium">
                {order.items?.length || 0} {order.items?.length === 1 ? "dish" : "dishes"}
              </span>
            </div>

            {/* Dishes list */}
            <div className="space-y-3 divide-y divide-white/5">
              {order.items?.map((item, idx) => (
                <div key={idx} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 shrink-0 border border-white/10">
                      <Image
                        src={item.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200"}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-white/40 font-mono mt-0.5">
                        ₹{item.price} × {item.quantity}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs sm:text-sm font-mono font-bold text-orange-400 shrink-0">
                    ₹{(item.price || 0) * (item.quantity || 1)}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="mt-5 pt-4 border-t border-white/10 space-y-2 text-xs">
              <div className="flex justify-between text-white/50">
                <span>Subtotal</span>
                <span className="font-mono text-white/80">₹{order.subtotal || order.totalAmount}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Delivery Fee</span>
                <span className="font-mono text-white/80">
                  {order.deliveryFee === 0 ? "FREE" : `₹${order.deliveryFee || 0}`}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono">-₹{order.discount}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-white/10 font-bold text-sm sm:text-base">
                <span className="text-white">Total Amount</span>
                <span className="font-mono font-black text-orange-400 text-lg sm:text-xl">
                  ₹{order.totalAmount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Kitchen & Delivery Details */}
        <div className="space-y-6">
          {/* Restaurant & ETA */}
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-white/50">
              Kitchen Partner
            </h3>
            <div>
              <p className="font-extrabold text-base text-white flex items-center gap-1.5">
                <Building size={16} className="text-orange-400" />
                {restaurantName}
              </p>
              {order.restaurant?.phone && (
                <p className="text-xs text-white/50 flex items-center gap-1.5 mt-1">
                  <Phone size={12} className="text-orange-400" />
                  {order.restaurant.phone}
                </p>
              )}
              {order.restaurant?.address?.street && (
                <p className="text-xs text-white/40 flex items-start gap-1.5 mt-1">
                  <MapPin size={12} className="text-orange-400 shrink-0 mt-0.5" />
                  {order.restaurant.address.street}, {order.restaurant.address.city}
                </p>
              )}
              {order.restaurant?.whatsappNumber && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                    Contact Restaurant
                  </span>
                  <a
                    href={`https://wa.me/${order.restaurant.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Hi ${restaurantName}, I'm checking on my order #${order.orderId || order._id.slice(-6).toUpperCase()}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                  >
                    <MessageSquare size={12} />
                    <span>Chat on WhatsApp</span>
                  </a>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 block mb-1">
                Estimated Delivery
              </span>
              <p className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Clock size={14} className="text-orange-400" />
                25–35 minutes
              </p>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-[#111114] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white/50">
              Delivery Destination
            </h3>
            <p className="font-bold text-sm text-white">
              {order.address?.fullName || "Customer"}
            </p>
            <p className="text-xs text-white/60 flex items-start gap-1.5 leading-relaxed">
              <MapPin size={13} className="text-orange-400 shrink-0 mt-0.5" />
              <span>
                {order.address?.street}, {order.address?.city}{" "}
                {order.address?.pincode ? `(${order.address.pincode})` : ""}
              </span>
            </p>
            {order.address?.phone && (
              <p className="text-xs text-white/60 flex items-center gap-1.5">
                <Phone size={13} className="text-orange-400 shrink-0" />
                {order.address.phone}
              </p>
            )}
            {order.notes && (
              <div className="pt-2 border-t border-white/5 text-[11px] text-white/40 italic">
                Note: "{order.notes}"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-white/10">
        <Link
          href="/orders"
          className="w-full sm:w-auto text-center px-8 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-orange-500/20"
        >
          View All Orders
        </Link>
        <Link
          href="/menu"
          className="w-full sm:w-auto text-center px-8 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-extrabold text-xs uppercase tracking-wider border border-white/10 transition"
        >
          Explore More Menus 🍔
        </Link>
      </div>
    </main>
  );
}
