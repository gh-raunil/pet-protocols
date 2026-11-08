"use client";

import React, { useState } from "react";
import { XCircle, X, AlertTriangle, RefreshCw } from "lucide-react";
import { formatOrderId } from "@/app/dashboard/DashboardClient";

const CANCEL_REASONS = [
  "Kitchen at full capacity / delayed rush",
  "Item out of stock / ingredient unavailable",
  "Customer requested cancellation",
  "Address unreachable / outside delivery zone",
  "Duplicate order placed by customer",
  "Other operational reason",
];

export default function CancelOrderModal({
  isOpen,
  order,
  onConfirm,
  onClose,
  submitting = false,
}) {
  const [selectedReason, setSelectedReason] = useState(CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");

  if (!isOpen || !order) return null;

  const displayId = formatOrderId(order);
  const isPending = order.status === "pending";

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason =
      selectedReason === "Other operational reason" && customReason.trim()
        ? customReason.trim()
        : selectedReason;
    onConfirm(order._id, finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl border border-rose-500/30 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/5">
          <h3 id="cancel-modal-title" className="text-base font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <XCircle size={18} />
            <span>{isPending ? "Reject Incoming Order" : "Cancel Order"}</span>
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
          Are you sure you want to {isPending ? "reject" : "cancel"} order{" "}
          <strong className="text-stone-900 dark:text-white font-mono">{displayId}</strong>? If paid online, an automated gateway refund will be scheduled.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1.5">
              Reason for Cancellation
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-stone-900 dark:text-white outline-hidden transition focus:border-rose-500"
            >
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r} className="dark:bg-stone-900">
                  {r}
                </option>
              ))}
            </select>
          </div>

          {selectedReason === "Other operational reason" && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1.5">
                Specific Reason Details
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explain why this order is being cancelled..."
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-stone-900 dark:text-white outline-hidden transition focus:border-rose-500 resize-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 dark:border-white/10 text-stone-700 dark:text-stone-300 rounded-xl font-bold text-xs hover:bg-stone-100 dark:hover:bg-white/5 transition cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <XCircle size={13} />
                  <span>Confirm {isPending ? "Rejection" : "Cancellation"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

