"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("App boundary error caught:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center justify-center px-4 sm:px-6 text-center pt-24 pb-16 transition-colors">
      <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-8 shadow-xl space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
          <AlertCircle size={28} />
        </div>

        <div>
          <h1 className="text-2xl font-black text-[var(--text-main)]">Something went wrong</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-2">
            We encountered an unexpected issue while loading this page. Our team has been notified.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold hover:opacity-90 transition shadow-md shadow-[var(--brand-accent)]/20"
          >
            <RotateCcw size={14} />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-xs font-semibold hover:border-[var(--brand-accent)]/40 transition"
          >
            <Home size={14} />
            <span>Go Home</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
