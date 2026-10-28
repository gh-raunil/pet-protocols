"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Eye,
  EyeOff,
  Check,
  X,
  Lock,
  Mail,
  User as UserIcon,
  Sparkles,
  ShieldCheck,
  Zap,
  MapPin,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "@/components/ui/ToastProvider";

import {
  getSafeCallbackUrl,
  getUtf8ByteLength,
  isAuthLoopPath,
} from "@/lib/authHelpers";

export { getSafeCallbackUrl, getUtf8ByteLength, isAuthLoopPath };

/**
 * Official multi-color Google 'G' brand mark SVG.
 */
function GoogleLogo({ className = "w-5 h-5 shrink-0" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function AuthSplitScreen({ initialTab = "signin" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallback = searchParams?.get("callbackUrl");
  const callbackUrl = getSafeCallbackUrl(rawCallback, "/menu");

  const [activeTab, setActiveTab] = useState(initialTab); // "signin" | "signup"

  // Tab button refs for WAI-ARIA arrow key navigation
  const signInTabRef = React.useRef(null);
  const signUpTabRef = React.useRef(null);

  // Synchronous in-flight guards to prevent concurrent double-submissions
  const signInInFlightRef = React.useRef(false);
  const signUpInFlightRef = React.useRef(false);

  // Sign In state
  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [showSignInPass, setShowSignInPass] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState("");

  // Sign Up state
  const [signUpData, setSignUpData] = useState({ name: "", email: "", password: "" });
  const [showSignUpPass, setShowSignUpPass] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpError, setSignUpError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  // Keep state synchronized if initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
    setSignInError("");
    setSignUpError("");
    setSuccessNotice("");
  }, [initialTab]);

  // Tab switch handler with URLSearchParams synchronization (never preserves untrusted raw callback)
  const handleSwitchTab = (tab) => {
    setActiveTab(tab);
    setSignInError("");
    setSignUpError("");
    setSuccessNotice("");

    const targetPath = tab === "signin" ? "/auth/login" : "/auth/signup";

    // Build sanitized query parameters using URLSearchParams
    const newSearchParams = new URLSearchParams();
    const safeCallback = getSafeCallbackUrl(rawCallback, null);
    if (safeCallback && safeCallback !== "/menu") {
      newSearchParams.set("callbackUrl", safeCallback);
    }

    if (searchParams) {
      const ALLOWED_QUERY_PARAMS = [
        "table",
        "ref",
        "source",
        "restaurant",
        "step",
        "utm_source",
        "utm_medium",
        "utm_campaign",
      ];
      for (const key of ALLOWED_QUERY_PARAMS) {
        const val = searchParams.get(key);
        if (val && typeof val === "string" && !/[\u0000-\u001F\u007F]/.test(val)) {
          newSearchParams.set(key, val.slice(0, 200));
        }
      }
    }

    const queryString = newSearchParams.toString();
    const targetUrl = queryString ? `${targetPath}?${queryString}` : targetPath;
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", targetUrl);
    }
  };

  // WAI-ARIA tab keyboard navigation handler
  const handleTabKeyDown = (e, currentTab) => {
    let targetTab = null;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      targetTab = currentTab === "signin" ? "signup" : "signin";
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      targetTab = currentTab === "signin" ? "signup" : "signin";
    } else if (e.key === "Home") {
      e.preventDefault();
      targetTab = "signin";
    } else if (e.key === "End") {
      e.preventDefault();
      targetTab = "signup";
    }

    if (targetTab && targetTab !== currentTab) {
      handleSwitchTab(targetTab);
      if (targetTab === "signin") {
        signInTabRef.current?.focus();
      } else {
        signUpTabRef.current?.focus();
      }
    }
  };

  // Sign In Submit
  const handleSignInSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    // Synchronous in-flight guard prevents duplicate concurrent executions
    if (signInInFlightRef.current) return;
    signInInFlightRef.current = true;

    try {
      const email = signInData.email.trim().toLowerCase();
      const password = signInData.password;

      if (!email || !password) {
        setSignInError("Please enter your email and password.");
        return;
      }

      setSignInLoading(true);
      setSignInError("");
      setSuccessNotice("");

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const errorMsg = String(result.error);
        if (errorMsg.toLowerCase().includes("too many") || errorMsg.toLowerCase().includes("wait")) {
          setSignInError(errorMsg);
        } else {
          setSignInError("Invalid email address or password.");
        }
        return;
      }

      if (result?.ok) {
        toast.success("Welcome back to पेट Protocols!");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      console.error("[Auth] Login error:", err);
      setSignInError("An unexpected error occurred. Please check your connection.");
    } finally {
      signInInFlightRef.current = false;
      setSignInLoading(false);
    }
  };

  // Live password strength calculation aligned with backend validation rules:
  // - Minimum 8 characters
  // - At least one letter
  // - At least one digit or symbol
  // - Maximum 72 UTF-8 bytes (prevents bcrypt truncation and algorithmic DoS)
  const password = signUpData.password;
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
  const byteLength = getUtf8ByteLength(password);
  const isWithinMax = byteLength <= 72;

  let criteriaCount = 0;
  if (hasMinLength) criteriaCount++;
  if (hasLetter) criteriaCount++;
  if (hasNumberOrSymbol) criteriaCount++;

  let strengthLabel = "Weak";
  let strengthColor = "bg-rose-500";
  let strengthTextColor = "text-rose-500";
  if (!isWithinMax) {
    strengthLabel = "Over limit";
    strengthColor = "bg-rose-500";
    strengthTextColor = "text-rose-500";
  } else if (criteriaCount === 2) {
    strengthLabel = "Fair";
    strengthColor = "bg-amber-500";
    strengthTextColor = "text-amber-500";
  } else if (criteriaCount === 3) {
    strengthLabel = "Strong";
    strengthColor = "bg-emerald-500";
    strengthTextColor = "text-emerald-500";
  }

  // Sign Up Submit
  const handleSignUpSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    // Synchronous in-flight guard prevents duplicate concurrent executions
    if (signUpInFlightRef.current) return;
    signUpInFlightRef.current = true;

    try {
      const name = signUpData.name.trim();
      const email = signUpData.email.trim().toLowerCase();
      const pwd = signUpData.password;

      if (!name) {
        setSignUpError("Please enter your full name.");
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setSignUpError("Please enter a valid email address.");
        return;
      }

      if (!hasMinLength) {
        setSignUpError("Password must be at least 8 characters long.");
        return;
      }

      if (!isWithinMax) {
        setSignUpError("Password exceeds maximum length (72 bytes).");
        return;
      }

      if (!hasLetter || !hasNumberOrSymbol) {
        setSignUpError("Password must contain at least one letter and at least one number or special character.");
        return;
      }

      setSignUpLoading(true);
      setSignUpError("");
      setSuccessNotice("");

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: pwd }),
      });

      const data = await response.json();

      if (!data.success) {
        setSignUpError(data.message || "Unable to create your account. Please try again.");
        return;
      }

      // Automatic Authentication after successful signup
      toast.success("Account created! Signing you in...");
      const autoSignIn = await signIn("credentials", {
        email,
        password: pwd,
        redirect: false,
      });

      if (autoSignIn?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        // Fallback if automatic sign-in encounters rate-limit or delay
        setActiveTab("signin");
        setSignInData({ email, password: "" });
        setSuccessNotice("Account created successfully! Please enter your password to sign in.");
      }
    } catch (err) {
      console.error("[Auth] Signup error:", err);
      setSignUpError("An unexpected error occurred. Please check your connection.");
    } finally {
      signUpInFlightRef.current = false;
      setSignUpLoading(false);
    }
  };

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    await signIn("google", { callbackUrl });
  };

  return (
    <main className="min-h-screen w-full bg-[var(--bg-main)] text-[var(--text-main)] transition-colors grid grid-cols-1 lg:grid-cols-12 overflow-x-hidden pt-20 sm:pt-24 lg:pt-24">
      {/* ═══════════════════════════════════════════════════════════════
          LEFT COLUMN: BRANDED FOOD-PHOTOGRAPHY EXPERIENCE (DESKTOP)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-5 xl:col-span-6 relative hidden lg:flex flex-col justify-between p-8 xl:p-12 overflow-hidden bg-stone-950">
        {/* High-Resolution Background Food Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/deals-curry-spread.jpg"
            alt="पेट Protocols gourmet dining experience"
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 0px"
            className="object-cover object-center scale-105"
          />
          {/* Subtle Dark Charcoal & Ambient Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090D12] via-[#090D12]/80 to-[#090D12]/45 backdrop-blur-[1px]" />
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[var(--brand-accent)]/15 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Top Header: Brand Logo & Title */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] rounded-2xl p-1">
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-black/60 border border-white/15 p-1 flex items-center justify-center backdrop-blur-md shadow-xl group-hover:scale-105 transition-transform duration-200">
              <Image
                src="/images/logo1.png"
                alt="पेट Protocols Logo"
                width={40}
                height={40}
                className="object-contain w-full h-full"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tight text-white group-hover:text-[var(--brand-accent)] transition-colors leading-tight">
                पेट Protocols
              </span>
              <span className="text-[11px] text-zinc-400 font-medium leading-tight">
                Fresh food. Zero compromises.
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 bg-black/30 backdrop-blur-md transition flex items-center gap-1.5"
          >
            <span>Back to website</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Center / Bottom Value Narrative */}
        <div className="relative z-10 space-y-6 my-auto pt-16 pb-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] text-xs font-bold uppercase tracking-wider backdrop-blur-md">
            <Sparkles size={13} />
            <span>Curated Culinary Standards</span>
          </div>

          <h1 className="text-3xl xl:text-4xl 2xl:text-5xl font-black text-white tracking-tight leading-tight">
            Exceptional meals, crafted fresh for you and your pets.
          </h1>

          <p className="text-sm xl:text-base text-zinc-300 font-normal leading-relaxed">
            Experience cloud kitchen dining with transparent ingredient sourcing, lightning-fast doorstep delivery, and zero compromises on taste or hygiene.
          </p>

          {/* Genuine Feature Badges */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1">
              <Zap size={18} className="text-[var(--brand-accent)]" />
              <div className="text-xs font-bold text-white">Fast Dispatch</div>
              <div className="text-[10px] text-zinc-400">Order-to-kitchen link</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1">
              <ShieldCheck size={18} className="text-emerald-400" />
              <div className="text-xs font-bold text-white">Zero Compromise</div>
              <div className="text-[10px] text-zinc-400">Verified clean prep</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1">
              <MapPin size={18} className="text-amber-400" />
              <div className="text-xs font-bold text-white">Live Tracking</div>
              <div className="text-[10px] text-zinc-400">Pinpoint GPS updates</div>
            </div>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="relative z-10 text-xs text-zinc-500 font-medium">
          © {new Date().getFullYear()} पेट Protocols Inc. All rights reserved.
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT COLUMN: REFINED AUTHENTICATION CARD & FORM
          ═══════════════════════════════════════════════════════════════ */}
      <div className="col-span-12 lg:col-span-7 xl:col-span-6 flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 py-10 sm:py-14 lg:py-16 min-h-screen relative pt-8 sm:pt-10 lg:pt-20">
        {/* Subtle background ambient lighting on right */}
        <div className="absolute top-1/4 right-0 w-80 h-80 bg-[var(--brand-accent)]/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="w-full max-w-[440px] space-y-6">
          {/* Mobile-Only Header Brand Bar */}
          <div className="lg:hidden flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-black p-1 border border-[var(--brand-accent)]/30 shrink-0">
                <Image src="/images/logo1.png" alt="पेट Protocols Logo" width={36} height={36} className="object-contain w-full h-full" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-[var(--text-main)]">
                पेट Protocols
              </span>
            </Link>
            <Link href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold flex items-center gap-1">
              <span>Home</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* Form Header Title */}
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
              {activeTab === "signin" ? "Welcome back" : "Join पेट Protocols"}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              {activeTab === "signin"
                ? "Sign in to access your orders, saved addresses, and faster checkout."
                : "Create an account for personalized menus, order tracking, and member offers."}
            </p>
          </div>

          {/* ── SEGMENTED TAB SWITCHER WITH SLIDING ANIMATION ── */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="relative grid grid-cols-2 p-1 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] overflow-hidden"
          >
            {/* Smooth animated sliding background pill */}
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-[var(--bg-card)] shadow-xs border border-[var(--border-color)]/60 transition-transform duration-300 ease-out"
              style={{
                transform: activeTab === "signin" ? "translateX(4px)" : "translateX(calc(100% + 4px))",
              }}
              aria-hidden="true"
            />

            <button
              ref={signInTabRef}
              type="button"
              role="tab"
              id="tab-signin"
              tabIndex={activeTab === "signin" ? 0 : -1}
              aria-selected={activeTab === "signin"}
              aria-controls="panel-signin"
              onKeyDown={(e) => handleTabKeyDown(e, "signin")}
              onClick={() => handleSwitchTab("signin")}
              className={`relative z-10 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] ${
                activeTab === "signin"
                  ? "text-[var(--text-main)] font-extrabold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <UserIcon size={15} />
              <span>Sign In</span>
            </button>

            <button
              ref={signUpTabRef}
              type="button"
              role="tab"
              id="tab-signup"
              tabIndex={activeTab === "signup" ? 0 : -1}
              aria-selected={activeTab === "signup"}
              aria-controls="panel-signup"
              onKeyDown={(e) => handleTabKeyDown(e, "signup")}
              onClick={() => handleSwitchTab("signup")}
              className={`relative z-10 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] ${
                activeTab === "signup"
                  ? "text-[var(--text-main)] font-extrabold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <Sparkles size={15} />
              <span>Create Account</span>
            </button>
          </div>

          {/* Success Banner Notice (e.g. after registration redirect) */}
          {successNotice && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-start gap-2.5 animate-[fadeIn_0.2s_ease]"
            >
              <Check size={16} className="shrink-0 mt-0.5" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              SIGN IN TAB PANEL
              ═════════════════════════════════════════════════════════ */}
          {activeTab === "signin" && (
            <div
              role="tabpanel"
              id="panel-signin"
              aria-labelledby="tab-signin"
              className="space-y-4 auth-fade-slide"
            >
              <form onSubmit={handleSignInSubmit} className="space-y-4" noValidate>
                {/* Email Address Field */}
                <div className="space-y-1.5">
                  <label htmlFor="signin-email" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={16} className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="signin-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="alex@example.com"
                      value={signInData.email}
                      onChange={(e) => {
                        setSignInData((prev) => ({ ...prev, email: e.target.value }));
                        setSignInError("");
                      }}
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)]/60 outline-none focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Password Field with Eye Toggle */}
                <div className="space-y-1.5">
                  <label htmlFor="signin-password" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={16} className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="signin-password"
                      type={showSignInPass ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={signInData.password}
                      onChange={(e) => {
                        setSignInData((prev) => ({ ...prev, password: e.target.value }));
                        setSignInError("");
                      }}
                      required
                      className="w-full pl-10 pr-12 py-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)]/60 outline-none focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPass(!showSignInPass)}
                      aria-label={showSignInPass ? "Hide password" : "Show password"}
                      className="absolute right-1 w-10 h-10 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
                    >
                      {showSignInPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Accessible Error Notice */}
                {signInError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center gap-2 animate-[fadeIn_0.2s_ease]"
                  >
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{signInError}</span>
                  </div>
                )}

                {/* Primary Sign In Button */}
                <button
                  type="submit"
                  disabled={signInLoading}
                  className="w-full py-3.5 rounded-xl bg-[var(--brand-accent)] hover:opacity-95 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-[var(--brand-accent)]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {signInLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>

              {/* OR Divider */}
              <div className="flex items-center gap-4 my-5">
                <div className="flex-1 h-px bg-[var(--border-color)]" />
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Or continue with
                </span>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
              </div>

              {/* Multi-Color Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-sub)] hover:bg-[var(--bg-card)] text-[var(--text-main)] text-sm font-bold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs active:scale-[0.99] hover:border-[var(--brand-accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
              >
                <GoogleLogo />
                <span>Continue with Google</span>
              </button>

              {/* Switch to Signup Prompt */}
              <p className="text-center text-xs text-[var(--text-muted)] pt-2">
                Don&apos;t have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => handleSwitchTab("signup")}
                  className="text-[var(--brand-accent)] font-bold hover:underline cursor-pointer"
                >
                  Create one now
                </button>
              </p>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              SIGN UP TAB PANEL
              ═════════════════════════════════════════════════════════ */}
          {activeTab === "signup" && (
            <div
              role="tabpanel"
              id="panel-signup"
              aria-labelledby="tab-signup"
              className="space-y-4 auth-fade-slide"
            >
              <form onSubmit={handleSignUpSubmit} className="space-y-4" noValidate>
                {/* Full Name Field */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-name" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <UserIcon size={16} className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="signup-name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      placeholder="e.g. Jordan Smith"
                      value={signUpData.name}
                      onChange={(e) => {
                        setSignUpData((prev) => ({ ...prev, name: e.target.value }));
                        setSignUpError("");
                      }}
                      required
                      maxLength={100}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)]/60 outline-none focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Email Address Field */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-email" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={16} className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="signup-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="alex@example.com"
                      value={signUpData.email}
                      onChange={(e) => {
                        setSignUpData((prev) => ({ ...prev, email: e.target.value }));
                        setSignUpError("");
                      }}
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)]/60 outline-none focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Password Field with Eye Toggle */}
                <div className="space-y-1.5">
                  <label htmlFor="signup-password" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={16} className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      id="signup-password"
                      type={showSignUpPass ? "text" : "password"}
                      name="password"
                      autoComplete="new-password"
                      placeholder="Create a strong password"
                      value={signUpData.password}
                      onChange={(e) => {
                        setSignUpData((prev) => ({ ...prev, password: e.target.value }));
                        setSignUpError("");
                      }}
                      required
                      minLength={8}
                      maxLength={72}
                      className="w-full pl-10 pr-12 py-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)]/60 outline-none focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPass(!showSignUpPass)}
                      aria-label={showSignUpPass ? "Hide password" : "Show password"}
                      className="absolute right-1 w-10 h-10 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
                    >
                      {showSignUpPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* ── LIVE PASSWORD STRENGTH INDICATOR ── */}
                  {password.length > 0 && (
                    <div className="pt-2 space-y-2 animate-[fadeIn_0.2s_ease]">
                      {/* Segmented Strength Bar */}
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 flex-1 rounded-full transition-colors ${criteriaCount >= 1 ? strengthColor : "bg-[var(--border-color)]"}`} />
                        <div className={`h-1.5 flex-1 rounded-full transition-colors ${criteriaCount >= 2 ? strengthColor : "bg-[var(--border-color)]"}`} />
                        <div className={`h-1.5 flex-1 rounded-full transition-colors ${criteriaCount >= 3 ? strengthColor : "bg-[var(--border-color)]"}`} />
                        <span className={`text-[11px] font-bold ${strengthTextColor} pl-1 uppercase tracking-wider`}>
                          {strengthLabel}
                        </span>
                      </div>

                      {/* Criteria Checklist */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                        <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-500 font-semibold" : "text-[var(--text-muted)]"}`}>
                          {hasMinLength ? <Check size={12} /> : <span className="w-3 h-3 rounded-full border border-[var(--border-color)] inline-block" />}
                          <span>8+ characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasLetter ? "text-emerald-500 font-semibold" : "text-[var(--text-muted)]"}`}>
                          {hasLetter ? <Check size={12} /> : <span className="w-3 h-3 rounded-full border border-[var(--border-color)] inline-block" />}
                          <span>At least 1 letter</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasNumberOrSymbol ? "text-emerald-500 font-semibold" : "text-[var(--text-muted)]"}`}>
                          {hasNumberOrSymbol ? <Check size={12} /> : <span className="w-3 h-3 rounded-full border border-[var(--border-color)] inline-block" />}
                          <span>1 number or symbol</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${isWithinMax ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}`}>
                          {isWithinMax ? <Check size={12} /> : <X size={12} />}
                          <span>Under 72 bytes ({byteLength}/72)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Accessible Error Notice */}
                {signUpError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center gap-2 animate-[fadeIn_0.2s_ease]"
                  >
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{signUpError}</span>
                  </div>
                )}

                {/* Primary Create Account Button */}
                <button
                  type="submit"
                  disabled={signUpLoading}
                  className="w-full py-3.5 rounded-xl bg-[var(--brand-accent)] hover:opacity-95 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-[var(--brand-accent)]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {signUpLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>
              </form>

              {/* OR Divider */}
              <div className="flex items-center gap-4 my-5">
                <div className="flex-1 h-px bg-[var(--border-color)]" />
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Or register with
                </span>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
              </div>

              {/* Multi-Color Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-sub)] hover:bg-[var(--bg-card)] text-[var(--text-main)] text-sm font-bold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs active:scale-[0.99] hover:border-[var(--brand-accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
              >
                <GoogleLogo />
                <span>Continue with Google</span>
              </button>

              {/* Switch to Sign In Prompt */}
              <p className="text-center text-xs text-[var(--text-muted)] pt-2">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleSwitchTab("signin")}
                  className="text-[var(--brand-accent)] font-bold hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </p>
            </div>
          )}

          {/* Privacy & Terms Note */}
          <div className="pt-4 text-center">
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              By continuing, you agree to पेट Protocols{" "}
              <Link href="/terms" className="underline hover:text-[var(--text-main)]">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-[var(--text-main)]">
                Privacy Policy
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
