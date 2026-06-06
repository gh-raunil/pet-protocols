"use client";

import { useEffect, useState } from "react";

import { useSession } from "next-auth/react";

import { useRouter } from "next/navigation";

import Link from "next/link";

import {
  ShoppingBag,
  Users,
  Package,
  IndianRupee,
} from "lucide-react";

import { StatCardSkeleton } from "@/app/components/ui/Skeleton";

export default function AdminClient() {

  const { data: session, status } = useSession();

  const router = useRouter();

  const [stats, setStats] = useState(null);

  const [loading, setLoading] = useState(true);

  const [recentOrders, setRecentOrders] = useState([]);

  // Protect admin route
  useEffect(() => {

    if (status === "unauthenticated") {
      router.push("/auth/login");
    }

    if (
      session &&
      session.user.role !== "admin"
    ) {
      router.push("/");
    }

  }, [status, session, router]);

  // Fetch dashboard data
  useEffect(() => {

    if (
      !session ||
      session.user.role !== "admin"
    ) return;

    async function fetchData() {

      try {

        const [statsRes, ordersRes] =
          await Promise.all([
            fetch("/api/admin/stats"),
            fetch("/api/orders"),
          ]);

        const statsData = await statsRes.json();

        const ordersData = await ordersRes.json();

        setStats(statsData.stats);

        setRecentOrders(
          ordersData.orders?.slice(0, 5) || []
        );

      } catch (err) {

        console.error(err);

      } finally {

        setLoading(false);

      }
    }

    fetchData();

  }, [session]);

  // Loading State
  if (
    loading ||
    status === "loading"
  ) {

    return (
      <main className="min-h-screen pt-28 pb-16 px-6 max-w-7xl mx-auto">

        {/* Header Skeleton */}
        <div className="mb-8 flex justify-between">

          <div className="space-y-2">

            <div className="
              h-10
              bg-brand-border
              rounded-full
              w-64
              animate-pulse
            " />

            <div className="
              h-4
              bg-brand-border
              rounded-full
              w-40
              animate-pulse
            " />

          </div>

          <div className="
            h-10
            bg-brand-border
            rounded-full
            w-40
            animate-pulse
          " />

        </div>

        {/* Stat Cards Skeleton */}
        <div className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-4
          gap-5
          mb-10
        ">

          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}

        </div>

        {/* Orders Skeleton */}
        <div className="
          bg-brand-card
          border border-brand-border
          rounded-2xl
          p-6
          animate-pulse
        ">

          <div className="
            h-6
            bg-brand-border
            rounded-full
            w-40
            mb-5
          " />

          {[1, 2, 3].map((i) => (

            <div
              key={i}
              className="
                flex
                justify-between
                items-center
                py-4
                border-b
                border-brand-border
              "
            >

              <div className="space-y-2">

                <div className="
                  h-4
                  bg-brand-border
                  rounded-full
                  w-32
                " />

                <div className="
                  h-3
                  bg-brand-border
                  rounded-full
                  w-48
                " />

              </div>

              <div className="flex items-center gap-3">

                <div className="
                  h-6
                  bg-brand-border
                  rounded-full
                  w-16
                " />

                <div className="
                  h-5
                  bg-brand-border
                  rounded-full
                  w-12
                " />

              </div>

            </div>

          ))}

        </div>

      </main>
    );
  }

  const statCards = [
    {
      label: "Total Products",
      value: stats?.totalProducts,
      icon: Package,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Total Orders",
      value: stats?.totalOrders,
      icon: ShoppingBag,
      color: "text-brand-orange",
      bg: "bg-orange-500/10 border-orange-500/20",
    },
    {
      label: "Total Users",
      value: stats?.totalUsers,
      icon: Users,
      color: "text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
    },
    {
      label: "Total Revenue",
      value: `₹${stats?.totalRevenue}`,
      icon: IndianRupee,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
    },
  ];

  const statusColors = {
    paid: "bg-green-500/20 text-green-400",
    pending: "bg-yellow-500/20 text-yellow-400",
    preparing: "bg-blue-500/20 text-blue-400",
    delivered: "bg-orange-500/20 text-brand-orange",
    cancelled: "bg-red-500/20 text-red-400",
  };

  return (
    <main className="min-h-screen pt-28 pb-16 px-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="
        flex
        justify-between
        items-center
        mb-8
        flex-wrap
        gap-4
      ">

        <div>

          <h1 className="text-4xl font-bold">
            Admin{" "}
            <span className="text-brand-orange">
              Dashboard
            </span>
          </h1>

          <p className="text-brand-muted mt-1">
            Welcome back,{" "}
            {session?.user?.name?.split(" ")[0]} 👑
          </p>

        </div>

        <Link
          href="/admin/products"
          className="
            bg-brand-orange
            text-white
            px-5
            py-2.5
            rounded-full
            font-semibold
            text-sm
            hover:opacity-90
            transition
          "
        >
          Manage Products →
        </Link>

      </div>

      {/* Stat Cards */}
      <div className="
        grid
        grid-cols-1
        sm:grid-cols-2
        lg:grid-cols-4
        gap-5
        mb-10
      ">

        {statCards.map((card) => (

          <div
            key={card.label}
            className={`
              bg-brand-card
              border
              rounded-2xl
              p-5
              ${card.bg}
            `}
          >

            <div className="
              flex
              justify-between
              items-start
            ">

              <div>

                <p className="
                  text-brand-muted
                  text-sm
                  mb-1
                ">
                  {card.label}
                </p>

                <p className={`
                  text-3xl
                  font-bold
                  ${card.color}
                `}>
                  {card.value}
                </p>

              </div>

              <card.icon
                size={28}
                className={`
                  ${card.color}
                  opacity-80
                `}
              />

            </div>

          </div>

        ))}

      </div>

      {/* Recent Orders */}
      <div className="
        bg-brand-card
        border border-brand-border
        rounded-2xl
        p-6
      ">

        <div className="
          flex
          justify-between
          items-center
          mb-5
        ">

          <h2 className="text-xl font-bold">
            Recent Orders
          </h2>

          <Link
            href="/orders"
            className="
              text-brand-orange
              text-sm
              hover:underline
            "
          >
            View All →
          </Link>

        </div>

        {recentOrders.length === 0 ? (

          <p className="
            text-brand-muted
            text-center
            py-8
          ">
            No orders yet.
          </p>

        ) : (

          <div className="space-y-4">

            {recentOrders.map((order) => (

              <div
                key={order._id}
                className="
                  flex
                  items-center
                  justify-between
                  flex-wrap
                  gap-3
                  border-b
                  border-brand-border
                  pb-4
                  last:border-0
                  last:pb-0
                "
              >

                <div>

                  <p className="
                    text-sm
                    font-mono
                    text-white
                  ">
                    #
                    {order.orderId?.slice(-10) ||
                      order._id?.slice(-10)}
                  </p>

                  <p className="
                    text-xs
                    text-brand-muted
                    mt-0.5
                  ">
                    {order.address?.fullName} —{" "}
                    {order.items.length} item
                    {order.items.length > 1
                      ? "s"
                      : ""}
                  </p>

                </div>

                <div className="
                  flex
                  items-center
                  gap-3
                ">

                  <span
                    className={`
                      text-xs
                      px-3
                      py-1
                      rounded-full
                      font-medium
                      ${statusColors[order.status]}
                    `}
                  >
                    {order.status
                      ?.charAt(0)
                      .toUpperCase() +
                      order.status?.slice(1)}
                  </span>

                  <span className="
                    text-brand-orange
                    font-bold
                  ">
                    ₹{order.totalAmount}
                  </span>

                </div>

              </div>

            ))}

          </div>

        )}

      </div>

    </main>
  );
}