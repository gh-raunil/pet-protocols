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
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative overflow-hidden">
      {/* Subtle warm ambient radial glow for light mode, orange aura for dark mode */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-400/10 via-amber-200/5 to-transparent dark:from-orange-500/10 dark:via-transparent dark:to-transparent pointer-events-none" />

      <main className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-12 relative z-10">
        {/* ── CLEAN HERO ─────────────────────────────────────────── */}
        <section className="text-center py-8 sm:py-12 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF7ED] dark:bg-orange-500/10 text-[#C2410C] dark:text-orange-400 text-xs font-bold mb-5 border border-orange-200 dark:border-orange-500/20 shadow-xs">
            <span className="font-extrabold">पेट Protocols</span>
            <span className="text-orange-500 text-[10px]">•</span>
            <span className="font-semibold">Kitchen Management</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#111827] dark:text-white">
            Restaurant <span className="text-[#F97316]">Dashboard</span>
          </h1>

          <p className="text-stone-600 dark:text-stone-400 text-sm sm:text-base mt-3.5 leading-relaxed font-medium">
            Manage your kitchen orders, menu items, and operating settings in real time.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
            {isRestaurantAdmin ? (
              <>
                <Link
                  href="/dashboard"
                  className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition shadow-lg shadow-orange-500/25 flex items-center gap-2 active:scale-95"
                >
                  <LayoutDashboard size={16} />
                  <span>Open Dashboard</span>
                </Link>
                <Link
                  href="/orders"
                  className="bg-white dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-white/10 font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition shadow-xs flex items-center gap-2 active:scale-95"
                >
                  <ShoppingBag size={16} />
                  <span>Live Orders</span>
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition shadow-lg shadow-orange-500/25 flex items-center gap-2 active:scale-95"
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
                className="group p-6 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/80 dark:border-white/10 hover:border-orange-500/60 dark:hover:border-orange-500/60 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-orange-500/10 text-[#F97316] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
                    <Icon size={22} />
                  </div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white group-hover:text-[#F97316] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-stone-100 dark:border-white/5 flex items-center justify-between text-xs font-bold text-[#F97316]">
                  <span>{isRestaurantAdmin ? "Open" : "Sign In to Access"}</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#07090e] py-6 px-6 text-center text-xs text-stone-500 dark:text-stone-400">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} पेट Protocols • Secure Kitchen Network</p>
          <div className="flex items-center gap-4 font-medium">
            <Link href={isRestaurantAdmin ? "/dashboard" : "/login"} className="hover:text-stone-900 dark:hover:text-white transition">
              {isRestaurantAdmin ? "Dashboard" : "Admin Login"}
            </Link>
            <span>•</span>
            <Link href="/standards" onClick={(e) => handleCardClick(e, "/standards")} className="hover:text-stone-900 dark:hover:text-white transition">
              Standards
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

