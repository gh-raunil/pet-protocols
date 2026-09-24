"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { OrderCardSkeleton } from "@/components/ui/Skeleton";
import { Building, Package, Clock, Phone, MapPin, Sparkles } from "lucide-react";
import OrderStatusTracker from "@/components/orders/OrderStatusTracker";

const statusColors = {
  paid: "bg-green-500/20 text-green-400 border border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  preparing: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  delivered: "bg-green-500/20 text-green-400 border border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border border-red-500/30",
};

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

  if (loading || status === "loading") {
    return (
      <main className="min-h-screen pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <div className="mb-8 space-y-2">
          <div className="h-8 bg-white/10 rounded-xl w-48 animate-pulse" />
          <div className="h-4 bg-white/5 rounded-lg w-28 animate-pulse" />
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
      <main className="min-h-screen pt-32 pb-20 px-6 max-w-xl mx-auto flex flex-col items-center justify-center text-center gap-4 text-white">
        <div className="w-20 h-20 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
          <Package size={36} />
        </div>
        <h2 className="text-3xl font-black">No orders yet!</h2>
        <p className="text-gray-400 text-sm">
          Explore delicious offerings from our partner restaurants and place your first feast.
        </p>
        <Link
          href="/menu"
          className="mt-4 bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3.5 rounded-full text-sm transition shadow-lg shadow-orange-500/20"
        >
          Explore Menus & Order 🍔
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-32 pb-24 px-6 max-w-4xl mx-auto text-white">
      {/* Header */}
      <div className="mb-8">
        <span className="text-orange-400 text-xs font-bold uppercase tracking-widest">
          Order Tracking & History
        </span>
        <h1 className="text-4xl font-extrabold mt-0.5">
          My <span className="text-orange-500">Orders</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {orders.length} {orders.length === 1 ? "order" : "orders"} placed across Pet Protocols kitchens
        </p>
      </div>

      {/* Orders List */}
      <div className="space-y-6">
        {orders.map((order) => (
          <div
            key={order._id}
            className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 hover:border-orange-500/30 transition-all duration-300 shadow-xl"
          >
            {/* Top Bar */}
            <div className="flex justify-between items-start flex-wrap gap-3 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-orange-400 font-bold bg-orange-500/10 px-2.5 py-0.5 rounded border border-orange-500/20">
                    #{order.orderId || order._id.slice(-8)}
                  </span>
                  {order.restaurant?.name && (
                    <span className="flex items-center gap-1 text-xs text-gray-300 font-semibold bg-white/5 px-2.5 py-0.5 rounded border border-white/10">
                      <Building size={12} className="text-orange-400" />
                      {order.restaurant.name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <Clock size={12} /> {formatDate(order.createdAt)}
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`inline-block text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide ${
                    statusColors[order.status] || statusColors.pending
                  }`}
                >
                  ● {order.status}
                </span>
                <p className="text-[11px] text-gray-500 mt-1">
                  {order.paymentMethod || "Test Payment"}
                </p>
              </div>
            </div>

            {/* Order Items (Snapshot locked pricing) */}
            <div className="py-4 space-y-3">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 bg-[#141414] p-3 rounded-xl border border-white/5">
                  <Image
                    src={item.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200"}
                    alt={item.name}
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{item.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      ₹{item.price} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-orange-400 font-mono font-bold text-sm shrink-0">
                    ₹{item.price * item.quantity}
                  </p>
                </div>
              ))}
            </div>

            {/* Live Progress Tracker */}
            <div className="py-3 border-t border-white/5">
              <OrderStatusTracker status={order.status} paymentStatus={order.paymentStatus} />
            </div>

            {/* Delivery Info and Total */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="text-xs text-gray-400 space-y-0.5">
                <p className="font-semibold text-gray-300">
                  Delivery to: {order.address?.fullName}
                </p>
                <p className="flex items-center gap-1">
                  <MapPin size={12} className="text-orange-400 shrink-0" />
                  {order.address?.street}, {order.address?.city} ({order.address?.pincode})
                </p>
                <Link
                  href={`/order-confirmation?orderId=${order._id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-orange-400 hover:text-orange-300 transition pt-1"
                >
                  <span>Track Full Order Receipt →</span>
                </Link>
              </div>

              <div className="text-right sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                <p className="text-[11px] text-gray-500">
                  Subtotal: ₹{order.subtotal || order.totalAmount} • Delivery: ₹{order.deliveryFee || 0}
                </p>
                <p className="text-orange-400 font-black text-2xl font-mono">
                  ₹{order.totalAmount}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link
          href="/menu"
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3.5 rounded-full text-sm transition shadow-lg shadow-orange-500/20"
        >
          Explore More Menus 🍔
        </Link>
      </div>
    </main>
  );
}