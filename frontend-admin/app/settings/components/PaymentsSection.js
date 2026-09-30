"use client";

import { CreditCard, Banknote, Receipt, AlertTriangle } from "lucide-react";

export default function PaymentsSection({ form, onChange, onSave, saving }) {
  const paymentSettings = form.paymentSettings || {
    onlinePaymentEnabled: true,
    codEnabled: true,
    copEnabled: true,
    testPaymentMode: true,
  };

  function updatePayment(field, val) {
    onChange("paymentSettings", { ...paymentSettings, [field]: val });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Payments</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Choose how customers pay.
        </p>
      </div>

      {/* Main Options Card */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Payment Methods</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Turn on or off the ways customers can pay you</p>
          </div>
        </div>

        <div className="space-y-3 divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {/* Online Payment */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Online Payment</div>
                <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Accept UPI (Google Pay, PhonePe, Paytm), Cards & NetBanking</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={paymentSettings.onlinePaymentEnabled ?? true}
                onChange={(e) => updatePayment("onlinePaymentEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Cash on Delivery */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Cash on Delivery (COD)</div>
                <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Customer pays cash in hand when food arrives</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={paymentSettings.codEnabled ?? true}
                onChange={(e) => updatePayment("codEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Cash on Pickup */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Cash on Pickup</div>
                <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Customer pays at your restaurant counter during pickup</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={paymentSettings.copEnabled ?? true}
                onChange={(e) => updatePayment("copEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Test Payments Mode */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Test Payments</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    For testing only
                  </span>
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Simulate order payments without real bank charges</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={paymentSettings.testPaymentMode ?? true}
                onChange={(e) => updatePayment("testPaymentMode", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
