"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OrderCardSkeleton } from "@/app/components/ui/Skeleton";

const statusColors = {
  paid: "bg-green-500/20 text-green-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  preparing: "bg-blue-500/20 text-blue-400",
  delivered: "bg-orange-500/20 text-brand-orange",
  cancelled: "bg-red-500/20 text-red-400",
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
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

  // Loading state
  if (loading || status === "loading") {
    return (
      <main className="min-h-screen pt-28 pb-16 px-6 max-w-4xl mx-auto">

        <div className="mb-8">
          <div className="h-10 bg-brand-border rounded-full w-48 animate-pulse" />
          <div className="h-4 bg-brand-border rounded-full w-24 mt-2 animate-pulse" />
        </div>

        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>

      </main>
    );
  }

  // Empty state
  if (orders.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">

        <p className="text-6xl">📦</p>

        <h2 className="text-2xl font-bold">
          No orders yet!
        </h2>

        <p className="text-brand-muted">
          Looks like you haven't ordered anything.
        </p>

        <Link
          href="/menu"
          className="
            mt-2
            bg-brand-orange
            text-white
            px-6
            py-3
            rounded-full
            font-semibold
            hover:opacity-90
            transition
          "
        >
          Order Now 🍔
        </Link>

      </main>
    );
  }

  return (
    <main className="min-h-screen pt-28 pb-16 px-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8">

        <h1 className="text-4xl font-bold">
          My <span className="text-brand-orange">Orders</span>
        </h1>

        <p className="text-brand-muted mt-1">
          {orders.length}{" "}
          {orders.length === 1 ? "order" : "orders"} placed
        </p>

      </div>

      {/* Orders List */}
      <div className="space-y-6">

        {orders.map((order) => (

          <div
            key={order._id}
            className="
              bg-brand-card
              border border-brand-border
              rounded-2xl
              p-6
              hover:border-brand-orange/40
              transition
              duration-300
            "
          >

            {/* Order Header */}
            <div className="flex justify-between items-start flex-wrap gap-3">

              <div>
                <p className="text-xs text-brand-muted mb-1">
                  Order ID
                </p>

                <p className="text-sm font-mono text-white">
                  #{order.orderId?.slice(-10) || order._id?.slice(-10)}
                </p>
              </div>

              <div className="text-right">

                <p className="text-xs text-brand-muted mb-1">
                  {formatDate(order.createdAt)}
                </p>

                <span
                  className={`
                    text-xs
                    px-3
                    py-1
                    rounded-full
                    font-medium
                    ${statusColors[order.status] || statusColors.pending}
                  `}
                >
                  {order.status?.charAt(0).toUpperCase() +
                    order.status?.slice(1)}
                </span>

              </div>

            </div>

            {/* Divider */}
            <div className="border-t border-brand-border my-4" />

            {/* Order Items */}
            <div className="space-y-3">

              {order.items.map((item) => (

                <div
                  key={item._id}
                  className="flex items-center gap-4"
                >

                  <img
                    src={item.image}
                    alt={item.name}
                    className="
                      w-14
                      h-14
                      rounded-xl
                      object-cover
                      border border-brand-border
                    "
                  />

                  <div className="flex-1">
                    <p className="text-white font-medium">
                      {item.name}
                    </p>

                    <p className="text-brand-muted text-sm">
                      ₹{item.price} × {item.quantity}
                    </p>
                  </div>

                  <p className="text-brand-orange font-semibold">
                    ₹{item.price * item.quantity}
                  </p>

                </div>

              ))}

            </div>

            {/* Divider */}
            <div className="border-t border-brand-border my-4" />

            {/* Footer */}
            <div className="flex justify-between items-center flex-wrap gap-3">

              <div>
                <p className="text-xs text-brand-muted mb-1">
                  Delivered to
                </p>

                <p className="text-sm text-white">
                  {order.address?.fullName} —{" "}
                  {order.address?.city},{" "}
                  {order.address?.state}
                </p>
              </div>

              <div className="text-right">

                <p className="text-xs text-brand-muted mb-1">
                  Total Paid
                </p>

                <p className="text-brand-orange font-bold text-xl">
                  ₹{order.totalAmount}
                </p>

              </div>

            </div>

          </div>

        ))}

      </div>

      {/* Bottom Button */}
      <div className="mt-10 text-center">

        <Link
          href="/menu"
          className="
            bg-brand-orange
            text-white
            px-8
            py-3
            rounded-full
            font-semibold
            hover:opacity-90
            transition
          "
        >
          Order More 🍔
        </Link>

      </div>

    </main>
  );
}