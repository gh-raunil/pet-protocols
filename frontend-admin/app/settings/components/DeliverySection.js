"use client";

import { Truck, MapPin } from "lucide-react";

export default function DeliverySection({ form, onChange, onSave, saving }) {
  const delivery = form.deliverySettings || {
    deliveryEnabled: true,
    pickupEnabled: true,
    deliveryRadiusKm: 5,
  };

  const chargeSettings = form.chargeSettings || {
    flatDeliveryFee: 40,
    freeDeliveryThreshold: 500,
  };

  function updateDelivery(field, val) {
    onChange("deliverySettings", { ...delivery, [field]: val });
  }

  function updateCharge(field, val) {
    onChange("chargeSettings", { ...chargeSettings, [field]: val });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Delivery</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Tell us where you deliver.
        </p>
      </div>

      {/* Main Options Card */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Delivery Options</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Control delivery availability, radius, and charges</p>
          </div>
        </div>

        <div className="space-y-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {/* Delivery On/Off */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Delivery</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Offer doorstep food delivery to customers</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={delivery.deliveryEnabled ?? true}
                onChange={(e) => updateDelivery("deliveryEnabled", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Delivery Charge */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Delivery Charge</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Standard fee added to delivery orders</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">₹</span>
              <input
                type="number"
                min="0"
                value={chargeSettings.flatDeliveryFee ?? 40}
                onChange={(e) => updateCharge("flatDeliveryFee", parseFloat(e.target.value) || 0)}
                className="w-28 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm font-semibold outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Free Delivery Above */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Free Delivery Above</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Orders above this amount get free delivery</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">₹</span>
              <input
                type="number"
                min="0"
                value={chargeSettings.freeDeliveryThreshold ?? 500}
                onChange={(e) => updateCharge("freeDeliveryThreshold", parseFloat(e.target.value) || 0)}
                className="w-28 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm font-semibold outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Delivery Area / Distance */}
          <div className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">How far do you deliver?</div>
                <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Maximum distance from your restaurant</div>
              </div>
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                {delivery.deliveryRadiusKm ?? 5} km
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={delivery.deliveryRadiusKm ?? 5}
              onChange={(e) => updateDelivery("deliveryRadiusKm", parseInt(e.target.value) || 5)}
              className="w-full accent-orange-500 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>1 km (neighborhood)</span>
              <span>15 km</span>
              <span>30 km (wide city)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
