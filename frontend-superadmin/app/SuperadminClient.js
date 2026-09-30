"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import CustomSpinner from "@/components/ui/CustomSpinner";
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
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  KeyRound,
  Eye,
  EyeOff,
  Layers,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  Store,
  SlidersHorizontal,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import MessagesManager from "@/components/messages/MessagesManager";

const ALL_AVAILABLE_FEATURES = [
  { id: "inventory", name: "Inventory Control", desc: "Stock, Ingredients, Recipes, Waste, Suppliers & Purchases", badge: "📦" },
  { id: "cashier", name: "Cashier / POS System", desc: "Front counter billing, payment processing & receipt generation", badge: "💵" },
  { id: "kitchen", name: "Kitchen Display (KDS)", desc: "Real-time kitchen order queue & preparation management", badge: "👨‍🍳" },
  { id: "delivery", name: "Delivery Dispatch", desc: "Delivery staff assignment & order dispatch tracking", badge: "🚚" },
  { id: "standards", name: "Standards & Protocols", desc: "Kitchen hygiene & quality assurance checklists", badge: "📋" },
  { id: "offers", name: "Offers & Promotions", desc: "Discounts, promo codes & targeted marketing deals", badge: "🏷️" },
  { id: "support", name: "Support & Helpdesk", desc: "Customer inquiry handling & manager help tickets", badge: "💬" },
  { id: "analytics", name: "Advanced Analytics", desc: "Revenue reports, sales analytics & performance metrics", badge: "📊" },
];

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

  // Logo edit modal states
  const [editingLogoRestaurant, setEditingLogoRestaurant] = useState(null);
  const [logoModalImage, setLogoModalImage] = useState("");
  const [savingLogo, setSavingLogo] = useState(false);

  // Manage Restaurant Feature Flags Modal
  const [managingFeaturesRestaurant, setManagingFeaturesRestaurant] = useState(null);
  const [restaurantFeaturesInput, setRestaurantFeaturesInput] = useState([]);
  const [savingFeatures, setSavingFeatures] = useState(false);

  // Reset admin password states
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Admin password reveal & restaurant grouping states
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [copiedPasswordId, setCopiedPasswordId] = useState("");
  const [adminViewMode, setAdminViewMode] = useState("grouped"); // 'grouped' | 'table'
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [collapsedRestaurants, setCollapsedRestaurants] = useState({});

  // Form states
  const [newRestaurant, setNewRestaurant] = useState({
    name: "",
    cuisineType: "",
    address: { street: "", city: "", state: "", pincode: "" },
    phone: "",
    image: "",
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

  // Route protection: immediately redirect unauthenticated users to /login
  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.replace("/login");
    }
  }, [status]);

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
    if (status === "authenticated") {
      if (session?.user?.role === "superadmin") {
        loadData();
      } else {
        setLoading(false);
      }
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, session]);

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

  // Toggle Password Reveal for an Admin
  function togglePasswordReveal(adminId) {
    setRevealedPasswords((prev) => ({
      ...prev,
      [adminId]: !prev[adminId],
    }));
  }

  // Copy Admin Password to Clipboard
  function handleCopyPassword(password, adminId) {
    if (!password) {
      toast.error("No password set to copy. Please reset password to assign a new one.");
      return;
    }
    navigator.clipboard.writeText(password);
    setCopiedPasswordId(adminId);
    toast.success("Admin password copied to clipboard!");
    setTimeout(() => {
      setCopiedPasswordId("");
    }, 2000);
  }

  // Toggle Collapse/Expand Restaurant Group
  function toggleCollapseRestaurant(restId) {
    setCollapsedRestaurants((prev) => ({
      ...prev,
      [restId]: !prev[restId],
    }));
  }

  // Quick shortcut to pre-select a restaurant in the Add Admin form and scroll down
  function handleQuickAddAdmin(restaurantId) {
    setNewAdmin((prev) => ({ ...prev, restaurantId }));
    const formElement = document.getElementById("add-admin-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth", block: "center" });
      const nameInput = document.getElementById("new-admin-name");
      if (nameInput) nameInput.focus();
    }
  }

  // Group Admins by Restaurant with filter support
  const groupedAdmins = useMemo(() => {
    const q = adminSearchQuery.trim().toLowerCase();

    // Map: restaurantId -> { restaurant, admins }
    const groupMap = new Map();

    // Pre-populate with all known restaurants so every branch is visible
    restaurants.forEach((r) => {
      groupMap.set(String(r._id), {
        restaurant: r,
        admins: [],
      });
    });

    const unassignedAdmins = [];

    admins.forEach((adm) => {
      const restId = adm.restaurant?._id ? String(adm.restaurant._id) : null;
      if (restId && groupMap.has(restId)) {
        groupMap.get(restId).admins.push(adm);
      } else if (restId) {
        groupMap.set(restId, {
          restaurant: adm.restaurant,
          admins: [adm],
        });
      } else {
        unassignedAdmins.push(adm);
      }
    });

    let groups = Array.from(groupMap.values());

    if (unassignedAdmins.length > 0) {
      groups.push({
        restaurant: {
          _id: "unassigned",
          name: "Unassigned / General Admins",
          status: "active",
          cuisineType: ["Management"],
        },
        admins: unassignedAdmins,
      });
    }

    if (q) {
      groups = groups
        .map((grp) => {
          const matchRest =
            grp.restaurant?.name?.toLowerCase().includes(q) ||
            grp.restaurant?.slug?.toLowerCase().includes(q);
          const filteredAdminList = grp.admins.filter(
            (a) =>
              a.name?.toLowerCase().includes(q) ||
              a.email?.toLowerCase().includes(q) ||
              a.visiblePassword?.toLowerCase().includes(q)
          );
          if (matchRest) {
            return grp;
          }
          if (filteredAdminList.length > 0) {
            return { ...grp, admins: filteredAdminList };
          }
          return null;
        })
        .filter(Boolean);
    }

    return groups;
  }, [restaurants, admins, adminSearchQuery]);

  // Filtered Admins for Flat Table View
  const filteredAdmins = useMemo(() => {
    if (!adminSearchQuery.trim()) return admins;
    const q = adminSearchQuery.trim().toLowerCase();
    return admins.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.restaurant?.name?.toLowerCase().includes(q) ||
        a.visiblePassword?.toLowerCase().includes(q)
    );
  }, [admins, adminSearchQuery]);

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
          image: newRestaurant.image,
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
        image: "",
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

  // Handle Save Logo in Superadmin
  async function handleSaveLogo(e) {
    e.preventDefault();
    if (!editingLogoRestaurant) return;
    try {
      setSavingLogo(true);
      const res = await fetch(`/api/superadmin/restaurants/${editingLogoRestaurant._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: logoModalImage }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Logo updated for ${editingLogoRestaurant.name}!`);
        setRestaurants((prev) =>
          prev.map((r) =>
            r._id === editingLogoRestaurant._id ? { ...r, image: logoModalImage } : r
          )
        );
        setEditingLogoRestaurant(null);
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

  // Handle Save Restaurant Feature Access (Superadmin Feature Flags)
  async function handleSaveRestaurantFeatures(e) {
    e.preventDefault();
    if (!managingFeaturesRestaurant) return;
    try {
      setSavingFeatures(true);
      const res = await fetch(`/api/superadmin/restaurants/${managingFeaturesRestaurant._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledFeatures: restaurantFeaturesInput }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Feature access updated for ${managingFeaturesRestaurant.name}!`);
        setRestaurants((prev) =>
          prev.map((r) =>
            r._id === managingFeaturesRestaurant._id
              ? { ...r, enabledFeatures: restaurantFeaturesInput }
              : r
          )
        );
        setManagingFeaturesRestaurant(null);
      } else {
        toast.error(data.message || "Failed to update feature access.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update feature access.");
    } finally {
      setSavingFeatures(false);
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

  // Handle Reset Admin Password (Super Admin Reset - never exposes current password)
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
        toast.success(`Password reset successfully for ${resetPasswordAdmin.name}!`);
        const updatedPass = newPasswordInput.trim();
        setAdmins((prev) =>
          prev.map((a) =>
            a._id === resetPasswordAdmin._id
              ? { ...a, visiblePassword: updatedPass }
              : a
          )
        );
        setRevealedPasswords((prev) => ({
          ...prev,
          [resetPasswordAdmin._id]: true,
        }));
        setResetPasswordAdmin(null);
        setNewPasswordInput("");
        await loadData();
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

  // 1. Initial auth state resolving
  if (status === "loading") {
    return (
      <main className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto flex items-center justify-center">
        <CustomSpinner size="lg" label="Checking platform authorization..." />
      </main>
    );
  }

  // 2. Unauthenticated: show redirecting indicator while browser navigates to /login
  if (status === "unauthenticated" || !session) {
    return (
      <main className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto flex items-center justify-center">
        <CustomSpinner size="lg" label="Redirecting to Super Admin Login..." />
      </main>
    );
  }

  // 3. User is authenticated with a non-superadmin account (e.g. restaurant_admin, staff, customer)
  if (session.user.role !== "superadmin") {
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
            <button
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.href = "/login";
              }}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs uppercase tracking-wider transition block shadow-sm shadow-indigo-200 cursor-pointer"
            >
              Sign In to Super Admin Portal →
            </button>
            <a
              href="http://localhost:3000"
              className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs transition block border border-slate-200 dark:border-slate-800"
            >
              Return to Food Ordering App
            </a>
          </div>
        </div>
      </main>
    );
  }

  // 4. Authenticated superadmin still fetching dashboard data
  if (loading) {
    return (
      <main className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto flex items-center justify-center">
        <CustomSpinner size="lg" label="Loading Platform Management..." />
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
                  <th className="py-3.5 px-6" scope="col">Restaurant Name</th>
                  <th className="py-3.5 px-6" scope="col">Status</th>
                  <th className="py-3.5 px-6 text-right whitespace-nowrap" scope="col">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-normal">
                {filteredRestaurants.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500 text-xs">
                      No matching restaurants found.
                    </td>
                  </tr>
                ) : (
                  filteredRestaurants.map((rest) => (
                    <tr key={rest._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors group">
                      {/* Name & thumbnail */}
                      <td className="py-4 px-6">
                        <Link
                          href={`/restaurant/${rest._id}`}
                          className="flex items-center gap-3.5 group-hover:opacity-95 transition"
                        >
                          <div
                            className="relative w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xs group-hover:border-indigo-500 transition"
                          >
                            <img
                              alt={rest.name}
                              className="w-full h-full object-cover"
                              src={
                                rest.image ||
                                "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120"
                              }
                            />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition block text-base">
                              {rest.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {rest.address?.city ? (
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span>{rest.address.city}</span>
                                </span>
                              ) : null}
                              <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                View details & features →
                              </span>
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
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
                        <div className="inline-flex items-center justify-end gap-2.5">
                          <Link
                            href={`/restaurant/${rest._id}`}
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-lg transition shadow-xs inline-flex items-center gap-1.5"
                            title="Manage features, logo, admins & link for this restaurant"
                          >
                            <span>Manage Branch</span>
                            <span className="text-indigo-200">→</span>
                          </Link>
                          <button
                            onClick={() => handleToggleRestaurantStatus(rest)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition inline-flex items-center shadow-xs border ${
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

                {/* Restaurant Logo / Picture */}
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Restaurant Logo / Pic URL (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://... or paste image URL"
                    value={newRestaurant.image}
                    onChange={(e) =>
                      setNewRestaurant({
                        ...newRestaurant,
                        image: e.target.value,
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
          <div className="p-5 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-slate-800 text-sky-600 dark:text-indigo-400 flex items-center justify-center border border-sky-100 dark:border-slate-700/50">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Admin Accounts</h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                    {admins.length} Total
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage restaurant branch admins, reveal passwords, and assign branch access
                </p>
              </div>
            </div>

            {/* Controls: Search & Group/Table View Mode */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search filter input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter admins or restaurants..."
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-500 transition w-48 sm:w-60 shadow-xs"
                />
              </div>

              {/* View Switcher: Grouped vs Table */}
              <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-lg border border-slate-200 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setAdminViewMode("grouped")}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    adminViewMode === "grouped"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Group admins by restaurant"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>By Restaurant</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminViewMode("table")}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    adminViewMode === "table"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Flat table view"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>All Admins</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── VIEW 1: GROUPED BY RESTAURANT ── */}
          {adminViewMode === "grouped" && (
            <div className="p-4 sm:p-6 space-y-4">
              {groupedAdmins.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    No restaurant admin accounts match your filter.
                  </p>
                </div>
              ) : (
                groupedAdmins.map((group) => {
                  const rest = group.restaurant;
                  const restId = String(rest?._id || "unassigned");
                  const isCollapsed = !!collapsedRestaurants[restId];
                  const hasAdmins = group.admins.length > 0;

                  return (
                    <div
                      key={restId}
                      className="border border-slate-200/90 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/40 shadow-xs overflow-hidden transition-all"
                    >
                      {/* Restaurant Header */}
                      <div className="px-4 sm:px-5 py-3.5 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {rest.image ? (
                              <img
                                src={rest.image}
                                alt={rest.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Store className="w-4 h-4" />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {rest.name}
                              </h3>
                              {rest.slug && (
                                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  @{rest.slug}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  rest.status === "active"
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full mr-1 ${
                                    rest.status === "active" ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                />
                                {rest.status || "active"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {Array.isArray(rest.cuisineType)
                                ? rest.cuisineType.join(", ")
                                : rest.cuisineType || "Restaurant branch"}
                            </p>
                          </div>
                        </div>

                        {/* Right header actions */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                              hasAdmins
                                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/40"
                            }`}
                          >
                            {group.admins.length} {group.admins.length === 1 ? "Admin" : "Admins"}
                          </span>

                          {rest._id !== "unassigned" && (
                            <button
                              type="button"
                              onClick={() => handleQuickAddAdmin(rest._id)}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 transition shadow-xs inline-flex items-center gap-1"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Add Admin</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleCollapseRestaurant(restId)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
                            title={isCollapsed ? "Expand" : "Collapse"}
                          >
                            {isCollapsed ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Restaurant Admins List */}
                      {!isCollapsed && (
                        <div>
                          {!hasAdmins ? (
                            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-1.5">
                              <p>No admin accounts currently assigned to this restaurant branch.</p>
                              {rest._id !== "unassigned" && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddAdmin(rest._id)}
                                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold mt-1"
                                >
                                  + Assign First Admin to {rest.name}
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="overflow-x-auto custom-scrollbar">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50/40 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <th className="py-2.5 px-5" scope="col">Admin User</th>
                                    <th className="py-2.5 px-5" scope="col">Email</th>
                                    <th className="py-2.5 px-5" scope="col">Password (Superadmin Only)</th>
                                    <th className="py-2.5 px-5" scope="col">Role</th>
                                    <th className="py-2.5 px-5" scope="col">Status</th>
                                    <th className="py-2.5 px-5 text-right whitespace-nowrap min-w-[150px]" scope="col">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
                                  {group.admins.map((adm) => (
                                    <tr
                                      key={adm._id}
                                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/25 transition-colors"
                                    >
                                      {/* Admin Name & initials */}
                                      <td className="py-3 px-5 text-slate-900 dark:text-white">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-xs">
                                            {getInitials(adm.name)}
                                          </div>
                                          <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                            {adm.name ? adm.name.replace(/\s*\(\s*Branch\s+Manager\s*\)/gi, "").trim() : "Admin"}
                                          </span>
                                        </div>
                                      </td>

                                      {/* Email */}
                                      <td className="py-3 px-5 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                        {adm.email}
                                      </td>

                                      {/* Password (Visible to Superadmin) */}
                                      <td className="py-3 px-5">
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
                                                {revealedPasswords[adm._id] ? (
                                                  <EyeOff className="w-3.5 h-3.5 text-indigo-500" />
                                                ) : (
                                                  <Eye className="w-3.5 h-3.5" />
                                                )}
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
                                      <td className="py-3 px-5">
                                        <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                                          {adm.role}
                                        </span>
                                      </td>

                                      {/* Status */}
                                      <td className="py-3 px-5">
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
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
                                      <td className="py-3 px-5 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center justify-end gap-1.5">
                                          <button
                                            onClick={() => {
                                              setResetPasswordAdmin(adm);
                                              setNewPasswordInput("");
                                            }}
                                            className="px-2.5 py-1 text-xs font-medium rounded-md transition shadow-xs border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-500/20 dark:hover:bg-amber-900/40 inline-flex items-center gap-1"
                                            type="button"
                                            title="Reset Password"
                                          >
                                            <KeyRound className="w-3 h-3" />
                                            <span>Reset</span>
                                          </button>
                                          <button
                                            onClick={() => handleToggleAdminStatus(adm)}
                                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition shadow-xs border ${
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
                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md transition inline-flex items-center justify-center border border-transparent hover:border-rose-200 dark:hover:border-rose-900/30"
                                            title="Delete Admin"
                                            type="button"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── VIEW 2: FLAT TABLE VIEW ── */}
          {adminViewMode === "table" && (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-6" scope="col">Restaurant</th>
                    <th className="py-3 px-6" scope="col">Name</th>
                    <th className="py-3 px-6" scope="col">Email</th>
                    <th className="py-3 px-6" scope="col">Password (Superadmin Only)</th>
                    <th className="py-3 px-6" scope="col">Role</th>
                    <th className="py-3 px-6" scope="col">Status</th>
                    <th className="py-3 px-6 text-right whitespace-nowrap min-w-[150px]" scope="col">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-normal">
                  {filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        No admin accounts found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredAdmins.map((adm) => (
                      <tr key={adm._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                        {/* Restaurant */}
                        <td className="py-4 px-6">
                          <span className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
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

                        {/* Password */}
                        <td className="py-4 px-6">
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
                                  {revealedPasswords[adm._id] ? (
                                    <EyeOff className="w-3.5 h-3.5 text-indigo-500" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
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
                              onClick={() => {
                                setResetPasswordAdmin(adm);
                                setNewPasswordInput("");
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium rounded-md transition shadow-sm border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-500/20 dark:hover:bg-amber-900/40 inline-flex items-center gap-1"
                              type="button"
                              title="Reset Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset</span>
                            </button>
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
          )}

          {/* Add Admin Form Container */}
          <div id="add-admin-form" className="p-6 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800/80">
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
                  id="new-admin-name"
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

      {/* ── RESTAURANT LOGO & PHOTO EDIT MODAL ───────────────────────── */}
      {editingLogoRestaurant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Update Restaurant Logo / Pic
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingLogoRestaurant(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLogo} className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Changing logo & photo for <strong className="text-slate-900 dark:text-white">{editingLogoRestaurant.name}</strong>.
                </p>

                {/* Preview Box */}
                <div className="flex items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 mb-4">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    {logoModalImage ? (
                      <img
                        src={logoModalImage}
                        alt="Logo Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-10 h-10 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Image URL input */}
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Logo / Photo URL
                </label>
                <input
                  type="text"
                  placeholder="https://... image URL"
                  value={logoModalImage}
                  onChange={(e) => setLogoModalImage(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Upload File Alternative */}
              <div className="pt-1">
                <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-500 cursor-pointer transition">
                  <Upload size={14} className="text-indigo-500" />
                  <span>Or Upload From Device</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setLogoModalImage(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLogoRestaurant(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLogo}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition active:scale-95"
                >
                  {savingLogo ? "Saving..." : "Save Restaurant Logo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Admin Password Modal */}
      {resetPasswordAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reset Admin Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordAdmin(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetAdminPassword} className="space-y-4">
              <div>
                <p className="text-xs text-slate-700 dark:text-slate-200 mb-1 font-semibold">
                  Reset this admin&apos;s password?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  This will create a new password for <strong className="text-slate-900 dark:text-white">{resetPasswordAdmin.name}</strong> ({resetPasswordAdmin.email}).
                </p>

                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  New Password
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
                      let pass = "";
                      for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
                      setNewPasswordInput(pass);
                    }}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 transition"
                    title="Generate Secure Password"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Minimum 6 characters. Passwords are securely hashed with bcrypt.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetPasswordAdmin(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword || !newPasswordInput}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition active:scale-95"
                >
                  {resettingPassword ? "Resetting..." : "Confirm Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MANAGE RESTAURANT FEATURE ACCESS MODAL ── */}
      {managingFeaturesRestaurant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Feature Access Control
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {managingFeaturesRestaurant.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingFeaturesRestaurant(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Actions Header: Enable All / Disable All */}
            <div className="flex items-center justify-between mb-4 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                {restaurantFeaturesInput.length} of {ALL_AVAILABLE_FEATURES.length} Modules Enabled
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setRestaurantFeaturesInput(ALL_AVAILABLE_FEATURES.map((f) => f.id))
                  }
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Enable All
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setRestaurantFeaturesInput([])}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Disable All
                </button>
              </div>
            </div>

            {/* Feature List Toggles */}
            <form onSubmit={handleSaveRestaurantFeatures} className="space-y-3">
              <div className="space-y-2.5">
                {ALL_AVAILABLE_FEATURES.map((feat) => {
                  const isEnabled = restaurantFeaturesInput.includes(feat.id);
                  return (
                    <div
                      key={feat.id}
                      onClick={() => {
                        setRestaurantFeaturesInput((prev) =>
                          isEnabled
                            ? prev.filter((id) => id !== feat.id)
                            : [...prev, feat.id]
                        );
                      }}
                      className={`flex items-start justify-between p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                        isEnabled
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60 shadow-xs"
                          : "bg-slate-50/40 dark:bg-slate-950/20 border-slate-200/80 dark:border-slate-800/80 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start gap-3 pr-2">
                        <span className="text-xl leading-none mt-0.5">{feat.badge}</span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{feat.name}</span>
                            {isEnabled ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                                Enabled
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700">
                                Disabled
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {feat.desc}
                          </p>
                        </div>
                      </div>

                      {/* Checkbox Switch UI */}
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => {}} // Container onClick toggles
                        className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer shrink-0"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setManagingFeaturesRestaurant(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFeatures}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition active:scale-95"
                >
                  {savingFeatures ? "Saving..." : "Save Feature Permissions"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
