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
      title: "Orders",
      desc: "Monitor incoming customer tickets and transition orders through preparation to dispatch.",
      icon: ShoppingBag,
      link: "/orders",
      actionText: "Open Orders",
    },
    {
      title: "Menu",
      desc: "Manage dish prices, descriptions, categories, and real-time stock availability.",
      icon: UtensilsCrossed,
      link: "/products",
      actionText: "Manage Menu",
    },
    {
      title: "Standards",
      desc: "Review required preparation times, tamper-evident seals, and food safety SOPs.",
      icon: ShieldCheck,
      link: "/standards",
      actionText: "View Standards",
    },
    {
      title: "Settings",
      desc: "Configure kitchen operating hours, contact phone numbers, and branch address.",
      icon: Settings,
      link: "/settings",
      actionText: "Update Settings",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-white font-jakarta transition-colors">
      <main className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Operational tools for <span className="font-semibold text-orange-500">{restaurantName}</span>.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 font-semibold text-xs transition"
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
                className="bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-orange-500/40 transition group"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors">
                    {t.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {t.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <Link
                    href={t.link}
                    className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1.5 transition"
                  >
                    <span>{t.actionText}</span>
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
