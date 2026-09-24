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
        px-6
        mt-10
        bg-brand-dark
      "
    >
      <div
        className="
          w-full
          max-w-md
          bg-brand-card
          border
          border-brand-border
          rounded-3xl
          p-8
        "
      >
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-5xl font-bold">Continue Your Feast 🍔</h1>

          <p className="text-brand-muted mt-3">Fresh food. Fast delivery.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          {/* Email */}
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            className="
              w-full
              bg-brand-dark
              border
              border-brand-border
              rounded-xl
              px-4
              py-3
              text-white
              placeholder:text-brand-muted
              outline-none
              focus:border-brand-orange
              transition
            "
          />

          {/* Password */}
          <div
            className="
              flex
              items-center
              w-full
              bg-brand-dark
              border
              border-brand-border
              rounded-xl
              px-4
              py-3
              focus-within:border-brand-orange
              transition
            "
          >
            <input
              type={showPass ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="
                flex-1
                bg-transparent
                text-white
                placeholder:text-brand-muted
                outline-none
              "
            />

            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="
              text-brand-muted
              hover:text-white
              transition
            "
            >
              {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Error Message */}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              bg-brand-orange
              text-black
              py-3
              rounded-xl
              font-semibold
              hover:opacity-90
              transition
            "
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-[1px] bg-brand-border" />

          <span className="text-brand-muted text-sm">OR</span>

          <div className="flex-1 h-[1px] bg-brand-border" />
        </div>

        {/* Google Login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="
            w-full
            border
            border-brand-border
            rounded-xl
            py-3
            flex
            items-center
            justify-center
            gap-3
            hover:bg-brand-border
            transition
          "
        >
          <Chrome size={18} />
          Continue with Google
        </button>

        {/* Signup Link */}
        <p className="text-center text-brand-muted mt-8">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-brand-orange">
            Signup
          </Link>
        </p>
      </div>
    </main>
  );
}
