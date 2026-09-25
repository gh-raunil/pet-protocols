"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { UtensilsCrossed, Lock, Mail, ArrowRight, Eye, EyeOff, ArrowLeft } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid restaurant manager credentials or account suspended.");
        return;
      }

      router.push(callbackUrl);
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-12 bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      {/* Soft warm ambient background glow for light mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-orange-100/70 via-amber-50/40 to-transparent dark:from-orange-500/5 dark:via-transparent dark:to-transparent rounded-full blur-3xl opacity-90" />
      </div>

      {/* Theme toggle corner button */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-white/95 dark:bg-[#0d0f17]/95 backdrop-blur-xl border border-stone-200/90 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 dark:shadow-none relative overflow-hidden">
        {/* Subtle orange accent glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-500 shadow-sm shadow-orange-500/10">
            <UtensilsCrossed size={32} />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#FFF7ED] dark:bg-orange-500/10 text-[#C2410C] dark:text-orange-400 border border-orange-200/80 dark:border-orange-500/20 mb-3 shadow-xs">
            <span>पेट Protocols • Kitchen Management</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black mt-1 text-stone-900 dark:text-white">
            Restaurant <span className="text-orange-500">Dashboard</span>
          </h1>
          <p className="text-stone-600 dark:text-stone-400 text-xs sm:text-sm mt-1.5">
            Manage your kitchen orders, menu items, and operating settings in real time.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-2">
              Manager Email Address
            </label>
            <div className="flex items-center bg-stone-50/80 dark:bg-[#141622] border border-stone-300/80 dark:border-white/10 rounded-xl px-4 py-3 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition">
              <Mail className="text-stone-400 dark:text-stone-500 w-5 h-5 mr-3 shrink-0" />
              <input
                type="email"
                name="email"
                placeholder="e.g. manager@yourkitchen.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="flex items-center bg-stone-50/80 dark:bg-[#141622] border border-stone-300/80 dark:border-white/10 rounded-xl px-4 py-3 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition">
              <Lock className="text-stone-400 dark:text-stone-500 w-5 h-5 mr-3 shrink-0" />
              <input
                type={showPass ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 text-sm outline-none focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-white transition ml-2"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-600 dark:text-red-400 text-xs sm:text-sm text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-orange-500/25 text-sm active:scale-95"
          >
            {loading ? "Signing in..." : "Sign In to Kitchen"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stone-200/80 dark:border-white/10 text-center">
          <Link
            href="/"
            className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white inline-flex items-center gap-1.5 transition font-medium"
          >
            <ArrowLeft size={14} /> Back to पेट Protocols Partner Overview
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function RestaurantLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 dark:bg-[#07090e]" />}>
      <LoginForm />
    </Suspense>
  );
}
