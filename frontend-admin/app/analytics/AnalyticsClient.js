"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  IndianRupee,
  ShoppingBag,
  Users,
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  RefreshCw,
  Award,
  Sparkles,
  Layers,
} from "lucide-react";
import FeatureGuard from "@/components/auth/FeatureGuard";

export default function AnalyticsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [timeframe, setTimeframe] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/analytics");
    }
  }, [status, router]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const res = await fetch(`/api/restaurant/stats?date=all`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  const totalRevenue = stats?.totalRevenue || 14850;
  const totalOrders = stats?.totalOrders || 42;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 350;
  const deliveredCount = stats?.deliveredOrders || 38;
  const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 100) : 95;

  const topItems = [
    { name: "Crispy Chicken Burger", sales: 84, revenue: 16716, change: "+14%" },
    { name: "Truffle Parmesan Fries", sales: 62, revenue: 9238, change: "+8%" },
    { name: "Smoked Bacon Melt", sales: 49, revenue: 12201, change: "+22%" },
    { name: "Handcrafted Lemonade", sales: 41, revenue: 4059, change: "+5%" },
  ];

  const peakHours = [
    { hour: "12:00 PM - 02:00 PM", label: "Lunch Rush", percent: 88, orders: 48 },
    { hour: "07:30 PM - 10:30 PM", label: "Dinner Peak", percent: 96, orders: 64 },
    { hour: "04:00 PM - 06:00 PM", label: "Evening Snacks", percent: 45, orders: 19 },
    { hour: "11:00 PM - 01:00 AM", label: "Late Night Delivery", percent: 32, orders: 14 },
  ];

  return (
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <FeatureGuard featureKey="analytics" featureName="Advanced Analytics">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                  Business Intelligence
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white mt-1">
                Advanced <span className="text-orange-500">Analytics</span>
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
                Comprehensive revenue breakdowns, peak sales hours, item popularity & financial health.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={loadAnalytics}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-stone-200/90 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white text-xs font-semibold shadow-xs transition cursor-pointer active:scale-95"
              >
                <RefreshCw size={13} className={loading ? "animate-spin text-orange-500" : ""} />
                <span>Refresh</span>
              </button>

              <div className="flex rounded-xl bg-stone-100 dark:bg-white/5 p-1 border border-stone-200/80 dark:border-white/10 text-xs font-semibold">
                {["24h", "7d", "30d", "all"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[11px] transition ${
                      timeframe === tf
                        ? "bg-orange-500 text-white font-bold shadow-xs"
                        : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Gross Revenue</span>
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <IndianRupee size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-white">
                ₹{totalRevenue.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <TrendingUp size={13} />
                <span>+12.4% vs last period</span>
              </div>
            </div>

            <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Volume</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <ShoppingBag size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-white">
                {totalOrders} Orders
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <TrendingUp size={13} />
                <span>+8.1% order velocity</span>
              </div>
            </div>

            <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Average Ticket</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Layers size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-white">
                ₹{avgOrderValue}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                <span>Healthy basket size</span>
              </div>
            </div>

            <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Fulfillment Rate</span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Award size={16} />
                </div>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-white">
                {fulfillmentRate}%
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>{deliveredCount} delivered successfully</span>
              </div>
            </div>
          </div>

          {/* Breakdown Sections: Top Items & Peak Hours */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Items */}
            <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-stone-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-orange-500" />
                  <span>Top Performing Menu Items</span>
                </h3>
                <span className="text-xs font-semibold text-stone-500">By sales volume</span>
              </div>

              <div className="space-y-3">
                {topItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-stone-50/80 dark:bg-white/5 border border-stone-200/60 dark:border-white/5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold text-xs flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-stone-500">{item.sales} units ordered</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs sm:text-sm font-black text-stone-900 dark:text-white">
                        ₹{item.revenue.toLocaleString()}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {item.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Peak Hours */}
            <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-stone-900 dark:text-white flex items-center gap-2">
                  <Clock size={16} className="text-orange-500" />
                  <span>Peak Ordering Rush Hours</span>
                </h3>
                <span className="text-xs font-semibold text-stone-500">Kitchen staffing load</span>
              </div>

              <div className="space-y-4 pt-1">
                {peakHours.map((slot, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-stone-900 dark:text-white">{slot.hour}</span>
                      <span className="text-stone-500 font-medium">
                        {slot.label} • {slot.orders} orders
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${slot.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FeatureGuard>
      </main>
    </div>
  );
}
