"use client";

import { useState, useEffect } from "react";
import {
  Sliders,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Percent,
  Mail,
  Phone,
  Building,
} from "lucide-react";

export default function SettingsManager() {
  const [settings, setSettings] = useState({
    platformName: "Pet Protocols",
    platformFeePercent: 5.0,
    taxPercent: 5.0,
    maintenanceMode: false,
    supportEmail: "support@petprotocols.in",
    supportPhone: "+91 98765 43210",
    autoApproveRestaurants: false,
    timezone: "Asia/Kolkata",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  async function loadSettings(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);

      const res = await fetch("/api/superadmin/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings({
          platformName: data.settings.platformName ?? "Pet Protocols",
          platformFeePercent: data.settings.platformFeePercent ?? 5.0,
          taxPercent: data.settings.taxPercent ?? 5.0,
          maintenanceMode: Boolean(data.settings.maintenanceMode),
          supportEmail: data.settings.supportEmail ?? "support@petprotocols.in",
          supportPhone: data.settings.supportPhone ?? "+91 98765 43210",
          autoApproveRestaurants: Boolean(data.settings.autoApproveRestaurants),
          timezone: data.settings.timezone ?? "Asia/Kolkata",
        });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to load platform settings." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSaveSettings(e) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch("/api/superadmin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "Platform settings updated successfully." });
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to save settings." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span>Platform Global Settings</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure financial platform fee cuts, taxation, emergency maintenance lock, and platform contacts.
        </p>
      </div>

      {feedback.message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300"
          }`}
        >
          <p className="text-xs sm:text-sm font-semibold">{feedback.message}</p>
          <button onClick={() => setFeedback({ type: "", message: "" })} className="text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold">Loading platform configuration...</p>
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Card 1: Platform Commercials */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Percent size={15} className="text-indigo-500" />
              <span>Platform Commercials & Revenue Splits</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Platform Commission Fee (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={settings.platformFeePercent}
                  onChange={(e) =>
                    setSettings({ ...settings, platformFeePercent: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">Platform service fee taken from each order.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Default Platform Tax / GST Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  value={settings.taxPercent}
                  onChange={(e) =>
                    setSettings({ ...settings, taxPercent: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">Applicable GST calculated at checkout.</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Primary Platform Time Zone
                </label>
                <select
                  value={settings.timezone || "Asia/Kolkata"}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer"
                >
                  <option value="Asia/Kolkata">India Standard Time (IST, UTC+5:30) [Default] 🇮🇳</option>
                  <option value="Asia/Dubai">Gulf Standard Time (GST, UTC+4:00) 🇦🇪</option>
                  <option value="Asia/Singapore">Singapore Standard Time (SGT, UTC+8:00) 🇸🇬</option>
                  <option value="Europe/London">Greenwich Mean Time (GMT/BST, UTC+0:00 / +1:00) 🇬🇧</option>
                  <option value="America/New_York">Eastern Time (EST/EDT, UTC-5:00 / -4:00) 🇺🇸</option>
                  <option value="America/Los_Angeles">Pacific Time (PST/PDT, UTC-8:00 / -7:00) 🇺🇸</option>
                  <option value="UTC">Coordinated Universal Time (UTC) 🌐</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Used across all partner kitchens to synchronize opening schedules and order processing.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Platform Contact Details */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Mail size={15} className="text-indigo-500" />
              <span>Official Platform Contact Info</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Central Helpdesk Email
                </label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Helpline Phone Number
                </label>
                <input
                  type="text"
                  value={settings.supportPhone}
                  onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 3: System Status & Maintenance */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert size={15} className="text-amber-500" />
              <span>Operational Controls</span>
            </h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">
                    Maintenance Mode
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Temporarily shows a maintenance screen on customer checkout.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">
                    Auto-Approve Partner Restaurants
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Instantly marks new partner onboarding as active without manual review.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoApproveRestaurants}
                  onChange={(e) =>
                    setSettings({ ...settings, autoApproveRestaurants: e.target.checked })
                  }
                  className="w-5 h-5 accent-indigo-600 rounded"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-indigo-600/25 disabled:opacity-50"
            >
              <Save size={16} />
              <span>{saving ? "Saving Changes..." : "Save Platform Settings"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
