"use client";

import { Suspense } from "react";
import AuthSplitScreen, { getSafeCallbackUrl } from "@/components/auth/AuthSplitScreen";

export { getSafeCallbackUrl };

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
          <div className="w-8 h-8 border-2 border-[var(--brand-accent)] border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <AuthSplitScreen initialTab="signin" />
    </Suspense>
  );
}
