"use client";

import React from "react";
import {
  X,
  Phone,
  PhoneCall,
  MapPin,
  Clock,
  Printer,
  Bike,
  User,
  ChefHat,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  ExternalLink,
  Receipt,
  FileText,
  DollarSign,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";
import { formatOrderId } from "@/app/dashboard/DashboardClient";
import { getOrderElapsedInfo, checkIsPickup } from "@/app/orders/OrdersClient";

export default function OrderDetailsDrawer({
  isOpen,
  order,
  onClose,
  onUpdateStatus,
  onAcceptOrder,
  onOpenAssign,
  onOpenHandoverOtp,
  onOpenCancel,
  onPrintKot,
  updatingOrderId,
}) {
  if (!isOpen || !order) return null;

  const displayId = formatOrderId(order);
  const isPickup = checkIsPickup(order);
  const elapsed = getOrderElapsedInfo(order.createdAt, order.status, order.updatedAt);
  const isUpdating = updatingOrderId === order._id;

  const street = order.address?.street || "";
  const city = order.address?.city || "";
  const pincode = order.address?.pincode ? ` - ${order.address.pincode}` : "";
  const fullAddress = [street, city, pincode].filter(Boolean).join(", ");
  const customerName = order.address?.fullName || order.user?.name || "Customer";
  const customerPhone = order.address?.phone || order.user?.phone || "";

  const isCod =
    String(order.paymentMethod || "").toLowerCase().includes("cod") ||
    String(order.paymentMethod || "").toLowerCase().includes("cash") ||
    order.paymentStatus === "pending";

  const mapsUrl =
    order.address?.latitude && order.address?.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${order.address.latitude},${order.address.longitude}`
      : fullAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
      : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-[#FAF7F2] dark:bg-stone-900 h-full shadow-2xl flex flex-col border-l border-stone-200 dark:border-white/10 animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-order-id"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-stone-50/70 dark:bg-white/[0.02]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="drawer-order-id" className="text-lg font-black font-mono text-stone-900 dark:text-white">
                {displayId}
              </h2>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isPickup
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                }`}
              >
                {isPickup ? "🛍️ Counter Pickup" : "🛵 Doorstep Delivery"}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${elapsed.color}`}
              >
                <Clock size={10} />
                <span>{elapsed.text}</span>
              </span>
            </div>
            <div className="text-xs text-stone-400 mt-1 flex items-center gap-1 font-mono">
              <span>Placed:</span>
              <span>
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "Just now"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onPrintKot(order)}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition cursor-pointer"
              title="Print Kitchen Ticket (KOT)"
            >
              <Printer size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-500 hover:text-stone-900 dark:hover:text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Customer & Address Card */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/80 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Customer Details
              </span>
              {customerPhone && (
                <a
                  href={`tel:${customerPhone}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
                >
                  <PhoneCall size={12} />
                  <span>Call Customer</span>
                </a>
              )}
            </div>

            <div>
              <div className="text-sm font-bold text-stone-900 dark:text-white">
                {customerName}
              </div>
              {customerPhone && (
                <div className="text-xs text-stone-500 dark:text-stone-400 font-mono mt-0.5">
                  {customerPhone}
                </div>
              )}
            </div>

            {!isPickup && (
              <div className="pt-2 border-t border-stone-200/60 dark:border-white/5 space-y-1">
                <div className="text-xs text-stone-700 dark:text-stone-300 flex items-start gap-1.5">
                  <MapPin size={14} className="text-orange-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{fullAddress || "No street address provided"}</span>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline mt-1"
                  >
                    <span>Open in Maps</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Delivery Assignment Panel */}
          {!isPickup && (
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/80 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Bike size={13} />
                  <span>Delivery Fleet Assignment</span>
                </span>
                {order.status !== "delivered" && order.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => onOpenAssign(order)}
                    className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                  >
                    {order.assignedDeliveryStaff?.id ? "Change Driver" : "Assign Driver"}
                  </button>
                )}
              </div>

              {order.assignedDeliveryStaff?.id ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200/80 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-xs">
                      {(order.assignedDeliveryStaff.name || "D").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-900 dark:text-white">
                        {order.assignedDeliveryStaff.name}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                        {order.assignedDeliveryStaff.phone || "No phone recorded"}
                      </div>
                    </div>
                  </div>

                  {order.assignedDeliveryStaff.phone && (
                    <a
                      href={`tel:${order.assignedDeliveryStaff.phone}`}
                      className="p-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-orange-500 transition"
                      title="Call Assigned Courier"
                    >
                      <PhoneCall size={13} />
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>No delivery driver assigned yet.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenAssign(order)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition shrink-0 cursor-pointer"
                  >
                    Assign Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Kitchen Items Breakdown */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">
              Items Ordered ({order.items?.length || 0})
            </span>
            <div className="divide-y divide-stone-100 dark:divide-white/5 rounded-2xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/80 dark:border-white/5 overflow-hidden">
              {order.items?.map((it, idx) => {
                const itemTotal = (it.price || 0) * (it.quantity || 1);
                return (
                  <div key={idx} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-stone-200 dark:bg-stone-800 font-mono font-bold text-stone-800 dark:text-stone-200 flex items-center justify-center shrink-0">
                        {it.quantity}×
                      </span>
                      <div>
                        <div className="font-bold text-stone-900 dark:text-white">
                          {it.name}
                        </div>
                        {it.variantName && (
                          <div className="text-[11px] text-stone-400">
                            Variant: {it.variantName}
                          </div>
                        )}
                        {it.servingLabel && (
                          <div className="text-[11px] text-stone-400">
                            Portion: {it.servingLabel}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-stone-900 dark:text-white shrink-0">
                      ₹{itemTotal}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Special Notes / Allergies */}
          {order.notes && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <FileText size={13} />
                <span>Cooking &amp; Preparation Instructions</span>
              </div>
              <p className="leading-relaxed pl-5 font-medium">{order.notes}</p>
            </div>
          )}

          {/* Payment & Bill Summary */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/80 dark:border-white/5 space-y-2 text-xs">
            <span className="font-bold uppercase tracking-wider text-stone-400 block mb-1">
              Payment &amp; Settlement
            </span>
            <div className="flex justify-between text-stone-600 dark:text-stone-300">
              <span>Item Subtotal</span>
              <span className="font-mono font-bold">₹{order.subtotal || order.totalAmount}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-stone-600 dark:text-stone-300">
                <span>Delivery Charge</span>
                <span className="font-mono font-bold">₹{order.deliveryFee}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span>Discount Applied</span>
                <span className="font-mono">-₹{order.discount}</span>
              </div>
            )}
            <div className="pt-2 border-t border-stone-200/60 dark:border-white/5 flex justify-between items-center text-sm font-black text-stone-900 dark:text-white">
              <span>Total Bill</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base">₹{order.totalAmount}</span>
                <span
                  className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                    isCod
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {isCod ? "Cash on Delivery" : "Paid Online"}
                </span>
              </div>
            </div>
          </div>

          {/* Status Timeline History */}
          {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">
                Audit Timeline
              </span>
              <div className="space-y-2 pl-2 border-l-2 border-stone-200 dark:border-white/10">
                {order.statusHistory.map((h, i) => (
                  <div key={i} className="pl-3 relative text-xs text-stone-500 dark:text-stone-400">
                    <span className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-stone-800 dark:text-stone-200 text-[11px]">
                        {h.status}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {h.changedAt ? new Date(h.changedAt).toLocaleTimeString() : ""}
                      </span>
                    </div>
                    {h.note && <div className="text-[11px] text-stone-500 mt-0.5">{h.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Sticky Footer with Contextual Action Buttons */}
        <div className="p-4 border-t border-stone-100 dark:border-white/5 bg-stone-50/80 dark:bg-white/[0.02] shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {order.status !== "cancelled" && order.status !== "delivered" && (
              <button
                type="button"
                onClick={() => onOpenCancel(order)}
                className="px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold text-xs transition cursor-pointer"
              >
                {order.status === "pending" ? "Reject" : "Cancel"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {order.status === "pending" && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  if (typeof onAcceptOrder === "function") {
                    onAcceptOrder(order);
                  } else {
                    onUpdateStatus(order._id, "preparing");
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                <span>Accept &amp; Cook</span>
              </button>
            )}

            {order.status === "confirmed" && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(order._id, "preparing")}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ChefHat size={14} />
                <span>Start Cooking</span>
              </button>
            )}

            {order.status === "preparing" && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(order._id, "ready")}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <PackageCheck size={14} />
                <span>{isPickup ? "Mark Ready for Pickup" : "Mark Cooked & Ready"}</span>
              </button>
            )}

            {order.status === "ready" && (
              isPickup ? (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onUpdateStatus(order._id, "delivered")}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  <span>Confirm Handover (Delivered)</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => {
                    if (!order.assignedDeliveryStaff?.id) {
                      onOpenAssign(order);
                    } else {
                      onUpdateStatus(order._id, "out_for_delivery");
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Truck size={14} />
                  <span>Dispatch for Delivery</span>
                </button>
              )
            )}

            {order.status === "out_for_delivery" && !isPickup && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onOpenHandoverOtp(order)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                <span>Verify OTP &amp; Complete</span>
              </button>
            )}

            {order.status === "delivered" && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={14} />
                <span>Order Completed</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

