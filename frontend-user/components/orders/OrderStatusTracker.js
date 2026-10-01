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
    description: "Kitchen accepted order",
    statusMessage: "Your order is confirmed and waiting in the kitchen queue.",
    icon: PackageCheck,
  },
  {
    id: "preparing",
    label: "Preparing",
    shortLabel: "Cooking",
    description: "Chef is crafting your meal",
    statusMessage: "The culinary team is preparing your fresh dishes right now.",
    icon: ChefHat,
  },
  {
    id: "out_for_delivery",
    label: "Out for Delivery",
    shortLabel: "On the way",
    description: "Dispatched to your address",
    statusMessage: "Your meal is packaged and on its way to your doorstep.",
    icon: Truck,
  },
  {
    id: "delivered",
    label: "Delivered",
    shortLabel: "Delivered",
    description: "Order reached your location",
    statusMessage: "Enjoy your fresh meal! Rate your experience anytime.",
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
    case "ready":
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
  const currentStep = ORDER_STEPS[activeIndex] || ORDER_STEPS[0];

  // 1. Cancelled or Failed Order State
  if (isCancelled || isFailed) {
    return (
      <div className="w-full bg-red-500/10 border border-red-500/25 rounded-3xl p-6 text-red-500 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            {isCancelled ? <XCircle size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div>
            <span className="inline-block text-xs font-black uppercase tracking-wider bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 mb-2">
              {isCancelled ? "Order Cancelled" : "Payment Declined"}
            </span>
            <h4 className="text-base font-bold text-[var(--text-main)]">
              {isCancelled ? "This order will not be fulfilled" : "Payment could not be processed"}
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              {isCancelled
                ? "This order was cancelled by the kitchen or user. If any payment was captured, the full refund is initiated to the source payment method."
                : "The payment transaction failed. Please retry your order using Cash on Delivery or another digital payment method."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate percentage for progress line
  const progressPercent = (activeIndex / (ORDER_STEPS.length - 1)) * 100;

  // 2. Normal Active Order Progress Tracker
  return (
    <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden transition-all">
      {/* Tracker Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-accent)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--brand-accent)]" />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-[var(--brand-accent)]">
              Kitchen Live Tracker
            </span>
          </div>
          <p className="text-sm sm:text-base font-bold text-[var(--text-main)] mt-1">
            {currentStep.statusMessage}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[var(--brand-accent)] text-white shadow-md shadow-[var(--brand-accent)]/25">
            <Sparkles size={12} />
            {currentStep.label}
          </span>
        </div>
      </div>

      {/* Desktop & Tablet Stepper */}
      <div className="hidden sm:block pt-8 pb-2">
        <div className="relative flex items-center justify-between">
          {/* Background Connecting Track */}
          <div className="absolute top-6 left-10 right-10 h-1.5 bg-[var(--bg-sub)] rounded-full z-0" />

          {/* Active Filled Progress Bar */}
          <div
            className="absolute top-6 left-10 h-1.5 bg-gradient-to-r from-emerald-500 via-[var(--brand-accent)] to-[var(--brand-accent)] rounded-full z-0 transition-all duration-700 ease-out"
            style={{
              width: `calc(${progressPercent}% * (100% - 5rem) / 100)`,
            }}
          />

          {/* Stepper Nodes */}
          {ORDER_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;

            return (
              <div
                key={step.id}
                className="flex flex-col items-center text-center z-10 w-32 relative"
              >
                {/* Node Pill / Circle */}
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isCurrent
                      ? "bg-[var(--brand-accent)] text-white shadow-xl shadow-[var(--brand-accent)]/40 ring-4 ring-[var(--brand-accent)]/20 scale-110"
                      : isCompleted
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                      : "bg-[var(--bg-card)] text-[var(--text-muted)] border-2 border-[var(--border-color)]"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={20} strokeWidth={2.5} />
                  ) : (
                    <Icon size={20} strokeWidth={isCurrent ? 2.5 : 2} />
                  )}
                </div>

                {/* Step Labels */}
                <div className="mt-3.5 space-y-0.5">
                  <p
                    className={`text-xs font-bold leading-tight ${
                      isCurrent
                        ? "text-[var(--brand-accent)] font-extrabold"
                        : isCompleted
                        ? "text-[var(--text-main)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Stepper View */}
      <div className="sm:hidden pt-6 space-y-4">
        {ORDER_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isCompleted = idx < activeIndex;
          const isCurrent = idx === activeIndex;

          return (
            <div key={step.id} className="relative flex items-start gap-3.5">
              {idx < ORDER_STEPS.length - 1 && (
                <div
                  className={`absolute top-9 left-4 -ml-0.5 w-1 h-9 rounded-full transition-colors ${
                    isCompleted ? "bg-emerald-500" : "bg-[var(--border-color)]"
                  }`}
                />
              )}

              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 z-10 transition-all ${
                  isCurrent
                    ? "bg-[var(--brand-accent)] text-white shadow-lg shadow-[var(--brand-accent)]/30 ring-3 ring-[var(--brand-accent)]/25"
                    : isCompleted
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-[var(--bg-card)] text-[var(--text-muted)] border-2 border-[var(--border-color)]"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                ) : (
                  <Icon size={16} strokeWidth={isCurrent ? 2.5 : 2} />
                )}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-xs font-bold ${
                      isCurrent
                        ? "text-[var(--brand-accent)]"
                        : isCompleted
                        ? "text-[var(--text-main)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {step.label}
                  </p>
                  {isCurrent && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-[var(--brand-accent)] bg-[var(--brand-accent)]/15 px-2 py-0.5 rounded-full border border-[var(--brand-accent)]/30">
                      In Progress
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-bold text-emerald-500">
                      Completed ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
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
