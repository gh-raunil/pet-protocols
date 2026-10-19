"use client";

import React from "react";
import {
  AlertTriangle,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ChefHat,
  Truck,
  Package,
} from "lucide-react";

export default function OutOfRangeOrderModal({
  isOpen,
  order,
  distanceKm = 10,
  maxRangeKm = 10,
  onAccept,
  onReject,
  onClose,
  updating = false,
}) {
  if (!isOpen || !order) return null;

  const excessKm = Math.max(0, Number((distanceKm - maxRangeKm).toFixed(1)));
  const estMins = Math.max(1, Math.round((distanceKm / 22) * 60 + 5));
  const orderUniqueId = order.orderId || order._id?.slice(-8).toUpperCase() || "ORD";
  const customerName = order.address?.fullName || order.user?.name || "Customer";
  const customerPhone = order.address?.phone || "N/A";
  const street = order.address?.street || "";
  const city = order.address?.city || "";
  const pincode = order.address?.pincode ? ` - ${order.address.pincode}` : "";
  const fullAddress = [street, city, pincode].filter(Boolean).join(", ");
  const paymentMethod = order.paymentMethod || (order.paymentStatus === "pending" ? "Cash on Delivery (COD)" : "Online Payment");
  const isCod = String(paymentMethod).toLowerCase().includes("cod") || String(paymentMethod).toLowerCase().includes("cash");

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#121624] border border-amber-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="out-of-range-title"
      >
        {/* Header Alert Bar */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 p-5 text-white relative overflow-hidden shrink-0">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-start gap-3.5 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 border border-white/30 backdrop-blur-xs">
              <AlertTriangle size={24} className="animate-bounce" />
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white border border-white/30 mb-1">
                ⚠️ Out-of-Range Delivery Alert
              </span>
              <h3 id="out-of-range-title" className="text-lg font-extrabold tracking-tight">
                Manager Confirmation Required
              </h3>
              <p className="text-amber-100 text-xs mt-0.5 leading-relaxed font-medium">
                Order #{orderUniqueId} is outside your restaurant's standard {maxRangeKm} km delivery limit.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Key Distance Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-center">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                Distance
              </span>
              <span className="text-lg font-black text-rose-700 dark:text-rose-300 font-mono">
                {distanceKm.toFixed(1)} km
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-center">
              <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                Standard Limit
              </span>
              <span className="text-lg font-black text-stone-800 dark:text-stone-200 font-mono">
                {maxRangeKm} km
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                Excess Range
              </span>
              <span className="text-lg font-black text-amber-700 dark:text-amber-300 font-mono">
                +{excessKm} km
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-center">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                Est. Drive Time
              </span>
              <span className="text-lg font-black text-blue-700 dark:text-blue-300 font-mono">
                ~{estMins}m
              </span>
            </div>
          </div>

          {/* Customer & Address Card */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <MapPin size={14} className="text-rose-500 shrink-0" />
                <span>{customerName}</span>
              </span>
              <a
                href={`tel:${customerPhone}`}
                className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Phone size={11} />
                <span>{customerPhone}</span>
              </a>
            </div>

            <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-[11px] pl-5">
              {fullAddress || "Address provided at checkout"}
            </p>

            {(order.address?.latitude || order.customerLocation?.latitude) && (
              <div className="pl-5 text-[10px] font-mono text-stone-400 flex items-center gap-1">
                <span>📍 GPS Pin:</span>
                <span>
                  {Number(order.address?.latitude || order.customerLocation?.latitude).toFixed(5)},{" "}
                  {Number(order.address?.longitude || order.customerLocation?.longitude).toFixed(5)}
                </span>
              </div>
            )}
          </div>

          {/* Order Contents & Payment Info */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={15} className="text-stone-400" />
              <div>
                <span className="font-bold text-stone-800 dark:text-stone-200 block">
                  {order.items?.length || 1} Dish{(order.items?.length || 1) > 1 ? "es" : ""} • ₹{order.totalAmount}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isCod ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {isCod ? "Cash on Delivery" : "Paid Online"}
                </span>
              </div>
            </div>

            {order.notes && (
              <span className="text-[10px] italic text-stone-500 max-w-[150px] truncate" title={order.notes}>
                "{order.notes}"
              </span>
            )}
          </div>

          {/* Policy Guidance Alert */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 leading-relaxed text-[11px] flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Manager Policy Notice:</strong> Because this address is{" "}
              <strong>{distanceKm.toFixed(1)} km</strong> away (exceeding standard {maxRangeKm} km radius), dispatching a delivery partner will take longer and may require extra transit. Please explicitly choose whether to accept or cancel this order.
            </div>
          </div>
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="p-4 bg-stone-50 dark:bg-stone-900/50 border-t border-stone-200/80 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            disabled={updating}
            onClick={onClose}
            className="px-3 py-2 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-bold text-xs transition cursor-pointer order-3 sm:order-1 text-center"
          >
            Review Later
          </button>

          <div className="flex items-center gap-2 order-1 sm:order-2">
            <button
              type="button"
              disabled={updating}
              onClick={onReject}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-rose-400 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <XCircle size={14} />
              <span>Reject Order</span>
            </button>

            <button
              type="button"
              disabled={updating}
              onClick={onAccept}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition shadow-md active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              <span>Accept Out-of-Range</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
