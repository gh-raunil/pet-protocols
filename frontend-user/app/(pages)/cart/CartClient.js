"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Building,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import useCartStore from "@/lib/cartStore";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

export default function CartClient() {
  const { items, increaseQty, decreaseQty, removeItem, getTotalPrice } = useCartStore();
  const [isMounted, setIsMounted] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Delivery fee
  const deliveryFee = 40;
  const subtotal = isMounted ? getTotalPrice() : 0;
  const total = subtotal > 0 ? subtotal + deliveryFee : 0;

  // Group items by restaurant if restaurant data exists
  const groupedItems = useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      const restKey = item.restaurant?.name || item.restaurant?.title || "Partner Kitchen";
      if (!groups[restKey]) {
        groups[restKey] = [];
      }
      groups[restKey].push(item);
    });
    return groups;
  }, [items]);

  if (!isMounted) return null;

  const handleCheckout = () => {
    if (!session) {
      router.push("/auth/login?callbackUrl=/checkout");
      return;
    }
    router.push("/checkout");
  };

  // ── EMPTY CART STATE ──────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 flex items-center justify-center text-center text-[var(--text-main)]">
        <div className="max-w-md w-full p-8 sm:p-10 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] flex items-center justify-center mb-6">
            <ShoppingBag size={36} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-main)]">
            Your cart is empty
          </h1>

          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
            Explore dishes and add something you love.
          </p>

          <div className="mt-8">
            <Link
              href="/menu"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-sm shadow-xl shadow-[var(--brand-accent)]/20 transition"
            >
              Explore Menu <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── POPULATED CART ────────────────────────────────────────────────
  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-[var(--text-main)] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight">
            Review Your <span className="text-[var(--brand-accent)]">Feast Cart</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {items.reduce((acc, i) => acc + (i.quantity || 1), 0)} items ready for kitchen preparation
          </p>
        </div>

        <Link
          href="/menu"
          className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--brand-accent)] transition"
        >
          <ArrowLeft size={14} /> Continue Shopping
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* LEFT COLUMN: Items Grouped by Kitchen */}
        <div className="lg:col-span-2 space-y-6">
          {Object.entries(groupedItems).map(([restName, restItems]) => (
            <div
              key={restName}
              className="p-5 sm:p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm space-y-4"
            >
              {/* Kitchen Header */}
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
                <Building size={16} className="text-[var(--brand-accent)]" />
                <h2 className="text-sm font-bold text-[var(--text-main)]">
                  {restName}
                </h2>
                <span className="text-[11px] text-[var(--text-muted)]">
                  ({restItems.length} {restItems.length === 1 ? "dish" : "dishes"})
                </span>
              </div>

              {/* Items in this kitchen */}
              <div className="space-y-4 divide-y divide-[var(--border-color)]">
                {restItems.map((item) => {
                  const qty = item.quantity || 1;
                  const itemTotal = item.price * qty;

                  return (
                    <div
                      key={item._id}
                      className="pt-4 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-[var(--bg-sub)] shrink-0 border border-[var(--border-color)]">
                          <Image
                            src={item.image || FALLBACK_IMAGE}
                            alt={item.name}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] truncate">
                            {item.name}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            ₹{item.price} each
                          </p>
                          <p className="text-xs font-extrabold text-[var(--brand-accent)] mt-1">
                            Total: ₹{itemTotal}
                          </p>
                        </div>
                      </div>

                      {/* Controls Row */}
                      <div className="flex items-center justify-between w-full sm:w-auto gap-4 self-end sm:self-center">
                        <div className="flex items-center gap-2 bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => decreaseQty(item._id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-[var(--text-main)]">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => increaseQty(item._id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition"
                            aria-label="Increase quantity"
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item._id)}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition"
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT COLUMN: Order Summary Card */}
        <div className="sticky top-28 p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <h2 className="text-base font-extrabold text-[var(--text-main)]">
            Order Summary
          </h2>

          <div className="space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Item Subtotal</span>
              <span className="font-semibold text-[var(--text-main)]">₹{subtotal}</span>
            </div>

            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Delivery Charge</span>
              <span className="font-semibold text-[var(--text-main)]">₹{deliveryFee}</span>
            </div>

            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Taxes & Kitchen Packaging</span>
              <span className="font-semibold text-emerald-500">Included</span>
            </div>

            <div className="pt-3 border-t border-[var(--border-color)] flex justify-between items-baseline">
              <span className="text-sm font-bold text-[var(--text-main)]">Total Amount</span>
              <span className="text-2xl font-black text-[var(--brand-accent)]">
                ₹{total}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleCheckout}
              className="w-full py-4 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-extrabold text-sm shadow-xl shadow-[var(--brand-accent)]/25 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={16} />
            </button>

            <Link
              href="/menu"
              className="w-full py-3 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--brand-accent)]/40 font-semibold text-xs transition flex items-center justify-center"
            >
              Add More Dishes
            </Link>
          </div>

          <div className="pt-2 border-t border-[var(--border-color)] flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
            <span>Verified final billing calculated securely by backend engine.</span>
          </div>
        </div>
      </div>
    </main>
  );
}