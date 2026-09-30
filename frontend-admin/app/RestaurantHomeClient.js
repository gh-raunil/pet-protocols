"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ShoppingBag,
  UtensilsCrossed,
  Bell,
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
  Lock,
  Truck,
  ChefHat,
  Receipt,
  Package,
  Headphones,
  Briefcase,
  ExternalLink,
  Sparkles,
} from "lucide-react";

import DeliveryWorkspace from "@/components/workspaces/DeliveryWorkspace";
import KitchenWorkspace from "@/components/workspaces/KitchenWorkspace";
import CashierWorkspace from "@/components/workspaces/CashierWorkspace";
import InventoryWorkspace from "@/components/workspaces/InventoryWorkspace";
import SupportWorkspace from "@/components/workspaces/SupportWorkspace";

export default function RestaurantHomeClient() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const isLeadAdmin =
    session?.user?.role === "restaurant_admin" || session?.user?.role === "admin";
  const isStaff = session?.user?.role === "staff";

  // Normalized staff roles
  const staffRoles = useMemo(() => {
    if (Array.isArray(session?.user?.staffRoles) && session.user.staffRoles.length > 0) {
      return session.user.staffRoles;
    }
    if (session?.user?.staffRole) {
      return session.user.staffRole.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return ["Kitchen"];
  }, [session]);

  // Active role selected for staff (defaults to their first assigned role)
  const [selectedStaffRole, setSelectedStaffRole] = useState(null);
  const activeRole = selectedStaffRole || staffRoles[0] || "Kitchen";

  // Admin preview role state (store owner can preview any staff view)
  const [adminPreviewRole, setAdminPreviewRole] = useState(null);

  const roleMeta = {
    Delivery: {
      id: "Delivery",
      label: "Delivery & Dispatch",
      icon: Truck,
      href: "/delivery",
      desc: "Live delivery transit, customer address, phone contact, and payment collection tracking.",
      color: "bg-blue-600 text-white",
      activeTab: "bg-blue-600 text-white shadow-blue-500/25 shadow-sm",
      component: DeliveryWorkspace,
    },
    Kitchen: {
      id: "Kitchen",
      label: "Kitchen KDS",
      icon: ChefHat,
      href: "/kitchen",
      desc: "Order preparation tickets, cooking queue, and dietary requirements.",
      color: "bg-orange-500 text-white",
      activeTab: "bg-orange-500 text-white shadow-orange-500/25 shadow-sm",
      component: KitchenWorkspace,
    },
    Cashier: {
      id: "Cashier",
      label: "Cashier & Billing",
      icon: Receipt,
      href: "/cashier",
      desc: "Front desk billing register, payment settlement, and tax receipt printing.",
      color: "bg-emerald-600 text-white",
      activeTab: "bg-emerald-600 text-white shadow-emerald-500/25 shadow-sm",
      component: CashierWorkspace,
    },
    Inventory: {
      id: "Inventory",
      label: "Inventory Control",
      icon: Package,
      href: "/inventory",
      desc: "Manage dish stock availability, 86'd sold out items, and menu pricing.",
      color: "bg-purple-600 text-white",
      activeTab: "bg-purple-600 text-white shadow-purple-500/25 shadow-sm",
      component: InventoryWorkspace,
    },
    Support: {
      id: "Support",
      label: "Customer Support",
      icon: Headphones,
      href: "/support",
      desc: "Fast customer inquiry lookup by phone or order ID and issue notes.",
      color: "bg-rose-600 text-white",
      activeTab: "bg-rose-600 text-white shadow-rose-500/25 shadow-sm",
      component: SupportWorkspace,
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 1. STAFF VIEW: Automatically render their work directly on front page
  // ─────────────────────────────────────────────────────────────────────────
  if (isStaff) {
    const ActiveComponent = roleMeta[activeRole]?.component || KitchenWorkspace;
    const currentMeta = roleMeta[activeRole] || roleMeta.Kitchen;
    const Icon = currentMeta.icon;

    return (
      <div className="min-h-screen bg-[#fafaf9] dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors">
        <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
          {/* ── TOP ROLE ACCESS BAR (Mandatory as requested) ───────────── */}
          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shadow-xs ${currentMeta.color}`}>
                <Icon size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-white">
                    {session?.user?.name || "Staff Member"}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                    {activeRole} Duty Active
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Assigned to <strong className="text-stone-700 dark:text-stone-300">{session?.user?.restaurantName || "Partner Branch"}</strong>
                </p>
              </div>
            </div>

            {/* If staff has multiple assigned roles, show role access switcher tabs at top */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-stone-500 dark:text-stone-400 mr-1 hidden sm:inline">
                Your Workspaces:
              </span>
              {staffRoles.map((roleKey) => {
                const meta = roleMeta[roleKey];
                if (!meta) return null;
                const RoleIcon = meta.icon;
                const isSelected = activeRole === roleKey;

                return (
                  <button
                    key={roleKey}
                    onClick={() => setSelectedStaffRole(roleKey)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? meta.activeTab
                        : "bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-white/10"
                    }`}
                  >
                    <RoleIcon size={14} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}

              {/* Direct Fullscreen Link */}
              <Link
                href={currentMeta.href}
                className="p-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-600 dark:text-stone-400 transition"
                title={`Open ${currentMeta.label} Fullscreen Page`}
              >
                <ExternalLink size={15} />
              </Link>
            </div>
          </div>

          {/* ── RENDER SPECIALIZED WORKSPACE DIRECTLY AT FRONT PAGE ────── */}
          <ActiveComponent restaurantName={session?.user?.restaurantName || ""} />
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. RESTAURANT ADMIN (OWNER/MANAGER) VIEW: Complete Hub + Staff View Previews
  // ─────────────────────────────────────────────────────────────────────────
  if (isLeadAdmin) {
    const PreviewComponent = adminPreviewRole ? roleMeta[adminPreviewRole]?.component : null;

    return (
      <div className="min-h-screen bg-[#fafaf9] dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-400/10 via-amber-200/5 to-transparent dark:from-orange-500/10 dark:via-transparent dark:to-transparent pointer-events-none" />

        <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8 relative z-10">
          {/* Header */}
          <section className="text-center py-6 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF7ED] dark:bg-orange-500/10 text-[#C2410C] dark:text-orange-400 text-xs font-bold mb-4 border border-orange-200 dark:border-orange-500/20 shadow-xs">
              <span className="font-extrabold">पेट Protocols</span>
              <span className="text-orange-500 text-[10px]">•</span>
              <span className="font-semibold">{session?.user?.restaurantName || "Operations Hub"}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] dark:text-white">
              Restaurant <span className="text-orange-500">Partner Command</span>
            </h1>
            <p className="text-stone-600 dark:text-stone-400 text-sm mt-2 font-medium">
              Oversee live kitchen orders, dispatch transit, cashier registers, and staff roles.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <Link
                href="/dashboard"
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-lg shadow-orange-500/25 flex items-center gap-2 active:scale-95"
              >
                <LayoutDashboard size={15} />
                <span>Dashboard & Sales</span>
              </Link>
              <Link
                href="/orders"
                className="bg-white dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-white/10 font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 active:scale-95"
              >
                <ShoppingBag size={15} />
                <span>Live Orders</span>
              </Link>
            </div>
          </section>

          {/* ── DEPARTMENT WORKSPACES FOR STORE MANAGERS ─────────────── */}
          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-orange-500" />
                  <span>Staff Workspaces & Role Views</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Inspect or operate specialized portals for any station.
                </p>
              </div>

              {adminPreviewRole && (
                <button
                  onClick={() => setAdminPreviewRole(null)}
                  className="text-xs font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
                >
                  ✕ Close Workspace View
                </button>
              )}
            </div>

            {/* Station Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {Object.values(roleMeta).map((meta) => {
                const Icon = meta.icon;
                const isSelected = adminPreviewRole === meta.id;

                return (
                  <button
                    key={meta.id}
                    onClick={() => setAdminPreviewRole(isSelected ? null : meta.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                        : "bg-stone-50 dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 border-stone-200/80 dark:border-white/5 text-stone-800 dark:text-stone-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon size={16} className={isSelected ? "text-white" : "text-orange-500"} />
                      <span className="text-[10px] font-extrabold uppercase">
                        {isSelected ? "Active" : "Inspect"}
                      </span>
                    </div>
                    <span className="text-xs font-bold block">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Embedded Active Preview */}
            {PreviewComponent && (
              <div className="pt-4 border-t border-stone-100 dark:border-white/5">
                <PreviewComponent restaurantName={session?.user?.restaurantName || ""} />
              </div>
            )}
          </div>

          {/* 4 Standard Tiles */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: "Live Orders Queue",
                desc: "Receive incoming tickets and update kitchen preparation status.",
                icon: ShoppingBag,
                href: "/orders",
              },
              {
                title: "Menu & Dish Catalog",
                desc: "Update dish prices, descriptions, and item stock availability.",
                icon: UtensilsCrossed,
                href: "/products",
              },
              {
                title: "Platform Messages",
                desc: "Official platform updates and kitchen directives.",
                icon: Bell,
                href: "/updates",
              },
              {
                title: "Kitchen Standards",
                desc: "Food hygiene, packaging, and dispatch procedures.",
                icon: ShieldCheck,
                href: "/standards",
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link
                  key={idx}
                  href={item.href}
                  className="group p-5 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/80 dark:border-white/10 hover:border-orange-500/60 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3">
                      <Icon size={18} />
                    </div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-orange-500 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-white/5 flex items-center justify-between text-xs font-bold text-orange-500">
                    <span>Open Module</span>
                    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </section>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. GUEST VIEW: Clean Login Portal
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative overflow-hidden flex items-center justify-center px-4 py-20">
      <div className="max-w-md w-full bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-3xl p-8 shadow-xl text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto shadow-sm">
          <ChefHat size={28} />
        </div>

        <div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-white">
            Restaurant Operations
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 leading-relaxed">
            Please authenticate to access your kitchen station, delivery dispatch, cashier terminal, or manager controls.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm py-3 rounded-xl transition shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
          <Lock size={15} />
          <span>Sign In to Kitchen</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
