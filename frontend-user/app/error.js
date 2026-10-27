"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, RotateCcw, Home, RefreshCw, ShieldAlert } from "lucide-react";

/**
 * Strips potentially sensitive credentials, tokens, or PII from error details.
 */
function sanitizeError(err) {
  if (!err) return { message: "An unexpected error occurred." };
  const rawMsg = typeof err === "string" ? err : err.message || "An unexpected error occurred.";
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
  const [sanitizedError, setSanitizedError] = useState({ message: "An unexpected error occurred.", digest: null });

  useEffect(() => {
    const safeInfo = sanitizeError(error);
    setSanitizedError(safeInfo);

    // Development diagnostic logging without leaking secrets or tokens
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[App Error Boundary] Handled runtime error:",
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

    // If persistent failure occurs repeatedly (3 or more attempts), perform a clean hard refresh
    if (nextCount >= 3) {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
      return;
    }

    // Genuine reattempt: refresh server cache/route segments + reset error boundary within transition
    startTransition(() => {
      try {
        router.refresh();
      } catch {
        // router.refresh might be offline or unsupported in isolated test runner
      }
      reset();
    });

    // Provide visual feedback for at least 650ms to prevent frantic click spamming
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
      className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center justify-center px-4 sm:px-6 text-center pt-24 pb-16 transition-colors"
    >
      <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl p-7 sm:p-8 shadow-xl space-y-5">
        {/* Error Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle size={28} />
        </div>

        {/* Friendly Error Copy */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-main)] tracking-tight">
            Something went wrong
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            {isExhausted
              ? "The requested page continues to experience issues. A fresh page reload usually resolves temporary network conflicts."
              : "We encountered an unexpected issue while loading this page. Our team has been notified."}
          </p>

          {/* Non-sensitive diagnostic digest for support tracking */}
          {sanitizedError.digest && (
            <p className="text-[11px] font-mono text-[var(--text-muted)] opacity-80 pt-1">
              Error Reference: <span className="text-[var(--brand-accent)]">{sanitizedError.digest}</span>
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isExhausted ? (
            <button
              type="button"
              onClick={handleHardReload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold hover:opacity-90 transition shadow-md shadow-[var(--brand-accent)]/20 active:scale-95 cursor-pointer min-h-[44px]"
            >
              <RefreshCw size={14} />
              <span>Hard Reload Page</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isLoading}
              aria-label="Retry loading page"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--brand-accent)] text-white text-xs font-bold hover:opacity-90 transition shadow-md shadow-[var(--brand-accent)]/20 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 cursor-pointer min-h-[44px]"
            >
              <RotateCcw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>{isLoading ? "Retrying..." : retryCount > 0 ? `Retry (${retryCount}/2)` : "Try Again"}</span>
            </button>
          )}

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-xs font-semibold hover:border-[var(--brand-accent)]/40 hover:text-[var(--brand-accent)] transition active:scale-95 min-h-[44px]"
          >
            <Home size={14} />
            <span>Go Home</span>
          </Link>
        </div>

        {/* Retry Attempt Indicator */}
        {retryCount > 0 && !isExhausted && (
          <p className="text-[11px] text-[var(--text-muted)] font-medium pt-1">
            Attempt {retryCount} of 2 • Automatic reload initiates on 3rd attempt
          </p>
        )}
      </div>
    </main>
  );
}

