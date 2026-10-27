"use client";

import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
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
  Pencil,
  Copy,
  Check,
  Search,
  Sparkles,
  Power,
  ShieldCheck,
  Clock,
  ArrowRight,
  Ticket,
  Zap,
} from "lucide-react";

export default function OffersManager({ restaurants = [] }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all"); // 'all' | 'platform' | 'restaurant'
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingOffer, setEditingOffer] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingOffer, setDeletingOffer] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState(null);
  const [copiedCode, setCopiedCode] = useState("");

  // Create Form State
  const initialFormState = {
    title: "",
    description: "",
    code: "",
    discountType: "percentage",
    discountValue: 15,
    minOrder: 0,
    restaurantId: "",
    startDate: "",
    endDate: "",
    isActive: true,
    applyMode: "coupon", // "coupon" | "automatic"
    targetType: "all", // "all" | "category"
    targetCategory: "",
  };
  const [createForm, setCreateForm] = useState(initialFormState);

  // Edit Form State
  const [editForm, setEditForm] = useState(initialFormState);
  const [availableCategories, setAvailableCategories] = useState([]);

  // Helper to format ISO date to datetime-local input format (YYYY-MM-DDTHH:mm)
  function toDateTimeLocal(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  }

  async function loadOffers(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [offersRes, catsRes] = await Promise.allSettled([
        fetch("/api/superadmin/offers").then((r) => r.json()),
        fetch("/api/superadmin/categories").then((r) => r.json()),
      ]);

      if (offersRes.status === "fulfilled" && offersRes.value?.success && Array.isArray(offersRes.value.offers)) {
        setOffers(offersRes.value.offers);
      } else if (offersRes.status === "fulfilled") {
        toast.error(offersRes.value?.message || "Failed to load offers.");
      }

      if (catsRes.status === "fulfilled" && catsRes.value?.success && Array.isArray(catsRes.value.categories)) {
        setAvailableCategories(catsRes.value.categories);
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error loading offers.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadOffers();
  }, []);

  // Filtered and searched list
  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      // Search text filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const titleMatch = offer.title?.toLowerCase().includes(q);
        const codeMatch = offer.code?.toLowerCase().includes(q);
        const descMatch = offer.description?.toLowerCase().includes(q);
        const restMatch = offer.restaurant?.name?.toLowerCase().includes(q);
        if (!titleMatch && !codeMatch && !descMatch && !restMatch) {
          return false;
        }
      }

      // Scope filter
      if (scopeFilter === "platform" && offer.restaurant) return false;
      if (scopeFilter === "restaurant" && !offer.restaurant) return false;

      // Status filter
      if (statusFilter === "active" && !offer.isActive) return false;
      if (statusFilter === "inactive" && offer.isActive) return false;

      return true;
    });
  }, [offers, search, scopeFilter, statusFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = offers.length;
    const active = offers.filter((o) => o.isActive).length;
    const platform = offers.filter((o) => !o.restaurant).length;
    const specific = offers.filter((o) => !!o.restaurant).length;
    return { total, active, platform, specific };
  }, [offers]);

  // Handle Copy Promo Code
  function handleCopy(code) {
    if (!code) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Coupon code ${code} copied!`);
      setTimeout(() => setCopiedCode(""), 2000);
    }
  }

  // Handle Quick Active/Inactive Toggle
  async function handleToggleActive(offer) {
    const nextState = !offer.isActive;
    setTogglingId(offer._id);

    // Optimistic UI update
    setOffers((prev) =>
      prev.map((o) => (o._id === offer._id ? { ...o, isActive: nextState } : o))
    );

    try {
      const res = await fetch(`/api/superadmin/offers/${offer._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          nextState
            ? `Offer "${offer.title}" activated!`
            : `Offer "${offer.title}" paused.`
        );
      } else {
        // Rollback on failure
        setOffers((prev) =>
          prev.map((o) => (o._id === offer._id ? { ...o, isActive: !nextState } : o))
        );
        toast.error(data.message || "Failed to update offer status.");
      }
    } catch (err) {
      console.error(err);
      // Rollback on network failure
      setOffers((prev) =>
        prev.map((o) => (o._id === offer._id ? { ...o, isActive: !nextState } : o))
      );
      toast.error("Network error toggling offer status.");
    } finally {
      setTogglingId(null);
    }
  }

  // Open Edit Modal
  function handleOpenEdit(offer) {
    setEditingOffer(offer);
    setEditForm({
      title: offer.title || "",
      description: offer.description || "",
      code: offer.code || "",
      discountType: offer.discountType || "percentage",
      discountValue: offer.discountValue ?? 15,
      minOrder: offer.minOrder ?? 0,
      restaurantId: offer.restaurant?._id || offer.restaurant || "",
      startDate: toDateTimeLocal(offer.startDate),
      endDate: toDateTimeLocal(offer.endDate),
      isActive: offer.isActive ?? true,
      applyMode: offer.applyMode || (offer.code ? "coupon" : "automatic"),
      targetType: offer.targetType || "all",
      targetCategory: offer.targetCategory || "",
    });
  }

  // Handle Create Offer
  async function handleCreateOffer(e) {
    e.preventDefault();
    if (!createForm.title.trim()) {
      toast.error("Offer title is required.");
      return;
    }
    if (!createForm.description.trim()) {
      toast.error("Offer description is required.");
      return;
    }
    if (Number(createForm.discountValue) <= 0) {
      toast.error("Discount value must be greater than 0.");
      return;
    }
    if (createForm.applyMode === "coupon" && !createForm.code.trim()) {
      toast.error("Coupon code is required when Option A (Coupon Code) is selected.");
      return;
    }

    try {
      setCreating(true);
      const payload = {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        code: createForm.code ? createForm.code.trim().toUpperCase() : "",
        discountType: createForm.discountType,
        discountValue: Number(createForm.discountValue) || 0,
        minOrder: Math.max(0, Number(createForm.minOrder) || 0),
        restaurantId: createForm.restaurantId || null,
        startDate: createForm.startDate ? new Date(createForm.startDate).toISOString() : null,
        endDate: createForm.endDate ? new Date(createForm.endDate).toISOString() : null,
        isActive: Boolean(createForm.isActive),
        applyMode: createForm.applyMode || "coupon",
        targetType: createForm.targetType || "all",
        targetCategory: createForm.targetCategory || "",
      };

      const res = await fetch("/api/superadmin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Offer launched successfully!");
        setIsCreateOpen(false);
        setCreateForm(initialFormState);
        loadOffers(true);
      } else {
        toast.error(data.message || "Failed to create offer.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create offer. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // Handle Save Edit Offer
  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingOffer) return;
    if (!editForm.title.trim()) {
      toast.error("Offer title is required.");
      return;
    }
    if (!editForm.description.trim()) {
      toast.error("Offer description is required.");
      return;
    }
    if (Number(editForm.discountValue) <= 0) {
      toast.error("Discount value must be greater than 0.");
      return;
    }
    if (editForm.applyMode === "coupon" && !editForm.code.trim()) {
      toast.error("Coupon code is required when Option A (Coupon Code) is selected.");
      return;
    }

    try {
      setSavingEdit(true);
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        code: editForm.code ? editForm.code.trim().toUpperCase() : "",
        discountType: editForm.discountType,
        discountValue: Number(editForm.discountValue) || 0,
        minOrder: Math.max(0, Number(editForm.minOrder) || 0),
        restaurantId: editForm.restaurantId || null,
        startDate: editForm.startDate ? new Date(editForm.startDate).toISOString() : null,
        endDate: editForm.endDate ? new Date(editForm.endDate).toISOString() : null,
        isActive: Boolean(editForm.isActive),
        applyMode: editForm.applyMode || "coupon",
        targetType: editForm.targetType || "all",
        targetCategory: editForm.targetCategory || "",
      };

      const res = await fetch(`/api/superadmin/offers/${editingOffer._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Offer updated successfully!");
        setEditingOffer(null);
        loadOffers(true);
      } else {
        toast.error(data.message || "Failed to update offer.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update offer.");
    } finally {
      setSavingEdit(false);
    }
  }

  // Handle Delete Offer
  async function handleDeleteOffer() {
    if (!deletingOffer) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/superadmin/offers/${deletingOffer._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Offer "${deletingOffer.title}" deleted.`);
        setOffers((prev) => prev.filter((o) => o._id !== deletingOffer._id));
        setDeletingOffer(null);
      } else {
        toast.error(data.message || "Failed to delete offer.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete offer.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <span>Platform Discounts & Promo Codes</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage platform-wide festival promotions and partner-specific voucher deals with live customer controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadOffers(true)}
            disabled={refreshing}
            title="Refresh offers"
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition shadow-xs cursor-pointer"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-indigo-600" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/25 active:scale-98 cursor-pointer"
          >
            <Plus size={15} />
            <span>Create Offer</span>
          </button>
        </div>
      </div>

      {/* ── STATS METRICS ROW ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Offers
          </span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.total}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500 block mb-1">
            Active Deals
          </span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.active}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 block mb-1">
            Platform-Wide
          </span>
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {stats.platform}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 block mb-1">
            Kitchen-Specific
          </span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats.specific}
          </span>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, title, or kitchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-indigo-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Scope Filter */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setScopeFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                scopeFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              All Scope
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("platform")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                scopeFilter === "platform"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Platform-Wide
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("restaurant")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                scopeFilter === "restaurant"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Kitchen Only
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === "active"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === "inactive"
                  ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Paused
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT LIST ───────────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 text-center text-slate-400">
          <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold">Loading promotions & vouchers...</p>
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 mx-auto flex items-center justify-center">
            <Tag size={28} />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {search || scopeFilter !== "all" || statusFilter !== "all"
              ? "No offers match your current filter"
              : "No promotional offers launched yet"}
          </h3>
          <p className="text-xs max-w-sm mx-auto text-slate-500">
            {search || scopeFilter !== "all" || statusFilter !== "all"
              ? "Try resetting your search query or filters to see all active promotions."
              : "Launch your first platform-wide festival discount or partner restaurant voucher to boost order volume."}
          </p>
          <div className="pt-2">
            {search || scopeFilter !== "all" || statusFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setScopeFilter("all");
                  setStatusFilter("all");
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/25 cursor-pointer"
              >
                <Plus size={14} />
                <span>Create First Offer</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOffers.map((offer) => {
            const isPlatform = !offer.restaurant;
            const isToggling = togglingId === offer._id;
            const discountLabel =
              offer.discountType === "flat"
                ? `₹${offer.discountValue} OFF`
                : `${offer.discountValue}% OFF`;

            return (
              <div
                key={offer._id}
                className={`p-5 rounded-3xl bg-white dark:bg-slate-900/80 border transition-all duration-200 shadow-sm flex flex-col justify-between group ${
                  offer.isActive
                    ? "border-slate-200 dark:border-slate-800 hover:border-indigo-400/60"
                    : "border-slate-200/60 dark:border-slate-800/40 opacity-75 bg-slate-50/50 dark:bg-slate-900/40"
                }`}
              >
                <div className="space-y-3.5">
                  {/* Scope & Status Header */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                        isPlatform
                          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
                      }`}
                    >
                      {isPlatform ? (
                        <>
                          <Sparkles size={11} /> Platform-Wide
                        </>
                      ) : (
                        <>
                          <Building size={11} /> {offer.restaurant?.name || "Kitchen Specific"}
                        </>
                      )}
                    </span>

                    {/* Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                        offer.isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          offer.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                        }`}
                      />
                      {offer.isActive ? "Active" : "Paused"}
                    </span>
                  </div>

                  {/* Title and Value */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                      {offer.title}
                    </h3>
                    <div className="shrink-0 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-black font-mono text-sm border border-indigo-200/60 dark:border-indigo-800/50 whitespace-nowrap">
                      {discountLabel}
                    </div>
                  </div>

                  {/* Description */}
                  {offer.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {offer.description}
                    </p>
                  )}

                  {/* Code and Order Details */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {offer.applyMode === "automatic" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                          ⚡ Auto Applied
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                          🎟️ Coupon Required
                        </span>
                      )}

                      {offer.targetType === "category" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          Category: {offer.targetCategory}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          All Catalog
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      {offer.code ? (
                        <button
                          type="button"
                          onClick={() => handleCopy(offer.code)}
                          title="Click to copy promo code"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-800 dark:text-slate-200 hover:border-indigo-400 transition cursor-pointer"
                        >
                          <span>{offer.code}</span>
                          {copiedCode === offer.code ? (
                            <Check size={12} className="text-emerald-500" />
                          ) : (
                            <Copy size={12} className="text-slate-400" />
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-blue-500 font-bold italic">
                          No Code Needed (Auto)
                        </span>
                      )}

                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {offer.minOrder > 0 ? `Min: ₹${offer.minOrder}` : "No min order"}
                      </span>
                    </div>

                    {/* Expiry / End Date Info */}
                    {offer.endDate && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock size={11} className="text-amber-500" />
                        <span>
                          Expires:{" "}
                          {new Date(offer.endDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── CARD ACTION BUTTONS ─────────────────────────────────── */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  {/* Quick Active Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(offer)}
                    disabled={isToggling}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      offer.isActive
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/40"
                    }`}
                  >
                    <Power size={13} className={isToggling ? "animate-spin" : ""} />
                    <span>{offer.isActive ? "Pause" : "Activate"}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(offer)}
                      title="Edit offer details"
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800/40"
                    >
                      <Pencil size={14} />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setDeletingOffer(offer)}
                      title="Delete offer permanently"
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800/40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE OFFER MODAL ────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="fixed inset-0" onClick={() => setIsCreateOpen(false)} />
          <form
            onSubmit={handleCreateOffer}
            className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl z-10 overflow-hidden animate-in fade-in zoom-in-95 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Tag size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    Launch New Promotion
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Create a platform-wide or restaurant-specific offer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Offer Title *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. Weekend Feast Discount or Holi Voucher"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="e.g. Enjoy flat 20% off on your entire food order across all partner kitchens."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                />
              </div>

              {/* Discount Type & Value Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Discount Type *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, discountType: "percentage" })}
                      className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                        createForm.discountType === "percentage"
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <Percent size={12} />
                      <span>Percentage</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, discountType: "flat" })}
                      className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                        createForm.discountType === "flat"
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <IndianRupee size={12} />
                      <span>Flat (₹)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Discount Value {createForm.discountType === "flat" ? "(₹)" : "(%)"} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={createForm.discountValue}
                    onChange={(e) => setCreateForm({ ...createForm, discountValue: e.target.value })}
                    placeholder={createForm.discountType === "flat" ? "e.g. 50" : "e.g. 20"}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* ── DISCOUNT APPLICATION MODE (OPTION A VS OPTION B) ── */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Discount Application Option *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, applyMode: "coupon" })}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      createForm.applyMode === "coupon"
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500"
                        : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400/40"
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Ticket size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>Option A: Coupon Code</span>
                      </span>
                      {createForm.applyMode === "coupon" && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">✓ Selected</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      User MUST enter the code at checkout. Catalog price is not reduced directly.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, applyMode: "automatic" })}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      createForm.applyMode === "automatic"
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500"
                        : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400/40"
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Zap size={14} className="text-amber-500 shrink-0" />
                        <span>Option B: Automatic Discount</span>
                      </span>
                      {createForm.applyMode === "automatic" && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">✓ Selected</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Applies automatically to selected products/category without requiring a coupon code.
                    </p>
                  </button>
                </div>
              </div>

              {/* ── TARGET SCOPE (ALL DISHES VS SPECIFIC CATEGORY) ── */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Product Scope *
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, targetType: "all", targetCategory: "" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                      createForm.targetType === "all"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    All Dishes
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, targetType: "category", targetCategory: createForm.targetCategory || availableCategories[0]?.name || "" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                      createForm.targetType === "category"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    Specific Category
                  </button>
                </div>

                {createForm.targetType === "category" && (
                  <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40">
                    <label className="block text-[11px] font-bold text-purple-800 dark:text-purple-300 mb-1">
                      Select Target Category
                    </label>
                    <select
                      value={createForm.targetCategory}
                      onChange={(e) => setCreateForm({ ...createForm, targetCategory: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                    >
                      <option value="">Select a Category...</option>
                      {availableCategories.map((c) => (
                        <option key={c._id || c.name} value={c.name}>
                          {c.icon || "🍽️"} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Promo Code & Minimum Order Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Promo Code {createForm.applyMode === "coupon" ? "*" : "(Optional for Auto)"}
                  </label>
                  <input
                    type="text"
                    required={createForm.applyMode === "coupon"}
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                    placeholder={createForm.applyMode === "coupon" ? "e.g. FEAST20" : "Auto applied (optional code)"}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white tracking-wider"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {createForm.applyMode === "coupon"
                      ? "Required — customer inputs this code at checkout."
                      : "Optional identifier for reports."}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Minimum Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.minOrder}
                    onChange={(e) => setCreateForm({ ...createForm, minOrder: e.target.value })}
                    placeholder="0 for no minimum"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Set to ₹0 for no minimum cart requirement.
                  </span>
                </div>
              </div>

              {/* Scope (Restaurant or Platform) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Applicability Scope *
                </label>
                <select
                  value={createForm.restaurantId}
                  onChange={(e) => setCreateForm({ ...createForm, restaurantId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                >
                  <option value="">All Partner Restaurants (Platform-Wide Promotion)</option>
                  {restaurants.map((r) => (
                    <option key={r._id || r.id} value={r._id || r.id}>
                      Kitchen: {r.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Select a specific kitchen to limit voucher redemption to their dishes only.
                </span>
              </div>

              {/* Validity Dates (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Active Status Checkbox */}
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="createIsActive"
                  checked={createForm.isActive}
                  onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                />
                <label
                  htmlFor="createIsActive"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Activate immediately upon creation
                </label>
              </div>
            </div>

            <div className="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {creating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Launching...</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    <span>Launch Offer</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── EDIT OFFER MODAL ──────────────────────────────────────────── */}
      {editingOffer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="fixed inset-0" onClick={() => setEditingOffer(null)} />
          <form
            onSubmit={handleSaveEdit}
            className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl z-10 overflow-hidden animate-in fade-in zoom-in-95 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    Edit Offer Details
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Update offer parameters and discount rules
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingOffer(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Offer Title *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="e.g. Weekend Feast Discount"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="e.g. Description of discount promotion"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                />
              </div>

              {/* Discount Type & Value Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Discount Type *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, discountType: "percentage" })}
                      className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                        editForm.discountType === "percentage"
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <Percent size={12} />
                      <span>Percentage</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, discountType: "flat" })}
                      className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                        editForm.discountType === "flat"
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <IndianRupee size={12} />
                      <span>Flat (₹)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Discount Value {editForm.discountType === "flat" ? "(₹)" : "(%)"} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editForm.discountValue}
                    onChange={(e) => setEditForm({ ...editForm, discountValue: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* ── DISCOUNT APPLICATION MODE (OPTION A VS OPTION B) ── */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Discount Application Option *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, applyMode: "coupon" })}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      editForm.applyMode === "coupon"
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500"
                        : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400/40"
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Ticket size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>Option A: Coupon Code</span>
                      </span>
                      {editForm.applyMode === "coupon" && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">✓ Selected</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      User MUST enter the code at checkout. Catalog price is not reduced directly.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, applyMode: "automatic" })}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      editForm.applyMode === "automatic"
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500"
                        : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400/40"
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Zap size={14} className="text-amber-500 shrink-0" />
                        <span>Option B: Automatic Discount</span>
                      </span>
                      {editForm.applyMode === "automatic" && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">✓ Selected</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Applies automatically to selected products/category without requiring a coupon code.
                    </p>
                  </button>
                </div>
              </div>

              {/* ── TARGET SCOPE (ALL DISHES VS SPECIFIC CATEGORY) ── */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Product Scope *
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, targetType: "all", targetCategory: "" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                      editForm.targetType === "all"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    All Dishes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, targetType: "category", targetCategory: editForm.targetCategory || availableCategories[0]?.name || "" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                      editForm.targetType === "category"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    Specific Category
                  </button>
                </div>

                {editForm.targetType === "category" && (
                  <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40">
                    <label className="block text-[11px] font-bold text-purple-800 dark:text-purple-300 mb-1">
                      Select Target Category
                    </label>
                    <select
                      value={editForm.targetCategory}
                      onChange={(e) => setEditForm({ ...editForm, targetCategory: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                    >
                      <option value="">Select a Category...</option>
                      {availableCategories.map((c) => (
                        <option key={c._id || c.name} value={c.name}>
                          {c.icon || "🍽️"} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Promo Code & Minimum Order Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Promo Code {editForm.applyMode === "coupon" ? "*" : "(Optional for Auto)"}
                  </label>
                  <input
                    type="text"
                    required={editForm.applyMode === "coupon"}
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                    placeholder={editForm.applyMode === "coupon" ? "e.g. FEAST20" : "Auto applied (optional code)"}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white tracking-wider"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {editForm.applyMode === "coupon"
                      ? "Required — customer inputs this code at checkout."
                      : "Optional identifier for reports."}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Minimum Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.minOrder}
                    onChange={(e) => setEditForm({ ...editForm, minOrder: e.target.value })}
                    placeholder="0 for no minimum"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Set to ₹0 for no minimum requirement.
                  </span>
                </div>
              </div>

              {/* Scope (Restaurant or Platform) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Applicability Scope *
                </label>
                <select
                  value={editForm.restaurantId}
                  onChange={(e) => setEditForm({ ...editForm, restaurantId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-slate-900 dark:text-white"
                >
                  <option value="">All Partner Restaurants (Platform-Wide)</option>
                  {restaurants.map((r) => (
                    <option key={r._id || r.id} value={r._id || r.id}>
                      Kitchen: {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Active Status Checkbox */}
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                />
                <label
                  htmlFor="editIsActive"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Active promotion status
                </label>
              </div>
            </div>

            <div className="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setEditingOffer(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingEdit ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ─────────────────────────────────── */}
      {deletingOffer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Delete Promotion Offer?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <strong className="text-slate-900 dark:text-white">
                  &ldquo;{deletingOffer.title}&rdquo;
                </strong>{" "}
                {deletingOffer.code ? `(Code: ${deletingOffer.code})` : ""}? Customers will immediately
                lose access to this discount voucher.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Discount:</span>
                <span className="font-bold font-mono">
                  {deletingOffer.discountType === "flat"
                    ? `₹${deletingOffer.discountValue} OFF`
                    : `${deletingOffer.discountValue}% OFF`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Scope:</span>
                <span>
                  {deletingOffer.restaurant?.name
                    ? `Kitchen: ${deletingOffer.restaurant.name}`
                    : "Platform-Wide"}
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingOffer(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteOffer}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
