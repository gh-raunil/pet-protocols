"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Cpu,
  Download,
  ShieldAlert,
  CreditCard,
  Image as ImageIcon,
  MessageSquare,
  MapPin,
  FileSpreadsheet,
  AlertTriangle,
  Globe,
  Sliders,
  Users,
  Lock,
} from "lucide-react";

export default function AdvancedSection({ form, meta, onChange, onSave, onResetDefaults, saving }) {
  const { data: session } = useSession();
  const [exporting, setExporting] = useState("");
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const regional = form.regionalSettings || {
    currency: "INR",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12-hour",
  };

  const taxSettings = form.taxSettings || {
    enabled: false,
    percentage: 5,
    inclusive: false,
    label: "GST",
  };

  const chargeSettings = form.chargeSettings || {
    packagingFee: 0,
    serviceFee: 0,
    convenienceFee: 0,
  };

  const delivery = form.deliverySettings || {
    serviceablePincodes: [],
    estimatedDeliveryMinutes: 35,
    minDeliveryMinutes: 20,
    maxDeliveryMinutes: 60,
    staffAssignmentMethod: "manual",
  };

  function updateRegional(field, val) {
    onChange("regionalSettings", { ...regional, [field]: val });
  }

  function updateTax(field, val) {
    onChange("taxSettings", { ...taxSettings, [field]: val });
  }

  function updateCharge(field, val) {
    onChange("chargeSettings", { ...chargeSettings, [field]: val });
  }

  function updateDelivery(field, val) {
    onChange("deliverySettings", { ...delivery, [field]: val });
  }

  // Trigger browser CSV download
  function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleExportOrders() {
    try {
      setExporting("orders");
      const res = await fetch("/api/restaurant/orders");
      const data = await res.json();
      const orders = data.orders || [];

      const headers = ["Order ID", "Date", "Customer Name", "Phone", "Total (₹)", "Status", "Payment Method"];
      const rows = orders.map((o) => [
        o.orderNumber || o._id,
        new Date(o.createdAt).toLocaleString(),
        `"${o.customer?.name || "Guest"}"`,
        `"${o.customer?.phone || ""}"`,
        o.totalAmount || 0,
        o.status || "pending",
        o.paymentMethod || "COD",
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadCSV(csvContent, `orders_export_${Date.now()}.csv`);
    } catch (err) {
      console.error("Export orders error:", err);
      alert("Failed to export orders.");
    } finally {
      setExporting("");
    }
  }

  async function handleExportProducts() {
    try {
      setExporting("products");
      const res = await fetch("/api/restaurant/products");
      const data = await res.json();
      const products = data.products || [];

      const headers = ["Product Name", "Category", "Price (₹)", "Available", "Preparation Time (min)"];
      const rows = products.map((p) => [
        `"${p.name || ""}"`,
        `"${p.category || ""}"`,
        p.price || 0,
        p.isAvailable ? "Yes" : "No",
        p.prepTimeMinutes || 25,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadCSV(csvContent, `dishes_export_${Date.now()}.csv`);
    } catch (err) {
      console.error("Export products error:", err);
      alert("Failed to export products.");
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Advanced</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Technical parameters, data exports, regional settings, and system safeguards.
        </p>
      </div>

      {/* Warning Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
        <div>
          <span className="font-bold block mb-0.5">For Advanced Use</span>
          These settings are for advanced users. If you are not sure what something does, you can safely leave it unchanged.
        </div>
      </div>

      {/* 1. Regional Settings */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Regional Settings</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Country, currency, and date/time formatting</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Country & Currency
            </label>
            <select
              value={regional.currency || "INR"}
              onChange={(e) => updateRegional("currency", e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="INR">India — Indian Rupee (₹)</option>
              <option value="USD">USA — US Dollar ($)</option>
              <option value="EUR">Europe — Euro (€)</option>
              <option value="GBP">UK — British Pound (£)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Time Zone
            </label>
            <select
              value={regional.timezone || "Asia/Kolkata"}
              onChange={(e) => updateRegional("timezone", e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="Asia/Kolkata">India — IST (UTC+5:30)</option>
              <option value="UTC">UTC / GMT (Universal)</option>
              <option value="America/New_York">USA — Eastern Time</option>
              <option value="Europe/London">UK — GMT/BST</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Date Style
            </label>
            <select
              value={regional.dateFormat || "DD/MM/YYYY"}
              onChange={(e) => updateRegional("dateFormat", e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 25/09/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 09/25/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-09-25)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Time Style
            </label>
            <select
              value={regional.timeFormat || "12-hour"}
              onChange={(e) => updateRegional("timeFormat", e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="12-hour">12-hour (e.g. 10:30 PM)</option>
              <option value="24-hour">24-hour (e.g. 22:30)</option>
            </select>
          </div>
        </div>
      </section>

      {/* 2. Taxes & Surcharges */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Taxes & Packaging Charges</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Order tax calculations and additional handling fees</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Order Tax Calculation
            </label>
            <select
              value={taxSettings.enabled ? "enabled" : "disabled"}
              onChange={(e) => updateTax("enabled", e.target.value === "enabled")}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="disabled">Disabled (No tax added)</option>
              <option value="enabled">Enabled (GST / Tax added)</option>
            </select>
          </div>

          {taxSettings.enabled && (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxSettings.percentage ?? 5}
                  onChange={(e) => updateTax("percentage", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tax Label
                </label>
                <input
                  type="text"
                  value={taxSettings.label || "GST"}
                  onChange={(e) => updateTax("label", e.target.value)}
                  placeholder="GST"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Packaging Fee (₹)
            </label>
            <input
              type="number"
              min="0"
              value={chargeSettings.packagingFee ?? 0}
              onChange={(e) => updateCharge("packagingFee", parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500"
            />
          </div>
        </div>
      </section>

      {/* 3. Integrations Status */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Connected Services</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Payment gateway, media storage, and map services</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <CreditCard className="w-4 h-4 text-orange-500" />
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta?.razorpayConfigured ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                {meta?.razorpayConfigured ? "Connected" : "Simulated"}
              </span>
            </div>
            <div className="text-xs font-bold text-zinc-900 dark:text-white">Razorpay Payments</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Secure checkout gateway</p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <ImageIcon className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                {meta?.cloudinaryConfigured ? "Active" : "Local Storage"}
              </span>
            </div>
            <div className="text-xs font-bold text-zinc-900 dark:text-white">Cloudinary Images</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">High-speed media CDN</p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${form.whatsappNumber ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"}`}>
                {form.whatsappNumber ? "Configured" : "Unset"}
              </span>
            </div>
            <div className="text-xs font-bold text-zinc-900 dark:text-white">WhatsApp Chat</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Direct customer channel</p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <MapPin className="w-4 h-4 text-purple-500" />
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                Active
              </span>
            </div>
            <div className="text-xs font-bold text-zinc-900 dark:text-white">Maps & Location</div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Delivery area calculations</p>
          </div>
        </div>
      </section>

      {/* 4. Data Export */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Data Export</h2>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">Download your orders and menu records as CSV spreadsheets</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Download Orders</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Customer details, dates, and order amounts</div>
            </div>
            <button
              type="button"
              onClick={handleExportOrders}
              disabled={exporting === "orders"}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-orange-600 dark:text-orange-400 text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting === "orders" ? "Exporting..." : "Download CSV"}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Download Menu Dishes</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Dish names, prices, categories, and availability</div>
            </div>
            <button
              type="button"
              onClick={handleExportProducts}
              disabled={exporting === "products"}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-orange-600 dark:text-orange-400 text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting === "products" ? "Exporting..." : "Download CSV"}
            </button>
          </div>
        </div>
      </section>

      {/* 5. Danger Zone */}
      <section className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-red-200 dark:border-red-500/20">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-red-900 dark:text-white">Danger Zone</h2>
            <p className="text-[11px] sm:text-xs text-red-700 dark:text-red-400/80">Reset operational options to system defaults</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-red-200 dark:border-red-500/30">
          <div>
            <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">Reset Preferences to Factory Defaults</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Resets working hours, timing parameters, and charges back to standard system values
            </div>
          </div>
          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="cursor-pointer px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm font-semibold border border-red-500/30 transition-colors w-fit shrink-0"
          >
            Reset to Defaults
          </button>
        </div>
      </section>

      {/* Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#10141f] border border-red-200 dark:border-red-500/40 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">Reset Preferences to Defaults?</h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This will reset your restaurant delivery radius, tax configurations, and operational timing back to standard system defaults. Your menu dishes, orders, and restaurant photos will NOT be deleted.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="cursor-pointer px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetModalOpen(false);
                  onResetDefaults();
                }}
                className="cursor-pointer px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md shadow-red-600/25 transition-all"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
