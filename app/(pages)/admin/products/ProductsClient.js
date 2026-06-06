"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  Plus,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  image: "",
  category: "Burger",
  type: "veg",
  isAvailable: true,
  isFeatured: false,
};

export default function ProductsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
    if (session && session.user.role !== "admin") router.push("/");
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.role === "admin") fetchProducts();
  }, [session]);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openAddModal = () => {
    setForm(emptyForm);
    setEditingProduct(null);
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setForm({
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      category: product.category,
      type: product.type || "veg",
      isAvailable: product.isAvailable,
      isFeatured: product.isFeatured,
    });

    setEditingProduct(product);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (
      !form.name ||
      !form.price ||
      !form.image ||
      !form.description
    ) {
      alert("Please fill all required fields");
      return;
    }

    setSaving(true);

    try {
      const url = editingProduct
        ? `/api/products/${editingProduct._id}`
        : "/api/products";

      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowModal(false);
        setEditingProduct(null);
        setForm(emptyForm);
        await fetchProducts();
      } else {
        alert(data.error || data.message || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      alert("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        await fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAvailability = async (product) => {
    try {
      const res = await fetch(`/api/products/${product._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isAvailable: !product.isAvailable,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch = p.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchCategory =
      filterCategory === "All" ||
      p.category === filterCategory;

    return matchSearch && matchCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-brand-muted animate-pulse text-xl">
          Loading products...
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen pt-28 pb-16 px-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div>
          <Link
            href="/admin"
            className="text-brand-muted text-sm hover:text-white transition"
          >
            ← Dashboard
          </Link>

          <h1 className="text-4xl font-bold mt-1">
            Manage{" "}
            <span className="text-brand-orange">
              Products
            </span>
          </h1>

          <p className="text-brand-muted mt-1">
            {products.length} total products
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-brand-orange text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition"
        >
          <Plus size={16} />
          Add Product
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-brand-card border border-brand-border rounded-xl px-4 py-2.5 text-white placeholder-brand-muted outline-none focus:border-brand-orange transition text-sm"
        />

        <select
          value={filterCategory}
          onChange={(e) =>
            setFilterCategory(e.target.value)
          }
          className="bg-brand-card border border-brand-border rounded-xl px-4 py-2.5 text-white outline-none focus:border-brand-orange transition text-sm"
        >
          {[
            "All",
            "Burger",
            "Pizza",
            "Fries",
            "Momos",
            "Cold Drinks",
          ].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-left px-5 py-4 text-brand-muted text-sm font-medium">
                  Product
                </th>

                <th className="text-left px-5 py-4 text-brand-muted text-sm font-medium">
                  Category
                </th>

                <th className="text-left px-5 py-4 text-brand-muted text-sm font-medium">
                  Type
                </th>

                <th className="text-left px-5 py-4 text-brand-muted text-sm font-medium">
                  Price
                </th>

                <th className="text-left px-5 py-4 text-brand-muted text-sm font-medium">
                  Status
                </th>

                <th className="text-left px-5 py-4 text-brand-muted text-sm font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((product) => (
                <tr
                  key={product._id}
                  className="border-b border-brand-border last:border-0 hover:bg-brand-border/30 transition"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-12 h-12 rounded-xl object-cover border border-brand-border"
                      />

                      <div>
                        <p className="text-white font-medium text-sm">
                          {product.name}
                        </p>

                        <p className="text-brand-muted text-xs line-clamp-1 max-w-xs">
                          {product.description}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span className="text-xs bg-orange-500/20 text-brand-orange px-2.5 py-1 rounded-full">
                      {product.category}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        product.type === "veg"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {product.type === "veg"
                        ? "🟢 Veg"
                        : "🔴 Non-Veg"}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span className="text-brand-orange font-semibold">
                      ₹{product.price}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <button
                      onClick={() =>
                        handleToggleAvailability(product)
                      }
                      className="flex items-center gap-1.5 text-xs font-medium transition"
                    >
                      {product.isAvailable ? (
                        <>
                          <ToggleRight
                            size={20}
                            className="text-green-400"
                          />
                          <span className="text-green-400">
                            Available
                          </span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft
                            size={20}
                            className="text-red-400"
                          />
                          <span className="text-red-400">
                            Unavailable
                          </span>
                        </>
                      )}
                    </button>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          openEditModal(product)
                        }
                        className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center hover:bg-blue-500/40 transition"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        onClick={() =>
                          handleDelete(product._id)
                        }
                        className="w-8 h-8 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center hover:bg-red-500/40 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-brand-muted">
              No products found.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                {editingProduct
                  ? "Edit Product"
                  : "Add New Product"}
              </h2>

              <button
                onClick={() => setShowModal(false)}
              >
                <X
                  size={20}
                  className="text-brand-muted hover:text-white transition"
                />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">

              <div>
                <label className="text-brand-muted text-sm mb-1 block">
                  Name *
                </label>

                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Product name"
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-white placeholder-brand-muted outline-none focus:border-brand-orange transition text-sm"
                />
              </div>

              <div>
                <label className="text-brand-muted text-sm mb-1 block">
                  Description *
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Product description"
                  rows={3}
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-white placeholder-brand-muted outline-none focus:border-brand-orange transition text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <label className="text-brand-muted text-sm mb-1 block">
                    Price (₹) *
                  </label>

                  <input
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    type="number"
                    placeholder="199"
                    className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-white placeholder-brand-muted outline-none focus:border-brand-orange transition text-sm"
                  />
                </div>

                <div>
                  <label className="text-brand-muted text-sm mb-1 block">
                    Category *
                  </label>

                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-white outline-none focus:border-brand-orange transition text-sm"
                  >
                    {[
                      "Burger",
                      "Pizza",
                      "Fries",
                      "Momos",
                      "Cold Drinks",
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              <div>
                <label className="text-brand-muted text-sm mb-1 block">
                  Image URL *
                </label>

                <input
                  name="image"
                  value={form.image}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-white placeholder-brand-muted outline-none focus:border-brand-orange transition text-sm"
                />

                {form.image && (
                  <img
                    src={form.image}
                    alt="preview"
                    className="mt-2 w-full h-32 object-cover rounded-xl border border-brand-border"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <label className="text-brand-muted text-sm mb-1 block">
                    Type
                  </label>

                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-white outline-none focus:border-brand-orange transition text-sm"
                  >
                    <option value="veg">
                      🟢 Veg
                    </option>

                    <option value="non-veg">
                      🔴 Non-Veg
                    </option>
                  </select>
                </div>

                <div className="flex flex-col gap-3 pt-6">

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isAvailable"
                      checked={form.isAvailable}
                      onChange={handleChange}
                      className="w-4 h-4 accent-brand-orange"
                    />

                    <span className="text-sm text-white">
                      Available
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isFeatured"
                      checked={form.isFeatured}
                      onChange={handleChange}
                      className="w-4 h-4 accent-brand-orange"
                    />

                    <span className="text-sm text-white">
                      Featured
                    </span>
                  </label>

                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="flex gap-3 mt-6">

              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-full border border-brand-border text-brand-muted text-sm font-semibold hover:bg-brand-border transition"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex-1 py-3 rounded-full text-sm font-semibold transition ${
                  saving
                    ? "bg-brand-border text-brand-muted cursor-not-allowed"
                    : "bg-brand-orange text-white hover:opacity-90"
                }`}
              >
                {saving
                  ? "Saving..."
                  : editingProduct
                  ? "Update Product"
                  : "Add Product"}
              </button>

            </div>
          </div>
        </div>
      )}
    </main>
  );
}