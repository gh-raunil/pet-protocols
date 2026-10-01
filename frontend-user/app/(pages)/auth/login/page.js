"use client";

import { useState } from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { signIn } from "next-auth/react";

import { Chrome, Eye, EyeOff } from "@deemlol/next-icons";



export default function LoginPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // Handle Input Change
  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    // Remove error while typing
    setError("");
  }

  // Handle Login
  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);

      setError("");

      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      // Error
      if (result?.error) {
        setError("Invalid email or password");

        return;
      }

      // Success
      router.push("/menu");
    } catch (error) {
      console.log(error);

      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Google Login
  async function handleGoogleLogin() {
    await signIn("google", {
      callbackUrl: "/menu",
    });
  }

  // password view toggle
  const [showPass, setShowPass] = useState(false);

  return (
    <main
      className="
        min-h-screen
        flex
        items-center
        justify-center
        px-4 sm:px-6
        py-24
        bg-[var(--bg-main)]
        text-[var(--text-main)]
        transition-colors
      "
    >
      <div
        className="
          w-full
          max-w-md
          bg-[var(--bg-card)]
          border
          border-[var(--border-color)]
          rounded-3xl
          p-6 sm:p-8
          shadow-xl
        "
      >
        {/* Heading */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] mb-3 text-xl font-black">
            🍔
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[var(--text-main)]">
            Welcome Back
          </h1>

          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-2">
            Fresh food. Zero compromises.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              placeholder="alex@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              className="
                w-full
                bg-[var(--bg-sub)]
                border
                border-[var(--border-color)]
                rounded-xl
                px-4
                py-2.5
                text-sm
                text-[var(--text-main)]
                placeholder-[var(--text-muted)]/60
                outline-none
                focus:border-[var(--brand-accent)]
                transition
              "
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Password
            </label>
            <div
              className="
                flex
                items-center
                w-full
                bg-[var(--bg-sub)]
                border
                border-[var(--border-color)]
                rounded-xl
                px-4
                py-2.5
                focus-within:border-[var(--brand-accent)]
                transition
              "
            >
              <input
                type={showPass ? "text" : "password"}
                name="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                required
                className="
                  flex-1
                  bg-transparent
                  text-sm
                  text-[var(--text-main)]
                  placeholder-[var(--text-muted)]/60
                  outline-none
                "
              />

              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="
                  text-[var(--text-muted)]
                  hover:text-[var(--text-main)]
                  transition
                  p-1
                "
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && <p className="text-red-500 text-xs text-center font-medium">{error}</p>}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              bg-[var(--brand-accent)]
              text-white
              py-3
              rounded-xl
              text-sm
              font-bold
              hover:opacity-90
              transition
              shadow-lg
              shadow-[var(--brand-accent)]/20
              disabled:opacity-50
            "
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-[1px] bg-[var(--border-color)]" />
          <span className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider">OR</span>
          <div className="flex-1 h-[1px] bg-[var(--border-color)]" />
        </div>

        {/* Google Login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="
            w-full
            border
            border-[var(--border-color)]
            bg-[var(--bg-sub)]
            rounded-xl
            py-2.5
            text-sm
            font-semibold
            text-[var(--text-main)]
            flex
            items-center
            justify-center
            gap-3
            hover:border-[var(--brand-accent)]/50
            transition
          "
        >
          <Chrome size={18} />
          Continue with Google
        </button>

        {/* Signup Link */}
        <p className="text-center text-xs text-[var(--text-muted)] mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-[var(--brand-accent)] font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
