import Link from "next/link";
import { Sparkles, UtensilsCrossed, ShieldCheck, ArrowRight, HeartHandshake, Compass } from "lucide-react";

export const metadata = {
  title: "About Pet Protocols | Fresh Food. Zero Compromises.",
  description:
    "Pet Protocols is a food ordering platform that connects customers with restaurants through a simple and convenient digital ordering experience.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen pt-32 pb-24 px-6 max-w-5xl mx-auto font-jakarta text-white">
      {/* ── HERO BANNER ─────────────────────────────────────────── */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest mb-4">
          <Sparkles size={14} /> About Pet Protocols
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6">
          Fresh food. Zero compromises.
        </h1>
        <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
          Pet Protocols is a food ordering platform that connects customers with restaurants through a simple and convenient digital ordering experience.
        </p>
      </div>

      {/* ── CORE PILLARS ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {/* For Customers */}
        <div className="p-8 rounded-3xl bg-[#0e1013] border border-white/10 hover:border-orange-500/30 transition shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
            <Compass size={24} />
          </div>
          <h2 className="text-xl font-extrabold text-white">
            For Foodies & Customers
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Customers can discover restaurants, explore menus, add dishes to their cart, and place orders with ease.
          </p>
          <ul className="space-y-2 pt-2 text-xs text-gray-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              Real-time multi-kitchen menu exploration
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              Live progress tracker from preparation to doorstep delivery
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              Direct, transparent contact with your favorite kitchens
            </li>
          </ul>
        </div>

        {/* For Restaurants */}
        <div className="p-8 rounded-3xl bg-[#0e1013] border border-white/10 hover:border-orange-500/30 transition shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
            <UtensilsCrossed size={24} />
          </div>
          <h2 className="text-xl font-extrabold text-white">
            For Partner Kitchens
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            For restaurants, Pet Protocols provides tools to manage menus, products, orders, and customer communication from one place.
          </p>
          <ul className="space-y-2 pt-2 text-xs text-gray-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              Interactive Kitchen Display System (KDS) with sound alerts
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              Instant product availability toggling & price management
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              Optional direct customer WhatsApp inquiry integration
            </li>
          </ul>
        </div>
      </div>

      {/* ── VISION & FUTURE STATEMENT ───────────────────────────── */}
      <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#121419] to-[#0a0b0d] border border-white/10 text-center max-w-3xl mx-auto shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
          <HeartHandshake size={22} />
        </div>
        <h3 className="text-lg font-bold text-white">Continuous Innovation</h3>
        <p className="text-sm text-gray-400 leading-relaxed">
          More features are coming as we continue to build the platform. Our commitment is to culinary excellence, transparent operations, and bringing the best dining experiences directly to your home.
        </p>

        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-lg shadow-orange-500/20"
          >
            <span>Explore Menu</span>
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition"
          >
            <span>Contact Us</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
