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
  Store,
  Clock,
  Plus,
  Trash2,
  Home,
  Briefcase,
  X,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

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

  // Saved Addresses state
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressToast, setAddressToast] = useState("");
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

  // Strict role isolation: if admin or superadmin accesses /profile, redirect to their dedicated profile
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
        setTotalSpent(
          orderList.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
        );
      } catch (err) {
        console.error("Failed to load customer orders", err);
      }
    }
    fetchOrders();
  }, [session]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        await update({ name });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Address CRUD operations
  async function fetchAddresses() {
    try {
      setLoadingAddresses(true);
      const res = await fetch("/api/user/addresses");
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
      }
    } catch (err) {
      console.error("Failed to load addresses", err);
    } finally {
      setLoadingAddresses(false);
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchAddresses();
    }
  }, [session]);

  function openAddAddressModal() {
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
  }

  function openEditAddressModal(addr) {
    setEditingAddressId(addr._id);
    setAddressForm({
      label: addr.label || "Home",
      fullName: addr.fullName || "",
      phone: addr.phone || "",
      street: addr.street || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
      isDefault: !!addr.isDefault,
    });
    setIsAddressModalOpen(true);
  }

  async function handleSaveAddress(e) {
    e.preventDefault();
    try {
      const url = "/api/user/addresses";
      const method = editingAddressId ? "PUT" : "POST";
      const payload = editingAddressId
        ? { addressId: editingAddressId, ...addressForm }
        : addressForm;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        setIsAddressModalOpen(false);
        setAddressToast(editingAddressId ? "Address updated successfully!" : "New address saved to your profile!");
        setTimeout(() => setAddressToast(""), 3500);
      } else {
        alert(data.message || "Failed to save address");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving address");
    }
  }

  async function handleDeleteAddress(addressId) {
    if (!confirm("Are you sure you want to delete this delivery address?")) return;
    try {
      const res = await fetch(`/api/user/addresses?id=${addressId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        setAddressToast("Delivery address removed");
        setTimeout(() => setAddressToast(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSetDefaultAddress(addressId) {
    try {
      const res = await fetch("/api/user/addresses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId, action: "set_default" }),
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses || []);
        setAddressToast("Default delivery address set!");
        setTimeout(() => setAddressToast(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (status === "loading") {
    return <ProfileSkeleton />;
  }

  // Tier calculation
  const foodieTier =
    totalSpent > 3000 ? "Platinum Epicure" : totalSpent > 1000 ? "Gold Foodie" : "Silver Member";

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto font-jakarta text-foreground">
      
      {/* ── PROFILE HERO CARD ─────────────────────────────────────── */}
      <div className="bg-[#0f0f12] light:bg-white border border-neutral-800/80 light:border-stone-200 rounded-3xl p-6 sm:p-8 shadow-xl mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-orange-500/10 border-2 border-orange-500/30 flex items-center justify-center text-3xl font-black text-orange-500 overflow-hidden shadow-inner">
                {session?.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    width={96}
                    height={96}
                    unoptimized={session.user.image.startsWith("data:")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{session?.user?.name?.charAt(0) || "U"}</span>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-[#0f0f12] light:border-white rounded-full flex items-center justify-center text-[10px] text-white font-bold" title="Active Foodie">
                ✓
              </span>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs font-bold uppercase tracking-wider mb-2">
                <Crown size={13} /> {foodieTier}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white light:text-stone-900">
                {session?.user?.name || "Food Enthusiast"}
              </h1>
              <p className="text-neutral-400 light:text-stone-500 text-xs sm:text-sm font-medium mt-0.5">
                {session?.user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold text-xs uppercase tracking-wider transition"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

        {/* 3 Quick Pill Metrics */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-neutral-800/80 light:border-stone-200 text-center">
          <div>
            <span className="text-[11px] text-neutral-400 light:text-stone-500 uppercase font-bold block">
              Total Orders
            </span>
            <p className="text-xl sm:text-2xl font-black text-white light:text-stone-900 mt-0.5">
              {orders.length}
            </p>
          </div>
          <div className="border-x border-neutral-800/80 light:border-stone-200">
            <span className="text-[11px] text-neutral-400 light:text-stone-500 uppercase font-bold block">
              Total Spent
            </span>
            <p className="text-xl sm:text-2xl font-black text-orange-400 mt-0.5">
              ₹{totalSpent}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-neutral-400 light:text-stone-500 uppercase font-bold block">
              Foodie Points
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
              {Math.floor(totalSpent * 0.1)}
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION TABS ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-neutral-800 light:border-stone-200 pb-3 mb-8 overflow-x-auto no-scrollbar">
        {[
          { id: "overview", label: "Profile & Preferences" },
          { id: "addresses", label: "Saved Delivery Addresses" },
          { id: "orders", label: `Order History (${orders.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "text-neutral-400 light:text-stone-600 hover:text-white light:hover:text-stone-900 hover:bg-neutral-800/50 light:hover:bg-stone-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW & PREFERENCES ────────────────────────── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Edit */}
          <div className="bg-[#0f0f12] light:bg-white border border-neutral-800/80 light:border-stone-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white light:text-stone-900 mb-4 flex items-center gap-2">
              <Edit size={16} className="text-orange-500" /> Personal Account Info
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 light:text-stone-600 uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 light:bg-stone-100 border border-neutral-800 light:border-stone-300 text-white light:text-stone-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 transition"
                  placeholder="Your Full Name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 light:text-stone-600 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="text"
                  disabled
                  value={session?.user?.email || ""}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/50 light:bg-stone-200/60 border border-neutral-800 light:border-stone-300 text-neutral-500 light:text-stone-500 text-sm font-mono cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-orange-500/20"
              >
                {saving ? "Updating..." : success ? "✓ Profile Updated!" : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Dining Preferences */}
          <div className="bg-[#0f0f12] light:bg-white border border-neutral-800/80 light:border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white light:text-stone-900 flex items-center gap-2">
              <Leaf size={16} className="text-emerald-500" /> Dietary & Delivery Habits
            </h3>

            <div>
              <label className="block text-xs text-neutral-400 light:text-stone-600 font-semibold uppercase mb-2">
                Food Selection Preference
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDietaryPref("all")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    dietaryPref === "all"
                      ? "bg-orange-500/15 border-orange-500 text-orange-500"
                      : "bg-neutral-900 light:bg-stone-100 border-neutral-800 light:border-stone-300 text-neutral-400 light:text-stone-600"
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
                      : "bg-neutral-900 light:bg-stone-100 border-neutral-800 light:border-stone-300 text-neutral-400 light:text-stone-600"
                  }`}
                >
                  Pure Vegetarian 🌱
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 light:border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white light:text-stone-900 block">
                  Contactless Delivery
                </span>
                <span className="text-[11px] text-neutral-400 light:text-stone-500">
                  Driver leaves order at doorstep
                </span>
              </div>
              <button
                type="button"
                onClick={() => setContactless(!contactless)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  contactless ? "bg-orange-500" : "bg-neutral-700"
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

      {/* ── TAB 2: ADDRESSES ─────────────────────────────────────── */}
      {activeTab === "addresses" && (
        <div className="bg-[#0f0f12] light:bg-white border border-neutral-800/80 light:border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white light:text-stone-900 flex items-center gap-2">
                <MapPin size={16} className="text-orange-500" /> Saved Delivery Addresses
              </h3>
              <p className="text-xs text-neutral-400 light:text-stone-500 mt-0.5">
                Saved addresses will automatically appear during 1-click checkout.
              </p>
            </div>
            <button
              onClick={openAddAddressModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-sm"
            >
              <Plus size={14} /> Add Address
            </button>
          </div>

          {loadingAddresses ? (
            <div className="py-12 flex justify-center text-orange-500">
              <RefreshCw className="animate-spin w-7 h-7" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-neutral-800 light:border-stone-300 rounded-xl">
              <MapPin className="mx-auto text-3xl text-neutral-600 light:text-stone-400 mb-2" />
              <p className="text-sm font-bold text-white light:text-stone-900">No saved delivery addresses</p>
              <p className="text-xs text-neutral-400 light:text-stone-500 mt-1 max-w-sm mx-auto">
                Add your home, office, or frequently used locations for quick ordering without retyping.
              </p>
              <button
                onClick={openAddAddressModal}
                className="mt-4 px-4 py-2 rounded-xl bg-orange-500 text-white font-bold text-xs hover:bg-orange-600 transition"
              >
                + Add Your First Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr._id}
                  className={`bg-neutral-900/60 light:bg-stone-50 border rounded-2xl p-4.5 relative flex flex-col justify-between transition ${
                    addr.isDefault
                      ? "border-orange-500/50 shadow-sm"
                      : "border-neutral-800 light:border-stone-200 hover:border-neutral-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white light:text-stone-900 text-sm flex items-center gap-1.5">
                          {addr.label === "Home" ? (
                            <Home size={14} className="text-orange-500" />
                          ) : addr.label === "Work" ? (
                            <Briefcase size={14} className="text-blue-500" />
                          ) : (
                            <MapPin size={14} className="text-purple-500" />
                          )}
                          {addr.label || "Address"}
                        </span>
                        {addr.isDefault && (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            DEFAULT
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditAddressModal(addr)}
                          className="p-1 rounded text-neutral-400 hover:text-orange-500 hover:bg-neutral-800 light:hover:bg-stone-200 transition"
                          title="Edit Address"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(addr._id)}
                          className="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-neutral-800 light:hover:bg-stone-200 transition"
                          title="Delete Address"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-neutral-200 light:text-stone-800">
                      {addr.fullName} • <span className="font-mono text-neutral-400">{addr.phone}</span>
                    </p>

                    <p className="text-xs text-neutral-400 light:text-stone-600 mt-1 leading-relaxed">
                      {addr.street}, {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-800/60 light:border-stone-200 flex items-center justify-between">
                    {!addr.isDefault ? (
                      <button
                        onClick={() => handleSetDefaultAddress(addr._id)}
                        className="text-[11px] font-bold text-neutral-400 light:text-stone-500 hover:text-orange-500 light:hover:text-orange-600 transition"
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

      {/* ── ADD / EDIT ADDRESS MODAL ──────────────────────────────── */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#121216] light:bg-white border border-neutral-800 light:border-stone-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80 light:border-stone-200 mb-5">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-orange-500" />
                <h3 className="text-base font-bold text-white light:text-stone-900">
                  {editingAddressId ? "Edit Delivery Address" : "Add Delivery Address"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white light:hover:text-stone-900 hover:bg-neutral-800 light:hover:bg-stone-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-4">
              {/* Address Tag Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 light:text-stone-500 mb-1.5">
                  Location Type / Tag
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["Home", "Work", "Other"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setAddressForm({ ...addressForm, label: tag })}
                      className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                        addressForm.label === tag
                          ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                          : "bg-neutral-900 light:bg-stone-50 text-neutral-400 light:text-stone-600 border-neutral-800 light:border-stone-200 hover:border-neutral-700"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 light:text-stone-500 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Roy"
                    value={addressForm.fullName}
                    onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 light:bg-stone-50 border border-neutral-800 light:border-stone-200 text-xs text-white light:text-stone-900 outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 light:text-stone-500 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 light:bg-stone-50 border border-neutral-800 light:border-stone-200 text-xs text-white light:text-stone-900 outline-none focus:border-orange-500 transition font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 light:text-stone-500 mb-1">
                    Street Address / House / Flat *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flat 402, Royal Palms, 12th Main Road, Indiranagar"
                    value={addressForm.street}
                    onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 light:bg-stone-50 border border-neutral-800 light:border-stone-200 text-xs text-white light:text-stone-900 outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 light:text-stone-500 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="New Delhi"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 light:bg-stone-50 border border-neutral-800 light:border-stone-200 text-xs text-white light:text-stone-900 outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 light:text-stone-500 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Delhi"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 light:bg-stone-50 border border-neutral-800 light:border-stone-200 text-xs text-white light:text-stone-900 outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 light:text-stone-500 mb-1">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="110001"
                    value={addressForm.pincode}
                    onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 light:bg-stone-50 border border-neutral-800 light:border-stone-200 text-xs text-white light:text-stone-900 outline-none focus:border-orange-500 transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs text-neutral-300 light:text-stone-700 font-medium">
                    Set this as my default delivery address
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800/80 light:border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 light:bg-stone-200 text-neutral-300 light:text-stone-700 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition shadow-sm"
                >
                  {editingAddressId ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB 3: ORDERS ────────────────────────────────────────── */}
      {activeTab === "orders" && (
        <div className="bg-[#0f0f12] light:bg-white border border-neutral-800/80 light:border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white light:text-stone-900 flex items-center gap-2">
            <Receipt size={16} className="text-orange-500" /> Past Orders & Invoices
          </h3>

          {orders.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-neutral-800 light:border-stone-300 rounded-xl">
              <Utensils className="mx-auto text-3xl text-neutral-600 light:text-stone-400 mb-2" />
              <p className="text-sm font-bold text-white light:text-stone-900">No past orders yet</p>
              <p className="text-xs text-neutral-400 light:text-stone-500 mt-1">
                Browse our multi-kitchen partners and enjoy delicious food!
              </p>
              <Link
                href="/menu"
                className="inline-block mt-4 px-5 py-2 rounded-xl bg-orange-500 text-white font-bold text-xs"
              >
                Browse Menu →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="p-4 rounded-xl bg-neutral-900/60 light:bg-stone-50 border border-neutral-800 light:border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-orange-500/40 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white light:text-stone-900">
                        {order.restaurantName || "Pet Protocols Kitchen"}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          order.orderStatus === "delivered"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-orange-500/20 text-orange-400"
                        }`}
                      >
                        {order.orderStatus}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 light:text-stone-600 mt-1">
                      {order.items?.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                    </p>
                    <span className="text-[11px] text-neutral-500 light:text-stone-400 font-mono">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <span className="text-base font-black text-orange-400 font-mono">
                      ₹{order.totalAmount}
                    </span>
                    <Link
                      href="/orders"
                      className="px-3.5 py-1.5 rounded-lg bg-neutral-800 light:bg-stone-200 text-xs font-bold text-neutral-300 light:text-stone-800 hover:bg-orange-500 hover:text-white transition"
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

    </main>
  );
}