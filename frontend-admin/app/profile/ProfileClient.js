"use client";

import { useEffect, useState } from "react";
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
  Building
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function RestaurantAdminProfileClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [onDuty, setOnDuty] = useState(true);
  const [activeTab, setActiveTab] = useState("roster");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Editable Profile fields
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "+91 98765 43210",
    roleTitle: "Branch Operations Lead",
    soundAlerts: true,
  });

  const [stats, setStats] = useState({
    productsCount: 0,
    ordersCount: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      const stored = localStorage.getItem("pet_protocols_manager_profile");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setProfileData((prev) => ({ ...prev, ...parsed }));
        } catch (e) {
          // ignore error
        }
      } else {
        setProfileData((prev) => ({
          ...prev,
          name: session.user.name || "Kitchen Admin",
        }));
      }
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    async function fetchStats() {
      try {
        const res = await fetch("/api/restaurant/stats");
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to load restaurant stats", err);
      }
    }
    fetchStats();
  }, [session]);

  function handleSaveProfile(e) {
    e.preventDefault();
    localStorage.setItem("pet_protocols_manager_profile", JSON.stringify(profileData));
    setIsEditModalOpen(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  const restaurantName = session?.user?.restaurantName || "Partner Kitchen";
  const managerName = profileData.name || session?.user?.name || "Kitchen Admin";
  const managerEmail = session?.user?.email || "manager@yourkitchen.com";

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto font-jakarta text-zinc-900 dark:text-white transition-colors">
      
      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 size={16} /> Profile settings updated successfully!
        </div>
      )}

      {/* ── MANAGER HERO CARD ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0f1118] border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-orange-500/10 border-2 border-orange-500/30 flex items-center justify-center text-3xl font-black text-orange-500 overflow-hidden shadow-inner">
                <UserCheck size={36} />
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-[#0f1118] flex items-center justify-center text-[10px] font-bold ${
                  onDuty ? "bg-emerald-500 text-white" : "bg-zinc-400 text-white"
                }`}
                title={onDuty ? "Active On-Duty" : "Standby"}
              >
                ●
              </span>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-xs font-bold uppercase tracking-wider mb-2">
                <Store size={13} /> {profileData.roleTitle}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                {managerName}
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm font-medium mt-0.5">
                {managerEmail} • <span className="text-orange-600 dark:text-orange-400 font-bold">{restaurantName}</span>
              </p>
              <p className="text-zinc-400 text-xs mt-0.5 flex items-center gap-1">
                <Phone size={12} /> {profileData.phone}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-orange-500 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition shadow-sm"
            >
              <Edit3 size={14} className="text-orange-500" /> Edit Profile
            </button>

            <button
              type="button"
              onClick={() => setOnDuty(!onDuty)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase transition border ${
                onDuty
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              {onDuty ? "🟢 On-Duty" : "⚪ Standby"}
            </button>

            <ThemeToggle />

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-bold text-xs uppercase tracking-wider transition"
            >
              <LogOut size={14} /> Exit Shift
            </button>
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-zinc-100 dark:border-white/10 text-center">
          <div>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-bold block">
              Active Dishes
            </span>
            <p className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white mt-0.5">
              {stats.productsCount}
            </p>
          </div>
          <div className="border-x border-zinc-100 dark:border-white/10">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-bold block">
              Branch Orders
            </span>
            <p className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
              {stats.ordersCount}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-bold block">
              Total Revenue
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              ₹{stats.totalRevenue}
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION TABS ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-white/10 pb-3 mb-8 overflow-x-auto scrollbar-none">
        {[
          { id: "roster", label: "Shift Roster" },
          { id: "hardware", label: "POS Peripherals" },
          { id: "tools", label: "Quick Navigation" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: SHIFT ROSTER ──────────────────────────────────── */}
      {activeTab === "roster" && (
        <div className="bg-white dark:bg-[#0f1118] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-lg space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
              <Users size={16} className="text-orange-500" /> Kitchen Station Delegation
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              3 Stations Active
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-xs flex items-center justify-center">
                  MGR
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white block">{managerName}</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {profileData.roleTitle} (You)
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                  CHEF
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white block">Station 1: Hot Kitchen & Grills</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Prep, baking, and primary ticket execution
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                ON-DUTY
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center justify-center">
                  DSP
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white block">Station 2: Tamper Packaging & Dispatch</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Security seal, temp verification, rider handoff
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                ON-DUTY
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: HARDWARE & DIAGNOSTICS ────────────────────────── */}
      {activeTab === "hardware" && (
        <div className="bg-white dark:bg-[#0f1118] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-lg space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
            <Printer size={16} className="text-orange-500" /> POS Peripherals & System Status
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl space-y-1.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-semibold">Kitchen Thermal Printer</span>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">CONNECTED (80mm Auto-Cut)</p>
              <span className="text-[11px] text-zinc-400 block font-mono">Prints kitchen chit automatically on ACK</span>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl space-y-1.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-semibold">Multi-Tenant Isolation</span>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Enforced & Active</p>
              <span className="text-[11px] text-zinc-400 block font-mono">Scoped strictly to {restaurantName}</span>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl space-y-1.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-semibold">New Ticket Audio Chime</span>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">
                {profileData.soundAlerts ? "Enabled (Repeats until ACK)" : "Muted"}
              </p>
              <span className="text-[11px] text-zinc-400 block font-mono">Triggers on new pending order ticket</span>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl space-y-1.5">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-semibold">KDS Sync Latency</span>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Real-Time Polling Active</p>
              <span className="text-[11px] text-zinc-400 block font-mono">Automatic order refresh</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: OPERATIONAL SHORTCUTS ─────────────────────────── */}
      {activeTab === "tools" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard"
            className="p-5 rounded-2xl bg-white dark:bg-[#0f1118] border border-zinc-200 dark:border-white/10 hover:border-orange-500 transition group flex items-center justify-between shadow-sm"
          >
            <div>
              <span className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase block mb-1">Primary View</span>
              <h4 className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-orange-500 transition">
                Kitchen Overview Dashboard
              </h4>
            </div>
            <ArrowRight size={16} className="text-zinc-400 group-hover:text-orange-500 transition" />
          </Link>

          <Link
            href="/orders"
            className="p-5 rounded-2xl bg-white dark:bg-[#0f1118] border border-zinc-200 dark:border-white/10 hover:border-orange-500 transition group flex items-center justify-between shadow-sm"
          >
            <div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase block mb-1">Live KDS Terminal</span>
              <h4 className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-orange-500 transition">
                Manage Incoming Kitchen Orders
              </h4>
            </div>
            <ArrowRight size={16} className="text-zinc-400 group-hover:text-orange-500 transition" />
          </Link>

          <Link
            href="/products"
            className="p-5 rounded-2xl bg-white dark:bg-[#0f1118] border border-zinc-200 dark:border-white/10 hover:border-orange-500 transition group flex items-center justify-between shadow-sm"
          >
            <div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase block mb-1">Menu Management</span>
              <h4 className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-orange-500 transition">
                Edit Dishes, Prices & Stock
              </h4>
            </div>
            <ArrowRight size={16} className="text-zinc-400 group-hover:text-orange-500 transition" />
          </Link>

          <Link
            href="/standards"
            className="p-5 rounded-2xl bg-white dark:bg-[#0f1118] border border-zinc-200 dark:border-white/10 hover:border-orange-500 transition group flex items-center justify-between shadow-sm"
          >
            <div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase block mb-1">Compliance</span>
              <h4 className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-orange-500 transition">
                पेट Protocols Hygiene SOPs
              </h4>
            </div>
            <ArrowRight size={16} className="text-zinc-400 group-hover:text-orange-500 transition" />
          </Link>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#0f1118] border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10 mb-6">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-orange-500" />
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Edit Manager Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 text-sm text-zinc-900 dark:text-white outline-none focus:border-orange-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 text-sm text-zinc-900 dark:text-white outline-none focus:border-orange-500 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                  Operational Role / Station Title
                </label>
                <input
                  type="text"
                  required
                  value={profileData.roleTitle}
                  onChange={(e) => setProfileData({ ...profileData, roleTitle: e.target.value })}
                  placeholder="e.g. Branch Operations Lead"
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-black/50 border border-zinc-200 dark:border-white/10 text-sm text-zinc-900 dark:text-white outline-none focus:border-orange-500 transition"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profileData.soundAlerts}
                    onChange={(e) => setProfileData({ ...profileData, soundAlerts: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 focus:ring-offset-0 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                  />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                    Play audio chime on incoming pending orders
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-lg shadow-orange-500/20 flex items-center gap-1.5"
                >
                  <Save size={14} /> Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
