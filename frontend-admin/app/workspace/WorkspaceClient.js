"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ShoppingBag,
  UtensilsCrossed,
  ShieldCheck,
  Settings,
  ArrowRight,
  LayoutDashboard,
  Layers,
} from "lucide-react";

export default function WorkspaceClient() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/workspace");
    }
  }, [status, router]);

  const restaurantName = session?.user?.restaurantName || "Partner Kitchen";

  const tools = [
    {
      title: "Live Orders Queue",
      desc: "Monitor incoming customer tickets and transition orders through preparation to dispatch.",
      icon: ShoppingBag,
      link: "/orders",
      actionText: "Open Orders",
    },
    {
      title: "Dishes & Menu Catalog",
      desc: "Manage dish prices, descriptions, categories, and real-time stock availability.",
      icon: UtensilsCrossed,
      link: "/products",
      actionText: "Manage Menu",
    },
    {
      title: "Kitchen Standards & SOPs",
      desc: "Review required preparation times, tamper-evident seals, and food safety SOPs.",
      icon: ShieldCheck,
      link: "/standards",
      actionText: "View Standards",
    },
    {
      title: "Branch Configuration",
      desc: "Configure kitchen operating hours, contact phone numbers, and branch address.",
      icon: Settings,
      link: "/settings",
      actionText: "Update Settings",
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 font-jakarta">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold mb-2 border border-orange-500/20">
            <Layers size={14} className="text-orange-500" />
            <span>OPERATIONAL WORKSPACE</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-white">
            Operations Hub
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Operational tools and management stations for <span className="font-semibold text-orange-500">{restaurantName}</span>.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-xs"
        >
          <LayoutDashboard size={14} />
          <span>Dashboard</span>
        </Link>
      </div>

      {/* 4 Clean Tools Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {tools.map((t, idx) => {
          const Icon = t.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:border-orange-500/40 transition group"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4 font-bold">
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white group-hover:text-orange-500 transition-colors">
                  {t.title}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 leading-relaxed">
                  {t.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-100 dark:border-white/5 flex items-center justify-between">
                <Link
                  href={t.link}
                  className="text-xs font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1.5 transition"
                >
                  <span>{t.actionText}</span>
                  <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
