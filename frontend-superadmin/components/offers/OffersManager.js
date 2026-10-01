"use client";

import { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Percent,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building,
  Calendar,
  IndianRupee,
  X,
  Trash2,
} from "lucide-react";

export default function OffersManager({ restaurants = [] }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const [form, setForm] = useState({
    title: "",
    description: "",
    code: "",
    discountType: "percentage",
    discountValue: 15,
    minOrder: 199,
    restaurantId: "",
    isActive: true,
  });

  async function loadOffers(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const res = await fetch("/api/superadmin/offers");
      const data = await res.json();
      if (data.success && Array.isArray(data.offers)) {
        setOffers(data.offers);
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to load offers." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Network error loading offers." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOffers();
  }, []);

  async function handleCreateOffer(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setFeedback({ type: "error", message: "Please provide offer title and description." });
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/superadmin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "Offer created successfully!" });
        setIsModalOpen(false);
        setForm({
          title: "",
          description: "",
          code: "",
          discountType: "percentage",
          discountValue: 15,
          minOrder: 199,
          restaurantId: "",
          isActive: true,
        });
        loadOffers(true);
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to create offer." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to create offer." });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Platform Discounts & Promo Codes</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create platform-wide festival discounts or tenant-specific culinary voucher deals.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadOffers(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/20"
          >
            <Plus size={14} />
            <span>Create Offer</span>
          </button>
        </div>
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
          <p className="text-xs font-semibold">Loading offers...</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-400">
          <Tag size={32} className="mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Offers Active</h3>
          <p className="text-xs mt-1">Tap &apos;Create Offer&apos; to launch your first promotional deal.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {offers.map((offer) => (
            <div
              key={offer._id}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-indigo-400/50 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 mb-1.5">
                    {offer.restaurant?.name ? `Restaurant: ${offer.restaurant.name}` : "Platform-Wide"}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {offer.title}
                  </h3>
                </div>
                <div className="shrink-0 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-black font-mono text-sm">
                  {offer.discountType === "percentage" ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`}
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {offer.description}
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 tracking-wider">
                  {offer.code || "NO CODE REQUIRED"}
                </span>
                <span className="text-[11px] text-slate-400">
                  Min order: ₹{offer.minOrder || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE OFFER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateOffer}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Launch New Offer</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Offer Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Weekend Feast Discount"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Get 20% off on all pizzas and burgers this weekend only."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Promo Code
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. FEAST20"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Scope (Platform or Specific Restaurant)
                </label>
                <select
                  value={form.restaurantId}
                  onChange={(e) => setForm({ ...form, restaurantId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                >
                  <option value="">All Restaurants (Platform-Wide)</option>
                  {restaurants.map((r) => (
                    <option key={r._id || r.id} value={r._id || r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                {creating ? "Launching..." : "Launch Offer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
