"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, RotateCcw, Home, RefreshCw } from "lucide-react";

function sanitizeError(err) {
  if (!err) return { message: "An unexpected workspace error occurred." };
  const rawMsg = typeof err === "string" ? err : err.message || "An unexpected workspace error occurred.";
  const sanitized = rawMsg
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/([?&](token|key|secret|auth|password|apiKey)=)[^&]+/gi, "$1[REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, "[EMAIL]");

  return {
    message: sanitized,
    digest: err.digest || null,
  };
}

export default function Error({ error, reset }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [sanitizedError, setSanitizedError] = useState({ message: "An unexpected workspace error occurred.", digest: null });

  useEffect(() => {
    const safeInfo = sanitizeError(error);
    setSanitizedError(safeInfo);

    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Admin Error Boundary] Handled workspace error:",
        safeInfo.message,
        safeInfo.digest ? `(Digest: ${safeInfo.digest})` : ""
      );
    }
  }, [error]);

  const handleRetry = () => {
    if (isRetrying || isPending) return;

    setIsRetrying(true);
    const nextCount = retryCount + 1;
    setRetryCount(nextCount);

    if (nextCount >= 3) {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
      return;
    }

    startTransition(() => {
      try {
        router.refresh();
      } catch {}
      reset();
    });

    setTimeout(() => {
      setIsRetrying(false);
    }, 650);
  };

  const handleHardReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const isExhausted = retryCount >= 2;
  const isLoading = isRetrying || isPending;

  return (
    <main
      role="alert"
      aria-live="assertive"
      className="min-h-screen bg-[var(--bg-main,#0d0f12)] text-[var(--text-main,#f3f4f6)] flex flex-col items-center justify-center px-4 sm:px-6 text-center pt-20 pb-16 transition-colors"
    >
      <div className="max-w-md w-full bg-[var(--bg-card,#13161c)] border border-[var(--border-color,#20242e)] rounded-3xl p-7 sm:p-8 shadow-2xl space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle size={28} />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-main,#f3f4f6)] tracking-tight">
            Kitchen Console Error
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted,#9ca3af)] leading-relaxed">
            {isExhausted
              ? "The workspace view encountered recurring issues. A fresh console reload will re-synchronize live kitchen states."
              : "An unexpected issue interrupted this console view. Live operations continue running in the background."}
          </p>

          {sanitizedError.digest && (
            <p className="text-[11px] font-mono text-[var(--text-muted,#9ca3af)] opacity-80 pt-1">
              Ref: <span className="text-[var(--brand-accent,#ff5500)]">{sanitizedError.digest}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isExhausted ? (
            <button
              type="button"
              onClick={handleHardReload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--brand-accent,#ff5500)] text-white text-xs font-bold hover:opacity-90 transition shadow-md shadow-[var(--brand-accent,#ff5500)]/20 active:scale-95 cursor-pointer min-h-[44px]"
            >
              <RefreshCw size={14} />
              <span>Hard Reload Console</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isLoading}
              aria-label="Retry loading workspace"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--brand-accent,#ff5500)] text-white text-xs font-bold hover:opacity-90 transition shadow-md shadow-[var(--brand-accent,#ff5500)]/20 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 cursor-pointer min-h-[44px]"
            >
              <RotateCcw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>{isLoading ? "Retrying..." : retryCount > 0 ? `Retry (${retryCount}/2)` : "Try Again"}</span>
            </button>
          )}

          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--bg-sub,#181c24)] border border-[var(--border-color,#20242e)] text-[var(--text-main,#f3f4f6)] text-xs font-semibold hover:border-[var(--brand-accent,#ff5500)]/40 hover:text-[var(--brand-accent,#ff5500)] transition active:scale-95 min-h-[44px]"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </Link>
        </div>

        {retryCount > 0 && !isExhausted && (
          <p className="text-[11px] text-[var(--text-muted,#9ca3af)] font-medium pt-1">
            Attempt {retryCount} of 2 • Auto-reload initiates on 3rd attempt
          </p>
        )}
      </div>
    </main>
  );
}
