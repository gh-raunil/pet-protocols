"use client";

import { useEffect, useState } from "react";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Percent,
  Ticket,
  Zap,
} from "lucide-react";

export default function OffersSection() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [kitchenProducts, setKitchenProducts] = useState([]);
  const [kitchenCategories, setKitchenCategories] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    code: "",
    discountType: "percentage",
    discountValue: 10,
    minOrder: 0,
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    isActive: true,
    applyMode: "coupon", // "coupon" (Option A) | "automatic" (Option B)
    targetType: "all", // "all" | "category" | "products"
    targetCategory: "",
    targetProducts: [],
  });

  async function loadOffers() {
    try {
      setLoading(true);
      setError("");
      const [offersRes, prodsRes, catsRes] = await Promise.allSettled([
        fetch("/api/restaurant/offers").then((r) => r.json()),
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/categories").then((r) => r.json()),
      ]);

      if (offersRes.status === "fulfilled" && offersRes.value?.success) {
        setOffers(offersRes.value.offers || []);
      } else if (offersRes.status === "fulfilled") {
        setError(offersRes.value.message || "Failed to load offers.");
      }

      if (prodsRes.status === "fulfilled" && prodsRes.value?.success) {
        setKitchenProducts(prodsRes.value.products || []);
      }

      if (catsRes.status === "fulfilled" && catsRes.value?.success) {
        setKitchenCategories(catsRes.value.categories || []);
      }
    } catch (err) {
      console.error("Load offers error:", err);
      setError("Network error while fetching offers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOffers();
  }, []);

  function handleOpenCreate() {
    setEditingOffer(null);
    setFormData({
      title: "",
      description: "",
      code: "",
      discountType: "percentage",
      discountValue: 10,
      minOrder: 0,
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      isActive: true,
      applyMode: "coupon",
      targetType: "all",
      targetCategory: kitchenCategories[0]?.name || "",
      targetProducts: [],
    });
    setModalOpen(true);
  }

  function handleOpenEdit(offer) {
    setEditingOffer(offer);
    const prodIds = Array.isArray(offer.targetProducts)
      ? offer.targetProducts.map((p) => (typeof p === "object" ? p._id : p))
      : [];

    setFormData({
      title: offer.title || "",
      description: offer.description || "",
      code: offer.code || "",
      discountType: offer.discountType || "percentage",
      discountValue: offer.discountValue ?? 10,
      minOrder: offer.minOrder ?? 0,
      startDate: offer.startDate ? new Date(offer.startDate).toISOString().split("T")[0] : "",
      endDate: offer.endDate ? new Date(offer.endDate).toISOString().split("T")[0] : "",
      isActive: offer.isActive ?? true,
      applyMode: offer.applyMode || (offer.code ? "coupon" : "automatic"),
      targetType: offer.targetType || "all",
      targetCategory: offer.targetCategory || "",
      targetProducts: prodIds,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("Please give your offer a name.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const isEdit = Boolean(editingOffer?._id);
      const url = isEdit
        ? `/api/restaurant/offers/${editingOffer._id}`
        : "/api/restaurant/offers";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(data.message || (isEdit ? "Offer updated!" : "Offer created!"));
        setModalOpen(false);
        loadOffers();
      } else {
        setError(data.message || "Failed to save offer.");
      }
    } catch (err) {
      console.error("Save offer error:", err);
      setError("Failed to save offer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(offer) {
    try {
      const res = await fetch(`/api/restaurant/offers/${offer._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setOffers((prev) =>
          prev.map((o) => (o._id === offer._id ? { ...o, isActive: !offer.isActive } : o))
        );
      }
    } catch (err) {
      console.error("Toggle status error:", err);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to remove this offer?")) return;
    try {
      const res = await fetch(`/api/restaurant/offers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Offer deleted successfully.");
        setOffers((prev) => prev.filter((o) => o._id !== id));
      } else {
        setError(data.message || "Failed to delete offer.");
      }
    } catch (err) {
      console.error("Delete offer error:", err);
      setError("Failed to delete offer.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Offers</h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Create simple offers for your customers.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-semibold shadow-md shadow-orange-500/25 transition-all w-fit cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Offer
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Offers Cards */}
      <section className="bg-white dark:bg-[#10141f]/90 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white">Active Offers</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{offers.length} total</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-zinc-500 text-sm">Loading offers...</div>
        ) : offers.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Tag className="w-8 h-8 text-zinc-400 mx-auto" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No offers created yet.</p>
            <button
              onClick={handleOpenCreate}
              type="button"
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
            >
              + Create your first discount offer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.map((offer) => {
              const isPercent = offer.discountType === "percentage";
              return (
                <div
                  key={offer._id}
                  className={`p-4 sm:p-5 rounded-xl border transition-all ${
                    offer.isActive
                      ? "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/80"
                      : "bg-zinc-100/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-sm shrink-0">
                        {isPercent ? `${offer.discountValue}%` : `₹${offer.discountValue}`}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{offer.title}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {offer.applyMode === "automatic" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-500/20">
                              ⚡ Auto Discount
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 font-mono text-[10px] uppercase font-bold border border-orange-500/20">
                              🎟️ {offer.code || "COUPON"}
                            </span>
                          )}

                          {offer.targetType === "category" ? (
                            <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20">
                              Category: {offer.targetCategory}
                            </span>
                          ) : offer.targetType === "products" ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                              {offer.targetProducts?.length || 0} Dishes
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold">
                              All Dishes
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleStatus(offer)}
                        type="button"
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                          offer.isActive
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {offer.isActive ? "Active" : "Paused"}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(offer)}
                        type="button"
                        className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(offer._id)}
                        type="button"
                        className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-500/20 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {offer.description && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2.5 line-clamp-2">{offer.description}</p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-700/50">
                    <span>Min Order: ₹{offer.minOrder || 0}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {offer.endDate
                        ? `Valid till ${new Date(offer.endDate).toLocaleDateString()}`
                        : "Ongoing"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#10141f] border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-[#10141f]">
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                {editingOffer ? "Edit Offer" : "Create New Offer"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
                {/* 1. Application Mode (Option A vs Option B) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Discount Application Mode <span className="text-orange-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, applyMode: "coupon" })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        formData.applyMode === "coupon"
                          ? "bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500"
                          : "bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-orange-500/40"
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Ticket size={14} className="text-orange-600 dark:text-orange-400 shrink-0" />
                          <span>Option A: Coupon Code</span>
                        </span>
                        {formData.applyMode === "coupon" && <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">✓ Selected</span>}
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        Customer must apply coupon code at checkout to get discount. Catalog price is untouched.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, applyMode: "automatic" })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        formData.applyMode === "automatic"
                          ? "bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500"
                          : "bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-orange-500/40"
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Zap size={14} className="text-amber-500 shrink-0" />
                          <span>Option B: Automatic Discount</span>
                        </span>
                        {formData.applyMode === "automatic" && <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">✓ Selected</span>}
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                        Discount is applied automatically to qualifying dishes without requiring a coupon code.
                      </p>
                    </button>
                  </div>
                </div>

                {/* 2. Target Scope */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Target Scope <span className="text-orange-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, targetType: "all" })}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                        formData.targetType === "all"
                          ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                          : "bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      All Dishes
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, targetType: "category", targetCategory: formData.targetCategory || kitchenCategories[0]?.name || "" })}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                        formData.targetType === "category"
                          ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                          : "bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      By Category
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, targetType: "products" })}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                        formData.targetType === "products"
                          ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                          : "bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Specific Dishes
                    </button>
                  </div>

                  {/* Category Dropdown */}
                  {formData.targetType === "category" && (
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mt-2">
                      <label className="block text-[11px] font-bold text-purple-700 dark:text-purple-300 mb-1">
                        Select Category for Offer
                      </label>
                      <select
                        value={formData.targetCategory}
                        onChange={(e) => setFormData({ ...formData, targetCategory: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-orange-500 cursor-pointer"
                      >
                        <option value="">Select a Category...</option>
                        {kitchenCategories.map((c) => (
                          <option key={c._id || c.name} value={c.name}>
                            {c.icon || "🍽️"} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Products Checklist */}
                  {formData.targetType === "products" && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          Select Qualifying Dishes ({formData.targetProducts.length} selected)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.targetProducts.length === kitchenProducts.length) {
                              setFormData({ ...formData, targetProducts: [] });
                            } else {
                              setFormData({ ...formData, targetProducts: kitchenProducts.map((p) => p._id) });
                            }
                          }}
                          className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          {formData.targetProducts.length === kitchenProducts.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 divide-y divide-zinc-200/50 dark:divide-zinc-700/50">
                        {kitchenProducts.length === 0 ? (
                          <p className="text-xs text-zinc-500 py-2 text-center">No dishes found in menu catalog.</p>
                        ) : (
                          kitchenProducts.map((p) => {
                            const isChecked = formData.targetProducts.includes(p._id);
                            return (
                              <label key={p._id} className="pt-1 flex items-center justify-between text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormData({ ...formData, targetProducts: [...formData.targetProducts, p._id] });
                                      } else {
                                        setFormData({ ...formData, targetProducts: formData.targetProducts.filter((id) => id !== p._id) });
                                      }
                                    }}
                                    className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500"
                                  />
                                  <span className="font-semibold text-zinc-900 dark:text-white line-clamp-1">{p.name}</span>
                                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">({p.category})</span>
                                </div>
                                <span className="font-mono text-zinc-600 dark:text-zinc-300 shrink-0">₹{p.price}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Offer Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. 20% Off Weekend Special"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Offer Details / Terms
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g. Applicable on all delicious burgers"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm focus:border-orange-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Discount Type
                    </label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="percentage">Percentage (e.g. 10% Off)</option>
                      <option value="flat">Flat Amount (e.g. ₹100 Off)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Discount Value {formData.discountType === "percentage" ? "(%)" : "(₹)"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Promo Code {formData.applyMode === "coupon" ? <span className="text-orange-500">*</span> : "(Optional)"}
                    </label>
                    <input
                      type="text"
                      required={formData.applyMode === "coupon"}
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder={formData.applyMode === "coupon" ? "e.g. BURGER20" : "Auto applied (code optional)"}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm font-mono uppercase outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Minimum Order (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minOrder}
                      onChange={(e) => setFormData({ ...formData, minOrder: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs sm:text-sm outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Active right away</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-5 sm:px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/90 dark:bg-[#0c0e17]/90 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-md shadow-orange-500/25 transition-all cursor-pointer"
                >
                  {submitting ? "Saving..." : editingOffer ? "Update Offer" : "Create Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
