"use client";

import React from "react";
import {
  PackageCheck,
  ChefHat,
  Truck,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import Tooltip, { HelpTooltip } from "@/components/ui/Tooltip";

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

export function getOrderSteps(isPickup = false) {
  if (isPickup) {
    return [
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
        id: "ready",
        label: "Ready for Pickup",
        shortLabel: "Ready",
        description: "Waiting at kitchen counter",
        statusMessage: "Your order is freshly prepared and ready for pickup at the kitchen counter.",
        icon: ShoppingBag,
      },
      {
        id: "delivered",
        label: "Picked Up",
        shortLabel: "Collected",
        description: "Order collected from kitchen",
        statusMessage: "Order collected! Enjoy your delicious meal.",
        icon: CheckCircle2,
      },
    ];
  }
  return ORDER_STEPS;
}

export function getActiveStepIndex(status) {
  switch (status?.toLowerCase()) {
    case "pending":
    case "confirmed":
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

function formatStepTime(dateVal) {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function formatFullDateTime(dateVal) {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getStepHistoryEntry(stepId, history = [], createdAt = null) {
  if (!Array.isArray(history) || history.length === 0) {
    if (stepId === "pending" && createdAt) {
      return { status: "pending", changedAt: createdAt };
    }
    return null;
  }

  if (stepId === "pending") {
    const found = history.find((h) => h.status === "pending" || h.status === "confirmed");
    return found || (createdAt ? { status: "pending", changedAt: createdAt } : null);
  }
  if (stepId === "preparing") {
    return history.find((h) => h.status === "preparing") || null;
  }
  if (stepId === "ready") {
    return history.find((h) => h.status === "ready") || null;
  }
  if (stepId === "out_for_delivery") {
    return history.find((h) => h.status === "out_for_delivery") || null;
  }
  if (stepId === "delivered") {
    return history.find((h) => h.status === "delivered") || null;
  }
  return null;
}

export default function OrderStatusTracker({
  orderId = null,
  status = "pending",
  paymentStatus = "paid",
  isPickup = false,
  cancellationReason = "",
  statusHistory = [],
  notes = "",
  createdAt = null,
  assignedDeliveryStaff = null,
}) {
  const isCancelled = status?.toLowerCase() === "cancelled";
  const isFailed = paymentStatus?.toLowerCase() === "failed";
  const activeIndex = getActiveStepIndex(status);
  const steps = getOrderSteps(isPickup);
  const currentStep = steps[activeIndex] || steps[0];

  // Secure Handover OTP State
  const [otpData, setOtpData] = React.useState(null);
  const [otpLoading, setOtpLoading] = React.useState(false);
  const [otpError, setOtpError] = React.useState("");
  const [reissueCooldown, setReissueCooldown] = React.useState(0);
  const [reissuing, setReissuing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const fetchHandoverOtp = React.useCallback(async () => {
    if (!orderId || isPickup || status !== "out_for_delivery") return;
    try {
      setOtpLoading(true);
      setOtpError("");
      const res = await fetch(`/api/orders/${orderId}/handover-otp`);
      const data = await res.json();
      if (data.success && data.otpCode) {
        setOtpData(data);
      } else if (data.message && !data.notActiveYet) {
        setOtpError(data.message);
      }
    } catch {
      setOtpError("Unable to retrieve handover code. Please check your connection.");
    } finally {
      setOtpLoading(false);
    }
  }, [orderId, isPickup, status]);

  React.useEffect(() => {
    if (orderId && status === "out_for_delivery" && !isPickup) {
      fetchHandoverOtp();
    }
  }, [orderId, status, isPickup, fetchHandoverOtp]);

  // Cooldown countdown
  React.useEffect(() => {
    if (reissueCooldown <= 0) return;
    const timer = setInterval(() => {
      setReissueCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [reissueCooldown]);

  const handleReissueOtp = async () => {
    if (!orderId || reissueCooldown > 0 || reissuing) return;
    try {
      setReissuing(true);
      setOtpError("");
      const res = await fetch(`/api/orders/${orderId}/handover-otp`, { method: "POST" });
      const data = await res.json();
      if (data.success && data.otpCode) {
        setOtpData(data);
        setReissueCooldown(30);
      } else {
        setOtpError(data.message || "Failed to reissue code.");
        if (data.status === 429) {
          setReissueCooldown(30);
        }
      }
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setReissuing(false);
    }
  };

  const handleCopyCode = () => {
    if (!otpData?.otpCode) return;
    navigator.clipboard.writeText(otpData.otpCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Cancellation timestamp & details from history if available
  const cancelEntry = Array.isArray(statusHistory)
    ? [...statusHistory].reverse().find((h) => h.status === "cancelled")
    : null;
  const cancelledAtDisplay = cancelEntry?.changedAt ? formatFullDateTime(cancelEntry.changedAt) : null;
  const effectiveCancelReason =
    cancellationReason || cancelEntry?.note || "This order was cancelled by the kitchen or customer.";

  // 1. Cancelled or Failed Order State
  if (isCancelled || isFailed) {
    return (
      <div className="w-full space-y-4">
        <div className="w-full bg-rose-500/10 border border-rose-500/25 rounded-3xl p-6 sm:p-7 text-rose-500 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
              {isCancelled ? <XCircle size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-block text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-500 px-3 py-1 rounded-full border border-rose-500/30">
                  {isCancelled ? "Order Cancelled" : "Payment Declined"}
                </span>
                {cancelledAtDisplay && (
                  <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 font-medium">
                    <Clock size={12} /> {cancelledAtDisplay}
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold text-[var(--text-main)]">
                {isCancelled ? "This order will not be fulfilled" : "Payment could not be processed"}
              </h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {isCancelled
                  ? (effectiveCancelReason
                      ? `Cancellation reason: ${effectiveCancelReason}. If any payment was captured, the full refund is initiated to the source payment method.`
                      : "This order was cancelled by the kitchen or user. If any payment was captured, the full refund is initiated to the source payment method.")
                  : "The payment transaction failed. Please retry your order using Cash on Delivery or another digital payment method."}
              </p>
            </div>
          </div>
        </div>

        {/* Status History Trail if entries exist */}
        {Array.isArray(statusHistory) && statusHistory.length > 0 && (
          <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-md">
            <h5 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-1.5">
              <Clock size={14} className="text-[var(--brand-accent)]" /> Recorded Status Log
            </h5>
            <div className="space-y-3">
              {statusHistory.map((entry, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 text-xs border-b border-[var(--border-color)]/50 pb-2.5 last:border-0 last:pb-0">
                  <div className="space-y-0.5">
                    <span className="font-bold text-[var(--text-main)] capitalize">
                      {entry.status?.replace(/_/g, " ")}
                    </span>
                    {entry.note && (
                      <p className="text-[11px] text-[var(--text-muted)]">{entry.note}</p>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                    {formatFullDateTime(entry.changedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Calculate percentage for progress line
  const progressPercent = (activeIndex / (steps.length - 1)) * 100;

  // 2. Normal Active Order Progress Tracker
  return (
    <div className="w-full space-y-4">
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
                Live Order Progress
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

        {/* Operational Problem / Alert Banner if present */}
        {notes && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
            <Clock size={16} className="shrink-0 mt-0.5 text-amber-500" />
            <div className="min-w-0">
              <p className="font-bold">Kitchen Note</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{notes}</p>
            </div>
          </div>
        )}

        {/* Delivery Partner Details / Which Staff Took the Order */}
        {assignedDeliveryStaff?.name && !isPickup && (
          <div className="mt-4 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 text-sm">
                🛵
              </div>
              <div className="min-w-0">
                <p className="font-bold text-stone-900 dark:text-white truncate">
                  Delivery Partner: {assignedDeliveryStaff.name}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {status === "out_for_delivery" ? "On the way with your food parcel" : "Assigned staff taking order for delivery"}
                </p>
              </div>
            </div>
            {assignedDeliveryStaff.phone && (
              <a
                href={`tel:${assignedDeliveryStaff.phone}`}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs transition border border-emerald-500/25 shrink-0"
              >
                Call Partner
              </a>
            )}
          </div>
        )}

        {/* Secure Delivery Handover OTP Card */}
        {status === "out_for_delivery" && !isPickup && orderId && (
          <div className="mt-5 p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-2 border-emerald-500/30 shadow-lg relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
                      Proof of Handover
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">
                      Doorstep Security Code
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold text-[var(--text-main)] mt-1">
                    Delivery Handover Code (OTP)
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                    Share this 4-digit code with your delivery driver when they hand you your food package.
                  </p>
                </div>
              </div>

              {/* 4-Digit Display & Copy Button */}
              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                {otpLoading && !otpData ? (
                  <div className="flex items-center gap-2 py-3 px-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-pulse">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Generating Handover Code...</span>
                  </div>
                ) : otpData?.otpCode ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center gap-1.5 bg-white dark:bg-stone-900 border-2 border-emerald-500/40 px-4 py-2 rounded-2xl shadow-md cursor-pointer hover:border-emerald-500 transition group"
                      onClick={handleCopyCode}
                      title="Click to copy handover code"
                    >
                      <span className="font-mono text-2xl sm:text-3xl font-black tracking-[0.25em] text-emerald-600 dark:text-emerald-400 pl-1">
                        {otpData.otpCode}
                      </span>
                      <button
                        type="button"
                        className="ml-2 p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 transition"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleReissueOtp}
                      disabled={reissueCooldown > 0 || reissuing}
                      className="p-2.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sub)] hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title={reissueCooldown > 0 ? `Wait ${reissueCooldown}s before reissuing` : "Reissue fresh handover code"}
                    >
                      <RefreshCw size={15} className={reissuing ? "animate-spin" : ""} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={fetchHandoverOtp}
                    className="py-2 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold transition hover:bg-emerald-700 flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    <span>Generate Code</span>
                  </button>
                )}

                {reissueCooldown > 0 && (
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    Reissue available in {reissueCooldown}s
                  </span>
                )}
              </div>
            </div>

            {otpError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{otpError}</span>
              </div>
            )}
          </div>
        )}

        {/* Desktop & Tablet Stepper with Real Recorded Timestamps */}
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
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = idx < activeIndex;
              const isCurrent = idx === activeIndex;
              const historyEntry = getStepHistoryEntry(step.id, statusHistory, createdAt);
              const stepTime = historyEntry?.changedAt ? formatStepTime(historyEntry.changedAt) : null;

              return (
                <div
                  key={step.id}
                  className="flex flex-col items-center text-center z-10 w-32 relative"
                >
                  {/* Node Pill / Circle */}
                  <Tooltip
                    content={step.statusMessage}
                    title={step.label}
                    placement="top"
                  >
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 cursor-help ${
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
                  </Tooltip>

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

                    {/* Step Recorded Timestamp or Status Badge */}
                    {stepTime ? (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[var(--bg-sub)] text-[var(--text-muted)] border border-[var(--border-color)]">
                        <Clock size={10} />
                        {stepTime}
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-[var(--brand-accent)] bg-[var(--brand-accent)]/15 px-2 py-0.5 rounded-full">
                        In Progress
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Stepper View */}
        <div className="sm:hidden pt-6 space-y-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const historyEntry = getStepHistoryEntry(step.id, statusHistory, createdAt);
            const stepTime = historyEntry?.changedAt ? formatStepTime(historyEntry.changedAt) : null;

            return (
              <div key={step.id} className="relative flex items-start gap-3.5">
                {idx < steps.length - 1 && (
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
                    {stepTime && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-0.5">
                        <Clock size={10} /> {stepTime}
                      </span>
                    )}
                    {!stepTime && isCurrent && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-[var(--brand-accent)] bg-[var(--brand-accent)]/15 px-2 py-0.5 rounded-full border border-[var(--brand-accent)]/30">
                        In Progress
                      </span>
                    )}
                    {!stepTime && isCompleted && (
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

      {/* Chronological Milestone Timeline (Zomato / Zepto Style Status Log) */}
      {Array.isArray(statusHistory) && statusHistory.length > 0 && (
        <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
              <Clock size={14} className="text-[var(--brand-accent)]" /> Order Status History
              <HelpTooltip
                content="Milestones are recorded live whenever the kitchen team or delivery partner updates your order progress."
                title="Status Milestones"
                side="right"
              />
            </h4>
            <span className="text-[11px] text-[var(--text-muted)]">
              {statusHistory.length} event{statusHistory.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-color)]">
            {statusHistory.map((item, idx) => {
              const isLast = idx === statusHistory.length - 1;
              return (
                <div key={idx} className="relative flex items-start gap-3 pl-7">
                  <div
                    className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 transition-colors ${
                      isLast
                        ? "bg-[var(--brand-accent)] border-[var(--brand-accent)] ring-3 ring-[var(--brand-accent)]/20"
                        : "bg-emerald-500 border-emerald-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--text-main)] capitalize">
                        {item.status?.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {formatFullDateTime(item.changedAt)}
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                        {item.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

