"use client";

import { useState } from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { signIn } from "next-auth/react";

import { Chrome } from "@deemlol/next-icons";

export default function SignupPage() {

  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
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

  // Handle Signup
  async function handleSubmit(e) {

    e.preventDefault();

    try {

      setLoading(true);

      setError("");

      const response = await fetch("/api/auth/signup", {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(formData),
      });

      const data = await response.json();

      // Error
      if (!data.success) {

        setError(data.message || "Signup failed");

        return;
      }

      // Success
      router.push("/auth/login");

    } catch (error) {

      console.log(error);

      setError("Something went wrong");

    } finally {

      setLoading(false);
    }
  }

  // Google Signup
  async function handleGoogleSignup() {

    await signIn("google", {
      callbackUrl: "/menu",
    });
  }

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

          <h1 className="text-5xl font-bold">
            Join The Feast 🍕
          </h1>

          <p className="text-brand-muted mt-3">
            Create your account to get started
          </p>

        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-5"
        >

          {/* Name */}
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
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
            "
          />

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
            "
          />

          {/* Password */}
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
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
            "
          />

          {/* Error Message */}
          {error && (
            <p className="text-red-500 text-sm text-center">
              {error}
            </p>
          )}

          {/* Signup Button */}
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

            {loading
              ? "Creating Account..."
              : "Create Account"}

          </button>

        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">

          <div className="flex-1 h-[1px] bg-brand-border" />

          <span className="text-brand-muted text-sm">
            OR
          </span>

          <div className="flex-1 h-[1px] bg-brand-border" />

        </div>

        {/* Google Signup */}
        <button
          type="button"
          onClick={handleGoogleSignup}
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

        {/* Login Link */}
        <p className="text-center text-brand-muted mt-8">

          Already have an account?{" "}

          <Link
            href="/auth/login"
            className="text-brand-orange"
          >
            Login
          </Link>

        </p>

      </div>

    </main>
  );
}