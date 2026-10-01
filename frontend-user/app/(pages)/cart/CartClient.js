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
  Clock,
  AlertCircle,
  Truck,
  CheckCircle2,
} from "lucide-react";
import useCartStore from "@/lib/cartStore";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

export default function CartClient() {
  const { items, increaseQty, decreaseQty, removeItem, getTotalPrice } = useCartStore();
  const [isMounted, setIsMounted] = useState(false);
  const [orderType, setOrderType] = useState("delivery"); // "delivery" | "pickup"
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Group items by restaurant if restaurant data exists
  const groupedItems = useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      const restKey = item.restaurant?.name || item.restaurant?.title || "Partner Kitchen";
      if (!groups[restKey]) {
        groups[restKey] = {
          restaurant: item.restaurant,
          items: [],
          subtotal: 0,
        };
      }
      groups[restKey].items.push(item);
      groups[restKey].subtotal += (item.price || 0) * (item.quantity || 1);
    });
    return groups;
  }, [items]);

  // Operational validation across all grouped restaurants
  const restaurantValidations = useMemo(() => {
    const issues = [];
    Object.entries(groupedItems).forEach(([restName, group]) => {
      const rest = group.restaurant;
      const op = getRestaurantOperationalStatus(rest);
      if (!op.isOpen) {
        issues.push({
          type: "closed",
          kitchen: restName,
          message: `${restName} is ${op.reason || "currently closed"}. Operating hours: ${op.hoursText || "10:00 AM - 11:00 PM"}. Please remove these items to proceed.`,
        });
      }

      const minOrder = rest?.orderLimits?.minOrderAmount || 0;
      if (minOrder > 0 && group.subtotal < minOrder) {
        issues.push({
          type: "min_order",
          kitchen: restName,
          message: `Minimum order for ${restName} is ₹${minOrder}. Add ₹${minOrder - group.subtotal} more to checkout.`,
        });
      }
    });
    return issues;
  }, [groupedItems]);

  const hasBlockingIssues = restaurantValidations.length > 0;

  // Primary restaurant settings for delivery calculation
  const primaryRest = items[0]?.restaurant;
  const flatFee = primaryRest?.chargeSettings?.flatDeliveryFee ?? 40;
  const freeThreshold = primaryRest?.chargeSettings?.freeDeliveryThreshold ?? 500;

  const subtotal = isMounted ? getTotalPrice() : 0;
  const isFreeDelivery = subtotal >= freeThreshold;
  const deliveryFee = orderType === "pickup" ? 0 : isFreeDelivery ? 0 : flatFee;
  const total = subtotal > 0 ? subtotal + deliveryFee : 0;
  const freeDeliveryDiff = Math.max(0, freeThreshold - subtotal);

  if (!isMounted) return null;

  const handleCheckout = () => {
    if (hasBlockingIssues) return;
    if (!session) {
      router.push(`/auth/login?callbackUrl=/checkout?type=${orderType}`);
      return;
    }
    router.push(`/checkout?type=${orderType}`);
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
          {Object.entries(groupedItems).map(([restName, group]) => {
            const rest = group.restaurant;
            const op = getRestaurantOperationalStatus(rest);
            const minOrder = rest?.orderLimits?.minOrderAmount || 0;
            const minOrderMet = minOrder === 0 || group.subtotal >= minOrder;

            return (
              <div
                key={restName}
                className={`p-5 sm:p-6 rounded-3xl bg-[var(--bg-card)] border transition-all shadow-sm space-y-4 ${
                  !op.isOpen
                    ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
                    : !minOrderMet
                    ? "border-rose-500/30"
                    : "border-[var(--border-color)]"
                }`}
              >
                {/* Kitchen Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-[var(--brand-accent)]" />
                    <h2 className="text-sm font-bold text-[var(--text-main)]">
                      {restName}
                    </h2>
                    {op.isOpen ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                        Open Now
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        Closed ({op.reason})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <span>Subtotal: <strong className="text-[var(--text-main)]">₹{group.subtotal}</strong></span>
                    {minOrder > 0 && (
                      <span className={minOrderMet ? "text-emerald-500 font-semibold" : "text-amber-500 font-semibold"}>
                        (Min: ₹{minOrder})
                      </span>
                    )}
                  </div>
                </div>

                {/* Closed Alert Notice */}
                {!op.isOpen && (
                  <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>
                      {restName} is currently closed or not taking online orders. Please remove dishes from this kitchen to proceed.
                    </span>
                  </div>
                )}

                {/* Min Order Notice */}
                {op.isOpen && !minOrderMet && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>
                      Minimum order for {restName} is ₹{minOrder}. Add ₹{minOrder - group.subtotal} more to qualify for checkout.
                    </span>
                  </div>
                )}

                {/* Items in this kitchen */}
                <div className="space-y-4 divide-y divide-[var(--border-color)]">
                  {group.items.map((item) => {
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
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition cursor-pointer"
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
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item._id)}
                            className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
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
            );
          })}
        </div>

        {/* RIGHT COLUMN: Order Summary Card */}
        <div className="sticky top-28 p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <h2 className="text-base font-extrabold text-[var(--text-main)]">
            Order Summary
          </h2>

          {/* Delivery vs Pickup Mode Selection */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Fulfillment Option
            </span>
            <div className="grid grid-cols-2 gap-2 bg-[var(--bg-sub)] p-1 rounded-2xl border border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setOrderType("delivery")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  orderType === "delivery"
                    ? "bg-[var(--brand-accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                <Truck size={14} /> Doorstep
              </button>
              <button
                type="button"
                onClick={() => setOrderType("pickup")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  orderType === "pickup"
                    ? "bg-[var(--brand-accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                <ShoppingBag size={14} /> Pickup (₹0)
              </button>
            </div>
          </div>

          {/* Free Delivery Tracker (For Delivery mode) */}
          {orderType === "delivery" && freeThreshold > 0 && (
            <div className="p-3 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[var(--text-main)] flex items-center gap-1">
                  <Truck size={13} className="text-[var(--brand-accent)]" />
                  {isFreeDelivery ? "FREE Delivery Applied!" : "Free Delivery Target"}
                </span>
                <span className="text-[11px] font-bold text-[var(--brand-accent)]">
                  {isFreeDelivery ? "100%" : `₹${subtotal} / ₹${freeThreshold}`}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden">
                <div
                  className="h-full bg-[var(--brand-accent)] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (subtotal / freeThreshold) * 100)}%` }}
                />
              </div>
              {!isFreeDelivery && freeDeliveryDiff > 0 && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  Add <strong>₹{freeDeliveryDiff}</strong> more for free delivery!
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Item Subtotal</span>
              <span className="font-semibold text-[var(--text-main)]">₹{subtotal}</span>
            </div>

            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Delivery Charge</span>
              <span className="font-semibold text-[var(--text-main)]">
                {deliveryFee === 0 ? (
                  <span className="text-emerald-500 font-bold uppercase tracking-wider text-xs">FREE</span>
                ) : (
                  `₹${deliveryFee}`
                )}
              </span>
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

          {/* Blocking Issues Alert */}
          {hasBlockingIssues && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 space-y-1.5 text-xs">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle size={15} /> Action Required:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                {restaurantValidations.map((val, idx) => (
                  <li key={idx}>{val.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleCheckout}
              disabled={hasBlockingIssues}
              className={`w-full py-4 rounded-2xl font-extrabold text-sm shadow-xl transition flex items-center justify-center gap-2 ${
                hasBlockingIssues
                  ? "bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed border border-[var(--border-color)]"
                  : "bg-[var(--brand-accent)] hover:opacity-95 text-white shadow-[var(--brand-accent)]/25 active:scale-98 cursor-pointer"
              }`}
            >
              <span>{hasBlockingIssues ? "Resolve Cart Issues to Proceed" : "Proceed to Checkout"}</span>
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