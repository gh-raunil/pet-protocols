import Link from 'next/link'

export const metadata = {
  title: '404 — Page Not Found',
  description: 'This page does not exist.',
}

export default function NotFound() {
  return (
    <main className="min-h-screen bg-brand-dark flex flex-col items-center justify-center mt-10 px-6 text-center">

      {/* Emoji */}
      <div className="text-8xl mb-6 animate-bounce">🍔</div>

      {/* 404 */}
      <h1 className="text-8xl font-bold text-brand-orange mb-4">404</h1>

      {/* Title */}
      <h2 className="text-2xl font-bold text-white mb-3">
        Page Not Found
      </h2>

      {/* Message */}
      <p className="text-brand-muted text-base max-w-md leading-relaxed mb-10">
        Oops! Looks like this page isn't on our menu. It may have been removed,
        renamed, or perhaps it never existed. Let's get you back on track!
      </p>

      {/* Buttons */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/"
          className="bg-brand-orange text-white px-8 py-3 rounded-full font-semibold hover:opacity-90 transition">
          Go Home
        </Link>
        <Link
          href="/menu"
          className="border border-brand-border text-white px-8 py-3 rounded-full font-semibold hover:bg-brand-border transition">
          Browse Menu 🍕
        </Link>
      </div>

      {/* Decorative */}
      <p className="text-brand-border text-6xl font-bold mt-16 select-none tracking-widest">
        PET PROTOCOLS
      </p>

    </main>
  )
}