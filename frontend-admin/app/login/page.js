"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  UtensilsCrossed,
  ChefHat,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

function LoginForm({ defaultRole = "admin" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const queryRole = searchParams.get("role") || searchParams.get("type");
  const initialIsStaff =
    queryRole === "staff" ? true : queryRole === "admin" ? false : defaultRole === "staff";

  const [isStaff, setIsStaff] = useState(initialIsStaff);

  // Form states for Admin
  const [adminData, setAdminData] = useState({ email: "", password: "" });
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  // Form states for Staff
  const [staffData, setStaffData] = useState({ email: "", password: "" });
  const [showStaffPass, setShowStaffPass] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");

  function handleFlipTo(targetStaff) {
    if (targetStaff === isStaff) return;
    setIsStaff(targetStaff);
    setAdminError("");
    setStaffError("");
    const targetUrl = targetStaff ? "/login?role=staff" : "/login";
    router.replace(targetUrl, { scroll: false });
  }

  async function handleAdminSubmit(e) {
    e.preventDefault();
    try {
      setAdminLoading(true);
      setAdminError("");

      const result = await signIn("credentials", {
        email: adminData.email,
        password: adminData.password,
        loginType: "admin",
        redirect: false,
      });

      if (result?.error) {
        setAdminError(result.error);
        return;
      }

      router.push(callbackUrl || "/dashboard");
    } catch (err) {
      console.error(err);
      const errorMsg =
        err?.message && !err.message.includes("is not valid JSON")
          ? err.message
          : "Invalid email or password, or temporary connection issue.";
      setAdminError(errorMsg);
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleStaffSubmit(e) {
    e.preventDefault();
    try {
      setStaffLoading(true);
      setStaffError("");

      const result = await signIn("credentials", {
        email: staffData.email,
        password: staffData.password,
        loginType: "staff",
        redirect: false,
      });

      if (result?.error) {
        setStaffError(result.error);
        return;
      }

      router.push(callbackUrl || "/");
    } catch (err) {
      console.error(err);
      const errorMsg =
        err?.message && !err.message.includes("is not valid JSON")
          ? err.message
          : "Invalid email or password, or temporary connection issue.";
      setStaffError(errorMsg);
    } finally {
      setStaffLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-8 px-4 sm:px-6 bg-transparent text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600 overflow-x-hidden">
      {/* Soft warm ambient background glow for light mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-gradient-to-b ${
            isStaff
              ? "from-emerald-100/70 via-teal-50/40 dark:from-emerald-500/5"
              : "from-orange-100/70 via-amber-50/40 dark:from-orange-500/5"
          } to-transparent dark:via-transparent dark:to-transparent rounded-full blur-3xl opacity-90 transition-colors duration-500`}
        />
      </div>

      {/* Top Header Row with Theme Toggle */}
      <header className="w-full max-w-[420px] flex items-center justify-end mb-2.5 z-20">
        <ThemeToggle />
      </header>

      {/* 3D Perspective Card Container */}
      <div className="w-full max-w-[420px] [perspective:1200px]">
        <motion.div
          animate={{ rotateY: isStaff ? 180 : 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="relative w-full [transform-style:preserve-3d]"
        >
          {/* ═════════════════════════════════════════════════════════ */}
          {/* FRONT FACE: ADMIN & MANAGER LOGIN                         */}
          {/* ═════════════════════════════════════════════════════════ */}
          <div
            className={`w-full bg-white/95 dark:bg-[#0d0f17]/95 backdrop-blur-xl border border-stone-200/90 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl shadow-stone-200/60 dark:shadow-none [backface-visibility:hidden] relative overflow-hidden ${
              isStaff ? "pointer-events-none select-none opacity-0" : "opacity-100"
            } transition-opacity duration-200`}
          >
            {/* Subtle orange accent glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Segmented Switcher Tab */}
            <div className="relative mb-5 p-1 bg-stone-100 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 rounded-2xl flex items-center shadow-xs">
              <div className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white dark:bg-[#1a1f2e] shadow-xs border border-stone-200/60 dark:border-white/10" />

              <button
                type="button"
                className="relative z-10 w-1/2 min-h-[44px] py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 text-stone-900 dark:text-white cursor-default"
              >
                <ShieldCheck size={16} className="text-orange-500 shrink-0" />
                <span>Admin Login</span>
              </button>

              <button
                type="button"
                onClick={() => handleFlipTo(true)}
                className="relative z-10 w-1/2 min-h-[44px] py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors cursor-pointer"
              >
                <ChefHat size={16} className="shrink-0" />
                <span>Staff Login</span>
              </button>
            </div>

            {/* Header */}
            <div className="text-center mb-5">
              <div className="w-13 h-13 mx-auto mb-2.5 rounded-2xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-500 shadow-xs">
                <UtensilsCrossed size={26} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] dark:bg-orange-500/10 text-[#C2410C] dark:text-orange-400 border border-orange-200/80 dark:border-orange-500/20 mb-1.5 shadow-xs">
                <span>पेट Protocols • Kitchen Management</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
                Restaurant <span className="text-orange-500">Dashboard</span>
              </h1>
              <p className="text-stone-600 dark:text-stone-400 text-xs mt-1">
                Manage your kitchen orders, menu items, and operating settings.
              </p>
            </div>

            {/* Admin Form */}
            <form onSubmit={handleAdminSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Manager Email Address
                </label>
                <div className="group flex items-center min-h-[46px] bg-stone-50/90 dark:bg-[#141622] border border-stone-300/80 dark:border-white/10 rounded-2xl px-3.5 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/25 transition shadow-xs">
                  <Mail className="text-stone-400 group-focus-within:text-orange-500 dark:text-stone-500 w-4 h-4 mr-2.5 shrink-0 transition-colors" />
                  <input
                    type="email"
                    placeholder="e.g. manager@yourkitchen.com"
                    value={adminData.email}
                    onChange={(e) => {
                      setAdminData({ ...adminData, email: e.target.value });
                      setAdminError("");
                    }}
                    required
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none focus:outline-none focus:ring-0 !outline-none border-0 py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="group flex items-center min-h-[46px] bg-stone-50/90 dark:bg-[#141622] border border-stone-300/80 dark:border-white/10 rounded-2xl px-3.5 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/25 transition shadow-xs">
                  <Lock className="text-stone-400 group-focus-within:text-orange-500 dark:text-stone-500 w-4 h-4 mr-2.5 shrink-0 transition-colors" />
                  <input
                    type={showAdminPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={adminData.password}
                    onChange={(e) => {
                      setAdminData({ ...adminData, password: e.target.value });
                      setAdminError("");
                    }}
                    required
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none focus:outline-none focus:ring-0 !outline-none border-0 py-2.5"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPass(!showAdminPass)}
                    aria-label={showAdminPass ? "Hide password" : "Show password"}
                    className="min-w-[40px] min-h-[40px] -mr-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white transition flex items-center justify-center cursor-pointer rounded-xl focus:outline-none"
                  >
                    {showAdminPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {adminError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-600 dark:text-red-400 text-xs text-center font-medium space-y-1">
                  <p>{adminError}</p>
                  {adminError.includes("Staff Login") && (
                    <button
                      type="button"
                      onClick={() => handleFlipTo(true)}
                      className="min-h-[44px] px-3 py-2 text-xs font-bold text-orange-600 dark:text-orange-400 underline hover:no-underline cursor-pointer inline-flex items-center justify-center mx-auto"
                    >
                      Click here to flip to Staff Login →
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full min-h-[48px] bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-orange-500/25 text-sm active:scale-95 cursor-pointer mt-1"
              >
                {adminLoading ? "Signing in..." : "Sign In to Kitchen"}
                {!adminLoading && <ArrowRight size={16} />}
              </button>
            </form>

            {/* Footer with clean Back link only */}
            <div className="mt-5 pt-4 border-t border-stone-200/80 dark:border-white/10 text-center">
              <Link
                href="/"
                className="min-h-[44px] px-3 py-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white inline-flex items-center justify-center gap-1.5 transition font-medium rounded-lg"
              >
                <ArrowLeft size={14} /> Back to पेट Protocols Partner Overview
              </Link>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════ */}
          {/* BACK FACE: KITCHEN STAFF STATION LOGIN                    */}
          {/* ═════════════════════════════════════════════════════════ */}
          <div
            className={`w-full bg-white/95 dark:bg-[#0d0f17]/95 backdrop-blur-xl border border-stone-200/90 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl shadow-stone-200/60 dark:shadow-none [backface-visibility:hidden] [transform:rotateY(180deg)] absolute inset-0 overflow-hidden ${
              !isStaff ? "pointer-events-none select-none opacity-0" : "opacity-100"
            } transition-opacity duration-200`}
          >
            {/* Subtle emerald accent glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Segmented Switcher Tab */}
            <div className="relative mb-5 p-1 bg-stone-100 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 rounded-2xl flex items-center shadow-xs">
              <div className="absolute top-1 bottom-1 right-1 w-[calc(50%-4px)] rounded-xl bg-white dark:bg-[#1a1f2e] shadow-xs border border-stone-200/60 dark:border-white/10" />

              <button
                type="button"
                onClick={() => handleFlipTo(false)}
                className="relative z-10 w-1/2 min-h-[44px] py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors cursor-pointer"
              >
                <ShieldCheck size={16} className="shrink-0" />
                <span>Admin Login</span>
              </button>

              <button
                type="button"
                className="relative z-10 w-1/2 min-h-[44px] py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 text-stone-900 dark:text-white cursor-default"
              >
                <ChefHat size={16} className="text-emerald-500 shrink-0" />
                <span>Staff Login</span>
              </button>
            </div>

            {/* Header */}
            <div className="text-center mb-5">
              <div className="w-13 h-13 mx-auto mb-2.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
                <ChefHat size={26} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-500/20 mb-1.5 shadow-xs">
                <span>पेट Protocols • Staff Station</span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
                Staff <span className="text-emerald-500">Portal</span>
              </h1>
              <p className="text-stone-600 dark:text-stone-400 text-xs mt-1">
                Access your assigned kitchen tickets, delivery queues, or cashier desk.
              </p>
            </div>

            {/* Staff Form */}
            <form onSubmit={handleStaffSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Staff Email Address
                </label>
                <div className="group flex items-center min-h-[46px] bg-stone-50/90 dark:bg-[#141622] border border-stone-300/80 dark:border-white/10 rounded-2xl px-3.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25 transition shadow-xs">
                  <Mail className="text-stone-400 group-focus-within:text-emerald-500 dark:text-stone-500 w-4 h-4 mr-2.5 shrink-0 transition-colors" />
                  <input
                    type="email"
                    placeholder="e.g. staff@yourkitchen.com"
                    value={staffData.email}
                    onChange={(e) => {
                      setStaffData({ ...staffData, email: e.target.value });
                      setStaffError("");
                    }}
                    required
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none focus:outline-none focus:ring-0 !outline-none border-0 py-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="group flex items-center min-h-[46px] bg-stone-50/90 dark:bg-[#141622] border border-stone-300/80 dark:border-white/10 rounded-2xl px-3.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25 transition shadow-xs">
                  <Lock className="text-stone-400 group-focus-within:text-emerald-500 dark:text-stone-500 w-4 h-4 mr-2.5 shrink-0 transition-colors" />
                  <input
                    type={showStaffPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={staffData.password}
                    onChange={(e) => {
                      setStaffData({ ...staffData, password: e.target.value });
                      setStaffError("");
                    }}
                    required
                    className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none focus:outline-none focus:ring-0 !outline-none border-0 py-2.5"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPass(!showStaffPass)}
                    aria-label={showStaffPass ? "Hide password" : "Show password"}
                    className="min-w-[40px] min-h-[40px] -mr-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white transition flex items-center justify-center cursor-pointer rounded-xl focus:outline-none"
                  >
                    {showStaffPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {staffError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-600 dark:text-red-400 text-xs text-center font-medium space-y-1">
                  <p>{staffError}</p>
                  {staffError.includes("Admin Login") && (
                    <button
                      type="button"
                      onClick={() => handleFlipTo(false)}
                      className="min-h-[44px] px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 underline hover:no-underline cursor-pointer inline-flex items-center justify-center mx-auto"
                    >
                      Click here to flip to Admin Login →
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={staffLoading}
                className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/25 text-sm active:scale-95 cursor-pointer mt-1"
              >
                {staffLoading ? "Signing in..." : "Sign In to Staff Station"}
                {!staffLoading && <ArrowRight size={16} />}
              </button>
            </form>

            {/* Footer with clean Back link only */}
            <div className="mt-5 pt-4 border-t border-stone-200/80 dark:border-white/10 text-center">
              <Link
                href="/"
                className="min-h-[44px] px-3 py-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white inline-flex items-center justify-center gap-1.5 transition font-medium rounded-lg"
              >
                <ArrowLeft size={14} /> Back to पेट Protocols Partner Overview
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

export default function RestaurantLoginPage({ initialRole = "admin" }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 dark:bg-[#07090e]" />}>
      <LoginForm defaultRole={initialRole} />
    </Suspense>
  );
}
