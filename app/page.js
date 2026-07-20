"use client";

import Link from "next/link";
import PopularSection from "./components/layout/PopularSection";

// ── Icons ──────────────────────────────────────────────────────
const ArrowRight = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2.5"
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
const SearchIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#888"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const CartIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2"
  >
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
const ChevronDown = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const LogoutIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const StarFilled = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#f97316" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
const InstagramIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const FacebookIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);
const YoutubeIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M22.54 6.42A2.78 2.78 0 0 0 20.6 4.46C18.88 4 12 4 12 4s-6.88 0-8.6.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.54C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
    <polygon
      points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);
const TwitterIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
  </svg>
);
const DeliveryIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="1.5"
  >
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const LeafIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="1.5"
  >
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);
const ShieldIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="1.5"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const PlateIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="1.5"
  >
    <path d="M3 11l19-9-9 19-2-8-8-2z" />
  </svg>
);
const ChefIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="1.5"
  >
    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
    <line x1="6" y1="17" x2="18" y2="17" />
  </svg>
);
const StarIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="1.5"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
const HeartIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="1.5"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

// ── Data ──────────────────────────────────────────────────────
const categoryIcons = {
  Burgers: "/images/burger.png",
  Pizza: "/images/pizza.png",
  Fries: "/images/fries.png",
  Drinks: "/images/drinks.png",
  Momos: "/images/momos.png",
};

const reviews = [
  {
    name: "Rohit Sharma",
    quote: "The best burgers in town. Always fresh and super delicious!",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Priya Verma",
    quote: "Lightning fast delivery and amazing packaging. Love it every time.",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Ankit Patel",
    quote: "Pet Protocols never disappoints. Highly recommended to everyone.",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
  },
];

