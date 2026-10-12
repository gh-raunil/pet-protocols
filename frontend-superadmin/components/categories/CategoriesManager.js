"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import {
  FolderTree,
  Plus,
  RefreshCw,
  X,
  Trash2,
  Pencil,
  Search,
  Power,
  Store,
  Grid,
  List,
  Upload,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  Globe,
} from "lucide-react";

export const PRESET_FOOD_PHOTOS = [
  { label: "Burgers", url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80", icon: "🍔" },
  { label: "Pizza", url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80", icon: "🍕" },
  { label: "Fries & Sides", url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&auto=format&fit=crop&q=80", icon: "🍟" },
  { label: "Cold Drinks", url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80", icon: "🥤" },
  { label: "Momos & Dumplings", url: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop&q=80", icon: "🥟" },
  { label: "Soups", url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80", icon: "🍲" },
  { label: "Desserts & Shakes", url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&auto=format&fit=crop&q=80", icon: "🍰" },
  { label: "Biryani & Rice", url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80", icon: "🍛" },
  { label: "Pasta & Noodles", url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80", icon: "🍜" },
  { label: "Sandwiches & Wraps", url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80", icon: "🥪" },
  { label: "Salads & Greens", url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80", icon: "🥗" },
  { label: "Coffee & Tea", url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80", icon: "☕" },
];

export const PRESET_ICONS = [
  "🍽️", "🍔", "🍕", "🍟", "🍜", "🥗", "🍰", "☕",
  "🥤", "🍱", "🌮", "🍣", "🍦", "🍩", "🥟", "🍛",
  "🍲", "🥪", "🥩", "🥞", "🧇", "🍗", "🌯", "🥓",
  "🧋", "🍹", "🥣", "🍿", "🍳", "🥖",
];

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoriesManager({ restaurants = [] }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("restaurant") || "all";
    }
    return "all";
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingCategory, setEditingCategory] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [togglingId, setTogglingId] = useState(null);

  // Create Form State
  const initialFormState = {
    name: "",
    slug: "",
    icon: "🍽️",
    description: "",
    image: "",
    restaurantId: "",
    isActive: true,
  };
  const [createForm, setCreateForm] = useState(initialFormState);
  const [createImageTab, setCreateImageTab] = useState("upload"); // 'upload' | 'preset' | 'url'
  const [showCreateEmojiPicker, setShowCreateEmojiPicker] = useState(false);
  const createFileInputRef = useRef(null);

  // Edit Form State
  const [editForm, setEditForm] = useState(initialFormState);
  const [editImageTab, setEditImageTab] = useState("upload"); // 'upload' | 'preset' | 'url'
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  const editFileInputRef = useRef(null);

  async function loadCategories(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const params = new URLSearchParams();
      if (restaurantFilter !== "all") params.set("restaurant", restaurantFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const url = `/api/superadmin/categories?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
      } else {
        toast.error(data.message || "Failed to load categories.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error loading categories.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, [restaurantFilter, statusFilter]);

  // Handle Search Input Filtered List
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.restaurantName && c.restaurantName.toLowerCase().includes(q))
    );
  }, [categories, search]);

  // Statistics calculation — strictly Category metrics, zero dishes
  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.isActive).length;
    const inactive = categories.filter((c) => !c.isActive).length;
    const platformWide = categories.filter((c) => !c.restaurant || c.restaurantName === "Platform-Wide").length;
    const restaurantSpecific = total - platformWide;

    return { total, active, inactive, platformWide, restaurantSpecific };
  }, [categories]);

  // Helper for client-side image processing and compression
  function processImageFile(file, callback) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File is larger than 8MB. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1000;
        const maxHeight = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        callback(dataUrl);
        toast.success("Image selected & optimized!");
      };
      img.onerror = () => {
        toast.error("Invalid image format.");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Quick Active/Inactive Toggle
  async function handleToggleActive(category) {
    const nextState = !category.isActive;
    setTogglingId(category._id);

    // Optimistic UI update
    setCategories((prev) =>
      prev.map((c) => (c._id === category._id ? { ...c, isActive: nextState } : c))
    );

    try {
      const res = await fetch(`/api/superadmin/categories/${category._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: category.name,
          isActive: nextState,
          oldCategoryName: category.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          nextState
            ? `Category "${category.name}" is now active!`
            : `Category "${category.name}" paused.`
        );
      } else {
        // Rollback
        setCategories((prev) =>
          prev.map((c) => (c._id === category._id ? { ...c, isActive: !nextState } : c))
        );
        toast.error(data.message || "Failed to update category status.");
      }
    } catch (err) {
      console.error(err);
      setCategories((prev) =>
        prev.map((c) => (c._id === category._id ? { ...c, isActive: !nextState } : c))
      );
      toast.error("Network error updating status.");
    } finally {
      setTogglingId(null);
    }
  }

  // Open Edit Modal
  function handleOpenEdit(category) {
    setShowEditEmojiPicker(false);
    setEditingCategory(category);
    setEditForm({
      name: category.name || "",
      slug: category.slug || slugify(category.name || ""),
      icon: category.icon || "🍽️",
      description: category.description || "",
      image: category.image || "",
      restaurantId: category.restaurant || "",
      isActive: category.isActive !== false,
      oldCategoryName: category.name,
    });
    setEditImageTab(category.image ? "upload" : "preset");
  }

  // Handle Create Category
  async function handleCreateCategory(e) {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error("Category name is required.");
      return;
    }

    try {
      setCreating(true);
      const payload = {
        name: createForm.name.trim(),
        slug: createForm.slug.trim() || slugify(createForm.name),
        icon: createForm.icon || "🍽️",
        description: createForm.description.trim(),
        image: createForm.image.trim(),
        restaurantId: createForm.restaurantId || null,
        isActive: Boolean(createForm.isActive),
      };

      const res = await fetch("/api/superadmin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Category created successfully!");
        setIsCreateOpen(false);
        setShowCreateEmojiPicker(false);
        setCreateForm(initialFormState);
        loadCategories(true);
      } else {
        toast.error(data.message || "Failed to create category.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create category. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // Handle Edit Category Save
  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error("Category name is required.");
      return;
    }

    try {
      setSavingEdit(true);
      const payload = {
        name: editForm.name.trim(),
        slug: editForm.slug.trim() || slugify(editForm.name),
        icon: editForm.icon || "🍽️",
        description: editForm.description.trim(),
        image: editForm.image.trim(),
        restaurantId: editForm.restaurantId || null,
        isActive: Boolean(editForm.isActive),
        oldCategoryName: editingCategory?.name,
      };

      const res = await fetch(`/api/superadmin/categories/${editingCategory._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Category updated successfully!");
        setEditingCategory(null);
        setShowEditEmojiPicker(false);
        loadCategories(true);
      } else {
        toast.error(data.message || "Failed to update category.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update category. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  // Handle Delete Category
  async function handleDeleteCategory() {
    if (!deletingCategory) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/superadmin/categories/${deletingCategory._id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Category deleted successfully!");
        setDeletingCategory(null);
        loadCategories(true);
      } else {
        toast.error(data.message || "Failed to delete category.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete category.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 pt-1" data-purpose="categories-management-module">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <FolderTree size={16} />
            <span>Category Catalog</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            Category Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            View, add, and update global & restaurant categories with custom cover photos.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => loadCategories(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 text-xs font-semibold flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-xs"
            title="Refresh Categories"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-indigo-500" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateForm(initialFormState);
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* ── METRIC STAT CARDS ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Categories
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
            {stats.total}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Platform master catalog</span>
        </div>

        <div className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Active
          </span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
            {stats.active}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Visible on user menus</span>
        </div>

        <div className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider block">
            Inactive
          </span>
          <span className="text-2xl font-bold text-rose-500 dark:text-rose-400 mt-1 block">
            {stats.inactive}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Paused / Hidden</span>
        </div>

        <div className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
            Platform-Wide
          </span>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
            {stats.platformWide}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Universal across kitchens</span>
        </div>

        <div className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            Kitchen-Specific
          </span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">
            {stats.restaurantSpecific}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Scoped to individual partner</span>
        </div>
      </div>

      {/* ── FILTER & SEARCH CONTROLS ────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category name, description, restaurant..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Restaurant Filter Dropdown */}
          <select
            value={restaurantFilter}
            onChange={(e) => setRestaurantFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
          >
            <option value="all">All Kitchens & Platform</option>
            <option value="platform">Platform-Wide Only</option>
            {restaurants.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              viewMode === "grid"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Grid Cards"
          >
            <Grid size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              viewMode === "table"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
            title="Table View"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* ── CATEGORIES LIST / GRID ──────────────────────────────── */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Loading Categories...
          </p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <FolderTree size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            No Categories Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
            {search || restaurantFilter !== "all" || statusFilter !== "all"
              ? "No categories match the active filter criteria. Try clearing search filters."
              : "No categories have been launched yet. Click the button below to add your first category!"}
          </p>
          <button
            type="button"
            onClick={() => {
              setCreateForm(initialFormState);
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer"
          >
            + Add Category
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* ── GRID CARDS VIEW (CLEAN CATEGORIES ONLY - NO DISHES) ──── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCategories.map((category) => {
            const isToggling = togglingId === category._id;
            const isPlatform = !category.restaurant || category.restaurantName === "Platform-Wide";

            return (
              <div
                key={category._id}
                className={`bg-white dark:bg-slate-900/60 rounded-2xl border transition hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  category.isActive
                    ? "border-slate-200/90 dark:border-slate-800"
                    : "border-slate-200 dark:border-slate-800/60 opacity-80"
                }`}
              >
                {/* Category Cover Image Header */}
                <div className="relative h-36 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-slate-100 dark:border-slate-800 flex items-center justify-center">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-slate-800 dark:to-indigo-950/30 flex items-center justify-center">
                      <span className="text-4xl">{category.icon || "🍽️"}</span>
                    </div>
                  )}

                  {/* Icon Badge overlay */}
                  <div className="absolute top-3 left-3 w-10 h-10 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-xl shadow-xs">
                    {category.icon || "🍽️"}
                  </div>

                  {/* Status chip top right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border backdrop-blur-md shadow-xs ${
                        category.isActive
                          ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                          : "bg-slate-900/60 border-slate-500/30 text-white"
                      }`}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                        {category.name}
                      </h3>
                      {/* Slug */}
                      <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-500/20 shrink-0">
                        /{category.slug}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed min-h-[2rem]">
                      {category.description || "Platform menu category"}
                    </p>

                    {/* Category Scope */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">Scope:</span>
                      <span
                        className={`font-semibold text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                          isPlatform
                            ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                        }`}
                      >
                        {isPlatform ? <Globe size={11} /> : <Store size={11} />}
                        <span className="truncate max-w-[140px]">{category.restaurantName}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5 mt-2">
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleActive(category)}
                      className={`text-xs font-semibold py-1.5 px-2.5 rounded-xl border flex items-center gap-1 transition cursor-pointer disabled:opacity-50 ${
                        category.isActive
                          ? "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                      }`}
                      title={category.isActive ? "Pause Category" : "Activate Category"}
                    >
                      <Power size={12} className={isToggling ? "animate-spin" : ""} />
                      <span>{category.isActive ? "Pause" : "Activate"}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(category)}
                        className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
                      >
                        <Pencil size={12} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingCategory(category)}
                        className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 transition cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ──────────────────────────────────────────── */
        <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCategories.map((cat) => (
                  <tr key={cat._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                          {cat.image ? (
                            <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">{cat.icon || "🍽️"}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {cat.name}
                            </span>
                            <span className="text-xs">{cat.icon}</span>
                          </div>
                          <span className="text-slate-400 text-[11px] truncate max-w-xs block">
                            {cat.description || "No description"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400">
                      /{cat.slug}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <Store size={11} className="text-slate-400" />
                        {cat.restaurantName}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          cat.isActive
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-500/10 border-slate-500/30 text-slate-500"
                        }`}
                      >
                        {cat.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(cat)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                          title={cat.isActive ? "Pause" : "Activate"}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cat)}
                          className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCategory(cat)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CREATE CATEGORY MODAL ───────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Fixed Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                    Add New Category
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Add category to master food catalog with cover image
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setShowCreateEmojiPicker(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Container */}
            <form onSubmit={handleCreateCategory} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* Category Name & Integrated Emoji Button */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Category Name & Icon <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Emoji Button with Popover */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCreateEmojiPicker((prev) => !prev)}
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-indigo-400 transition cursor-pointer shrink-0 shadow-xs"
                        title="Click to select category icon"
                      >
                        {createForm.icon || "🍽️"}
                      </button>

                      {showCreateEmojiPicker && (
                        <div className="absolute top-full left-0 mt-1.5 z-40 w-64 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Choose Icon</span>
                            <button
                              type="button"
                              onClick={() => setShowCreateEmojiPicker(false)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto p-0.5">
                            {PRESET_ICONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  setCreateForm((prev) => ({ ...prev, icon: emoji }));
                                  setShowCreateEmojiPicker(false);
                                }}
                                className={`h-8 rounded-lg text-lg flex items-center justify-center hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer ${
                                  createForm.icon === emoji
                                    ? "bg-indigo-100 dark:bg-indigo-900/50 ring-1 ring-indigo-500"
                                    : ""
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Custom:</span>
                            <input
                              type="text"
                              maxLength={4}
                              value={createForm.icon}
                              onChange={(e) => setCreateForm((prev) => ({ ...prev, icon: e.target.value }))}
                              className="w-12 text-center py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Name input */}
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setCreateForm((prev) => ({
                          ...prev,
                          name,
                          slug: prev.slug === slugify(prev.name) ? slugify(name) : prev.slug,
                        }));
                      }}
                      placeholder="e.g. Gourmet Burgers, Cold Drinks"
                      className="flex-1 h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* URL Slug inline row */}
                  <div className="flex items-center gap-1.5 px-1 pt-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Slug:
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">/category/</span>
                    <input
                      type="text"
                      value={createForm.slug}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="gourmet-burgers"
                      className="flex-1 h-6 px-1.5 text-[11px] font-mono bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:outline-none text-slate-700 dark:text-slate-300"
                    />
                  </div>
                </div>

                {/* Scope / Restaurant Assignment */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Scope / Restaurant Assignment
                  </label>
                  <select
                    value={createForm.restaurantId}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, restaurantId: e.target.value }))}
                    className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">Platform-Wide (Universal for all partner restaurants)</option>
                    {restaurants.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name} ({r.cuisineType || "Restaurant"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Cover Photo Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Category Cover Photo
                    </label>
                    {createForm.image && (
                      <button
                        type="button"
                        onClick={() => setCreateForm((prev) => ({ ...prev, image: "" }))}
                        className="text-[11px] text-rose-500 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <X size={11} /> Remove photo
                      </button>
                    )}
                  </div>

                  {/* Sub-tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setCreateImageTab("upload")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        createImageTab === "upload"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Upload size={13} />
                      <span>Upload Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateImageTab("preset")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        createImageTab === "preset"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <ImageIcon size={13} />
                      <span>Photo Presets</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateImageTab("url")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        createImageTab === "url"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <span>Image URL</span>
                    </button>
                  </div>

                  {/* Image Tab 1: Upload from device */}
                  {createImageTab === "upload" && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                      <input
                        ref={createFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            processImageFile(file, (dataUrl) => {
                              setCreateForm((prev) => ({ ...prev, image: dataUrl }));
                            });
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => createFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs cursor-pointer"
                      >
                        <Upload size={13} className="text-indigo-500" />
                        <span>Choose file from device</span>
                      </button>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Supports JPG, PNG, WEBP. Optimized automatically.
                      </p>
                    </div>
                  )}

                  {/* Image Tab 2: Photo Presets */}
                  {createImageTab === "preset" && (
                    <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700">
                      {PRESET_FOOD_PHOTOS.map((preset) => {
                        const isSelected = createForm.image === preset.url;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setCreateForm((prev) => ({
                                ...prev,
                                image: preset.url,
                                icon: preset.icon || prev.icon,
                              }));
                            }}
                            className={`relative rounded-lg overflow-hidden border text-left p-1 transition cursor-pointer group ${
                              isSelected
                                ? "border-indigo-600 ring-2 ring-indigo-500/30"
                                : "border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                            }`}
                          >
                            <div className="h-11 w-full rounded overflow-hidden relative">
                              <img
                                src={preset.url}
                                alt={preset.label}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-indigo-600/50 flex items-center justify-center text-white">
                                  <Check size={14} className="stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200 mt-1 block truncate">
                              {preset.icon} {preset.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Image Tab 3: URL input */}
                  {createImageTab === "url" && (
                    <input
                      type="url"
                      value={createForm.image}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, image: e.target.value }))}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    />
                  )}

                  {/* Selected Image Compact Preview */}
                  {createForm.image && (
                    <div className="relative h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img
                        src={createForm.image}
                        alt="Category Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2">
                        <span className="text-white text-xs font-bold drop-shadow-sm flex items-center gap-1.5">
                          <span>{createForm.icon || "🍽️"}</span>
                          <span>{createForm.name || "Preview"}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description for customer menu..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white resize-none"
                  />
                </div>

                {/* Active Toggle */}
                <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Make category active immediately on menu
                  </span>
                </label>
              </div>

              {/* Pinned / Fixed Footer */}
              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-end gap-2 bg-slate-50/80 dark:bg-slate-950/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setShowCreateEmojiPicker(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {creating && <RefreshCw size={12} className="animate-spin" />}
                  <span>{creating ? "Creating..." : "Create Category"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT CATEGORY MODAL ─────────────────────────────────── */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Fixed Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                    Edit Category: {editingCategory.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update category name, cover photo, icon and scope
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setShowEditEmojiPicker(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Container */}
            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* Category Name & Integrated Emoji Button */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Category Name & Icon <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Emoji Button with Popover */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEditEmojiPicker((prev) => !prev)}
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-indigo-400 transition cursor-pointer shrink-0 shadow-xs"
                        title="Choose category emoji icon"
                      >
                        {editForm.icon || "🍽️"}
                      </button>

                      {showEditEmojiPicker && (
                        <div className="absolute top-full left-0 mt-1.5 z-40 w-64 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Choose Icon</span>
                            <button
                              type="button"
                              onClick={() => setShowEditEmojiPicker(false)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto p-0.5">
                            {PRESET_ICONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  setEditForm((prev) => ({ ...prev, icon: emoji }));
                                  setShowEditEmojiPicker(false);
                                }}
                                className={`h-8 rounded-lg text-lg flex items-center justify-center hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer ${
                                  editForm.icon === emoji
                                    ? "bg-indigo-100 dark:bg-indigo-900/50 ring-1 ring-indigo-500"
                                    : ""
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">Custom:</span>
                            <input
                              type="text"
                              maxLength={4}
                              value={editForm.icon}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, icon: e.target.value }))}
                              className="w-12 text-center py-0.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Name input */}
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setEditForm((prev) => ({
                          ...prev,
                          name,
                          slug: prev.slug === slugify(prev.name) ? slugify(name) : prev.slug,
                        }));
                      }}
                      className="flex-1 h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* URL Slug inline row */}
                  <div className="flex items-center gap-1.5 px-1 pt-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Slug:
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">/category/</span>
                    <input
                      type="text"
                      value={editForm.slug}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="gourmet-burgers"
                      className="flex-1 h-6 px-1.5 text-[11px] font-mono bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:outline-none text-slate-700 dark:text-slate-300"
                    />
                  </div>
                </div>

                {/* Scope / Restaurant Assignment */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Scope / Restaurant Assignment
                  </label>
                  <select
                    value={editForm.restaurantId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, restaurantId: e.target.value }))}
                    className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">Platform-Wide (Universal for all partner restaurants)</option>
                    {restaurants.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name} ({r.cuisineType || "Restaurant"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Cover Photo Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Category Cover Photo
                    </label>
                    {editForm.image && (
                      <button
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, image: "" }))}
                        className="text-[11px] text-rose-500 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <X size={11} /> Remove photo
                      </button>
                    )}
                  </div>

                  {/* Sub-tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditImageTab("upload")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        editImageTab === "upload"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Upload size={13} />
                      <span>Upload Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditImageTab("preset")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        editImageTab === "preset"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <ImageIcon size={13} />
                      <span>Photo Presets</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditImageTab("url")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        editImageTab === "url"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <span>Image URL</span>
                    </button>
                  </div>

                  {/* Image Tab 1: Upload from device */}
                  {editImageTab === "upload" && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            processImageFile(file, (dataUrl) => {
                              setEditForm((prev) => ({ ...prev, image: dataUrl }));
                            });
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs cursor-pointer"
                      >
                        <Upload size={13} className="text-indigo-500" />
                        <span>Choose file from device</span>
                      </button>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Supports JPG, PNG, WEBP. Optimized automatically.
                      </p>
                    </div>
                  )}

                  {/* Image Tab 2: Photo Presets */}
                  {editImageTab === "preset" && (
                    <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700">
                      {PRESET_FOOD_PHOTOS.map((preset) => {
                        const isSelected = editForm.image === preset.url;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setEditForm((prev) => ({
                                ...prev,
                                image: preset.url,
                                icon: preset.icon || prev.icon,
                              }));
                            }}
                            className={`relative rounded-lg overflow-hidden border text-left p-1 transition cursor-pointer group ${
                              isSelected
                                ? "border-indigo-600 ring-2 ring-indigo-500/30"
                                : "border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                            }`}
                          >
                            <div className="h-11 w-full rounded overflow-hidden relative">
                              <img
                                src={preset.url}
                                alt={preset.label}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-indigo-600/50 flex items-center justify-center text-white">
                                  <Check size={14} className="stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200 mt-1 block truncate">
                              {preset.icon} {preset.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Image Tab 3: URL input */}
                  {editImageTab === "url" && (
                    <input
                      type="url"
                      value={editForm.image}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, image: e.target.value }))}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    />
                  )}

                  {/* Selected Image Compact Preview */}
                  {editForm.image && (
                    <div className="relative h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img
                        src={editForm.image}
                        alt="Category Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2">
                        <span className="text-white text-xs font-bold drop-shadow-sm flex items-center gap-1.5">
                          <span>{editForm.icon || "🍽️"}</span>
                          <span>{editForm.name || "Preview"}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description for customer menu..."
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white resize-none"
                  />
                </div>

                {/* Active Toggle */}
                <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Category is Active (visible to customers & kitchen staff)
                  </span>
                </label>
              </div>

              {/* Pinned / Fixed Footer */}
              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-end gap-2 bg-slate-50/80 dark:bg-slate-950/80">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setShowEditEmojiPicker(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {savingEdit && <RefreshCw size={12} className="animate-spin" />}
                  <span>{savingEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CATEGORY CONFIRMATION MODAL ──────────────────── */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 my-auto animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Delete Category: "{deletingCategory.name}"?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to remove this category from the platform catalog?
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteCategory}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {deleting && <RefreshCw size={12} className="animate-spin" />}
                <span>{deleting ? "Deleting..." : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
