"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, X, ShoppingBag, ArrowRight } from "lucide-react";
import useCartStore from "@/lib/cartStore";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    increaseQty,
    decreaseQty,
    removeItem,
    getTotalPrice,
  } = useCartStore();

  const { data: session } = useSession();
  const router = useRouter();

  // Handle escape key and lock body scroll
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e) => {
        if (e.key === "Escape") closeCart();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = original;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, closeCart]);

  const handleCheckout = () => {
    closeCart();
    if (!session) {
      router.push("/auth/login?callbackUrl=/checkout");
      return;
    }
    router.push("/checkout");
  };

  const subtotal = getTotalPrice();
  const deliveryFee = items.length > 0 ? 40 : 0;
  const total = subtotal + deliveryFee;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeCart}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart Drawer"
        className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] bg-[var(--bg-main)] border-l border-[var(--border-color)] z-[90] flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} className="text-[var(--brand-accent)]" />
            <h2 className="text-base font-extrabold text-[var(--text-main)]">
              Your Feast Cart
            </h2>
            <span className="text-xs font-bold text-[var(--text-muted)]">
              ({items.reduce((acc, i) => acc + (i.quantity || 1), 0)})
            </span>
          </div>

          <button
            onClick={closeCart}
            aria-label="Close cart"
            className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Empty state */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/30 text-[var(--brand-accent)] flex items-center justify-center mb-4">
              <ShoppingBag size={30} />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-main)]">
              Your cart is empty
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-xs mt-1 mb-6">
              Explore dishes and add something you love.
            </p>
            <Link
              href="/menu"
              onClick={closeCart}
              className="px-6 py-3 rounded-2xl bg-[var(--brand-accent)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/25 hover:opacity-90 transition"
            >
              Explore Menu
            </Link>
          </div>
        ) : (
          <>
            {/* Scrollable Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {items.map((item) => {
                const qty = item.quantity || 1;
                return (
                  <div
                    key={item._id || item.productId}
                    className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center gap-3 shadow-sm"
                  >
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[var(--bg-sub)] shrink-0 border border-[var(--border-color)]">
                      <Image
                        src={item.image || FALLBACK_IMAGE}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-[var(--text-main)] truncate">
                        {item.name}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        ₹{item.price} each
                      </p>
                      <p className="text-xs font-extrabold text-[var(--brand-accent)] mt-0.5">
                        ₹{item.price * qty}
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => decreaseQty(item._id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-[var(--text-main)]">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => increaseQty(item._id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeItem(item._id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer Summary & Checkout Button */}
            <div className="p-5 border-t border-[var(--border-color)] bg-[var(--bg-card)] space-y-3">
              <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[var(--text-main)]">₹{subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery fee</span>
                  <span className="font-semibold text-[var(--text-main)]">₹{deliveryFee}</span>
                </div>
                <div className="pt-2 border-t border-[var(--border-color)] flex justify-between items-baseline text-sm">
                  <span className="font-bold text-[var(--text-main)]">Total</span>
                  <span className="text-xl font-black text-[var(--brand-accent)]">₹{total}</span>
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full py-3.5 rounded-2xl bg-[var(--brand-accent)] text-white text-xs font-extrabold shadow-lg shadow-[var(--brand-accent)]/20 hover:opacity-95 transition flex items-center justify-center gap-2"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={15} />
                </button>
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="w-full py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-center text-xs font-semibold hover:border-[var(--brand-accent)]/30 transition block"
                >
                  View Full Cart Page
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}