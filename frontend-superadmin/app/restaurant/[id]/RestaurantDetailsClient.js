"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import CustomSpinner from "@/components/ui/CustomSpinner";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import {
  ShieldCheck,
  Building2,
  Users,
  UtensilsCrossed,
  ShoppingBag,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ExternalLink,
  MapPin,
  Search,
  Copy,
  Check,
  Camera,
  X,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  SlidersHorizontal,
  Store,
  Sparkles,
  Phone,
  Mail,
  Star,
  CheckSquare,
  Square,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

const ALL_AVAILABLE_FEATURES = [
  { id: "inventory", name: "Inventory Control", desc: "Stock levels, Ingredients, Recipes, Waste logging, Suppliers & Purchase orders", badge: "📦" },
  { id: "cashier", name: "Cashier / POS System", desc: "Front counter billing, direct order entry, payment collection & receipt printing", badge: "💵" },
  { id: "kitchen", name: "Kitchen Display (KDS)", desc: "Real-time kitchen order queue, Preparation status & Station dispatching", badge: "👨‍🍳" },
  { id: "delivery", name: "Delivery Dispatch", desc: "Delivery driver assignment, dispatch tracking & route monitoring", badge: "🚚" },
  { id: "standards", name: "Standards & Protocols", desc: "Kitchen hygiene standards, food safety protocols & compliance checklists", badge: "📋" },
  { id: "offers", name: "Offers & Promotions", desc: "Discount vouchers, promo codes, percentage deals & targeted offers", badge: "🏷️" },
  { id: "support", name: "Support & Helpdesk", desc: "Customer support tickets, manager inquiry handling & issue tracking", badge: "💬" },
  { id: "analytics", name: "Advanced Analytics", desc: "Revenue breakdowns, peak sales hours, item popularity & financial reports", badge: "📊" },
];

