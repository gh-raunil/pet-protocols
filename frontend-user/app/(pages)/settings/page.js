import { Suspense } from "react";
import SettingsClient from "./SettingsClient";

export const metadata = {
  title: "Settings Hub — पेट Protocols",
  description: "Customize your theme, color palette, notifications, and operational time zone on पेट Protocols.",
};

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 max-w-5xl mx-auto">
          <div className="h-10 w-48 bg-[var(--bg-card)] rounded-2xl animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-44 bg-[var(--bg-card)] rounded-3xl animate-pulse" />
            <div className="h-44 bg-[var(--bg-card)] rounded-3xl animate-pulse" />
          </div>
        </main>
      }
    >
      <SettingsClient />
    </Suspense>
  );
}
