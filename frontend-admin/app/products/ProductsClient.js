"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import {
  UtensilsCrossed,
  PlusCircle,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ToggleLeft,
  ToggleRight,
  Upload,
  Image as ImageIcon,
  Clock,
} from "lucide-react";

export default function ProductsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const STANDARD_CATEGORIES = ["Burger", "Pizza", "Fries", "Momos", "Cold Drinks", "Desserts", "Sides"];
  const MODAL_CATEGORIES = [...STANDARD_CATEGORIES, "Other"];

  // Dynamically include any custom categories in the filter bar
  const allCategories = useMemo(() => {
    const customCats = products
      .map((p) => p.category)
      .filter((c) => c && !STANDARD_CATEGORIES.includes(c));
    return ["All", ...STANDARD_CATEGORIES, ...Array.from(new Set(customCats))];
  }, [products]);

  // Modal State for Add / Edit Product
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalForm, setModalForm] = useState({
    _id: "",
    name: "",
    description: "",
    price: "",
    image: "",
    category: "Burger",
    customCategory: "",
    type: "veg",
    preparationTime: 15,
    isAvailable: true,
    isFeatured: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageMode, setImageMode] = useState("file"); // "file" | "url"
  const fileInputRef = useRef(null);

  // Route protection
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  async function loadProducts() {
    try {
      setLoading(true);
      const res = await fetch("/api/restaurant/products");
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to load products." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user) {
      loadProducts();
    }
  }, [session]);

  // Open modal for new product
  function openAddModal() {
    setIsEditing(false);
    setImageMode("file");
    setModalForm({
      _id: "",
      name: "",
      description: "",
      price: "",
      image: "",
      category: "Burger",
      customCategory: "",
      type: "veg",
      preparationTime: 15,
      isAvailable: true,
      isFeatured: false,
    });
    setIsModalOpen(true);
  }

  // Open modal for editing existing product
  function openEditModal(product) {
    setIsEditing(true);
    setImageMode(product.image?.startsWith("http") ? "url" : "file");
    const isStandard = STANDARD_CATEGORIES.includes(product.category);
    setModalForm({
      _id: product._id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      image: product.image,
      category: isStandard ? product.category : "Other",
      customCategory: isStandard ? "" : (product.category || ""),
      type: product.type || "veg",
      preparationTime: product.preparationTime || 15,
      isAvailable: product.isAvailable !== false,
      isFeatured: !!product.isFeatured,
    });
    setIsModalOpen(true);
  }

  // Handle image upload from device
  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setFeedback({ type: "error", message: "Only JPEG, PNG, and WebP images are allowed." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Image exceeds 5 MB limit. Please select a smaller photo." });
      return;
    }

    try {
      setUploadingImage(true);
      // Instant local preview
      const localPreview = URL.createObjectURL(file);
      setModalForm((prev) => ({ ...prev, image: localPreview }));

      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/restaurant/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.imageUrl) {
        setModalForm((prev) => ({ ...prev, image: data.imageUrl }));
        setFeedback({ type: "success", message: "Dish photo uploaded from device successfully!" });
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to upload image." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Error uploading image from device." });
    } finally {
      setUploadingImage(false);
    }
  }

  // Save Product (Create or Update)
  async function handleSaveProduct(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFeedback({ type: "", message: "" });

      const finalCategory = modalForm.category === "Other"
        ? modalForm.customCategory.trim()
        : modalForm.category;

      if (modalForm.category === "Other" && !finalCategory) {
        setFeedback({ type: "error", message: "Please specify the custom category name." });
        setSubmitting(false);
        return;
      }

      const payload = {
        name: modalForm.name.trim(),
        description: modalForm.description?.trim() || "",
        price: Number(modalForm.price),
        image: modalForm.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
        category: finalCategory,
        type: modalForm.type,
        preparationTime: Number(modalForm.preparationTime) || 15,
        isAvailable: modalForm.isAvailable !== false,
        isFeatured: Boolean(modalForm.isFeatured),
      };

      const url = isEditing
        ? `/api/restaurant/products/${modalForm._id}`
        : "/api/restaurant/products";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        setFeedback({ type: "error", message: data.message || "Failed to save product." });
        return;
      }

      setFeedback({
        type: "success",
        message: isEditing
          ? `Product "${payload.name}" updated successfully!`
          : `Product "${payload.name}" created and added to your menu!`,
      });

      setIsModalOpen(false);
      await loadProducts();
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Error saving product." });
    } finally {
      setSubmitting(false);
    }
  }

  // Quick toggle product availability
  async function handleToggleAvailability(product) {
    try {
      const newAvailability = !product.isAvailable;
      const res = await fetch(`/api/restaurant/products/${product._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: newAvailability }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts((prev) =>
          prev.map((p) => (p._id === product._id ? { ...p, isAvailable: newAvailability } : p))
        );
        setFeedback({
          type: "success",
          message: `"${product.name}" is now marked as ${newAvailability ? "AVAILABLE" : "OUT OF STOCK"}.`,
        });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to update availability." });
    }
  }

  // Delete Product
  async function handleDeleteProduct(product) {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete "${product.name}" from your restaurant menu?`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/restaurant/products/${product._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: `Deleted "${product.name}" successfully.` });
        setProducts((prev) => prev.filter((p) => p._id !== product._id));
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to delete product." });
    }
  }

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      {/* Soft warm ambient background glow for light mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-100/60 via-amber-50/30 to-transparent dark:from-orange-500/5 dark:via-transparent dark:to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      <main className="pt-28 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-stone-200/80 dark:border-white/10 pb-6">
          <div>
            <span className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
              Menu Catalog
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white mt-1">
              Restaurant <span className="text-orange-500">Dishes</span>
            </h1>
            <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
              Add dishes, update pricing, and toggle instant availability for customers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/products/availability"
              className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 dark:bg-white/10 dark:hover:bg-white/15 transition text-stone-700 dark:text-stone-200 px-4 py-2.5 rounded-xl text-sm font-semibold border border-stone-200 dark:border-white/10 active:scale-95"
            >
              <CheckCircle2 size={16} className="text-emerald-500" /> Menu Availability
            </Link>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 transition text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 active:scale-95"
            >
              <PlusCircle size={18} /> Add Dish
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`mb-6 p-4 rounded-2xl flex items-center justify-between border ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
              )}
              <p className="text-sm font-medium">{feedback.message}</p>
            </div>
            <button
              onClick={() => setFeedback({ type: "", message: "" })}
              className="text-xs opacity-70 hover:opacity-100 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white/90 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm shadow-stone-200/40 dark:shadow-none">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 text-stone-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:border-orange-500 outline-none"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-sm"
                    : "bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/70 dark:border-white/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="py-20 flex justify-center text-orange-500">
            <RefreshCw className="animate-spin w-8 h-8" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white/90 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl shadow-sm shadow-stone-200/40 dark:shadow-none">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 text-stone-300 dark:text-stone-600" />
            <p className="text-base font-bold text-stone-800 dark:text-white">No dishes found</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Click &quot;Add Dish&quot; to add menu items.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product._id}
                className={`bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border rounded-2xl overflow-hidden shadow-sm shadow-stone-200/40 dark:shadow-none hover:shadow-md transition flex flex-col justify-between ${
                  product.isAvailable
                    ? "border-stone-200/90 dark:border-white/10 hover:border-orange-500/40"
                    : "border-red-200 dark:border-red-500/20 opacity-75"
                }`}
              >
                {/* Image and badges */}
                <div className="relative h-48 w-full bg-stone-100 dark:bg-white/5 overflow-hidden">
                  <NextImage
                    src={product.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500"}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border backdrop-blur-md ${
                        product.type === "veg"
                          ? "bg-emerald-600/90 text-white border-emerald-400/50"
                          : "bg-red-600/90 text-white border-red-400/50"
                      }`}
                    >
                      {product.type}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-md border border-white/10">
                      {product.category}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/70 text-amber-300 backdrop-blur-md border border-white/10 flex items-center gap-1">
                      <Clock size={10} /> {product.preparationTime || 15}m prep
                    </span>
                  </div>

                  <div className="absolute top-3 right-3">
                    <button
                      onClick={() => handleToggleAvailability(product)}
                      className={`text-xs font-bold px-3 py-1 rounded-full shadow-xs transition flex items-center gap-1 active:scale-95 ${
                        product.isAvailable
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-stone-800 text-stone-200 hover:bg-stone-700"
                      }`}
                      title="Click to toggle availability"
                    >
                      {product.isAvailable ? "In Stock" : "Out of Stock"}
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h3 className="font-bold text-base text-stone-900 dark:text-white">{product.name}</h3>
                      <span className="text-base font-extrabold text-orange-600 dark:text-orange-400 shrink-0 font-mono">
                        ₹{product.price}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed mb-4">
                      {product.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-stone-100 dark:border-white/5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleAvailability(product)}
                      className="text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white flex items-center gap-1.5 bg-stone-100/80 dark:bg-white/5 hover:bg-stone-200/80 dark:hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition font-medium active:scale-95"
                    >
                      {product.isAvailable ? (
                        <ToggleRight className="text-emerald-500 w-4 h-4" />
                      ) : (
                        <ToggleLeft className="text-stone-400 w-4 h-4" />
                      )}
                      <span>{product.isAvailable ? "In Stock" : "Unavailable"}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/20 hover:text-orange-600 dark:hover:text-orange-400 text-stone-600 dark:text-stone-300 transition active:scale-95"
                        title="Edit Dish"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 transition active:scale-95"
                        title="Delete Dish"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ADD / EDIT MODAL ────────────────────────────────────── */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#12141c] border border-stone-200 dark:border-white/15 rounded-3xl w-full max-w-xl shadow-2xl relative my-auto max-h-[92vh] flex flex-col overflow-hidden text-stone-900 dark:text-white animate-in fade-in zoom-in-95 duration-200">
              
              {/* Sticky Header */}
              <div className="px-5 sm:px-6 py-4 border-b border-stone-100 dark:border-white/10 flex justify-between items-center shrink-0 bg-white/95 dark:bg-[#12141c]/95 backdrop-blur-md">
                <div>
                  <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                    {isEditing ? "Edit Dish" : "New Catalog Dish"}
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white">
                    {isEditing ? "Update Dish" : "Add Dish to Menu"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 sm:p-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleSaveProduct} className="flex-1 flex flex-col min-h-0">
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    
                    {/* Product Name */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase mb-1">
                        Product Name <span className="text-orange-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Truffle Paneer Burger"
                        value={modalForm.name}
                        onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                        required
                        className="w-full bg-stone-50/80 dark:bg-[#181b26] border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-400 dark:focus:border-stone-600 outline-none transition"
                      />
                    </div>

                    {/* Price */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase mb-1">
                        Price (₹) <span className="text-orange-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="199"
                        value={modalForm.price}
                        onChange={(e) => setModalForm({ ...modalForm, price: e.target.value })}
                        required
                        min="1"
                        className="w-full bg-stone-50/80 dark:bg-[#181b26] border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-400 dark:focus:border-stone-600 outline-none font-mono transition"
                      />
                    </div>

                    {/* Category Selector */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase mb-1">
                        Category <span className="text-orange-500">*</span>
                      </label>
                      <select
                        value={modalForm.category}
                        onChange={(e) => setModalForm({ ...modalForm, category: e.target.value })}
                        className="w-full bg-stone-50/80 dark:bg-[#181b26] border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-400 dark:focus:border-stone-600 outline-none transition cursor-pointer"
                      >
                        {MODAL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c === "Other" ? "Other (Custom...)" : c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Category Input if 'Other' is chosen */}
                    {modalForm.category === "Other" && (
                      <div className="md:col-span-2 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 animate-in fade-in duration-200">
                        <label className="block text-[11px] font-extrabold text-amber-800 dark:text-amber-300 uppercase mb-1">
                          Custom Category Name <span className="text-orange-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Biryani, Rolls, Beverages, Shakes..."
                          value={modalForm.customCategory}
                          onChange={(e) =>
                            setModalForm({ ...modalForm, customCategory: e.target.value })
                          }
                          required
                          className="w-full bg-white dark:bg-[#181b26] border border-amber-300 dark:border-amber-500/40 rounded-xl px-3.5 py-2 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-amber-500 outline-none font-semibold transition"
                        />
                        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">
                          This custom category will be assigned to this dish and appear in your menu filters.
                        </p>
                      </div>
                    )}

                    {/* Food Type */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase mb-1">
                        Food Type
                      </label>
                      <select
                        value={modalForm.type}
                        onChange={(e) => setModalForm({ ...modalForm, type: e.target.value })}
                        className="w-full bg-stone-50/80 dark:bg-[#181b26] border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-400 dark:focus:border-stone-600 outline-none transition cursor-pointer"
                      >
                        <option value="veg">Veg</option>
                        <option value="non-veg">Non-Veg</option>
                      </select>
                    </div>

                    {/* Availability */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase mb-1">
                        Availability
                      </label>
                      <select
                        value={modalForm.isAvailable ? "true" : "false"}
                        onChange={(e) =>
                          setModalForm({ ...modalForm, isAvailable: e.target.value === "true" })
                        }
                        className="w-full bg-stone-50/80 dark:bg-[#181b26] border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white focus:border-stone-400 dark:focus:border-stone-600 outline-none transition cursor-pointer"
                      >
                        <option value="true">In Stock / Available</option>
                        <option value="false">Out of Stock</option>
                      </select>
                    </div>

                    {/* Prep Time */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase mb-1">
                        Prep Time (Minutes) <span className="text-orange-500">*</span>
                      </label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            placeholder="15"
                            value={modalForm.preparationTime || ""}
                            onChange={(e) =>
                              setModalForm({ ...modalForm, preparationTime: e.target.value })
                            }
                            min="1"
                            max="180"
                            className="w-full bg-stone-50/80 dark:bg-[#181b26] border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-400 dark:focus:border-stone-600 outline-none font-mono pr-14 transition"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-400 pointer-events-none">
                            mins
                          </span>
                        </div>
                        {/* Quick preset chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[10, 15, 20, 30, 45].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => setModalForm({ ...modalForm, preparationTime: mins })}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                                Number(modalForm.preparationTime) === mins
                                  ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 border-stone-900 dark:border-white shadow-xs"
                                  : "bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 border-stone-200/80 dark:border-white/10 hover:bg-stone-200/60"
                              }`}
                            >
                              {mins}m
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Dish Image */}
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase">
                          Dish Image <span className="text-orange-500">*</span>
                        </label>
                        <div className="flex items-center gap-1 bg-stone-100 dark:bg-white/5 p-0.5 rounded-lg text-[11px] font-semibold border border-stone-200/60 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() => setImageMode("file")}
                            className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                              imageMode === "file"
                                ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs font-bold"
                                : "text-stone-500 hover:text-stone-900 dark:hover:text-white"
                            }`}
                          >
                            From Device
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageMode("url")}
                            className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                              imageMode === "url"
                                ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs font-bold"
                                : "text-stone-500 hover:text-stone-900 dark:hover:text-white"
                            }`}
                          >
                            Paste URL
                          </button>
                        </div>
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                      />

                      {imageMode === "file" ? (
                        <div>
                          <div
                            onClick={() => !uploadingImage && fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition ${
                              modalForm.image
                                ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500"
                                : "border-stone-300 dark:border-white/15 hover:border-stone-400 hover:bg-stone-50 dark:hover:bg-white/5"
                            }`}
                          >
                            {uploadingImage ? (
                              <div className="py-3 flex flex-col items-center gap-2 text-stone-700 dark:text-stone-300">
                                <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
                                <span className="text-xs font-semibold">Uploading photo from device...</span>
                              </div>
                            ) : modalForm.image ? (
                              <div className="flex items-center gap-3.5 w-full">
                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 shrink-0">
                                  <img
                                    src={modalForm.image}
                                    alt="Dish Preview"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                                    Image selected
                                  </p>
                                  <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                                    Click here to choose a different photo
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModalForm((prev) => ({ ...prev, image: "" }));
                                  }}
                                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition shrink-0 cursor-pointer"
                                  title="Remove Image"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            ) : (
                              <div className="py-2.5 flex flex-col items-center gap-1 text-center">
                                <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300 flex items-center justify-center">
                                  <Upload size={16} />
                                </div>
                                <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                                  Choose image from device
                                </p>
                                <p className="text-[11px] text-stone-400">
                                  PNG, JPG, or WEBP photo
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <input
                            type="url"
                            placeholder="https://images.unsplash.com/..."
                            value={modalForm.image}
                            onChange={(e) => setModalForm({ ...modalForm, image: e.target.value })}
                            className="flex-1 bg-stone-50/80 dark:bg-[#181b26] border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-400 dark:focus:border-stone-600 outline-none transition"
                          />
                          {modalForm.image && (
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-stone-200 dark:border-white/10 shrink-0">
                              <img src={modalForm.image} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Description (OPTIONAL) */}
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase">
                          Description <span className="text-[10px] text-stone-400 font-normal lowercase tracking-normal">(optional)</span>
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Optional ingredients, preparation notes, or taste description..."
                        value={modalForm.description}
                        onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                        className="w-full bg-stone-50/80 dark:bg-[#181b26] border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-stone-400 dark:focus:border-stone-600 outline-none transition resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Sticky Footer Action Bar */}
                <div className="px-5 sm:px-6 py-3.5 border-t border-stone-100 dark:border-white/10 flex items-center justify-end gap-2.5 shrink-0 bg-stone-50/90 dark:bg-[#0f1118]/90 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-200/70 hover:bg-stone-200 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition active:scale-95 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 disabled:opacity-50 transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    {submitting ? "Saving..." : isEditing ? "Update Dish" : "Create Dish"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
