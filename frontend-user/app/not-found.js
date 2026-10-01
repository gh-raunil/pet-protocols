import Link from 'next/link'

export const metadata = {
  title: '404 — Page Not Found',
  description: 'This page does not exist.',
}

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col items-center justify-center px-6 text-center pt-24 pb-16 transition-colors">

      {/* Visual */}
      <div className="text-7xl mb-4 select-none">🍽️</div>

      {/* 404 */}
      <h1 className="text-7xl sm:text-8xl font-black text-[var(--brand-accent)] mb-2 tracking-tight">404</h1>

      {/* Title */}
      <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] mb-3">
        Page Not Found
      </h2>

      {/* Message */}
      <p className="text-[var(--text-muted)] text-sm sm:text-base max-w-md leading-relaxed mb-8">
        Looks like this page isn&apos;t on our menu. It may have been relocated, or doesn&apos;t exist. Let&apos;s get you back to discovering fresh food.
      </p>

      {/* Buttons */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/"
          className="bg-[var(--brand-accent)] text-white px-8 py-3 rounded-2xl font-bold hover:opacity-90 transition shadow-lg shadow-[var(--brand-accent)]/20 text-xs sm:text-sm"
        >
          Go to Home
        </Link>
        <Link
          href="/menu"
          className="border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] px-8 py-3 rounded-2xl font-semibold hover:border-[var(--brand-accent)]/50 transition text-xs sm:text-sm"
        >
          Browse Menu
        </Link>
      </div>

      {/* Brand Watermark */}
      <p className="text-[var(--text-muted)]/20 text-4xl sm:text-6xl font-black mt-20 select-none tracking-widest uppercase">
        Pet Protocols
      </p>

    </main>
  );
}