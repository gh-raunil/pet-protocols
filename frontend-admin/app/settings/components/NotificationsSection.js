"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Volume2,
  Mail,
  MessageSquare,
  Smartphone,
  Play,
  CheckCircle2,
} from "lucide-react";
import { CHIME_OPTIONS, getSavedChime, setSavedChime, playChime } from "@/lib/soundChimes";

export default function NotificationsSection({ form, onChange, onSave, saving }) {
  const notif = form.notificationSettings || {
    customerOrderPlaced: true,
    customerOrderConfirmed: true,
    customerOrderPreparing: true,
    customerOrderReady: true,
    customerOutForDelivery: true,
    customerDelivered: true,
    customerCancelled: true,
    restaurantNewOrder: true,
    restaurantCancelledOrder: true,
    restaurantPaymentFailure: true,
    restaurantCustomerMessage: true,
    channels: { inApp: true, email: true, whatsapp: false, push: true },
    audioChime: "bell",
  };

  const [currentChime, setCurrentChime] = useState("bell");

  useEffect(() => {
    setCurrentChime(getSavedChime() || notif.audioChime || "bell");
  }, [notif.audioChime]);

  function handleChimeSelect(chimeId) {
    setCurrentChime(chimeId);
    setSavedChime(chimeId);
    playChime(chimeId, 1.0);
    onChange("notificationSettings", { ...notif, audioChime: chimeId });
  }

  function handleTestChime() {
    playChime(currentChime, 1.0);
  }

  function updateNotif(field, val) {
    onChange("notificationSettings", { ...notif, [field]: val });
  }

  function updateChannel(channel, val) {
    onChange("notificationSettings", {
      ...notif,
      channels: { ...(notif.channels || {}), [channel]: val },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Notifications & Sound Alerts</h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Configure customer status broadcasts, staff kitchen alerts, supported dispatch channels, and order chime audio.
        </p>
      </div>

      {/* D. Order Audio Chime */}
      <section className="bg-[#10141f]/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white">Order Chime & Audio Alerts</h2>
            <p className="text-[11px] sm:text-xs text-zinc-400">Play an audible chime whenever an order is submitted</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">Kitchen Alert Sound Tone</div>
              <div className="text-[11px] sm:text-xs text-zinc-400">Synthesized Web Audio alert when incoming order arrives</div>
            </div>
            <button
              type="button"
              onClick={handleTestChime}
              className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs font-semibold border border-orange-500/30 transition-colors w-fit"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Preview Sound
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {CHIME_OPTIONS.map((chime) => {
              const isSelected = currentChime === chime.id;
              return (
                <button
                  key={chime.id}
                  type="button"
                  onClick={() => handleChimeSelect(chime.id)}
                  className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-orange-500/15 border-orange-500/50 text-orange-400"
                      : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{chime.name}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />}
                  </div>
                  <span className="text-[10px] text-zinc-500 block mt-1">{chime.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* C. Channels */}
      <section className="bg-[#10141f]/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white">Delivery Channels</h2>
            <p className="text-[11px] sm:text-xs text-zinc-400">Channels used to deliver order notifications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">In-App Live Alerts</div>
                <div className="text-xs text-zinc-400">Dashboard popups & live order toasts</div>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
              Always Active
            </span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Email Notifications</div>
                <div className="text-xs text-zinc-400">Order receipts & cancellation emails</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notif.channels?.email ?? true}
                onChange={(e) => updateChannel("email", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">WhatsApp Alerts</div>
                <div className="text-xs text-zinc-400">Requires restaurant WhatsApp number</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notif.channels?.whatsapp ?? false}
                onChange={(e) => updateChannel("whatsapp", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Browser Push Notifications</div>
                <div className="text-xs text-zinc-400">Desktop and mobile browser alerts</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notif.channels?.push ?? true}
                onChange={(e) => updateChannel("push", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>
        </div>
      </section>

      {/* A & B. Customer & Restaurant Event Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Alerts */}
        <section className="bg-[#10141f]/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="pb-3 border-b border-zinc-800/80">
            <h2 className="text-sm sm:text-base font-semibold text-white">Customer Order Notifications</h2>
            <p className="text-[11px] sm:text-xs text-zinc-400">Statuses triggered to buyer</p>
          </div>

          {[
            { key: "customerOrderPlaced", label: "Order Placed" },
            { key: "customerOrderConfirmed", label: "Order Confirmed" },
            { key: "customerOrderPreparing", label: "Kitchen Preparing" },
            { key: "customerOrderReady", label: "Order Ready" },
            { key: "customerOutForDelivery", label: "Out For Delivery" },
            { key: "customerDelivered", label: "Delivered" },
            { key: "customerCancelled", label: "Cancelled" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between text-xs py-1.5">
              <span className="text-zinc-300 font-medium">{label}</span>
              <input
                type="checkbox"
                checked={notif[key] ?? true}
                onChange={(e) => updateNotif(key, e.target.checked)}
                className="w-4 h-4 rounded text-orange-500 bg-zinc-800 border-zinc-700 cursor-pointer"
              />
            </div>
          ))}
        </section>

        {/* Restaurant Kitchen Alerts */}
        <section className="bg-[#10141f]/90 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="pb-3 border-b border-zinc-800/80">
            <h2 className="text-sm sm:text-base font-semibold text-white">Restaurant Admin Alerts</h2>
            <p className="text-[11px] sm:text-xs text-zinc-400">Events notifying kitchen & managers</p>
          </div>

          {[
            { key: "restaurantNewOrder", label: "New Order Submitted" },
            { key: "restaurantCancelledOrder", label: "Order Cancelled by Customer" },
            { key: "restaurantPaymentFailure", label: "Payment Transaction Failure" },
            { key: "restaurantCustomerMessage", label: "Customer Message / Special Note" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between text-xs py-1.5">
              <span className="text-zinc-300 font-medium">{label}</span>
              <input
                type="checkbox"
                checked={notif[key] ?? true}
                onChange={(e) => updateNotif(key, e.target.checked)}
                className="w-4 h-4 rounded text-orange-500 bg-zinc-800 border-zinc-700 cursor-pointer"
              />
            </div>
          ))}
        </section>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          type="button"
          className="cursor-pointer px-5 sm:px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-orange-500/25 transition-all flex items-center gap-2"
        >
          {saving ? "Saving Changes..." : "Save Notification Preferences"}
        </button>
      </div>
    </div>
  );
}
