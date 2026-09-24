"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function SuperadminLoginPage() {
  const router = useRouter();
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
        setError("Invalid superadmin credentials or account suspended.");
        return;
      }

      router.push("/");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-[#080c14] text-slate-200">
      <div className="w-full max-w-md bg-[#0b0f17] border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <span className="text-[11px] uppercase tracking-widest text-indigo-400 font-semibold px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 inline-block">
            Platform Governance
          </span>
          <h1 className="text-2xl font-bold mt-3 text-white">
            Super Admin <span className="text-indigo-400">Portal</span>
          </h1>
          <p className="text-slate-400 text-xs mt-2">
            Sign in to manage restaurants, multi-admins, and platform operations.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
              Superadmin Email
            </label>
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg px-3.5 py-2.5 focus-within:border-indigo-500 transition">
              <Mail className="text-slate-400 w-4 h-4 mr-2.5 shrink-0" />
              <input
                type="email"
                name="email"
                placeholder="superadmin@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full bg-transparent text-slate-100 placeholder-slate-600 text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
              Security Password
            </label>
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg px-3.5 py-2.5 focus-within:border-indigo-500 transition">
              <Lock className="text-slate-400 w-4 h-4 mr-2.5 shrink-0" />
              <input
                type={showPass ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full bg-transparent text-slate-100 placeholder-slate-600 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="text-slate-400 hover:text-white transition ml-2"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-3 text-rose-300 text-xs text-center">
              {error}
            </div>
          )}

          {/* Quick Fill Demo Credentials (development only - never exposed in production) */}
          {process.env.NODE_ENV !== "production" && (
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-3 flex items-center justify-between text-xs">
              <div>
                <span className="text-indigo-300 font-semibold block text-xs">Demo Credentials:</span>
                <span className="text-slate-400 font-mono text-[11px]">superadmin@petprotocols.com / rounak</span>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ email: "superadmin@petprotocols.com", password: "rounak" })}
                className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded text-xs font-medium transition shrink-0 ml-2 cursor-pointer"
              >
                Fill Demo Credentials
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition shadow-md shadow-indigo-600/20 text-sm"
          >
            {loading ? "Authenticating..." : "Access Control Panel"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Pet Protocols Platform Management
          </p>
        </div>
      </div>
    </main>
  );
}
