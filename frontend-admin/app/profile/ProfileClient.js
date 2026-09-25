"use client";

import { useEffect, useState, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Store,
  UserCheck,
  UtensilsCrossed,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Users,
  Printer,
  Bell,
  LogOut,
  ArrowRight,
  TrendingUp,
  Edit3,
  X,
  Save,
  Phone,
  Volume2,
  Mail,
  Building,
  Camera,
  Upload,
  Sparkles,
} from "lucide-react";
import { CHIME_OPTIONS, getSavedChime, setSavedChime, playChime } from "@/lib/soundChimes";

export default function RestaurantAdminProfileClient() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [onDuty, setOnDuty] = useState(true);
  const [activeTab, setActiveTab] = useState("roster");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Profile settings updated successfully!");
  const [selectedChime, setSelectedChime] = useState("bell");
  const [saving, setSaving] = useState(false);

  // Profile data
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "+91 98765 43210",
    roleTitle: "Branch Operations Lead",
    image: "",
    soundAlerts: true,
  });

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    todayOrders: 0,
    todayRevenue: 0,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    setSelectedChime(getSavedChime());
  }, []);

  // Fetch persisted profile from backend
  useEffect(() => {
    async function loadBackendProfile() {
      try {
        const res = await fetch("/api/restaurant/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setProfileData((prev) => ({
              ...prev,
              name: data.user.name || prev.name,
              phone: data.user.phone || prev.phone,
              roleTitle: data.user.roleTitle || prev.roleTitle,
              image: data.user.image || prev.image,
            }));
            return;
          }
        }
      } catch (err) {
        // fallback to session/local storage
      }

      if (session?.user) {
        const stored = localStorage.getItem("pet_protocols_manager_profile");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setProfileData((prev) => ({ ...prev, ...parsed }));
          } catch (e) {}
        } else {
          setProfileData((prev) => ({
            ...prev,
            name: session.user.name || "Kitchen Admin",
            image: session.user.image || "",
          }));
        }
      }
    }

    if (session?.user) {
      loadBackendProfile();
    }
  }, [session]);

  // Fetch restaurant stats
  useEffect(() => {
    if (!session) return;
    async function fetchStats() {
      try {
        const res = await fetch("/api/restaurant/stats");
        const data = await res.json();
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to load restaurant stats", err);
      }
    }
    fetchStats();
  }, [session]);

  function handleChimeChange(chimeId) {
    setSelectedChime(chimeId);
    setSavedChime(chimeId);
    playChime(chimeId, 1.0);
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image size should be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      setProfileData((prev) => ({ ...prev, image: base64 }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      // 1. Save to backend database
      const res = await fetch("/api/restaurant/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone,
          roleTitle: profileData.roleTitle,
          image: profileData.image,
        }),
      });

      // 2. Persist to local storage for quick offline sync
      localStorage.setItem("pet_protocols_manager_profile", JSON.stringify(profileData));
      localStorage.setItem("pet_kitchen_sound_alerts", profileData.soundAlerts ? "true" : "false");

      // 3. Update session if supported
      if (typeof update === "function") {
        update();
      }

      setToastMessage("Manager profile saved successfully!");
      setIsEditModalOpen(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error("Save profile error:", err);
      setToastMessage("Failed to save profile changes.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const restaurantName = session?.user?.restaurantName || "Partner Kitchen";
  const managerName = profileData.name || session?.user?.name || "Kitchen Admin";
  const managerEmail = session?.user?.email || "manager@yourkitchen.com";

  return (
    <main className="min-h-screen pt-24 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto font-jakarta text-stone-900 dark:text-white transition-colors">
      {/* Toast Alert */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 size={16} /> {toastMessage}
        </div>
      )}

      {/* ── PROFESSIONAL MANAGER HERO CARD ─────────────────────────────── */}
      <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Manager Identity & Avatar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar with Camera upload trigger */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-orange-500/10 border-2 border-orange-500/30 flex items-center justify-center text-3xl font-black text-[#F97316] overflow-hidden shadow-inner bg-stone-100 dark:bg-stone-800">
                {profileData.image ? (
                  <img
                    src={profileData.image}
                    alt={managerName}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <span className="font-extrabold text-2xl text-orange-500">
                    {managerName.charAt(0) || "M"}
                  </span>
                )}
              </div>

              {/* Upload badge button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all duration-200 hover:scale-110 active:scale-95 border-2 border-white dark:border-[#10141f]"
                title="Change Profile Photo"
              >
                <Camera size={13} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Manager Details */}
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 text-xs font-bold uppercase tracking-wider">
                <Store size={12} /> {profileData.roleTitle}
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900 dark:text-white">
                {managerName}
              </h1>
              <p className="text-stone-500 dark:text-stone-400 text-xs sm:text-sm font-medium">
                {managerEmail} • <span className="text-[#F97316] font-bold">{restaurantName}</span>
              </p>
              <p className="text-stone-500 dark:text-stone-400 text-xs flex items-center gap-1.5 pt-0.5">
                <Phone size={12} className="text-stone-400" /> {profileData.phone}
              </p>
            </div>
          </div>

          {/* Clean Action Controls (No ThemeToggle clutter) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 pt-2 md:pt-0">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-200 dark:border-white/10 hover:border-orange-500 bg-stone-50 dark:bg-white/5 text-stone-700 dark:text-stone-200 text-xs font-bold transition shadow-xs active:scale-95"
            >
              <Edit3 size={14} className="text-[#F97316]" />
              <span>Edit Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setOnDuty(!onDuty)}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold uppercase transition border flex items-center justify-center gap-1.5 active:scale-95 ${
                onDuty
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onDuty ? "bg-emerald-500 animate-pulse" : "bg-stone-400"}`} />
              <span>{onDuty ? "On-Duty" : "Standby"}</span>
            </button>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider transition active:scale-95"
              title="End session"
            >
              <LogOut size={13} />
              <span>Exit Shift</span>
            </button>
          </div>
        </div>

        {/* Clean Operational Metrics */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-stone-100 dark:border-white/10 text-center">
          <div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase font-bold tracking-wider block">
              Menu Dishes
            </span>
            <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white mt-1">
              {stats.totalProducts || stats.productsCount || 0}
            </p>
          </div>
          <div className="border-x border-stone-100 dark:border-white/10">
            <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase font-bold tracking-wider block">
              Total Orders
            </span>
            <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {stats.totalOrders || stats.ordersCount || 0}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 uppercase font-bold tracking-wider block">
              Total Revenue
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{stats.totalRevenue || 0}
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION TABS ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-stone-200/80 dark:border-white/10 pb-3 mb-8 overflow-x-auto scrollbar-none">
        {[
          { id: "roster", label: "Shift Roster" },
          { id: "audio", label: "Audio & Alerts" },
          { id: "tools", label: "Quick Navigation" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-[#F97316] text-white shadow-md shadow-orange-500/25"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/80 dark:border-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: SHIFT ROSTER ──────────────────────────────────── */}
      {activeTab === "roster" && (
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-white flex items-center gap-2">
              <Users size={16} className="text-[#F97316]" /> Kitchen Station Delegation
            </h3>
            <span className="text-xs text-stone-500 dark:text-stone-400 font-mono">
              3 Stations Active
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#C2410C] dark:text-orange-400 font-bold text-xs flex items-center justify-center shrink-0">
                  MGR
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white">
                    {managerName}
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {profileData.roleTitle} (You)
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                Active
              </span>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                  CHEF
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white">
                    Station 1: Hot Kitchen & Grills
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Prep, baking, and primary ticket execution
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase">
                On-Duty
              </span>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center justify-center shrink-0">
                  DSP
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white">
                    Station 2: Tamper Packaging & Dispatch
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Security seal, temp verification, rider handoff
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 uppercase">
                On-Duty
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: AUDIO & CHIME PREFERENCES ───────────────────────── */}
      {activeTab === "audio" && (
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-white flex items-center gap-2">
                <Volume2 size={16} className="text-[#F97316]" /> Kitchen Order Sound Chimes
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Customize the high-priority chime alert that rings across all pages when a customer places an order.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {CHIME_OPTIONS.map((c) => (
              <div
                key={c.id}
                onClick={() => handleChimeChange(c.id)}
                className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  selectedChime === c.id
                    ? "bg-orange-500/10 border-orange-500 text-stone-900 dark:text-white"
                    : "bg-stone-50 dark:bg-white/5 border-stone-200/80 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:border-orange-500/50"
                }`}
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-2">
                    {c.label}
                    {selectedChime === c.id && (
                      <span className="w-2 h-2 rounded-full bg-[#F97316]" />
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    {c.desc}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChimeChange(c.id);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-orange-500/20 text-[#F97316] font-bold text-xs hover:bg-orange-500/30 transition shrink-0 ml-2"
                >
                  🔊 Play
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: QUICK NAVIGATION ──────────────────────────────── */}
      {activeTab === "tools" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard"
            className="p-5 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 hover:border-orange-500 transition group flex items-center justify-between shadow-xs"
          >
            <div>
              <span className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase block mb-1">Kitchen Overview</span>
              <h4 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-[#F97316] transition">
                Branch Dashboard & KPI Stats
              </h4>
            </div>
            <ArrowRight size={16} className="text-stone-400 group-hover:text-[#F97316] transition" />
          </Link>

          <Link
            href="/orders"
            className="p-5 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 hover:border-orange-500 transition group flex items-center justify-between shadow-xs"
          >
            <div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase block mb-1">Live KDS Terminal</span>
              <h4 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-[#F97316] transition">
                Manage Incoming Kitchen Orders
              </h4>
            </div>
            <ArrowRight size={16} className="text-stone-400 group-hover:text-[#F97316] transition" />
          </Link>

          <Link
            href="/products"
            className="p-5 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 hover:border-orange-500 transition group flex items-center justify-between shadow-xs"
          >
            <div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase block mb-1">Menu Management</span>
              <h4 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-[#F97316] transition">
                Edit Dishes, Prices & Stock
              </h4>
            </div>
            <ArrowRight size={16} className="text-stone-400 group-hover:text-[#F97316] transition" />
          </Link>

          <Link
            href="/settings"
            className="p-5 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 hover:border-orange-500 transition group flex items-center justify-between shadow-xs"
          >
            <div>
              <span className="text-xs text-stone-600 dark:text-stone-400 font-bold uppercase block mb-1">Branch Settings</span>
              <h4 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-[#F97316] transition">
                Configure Contact & Appearance
              </h4>
            </div>
            <ArrowRight size={16} className="text-stone-400 group-hover:text-[#F97316] transition" />
          </Link>
        </div>
      )}

      {/* ── EDIT MANAGER PROFILE MODAL ────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#10141f] border border-stone-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-white/10 mb-6">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-[#F97316]" />
                <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                  Edit Manager Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Profile Picture Upload Section */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-2">
                  Admin Profile Picture
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border-2 border-orange-500/30 overflow-hidden flex items-center justify-center shrink-0">
                    {profileData.image ? (
                      <img
                        src={profileData.image}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-extrabold text-xl text-orange-500">
                        {profileData.name?.charAt(0) || "M"}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-[#F97316] font-bold text-xs cursor-pointer transition">
                      <Upload size={13} /> Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-stone-400">
                      Recommended: square JPG or PNG, max 2MB
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  placeholder="e.g. Shivam"
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-black/50 border border-stone-200 dark:border-white/10 text-sm text-stone-900 dark:text-white outline-none focus:border-orange-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-1.5">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-black/50 border border-stone-200 dark:border-white/10 text-sm text-stone-900 dark:text-white outline-none focus:border-orange-500 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-1.5">
                  Operational Role / Station Title
                </label>
                <input
                  type="text"
                  required
                  value={profileData.roleTitle}
                  onChange={(e) => setProfileData({ ...profileData, roleTitle: e.target.value })}
                  placeholder="e.g. Branch Operations Lead"
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-black/50 border border-stone-200 dark:border-white/10 text-sm text-stone-900 dark:text-white outline-none focus:border-orange-500 transition"
                />
              </div>

              {/* Chime selector in modal */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-1.5">
                  Order Chime Alert Sound
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedChime}
                    onChange={(e) => handleChimeChange(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-stone-50 dark:bg-black/50 border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-800 dark:text-stone-200 outline-none focus:border-orange-500"
                  >
                    {CHIME_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id} className="bg-white dark:bg-[#11141f] text-stone-900 dark:text-white">
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => playChime(selectedChime, 1.0)}
                    className="px-3 py-2 rounded-xl bg-orange-500/10 text-[#F97316] font-bold text-xs hover:bg-orange-500/20 transition shrink-0"
                  >
                    🔊 Test
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profileData.soundAlerts}
                    onChange={(e) => setProfileData({ ...profileData, soundAlerts: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 focus:ring-offset-0 bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700"
                  />
                  <span className="text-xs text-stone-700 dark:text-stone-300 font-medium">
                    Play audio chime on incoming pending orders
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-orange-500/20 flex items-center gap-1.5"
                >
                  <Save size={14} /> {saving ? "Saving..." : "Save Profile Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
