"use client";

import React from "react";
import { Zap, ChefHat, PackageCheck, Bike, AlertCircle, ArrowUpRight } from "lucide-react";

export default function OrderCommandMetrics({
  metrics = {
    actionNeeded: 0,
    preparing: 0,
    ready: 0,
    outForDelivery: 0,
    deliveredToday: 0,
  },
  activeFilter = "all",
  onSelectFilter,
}) {
  const cards = [
    {
      id: "action_needed",
      label: "Action Needed",
      sublabel: "Pending & unassigned ready",
      count: metrics.actionNeeded,
      icon: Zap,
      accent: "from-amber-500/20 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      activeBorder: "border-amber-500 ring-2 ring-amber-500/20",
      badgeColor: "bg-amber-500 text-white",
      urgent: metrics.actionNeeded > 0,
    },
    {
      id: "preparing",
      label: "In Kitchen",
      sublabel: "Currently cooking",
      count: metrics.preparing,
      icon: ChefHat,
      accent: "from-blue-500/20 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
      activeBorder: "border-blue-500 ring-2 ring-blue-500/20",
      badgeColor: "bg-blue-600 text-white",
      urgent: false,
    },
    {
      id: "ready",
      label: "Ready for Handoff",
      sublabel: "Packaged & waiting",
      count: metrics.ready,
      icon: PackageCheck,
      accent: "from-indigo-500/20 to-violet-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
      activeBorder: "border-indigo-500 ring-2 ring-indigo-500/20",
      badgeColor: "bg-indigo-600 text-white",
      urgent: false,
    },
    {
      id: "out_for_delivery",
      label: "Out for Delivery",
      sublabel: "Active courier transit",
      count: metrics.outForDelivery,
      icon: Bike,
      accent: "from-sky-500/20 to-teal-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
      activeBorder: "border-sky-500 ring-2 ring-sky-500/20",
      badgeColor: "bg-sky-600 text-white",
      urgent: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = activeFilter === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter(isSelected ? "all" : card.id)}
            className={`group text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden bg-white dark:bg-stone-900/90 shadow-xs hover:shadow-md cursor-pointer ${
              isSelected
                ? `${card.activeBorder} shadow-md`
                : "border-stone-200/80 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20"
            }`}
          >
            {/* Background subtle gradient */}
            <div
              className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-br ${card.accent} opacity-30 blur-xl pointer-events-none transition group-hover:scale-125`}
            />

            <div className="flex items-center justify-between mb-2">
              <span
                className={`p-2 rounded-xl border flex items-center justify-center ${card.accent}`}
              >
                <Icon size={18} />
              </span>
              <span
                className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                  card.urgent ? "text-amber-600 dark:text-amber-400" : "text-stone-900 dark:text-white"
                }`}
              >
                {card.count}
              </span>
            </div>

            <div>
              <div className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1">
                <span>{card.label}</span>
                {isSelected && <ArrowUpRight size={13} className="text-orange-500" />}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium truncate mt-0.5">
                {card.sublabel}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

