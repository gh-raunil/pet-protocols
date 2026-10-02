"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Download,
  Smartphone,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  UtensilsCrossed,
  ShoppingBag,
  Clock,
  Zap,
  ArrowRight,
  Copy,
  Check,
} from "lucide-react";

export default function DownloadClient() {
  const [openFaq, setOpenFaq] = useState(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleCopyFingerprint = () => {
    navigator.clipboard.writeText("A7:F1:5C:26:FD:E6:E0:26:A3:1B:58:03:F3:C2:DD:0F:36:CE:D8:F0:2F:D2:41:88:76:D5:FB:B7:38:CB:AB:74");
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2500);
  };

  const faqs = [
    {
      q: "Is this available on Google Play?",
      a: "Currently, we distribute the Pet Protocols Android app directly through our official website to deliver immediate updates, optimal performance, and zero store restrictions. A Google Play Store release is planned for a future phase.",
    },
    {
      q: "Is installing this APK safe?",
      a: "Yes, absolutely 100% safe. The APK is compiled directly from our verified production codebase and cryptographically signed with our verified release certificate. Android shows a standard 'Unknown source' alert for any app downloaded outside Google Play, which is normal for direct APK distribution.",
    },
    {
      q: "How do I update the app in the future?",
      a: "Whenever a new version is released, simply visit this /download page and install the latest APK. The Android package installer will update your existing application seamlessly without losing your login session or order history.",
    },
    {
      q: "Which Android devices are supported?",
      a: "Pet Protocols is built with Android API 21+ support, making it compatible with virtually all Android smartphones and tablets running Android 5.0 (Lollipop) through the latest Android 15 and 16 releases.",
    },
  ];

  const steps = [
    {
      num: "01",
      title: "Download the APK",
      desc: "Tap the prominent 'Download for Android' button to download pet-protocols-1.1.apk directly to your device.",
    },
    {
      num: "02",
      title: "Open the downloaded file",
      desc: "Once the 3.4 MB download completes, tap the download notification or open your device's Downloads folder.",
    },
    {
      num: "03",
      title: "Allow installation from this source",
      desc: "If Android displays 'Install unknown apps', tap Settings and toggle 'Allow from this source'.",
    },
    {
      num: "04",
      title: "Tap Install",
      desc: "Confirm installation on the Android package installer prompt to complete the setup.",
    },
    {
      num: "05",
      title: "Open Pet Protocols",
      desc: "Launch the app directly from your home screen or app drawer to enjoy instant, full-screen food ordering!",
    },
  ];

  const features = [
    {
      icon: UtensilsCrossed,
      title: "Browse restaurants and menus",
      desc: "Explore top cloud kitchens and gourmet dining spots with curated categorized menus, real-time dish pricing, and dietary tags.",
    },
    {
      icon: ShoppingBag,
      title: "Easy cart and checkout",
      desc: "Add dishes from multiple partner kitchens, customize meals, and checkout effortlessly with secure online payment options.",
    },
    {
      icon: Clock,
      title: "Track your orders",
      desc: "Follow transparent real-time status updates through kitchen confirmation, preparation, packing, and doorstep dispatch.",
    },
    {
      icon: Zap,
      title: "Seamless food ordering",
      desc: "Enjoy native app speed with instant touch feedback, push notification updates, and zero browser navigation distractions.",
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] selection:bg-[var(--brand-accent)] selection:text-white pt-28 pb-24 px-4 sm:px-6 lg:px-8 w-full overflow-x-hidden transition-colors">
      {/* ── AMBIENT GLOW EFFECTS ── */}
      <div className="relative max-w-6xl mx-auto w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-12 w-[280px] sm:w-[500px] h-[280px] bg-[var(--brand-accent)]/15 blur-[100px] rounded-full pointer-events-none -z-10" />

        {/* ── HERO SECTION ── */}
        <section className="text-center pt-4 pb-12 sm:pb-20 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/25 text-[var(--brand-accent)] text-xs font-bold uppercase tracking-wider mb-6 animate-pulse">
            <Sparkles size={13} /> Official Android Release
          </div>

          <div className="flex justify-center mb-6">
            <div className="relative p-2 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] shadow-xl transition-colors">
              <Image
                src="/icons/icon-512x512.png"
                alt="Pet Protocols App Icon"
                width={80}
                height={80}
                className="rounded-2xl object-cover shadow-inner"
                priority
              />
              <div className="absolute -bottom-2 -right-2 bg-[var(--brand-accent)] text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                v1.0.0
              </div>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[var(--text-main)] mb-4 px-2 break-words transition-colors">
            Your food. <span className="text-[var(--brand-accent)]">Your way.</span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-[var(--text-muted)] max-w-xl mx-auto mb-8 font-normal leading-relaxed px-2 transition-colors">
            Order faster. Enjoy better. Get the Pet Protocols app.
          </p>

          {/* Download CTA Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto mb-6 px-2">
            <a
              href="/downloads/pet-protocols-release.apk"
              download="pet-protocols-1.1.apk"
              id="android-download-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-[var(--brand-accent)] hover:opacity-90 active:scale-[0.98] text-white text-base font-extrabold transition duration-200 shadow-xl shadow-[var(--brand-accent)]/25 group"
            >
              <Download size={20} className="group-hover:-translate-y-0.5 transition-transform" />
              <span>Download for Android</span>
            </a>

            <Link
              href="/menu"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-main)] text-sm font-semibold transition duration-200 shadow-sm"
            >
              <span>Explore Web Menu</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* APK Meta Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-muted)] font-medium px-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] shadow-sm transition-colors">
              <Smartphone size={13} className="text-[var(--brand-accent)]" /> Android 5.0+
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] shadow-sm transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 3.44 MB
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] shadow-sm transition-colors">
              <ShieldCheck size={13} className="text-emerald-500" /> Signed APK
            </span>
          </div>
        </section>

        {/* ── APP PREVIEWS (REAL ACTUAL APPLICATION UI) ── */}
        <section className="mb-24">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-widest text-[var(--brand-accent)] font-bold mb-2">Interface Preview</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] transition-colors">Experience Seamless Dining</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
            {/* Mobile Screenshot Frame */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[280px] sm:max-w-[300px] p-3 rounded-[38px] bg-[var(--bg-card)] dark:bg-gradient-to-b dark:from-zinc-700 dark:via-zinc-900 dark:to-black border-2 border-[var(--border-color)] shadow-2xl transition-colors">
                <div className="relative rounded-[30px] overflow-hidden border border-[var(--border-color)] bg-black aspect-[9/16]">
                  <Image
                    src="/screenshots/mobile-home.png"
                    alt="Pet Protocols Mobile Application Experience"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 320px"
                  />
                </div>
                {/* Speaker pill */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-16 h-1 bg-[var(--border-color)] rounded-full" />
              </div>
            </div>

            {/* Desktop / Tablet Feature View */}
            <div className="lg:col-span-7 space-y-6">
              <div className="relative rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl transition-colors">
                <div className="px-4 py-3 bg-[var(--bg-sub)] border-b border-[var(--border-color)] flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">pet-protocols.vercel.app</span>
                  <div className="w-8" />
                </div>
                <div className="relative aspect-[16/9]">
                  <Image
                    src="/screenshots/desktop-home.png"
                    alt="Pet Protocols Desktop Experience"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 100vw, 600px"
                  />
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2 shadow-sm transition-colors">
                <div className="flex items-center gap-2 text-[var(--brand-accent)] font-bold text-sm">
                  <ShieldCheck size={18} />
                  <span>Native Fullscreen Android Experience</span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed transition-colors">
                  When launched from your home screen, Pet Protocols runs in dedicated standalone mode with no browser URL bar or navigation buttons. The seamless interface matches your system theme for an immersive dining experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CORE FEATURES ── */}
        <section className="mb-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs uppercase tracking-widest text-[var(--brand-accent)] font-bold mb-2">Designed For Foodies</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--text-main)] mb-4 break-words px-2 transition-colors">Everything You Need To Dine Well</h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] px-4 transition-colors">
              Built with precision to make finding, ordering, and enjoying fresh meals effortless.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/50 transition duration-200 shadow-sm hover:shadow-md space-y-3 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/25 text-[var(--brand-accent)] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon size={22} />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed font-normal transition-colors">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── INSTALLATION INSTRUCTIONS ── */}
        <section className="mb-24 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-[var(--brand-accent)] font-bold mb-2">Quick Setup Guide</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--text-main)] mb-4 break-words px-2 transition-colors">How To Install The APK</h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-xl mx-auto px-4 transition-colors">
              Follow these simple steps on your Android device to install Pet Protocols in under 60 seconds.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start gap-4 sm:gap-6 hover:border-[var(--brand-accent)]/40 transition shadow-sm"
              >
                <div className="shrink-0 w-10 h-10 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--brand-accent)] font-mono font-black flex items-center justify-center text-sm shadow-inner transition-colors">
                  {step.num}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-bold text-[var(--text-main)] transition-colors">{step.title}</h4>
                  <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed transition-colors">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center px-2">
            <a
              href="/downloads/pet-protocols-release.apk"
              download="pet-protocols-1.1.apk"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--brand-accent)] hover:opacity-90 text-white text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-[var(--brand-accent)]/20"
            >
              <Download size={16} />
              <span>Download APK Now (3.44 MB)</span>
            </a>
          </div>
        </section>

        {/* ── FREQUENTLY ASKED QUESTIONS (FAQ) ── */}
        <section className="mb-24 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-[var(--brand-accent)] font-bold mb-2">Got Questions?</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[var(--text-main)] mb-4 break-words px-2 transition-colors">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden transition shadow-sm"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 font-semibold text-sm sm:text-base text-[var(--text-main)] hover:text-[var(--brand-accent)] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="shrink-0 text-[var(--text-muted)]">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed border-t border-[var(--border-color)] transition-colors">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── VERIFICATION / INTEGRITY FOOTER ── */}
        <section className="p-6 sm:p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] max-w-4xl mx-auto text-center space-y-4 shadow-sm transition-colors">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-main)] transition-colors">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span>Cryptographic Verification & Integrity</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed px-2 transition-colors">
            Every build is signed with Pet Protocols’ official RSA-2048 private key. You can independently verify the SHA-256 certificate digest matching our production domain Digital Asset Links:
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-xl mx-auto bg-[var(--bg-sub)] p-3 rounded-xl border border-[var(--border-color)] text-xs font-mono transition-colors">
            <span className="text-[11px] sm:text-xs text-[var(--text-main)] break-all select-all leading-normal transition-colors">
              A7:F1:5C:26:FD:E6:E0:26:A3:1B:58:03:F3:C2:DD:0F:36:CE:D8:F0:2F:D2:41:88:76:D5:FB:B7:38:CB:AB:74
            </span>
            <button
              onClick={handleCopyFingerprint}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-main)] transition text-xs font-sans font-medium"
              title="Copy Certificate Fingerprint"
            >
              {copiedFingerprint ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span>{copiedFingerprint ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
