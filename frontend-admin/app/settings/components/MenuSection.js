"use client";

import { UtensilsCrossed } from "lucide-react";

export default function MenuSection({ form, onChange, onSave, saving }) {
  const menuSettings = form.menuSettings || {
    productsVisible: true,
    showUnavailableProducts: true,
    showFeaturedProducts: true,
    showFeaturedCategories: true,
  };

  function updateMenu(field, val) {
    onChange("menuSettings", { ...menuSettings, [field]: val });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Menu</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Control what customers can see on your menu.
        </p>
      </div>

      {/* Main Options Card */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Menu Display Settings</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Choose what is visible on your restaurant storefront</p>
          </div>
        </div>

        <div className="space-y-3 divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {/* Show Out-of-Stock Items */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Show Out-of-Stock Items</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Display sold-out dishes with a "Sold Out" tag instead of hiding them</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={menuSettings.productsVisible ?? true}
                onChange={(e) => updateMenu("productsVisible", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Show Unavailable Products */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Show Unavailable Products</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Keep currently unavailable dishes visible in the catalog</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={menuSettings.showUnavailableProducts ?? true}
                onChange={(e) => updateMenu("showUnavailableProducts", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Show Featured Products */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Show Featured Products</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Highlight best-sellers and chef specials at the top of the menu</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={menuSettings.showFeaturedProducts ?? true}
                onChange={(e) => updateMenu("showFeaturedProducts", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* Show Featured Categories */}
          <div className="pt-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Show Featured Categories</div>
              <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Display top category shortcuts for faster customer browsing</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={menuSettings.showFeaturedCategories ?? true}
                onChange={(e) => updateMenu("showFeaturedCategories", e.target.checked)}
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
