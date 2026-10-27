import Link from 'next/link';
import { ArrowLeft, LayoutDashboard, Compass } from 'lucide-react';

export const metadata = {
  title: '404 — Page Not Found | पेट Protocols',
  description: 'The requested restaurant management route does not exist.',
};

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-jakarta">
      {/* SaaS Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 mb-6">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span>HTTP 404 • Missing Route</span>
      </div>

      <div className="w-20 h-20 rounded-3xl bg-surface-secondary border border-border-default flex items-center justify-center text-4xl mb-6 shadow-sm">
        🍽️
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight mb-3">
        Page Not Found
      </h1>

      <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md leading-relaxed mb-8">
        The route or administrative station you requested could not be located in your पेट Protocols restaurant workspace.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition active:scale-95"
        >
          <LayoutDashboard size={14} />
          <span>Go to Dashboard</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-stone-700 dark:text-stone-300 border border-border-default font-bold text-xs transition active:scale-95"
        >
          <Compass size={14} />
          <span>Station Switcher</span>
        </Link>
      </div>
    </main>
  );
}