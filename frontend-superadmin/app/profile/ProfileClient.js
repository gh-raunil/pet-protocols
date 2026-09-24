"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Building2,
  Users,
  ShoppingBag,
  LogOut,
  RefreshCw,
  Mail,
  User,
  Shield,
  Activity,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function SuperadminProfileClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    async function fetchStats() {
      try {
        const res = await fetch("/api/superadmin/stats");
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to load platform stats", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [session]);

  function getInitials(name) {
    if (!name) return "SA";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-[#070a10]">
        <div className="flex flex-col items-center gap-3 text-indigo-600 dark:text-indigo-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading Profile...</p>
        </div>
      </main>
    );
  }

  const superName = session?.user?.name || "Super Admin";
  const superEmail = session?.user?.email || "Configured Account";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070a10] text-slate-800 dark:text-slate-200 transition-colors">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        {/* ── TOP ACTION BAR ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800/80">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Platform Overview</span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-500/20 transition"
              type="button"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>

        {/* ── PROFILE HEADER CARD ─────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-md shadow-indigo-200 dark:shadow-indigo-950 shrink-0">
                {getInitials(superName)}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Super Admin
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                    Active
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {superName}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {superEmail}
                </p>
              </div>
            </div>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
            >
              <span>Manage Restaurants</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* ── PLATFORM METRICS SUMMARY ─────────────────────────────── */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Platform Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Restaurants */}
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Restaurants
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.totalRestaurants ?? 0}
                </span>
              </div>
            </div>

            {/* Total Admins */}
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Admins
                </span>
                <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.totalAdmins ?? 0}
                </span>
              </div>
            </div>

            {/* Orders */}
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Orders
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {stats?.totalOrders ?? 0}
                </span>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Revenue
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                  ₹
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900 dark:text-emerald-400">
                  ₹{(stats?.totalRevenue ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── ACCOUNT DETAILS ─────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-6 sm:p-7 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Account Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <User className="w-3.5 h-3.5" />
                <span>Full Name</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {superName}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <Mail className="w-3.5 h-3.5" />
                <span>Email Address</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
                {superEmail}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <Shield className="w-3.5 h-3.5" />
                <span>Role</span>
              </div>
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                Super Admin
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Status</span>
              </div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Active & Verified
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
