"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, X, ShoppingBag, ArrowRight } from "lucide-react";
import useCartStore from "@/lib/cartStore";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { calculateCartDiscounts } from "@/lib/offersHelper";
import Tooltip, { HelpTooltip } from "../ui/Tooltip";

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
    isSyncing,
  } = useCartStore();

  const { data: session } = useSession();
  const router = useRouter();
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    fetch("/api/offers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.offers)) setOffers(d.offers);
      })
      .catch(() => {});
  }, []);

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
  const { autoDiscountAmount } = useMemo(
    () => calculateCartDiscounts(items, offers),
    [items, offers]
  );
  const primaryRest = items[0]?.restaurant;
  const flatFee = primaryRest?.chargeSettings?.flatDeliveryFee ?? 40;
  const freeThreshold = primaryRest?.chargeSettings?.freeDeliveryThreshold ?? 500;
  const isFreeDelivery = subtotal >= freeThreshold;
  const deliveryFee = items.length > 0 ? (isFreeDelivery ? 0 : flatFee) : 0;
  const total = Math.max(0, subtotal + deliveryFee - autoDiscountAmount);

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
            {isSyncing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 animate-pulse">
                Syncing...
              </span>
            )}
          </div>

          <Tooltip content="Close cart drawer" placement="left">
            <button
              onClick={closeCart}
              aria-label="Close cart drawer"
              className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
            >
              <X size={20} />
            </button>
          </Tooltip>
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
              className="px-6 py-3 rounded-2xl bg-[var(--brand-accent)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/25 hover:opacity-90 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
            >
              Explore Menu
            </Link>
          </div>
        ) : (
          <>
            {/* Scrollable Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {items.map((item) => (
                <CartDrawerItem
                  key={item._id || item.productId}
                  item={item}
                  decreaseQty={decreaseQty}
                  increaseQty={increaseQty}
                  removeItem={removeItem}
                />
              ))}
            </div>

            {/* Footer Summary & Checkout Button */}
            <div className="p-5 border-t border-[var(--border-color)] bg-[var(--bg-card)] space-y-3">
              <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[var(--text-main)]">₹{subtotal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <span>Delivery fee</span>
                    <HelpTooltip
                      content={
                        isFreeDelivery
                          ? `Free delivery active! Your order meets the ₹${freeThreshold} free delivery threshold.`
                          : `Standard delivery charge. Add items worth ₹${Math.max(0, freeThreshold - subtotal)} more to qualify for free delivery.`
                      }
                      title="Delivery Fee Info"
                      side="top"
                    />
                  </span>
                  <span className="font-semibold text-[var(--text-main)]">
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-500 font-bold uppercase tracking-wider text-[11px]">FREE</span>
                    ) : (
                      `₹${deliveryFee}`
                    )}
                  </span>
                </div>
                {autoDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>⚡ Auto Discount</span>
                    <span>-₹{autoDiscountAmount}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-[var(--border-color)] flex justify-between items-baseline text-sm">
                  <span className="font-bold text-[var(--text-main)]">Total</span>
                  <span className="text-xl font-black text-[var(--brand-accent)]">₹{total}</span>
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={items.length === 0}
                  className="w-full py-3.5 rounded-2xl bg-[var(--brand-accent)] text-white text-xs font-extrabold shadow-lg shadow-[var(--brand-accent)]/20 hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={15} />
                </button>
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="w-full py-2.5 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-center text-xs font-semibold hover:border-[var(--brand-accent)]/30 transition block cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
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

function CartDrawerItem({ item, decreaseQty, increaseQty, removeItem }) {
  const [imgSrc, setImgSrc] = useState(item.image || FALLBACK_IMAGE);
  const qty = item.quantity || 1;

  useEffect(() => {
    setImgSrc(item.image || FALLBACK_IMAGE);
  }, [item.image]);

  return (
    <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center gap-3 shadow-xs">
      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-[var(--bg-sub)] shrink-0 border border-[var(--border-color)]">
        <Image
          src={imgSrc}
          alt={item.name}
          fill
          sizes="64px"
          className="object-cover"
          onError={() => setImgSrc(FALLBACK_IMAGE)}
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
        <Tooltip content="Reduce quantity" placement="top">
          <button
            type="button"
            onClick={() => decreaseQty(item._id)}
            aria-label={`Decrease quantity of ${item.name}`}
            className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
          >
            <Minus size={12} />
          </button>
        </Tooltip>
        <span className="w-5 text-center text-xs font-bold text-[var(--text-main)]">
          {qty}
        </span>
        <Tooltip
          content={qty >= 20 ? "Maximum limit of 20 items per dish reached" : "Add one more"}
          placement="top"
        >
          <button
            type="button"
            onClick={() => increaseQty(item._id)}
            disabled={qty >= 20}
            aria-label={`Increase quantity of ${item.name}`}
            className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
          >
            <Plus size={12} />
          </button>
        </Tooltip>
      </div>

      {/* Remove */}
      <Tooltip content="Remove dish from your cart" placement="left">
        <button
          type="button"
          onClick={() => removeItem(item._id)}
          aria-label={`Remove ${item.name} from cart`}
          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-hidden"
        >
          <Trash2 size={15} />
        </button>
      </Tooltip>
    </div>
  );
}