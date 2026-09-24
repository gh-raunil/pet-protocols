"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag,
  IndianRupee,
  UtensilsCrossed,
  PlusCircle,
  ArrowRight,
  Clock,
  RefreshCw,
} from "lucide-react";

export default function DashboardClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kitchenActive, setKitchenActive] = useState(true);

  // Route protection
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const res = await fetch("/api/restaurant/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setRecentOrders(data.recentOrders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchDashboard();
    }
  }, [session]);

  const restaurantName = stats?.restaurantName || session?.user?.restaurantName || "Partner Kitchen";

  const statusStyles = {
    pending: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30",
    preparing: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30",
    out_for_delivery: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30",
    delivered: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30",
    cancelled: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30",
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-white font-jakarta transition-colors">
      <main className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
        
        {/* ── TOP HEADER / KITCHEN CONTROL PANEL ──────────────────────── */}
        <div className="bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  {restaurantName}
                </h1>
                <span className="text-[11px] font-mono text-slate-400">
                  #{session?.user?.restaurantId?.slice(-6) || "TENANT"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kitchen operations overview and live orders summary.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setKitchenActive(!kitchenActive)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
                  kitchenActive
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${kitchenActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <span>{kitchenActive ? "Accepting Orders" : "Kitchen Paused"}</span>
              </button>

              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-3.5 py-1.5 rounded-xl text-xs transition shadow-sm"
              >
                <PlusCircle size={14} />
                <span>Add Dish</span>
              </Link>

              <Link
                href="/orders"
                className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 font-semibold px-3.5 py-1.5 rounded-xl text-xs transition"
              >
                <ShoppingBag size={14} />
                <span>Orders</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── 3 CLEAN KPI CARDS ─────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <IndianRupee size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              ₹{stats?.totalRevenue || 0}
            </p>
          </div>

          <div className="bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Orders</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShoppingBag size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {stats?.totalOrders || 0}
            </p>
          </div>

          <div className="bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Menu Dishes</span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <UtensilsCrossed size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {stats?.totalProducts || 0}
            </p>
          </div>
        </div>

        {/* ── RECENT ORDERS ────────────────────────────── */}
        <div className="bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Orders
              </h2>
            </div>

            <Link
              href="/orders"
              className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-orange-500">
              <RefreshCw className="animate-spin w-6 h-6" />
              <p className="text-xs text-slate-500">Loading orders...</p>
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <ShoppingBag className="w-8 h-8 mx-auto mb-1.5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No active orders</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Incoming customer orders will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentOrders.map((order) => (
                <div
                  key={order._id}
                  className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-orange-500/30 transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-orange-500">
                        #{order.orderId || order._id.slice(-6)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${statusStyles[order.status] || "bg-slate-200 text-slate-700"}`}>
                        {order.status}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {order.address?.fullName || "Customer"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {order.items?.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-white/5">
                    <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                      ₹{order.totalAmount}
                    </span>
                    <Link
                      href="/orders"
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 hover:bg-orange-500 hover:text-white transition text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
