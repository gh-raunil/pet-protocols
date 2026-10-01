"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import {
  User,
  Crown,
  ShoppingBag,
  Wallet,
  MapPin,
  Leaf,
  Utensils,
  Check,
  LogOut,
  ShieldCheck,
  Heart,
  Receipt,
  ChevronRight,
  Edit,
  Sparkles,
  ArrowRight,
  Clock,
  Plus,
  Trash2,
  Home,
  Briefcase,
  X,
  RefreshCw,
  CheckCircle2,
  Settings,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import useFavoritesStore from "@/lib/favoritesStore";
import useCartStore from "@/lib/cartStore";
import { toast } from "@/components/ui/ToastProvider";

export default function CustomerProfileClient() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orders, setOrders] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [dietaryPref, setDietaryPref] = useState("all");
  const [contactless, setContactless] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Favorites store
  const { favorites, toggleFavorite } = useFavoritesStore();
  const addItem = useCartStore((s) => s.addItem);

  // Saved Addresses state
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    label: "Home",
    fullName: "",
    phone: "",
    street: "",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    isDefault: false,
  });

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001";
  const superadminUrl = process.env.NEXT_PUBLIC_SUPERADMIN_URL || "http://localhost:3002";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/profile");
    }
    if (session?.user?.role === "restaurant_admin" || session?.user?.role === "admin") {
      window.location.href = `${adminUrl}/profile`;
    }
    if (session?.user?.role === "superadmin") {
      window.location.href = `${superadminUrl}/profile`;
    }
  }, [status, session, router, adminUrl, superadminUrl]);

  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    async function fetchOrders() {
      try {
        const res = await fetch("/api/orders");
        const data = await res.json();
        const orderList = data.orders || [];
        setOrders(orderList);
        setTotalSpent(orderList.reduce((sum, o) => sum + (o.totalAmount || 0), 0));
      } catch (e) {
        console.error(e);
      }
    }
    fetchOrders();
  }, [session]);

  const loadAddresses = async () => {
    if (!session) return;
    try {
      setLoadingAddresses(true);
      const res = await fetch("/api/user/addresses");
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [session]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      const res = await fetch("/api/user/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        toast.success("Profile name updated successfully!");
        if (update) update({ name });
        setTimeout(() => setSuccess(false), 2500);
      } else {
        toast.error(data.message || "Failed to update profile");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  const openAddAddressModal = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: "Home",
      fullName: session?.user?.name || "",
      phone: session?.user?.phone || "",
      street: "",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      isDefault: addresses.length === 0,
    });
    setIsAddressModalOpen(true);
  };

  const openEditAddressModal = (addr) => {
    setEditingAddressId(addr._id);
    setAddressForm({
      label: addr.label || "Home",
      fullName: addr.fullName || "",
      phone: addr.phone || "",
      street: addr.street || "",
      city: addr.city || "New Delhi",
      state: addr.state || "Delhi",
      pincode: addr.pincode || "110001",
      isDefault: Boolean(addr.isDefault),
    });
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    try {
      const url = editingAddressId
        ? `/api/user/addresses?id=${editingAddressId}`
        : "/api/user/addresses";
      const method = editingAddressId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressForm),
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        setIsAddressModalOpen(false);
        toast.success(editingAddressId ? "Address updated!" : "New address saved!");
      } else {
        toast.error(data.message || "Failed to save address");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error saving address");
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!confirm("Are you sure you want to delete this delivery address?")) return;
    try {
      const res = await fetch(`/api/user/addresses?id=${addressId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        toast.success("Delivery address removed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetDefaultAddress = async (addressId) => {
    try {
      const res = await fetch("/api/user/addresses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId, action: "set_default" }),
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        toast.success("Default delivery address set!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (status === "loading") {
    return <ProfileSkeleton />;
  }

  const foodieTier =
    totalSpent > 3000 ? "Platinum Diner" : totalSpent > 1000 ? "Gold Foodie" : "Silver Member";

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-[var(--text-main)] transition-colors">
      {/* ── PROFILE HERO CARD ─────────────────────────────────────── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 shadow-xl mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-[var(--brand-accent)]/15 border-2 border-[var(--brand-accent)]/30 flex items-center justify-center text-3xl font-black text-[var(--brand-accent)] overflow-hidden shadow-inner">
                {session?.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    width={88}
                    height={88}
                    unoptimized={session.user.image.startsWith("data:")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{session?.user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-[var(--bg-card)] rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                ✓
              </span>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30 text-xs font-bold uppercase tracking-wider mb-2">
                <Crown size={13} /> {foodieTier}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-main)]">
                {session?.user?.name || "Customer"}
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[var(--text-muted)] mt-0.5">
                {session?.user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Link
              href="/settings"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs font-bold hover:border-[var(--brand-accent)]/40 transition"
            >
              <Settings size={14} className="text-[var(--brand-accent)]" />
              <span>Settings</span>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold text-xs uppercase tracking-wider transition"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

        {/* 3 Metrics */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-[var(--border-color)] text-center">
          <div>
            <span className="text-[11px] text-[var(--text-muted)] uppercase font-bold block">
              Total Orders
            </span>
            <p className="text-xl sm:text-2xl font-black text-[var(--text-main)] mt-0.5">
              {orders.length}
            </p>
          </div>
          <div className="border-x border-[var(--border-color)]">
            <span className="text-[11px] text-[var(--text-muted)] uppercase font-bold block">
              Total Spent
            </span>
            <p className="text-xl sm:text-2xl font-black text-[var(--brand-accent)] mt-0.5 font-mono">
              ₹{totalSpent}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-muted)] uppercase font-bold block">
              Wishlist Saved
            </span>
            <p className="text-xl sm:text-2xl font-black text-rose-500 mt-0.5">
              {favorites.length}
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION TABS ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3 mb-8 overflow-x-auto scrollbar-none">
        {[
          { id: "overview", label: "Profile & Habits" },
          { id: "addresses", label: `Saved Addresses (${addresses.length})` },
          { id: "favorites", label: `My Favorites (${favorites.length})` },
          { id: "orders", label: `Order History (${orders.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-[var(--brand-accent)] text-white shadow-md shadow-[var(--brand-accent)]/20"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] border border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW & HABITS ──────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
              <Edit size={16} className="text-[var(--brand-accent)]" /> Edit Personal Information
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-sm font-medium focus:border-[var(--brand-accent)] transition shadow-sm"
                  placeholder="Your Full Name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="text"
                  disabled
                  value={session?.user?.email || ""}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-sub)]/50 border border-[var(--border-color)] text-[var(--text-muted)] text-sm font-mono cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-[var(--brand-accent)]/20 cursor-pointer"
              >
                {saving ? "Updating..." : success ? "✓ Changes Saved!" : "Save Changes"}
              </button>
            </form>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
              <Leaf size={16} className="text-emerald-500" /> Dining Preferences
            </h3>

            <div>
              <label className="block text-xs text-[var(--text-muted)] font-semibold uppercase mb-2">
                Food Catalog Filter Preference
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDietaryPref("all")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    dietaryPref === "all"
                      ? "bg-[var(--brand-accent)]/15 border-[var(--brand-accent)] text-[var(--brand-accent)]"
                      : "bg-[var(--bg-sub)] border-[var(--border-color)] text-[var(--text-muted)]"
                  }`}
                >
                  All Food Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setDietaryPref("veg")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    dietaryPref === "veg"
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-500"
                      : "bg-[var(--bg-sub)] border-[var(--border-color)] text-[var(--text-muted)]"
                  }`}
                >
                  Pure Vegetarian 🌱
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">
                  Contactless Delivery
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Driver rings bell and leaves order at doorstep
                </span>
              </div>
              <button
                type="button"
                onClick={() => setContactless(!contactless)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  contactless ? "bg-[var(--brand-accent)]" : "bg-[var(--bg-sub)] border border-[var(--border-color)]"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    contactless ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SAVED ADDRESSES ───────────────────────────────── */}
      {activeTab === "addresses" && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
                <MapPin size={16} className="text-[var(--brand-accent)]" /> Saved Delivery Addresses
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Saved addresses appear instantly during 1-click checkout.
              </p>
            </div>
            <button
              onClick={openAddAddressModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--brand-accent)] hover:opacity-95 text-white text-xs font-bold transition shadow-sm"
            >
              <Plus size={14} /> Add Address
            </button>
          </div>

          {loadingAddresses ? (
            <div className="py-12 flex justify-center text-[var(--brand-accent)]">
              <RefreshCw className="animate-spin w-7 h-7" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[var(--border-color)] rounded-2xl">
              <MapPin className="mx-auto text-3xl text-[var(--text-muted)] mb-2" />
              <p className="text-sm font-bold text-[var(--text-main)]">No saved delivery addresses</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                Add your home or office for rapid ordering.
              </p>
              <button
                onClick={openAddAddressModal}
                className="mt-4 px-4 py-2 rounded-xl bg-[var(--brand-accent)] text-white font-bold text-xs"
              >
                + Add New Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr._id}
                  className={`bg-[var(--bg-sub)] border rounded-2xl p-4 relative flex flex-col justify-between transition ${
                    addr.isDefault
                      ? "border-[var(--brand-accent)]/50 ring-1 ring-[var(--brand-accent)]/30"
                      : "border-[var(--border-color)]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[var(--text-main)] text-sm flex items-center gap-1.5">
                          {addr.label === "Home" ? (
                            <Home size={14} className="text-[var(--brand-accent)]" />
                          ) : addr.label === "Work" ? (
                            <Briefcase size={14} className="text-blue-500" />
                          ) : (
                            <MapPin size={14} className="text-emerald-500" />
                          )}
                          {addr.label || "Address"}
                        </span>
                        {addr.isDefault && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border border-[var(--brand-accent)]/30">
                            DEFAULT
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditAddressModal(addr)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--brand-accent)] transition"
                          title="Edit Address"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(addr._id)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 transition"
                          title="Delete Address"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-[var(--text-main)]">
                      {addr.fullName} • <span className="font-mono text-[var(--text-muted)]">{addr.phone}</span>
                    </p>

                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                      {addr.street}, {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                    {!addr.isDefault ? (
                      <button
                        onClick={() => handleSetDefaultAddress(addr._id)}
                        className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--brand-accent)] transition"
                      >
                        Set as Default
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                        <Check size={12} /> Primary Delivery Address
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: FAVORITES / WISHLIST (Section 15.B) ───────────── */}
      {activeTab === "favorites" && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
                <Heart size={16} className="text-rose-500 fill-rose-500" /> My Saved Dishes
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Dishes you’ve bookmarked for fast, repeat ordering.
              </p>
            </div>
          </div>

          {favorites.length === 0 ? (
            <div className="text-center py-14 border border-dashed border-[var(--border-color)] rounded-2xl">
              <Heart className="mx-auto text-3xl text-[var(--text-muted)] mb-2" />
              <p className="text-sm font-bold text-[var(--text-main)]">Your wishlist is empty</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                Tap the heart on any product card across the menu to save your favorites here.
              </p>
              <Link
                href="/menu"
                className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-[var(--brand-accent)] text-white font-bold text-xs"
              >
                Browse Menu
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((product) => (
                <div
                  key={product._id}
                  className="p-3.5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex items-center gap-3 relative"
                >
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[var(--bg-card)] shrink-0 border border-[var(--border-color)]">
                    <Image
                      src={product.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200"}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[var(--text-main)] truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs font-extrabold text-[var(--brand-accent)] mt-0.5">
                      ₹{product.price}
                    </p>
                    <button
                      onClick={() => {
                        addItem(product);
                        toast.success(`${product.name} added to cart!`);
                      }}
                      className="mt-1 text-[11px] font-bold text-[var(--brand-accent)] hover:underline"
                    >
                      + Add to Cart
                    </button>
                  </div>
                  <button
                    onClick={() => toggleFavorite(product)}
                    className="p-1.5 text-rose-500 hover:opacity-75 transition"
                    title="Remove from favorites"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: ORDERS HISTORY SNAPSHOT ───────────────────────── */}
      {activeTab === "orders" && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
              <Receipt size={16} className="text-[var(--brand-accent)]" /> Order Receipts
            </h3>
            <Link
              href="/orders"
              className="text-xs font-bold text-[var(--brand-accent)] hover:underline flex items-center gap-1"
            >
              All Orders Page <ChevronRight size={14} />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[var(--border-color)] rounded-2xl">
              <Utensils className="mx-auto text-3xl text-[var(--text-muted)] mb-2" />
              <p className="text-sm font-bold text-[var(--text-main)]">No past orders yet</p>
              <Link
                href="/menu"
                className="inline-block mt-4 px-5 py-2 rounded-xl bg-[var(--brand-accent)] text-white font-bold text-xs"
              >
                Browse Menu →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order._id}
                  className="p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[var(--brand-accent)]/30 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-main)]">
                        {order.restaurantName || "Partner Kitchen"}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]">
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {order.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <span className="text-sm font-mono font-bold text-[var(--brand-accent)]">
                      ₹{order.totalAmount}
                    </span>
                    <Link
                      href={`/order-confirmation?orderId=${order._id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] hover:border-[var(--brand-accent)]/40 transition"
                    >
                      Receipt
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADDRESS MODAL ─────────────────────────────────────────── */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl max-w-lg w-full shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden my-auto text-[var(--text-main)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-card)]">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-[var(--brand-accent)]" />
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  {editingAddressId ? "Edit Delivery Address" : "Add Delivery Address"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Location Label
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Home", "Work", "Other"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setAddressForm({ ...addressForm, label: tag })}
                        className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                          addressForm.label === tag
                            ? "bg-[var(--brand-accent)] text-white border-[var(--brand-accent)] shadow-sm"
                            : "bg-[var(--bg-sub)] text-[var(--text-muted)] border-[var(--border-color)]"
                        }`}
                      >
                        {tag === "Home" && <Home size={13} />}
                        {tag === "Work" && <Briefcase size={13} />}
                        {tag === "Other" && <MapPin size={13} />}
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Roy"
                      value={addressForm.fullName}
                      onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--brand-accent)] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--brand-accent)] transition font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Street Address / House / Flat *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flat 402, Royal Palms, 12th Main Road, Indiranagar"
                      value={addressForm.street}
                      onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--brand-accent)] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="New Delhi"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--brand-accent)] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Delhi"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--brand-accent)] transition"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      Pincode *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="110001"
                      value={addressForm.pincode}
                      onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-xs text-[var(--text-main)] outline-none focus:border-[var(--brand-accent)] transition"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addressForm.isDefault}
                      onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                      className="w-4 h-4 rounded text-[var(--brand-accent)] focus:ring-[var(--brand-accent)]"
                    />
                    <span className="text-xs text-[var(--text-main)] font-medium">
                      Set this as my default delivery address
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-color)] shrink-0 bg-[var(--bg-sub)]">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--brand-accent)] hover:opacity-95 text-white transition shadow-sm"
                >
                  {editingAddressId ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}