export default function RestaurantDetailsClient() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const hidden = useHideOnScroll();

  const restaurantId = params?.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurant, setRestaurant] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Features state
  const [enabledFeatures, setEnabledFeatures] = useState([]);
  const [savingFeatures, setSavingFeatures] = useState(false);

  // Logo edit modal state
  const [editingLogo, setEditingLogo] = useState(false);
  const [logoInput, setLogoInput] = useState("");
  const [savingLogo, setSavingLogo] = useState(false);

  // Password reveal states
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [copiedPasswordId, setCopiedPasswordId] = useState("");

  // Reset admin password modal
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Add new admin state
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "" });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const customerBaseUrl = process.env.NEXT_PUBLIC_CUSTOMER_URL || "http://localhost:3000";

  // Auth Protection
  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.replace("/login");
    }
  }, [status]);

  // Load restaurant details
  async function loadRestaurantData() {
    if (!restaurantId) return;
    try {
      setRefreshing(true);
      const res = await fetch(`/api/superadmin/restaurants/${restaurantId}`);
      const data = await res.json();

      if (data.success && data.restaurant) {
        setRestaurant(data.restaurant);
        setAdmins(data.restaurant.admins || []);
        setLogoInput(data.restaurant.image || "");

        const features = Array.isArray(data.restaurant.enabledFeatures)
          ? data.restaurant.enabledFeatures
          : ALL_AVAILABLE_FEATURES.map((f) => f.id);
        setEnabledFeatures(features);
      } else {
        toast.error(data.message || "Failed to load restaurant details.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch restaurant details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "superadmin") {
      loadRestaurantData();
    }
  }, [status, session, restaurantId]);

  // Copy Storefront Link
  function handleCopySlug() {
    const fullPath = `${customerBaseUrl}/menu?restaurant=${restaurantId}`;
    navigator.clipboard.writeText(fullPath);
    setCopiedSlug(true);
    toast.success("Storefront link copied to clipboard!");
    setTimeout(() => setCopiedSlug(false), 2000);
  }

  // Toggle Feature Checkbox
  function toggleFeature(featureId) {
    setEnabledFeatures((prev) =>
      prev.includes(featureId)
        ? prev.filter((id) => id !== featureId)
        : [...prev, featureId]
    );
  }

  // Save Feature Permissions
  async function handleSaveFeatures() {
    try {
      setSavingFeatures(true);
      const res = await fetch(`/api/superadmin/restaurants/${restaurantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledFeatures }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Feature permissions updated for ${restaurant.name}!`);
        setRestaurant(data.restaurant);
      } else {
        toast.error(data.message || "Failed to update feature permissions.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update feature permissions.");
    } finally {
      setSavingFeatures(false);
    }
  }

  // Save Logo
  async function handleSaveLogo(e) {
    e.preventDefault();
    try {
      setSavingLogo(true);
      const res = await fetch(`/api/superadmin/restaurants/${restaurantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: logoInput }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Restaurant logo updated!");
        setRestaurant((prev) => ({ ...prev, image: logoInput }));
        setEditingLogo(false);
      } else {
        toast.error(data.message || "Failed to update logo.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update logo.");
    } finally {
      setSavingLogo(false);
    }
  }

  // Add Admin User to this branch
  async function handleAddAdmin(e) {
    e.preventDefault();
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      toast.error("All admin fields are required.");
      return;
    }
    try {
      setCreatingAdmin(true);
      const res = await fetch("/api/superadmin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: newAdmin.name,
          email: newAdmin.email,
          password: newAdmin.password,
          role: "restaurant_admin",
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Admin user ${newAdmin.name} added!`);
        setNewAdmin({ name: "", email: "", password: "" });
        await loadRestaurantData();
      } else {
        toast.error(data.message || "Failed to add admin user.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add admin user.");
    } finally {
      setCreatingAdmin(false);
    }
  }

  // Password reveal & copy
  function togglePasswordReveal(adminId) {
    setRevealedPasswords((prev) => ({ ...prev, [adminId]: !prev[adminId] }));
  }

  function handleCopyPassword(password, adminId) {
    if (!password) {
      toast.error("No visible password stored. Reset password to assign a viewable one.");
      return;
    }
    navigator.clipboard.writeText(password);
    setCopiedPasswordId(adminId);
    toast.success("Admin password copied!");
    setTimeout(() => setCopiedPasswordId(""), 2000);
  }

  // Reset Admin Password
  async function handleResetAdminPassword(e) {
    e.preventDefault();
    if (!resetPasswordAdmin) return;
    if (!newPasswordInput || newPasswordInput.trim().length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    try {
      setResettingPassword(true);
      const res = await fetch(`/api/superadmin/admins/${resetPasswordAdmin._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPasswordInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Password reset for ${resetPasswordAdmin.name}!`);
        const updatedPass = newPasswordInput.trim();
        setAdmins((prev) =>
          prev.map((a) => (a._id === resetPasswordAdmin._id ? { ...a, visiblePassword: updatedPass } : a))
        );
        setRevealedPasswords((prev) => ({ ...prev, [resetPasswordAdmin._id]: true }));
        setResetPasswordAdmin(null);
        setNewPasswordInput("");
      } else {
        toast.error(data.message || "Failed to reset password.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to reset password.");
    } finally {
      setResettingPassword(false);
    }
  }

  // Suspend / Reactivate Admin
  async function handleToggleAdminStatus(admin) {
    const newStatus = admin.status === "active" ? "suspended" : "active";
    if (!window.confirm(`Are you sure you want to ${newStatus.toUpperCase()} admin ${admin.name}?`)) return;

    try {
      const res = await fetch(`/api/superadmin/admins/${admin._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Admin ${admin.name} is now ${newStatus.toUpperCase()}`);
        setAdmins((prev) =>
          prev.map((a) => (a._id === admin._id ? { ...a, status: newStatus } : a))
        );
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Failed to update admin status.");
    }
  }

  // Delete Admin
  async function handleRemoveAdmin(admin) {
    if (!window.confirm(`Delete admin account ${admin.email}?`)) return;
    try {
      const res = await fetch(`/api/superadmin/admins/${admin._id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Admin deleted.");
        setAdmins((prev) => prev.filter((a) => a._id !== admin._id));
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Failed to delete admin.");
    }
  }

  function getInitials(name) {
    if (!name) return "AD";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto flex items-center justify-center">
        <CustomSpinner size="lg" label="Loading Branch Details..." />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-6 max-w-md mx-auto text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-4 shadow-xl">
          <Store className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Restaurant Not Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">The requested restaurant branch does not exist or has been removed.</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-md shadow-indigo-600/20"
          >
            ← Return to Superadmin Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-200 antialiased transition-colors pb-20">
      {/* ── TOP NAVIGATION ── */}
      <header
        className={`sticky top-0 z-40 bg-white/85 dark:bg-[#0b0f17]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-transform duration-300 ease-in-out ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition inline-flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                {restaurant.name?.[0] || "R"}
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[180px] sm:max-w-none">
                {restaurant.name}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  restaurant.status === "active"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${restaurant.status === "active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                {restaurant.status || "active"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={loadRestaurantData}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ── HERO BANNER & BRANCH INFO CARD ── */}
        <section className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-8 relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4 sm:gap-5">
              {/* Logo Thumbnail */}
              <div
                onClick={() => setEditingLogo(true)}
                className="relative group w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200/80 dark:border-slate-700 overflow-hidden shrink-0 cursor-pointer shadow-md"
                title="Click to update restaurant logo"
              >
                <img
                  src={restaurant.image || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300"}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Camera size={20} />
                </div>
              </div>

              {/* Title & Info */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {restaurant.name}
                  </h1>
                  {restaurant.slug && (
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 font-semibold">
                      @{restaurant.slug}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {Array.isArray(restaurant.cuisineType)
                    ? restaurant.cuisineType.join(" • ")
                    : restaurant.cuisineType || "Restaurant Branch"}
                </p>

                {restaurant.address?.city && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>
                      {[restaurant.address.street, restaurant.address.city, restaurant.address.state]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </p>
                )}

                {/* Storefront Link Badge */}
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                    {customerBaseUrl}/menu?restaurant={restaurant._id}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySlug}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition"
                    title="Copy customer menu link"
                  >
                    {copiedSlug ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={`${customerBaseUrl}/menu?restaurant=${restaurant._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition"
                    title="Open storefront menu in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto mt-4 md:mt-0">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-xs text-slate-400 font-medium block uppercase tracking-wider">Admins</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                  {restaurant.adminCount || admins.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-xs text-slate-400 font-medium block uppercase tracking-wider">Menu Items</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                  {restaurant.productCount || 0}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-xs text-slate-400 font-medium block uppercase tracking-wider">Rating</span>
                <span className="text-lg font-black text-amber-500 mt-0.5 block flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{restaurant.rating || 4.8}</span>
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-xs text-slate-400 font-medium block uppercase tracking-wider">Features</span>
                <span className="text-lg font-black text-emerald-500 mt-0.5 block">
                  {enabledFeatures.length} Active
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURE ACCESS CONTROL SECTION ── */}
        <section className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Feature Access Control</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select which modules this restaurant branch is authorized to use.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEnabledFeatures(ALL_AVAILABLE_FEATURES.map((f) => f.id))}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Enable All
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={() => setEnabledFeatures([])}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Disable All
              </button>
              <button
                type="button"
                onClick={handleSaveFeatures}
                disabled={savingFeatures}
                className="ml-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition active:scale-95 inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{savingFeatures ? "Saving..." : "Save Feature Permissions"}</span>
              </button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ALL_AVAILABLE_FEATURES.map((feat) => {
              const isEnabled = enabledFeatures.includes(feat.id);
              return (
                <div
                  key={feat.id}
                  onClick={() => toggleFeature(feat.id)}
                  className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer select-none flex items-start justify-between gap-4 ${
                    isEnabled
                      ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60 shadow-xs"
                      : "bg-slate-50/40 dark:bg-slate-950/20 border-slate-200/80 dark:border-slate-800/80 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <span className="text-2xl leading-none mt-0.5">{feat.badge}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {feat.name}
                        </h3>
                        {isEnabled ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                            Enabled
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => {}} // Container onClick handles state
                    className="mt-1 w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── BRANCH ADMIN ACCOUNTS SECTION ── */}
        <section className="bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-indigo-400 flex items-center justify-center border border-sky-100 dark:border-slate-700/50">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Branch Admins ({admins.length})</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Admins authorized to manage this restaurant&apos;s menu, orders & operations.
                </p>
              </div>
            </div>
          </div>

          {/* Admins Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5" scope="col">Admin User</th>
                  <th className="py-3 px-5" scope="col">Email</th>
                  <th className="py-3 px-5" scope="col">Password (Superadmin Only)</th>
                  <th className="py-3 px-5" scope="col">Role</th>
                  <th className="py-3 px-5" scope="col">Status</th>
                  <th className="py-3 px-5 text-right whitespace-nowrap min-w-[150px]" scope="col">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      No admin accounts registered for this branch yet.
                    </td>
                  </tr>
                ) : (
                  admins.map((adm) => (
                    <tr key={adm._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-5 text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                            {getInitials(adm.name)}
                          </div>
                          <span className="font-semibold text-xs">
                            {adm.name ? adm.name.replace(/\s*\(\s*Branch\s+Manager\s*\)/gi, "").trim() : "Admin"}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {adm.email}
                      </td>

                      {/* Password Reveal */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-1.5">
                          {adm.visiblePassword ? (
                            <>
                              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 font-mono text-xs min-w-[90px]">
                                {revealedPasswords[adm._id] ? (
                                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 select-all tracking-wide">
                                    {adm.visiblePassword}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 tracking-widest select-none font-bold">
                                    ••••••••
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(adm._id)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title={revealedPasswords[adm._id] ? "Hide password" : "Reveal password"}
                              >
                                {revealedPasswords[adm._id] ? <EyeOff className="w-3.5 h-3.5 text-indigo-500" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyPassword(adm.visiblePassword, adm._id)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title="Copy password"
                              >
                                {copiedPasswordId === adm._id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400 italic">Encrypted</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetPasswordAdmin(adm);
                                  setNewPasswordInput("");
                                }}
                                className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                              >
                                Reset to reveal
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-5">
                        <span className="font-mono text-[11px] px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                          {adm.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            adm.status === "active"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${adm.status === "active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                          <span className="capitalize">{adm.status || "active"}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setResetPasswordAdmin(adm);
                              setNewPasswordInput("");
                            }}
                            className="px-2.5 py-1 text-xs font-medium rounded-md transition border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-500/20 inline-flex items-center gap-1"
                            type="button"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                          <button
                            onClick={() => handleToggleAdminStatus(adm)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition border ${
                              adm.status === "active"
                                ? "text-rose-600 hover:text-white hover:bg-rose-600 border-rose-200 dark:text-rose-300 dark:bg-rose-950/30"
                                : "text-emerald-600 hover:text-white hover:bg-emerald-600 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30"
                            }`}
                            type="button"
                          >
                            {adm.status === "active" ? "Suspend" : "Reactivate"}
                          </button>
                          <button
                            onClick={() => handleRemoveAdmin(adm)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md transition inline-flex items-center justify-center"
                            type="button"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add Admin Form */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-indigo-500" />
              <span>Add Admin to {restaurant.name}</span>
            </h3>

            <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Branch Manager"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. manager@branch.com"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2">
                <div className="w-full">
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition active:scale-95 shrink-0 self-end"
                >
                  {creatingAdmin ? "Adding..." : "Add Admin"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      {/* ── UPDATE LOGO MODAL ── */}
      {editingLogo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-500" />
                <span>Update Restaurant Logo</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingLogo(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLogo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                  Logo / Photo URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://... image URL"
                  value={logoInput}
                  onChange={(e) => setLogoInput(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>

              {logoInput && (
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 mx-auto">
                  <img src={logoInput} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLogo(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLogo}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20"
                >
                  {savingLogo ? "Saving..." : "Save Logo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET ADMIN PASSWORD MODAL ── */}
      {resetPasswordAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>Reset Admin Password</span>
              </h3>
              <button
                type="button"
                onClick={() => setResetPasswordAdmin(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetAdminPassword} className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Enter new password for <strong>{resetPasswordAdmin.name}</strong> ({resetPasswordAdmin.email}):
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    minLength={6}
                    placeholder="New password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
                      let pass = "";
                      for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
                      setNewPasswordInput(pass);
                    }}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetPasswordAdmin(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20"
                >
                  {resettingPassword ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
