"use client";

import React, { useState, useMemo } from "react";
import {
  Bike,
  User,
  Phone,
  PhoneCall,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";
import { formatOrderId } from "@/app/dashboard/DashboardClient";

export default function InlineDeliveryAssignModal({
  isOpen,
  order,
  deliveryStaff = [],
  loadingStaff = false,
  activeOrdersMap = {},
  isManager = false,
  onAssign,
  onSelfDelivery,
  onClose,
  submitting = false,
}) {
  const [search, setSearch] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState(
    order?.assignedDeliveryStaff?.id || null
  );

  const displayId = order ? formatOrderId(order) : "";
  const isPickup = order ? order.orderType === "pickup" : false;

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return deliveryStaff;
    const q = search.toLowerCase().trim();
    return deliveryStaff.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.phone || "").toLowerCase().includes(q)
    );
  }, [deliveryStaff, search]);

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl border border-stone-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-modal-title"
      >
        {/* Header */}
        <div className="p-5 border-b border-stone-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-stone-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              <Bike size={20} />
            </span>
            <div>
              <h3 id="assign-modal-title" className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                <span>Assign Delivery Partner</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300">
                  {displayId}
                </span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Select an active courier or opt for manager self-delivery.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Pickup Warning Guard */}
        {isPickup ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-white">
              Counter Pickup Order
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
              This order is marked for Customer Counter Pickup and cannot be assigned to a delivery driver. Hand it over directly at the pickup counter.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 px-5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Manager Self-Delivery Banner */}
            {isManager && (
              <div className="p-4 bg-purple-500/5 dark:bg-purple-950/20 border-b border-purple-500/20 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-purple-950 dark:text-purple-200">
                      Deliver Myself as Store Manager
                    </div>
                    <div className="text-[11px] text-purple-700/80 dark:text-purple-300/80">
                      Take this parcel directly and deliver to the customer yourself.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => onSelfDelivery(order._id)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shrink-0 transition active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  {submitting ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span>Self Deliver</span>
                </button>
              </div>
            )}

            {/* Search filter */}
            <div className="p-3 border-b border-stone-100 dark:border-white/5 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by driver name or phone..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-stone-100 dark:bg-white/5 border border-transparent focus:border-orange-500 focus:bg-white dark:focus:bg-stone-800 text-stone-900 dark:text-white outline-hidden transition"
                />
              </div>
            </div>

            {/* Courier List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingStaff ? (
                <div className="py-12 text-center text-stone-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Loading delivery fleet roster...</span>
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs">
                  No active delivery staff found. Add couriers in Settings &gt; Staff.
                </div>
              ) : (
                filteredStaff.map((staff) => {
                  const staffId = staff._id || staff.id;
                  const isAssigned = String(selectedStaffId) === String(staffId);
                  const isCurrentAssigned =
                    order.assignedDeliveryStaff?.id &&
                    String(order.assignedDeliveryStaff.id) === String(staffId);
                  const activeCount =
                    activeOrdersMap[staffId] ?? staff.activeOrdersCount ?? 0;
                  const isOffline = staff.status === "inactive" || staff.status === "offline";

                  return (
                    <div
                      key={staffId}
                      onClick={() => !isOffline && setSelectedStaffId(staffId)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isAssigned
                          ? "border-orange-500 bg-orange-50/60 dark:bg-orange-950/20 shadow-xs"
                          : isOffline
                          ? "opacity-50 border-stone-200/50 dark:border-white/5 cursor-not-allowed bg-stone-50/30 dark:bg-white/[0.01]"
                          : "border-stone-200/80 dark:border-white/10 hover:border-orange-300 dark:hover:border-white/20 bg-white dark:bg-stone-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-xs ${
                            isAssigned
                              ? "bg-orange-500 text-white"
                              : "bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200"
                          }`}
                        >
                          {(staff.name || "D").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-900 dark:text-white truncate">
                              {staff.name}
                            </span>
                            {isCurrentAssigned && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 font-mono">
                            {staff.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={10} />
                                {staff.phone}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOffline
                                    ? "bg-stone-400"
                                    : activeCount > 0
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                              />
                              <span>
                                {isOffline
                                  ? "Offline"
                                  : activeCount > 0
                                  ? `${activeCount} Active Order${activeCount > 1 ? "s" : ""}`
                                  : "Available (Idle)"}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {staff.phone && (
                          <a
                            href={`tel:${staff.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-orange-500 transition"
                            title="Call courier"
                          >
                            <PhoneCall size={13} />
                          </a>
                        )}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center border transition ${
                            isAssigned
                              ? "bg-orange-500 border-orange-500 text-white"
                              : "border-stone-300 dark:border-white/20 text-transparent"
                          }`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-stone-100 dark:border-white/5 flex items-center justify-end gap-2 shrink-0 bg-stone-50/50 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-300 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedStaffId || submitting}
                onClick={() => {
                  const staffObj = deliveryStaff.find(
                    (s) => String(s._id || s.id) === String(selectedStaffId)
                  );
                  if (staffObj) {
                    onAssign(order._id, staffObj);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <>
                    <Check size={13} strokeWidth={3} />
                    <span>Confirm Assignment</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