// ── Main ────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div
      className="min-h-screen bg-[#000000] text-white"
      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
    >
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative px-8 md:px-14 pt-10 pb-0 overflow-hidden min-h-[520px] flex items-center">
        <div className="absolute left-3 top-16 hidden md:grid grid-cols-4 gap-2 opacity-20 z-10">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-orange-500" />
          ))}
        </div>

        {/* Hero Image */}
        <div
          className="
            absolute
            top-0
            h-full
            pointer-events-none
            z-0

            w-[60%] lg:w-[60%]
            right-0 lg:right-0

            md:w-[80%]
            md:right-[-20%]

            max-md:w-[90%]
            max-md:right-[-35%]
          "
        >
          <img
            src="/images/hero.png"
            alt="Hero food"
            className="
              w-full
              h-full
              object-cover
              object-right
              md:object-right
              lg:object-center
              "
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/20 to-transparent lg:hidden" />
        </div>

        <div className="w-full max-w-7xl mx-auto grid md:grid-cols-2 gap-8 items-center relative z-20">
          <div>
            <div className="flex items-center gap-2 mb-5">
              <span className="text-orange-400 text-sm font-semibold tracking-widest uppercase">
                ✦ GOOD FOOD, GREAT MOOD ✦
              </span>
            </div>
            <h1 className="text-[56px] md:text-[68px] font-extrabold leading-tight">
              <span className="text-white">पेट </span>
              <span className="text-orange-500">Protocols</span>
            </h1>
            <p className="text-gray-300 text-xl mt-3 mb-8 font-light">
              Fresh food. Zero compromises.
            </p>
            <div className="flex flex-wrap gap-4 mb-12">
              <Link
                href="/menu"
                className="flex items-center gap-3 bg-orange-500 hover:bg-orange-600 transition-colors font-bold text-base px-8 py-3.5 rounded-full"
              >
                Order Now <ArrowRight />
              </Link>
              <Link
                href="/menu"
                className="flex items-center gap-3 border border-white/30 hover:border-white/60 transition-colors font-bold text-base px-8 py-3.5 rounded-full"
              >
                Explore Menu
              </Link>
            </div>
            <div className="flex flex-wrap gap-8">
              {[
                {
                  Icon: DeliveryIcon,
                  title: "Fast Delivery",
                  sub: "On time, every time",
                },
                {
                  Icon: LeafIcon,
                  title: "Fresh Ingredients",
                  sub: "Handpicked daily",
                },
                {
                  Icon: ShieldIcon,
                  title: "Premium Quality",
                  sub: "Always the best",
                },
              ].map(({ Icon, title, sub }) => (
                <div key={title} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-orange-500/40 flex items-center justify-center shrink-0">
                    <Icon />
                  </div>
                  <div>
                    <p className="text-orange-500 text-sm font-semibold">
                      {title}
                    </p>
                    <p className="text-gray-500 text-xs">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div />
        </div>
      </section>

      {/* ── CATEGORIES ───────────────────────────────────── */}
      <section className="px-8 md:px-14 py-6">
        <div
          className="
            max-w-7xl mx-auto
            bg-[#0d0d0d]
            border border-white/8
            rounded-2xl
            px-8 py-7
            flex flex-col md:flex-row
            items-center gap-6

            bg-[url('/images/category_img_phone.png')]
            sm:bg-[url('/images/category_img_tab.png')]
            lg:bg-[url('/images/category_img.png')]

            bg-cover
            bg-no-repeat
            bg-center
            md:bg-center
            bg-top
          "
        >
          <div className="flex items-center gap-8 md:gap-12 flex-1 flex-wrap justify-center md:justify-evenly">
            {Object.entries(categoryIcons).map(([name, img]) => (
              <Link
                key={name}
                href={`/menu?category=${name === "Drinks" ? "Cold Drinks" : name}`}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden transition-transform group-hover:scale-110"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 30%, #2a2a2a, #111)",
                    boxShadow:
                      "0 0 0 2px rgba(249,115,22,0.15), inset 0 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  <img
                    src={img}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-sm font-semibold text-white">{name}</span>
              </Link>
            ))}
          </div>
          <div className="hidden md:block w-px h-24 bg-white/10" />
          <div className="text-center md:text-left md:w-48 shrink-0">
            <p className="text-orange-500 font-bold text-lg flex items-center gap-1.5 justify-center md:justify-start">
              🔥 Hot & Fresh
            </p>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">
              Made with love,
              <br />
              served with happiness.
            </p>
          </div>
        </div>
      </section>

      {/* ── POPULAR THIS WEEK ─────────────────────────────── */}
      <PopularSection />

      {/* ── MEGA OFFER ───────────────────────────────────── */}
      <section className="px-8 md:px-14 py-4 max-w-7xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden border border-orange-500/20">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a0a00] via-[#0d0d0d] to-[#1a0a00]" />
          <div
            className="absolute left-0 top-0 h-full w-72 opacity-30"
            style={{
              background:
                "radial-gradient(ellipse at left, rgba(249,115,22,0.4), transparent 70%)",
            }}
          />
          <div
            className="absolute right-0 top-0 h-full w-72 opacity-30"
            style={{
              background:
                "radial-gradient(ellipse at right, rgba(249,115,22,0.4), transparent 70%)",
            }}
          />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between px-10 py-8 gap-6">
            <div>
              <p className="text-orange-400 text-xs font-bold tracking-[0.3em] uppercase mb-2">
                Limited Time Offer
              </p>
              <h3 className="text-4xl md:text-5xl font-extrabold">
                Get <span className="text-orange-500">30% OFF</span>
              </h3>
              <p className="text-gray-400 mt-2">
                On all orders above ₹499. Use code{" "}
                <span className="text-orange-400 font-bold">PET30</span>
              </p>
            </div>
            <Link
              href="/menu"
              className="flex items-center gap-3 bg-orange-500 hover:bg-orange-600 transition-colors font-bold text-base px-8 py-3.5 rounded-full shrink-0 whitespace-nowrap"
            >
              Order Now <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE US ────────────────────────────────── */}
      <section className="px-8 md:px-14 py-14 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-orange-500 text-xs font-bold tracking-[0.3em] uppercase mb-3">
            WHY CHOOSE US
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold">
            Because You Deserve The{" "}
            <span className="text-orange-500">Best</span>
          </h2>
          <div className="flex justify-center mt-4">
            <div className="w-16 h-1 bg-orange-500 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            {
              Icon: PlateIcon,
              title: "Hygienic Food",
              sub: "Prepared in a clean\nand safe environment",
            },
            {
              Icon: ChefIcon,
              title: "Expert Chefs",
              sub: "Crafted by professionals\nwho love what they do",
            },
            {
              Icon: StarIcon,
              title: "Top Rated",
              sub: "Loved by thousands\nof happy customers",
            },
            {
              Icon: HeartIcon,
              title: "Made with Love",
              sub: "Every meal is made\nwith care & passion",
            },
          ].map(({ Icon, title, sub }) => (
            <div key={title} className="flex items-start gap-4 p-2">
              <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 border border-orange-500/35">
                <Icon />
              </div>
              <div>
                <p className="font-bold text-white text-base">{title}</p>
                <p className="text-gray-500 text-sm mt-1 whitespace-pre-line leading-relaxed">
                  {sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── REVIEWS ──────────────────────────────────────── */}
      <section className="px-8 md:px-14 py-10 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold border-l-4 border-orange-500 pl-3">
            What Our Customers Say
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {reviews.map((r) => (
            <div
              key={r.name}
              className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-6 hover:border-orange-500/20 transition"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarFilled key={i} />
                ))}
              </div>
              <p className="text-gray-300 text-sm leading-relaxed mb-5">
                "{r.quote}"
              </p>
              <div className="flex items-center gap-3">
                <img
                  src={r.avatar}
                  alt={r.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-500/30"
                />
                <div>
                  <p className="font-semibold text-sm">{r.name}</p>
                  <p className="text-gray-500 text-xs">Verified Customer</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
