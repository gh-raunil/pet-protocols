"use client";

import { Clock, Store, AlertTriangle, CheckCircle2 } from "lucide-react";

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

export default function BusinessSection({ form, onChange, onSave, saving }) {
  const weeklyHours = form.weeklyHours || {
    monday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    tuesday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    wednesday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    thursday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    friday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    saturday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    sunday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
  };

  function updateDayIsOpen(dayKey, isOpen) {
    const day = weeklyHours[dayKey] || { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] };
    onChange("weeklyHours", {
      ...weeklyHours,
      [dayKey]: { ...day, isOpen },
    });
  }

  function updateDaySlot(dayKey, field, val) {
    const day = weeklyHours[dayKey] || { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] };
    const slots = [...(day.slots || [{ open: "10:00", close: "23:00" }])];
    slots[0] = { ...slots[0], [field]: val };
    onChange("weeklyHours", {
      ...weeklyHours,
      [dayKey]: { ...day, slots },
    });
  }

  return (
    <div className="space-y-6 pb-24 sm:pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Opening Hours</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Tell customers when your restaurant is open.
        </p>
      </div>

      {/* QUICK STATUS CARD */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Restaurant Status Right Now</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Quickly toggle whether customers can order</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Open / Closed Button */}
          <button
            type="button"
            onClick={() => onChange("isOpen", !form.isOpen)}
            className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              form.isOpen && !form.isTemporarilyClosed
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${form.isOpen && !form.isTemporarilyClosed ? "bg-emerald-500" : "bg-zinc-400"}`} />
                <span className="text-sm font-bold">Restaurant is: {form.isOpen && !form.isTemporarilyClosed ? "Open" : "Closed"}</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {form.isOpen && !form.isTemporarilyClosed ? "Customers can browse and place orders" : "Customers cannot place orders right now"}
              </p>
            </div>
          </button>

          {/* Temporarily Closed Button */}
          <button
            type="button"
            onClick={() => onChange("isTemporarilyClosed", !form.isTemporarilyClosed)}
            className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              form.isTemporarilyClosed
                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200"
                : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${form.isTemporarilyClosed ? "text-amber-500" : "text-zinc-400"}`} />
                <span className="text-sm font-bold">Temporarily Closed</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {form.isTemporarilyClosed ? "Pause orders for holidays or maintenance" : "Click if you need a quick temporary pause"}
              </p>
            </div>
          </button>
        </div>

        {form.isTemporarilyClosed && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300">
              Tell customers why you are temporarily closed:
            </label>
            <div className="flex flex-wrap gap-2">
              {["Holiday", "Kitchen Maintenance", "Private Event", "Heavy Rain", "Staff Shortage"].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onChange("closureReason", reason)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                    form.closureReason === reason
                      ? "bg-amber-500 text-white border-amber-500 font-semibold"
                      : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:border-amber-400"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.closureReason || ""}
              onChange={(e) => onChange("closureReason", e.target.value)}
              placeholder="Or type custom reason (e.g. Back in 2 hours)"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-amber-500"
            />
          </div>
        )}
      </section>

      {/* WEEKLY SCHEDULE */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Weekly Schedule</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Set regular opening and closing times for each day</p>
          </div>
        </div>

        <div className="space-y-3">
          {DAYS_OF_WEEK.map(({ key, label }) => {
            const dayData = weeklyHours[key] || { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] };
            const isOpen = dayData.isOpen ?? true;
            const slot = dayData.slots?.[0] || { open: "10:00", close: "23:00" };

            return (
              <div
                key={key}
                className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  isOpen
                    ? "bg-zinc-50/90 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700/60"
                    : "bg-zinc-100/50 dark:bg-zinc-900/40 border-zinc-200/80 dark:border-zinc-800/80 opacity-70"
                }`}
              >
                {/* Day label and toggle */}
                <div className="flex items-center justify-between sm:justify-start gap-3 sm:w-44 shrink-0">
                  <span className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-zinc-100">{label}</span>
                  <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-700/80 p-0.5 bg-white dark:bg-zinc-800 text-xs shadow-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => updateDayIsOpen(key, true)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isOpen
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDayIsOpen(key, false)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !isOpen
                          ? "bg-zinc-600 dark:bg-zinc-700 text-white shadow-xs"
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      Closed
                    </button>
                  </div>
                </div>

                {/* Timing controls if open */}
                {isOpen ? (
                  <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-3 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-2.5 py-1.5 focus-within:border-orange-500 shadow-xs transition-colors min-w-0 flex-1 sm:flex-initial">
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">Opens:</span>
                      <input
                        type="time"
                        value={slot.open || "10:00"}
                        onChange={(e) => updateDaySlot(key, "open", e.target.value)}
                        className="w-full min-w-0 bg-transparent text-zinc-900 dark:text-white font-mono font-bold text-xs outline-none cursor-pointer"
                      />
                    </div>

                    <span className="hidden sm:inline text-zinc-400 font-bold">—</span>

                    <div className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-2.5 py-1.5 focus-within:border-orange-500 shadow-xs transition-colors min-w-0 flex-1 sm:flex-initial">
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">Closes:</span>
                      <input
                        type="time"
                        value={slot.close || "23:00"}
                        onChange={(e) => updateDaySlot(key, "close", e.target.value)}
                        className="w-full min-w-0 bg-transparent text-zinc-900 dark:text-white font-mono font-bold text-xs outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-0.5 sm:py-1">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60">
                      Closed all day
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
