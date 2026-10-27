"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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
  ChevronRight,
  UtensilsCrossed,
  MapPin,
} from "lucide-react";
import useCartStore from "@/lib/cartStore";
import useLocationStore from "@/lib/locationStore";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";
import { calculateCartDiscounts } from "@/lib/offersHelper";
import { areAllRestaurantsPickupEnabled } from "@/lib/pickupHelper";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

export default function CartClient() {
  const { items, increaseQty, decreaseQty, removeItem, getTotalPrice, isSyncing } = useCartStore();
  const { locationDetails, getRestaurantServiceability, openLocationModal } = useLocationStore();
  const [isMounted, setIsMounted] = useState(false);
  const searchParams = useSearchParams();
  const initialTypeProcessedRef = useRef(false);
  const [pickupNotice, setPickupNotice] = useState("");
  const [orderType, setOrderType] = useState("delivery"); // "delivery" | "pickup"
  const [offers, setOffers] = useState([]);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    fetch("/api/offers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.offers)) setOffers(d.offers);
      })
      .catch(() => {});
  }, []);

  // Helper to remove all items from a single kitchen
  const removeKitchenItems = (restName) => {
    const kitchenItems = groupedItems[restName]?.items || [];
    kitchenItems.forEach((i) => removeItem(i.cartItemId || `${i._id}__${i.variantName || 'default'}`));
  };

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

  // Determine authoritative restaurant pickup capability across all items in cart
  const pickupCapability = useMemo(() => {
    const rests = Object.values(groupedItems).map((g) => g.restaurant).filter(Boolean);
    return areAllRestaurantsPickupEnabled(rests);
  }, [groupedItems]);

  // Honor /cart?type=pickup query parameter on initial load without re-overwriting subsequent manual toggles
  useEffect(() => {
    if (initialTypeProcessedRef.current) return;
    if (!isMounted) return;
    initialTypeProcessedRef.current = true;

    const requestedType = searchParams?.get("type");
    if (requestedType === "pickup") {
      if (pickupCapability.isSupported) {
        setOrderType("pickup");
      } else {
        setOrderType("delivery");
        setPickupNotice(
          pickupCapability.reason || "Self-pickup is not offered by this kitchen. Reverted to Doorstep Delivery."
        );
      }
    }
  }, [isMounted, searchParams, pickupCapability]);

  // Revert to delivery if items change to an unsupported restaurant
  useEffect(() => {
    if (orderType === "pickup" && !pickupCapability.isSupported) {
      setOrderType("delivery");
      setPickupNotice(
        pickupCapability.reason || "Self-pickup is not offered by this kitchen. Reverted to Doorstep Delivery."
      );
    }
  }, [orderType, pickupCapability]);

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

      // Live serviceability validation when ordering via Doorstep Delivery
      if (
        orderType === "delivery" &&
        locationDetails?.hasExactCoordinates &&
        locationDetails?.latitude != null &&
        locationDetails?.longitude != null
      ) {
        const serv = getRestaurantServiceability(rest);
        if (serv && serv.isServiceable === false) {
          issues.push({
            type: "out_of_range",
            kitchen: restName,
            restaurant: rest,
            distanceKm: serv.distanceKm,
            maxRadiusKm: serv.maxRadiusKm,
            message:
              serv.distanceKm != null
                ? `${restName} is ${serv.distanceKm} km away and outside the ${serv.maxRadiusKm} km delivery area. Switch to pickup or change delivery location.`
                : `${restName} does not deliver to your selected location (${serv.reason || "Outside delivery range"}).`,
          });
        }
      }
    });
    return issues;
  }, [groupedItems, orderType, locationDetails, getRestaurantServiceability]);

  const hasBlockingIssues = restaurantValidations.length > 0;

  // Primary restaurant settings for delivery calculation
  const primaryRest = items[0]?.restaurant;
  const flatFee = primaryRest?.chargeSettings?.flatDeliveryFee ?? 40;
  const freeThreshold = primaryRest?.chargeSettings?.freeDeliveryThreshold ?? 500;

  const subtotal = isMounted ? getTotalPrice() : 0;
  const { autoDiscountAmount } = useMemo(
    () => calculateCartDiscounts(items, offers),
    [items, offers]
  );
  const isFreeDelivery = subtotal >= freeThreshold;
  const deliveryFee = orderType === "pickup" ? 0 : isFreeDelivery ? 0 : flatFee;
  const total = subtotal > 0 ? Math.max(0, subtotal + deliveryFee - autoDiscountAmount) : 0;
  const freeDeliveryDiff = Math.max(0, freeThreshold - subtotal);
  const freeDeliveryPercent = Math.min(100, Math.round((subtotal / freeThreshold) * 100));

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
        <div className="max-w-md w-full p-8 sm:p-12 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[var(--brand-accent)]/10 border border-[var(--brand-accent)]/20 text-[var(--brand-accent)] flex items-center justify-center mb-6 shadow-xs">
            <ShoppingBag size={38} />
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-[var(--text-main)]">
            Your cart is empty
          </h1>

          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
            Explore freshly prepared dishes from our artisan partner kitchens and add something you love.
          </p>

          <div className="mt-8">
            <Link
              href="/menu"
              className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] py-3.5 rounded-2xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-sm shadow-xl shadow-[var(--brand-accent)]/20 transition active:scale-98"
            >
              <span>Explore Menu</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── POPULATED CART ────────────────────────────────────────────────
  return (
    <main className="min-h-screen pt-28 sm:pt-32 pb-24 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto text-[var(--text-main)] transition-colors overflow-x-hidden min-w-0">
      {/* ── BREADCRUMBS ─────────────────────────────────────────── */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-6 overflow-x-auto pb-1 scrollbar-none"
      >
        <Link href="/" className="hover:text-[var(--brand-accent)] transition font-medium shrink-0">
          Home
        </Link>
        <ChevronRight size={12} className="shrink-0 opacity-60" />
        <Link href="/menu" className="hover:text-[var(--brand-accent)] transition font-medium shrink-0">
          Menu
        </Link>
        <ChevronRight size={12} className="shrink-0 opacity-60" />
        <span className="font-bold text-[var(--text-main)] shrink-0">
          Shopping Cart
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-6 border-b border-[var(--border-color)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)] mb-1">
            <UtensilsCrossed size={14} /> Curated Order Selection
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-black text-[var(--text-main)] tracking-tight">
            Review Your <span className="text-[var(--brand-accent)]">Cart</span>
          </h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              {items.reduce((acc, i) => acc + (i.quantity || 1), 0)} items ready for kitchen preparation • Fresh food. Zero compromises.
            </p>
            {isSyncing && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)] animate-pulse" />
                Syncing cart...
              </span>
            )}
          </div>
        </div>

        <Link
          href="/menu"
          className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--brand-accent)] transition self-start sm:self-auto py-2 px-3 rounded-xl bg-[var(--bg-sub)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/30 active:scale-98"
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
                className={`p-5 sm:p-7 rounded-3xl bg-[var(--bg-card)] border transition-all shadow-sm space-y-5 ${
                  !op.isOpen
                    ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
                    : !minOrderMet
                    ? "border-rose-500/30"
                    : "border-[var(--border-color)]"
                }`}
              >
                {/* Kitchen Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] flex items-center justify-center">
                      <Building size={16} />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-[var(--text-main)]">
                        {restName}
                      </h2>
                      <p className="text-[10px] text-[var(--text-muted)]">Artisan Kitchen Partner</p>
                    </div>
                    {op.isOpen ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Open Now
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Closed ({op.reason})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <span>Kitchen Subtotal: <strong className="font-mono text-[var(--text-main)]">₹{group.subtotal}</strong></span>
                    {minOrder > 0 && (
                      <span className={minOrderMet ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-amber-600 dark:text-amber-400 font-semibold"}>
                        (Min: ₹{minOrder})
                      </span>
                    )}
                  </div>
                </div>

                {/* Closed Alert Notice with One-Click Cleanup */}
                {!op.isOpen && (
                  <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle size={18} className="shrink-0" />
                      <span>
                        {restName} is currently closed ({op.reason || "Closed"}). Remove dishes from this kitchen to proceed with your order.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeKitchenItems(restName)}
                      className="px-3.5 py-2 min-h-[40px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-xs shrink-0 active:scale-95"
                    >
                      Remove Dishes
                    </button>
                  </div>
                )}

                {/* Min Order Notice */}
                {op.isOpen && !minOrderMet && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-2.5">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>
                      Minimum order for {restName} is ₹{minOrder}. Add ₹{minOrder - group.subtotal} more to qualify for checkout.
                    </span>
                  </div>
                )}

                {/* Out-of-Range Delivery Alert with 3 clear choices */}
                {op.isOpen && orderType === "delivery" && (() => {
                  const serv =
                    locationDetails?.hasExactCoordinates &&
                    locationDetails?.latitude != null &&
                    locationDetails?.longitude != null
                      ? getRestaurantServiceability(rest)
                      : null;
                  if (!serv || serv.isServiceable !== false) return null;

                  return (
                    <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <span className="font-bold block text-[13px]">
                            Delivery unavailable to your selected location
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block leading-relaxed">
                            {serv.distanceKm != null
                              ? `Your location is ${serv.distanceKm} km from ${restName}, which exceeds this kitchen's maximum delivery radius of ${serv.maxRadiusKm} km.`
                              : serv.reason || "Address outside kitchen delivery zone."}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                        <button
                          type="button"
                          onClick={openLocationModal}
                          className="px-3.5 py-2 min-h-[36px] rounded-xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                        >
                          <MapPin size={13} /> Change Delivery Location
                        </button>
                        {pickupCapability.isSupported && (
                          <button
                            type="button"
                            onClick={() => {
                              setOrderType("pickup");
                              setPickupNotice("");
                            }}
                            className="px-3.5 py-2 min-h-[36px] rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--brand-accent)]/30 text-[var(--text-main)] font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            <ShoppingBag size={13} /> Switch to Pickup (₹0)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeKitchenItems(restName)}
                          className="px-3.5 py-2 min-h-[36px] rounded-xl text-rose-500 hover:bg-rose-500/10 font-bold text-xs transition cursor-pointer ml-auto active:scale-95"
                        >
                          Remove Dishes
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Items in this kitchen */}
                <div className="space-y-4 divide-y divide-[var(--border-color)]">
                  {group.items.map((item) => (
                    <CartPageItemRow
                      key={item.cartItemId || `${item._id}__${item.variantName || 'default'}`}
                      item={item}
                      decreaseQty={decreaseQty}
                      increaseQty={increaseQty}
                      removeItem={removeItem}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: Order Summary Card */}
        <div className="sticky top-28 p-6 sm:p-7 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
            <h2 className="text-base sm:text-lg font-serif font-black text-[var(--text-main)]">
              Order Summary
            </h2>
            <span className="text-xs font-mono font-bold text-[var(--brand-accent)]">
              {items.length} {items.length === 1 ? "line item" : "line items"}
            </span>
          </div>

          {/* Delivery vs Pickup Mode Selection */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Fulfillment Method
            </span>
            <div className="grid grid-cols-2 gap-2 bg-[var(--bg-sub)] p-1.5 rounded-2xl border border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => {
                  setOrderType("delivery");
                  setPickupNotice("");
                }}
                className={`min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                  orderType === "delivery"
                    ? "bg-[var(--brand-accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
                aria-pressed={orderType === "delivery"}
              >
                <Truck size={16} /> Doorstep
              </button>
              <button
                type="button"
                disabled={!pickupCapability.isSupported}
                aria-disabled={!pickupCapability.isSupported}
                title={!pickupCapability.isSupported ? pickupCapability.reason : undefined}
                onClick={() => {
                  if (pickupCapability.isSupported) {
                    setOrderType("pickup");
                    setPickupNotice("");
                  }
                }}
                className={`min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                  !pickupCapability.isSupported
                    ? "opacity-50 cursor-not-allowed text-[var(--text-muted)]"
                    : orderType === "pickup"
                    ? "bg-[var(--brand-accent)] text-white shadow-sm cursor-pointer active:scale-98"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer active:scale-98"
                }`}
                aria-pressed={orderType === "pickup"}
              >
                <ShoppingBag size={16} /> Pickup {!pickupCapability.isSupported ? "(Unavailable)" : "(₹0)"}
              </button>
            </div>
            {!pickupCapability.isSupported && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                {pickupCapability.reason || "Self-pickup is not offered for the dishes in your cart."}
              </p>
            )}
            {pickupNotice && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2 mt-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{pickupNotice}</span>
              </div>
            )}
          </div>

          {/* Free Delivery Tracker (For Delivery mode) */}
          {orderType === "delivery" && freeThreshold > 0 && (
            <div className="p-3.5 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[var(--text-main)] flex items-center gap-1.5 text-[11px]">
                  <Sparkles size={13} className="text-[var(--brand-accent)]" />
                  {isFreeDelivery ? "Free Delivery Unlocked!" : "Free Delivery Target"}
                </span>
                <span className="text-[11px] font-mono font-bold text-[var(--brand-accent)]">
                  {isFreeDelivery ? "100%" : `₹${subtotal} / ₹${freeThreshold}`}
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
                  className="h-full bg-[var(--brand-accent)] rounded-full transition-all duration-300"
                  style={{ width: `${freeDeliveryPercent}%` }}
                />
              </div>
              {!isFreeDelivery && freeDeliveryDiff > 0 && (
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  Add <strong className="text-[var(--text-main)] font-mono">₹{freeDeliveryDiff}</strong> more to unlock free doorstep delivery.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Item Subtotal</span>
              <span className="font-mono font-semibold text-[var(--text-main)]">₹{subtotal}</span>
            </div>

            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Delivery Charge</span>
              <span className="font-mono font-semibold text-[var(--text-main)]">
                {deliveryFee === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-xs">FREE</span>
                ) : (
                  `₹${deliveryFee}`
                )}
              </span>
            </div>

            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Taxes & Kitchen Packaging</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Included</span>
            </div>

            {autoDiscountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} /> Automatic Kitchen Discount
                </span>
                <span className="font-mono">-₹{autoDiscountAmount}</span>
              </div>
            )}

            <div className="pt-3.5 border-t border-[var(--border-color)] flex justify-between items-baseline">
              <div>
                <span className="font-serif text-base font-bold text-[var(--text-main)]">Total Amount</span>
                <p className="text-[10px] text-[var(--text-muted)]">All applicable discounts applied</p>
              </div>
              <span className="text-2xl font-mono font-black text-[var(--brand-accent)]">
                ₹{total}
              </span>
            </div>
          </div>

          {/* Blocking Issues Alert */}
          {hasBlockingIssues && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 space-y-1.5 text-xs">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle size={15} /> Action Required:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
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
              className={`w-full min-h-[48px] py-4 rounded-2xl font-extrabold text-sm shadow-xl transition flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                hasBlockingIssues
                  ? "bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed border border-[var(--border-color)]"
                  : "bg-[var(--brand-accent)] hover:opacity-95 text-white shadow-[var(--brand-accent)]/20 active:scale-98 cursor-pointer"
              }`}
            >
              <span>{hasBlockingIssues ? "Resolve Cart Issues to Proceed" : "Proceed to Checkout"}</span>
              <ArrowRight size={16} />
            </button>

            <Link
              href="/menu"
              className="w-full min-h-[44px] py-3 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--brand-accent)]/40 font-semibold text-xs transition flex items-center justify-center cursor-pointer active:scale-98 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
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

function CartPageItemRow({ item, decreaseQty, increaseQty, removeItem }) {
  const [imgSrc, setImgSrc] = useState(item.image || FALLBACK_IMAGE);
  const qty = item.quantity || 1;
  const itemTotal = (item.price || 0) * qty;
  const itemKey = item.cartItemId || `${item._id}__${item.variantName || 'default'}`;

  useEffect(() => {
    setImgSrc(item.image || FALLBACK_IMAGE);
  }, [item.image]);

  const portionText = item.servingLabel || (item.portionQuantity ? `${item.portionQuantity} ${item.portionUnit || ''}` : '') + (item.size ? ` • ${item.size}` : '');

  return (
    <div className="pt-4.5 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-[var(--bg-sub)] shrink-0 border border-[var(--border-color)]">
          <Image
            src={imgSrc}
            alt={item.name}
            fill
            sizes="80px"
            className="object-cover"
            onError={() => setImgSrc(FALLBACK_IMAGE)}
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] truncate">
            {item.name}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {item.variantName && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20">
                {item.variantName}
              </span>
            )}
            {portionText && (
              <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-[var(--bg-sub)] border border-[var(--border-color)] text-[var(--text-muted)]">
                {portionText}
                {qty > 1 && item.portionQuantity ? ` (${qty * Number(item.portionQuantity)} ${item.portionUnit || ''} total)` : ''}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-[var(--text-muted)] mt-1">
            ₹{item.price} each
          </p>
          <p className="text-xs font-mono font-extrabold text-[var(--brand-accent)] mt-0.5">
            Total: ₹{itemTotal}
          </p>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between w-full sm:w-auto gap-3 self-end sm:self-center">
        <div className="flex items-center gap-1.5 bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => decreaseQty(itemKey)}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition cursor-pointer active:scale-90 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
            aria-label={`Decrease quantity of ${item.name}`}
          >
            <Minus size={15} />
          </button>
          <span className="w-6 text-center text-xs font-mono font-bold text-[var(--text-main)]">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => increaseQty(itemKey)}
            disabled={qty >= 20}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition cursor-pointer active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
            aria-label={`Increase quantity of ${item.name}`}
          >
            <Plus size={15} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => removeItem(itemKey)}
          className="min-w-[40px] min-h-[40px] p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition cursor-pointer active:scale-90 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-hidden"
          aria-label={`Remove ${item.name} from cart`}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}