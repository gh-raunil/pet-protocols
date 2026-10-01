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
  CreditCard,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import OrderStatusTracker from "@/components/orders/OrderStatusTracker";

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

    // Stop polling if order reaches a final state
    const intervalId = setInterval(() => {
      if (order?.status !== "delivered" && order?.status !== "cancelled") {
        fetchOrder(false);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
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
  const restaurantName = activeRest?.name || (typeof order.restaurant === "object" ? order.restaurant?.name : "Pet Protocols Kitchen") || "Partner Kitchen";

  const rawRestAddr = activeRest?.address;
  const restaurantAddressStr = typeof rawRestAddr === "object" && rawRestAddr
    ? [rawRestAddr.street, rawRestAddr.buildingFloor, rawRestAddr.landmark, rawRestAddr.city, rawRestAddr.state, rawRestAddr.pincode].filter(Boolean).join(", ")
    : typeof rawRestAddr === "string" ? rawRestAddr : null;

  const restPhone = activeRest?.phone && activeRest?.showPhoneToCustomers !== false ? activeRest.phone : null;
  const restWhatsapp = activeRest?.whatsappNumber && activeRest?.showWhatsappToCustomers !== false ? activeRest.whatsappNumber : null;
  const cleanWaDigits = restWhatsapp ? restWhatsapp.replace(/\D/g, "") : "";

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
      </div>

      {/* Honest Order-Status Progress Tracker (No fake GPS) */}
      <section className="space-y-2">
        <OrderStatusTracker
          status={order.status}
          paymentStatus={order.paymentStatus}
        />
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
                <div key={idx} className="pt-3 first:pt-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[var(--bg-sub)] shrink-0 border border-[var(--border-color)]">
                      <Image
                        src={item.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200"}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="48px"
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
                    `Hi ${restaurantName}, I'm checking on my order #${orderIdDisplay} on Pet Protocols.`
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

          {/* Destination Address */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <MapPin size={14} className="text-[var(--brand-accent)]" /> Delivery Destination
            </h3>
            {order.address ? (
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
    </main>
  );
}
