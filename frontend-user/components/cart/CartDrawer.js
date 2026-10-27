"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, X, ShoppingBag, ArrowRight, Sparkles, AlertCircle, MapPin } from "lucide-react";
import useCartStore from "@/lib/cartStore";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { calculateCartDiscounts } from "@/lib/offersHelper";
import { areAllRestaurantsPickupEnabled } from "@/lib/pickupHelper";
import Tooltip, { HelpTooltip } from "../ui/Tooltip";
import useLocationStore from "@/lib/locationStore";

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
  const { locationDetails, getRestaurantServiceability, openLocationModal } = useLocationStore();

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

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const currentItems = mounted ? items : [];

  const unserviceableKitchens = useMemo(() => {
    if (!mounted || currentItems.length === 0) return [];
    if (!locationDetails?.hasExactCoordinates || !locationDetails?.latitude || !locationDetails?.longitude) {
      return [];
    }
    const unserviceable = [];
    const seen = new Set();
    currentItems.forEach((item) => {
      const rest = item.restaurant;
      const restId = rest?._id || rest?.id || rest?.name;
      if (!restId || seen.has(restId)) return;
      seen.add(restId);
      const serv = getRestaurantServiceability(rest);
      if (serv && serv.isServiceable === false) {
        unserviceable.push({
          name: rest.name || rest.title || "Kitchen",
          restaurant: rest,
          reason: serv.reason || "Outside delivery range",
          distanceKm: serv.distanceKm,
          maxRadiusKm: serv.maxRadiusKm,
        });
      }
    });
    return unserviceable;
  }, [mounted, currentItems, locationDetails, getRestaurantServiceability]);

  const canSwitchToPickup = useMemo(() => {
    if (unserviceableKitchens.length === 0) return false;
    const rests = unserviceableKitchens.map((k) => k.restaurant).filter(Boolean);
    if (rests.length === 0) return false;
    const cap = areAllRestaurantsPickupEnabled(rests);
    return cap.isSupported;
  }, [unserviceableKitchens]);

  const handleCheckout = () => {
    closeCart();
    if (unserviceableKitchens.length > 0) {
      router.push("/cart");
      return;
    }
    if (!session) {
      router.push("/auth/login?callbackUrl=/checkout");
      return;
    }
    router.push("/checkout");
  };

  const subtotal = mounted ? getTotalPrice() : 0;
  const { autoDiscountAmount } = useMemo(
    () => calculateCartDiscounts(currentItems, offers),
    [currentItems, offers]
  );
  const primaryRest = currentItems[0]?.restaurant;
  const flatFee = primaryRest?.chargeSettings?.flatDeliveryFee ?? 40;
  const freeThreshold = primaryRest?.chargeSettings?.freeDeliveryThreshold ?? 500;
  const isFreeDelivery = subtotal >= freeThreshold;
  const deliveryFee = currentItems.length > 0 ? (isFreeDelivery ? 0 : flatFee) : 0;
  const total = Math.max(0, subtotal + deliveryFee - autoDiscountAmount);
  const itemCount = currentItems.reduce((acc, i) => acc + (i.quantity || 1), 0);
  const freeDeliveryPercent = Math.min(100, Math.round((subtotal / freeThreshold) * 100));

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeCart}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs z-[80] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart Drawer"
        className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[440px] bg-[var(--bg-main)] border-l border-[var(--border-color)] z-[90] flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Editorial Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-serif font-black tracking-tight text-[var(--text-main)]">
                  Your Cart
                </h2>
                <span suppressHydrationWarning className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] tracking-wide">
                Fresh food. Zero compromises.
              </p>
            </div>
            {isSyncing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 animate-pulse ml-1">
                Syncing...
              </span>
            )}
          </div>

          <Tooltip content="Close cart drawer" placement="left">
            <button
              onClick={closeCart}
              type="button"
              aria-label="Close cart drawer"
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition cursor-pointer flex items-center justify-center active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
            >
              <X size={22} />
            </button>
          </Tooltip>
        </div>

        {/* Free Delivery Threshold Bar */}
        {currentItems.length > 0 && (
          <div className="px-6 py-3 bg-[var(--bg-sub)] border-b border-[var(--border-color)]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[var(--text-main)] flex items-center gap-1.5 text-[11px]">
                <Sparkles size={13} className="text-[var(--brand-accent)]" />
                {isFreeDelivery
                  ? "Free Delivery Unlocked!"
                  : `Add ₹${Math.max(0, freeThreshold - subtotal)} more for Free Delivery`}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)] font-bold">
                {freeDeliveryPercent}%
              </span>
            </div>
            <div
              className="w-full h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden"
              role="progressbar"
              aria-valuenow={freeDeliveryPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Free delivery progress"
            >
              <div
                className="h-full rounded-full bg-[var(--brand-accent)] transition-all duration-500 ease-out"
                style={{ width: `${freeDeliveryPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {currentItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-3xl bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 text-[var(--brand-accent)] flex items-center justify-center mb-5 shadow-xs">
              <ShoppingBag size={34} />
            </div>
            <h3 className="text-xl font-serif font-black tracking-tight text-[var(--text-main)]">
              Your cart is empty
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-xs mt-1.5 mb-6 leading-relaxed">
              Explore freshly prepared gourmet meals from our artisan kitchens and add your favorites.
            </p>
            <Link
              href="/menu"
              onClick={closeCart}
              className="px-6 py-3 min-h-[44px] inline-flex items-center justify-center rounded-2xl bg-[var(--brand-accent)] text-white text-xs font-bold shadow-md shadow-[var(--brand-accent)]/20 hover:opacity-95 transition cursor-pointer active:scale-98 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
            >
              Explore Menu
            </Link>
          </div>
        ) : (
          <>
            {/* Out-of-Range Serviceability Warning (Keeps items, never silently discards) */}
            {unserviceableKitchens.length > 0 && (
              <div className="mx-4 sm:mx-5 mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-bold text-[12px]">
                      {unserviceableKitchens.length === 1
                        ? `${unserviceableKitchens[0].name} is outside delivery range.`
                        : "Some kitchens are outside delivery range."}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {unserviceableKitchens.map((k) =>
                        k.distanceKm != null
                          ? `${k.name} is ${k.distanceKm} km away (delivery radius ${k.maxRadiusKm} km)`
                          : k.reason
                      ).join(" • ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                  <button
                    type="button"
                    onClick={() => {
                      closeCart();
                      openLocationModal();
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-[var(--brand-accent)] text-white font-bold text-[11px] hover:opacity-95 transition flex items-center gap-1 active:scale-95 cursor-pointer"
                  >
                    <MapPin size={12} /> Change Location
                  </button>
                  {canSwitchToPickup && (
                    <Link
                      href="/cart?type=pickup"
                      onClick={closeCart}
                      className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] font-semibold text-[11px] hover:border-[var(--brand-accent)]/30 transition active:scale-95 flex items-center gap-1"
                    >
                      Switch to Pickup
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {currentItems.map((item) => (
                <CartDrawerItem
                  key={item.cartItemId || `${item._id}__${item.variantName || 'default'}`}
                  item={item}
                  decreaseQty={decreaseQty}
                  increaseQty={increaseQty}
                  removeItem={removeItem}
                />
              ))}
            </div>

            {/* Footer Summary & Checkout Button with Safe Area Padding */}
            <div className="p-5 pb-safe border-t border-[var(--border-color)] bg-[var(--bg-card)] space-y-3 shadow-lg">
              <div className="space-y-2 text-xs text-[var(--text-muted)]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-[var(--text-main)]">₹{subtotal}</span>
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
                  <span className="font-mono font-semibold text-[var(--text-main)]">
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-[11px]">FREE</span>
                    ) : (
                      `₹${deliveryFee}`
                    )}
                  </span>
                </div>
                {autoDiscountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Sparkles size={12} /> Auto Discount
                    </span>
                    <span className="font-mono">-₹{autoDiscountAmount}</span>
                  </div>
                )}
                <div className="pt-2.5 border-t border-[var(--border-color)] flex justify-between items-baseline text-sm">
                  <div>
                    <span className="font-serif font-bold text-base text-[var(--text-main)]">Estimated Total</span>
                    <p className="text-[10px] text-[var(--text-muted)]">Final totals revalidated at checkout</p>
                  </div>
                  <span className="text-2xl font-mono font-black text-[var(--brand-accent)]">₹{total}</span>
                </div>
              </div>

              <div className="pt-1.5 space-y-2.5">
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={items.length === 0}
                  className={`w-full min-h-[48px] py-3.5 rounded-2xl text-white text-sm font-extrabold shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                    unserviceableKitchens.length > 0
                      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                      : "bg-[var(--brand-accent)] hover:opacity-95 shadow-[var(--brand-accent)]/20"
                  }`}
                >
                  <span>
                    {unserviceableKitchens.length > 0
                      ? "Review Location in Cart"
                      : "Proceed to Checkout"}
                  </span>
                  <ArrowRight size={16} />
                </button>
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="w-full min-h-[44px] py-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] text-center text-xs font-semibold hover:border-[var(--brand-accent)]/30 transition flex items-center justify-center cursor-pointer active:scale-98 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
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
  const itemKey = item.cartItemId || `${item._id}__${item.variantName || 'default'}`;

  useEffect(() => {
    setImgSrc(item.image || FALLBACK_IMAGE);
  }, [item.image]);

  const portionText = item.servingLabel || (item.portionQuantity ? `${item.portionQuantity} ${item.portionUnit || ''}` : '') + (item.size ? ` • ${item.size}` : '');

  return (
    <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center gap-3.5 shadow-xs hover:border-[var(--brand-accent)]/30 transition-colors">
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
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {item.variantName && (
            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20">
              {item.variantName}
            </span>
          )}
          {portionText && (
            <span className="inline-block text-[10px] text-[var(--text-muted)] truncate">
              {portionText}
            </span>
          )}
        </div>
        <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
          ₹{item.price} × {qty}
        </p>
        <p className="text-xs font-mono font-extrabold text-[var(--brand-accent)] mt-0.5">
          ₹{(item.price || 0) * qty}
        </p>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1 bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl p-1 shrink-0">
        <Tooltip content="Reduce quantity" placement="top">
          <button
            type="button"
            onClick={() => decreaseQty(itemKey)}
            aria-label={`Decrease quantity of ${item.name}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition cursor-pointer active:scale-90 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
          >
            <Minus size={14} />
          </button>
        </Tooltip>
        <span className="w-6 text-center text-xs font-mono font-bold text-[var(--text-main)]">
          {qty}
        </span>
        <Tooltip
          content={qty >= 20 ? "Maximum limit of 20 items per dish reached" : "Add one more"}
          placement="top"
        >
          <button
            type="button"
            onClick={() => increaseQty(itemKey)}
            disabled={qty >= 20}
            aria-label={`Increase quantity of ${item.name}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition cursor-pointer active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
          >
            <Plus size={14} />
          </button>
        </Tooltip>
      </div>

      {/* Remove */}
      <Tooltip content="Remove dish from your cart" placement="left">
        <button
          type="button"
          onClick={() => removeItem(itemKey)}
          aria-label={`Remove ${item.name} from cart`}
          className="p-2 min-w-[36px] min-h-[36px] rounded-xl text-rose-500 hover:bg-rose-500/10 transition shrink-0 cursor-pointer active:scale-90 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-hidden"
        >
          <Trash2 size={16} />
        </button>
      </Tooltip>
    </div>
  );
}