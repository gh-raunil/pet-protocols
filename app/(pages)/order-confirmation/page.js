import Link from 'next/link'

export default function OrderConfirmationPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-8xl">🎉</div>
      <h1 className="text-4xl font-bold text-center">
        Order <span className="text-brand-orange">Confirmed!</span>
      </h1>
      <p className="text-brand-muted text-center max-w-md">
        Your food is being prepared with love.
        It will be delivered to your doorstep shortly!
      </p>
      <div className="flex gap-4 mt-4">
        <Link href="/menu"
          className="bg-brand-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 transition">
          Order More 🍔
        </Link>
        <Link href="/"
          className="border border-brand-border text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-border transition">
          Go Home
        </Link>
      </div>
    </main>
  )
}