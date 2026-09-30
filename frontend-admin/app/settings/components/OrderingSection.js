"use client";

import { ShoppingBag, CheckCircle, XCircle } from "lucide-react";

export default function OrderingSection({ form, onChange, onSave, saving }) {
  const orderTypes = form.orderTypes || { delivery: true, pickup: true };
  const orderingSettings = form.orderingSettings || {
    autoAcceptOrders: false,
    requireOrderConfirmation: true,
  };
  const orderLimits = form.orderLimits || { minOrderAmount: 0 };
  const cancellationSettings = form.cancellationSettings || { allowCustomerCancel: true };

  function updateOrderType(type, val) {
    onChange("orderTypes", { ...orderTypes, [type]: val });
  }

  function updateOrdering(field, val) {
    onChange("orderingSettings", { ...orderingSettings, [field]: val });
  }

  function updateLimits(field, val) {
    onChange("orderLimits", { ...orderLimits, [field]: val });
  }

  function updateCancellation(field, val) {
    onChange("cancellationSettings", { ...cancellationSettings, [field]: val });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Orders</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Choose how you want to receive and manage orders.
        </p>
      </div>

      {/* Main Options Card */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Order Receiving Options</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Simple switches for your daily operations</p>
          </div>
        </div>

        <div className="space-y-3 divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {/* Accept Online Orders */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Accept Online Orders</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Allow customers to submit orders right now</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={form.acceptingOrders ?? true}
                onChange={(e) => onChange("acceptingOrders", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Delivery */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Delivery</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Allow customers to request home delivery</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={orderTypes.delivery ?? true}
                onChange={(e) => updateOrderType("delivery", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Pickup */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Pickup</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Allow customers to collect food in person</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={orderTypes.pickup ?? true}
                onChange={(e) => updateOrderType("pickup", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Automatically Accept Orders */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Automatically Accept Orders</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Orders skip manual confirmation and go straight to kitchen</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={orderingSettings.autoAcceptOrders ?? false}
                onChange={(e) => updateOrdering("autoAcceptOrders", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Minimum Order Amount */}
          <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Minimum Order Amount</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Smallest order total allowed for checkout</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">₹</span>
              <input
                type="number"
                min="0"
                value={orderLimits.minOrderAmount ?? 0}
                onChange={(e) => updateLimits("minOrderAmount", parseFloat(e.target.value) || 0)}
                className="w-28 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm font-semibold outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Customer Cancellation */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Customer Cancellation</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Allow customers to cancel an order within a few minutes if they change their mind</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={cancellationSettings.allowCustomerCancel ?? true}
                onChange={(e) => updateCancellation("allowCustomerCancel", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
