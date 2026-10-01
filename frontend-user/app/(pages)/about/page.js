import Link from "next/link";
import { Sparkles, UtensilsCrossed, ShieldCheck, ArrowRight, HeartHandshake, Compass } from "lucide-react";

export const metadata = {
  title: "About Pet Protocols | Fresh Food. Zero Compromises.",
  description:
    "Pet Protocols is a modern food-ordering platform connecting customers with top kitchens through a seamless digital experience.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-[var(--text-main)] transition-colors">
      {/* ── HERO BANNER ─────────────────────────────────────────── */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/25 text-[var(--brand-accent)] text-xs font-bold uppercase tracking-wider mb-4">
          <Sparkles size={14} /> About Pet Protocols
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[var(--text-main)] mb-6">
          Fresh food. Zero compromises.
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
          Pet Protocols is a curated food platform that connects diners with verified kitchens through a simple, high-performance digital ordering experience.
        </p>
      </div>

      {/* ── CORE PILLARS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {/* For Customers */}
        <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/40 transition shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] flex items-center justify-center">
            <Compass size={24} />
          </div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)]">
            For Diners & Food Lovers
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            Customers can discover partner cloud kitchens, explore menus, add dishes from multiple restaurants, and track preparation progress with complete transparency.
          </p>
          <ul className="space-y-2 pt-2 text-xs text-[var(--text-muted)]">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)]" />
              Real-time multi-kitchen menu exploration
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)]" />
              Honest status stages from order placed to doorstep delivery
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)]" />
              Direct, transparent contact with your favorite kitchens
            </li>
          </ul>
        </div>

        {/* For Restaurants */}
        <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/40 transition shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] flex items-center justify-center">
            <UtensilsCrossed size={24} />
          </div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)]">
            For Partner Kitchens
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            For kitchens and restaurants, Pet Protocols provides robust tools to manage catalogs, live orders, and dispatch operations from one unified platform.
          </p>
          <ul className="space-y-2 pt-2 text-xs text-[var(--text-muted)]">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)]" />
              Interactive Kitchen Display System (KDS) with sound alerts
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)]" />
              Instant dish availability toggles & pricing management
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)]" />
              High culinary standards and verified food hygiene protocols
            </li>
          </ul>
        </div>
      </div>

      {/* ── VISION STATEMENT ────────────────────────────────────── */}
      <div className="p-8 sm:p-10 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center max-w-3xl mx-auto shadow-xl space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] flex items-center justify-center mx-auto">
          <HeartHandshake size={22} />
        </div>
        <h3 className="text-lg font-bold text-[var(--text-main)]">Quality First Approach</h3>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed max-w-xl mx-auto">
          Our commitment is to culinary excellence, transparent operations, and bringing the freshest dining experiences straight to your table.
        </p>

        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white text-xs font-bold transition shadow-lg shadow-[var(--brand-accent)]/20"
          >
            <span>Explore Menu</span>
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40 text-[var(--text-main)] border border-[var(--border-color)] text-xs font-semibold transition"
          >
            <span>Contact Support</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
