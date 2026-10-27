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
  Store,
  ChevronRight,
  PlusCircle,
  Eye,
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
      activeTab: "bg-blue-600 text-white shadow-xs",
      component: DeliveryWorkspace,
    },
    Kitchen: {
      id: "Kitchen",
      label: "Kitchen KDS",
      icon: ChefHat,
      href: "/kitchen",
      desc: "Order preparation tickets, cooking queue, and dietary requirements.",
      color: "bg-orange-500 text-white",
      activeTab: "bg-orange-500 text-white shadow-xs",
      component: KitchenWorkspace,
    },
    Cashier: {
      id: "Cashier",
      label: "Cashier & Billing",
      icon: Receipt,
      href: "/cashier",
      desc: "Front desk billing register, payment settlement, and tax receipt printing.",
      color: "bg-emerald-600 text-white",
      activeTab: "bg-emerald-600 text-white shadow-xs",
      component: CashierWorkspace,
    },
    Inventory: {
      id: "Inventory",
      label: "Inventory Control",
      icon: Package,
      href: "/inventory",
      desc: "Manage dish stock availability, 86'd sold out items, and menu pricing.",
      color: "bg-purple-600 text-white",
      activeTab: "bg-purple-600 text-white shadow-xs",
      component: InventoryWorkspace,
    },
    Support: {
      id: "Support",
      label: "Customer Support",
      icon: Headphones,
      href: "/support",
      desc: "Fast customer inquiry lookup by phone or order ID and issue notes.",
      color: "bg-rose-600 text-white",
      activeTab: "bg-rose-600 text-white shadow-xs",
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-jakarta">
        {/* ── TOP ROLE ACCESS BAR ─────────────────────────────────────── */}
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
              Workstations:
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
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
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. RESTAURANT ADMIN (OWNER/MANAGER) VIEW: Complete Hub + Staff View Previews
  // ─────────────────────────────────────────────────────────────────────────
  if (isLeadAdmin) {
    const PreviewComponent = adminPreviewRole ? roleMeta[adminPreviewRole]?.component : null;

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-jakarta">
        {/* Command Center Header */}
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold mb-2 border border-orange-500/20">
              <span className="font-extrabold">पेट Protocols</span>
              <span className="text-[10px]">•</span>
              <span className="font-semibold">{session?.user?.restaurantName || "Operations Hub"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 dark:text-white">
              Restaurant Partner Command
            </h1>
            <p className="text-stone-500 dark:text-stone-400 text-xs sm:text-sm mt-1 max-w-xl">
              Oversee live kitchen orders, dispatch transit, cashier registers, and staff roles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 active:scale-95"
            >
              <LayoutDashboard size={15} />
              <span>Dashboard & KPIs</span>
            </Link>
            <Link
              href="/orders"
              className="bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-white/10 font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 active:scale-95"
            >
              <ShoppingBag size={15} />
              <span>Live Orders</span>
            </Link>
          </div>
        </div>

        {/* ── DEPARTMENT WORKSPACES FOR STORE MANAGERS ─────────────── */}
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-white/5 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <Sparkles size={16} className="text-orange-500" />
                <span>Station Workspaces & Live Operation Previews</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Inspect or operate specialized portals for any kitchen department.
              </p>
            </div>

            {adminPreviewRole && (
              <button
                onClick={() => setAdminPreviewRole(null)}
                className="text-xs font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
              >
                ✕ Close Preview
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
                      ? "bg-orange-500 text-white border-orange-500 shadow-xs"
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

        {/* 4 Standard Action Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Live Orders Queue",
              desc: "Incoming tickets, cooking states, and handoff actions.",
              icon: ShoppingBag,
              href: "/orders",
            },
            {
              title: "Dishes & Menu",
              desc: "Catalog prices, descriptions, and stock availability.",
              icon: UtensilsCrossed,
              href: "/products",
            },
            {
              title: "Partner Messages",
              desc: "Official directives and updates from Superadmin.",
              icon: Bell,
              href: "/updates",
            },
            {
              title: "Kitchen Standards",
              desc: "Hygiene, packaging, and food prep SOPs.",
              icon: ShieldCheck,
              href: "/standards",
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                href={item.href}
                className="group p-5 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/80 dark:border-white/10 hover:border-orange-500/60 transition shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3">
                    <Icon size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-orange-500 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-white/5 flex items-center justify-between text-xs font-bold text-orange-500">
                  <span>Open</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. GUEST VIEW: Clean Operational Portal
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-12 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[70vh] font-jakarta">
      <div className="w-full bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-lg text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto shadow-xs">
          <ChefHat size={28} />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 dark:text-white">
            Restaurant Operations Hub
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-2 max-w-md mx-auto leading-relaxed">
            Manage your kitchen orders, dispatch transit, cashier registers, and catalog stock across पेट Protocols.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <Link
            href="/login"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm py-3 px-6 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Lock size={15} />
            <span>Store Manager Sign In</span>
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/login/staff"
            className="w-full bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-white/10 font-bold text-xs sm:text-sm py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <ChefHat size={15} className="text-emerald-500" />
            <span>Staff Station Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
