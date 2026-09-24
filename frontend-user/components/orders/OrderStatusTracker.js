"use client";

import React from "react";
import {
  PackageCheck,
  ChefHat,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
} from "lucide-react";

export const ORDER_STEPS = [
  {
    id: "pending",
    label: "Order Placed",
    shortLabel: "Placed",
    description: "Kitchen confirmed receipt",
    icon: PackageCheck,
  },
  {
    id: "preparing",
    label: "Preparing",
    shortLabel: "Cooking",
    description: "Chef is crafting your feast",
    icon: ChefHat,
  },
  {
    id: "out_for_delivery",
    label: "Out for Delivery",
    shortLabel: "On the way",
    description: "Rider dispatched to your address",
    icon: Truck,
  },
  {
    id: "delivered",
    label: "Delivered",
    shortLabel: "Delivered",
    description: "Feast arrived at your doorstep",
    icon: CheckCircle2,
  },
];

export function getActiveStepIndex(status) {
  switch (status?.toLowerCase()) {
    case "pending":
      return 0;
    case "preparing":
      return 1;
    case "out_for_delivery":
      return 2;
    case "delivered":
      return 3;
    default:
      return 0;
  }
}

export default function OrderStatusTracker({ status = "pending", paymentStatus = "paid" }) {
  const isCancelled = status?.toLowerCase() === "cancelled";
  const isFailed = paymentStatus?.toLowerCase() === "failed";
  const activeIndex = getActiveStepIndex(status);

  // 1. Cancelled or Failed Order State
  if (isCancelled || isFailed) {
    return (
      <div className="w-full bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 text-rose-300">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
            {isCancelled ? <XCircle size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                {isCancelled ? "Order Cancelled" : "Payment Failed"}
              </span>
            </div>
            <p className="text-xs text-rose-200/80 mt-1.5 leading-relaxed">
              {isCancelled
                ? "This order was cancelled by the kitchen or user. Any captured payments are automatically refunded within 3–5 business days."
                : "The transaction was declined by the bank or payment gateway. Please verify your payment details and place a new order."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Normal Active Order Progress Tracker
  return (
    <div className="w-full bg-[#111114] border border-white/10 rounded-3xl p-5 sm:p-7 shadow-xl">
      {/* Tracker Header */}
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-xs font-bold text-white/70 uppercase tracking-widest">
            Live Order Status
          </span>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
          {ORDER_STEPS[activeIndex]?.label || "Order Placed"}
        </span>
      </div>

      {/* Desktop / Tablet Stepper (sm and above) */}
      <div className="hidden sm:block">
        <div className="relative flex items-center justify-between">
          {/* Connecting Line Background */}
          <div className="absolute top-5 left-8 right-8 h-1 bg-white/10 -z-0 rounded-full" />

          {/* Active Connector Progress Line */}
          <div
            className="absolute top-5 left-8 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 -z-0 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${(activeIndex / (ORDER_STEPS.length - 1)) * 100}%`,
              maxWidth: "calc(100% - 4rem)",
            }}
          />

          {/* Stepper Nodes */}
          {ORDER_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isPending = idx > activeIndex;

            return (
              <div key={step.id} className="flex flex-col items-center text-center z-10 w-28">
                {/* Node Circle */}
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                    isCurrent
                      ? "bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.6)] ring-4 ring-orange-500/20 scale-110"
                      : isCompleted
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                      : "bg-[#18181b] text-white/30 border border-white/10"
                  }`}
                >
                  <Icon size={18} strokeWidth={isCurrent ? 2.5 : 2} />
                </div>

                {/* Step Labels */}
                <div className="mt-3">
                  <p
                    className={`text-xs font-bold leading-tight ${
                      isCurrent
                        ? "text-orange-400 font-extrabold"
                        : isCompleted
                        ? "text-white"
                        : "text-white/40"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5 leading-tight">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Stepper (< sm) */}
      <div className="sm:hidden space-y-4">
        {ORDER_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isCompleted = idx < activeIndex;
          const isCurrent = idx === activeIndex;
          const isPending = idx > activeIndex;

          return (
            <div key={step.id} className="relative flex items-start gap-3.5">
              {/* Vertical connector line between mobile steps */}
              {idx < ORDER_STEPS.length - 1 && (
                <div
                  className={`absolute top-9 left-4 -ml-0.5 w-0.5 h-8 transition-colors ${
                    isCompleted ? "bg-orange-500" : "bg-white/10"
                  }`}
                />
              )}

              {/* Step Circle */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  isCurrent
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-2 ring-orange-500/30"
                    : isCompleted
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                    : "bg-[#18181b] text-white/30 border border-white/10"
                }`}
              >
                <Icon size={14} strokeWidth={isCurrent ? 2.5 : 2} />
              </div>

              {/* Step Info */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-xs font-bold ${
                      isCurrent
                        ? "text-orange-400 font-black"
                        : isCompleted
                        ? "text-white"
                        : "text-white/40"
                    }`}
                  >
                    {step.label}
                  </p>
                  {isCurrent && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                      In Progress
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-bold text-emerald-400">
                      Completed ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/40 mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
