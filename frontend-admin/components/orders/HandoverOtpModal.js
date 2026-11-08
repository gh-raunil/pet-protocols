"use client";

import React, { useState } from "react";
import { CheckCircle2, X, RefreshCw, KeyRound, AlertTriangle } from "lucide-react";
import { formatOrderId } from "@/app/dashboard/DashboardClient";

export default function HandoverOtpModal({
  isOpen,
  order,
  onVerify,
  onClose,
  submitting = false,
  error = "",
  remainingAttempts = null,
}) {
  const [otpCode, setOtpCode] = useState("");

  if (!isOpen || !order) return null;

  const displayId = formatOrderId(order);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = otpCode.trim();
    if (clean.length !== 4 || !/^\d{4}$/.test(clean)) {
      return;
    }
    onVerify(order._id, clean);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl border border-stone-200 dark:border-white/10 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="handover-otp-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/5">
          <h3 id="handover-otp-title" className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span>Verify Handover OTP</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-stone-600 dark:text-stone-300">
          Enter the 4-digit handover OTP code provided by the customer for order{" "}
          <strong className="text-stone-900 dark:text-white font-mono">{displayId}</strong> to verify doorstep handover and complete delivery.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {remainingAttempts !== null && remainingAttempts < 5 && (
          <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
            ⚠️ {remainingAttempts} verification attempt{remainingAttempts === 1 ? "" : "s"} remaining before lockout.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1.5">
              4-Digit Customer Code
            </label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                maxLength={4}
                autoFocus
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="w-full pl-10 pr-4 py-3 text-center tracking-[0.5em] text-xl font-mono font-black rounded-2xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 focus:border-emerald-500 focus:bg-white dark:focus:bg-stone-800 text-stone-900 dark:text-white outline-hidden transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 dark:border-white/10 text-stone-700 dark:text-stone-300 rounded-xl font-bold text-xs hover:bg-stone-100 dark:hover:bg-white/5 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={otpCode.length !== 4 || submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  <span>Verify &amp; Deliver</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

