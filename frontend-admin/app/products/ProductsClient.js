"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import RestaurantAdminNav from "@/components/layout/RestaurantAdminNav";
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
} from "lucide-react";

export default function ProductsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [feedback, setFeedback] = useState({ type: "", message: "" });

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
    type: "veg",
    isAvailable: true,
    isFeatured: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageMode, setImageMode] = useState("file"); // "file" | "url"
  const fileInputRef = useRef(null);

  const categories = ["All", "Burger", "Pizza", "Fries", "Momos", "Cold Drinks", "Desserts", "Sides"];

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
      type: "veg",
      isAvailable: true,
      isFeatured: false,
    });
    setIsModalOpen(true);
  }

  // Open modal for editing existing product
  function openEditModal(product) {
    setIsEditing(true);
    setImageMode(product.image?.startsWith("http") ? "url" : "file");
    setModalForm({
      _id: product._id,
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      category: product.category,
      type: product.type || "veg",
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

      const url = isEditing
        ? `/api/restaurant/products/${modalForm._id}`
        : "/api/restaurant/products";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modalForm),
      });

      const data = await res.json();
      if (!data.success) {
        setFeedback({ type: "error", message: data.message || "Failed to save product." });
        return;
      }

      setFeedback({
        type: "success",
        message: isEditing
          ? `Product "${modalForm.name}" updated successfully!`
          : `Product "${modalForm.name}" created and added to your menu!`,
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-white font-jakarta">
      <RestaurantAdminNav />
      <main className="pt-28 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <span className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
              Menu Catalog
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              Restaurant <span className="text-orange-500">Dishes</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Add dishes, update pricing, and toggle instant availability for customers.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 transition text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20"
          >
            <PlusCircle size={18} /> Add Dish
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center justify-between border ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0" />
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
        <div className="bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-orange-500 outline-none"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  categoryFilter === cat
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5"
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
          <div className="text-center py-20 bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-base font-bold text-slate-800 dark:text-white">No dishes found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Click &quot;Add Dish&quot; to add menu items.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product._id}
                className={`bg-white dark:bg-[#10141f] border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                  product.isAvailable
                    ? "border-slate-200 dark:border-white/10 hover:border-orange-500/40"
                    : "border-red-200 dark:border-red-500/20 opacity-75"
                }`}
              >
                {/* Image and badges */}
                <div className="relative h-48 w-full bg-slate-100 dark:bg-white/5 overflow-hidden">
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
                  </div>

                  <div className="absolute top-3 right-3">
                    <button
                      onClick={() => handleToggleAvailability(product)}
                      className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm transition flex items-center gap-1 ${
                        product.isAvailable
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-slate-800 text-slate-200 hover:bg-slate-700"
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
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">{product.name}</h3>
                      <span className="text-base font-extrabold text-orange-600 dark:text-orange-400 shrink-0">
                        ₹{product.price}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {product.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleAvailability(product)}
                      className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition font-medium"
                    >
                      {product.isAvailable ? (
                        <ToggleRight className="text-emerald-500 w-4 h-4" />
                      ) : (
                        <ToggleLeft className="text-slate-400 w-4 h-4" />
                      )}
                      <span>{product.isAvailable ? "In Stock" : "Unavailable"}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/20 hover:text-orange-600 dark:hover:text-orange-400 text-slate-600 dark:text-slate-300 transition"
                        title="Edit Dish"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 transition"
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/15 rounded-3xl w-full max-w-xl p-6 md:p-8 shadow-2xl relative my-8 text-slate-900 dark:text-white">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                    {isEditing ? "Edit Dish" : "New Catalog Dish"}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {isEditing ? "Update Dish" : "Add Dish to Menu"}
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Truffle Paneer Burger"
                      value={modalForm.name}
                      onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                      required
                      className="w-full bg-slate-50 dark:bg-[#181b26] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-orange-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      placeholder="199"
                      value={modalForm.price}
                      onChange={(e) => setModalForm({ ...modalForm, price: e.target.value })}
                      required
                      min="1"
                      className="w-full bg-slate-50 dark:bg-[#181b26] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-orange-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Category *
                    </label>
                    <select
                      value={modalForm.category}
                      onChange={(e) => setModalForm({ ...modalForm, category: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-[#181b26] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-orange-500 outline-none"
                    >
                      {categories.filter((c) => c !== "All").map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Food Type
                    </label>
                    <select
                      value={modalForm.type}
                      onChange={(e) => setModalForm({ ...modalForm, type: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-[#181b26] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-orange-500 outline-none"
                    >
                      <option value="veg">Veg</option>
                      <option value="non-veg">Non-Veg</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Availability
                    </label>
                    <select
                      value={modalForm.isAvailable ? "true" : "false"}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, isAvailable: e.target.value === "true" })
                      }
                      className="w-full bg-slate-50 dark:bg-[#181b26] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-orange-500 outline-none"
                    >
                      <option value="true">In Stock / Available</option>
                      <option value="false">Out of Stock</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                        Dish Image *
                      </label>
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setImageMode("file")}
                          className={`px-2.5 py-1 rounded-md transition ${
                            imageMode === "file"
                              ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          }`}
                        >
                          From Device
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageMode("url")}
                          className={`px-2.5 py-1 rounded-md transition ${
                            imageMode === "url"
                              ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
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
                              ? "border-orange-500/40 bg-orange-50/20 dark:bg-orange-950/10 hover:border-orange-500"
                              : "border-slate-300 dark:border-white/15 hover:border-orange-500 hover:bg-slate-50 dark:hover:bg-white/5"
                          }`}
                        >
                          {uploadingImage ? (
                            <div className="py-4 flex flex-col items-center gap-2 text-orange-500">
                              <RefreshCw className="w-6 h-6 animate-spin" />
                              <span className="text-xs font-semibold">Uploading photo from device...</span>
                            </div>
                          ) : modalForm.image ? (
                            <div className="flex items-center gap-3.5 w-full">
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shrink-0">
                                <img
                                  src={modalForm.image}
                                  alt="Dish Preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  Image ready for menu
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  Click here to change or choose a different photo
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalForm((prev) => ({ ...prev, image: "" }));
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition shrink-0"
                                title="Remove Image"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="py-3 flex flex-col items-center gap-1.5 text-center">
                              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                                <Upload size={18} />
                              </div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Choose image from device
                              </p>
                              <p className="text-[11px] text-slate-400">
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
                          className="flex-1 bg-slate-50 dark:bg-[#181b26] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-orange-500 outline-none"
                        />
                        {modalForm.image && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 shrink-0">
                            <img src={modalForm.image} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Delicious ingredients, preparation method, taste description..."
                      value={modalForm.description}
                      onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                      required
                      className="w-full bg-slate-50 dark:bg-[#181b26] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-orange-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white transition shadow-md shadow-orange-500/20"
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
