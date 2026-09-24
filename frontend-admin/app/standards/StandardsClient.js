"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Clock,
  PackageCheck,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export default function StandardsClient() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/standards");
    }
  }, [status, router]);

  const standards = [
    {
      title: "Preparation Timeline",
      rule: "Max 15 Minutes Prep Time",
      desc: "Orders must be acknowledged within 2 minutes of receipt. Total kitchen prep time from ticket arrival to packaging must not exceed 15 minutes.",
      icon: Clock,
    },
    {
      title: "Tamper-Evident Packaging",
      rule: "Double Security Seal Mandate",
      desc: "Every delivered order must be packed in food-safe containers with official tamper-evident seals to protect food hygiene during delivery handoff.",
      icon: PackageCheck,
    },
    {
      title: "Veg & Non-Veg Separation",
      rule: "100% Segregated Fryers & Cooking Oils",
      desc: "Kitchens handling both vegetarian and non-vegetarian menus must maintain strictly separate fryers, oils, and cooking utensils at all times.",
      icon: Thermometer,
    },
    {
      title: "Allergen Transparency",
      rule: "Accurate Ingredient Declarations",
      desc: "Menu listings must declare common allergens (nuts, dairy, gluten, soy) to protect customer safety and maintain food trust.",
      icon: ShieldCheck,
    },
  ];

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto font-jakarta bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-white transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Kitchen Standards
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Mandatory hygiene, preparation, and packaging SOPs for all partner kitchens.
          </p>
        </div>

        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition shadow-sm w-fit"
        >
          <span>Open Orders</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* 4 Clean SOP Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {standards.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className="bg-white dark:bg-[#10141f] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                    <Icon size={20} />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    SOP-0{idx + 1}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  {s.title}
                </h3>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2.5 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>{s.rule}</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {s.desc}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>Verified in Quality Checks</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
