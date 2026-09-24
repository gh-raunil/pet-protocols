"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import {
  ShieldCheck,
  Building2,
  Users,
  UtensilsCrossed,
  ShoppingBag,
  IndianRupee,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Trash2,
  ExternalLink,
  MapPin,
  Search,
  Copy,
  Check,
  Bell,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import MessagesManager from "@/components/messages/MessagesManager";

export default function SuperadminClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hidden = useHideOnScroll();

  const [activeSection, setActiveSection] = useState("overview"); // 'overview' | 'messages'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSlug, setCopiedSlug] = useState("");

  // Form states
  const [newRestaurant, setNewRestaurant] = useState({
    name: "",
    cuisineType: "",
    address: { street: "", city: "", state: "", pincode: "" },
    phone: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);

  const [newAdmin, setNewAdmin] = useState({
    restaurantId: "",
    name: "",
    email: "",
    password: "",
    role: "restaurant_admin",
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Route protection
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch all superadmin data
  async function loadData() {
    try {
      setRefreshing(true);
      const [statsRes, restRes, adminRes] = await Promise.all([
        fetch("/api/superadmin/stats"),
        fetch("/api/superadmin/restaurants"),
        fetch("/api/superadmin/admins"),
      ]);

      const statsData = await statsRes.json();
      const restData = await restRes.json();
      const adminData = await adminRes.json();

      if (statsData.success) setStats(statsData.stats);
      if (restData.success) {
        setRestaurants(restData.restaurants);
        if (restData.restaurants.length > 0 && !newAdmin.restaurantId) {
          setNewAdmin((prev) => ({ ...prev, restaurantId: restData.restaurants[0]._id }));
        }
      }
      if (adminData.success) setAdmins(adminData.admins);
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to load platform data." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (session?.user?.role === "superadmin") {
      loadData();
    }
  }, [session]);

  const customerBaseUrl = process.env.NEXT_PUBLIC_CUSTOMER_URL || "http://localhost:3000";

  // Copy Slug
  function handleCopySlug(slug, restId) {
    const fullPath = `${customerBaseUrl}/menu?restaurant=${restId}`;
    navigator.clipboard.writeText(fullPath);
    setCopiedSlug(restId);
    toast.success("Storefront link copied to clipboard!");
    setTimeout(() => {
      setCopiedSlug("");
    }, 2000);
  }

  // Get Admin Initials
  function getInitials(name) {
    if (!name) return "AD";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // Handle Create Restaurant + First Admin
  async function handleCreateRestaurant(e) {
    e.preventDefault();
    try {
      setCreatingRestaurant(true);
      setFeedback({ type: "", message: "" });

      const res = await fetch("/api/superadmin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRestaurant.name,
          cuisineType: newRestaurant.cuisineType.split(",").map((s) => s.trim()),
          address: newRestaurant.address,
          phone: newRestaurant.phone,
          adminName: newRestaurant.adminName,
          adminEmail: newRestaurant.adminEmail,
          adminPassword: newRestaurant.adminPassword,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setFeedback({ type: "error", message: data.message || "Failed to create restaurant." });
        toast.error(data.message || "Failed to create restaurant.");
        return;
      }

      const msg = `Restaurant "${newRestaurant.name}" and first admin created successfully!`;
      setFeedback({ type: "success", message: msg });
      toast.success(msg);

      setNewRestaurant({
        name: "",
        cuisineType: "",
        address: { street: "", city: "", state: "", pincode: "" },
        phone: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
      });

      await loadData();
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Error creating restaurant." });
      toast.error("Error creating restaurant.");
    } finally {
      setCreatingRestaurant(false);
    }
  }

  // Handle Toggle Restaurant Status (Suspend / Reactivate)
  async function handleToggleRestaurantStatus(restaurant) {
    const newStatus = restaurant.status === "active" ? "suspended" : "active";
    const confirmAction = window.confirm(
      `Are you sure you want to ${newStatus === "suspended" ? "SUSPEND" : "REACTIVATE"} restaurant "${restaurant.name}"?`
    );
    if (!confirmAction) return;

    try {
      const res = await fetch(`/api/superadmin/restaurants/${restaurant._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        const msg = `Restaurant "${restaurant.name}" is now ${newStatus.toUpperCase()}.`;
        setFeedback({ type: "success", message: msg });
        toast.success(msg);
        await loadData();
      } else {
        setFeedback({ type: "error", message: data.message });
        toast.error(data.message);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to update restaurant status." });
      toast.error("Failed to update restaurant status.");
    }
  }

  // Handle Add Admin User to Existing Restaurant
  async function handleAddAdmin(e) {
    e.preventDefault();
    try {
      setCreatingAdmin(true);
      setFeedback({ type: "", message: "" });

      const res = await fetch("/api/superadmin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAdmin),
      });

      const data = await res.json();
      if (!data.success) {
        setFeedback({ type: "error", message: data.message || "Failed to add admin user." });
        toast.error(data.message || "Failed to add admin user.");
        return;
      }

      const msg = `Admin account created for ${newAdmin.email}!`;
      setFeedback({ type: "success", message: msg });
      toast.success(msg);

      setNewAdmin((prev) => ({
        ...prev,
        name: "",
        email: "",
        password: "",
      }));

      await loadData();
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Error adding admin user." });
      toast.error("Error adding admin user.");
    } finally {
      setCreatingAdmin(false);
    }
  }

  // Handle Toggle Admin Status (Suspend / Reactivate)
  async function handleToggleAdminStatus(admin) {
    const newStatus = admin.status === "active" ? "suspended" : "active";
    const confirmAction = window.confirm(
      `Are you sure you want to ${newStatus === "suspended" ? "SUSPEND" : "REACTIVATE"} admin ${admin.name}?`
    );
    if (!confirmAction) return;

    try {
      const res = await fetch(`/api/superadmin/admins/${admin._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        const msg = `Admin ${admin.name} is now ${newStatus.toUpperCase()}.`;
        setFeedback({ type: "success", message: msg });
        toast.success(msg);
        await loadData();
      } else {
        setFeedback({ type: "error", message: data.message });
        toast.error(data.message);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to update admin status." });
      toast.error("Failed to update admin status.");
    }
  }

  // Handle Remove Admin
  async function handleRemoveAdmin(admin) {
    const confirmAction = window.confirm(
      `Are you sure you want to permanently delete admin account "${admin.email}"?`
    );
    if (!confirmAction) return;

    try {
      const res = await fetch(`/api/superadmin/admins/${admin._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "Admin account removed." });
        toast.success("Admin account removed.");
        await loadData();
      } else {
        setFeedback({ type: "error", message: data.message });
        toast.error(data.message);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to remove admin." });
      toast.error("Failed to remove admin.");
    }
  }

  // Filter restaurants by search query
  const filteredRestaurants = restaurants.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.address?.city?.toLowerCase().includes(q) ||
      (Array.isArray(r.cuisineType) && r.cuisineType.some((c) => c.toLowerCase().includes(q)))
    );
  });

  if (loading || status === "loading") {
    return (
      <main className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-indigo-600 dark:text-indigo-400">
          <RefreshCw className="w-9 h-9 animate-spin text-indigo-600 dark:text-indigo-500" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading Platform Management...</p>
        </div>
      </main>
    );
  }

  // If user is authenticated with a non-superadmin account
  if (session && session.user.role !== "superadmin") {
    return (
      <main className="min-h-screen pt-28 pb-16 px-6 max-w-lg mx-auto flex items-center justify-center">
        <div className="w-full bg-white dark:bg-[#0b0f17] border border-rose-200 dark:border-rose-500/30 rounded-2xl p-8 text-center shadow-xl space-y-6">
          <div className="w-14 h-14 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-2xl">
            <ShieldCheck size={28} />
          </div>
          <div>
            <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 uppercase">
              SUPERADMIN PRIVILEGES REQUIRED
            </span>
            <h1 className="text-2xl font-bold mt-3 text-slate-900 dark:text-white">Platform Access Restricted</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              You are signed in as <span className="font-semibold text-slate-800 dark:text-white">{session.user.name}</span> ({session.user.email}) with role <code className="text-indigo-600 dark:text-indigo-400 font-mono">[{session.user.role}]</code>. Root platform credentials are required.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/login"
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs uppercase tracking-wider transition block shadow-sm shadow-indigo-200"
            >
              Sign In to Super Admin Portal →
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs transition block border border-slate-200 dark:border-slate-800"
            >
              Return to Food Ordering App
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const activeRestCount = stats?.activeRestaurants ?? restaurants.filter((r) => r.status === "active").length;
  const suspendedRestCount = stats?.suspendedRestaurants ?? restaurants.filter((r) => r.status === "suspended").length;
  const activeAdminsCount = admins.filter((a) => a.status === "active").length;
  const totalOrdersCount = stats?.totalOrders ?? 0;
  const totalRevenue = stats?.totalRevenue ?? 0;

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-200 antialiased transition-colors">
      {/* ── TOP NAVIGATION ────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 bg-white/80 dark:bg-[#0b0f17]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-transform duration-300 ease-in-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left side: Brand identity & current status */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-indigo-950 text-white shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight uppercase">
                  SUPER ADMIN
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  System Healthy
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Platform Management</p>
            </div>
          </div>

          {/* Right side: Quick utility buttons */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Refresh Button */}
            <button
              onClick={loadData}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm transition active:scale-95 disabled:opacity-50"
              type="button"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {/* Profile Button */}
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700 transition"
            >
              <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                SA
              </div>
              <span className="hidden md:inline font-medium">Profile</span>
            </Link>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

            {/* Logout Action */}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 rounded-lg transition"
              type="button"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTAINER ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 pb-16">
        {/* ── HERO HEADER / PLATFORM MANAGEMENT ────────────────────── */}
        <section
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl shadow-slate-900/10 border border-slate-800/80"
          data-purpose="hero-header"
        >
          {/* Subtle background decoration grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wider uppercase mb-3 border border-indigo-400/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Control Center
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Platform Management
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-slate-300 max-w-2xl">
                Manage partner restaurants, admins, and broadcast real-time operational messages.
              </p>
            </div>

            {/* Navigation Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/80 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setActiveSection("overview")}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  activeSection === "overview"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Building2 size={14} />
                <span>Tenants & Admins</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("messages")}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                  activeSection === "messages"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Bell size={14} />
                <span>Messages & Bulletins</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            </div>
          </div>
        </section>

        {/* ── FEEDBACK ALERT ──────────────────────────────────────── */}
        {feedback.message && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between border ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
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

        {/* Conditional rendering based on activeSection */}
        {activeSection === "messages" ? (
          <MessagesManager restaurants={restaurants} />
        ) : (
          <>
            {/* ── METRIC CARDS GRID ───────────────────────────────────── */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-purpose="platform-metrics">
          {/* Card 1: Total Restaurants */}
          <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Restaurants
              </span>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {stats?.totalRestaurants ?? restaurants.length}
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-0.5 inline-block" />
              <span>{activeRestCount} active</span>
              <span className="text-slate-300 dark:text-slate-600 font-normal">·</span>
              <span className="text-slate-400 dark:text-slate-500 font-normal">{suspendedRestCount} suspended</span>
            </p>
          </div>

          {/* Card 2: Restaurant Admins */}
          <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Restaurant Admins
              </span>
              <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {stats?.totalAdmins ?? admins.length}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {activeAdminsCount} active
            </p>
          </div>

          {/* Card 3: Orders */}
          <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Orders
              </span>
              <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {totalOrdersCount}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              All restaurant orders
            </p>
          </div>

          {/* Card 4: Revenue */}
          <div className="bg-white dark:bg-slate-900/60 rounded-xl p-5 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Revenue
              </span>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                ₹
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-emerald-400">
                ₹{totalRevenue.toLocaleString("en-IN")}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Total processed
            </p>
          </div>
        </section>

        {/* ── RESTAURANTS SECTION ─────────────────────────────────── */}
        <section
          className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden"
          data-purpose="restaurants-management"
        >
          {/* Section Header */}
          <div className="p-5 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-slate-700/50">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Restaurants</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage restaurants and their admins.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search restaurant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 bg-white dark:bg-slate-950/70 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 px-3 py-1.5 pl-8 transition outline-none shadow-sm"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {restaurants.length} Total
              </span>
            </div>
          </div>

          {/* Tenants Table View */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-6" scope="col">Restaurant Name</th>
                  <th className="py-3 px-6" scope="col">Menu Slug</th>
                  <th className="py-3 px-6" scope="col">Admins</th>
                  <th className="py-3 px-6" scope="col">Products</th>
                  <th className="py-3 px-6" scope="col">Status</th>
                  <th className="py-3 px-6 text-right whitespace-nowrap min-w-[140px]" scope="col">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-normal">
                {filteredRestaurants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      No matching restaurants found.
                    </td>
                  </tr>
                ) : (
                  filteredRestaurants.map((rest) => (
                    <tr key={rest._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                      {/* Name & thumbnail */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            <Image
                              alt={rest.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                              src={
                                rest.image ||
                                "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120"
                              }
                            />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {rest.name}
                            </span>
                            {rest.address?.city ? (
                              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>{rest.address.city}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Menu Slug */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-xs px-2.5 py-1 bg-slate-100 dark:bg-indigo-950/40 rounded-md text-amber-700 dark:text-indigo-300 border border-slate-200/80 dark:border-indigo-800/40 max-w-[260px] inline-block truncate"
                            title={`${customerBaseUrl}/menu?restaurant=${rest._id}`}
                          >
                            /menu?restaurant={rest._id}
                          </span>
                          <button
                            onClick={() => handleCopySlug(`${customerBaseUrl}/menu?restaurant=${rest._id}`, rest._id)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition p-1"
                            title="Copy customer storefront link"
                            type="button"
                          >
                            {copiedSlug === rest._id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Admins Count */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>{rest.adminCount || 0} Admins</span>
                        </span>
                      </td>

                      {/* Products Count */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 dark:bg-slate-800/90 text-indigo-700 dark:text-slate-300 border border-indigo-100 dark:border-slate-700">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-500 dark:text-slate-400" />
                          <span>{rest.productCount || 0} Items</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rest.status === "active"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              rest.status === "active" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <span className="capitalize">{rest.status || "active"}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <a
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-md transition inline-flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                            href={`${customerBaseUrl}/menu?restaurant=${rest._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open customer storefront menu"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleToggleRestaurantStatus(rest)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition inline-flex items-center shadow-sm border ${
                              rest.status === "active"
                                ? "text-rose-600 hover:text-white hover:bg-rose-600 border-rose-200 dark:text-rose-300 dark:bg-rose-950/30 dark:border-rose-500/20 dark:hover:bg-rose-900/40"
                                : "text-emerald-600 hover:text-white hover:bg-emerald-600 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-500/20 dark:hover:bg-emerald-900/40"
                            }`}
                            type="button"
                          >
                            {rest.status === "active" ? "Suspend" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Create New Restaurant Form Container */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                <PlusCircle className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Create a new restaurant
              </h3>
            </div>

            <form onSubmit={handleCreateRestaurant} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Restaurant Name */}
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Restaurant Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pet Protocols Bistro"
                    value={newRestaurant.name}
                    onChange={(e) =>
                      setNewRestaurant({ ...newRestaurant, name: e.target.value })
                    }
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-sm outline-none"
                  />
                </div>

                {/* Cuisine / Categories */}
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Cuisine / Categories
                  </label>
                  <input
                    type="text"
                    placeholder="Burgers, Pizza, Fast Food"
                    value={newRestaurant.cuisineType}
                    onChange={(e) =>
                      setNewRestaurant({ ...newRestaurant, cuisineType: e.target.value })
                    }
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-sm outline-none"
                  />
                </div>

                {/* First Admin Name */}
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    First Admin Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Malhotra"
                    value={newRestaurant.adminName}
                    onChange={(e) =>
                      setNewRestaurant({ ...newRestaurant, adminName: e.target.value })
                    }
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-sm outline-none"
                  />
                </div>

                {/* First Admin Email */}
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    First Admin Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. admin@bistro.com"
                    value={newRestaurant.adminEmail}
                    onChange={(e) =>
                      setNewRestaurant({ ...newRestaurant, adminEmail: e.target.value })
                    }
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-sm outline-none"
                  />
                </div>

                {/* First Admin Password */}
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    First Admin Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newRestaurant.adminPassword}
                    onChange={(e) =>
                      setNewRestaurant({ ...newRestaurant, adminPassword: e.target.value })
                    }
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-sm outline-none"
                  />
                </div>

                {/* Location / City */}
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Location / City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. New Delhi"
                    value={newRestaurant.address.city}
                    onChange={(e) =>
                      setNewRestaurant({
                        ...newRestaurant,
                        address: { ...newRestaurant.address, city: e.target.value },
                      })
                    }
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-sm outline-none"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={creatingRestaurant}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 dark:shadow-indigo-600/20 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 active:scale-[0.99]"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>
                    {creatingRestaurant
                      ? "Creating Restaurant..."
                      : "Create Restaurant"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ── ADMIN ACCOUNTS SECTION ──────────────────────────────── */}
        <section
          className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden"
          data-purpose="admin-accounts-management"
        >
          {/* Section Header */}
          <div className="p-5 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-indigo-400 flex items-center justify-center border border-sky-100 dark:border-slate-700/50">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Admin Accounts</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Privileged accounts authorized to manage individual branch menus & orders
                </p>
              </div>
            </div>
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {admins.length} Total Admins
              </span>
            </div>
          </div>

          {/* Admins Table View */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-6" scope="col">Restaurant</th>
                  <th className="py-3 px-6" scope="col">Name</th>
                  <th className="py-3 px-6" scope="col">Email</th>
                  <th className="py-3 px-6" scope="col">Role</th>
                  <th className="py-3 px-6" scope="col">Status</th>
                  <th className="py-3 px-6 text-right whitespace-nowrap min-w-[150px]" scope="col">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-normal">
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                      No admin accounts registered yet.
                    </td>
                  </tr>
                ) : (
                  admins.map((adm) => (
                    <tr key={adm._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                      {/* Restaurant */}
                      <td className="py-4 px-6">
                        <span className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer">
                          {adm.restaurant?.name || "Unassigned"}
                        </span>
                      </td>

                      {/* Name & title */}
                      <td className="py-4 px-6 text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                            {getInitials(adm.name)}
                          </div>
                          <span className="font-medium">
                            {adm.name ? adm.name.replace(/\s*\(\s*Branch\s+Manager\s*\)/gi, "").trim() : "Admin"}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {adm.email}
                      </td>

                      {/* Role */}
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                          {adm.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            adm.status === "active"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              adm.status === "active" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <span className="capitalize">{adm.status || "active"}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleAdminStatus(adm)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition shadow-sm border ${
                              adm.status === "active"
                                ? "text-rose-600 hover:text-white hover:bg-rose-600 border-rose-200 dark:text-rose-300 dark:bg-rose-950/30 dark:border-rose-500/20 dark:hover:bg-rose-900/40"
                                : "text-emerald-600 hover:text-white hover:bg-emerald-600 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-500/20 dark:hover:bg-emerald-900/40"
                            }`}
                            type="button"
                          >
                            {adm.status === "active" ? "Suspend" : "Reactivate"}
                          </button>
                          <button
                            onClick={() => handleRemoveAdmin(adm)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md transition inline-flex items-center justify-center border border-transparent hover:border-rose-200 dark:hover:border-rose-900/30"
                            title="Delete Admin"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add Admin Form Container */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-md bg-sky-600 text-white flex items-center justify-center">
                <PlusCircle className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Add an admin user</h3>
              </div>
            </div>

            <form
              onSubmit={handleAddAdmin}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end"
            >
              {/* Select Restaurant */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Select Restaurant <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={newAdmin.restaurantId}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, restaurantId: e.target.value })
                  }
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition shadow-sm outline-none"
                >
                  <option value="" disabled>
                    Select a restaurant
                  </option>
                  {restaurants.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Admin Full Name */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Admin Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition shadow-sm outline-none"
                />
              </div>

              {/* Admin Email */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Admin Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin2@flagship.com"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition shadow-sm outline-none"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newAdmin.password}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, password: e.target.value })
                  }
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition shadow-sm outline-none"
                />
              </div>

              {/* Submit Button */}
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-sm shadow-blue-200 dark:shadow-indigo-600/20 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{creatingAdmin ? "Adding..." : "Add Admin"}</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      </>
    )}

    {/* ── PLATFORM FOOTER ─────────────────────────────────────── */}
        <footer className="pt-6 pb-2 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
          <div>Pet Protocols Platform Management</div>
          <div className="text-xs text-slate-400 dark:text-slate-500">Super Admin Control Panel</div>
        </footer>
      </main>
    </div>
  );
}
