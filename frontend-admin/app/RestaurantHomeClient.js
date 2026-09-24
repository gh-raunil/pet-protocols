"use client";

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
} from "lucide-react";

export default function RestaurantHomeClient() {
  const router = useRouter();
  const { data: session } = useSession();

  const isRestaurantAdmin =
    session?.user?.role === "restaurant_admin" || session?.user?.role === "admin";

  function handleCardClick(e, href) {
    if (!isRestaurantAdmin) {
      e.preventDefault();
      router.push(`/login?callbackUrl=${encodeURIComponent(href)}`);
    }
  }

  const features = [
    {
      title: "Orders",
      desc: "Receive incoming tickets and update kitchen preparation status.",
      icon: ShoppingBag,
      href: "/orders",
    },
    {
      title: "Menu",
      desc: "Update dish prices, descriptions, and item stock availability.",
      icon: UtensilsCrossed,
      href: "/products",
    },
    {
      title: "Messages",
      desc: "Official platform updates and kitchen directives.",
      icon: Bell,
      href: "/updates",
    },
    {
      title: "Standards",
      desc: "Food hygiene, packaging, and dispatch procedures.",
      icon: ShieldCheck,
      href: "/standards",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-white font-jakarta transition-colors">
      <main className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-12">
        {/* ── CLEAN HERO ─────────────────────────────────────────── */}
        <section className="text-center py-6 sm:py-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-semibold mb-4 border border-orange-500/20">
            <span>पेट Protocols</span>
            <span>•</span>
            <span>Kitchen Management</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Restaurant <span className="text-orange-500">Dashboard</span>
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-3 leading-relaxed">
            Manage your kitchen orders, menu items, and operating settings in real time.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            {isRestaurantAdmin ? (
              <>
                <Link
                  href="/dashboard"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2"
                >
                  <LayoutDashboard size={16} />
                  <span>Open Dashboard</span>
                </Link>
                <Link
                  href="/orders"
                  className="bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition flex items-center gap-2"
                >
                  <ShoppingBag size={16} />
                  <span>Live Orders</span>
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs sm:text-sm px-6 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2"
              >
                <Lock size={15} />
                <span>Sign In to Kitchen</span>
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </section>

        {/* ── 4 COMPACT OPERATIONAL TILES ─────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                href={item.href}
                onClick={(e) => handleCardClick(e, item.href)}
                className="group p-6 rounded-2xl bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 hover:border-orange-500/50 transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-orange-500">
                  <span>{isRestaurantAdmin ? "Open" : "Sign In to Access"}</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#07090e] py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} पेट Protocols</p>
          <div className="flex items-center gap-4">
            <Link href={isRestaurantAdmin ? "/dashboard" : "/login"} className="hover:text-slate-900 dark:hover:text-white transition">
              {isRestaurantAdmin ? "Dashboard" : "Admin Login"}
            </Link>
            <span>•</span>
            <Link href="/standards" onClick={(e) => handleCardClick(e, "/standards")} className="hover:text-slate-900 dark:hover:text-white transition">
              Standards
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
