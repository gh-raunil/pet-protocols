"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import useCartStore from "@/lib/cartStore";
import Link from "next/link";
import Image from "next/image";
import {
  CreditCard,
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Info,
  Lock,
  MapPin,
  MapPinned,
  Crosshair,
  Home,
  Briefcase,
  Plus,
  Check,
  Banknote,
  Truck,
  ShoppingBag,
  Tag,
  Ticket,
  Percent,
  X,
} from "lucide-react";
import { getRestaurantOperationalStatus } from "@/lib/restaurantHours";
import DeliveryPushPrompt from "@/components/notifications/DeliveryPushPrompt";
import { calculateCartDiscounts } from "@/lib/offersHelper";
import DeliveryLocationMapPicker from "@/components/checkout/DeliveryLocationMapPicker";
import Tooltip, { HelpTooltip } from "@/components/ui/Tooltip";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500";

function CheckoutItemRow({ item }) {
  const [imgSrc, setImgSrc] = useState(item.image || FALLBACK_IMAGE);

  useEffect(() => {
    setImgSrc(item.image || FALLBACK_IMAGE);
  }, [item.image]);

  const portionText = item.servingLabel || (item.portionQuantity ? `${item.portionQuantity} ${item.portionUnit || ''}` : '') + (item.size ? ` • ${item.size}` : '');

  return (
    <div className="flex items-center gap-3 bg-[var(--bg-sub)] p-2.5 rounded-2xl border border-[var(--border-color)]">
      <Image
        src={imgSrc}
        alt={item.name || "Dish item"}
        width={48}
        height={48}
        onError={() => setImgSrc(FALLBACK_IMAGE)}
        className="w-12 h-12 rounded-xl object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[var(--text-main)] truncate">{item.name}</p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {item.variantName && (
            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20">
              {item.variantName}
            </span>
          )}
          {portionText && (
            <span className="text-[10px] text-[var(--text-muted)] truncate">
              {portionText}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
          Qty: {item.quantity} × ₹{item.price}
        </p>
      </div>
      <span className="text-xs font-mono font-extrabold text-[var(--brand-accent)] shrink-0">
        ₹{(item.price || 0) * (item.quantity || 1)}
      </span>
    </div>
  );
}

// Dynamically load Razorpay standard checkout script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CheckoutClient() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { items, getTotalPrice, clearCart } = useCartStore();

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");

  // Fulfillment: Delivery vs Pickup
  const initialType = searchParams?.get("type") === "pickup" ? "pickup" : "delivery";
  const [orderType, setOrderType] = useState(initialType);

  // Payment Mode
  const [paymentMode, setPaymentMode] = useState(initialType === "pickup" ? "cop" : "cod");
  const [showTestCards, setShowTestCards] = useState(false);

  // Offers & Promo Codes
  const [availableOffers, setAvailableOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [appliedOffer, setAppliedOffer] = useState(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");

  // Address and Saved Addresses states
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("Home");
  const [fieldErrors, setFieldErrors] = useState({});
  const [draftNewAddress, setDraftNewAddress] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    latitude: null,
    longitude: null,
    recipientName: "",
    recipientPhone: "",
    isDifferentRecipient: false,
  });

  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    latitude: null,
    longitude: null,
    recipientName: "",
    recipientPhone: "",
    isDifferentRecipient: false,
  });

  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isLocatingDevice, setIsLocatingDevice] = useState(false);
  const [notes, setNotes] = useState("");
  const idempotencyKeyRef = useRef(null);
  const addressCardRefs = useRef({});

  const addressOptions = useMemo(
    () => [...savedAddresses.map((a) => a._id), "new"],
    [savedAddresses]
  );
  const activeAddressTabIndexId = addressOptions.includes(selectedAddressId)
    ? selectedAddressId
    : addressOptions[0];

  useEffect(() => {
    setIsMounted(true);
    loadRazorpayScript();

    if (session?.user?.name) {
      setAddress((prev) => ({
        ...prev,
        fullName: prev.fullName || session.user.name,
        phone: prev.phone || session.user.phone || "",
      }));
    }
  }, [session]);

  // Load saved addresses when authenticated
  useEffect(() => {
    async function loadSavedAddresses() {
      if (!session?.user) return;
      try {
        setLoadingAddresses(true);
        const res = await fetch("/api/user/addresses");
        const data = await res.json();
        if (data.success && Array.isArray(data.addresses) && data.addresses.length > 0) {
          setSavedAddresses(data.addresses);
          const defaultAddress = data.addresses.find((a) => a.isDefault) || data.addresses[0];
          setSelectedAddressId(defaultAddress._id);
          setAddress({
            fullName: defaultAddress.fullName || session?.user?.name || "",
            phone: defaultAddress.phone || session?.user?.phone || "",
            street: defaultAddress.street || "",
            city: defaultAddress.city || "New Delhi",
            state: defaultAddress.state || "Delhi",
            pincode: defaultAddress.pincode || "110001",
          });
        } else {
          setSelectedAddressId("new");
          setSaveAddressToProfile(true);
        }
      } catch (err) {
        console.error("Failed to load saved addresses:", err);
        setSelectedAddressId("new");
      } finally {
        setLoadingAddresses(false);
      }
    }

    if (session?.user) {
      loadSavedAddresses();
    }
  }, [session]);

  // Load customer-facing offers and auto-apply pre-selected coupon
  useEffect(() => {
    async function loadOffers() {
      try {
        setLoadingOffers(true);
        const res = await fetch("/api/offers");
        const data = await res.json();
        if (data.success && Array.isArray(data.offers)) {
          setAvailableOffers(data.offers);

          // Auto-apply coupon from query params or localStorage
          const paramCoupon = searchParams.get("coupon");
          let savedCoupon = "";
          try {
            savedCoupon = localStorage.getItem("pet_protocols_applied_coupon") || "";
          } catch (e) {}

          const targetCode = (paramCoupon || savedCoupon || "").trim().toUpperCase();
          if (targetCode) {
            const matched = data.offers.find(
              (o) => o.code && o.code.toUpperCase() === targetCode
            );
            if (matched) {
              setAppliedOffer(matched);
              setCouponInput(matched.code);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load offers:", err);
      } finally {
        setLoadingOffers(false);
      }
    }
    loadOffers();
  }, [searchParams]);

  // Sync payment mode when orderType changes
  const handleOrderTypeChange = (type) => {
    setOrderType(type);
    if (type === "pickup") {
      if (paymentMode === "cod") setPaymentMode("cop");
    } else {
      if (paymentMode === "cop") setPaymentMode("cod");
    }
  };

  const handleSelectSavedAddress = (saved) => {
    if (selectedAddressId === "new") {
      setDraftNewAddress(address);
    }
    setSelectedAddressId(saved._id);
    setAddress({
      fullName: saved.fullName || session?.user?.name || "",
      phone: saved.phone || session?.user?.phone || "",
      street: saved.street || "",
      city: saved.city || "New Delhi",
      state: saved.state || "Delhi",
      pincode: saved.pincode || "110001",
      latitude: saved.latitude || null,
      longitude: saved.longitude || null,
      recipientName: "",
      recipientPhone: "",
      isDifferentRecipient: false,
    });
    setSaveAddressToProfile(false);
    setFieldErrors({});
    setError("");
  };

  const handleSelectCustomAddress = () => {
    setSelectedAddressId("new");
    setAddress({
      fullName: draftNewAddress.fullName || session?.user?.name || "",
      phone: draftNewAddress.phone || session?.user?.phone || "",
      street: draftNewAddress.street || "",
      city: draftNewAddress.city || "New Delhi",
      state: draftNewAddress.state || "Delhi",
      pincode: draftNewAddress.pincode || "110001",
      latitude: draftNewAddress.latitude || null,
      longitude: draftNewAddress.longitude || null,
      recipientName: draftNewAddress.recipientName || "",
      recipientPhone: draftNewAddress.recipientPhone || "",
      isDifferentRecipient: draftNewAddress.isDifferentRecipient || false,
    });
    setSaveAddressToProfile(true);
    setFieldErrors({});
    setError("");
  };

  const handleSelectMapLocation = (coords) => {
    if (!coords) return;
    setAddress((prev) => ({
      ...prev,
      latitude: coords.latitude,
      longitude: coords.longitude,
    }));
    if (selectedAddressId === "new") {
      setDraftNewAddress((prev) => ({
        ...prev,
        latitude: coords.latitude,
        longitude: coords.longitude,
      }));
    }
  };

  const handleQuickGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocatingDevice(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingDevice(false);
        const { latitude, longitude } = pos.coords;
        setAddress((prev) => ({
          ...prev,
          latitude,
          longitude,
        }));
        if (selectedAddressId === "new") {
          setDraftNewAddress((prev) => ({
            ...prev,
            latitude,
            longitude,
          }));
        }
      },
      (err) => {
        setIsLocatingDevice(false);
        if (err.code === 1) {
          setError("Location access denied. Please allow location permissions in your browser.");
        } else {
          setError("Unable to retrieve device GPS. Please choose location on the map.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  };

  const handleClearPin = () => {
    setAddress((prev) => ({
      ...prev,
      latitude: null,
      longitude: null,
    }));
    if (selectedAddressId === "new") {
      setDraftNewAddress((prev) => ({
        ...prev,
        latitude: null,
        longitude: null,
      }));
    }
  };

  const handleAddressKeyDown = (e, currentId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (currentId === "new") {
        handleSelectCustomAddress();
      } else {
        const addr = savedAddresses.find((a) => a._id === currentId);
        if (addr) handleSelectSavedAddress(addr);
      }
      return;
    }

    if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) {
      e.preventDefault();
      const currentIndex = addressOptions.indexOf(currentId);
      if (currentIndex === -1) return;

      let nextIndex;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % addressOptions.length;
      } else {
        nextIndex = (currentIndex - 1 + addressOptions.length) % addressOptions.length;
      }

      const nextId = addressOptions[nextIndex];
      if (nextId === "new") {
        handleSelectCustomAddress();
      } else {
        const nextAddr = savedAddresses.find((a) => a._id === nextId);
        if (nextAddr) handleSelectSavedAddress(nextAddr);
      }

      setTimeout(() => {
        addressCardRefs.current[nextId]?.focus();
      }, 0);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAddress((prev) => {
      const next = { ...prev, [name]: value };
      if (selectedAddressId === "new") {
        setDraftNewAddress(next);
      }
      return next;
    });
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
    setError("");
  };

  // Group items by restaurant for multi-restaurant calculation
  const groupedRestaurants = useMemo(() => {
    return items.reduce((acc, item) => {
      const rest = item.restaurant || {};
      const key = rest.name || "Default Kitchen";
      if (!acc[key]) {
        acc[key] = { restaurant: rest, items: [], subtotal: 0 };
      }
      acc[key].items.push(item);
      acc[key].subtotal += (item.price || 0) * (item.quantity || 1);
      return acc;
    }, {});
  }, [items]);

  // Operational validation for all kitchens in cart
  const kitchenValidations = useMemo(() => {
    return Object.entries(groupedRestaurants).map(([name, group]) => {
      const op = getRestaurantOperationalStatus(group.restaurant);
      const minOrder = group.restaurant?.orderLimits?.minOrderAmount || 0;
      const isBelowMin = minOrder > 0 && group.subtotal < minOrder;
      return {
        name,
        restaurant: group.restaurant,
        op,
        isClosed: !op.isOpen,
        isBelowMin,
        minOrder,
        subtotal: group.subtotal,
      };
    });
  }, [groupedRestaurants]);

  const hasClosedKitchen = kitchenValidations.some((v) => v.isClosed);
  const hasBelowMinOrder = kitchenValidations.some((v) => v.isBelowMin);
  const hasBlockingIssues = hasClosedKitchen || hasBelowMinOrder;

  // Primary restaurant settings (for charge, delivery radius, payment options)
  const primaryRest = Object.values(groupedRestaurants)[0]?.restaurant || {};
  const flatFee = primaryRest?.chargeSettings?.flatDeliveryFee ?? 40;
  const freeThreshold = primaryRest?.chargeSettings?.freeDeliveryThreshold ?? 500;
  const deliveryRadius = primaryRest?.deliverySettings?.deliveryRadiusKm;

  // Subtotal, Delivery & Discounts (Option A Coupon + Option B Auto)
  const subtotal = getTotalPrice();
  const isFreeDelivery = orderType === "pickup" || subtotal >= freeThreshold;
  const deliveryFee = orderType === "pickup" ? 0 : isFreeDelivery ? 0 : flatFee;

  const {
    autoDiscountAmount,
    couponDiscountAmount,
    totalDiscountAmount,
    autoOffersApplied,
  } = useMemo(
    () => calculateCartDiscounts(items, availableOffers, appliedOffer),
    [items, availableOffers, appliedOffer]
  );

  const discountAmount = totalDiscountAmount;
  const total = Math.max(0, subtotal + deliveryFee - discountAmount);

  // Apply Coupon Code (Option A)
  const handleApplyCoupon = (offerOrCode) => {
    setCouponError("");
    let targetOffer = null;

    if (typeof offerOrCode === "object" && offerOrCode !== null) {
      targetOffer = offerOrCode;
    } else {
      const codeStr = (offerOrCode || couponInput).trim().toUpperCase();
      if (!codeStr) {
        setCouponError("Please enter a promo code.");
        return;
      }
      targetOffer = availableOffers.find(
        (o) => o.code && o.code.toUpperCase() === codeStr
      );
      if (!targetOffer) {
        setCouponError(`Coupon code "${codeStr}" is not active or invalid.`);
        return;
      }
    }

    const targetRestId = targetOffer.restaurant?._id || targetOffer.restaurant;
    if (targetRestId) {
      const restGroup = Object.values(groupedRestaurants).find((g) => {
        const rId = g.restaurant?._id || g.restaurant?.id;
        return rId && String(rId) === String(targetRestId);
      });

      if (!restGroup) {
        const restName = targetOffer.restaurant?.name || "the participating kitchen";
        setCouponError(`This offer is valid only for orders from ${restName}. Your cart does not have dishes from this kitchen.`);
        return;
      }

      if (targetOffer.minOrder && restGroup.subtotal < targetOffer.minOrder) {
        setCouponError(
          `This offer requires a minimum order of ₹${targetOffer.minOrder} from ${targetOffer.restaurant?.name || "this kitchen"} (current: ₹${restGroup.subtotal}).`
        );
        return;
      }
    } else if (targetOffer.minOrder && subtotal < targetOffer.minOrder) {
      setCouponError(`This offer requires a minimum order of ₹${targetOffer.minOrder} (current subtotal: ₹${subtotal}).`);
      return;
    }

    // Target Scope: Category Check
    if (targetOffer.targetType === "category" && targetOffer.targetCategory) {
      const hasCategoryMatch = items.some(
        (item) => item.category && item.category.trim().toLowerCase() === targetOffer.targetCategory.trim().toLowerCase()
      );
      if (!hasCategoryMatch) {
        setCouponError(`This coupon is only valid for dishes in the "${targetOffer.targetCategory}" category.`);
        return;
      }
    }

    // Target Scope: Specific Products Check
    if (targetOffer.targetType === "products" && Array.isArray(targetOffer.targetProducts) && targetOffer.targetProducts.length > 0) {
      const targetIds = targetOffer.targetProducts.map((p) => (typeof p === "object" ? String(p._id) : String(p)));
      const hasProductMatch = items.some((item) => targetIds.includes(String(item._id)));
      if (!hasProductMatch) {
        setCouponError("This coupon is only valid for specific selected dishes in the offer.");
        return;
      }
    }

    setAppliedOffer(targetOffer);
    setCouponInput(targetOffer.code || "");
    setCouponError("");
    try {
      if (targetOffer.code) {
        localStorage.setItem("pet_protocols_applied_coupon", targetOffer.code);
      }
    } catch (e) {}
  };

  const handleRemoveCoupon = () => {
    setAppliedOffer(null);
    setCouponInput("");
    setCouponError("");
    try {
      localStorage.removeItem("pet_protocols_applied_coupon");
    } catch (e) {}
  };

  const validateDetails = () => {
    const errors = {};
    const trimmedName = (address.fullName || "").trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.fullName = "Please enter your recipient full name (at least 2 characters).";
    }

    const cleanPhone = (address.phone || "").replace(/[\s-]/g, "");
    if (!cleanPhone || !/^\d{10}$/.test(cleanPhone)) {
      errors.phone = "Please enter a valid 10-digit mobile contact number.";
    }

    if (orderType === "delivery") {
      const trimmedStreet = (address.street || "").trim();
      if (!trimmedStreet || trimmedStreet.length < 5) {
        errors.street = "Please provide your delivery street, house, or apartment address.";
      }
      const trimmedCity = (address.city || "").trim();
      if (!trimmedCity) {
        errors.city = "Please provide your delivery city.";
      }
      const trimmedPin = (address.pincode || "").trim();
      if (!trimmedPin || !/^\d{6}$/.test(trimmedPin)) {
        errors.pincode = "Please provide a valid 6-digit delivery area pincode.";
      }

      if (address.isDifferentRecipient) {
        const trimmedRecipName = (address.recipientName || "").trim();
        if (!trimmedRecipName || trimmedRecipName.length < 2) {
          errors.recipientName = "Please enter the recipient's name (at least 2 characters).";
        }
        const cleanRecipPhone = (address.recipientPhone || "").replace(/[\s-]/g, "");
        if (!cleanRecipPhone || !/^\d{10}$/.test(cleanRecipPhone)) {
          errors.recipientPhone = "Please enter a valid 10-digit mobile number for the recipient.";
        }
      }
    }

    setFieldErrors(errors);

    const firstError = Object.values(errors)[0];
    if (firstError) {
      setError(firstError);
      return false;
    }

    if (hasBlockingIssues) {
      setError("Please resolve the operational kitchen issues before placing the order.");
      return false;
    }
    return true;
  };

  const saveAddressIfRequested = async () => {
    if (orderType === "pickup") return;
    if (!saveAddressToProfile || !session?.user || selectedAddressId !== "new") return;
    try {
      await fetch("/api/user/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newAddressLabel || "Home",
          fullName: address.fullName,
          phone: address.phone,
          street: address.street,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          latitude: address.latitude,
          longitude: address.longitude,
          isDefault: savedAddresses.length === 0,
        }),
      });
    } catch (e) {
      console.warn("Could not save address to profile:", e);
    }
  };

  // 1. Razorpay Real / Sandbox Checkout Flow
  const handleRazorpayCheckout = async () => {
    if (loading) return;
    if (!validateDetails()) return;

    setLoading(true);
    setLoadingStep("Initializing secure Razorpay payment gateway...");
    setError("");

    try {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          items,
          address: orderType === "pickup" ? { ...address, street: "Self Pickup at Kitchen Counter" } : address,
          notes,
          orderType,
          discount: discountAmount,
          couponCode: appliedOffer?.code || "",
        }),
      });

      const orderData = await res.json();
      if (!orderData.success) {
        setError(orderData.message || "Failed to initialize payment.");
        setLoading(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || typeof window.Razorpay === "undefined") {
        setError("Failed to load Razorpay payment SDK. Please check your internet connection.");
        setLoading(false);
        return;
      }

      const razorpayKey = orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        setError("Payment gateway is not configured properly. Please contact support.");
        setLoading(false);
        return;
      }

      const options = {
        key: razorpayKey,
        amount: orderData.order.amount,
        currency: orderData.order.currency || "INR",
        name: "पेट Protocols",
        description: `Food Feast Order (${items.length} items)`,
        order_id: orderData.order.id,
        prefill: {
          name: address.fullName,
          contact: address.phone,
          email: session?.user?.email || "customer@petprotocols.com",
        },
        theme: {
          color: "#ea580c",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setLoadingStep("");
          },
        },
        handler: async function (response) {
          try {
            setLoading(true);
            setLoadingStep("Verifying payment signature with server...");

            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                items,
                address: orderType === "pickup" ? { ...address, street: "Self Pickup at Kitchen Counter" } : address,
                notes,
                totalAmount: total,
                orderType,
                discount: discountAmount,
                couponCode: appliedOffer?.code || "",
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setLoadingStep("Order confirmed! Redirecting...");
              try {
                localStorage.removeItem("pet_protocols_applied_coupon");
              } catch (e) {}
              await saveAddressIfRequested();
              await clearCart();
              const targetOrderId = verifyData.order?._id || verifyData.orderId || "";
              router.push(targetOrderId ? `/order-confirmation?orderId=${targetOrderId}` : "/order-confirmation");
            } else {
              setError(verifyData.message || "Payment verification failed. Contact support.");
              setLoading(false);
            }
          } catch (verifyErr) {
            console.error("Verification error:", verifyErr);
            setError("Server error while verifying your payment. Please check your orders page.");
            setLoading(false);
          }
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on("payment.failed", function (response) {
        console.error("Payment failed:", response.error);
        setError(`Payment Failed: ${response.error?.description || "Transaction declined"}`);
        setLoading(false);
      });
      razorpayInstance.open();
    } catch (err) {
      console.error(err);
      setError("An unexpected network error occurred while preparing your checkout.");
      setLoading(false);
    }
  };

  // 2. Instant Simulator Checkout Flow (Demo/Dev)
  const handleSimulatorCheckout = async () => {
    if (loading) return;
    if (!validateDetails()) return;

    setLoading(true);
    setLoadingStep("Placing instant simulation order...");
    setError("");

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `client_idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    const currentIdempotencyKey = idempotencyKeyRef.current;

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": currentIdempotencyKey,
        },
        body: JSON.stringify({
          items,
          address: orderType === "pickup" ? { ...address, street: "Self Pickup at Kitchen Counter" } : address,
          notes,
          orderType,
          discount: discountAmount,
          couponCode: appliedOffer?.code || "",
          paymentMethod: "Instant Simulator (Test Mode)",
          idempotencyKey: currentIdempotencyKey,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Failed to place order.");
        setLoading(false);
        return;
      }

      idempotencyKeyRef.current = null;
      await saveAddressIfRequested();
      try {
        localStorage.removeItem("pet_protocols_applied_coupon");
      } catch (e) {}
      await clearCart();
      const targetOrderId = data.order?._id || data.orderId || "";
      router.push(targetOrderId ? `/order-confirmation?orderId=${targetOrderId}` : "/order-confirmation");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred during simulator checkout.");
      setLoading(false);
    }
  };

  // 3. Cash on Delivery (COD) / Cash on Pickup (COP) Checkout Flow
  const handleCashCheckout = async () => {
    if (loading) return;
    if (!validateDetails()) return;

    const isPickup = orderType === "pickup";
    const paymentMethodLabel = isPickup ? "Cash on Pickup (COP)" : "Cash on Delivery (COD)";

    setLoading(true);
    setLoadingStep(isPickup ? "Confirming Cash on Pickup order..." : "Confirming Cash on Delivery order...");
    setError("");

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `client_idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    const currentIdempotencyKey = idempotencyKeyRef.current;

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": currentIdempotencyKey,
        },
        body: JSON.stringify({
          items,
          address: isPickup ? { ...address, street: "Self Pickup at Kitchen Counter" } : address,
          notes,
          orderType,
          discount: discountAmount,
          couponCode: appliedOffer?.code || "",
          paymentMethod: paymentMethodLabel,
          idempotencyKey: currentIdempotencyKey,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Failed to place order.");
        setLoading(false);
        return;
      }

      idempotencyKeyRef.current = null;
      await saveAddressIfRequested();
      try {
        localStorage.removeItem("pet_protocols_applied_coupon");
      } catch (e) {}
      await clearCart();
      const targetOrderId = data.order?._id || data.orderId || "";
      router.push(targetOrderId ? `/order-confirmation?orderId=${targetOrderId}` : "/order-confirmation");
    } catch (err) {
      console.error("Cash checkout error:", err);
      setError("An unexpected error occurred while placing order.");
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;

    if (paymentMode === "razorpay") {
      handleRazorpayCheckout();
    } else if (paymentMode === "cod" || paymentMode === "cop") {
      handleCashCheckout();
    } else {
      handleSimulatorCheckout();
    }
  };

  if (!isMounted) return null;

  if (items.length === 0) {
    return (
      <main className="min-h-screen pt-32 pb-24 px-6 flex items-center justify-center text-center text-[var(--text-main)]">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl">
          <ShoppingBag size={40} className="mx-auto text-[var(--brand-accent)] mb-4" />
          <h1 className="text-2xl font-black text-[var(--text-main)]">Your cart is empty</h1>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Add items from our partner kitchens before checking out.
          </p>
          <Link
            href="/menu"
            className="inline-block mt-6 px-6 py-3 rounded-2xl bg-[var(--brand-accent)] text-white font-bold text-xs shadow-lg shadow-[var(--brand-accent)]/20"
          >
            Explore Menu
          </Link>
        </div>
      </main>
    );
  }

  const steps = [
    { num: 1, label: "Fulfillment" },
    { num: 2, label: "Details" },
    { num: 3, label: "Offers" },
    { num: 4, label: "Payment" },
    { num: 5, label: "Confirm" },
  ];

  return (
    <main className="min-h-screen pt-28 pb-20 px-3 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto text-[var(--text-main)] transition-colors overflow-x-hidden min-w-0">
      {/* ── BREADCRUMB PROGRESS BAR ────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--brand-accent)] uppercase tracking-wider mb-2">
          <ShieldCheck size={15} /> Multi-Kitchen Secure Checkout
        </div>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-[var(--text-main)]">
          Checkout & Order Confirmation
        </h1>

        <div className="mt-6 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hidden md:flex items-center justify-between">
          {steps.map((st, i) => (
            <div key={st.num} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[var(--brand-accent)] text-white font-black text-xs flex items-center justify-center">
                {st.num}
              </span>
              <span className="text-xs font-bold text-[var(--text-main)]">
                {st.label}
              </span>
              {i < steps.length - 1 && (
                <div className="w-12 h-0.5 bg-[var(--border-color)] ml-3" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* LEFT: Fulfillment, Address & Payment */}
        <div className="lg:col-span-2 space-y-6">
          <DeliveryPushPrompt className="mb-2" />
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Fulfillment Type Selector */}
            <div className="bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-color)] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text-main)] flex items-center gap-2">
                    <Truck size={18} className="text-[var(--brand-accent)]" />
                    How would you like to receive your food?
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Choose between doorstep delivery or self-pickup
                  </p>
                </div>
                {deliveryRadius && (
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--bg-sub)] px-2.5 py-1 rounded-full border border-[var(--border-color)]">
                    📍 Delivers up to {deliveryRadius} km
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Tooltip
                  content="Fresh meals dispatched straight to your doorstep with live GPS rider tracking."
                  placement="top"
                >
                  <button
                    type="button"
                    onClick={() => handleOrderTypeChange("delivery")}
                    className={`w-full p-4 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3.5 ${
                      orderType === "delivery"
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 ring-1 ring-[var(--brand-accent)]"
                        : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center shrink-0 mt-0.5">
                      <Truck size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[var(--text-main)]">Doorstep Delivery</span>
                        {orderType === "delivery" && (
                          <CheckCircle2 size={16} className="text-[var(--brand-accent)] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {isFreeDelivery ? "Free delivery unlocked!" : `Flat ₹${flatFee} delivery fee`}
                      </p>
                    </div>
                  </button>
                </Tooltip>

                <Tooltip
                  content="Save on delivery charges! Pick up your freshly prepared meal in person at the kitchen counter."
                  placement="top"
                >
                  <button
                    type="button"
                    onClick={() => handleOrderTypeChange("pickup")}
                    className={`w-full p-4 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3.5 ${
                      orderType === "pickup"
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 ring-1 ring-[var(--brand-accent)]"
                        : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                      <ShoppingBag size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[var(--text-main)]">Self Pickup (COP)</span>
                        {orderType === "pickup" && (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-emerald-500 font-semibold mt-1">
                        ₹0 delivery charge • Pick up at kitchen
                      </p>
                    </div>
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Step 2: Contact & Address Details */}
            <div className="bg-[var(--bg-card)] rounded-3xl p-6 md:p-8 border border-[var(--border-color)] shadow-xl space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center">
                    {orderType === "delivery" ? <MapPin size={17} /> : <ShoppingBag size={17} />}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[var(--text-main)]">
                      {orderType === "delivery" ? "Delivery Address & Contact" : "Pickup Customer Contact"}
                    </h2>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {orderType === "delivery"
                        ? "Dispatched directly to your door upon preparation"
                        : "Required for kitchen counter order identification"}
                    </span>
                  </div>
                </div>

                {orderType === "delivery" && session?.user && (
                  <Link
                    href="/profile"
                    className="text-xs text-[var(--brand-accent)] hover:underline font-semibold transition"
                  >
                    Manage saved addresses →
                  </Link>
                )}
              </div>

              {/* Saved Addresses (Delivery Only) */}
              {orderType === "delivery" && savedAddresses.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={13} className="text-[var(--brand-accent)]" />
                    Select a Saved Location
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" role="radiogroup" aria-label="Delivery address selection">
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr._id;
                      const isTabTarget = activeAddressTabIndexId === addr._id;
                      return (
                        <div
                          key={addr._id}
                          ref={(el) => {
                            if (el) addressCardRefs.current[addr._id] = el;
                          }}
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={isTabTarget ? 0 : -1}
                          onClick={() => handleSelectSavedAddress(addr)}
                          onKeyDown={(e) => handleAddressKeyDown(e, addr._id)}
                          className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                            isSelected
                              ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 ring-1 ring-[var(--brand-accent)]"
                              : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--brand-accent)]/40"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                              {addr.label === "Home" ? (
                                <Home size={13} className="text-[var(--brand-accent)]" />
                              ) : addr.label === "Work" ? (
                                <Briefcase size={13} className="text-blue-400" />
                              ) : (
                                <MapPin size={13} className="text-emerald-400" />
                              )}
                              {addr.label || "Home"}
                            </span>
                            {isSelected ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-accent)] text-white flex items-center gap-1 shadow-xs">
                                <Check size={10} strokeWidth={3} /> Selected
                              </span>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)] hover:text-[var(--brand-accent)]">Select</span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-[var(--text-main)] truncate">
                            {addr.fullName}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-0.5 leading-relaxed">
                            {addr.street}, {addr.city} - {addr.pincode}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                            📞 {addr.phone}
                          </p>
                        </div>
                      );
                    })}

                    <div
                      ref={(el) => {
                        if (el) addressCardRefs.current["new"] = el;
                      }}
                      role="radio"
                      aria-checked={selectedAddressId === "new"}
                      tabIndex={activeAddressTabIndexId === "new" ? 0 : -1}
                      onClick={handleSelectCustomAddress}
                      onKeyDown={(e) => handleAddressKeyDown(e, "new")}
                      className={`p-3.5 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                        selectedAddressId === "new"
                          ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] ring-1 ring-[var(--brand-accent)]"
                          : "border-[var(--border-color)] bg-[var(--bg-sub)] text-[var(--text-muted)] hover:border-[var(--brand-accent)]/40 hover:text-[var(--text-main)]"
                      }`}
                    >
                      <Plus size={16} className="mb-1 text-[var(--brand-accent)]" />
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold">New Address</span>
                        {selectedAddressId === "new" && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[var(--brand-accent)] text-white">Active</span>
                        )}
                      </div>
                      <span className="text-[10px] opacity-75">Deliver to a new place</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="checkout-fullName" className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                    Recipient Full Name *
                  </label>
                  <input
                    id="checkout-fullName"
                    name="fullName"
                    placeholder="e.g. Rahul Roy"
                    value={address.fullName}
                    onChange={handleChange}
                    autoComplete="name"
                    required
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
                    className={`w-full bg-[var(--bg-sub)] border rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden transition shadow-sm ${
                      fieldErrors.fullName ? "border-rose-500" : "border-[var(--border-color)]"
                    }`}
                  />
                  {fieldErrors.fullName && (
                    <p id="fullName-error" className="text-[11px] text-rose-500 font-medium mt-1">
                      {fieldErrors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="checkout-phone" className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                    Contact Phone Number *
                  </label>
                  <input
                    id="checkout-phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="e.g. 9876543210"
                    value={address.phone}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                    className={`w-full bg-[var(--bg-sub)] border rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden transition shadow-sm ${
                      fieldErrors.phone ? "border-rose-500" : "border-[var(--border-color)]"
                    }`}
                  />
                  {fieldErrors.phone && (
                    <p id="phone-error" className="text-[11px] text-rose-500 font-medium mt-1">
                      {fieldErrors.phone}
                    </p>
                  )}
                </div>

                {orderType === "delivery" && (
                  <>
                    <div className="md:col-span-2">
                      <label htmlFor="checkout-street" className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                        House / Flat / Street / Landmark *
                      </label>
                      <input
                        id="checkout-street"
                        name="street"
                        placeholder="e.g. Flat 302, Green Valley Apartments"
                        value={address.street}
                        onChange={handleChange}
                        autoComplete="street-address"
                        required
                        aria-invalid={Boolean(fieldErrors.street)}
                        aria-describedby={fieldErrors.street ? "street-error" : undefined}
                        className={`w-full bg-[var(--bg-sub)] border rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden transition shadow-sm ${
                          fieldErrors.street ? "border-rose-500" : "border-[var(--border-color)]"
                        }`}
                      />
                      {fieldErrors.street && (
                        <p id="street-error" className="text-[11px] text-rose-500 font-medium mt-1">
                          {fieldErrors.street}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="checkout-city" className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                        City *
                      </label>
                      <input
                        id="checkout-city"
                        name="city"
                        placeholder="New Delhi"
                        value={address.city}
                        onChange={handleChange}
                        autoComplete="address-level2"
                        required
                        aria-invalid={Boolean(fieldErrors.city)}
                        aria-describedby={fieldErrors.city ? "city-error" : undefined}
                        className={`w-full bg-[var(--bg-sub)] border rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden transition shadow-sm ${
                          fieldErrors.city ? "border-rose-500" : "border-[var(--border-color)]"
                        }`}
                      />
                      {fieldErrors.city && (
                        <p id="city-error" className="text-[11px] text-rose-500 font-medium mt-1">
                          {fieldErrors.city}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="checkout-pincode" className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                        Pincode *
                      </label>
                      <input
                        id="checkout-pincode"
                        name="pincode"
                        placeholder="110001"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="postal-code"
                        value={address.pincode}
                        onChange={handleChange}
                        required
                        aria-invalid={Boolean(fieldErrors.pincode)}
                        aria-describedby={fieldErrors.pincode ? "pincode-error" : undefined}
                        className={`w-full bg-[var(--bg-sub)] border rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden transition shadow-sm ${
                          fieldErrors.pincode ? "border-rose-500" : "border-[var(--border-color)]"
                        }`}
                      />
                      {fieldErrors.pincode && (
                        <p id="pincode-error" className="text-[11px] text-rose-500 font-medium mt-1">
                          {fieldErrors.pincode}
                        </p>
                      )}
                    </div>

                    {/* Doorstep Pin on Map (Optional) */}
                    <div className="md:col-span-2 p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--border-color)] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
                            <MapPin size={15} className="text-emerald-500" />
                            Doorstep Location Pin on Map <span className="text-[10px] text-[var(--text-muted)] font-normal bg-[var(--bg-card)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">Optional</span>
                          </span>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            Pinning on the map gives our delivery partner exact coordinates so they don&apos;t have to call for directions
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Tooltip
                            content="Open interactive map to set an exact pin for your building gate or doorway"
                            placement="top"
                          >
                            <button
                              type="button"
                              onClick={() => setIsMapPickerOpen(true)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                            >
                              <MapPinned size={14} />
                              <span>{address.latitude ? "Change Pin" : "Choose on Map"}</span>
                            </button>
                          </Tooltip>

                          <Tooltip
                            content="Automatically detect and pin your current physical GPS coordinates"
                            placement="top"
                          >
                            <button
                              type="button"
                              onClick={handleQuickGps}
                              disabled={isLocatingDevice}
                              className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-sub)] text-[var(--text-main)] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              aria-label="Use my device current location"
                            >
                              <Crosshair size={14} className="text-emerald-500" />
                              <span>{isLocatingDevice ? "Locating..." : "Use My GPS"}</span>
                            </button>
                          </Tooltip>
                        </div>
                      </div>

                      {address.latitude && address.longitude && (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 size={15} className="shrink-0" />
                            <span>
                              Exact Delivery Pin Set: <span className="font-mono text-[11px] font-bold">{address.latitude.toFixed(5)}, {address.longitude.toFixed(5)}</span>
                            </span>
                          </div>
                          <Tooltip
                            content="Clear the GPS pin and rely on your written street address"
                            placement="left"
                          >
                            <button
                              type="button"
                              onClick={handleClearPin}
                              className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
                            >
                              Remove Pin
                            </button>
                          </Tooltip>
                        </div>
                      )}
                    </div>

                    {/* Alternate Recipient / Another Location Option */}
                    <div className="md:col-span-2 pt-2 border-t border-[var(--border-color)]">
                      <label className="flex items-start gap-3 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={address.isDifferentRecipient}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAddress((prev) => ({
                              ...prev,
                              isDifferentRecipient: checked,
                              recipientName: checked ? prev.recipientName : "",
                              recipientPhone: checked ? prev.recipientPhone : "",
                            }));
                          }}
                          className="mt-0.5 w-4 h-4 rounded text-[var(--brand-accent)] border-[var(--border-color)] focus:ring-[var(--brand-accent)] cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-[var(--text-main)] group-hover:text-[var(--brand-accent)] transition">
                            Delivering to another location or ordering for someone else?
                          </span>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            Order from anywhere (office, travelling, etc.) and send to family, friend, or coworker with their direct contact details
                          </p>
                        </div>
                      </label>

                      {address.isDifferentRecipient && (
                        <div className="mt-3 p-4 rounded-2xl bg-[var(--bg-sub)] border border-[var(--brand-accent)]/30 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                          <div>
                            <label htmlFor="checkout-recipientName" className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                              Recipient Name at Destination *
                            </label>
                            <input
                              id="checkout-recipientName"
                              name="recipientName"
                              placeholder="e.g. Priya Sharma / Roommate Name"
                              value={address.recipientName}
                              onChange={handleChange}
                              required={address.isDifferentRecipient}
                              className={`w-full bg-[var(--bg-card)] border rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden transition shadow-sm ${
                                fieldErrors.recipientName ? "border-rose-500" : "border-[var(--border-color)]"
                              }`}
                            />
                            {fieldErrors.recipientName && (
                              <p className="text-[11px] text-rose-500 font-medium mt-1">
                                {fieldErrors.recipientName}
                              </p>
                            )}
                          </div>

                          <div>
                            <label htmlFor="checkout-recipientPhone" className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                              Recipient Direct Phone Number *
                            </label>
                            <input
                              id="checkout-recipientPhone"
                              name="recipientPhone"
                              type="tel"
                              inputMode="numeric"
                              placeholder="e.g. 9876543210"
                              value={address.recipientPhone}
                              onChange={handleChange}
                              required={address.isDifferentRecipient}
                              className={`w-full bg-[var(--bg-card)] border rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden transition shadow-sm ${
                                fieldErrors.recipientPhone ? "border-rose-500" : "border-[var(--border-color)]"
                              }`}
                            />
                            {fieldErrors.recipientPhone && (
                              <p className="text-[11px] text-rose-500 font-medium mt-1">
                                {fieldErrors.recipientPhone}
                              </p>
                            )}
                            <span className="text-[10px] text-[var(--text-muted)] block mt-1">
                              📞 Delivery partner will call this direct recipient number upon arrival.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label htmlFor="checkout-notes" className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                    {orderType === "pickup" ? "Kitchen Pickup Notes" : "Kitchen / Delivery Instructions"}
                  </label>
                  <input
                    id="checkout-notes"
                    name="notes"
                    placeholder={
                      orderType === "pickup"
                        ? "e.g. Arriving at 7:30 PM, extra spicy, separate bag"
                        : "e.g. Ring bell, leave at reception, extra napkins"
                    }
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden transition shadow-sm"
                  />
                </div>

                {/* Save address option (Delivery only) */}
                {orderType === "delivery" && selectedAddressId === "new" && (
                  <div className="md:col-span-2 pt-3 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition">
                      <input
                        type="checkbox"
                        checked={saveAddressToProfile}
                        onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                        className="rounded border-[var(--border-color)] bg-[var(--bg-sub)] text-[var(--brand-accent)] focus:ring-[var(--brand-accent)] w-4 h-4 cursor-pointer"
                      />
                      <span>Save this address to my profile for future orders</span>
                    </label>

                    {saveAddressToProfile && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--text-muted)]">Save as:</span>
                        {["Home", "Work", "Other"].map((lbl) => (
                          <button
                            type="button"
                            key={lbl}
                            onClick={() => setNewAddressLabel(lbl)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition font-medium cursor-pointer ${
                              newAddressLabel === lbl
                                ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]"
                                : "border-[var(--border-color)] bg-[var(--bg-sub)] text-[var(--text-muted)] hover:border-[var(--brand-accent)]/30"
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Payment Method Selection */}
            <div className="bg-[var(--bg-card)] rounded-3xl p-6 md:p-8 border border-[var(--border-color)] shadow-xl space-y-4">
              <h2 className="text-base font-extrabold text-[var(--text-main)] flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
                <CreditCard size={18} className="text-[var(--brand-accent)]" />
                <span>Select Payment Method</span>
                <HelpTooltip
                  content="Choose how you prefer to pay. Cash on Delivery is collected in cash or UPI scan at your door. Online payment is processed securely via Razorpay."
                  title="Payment Options"
                  side="right"
                />
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5" role="radiogroup" aria-label="Payment method selection">
                {/* 1. Cash on Delivery (COD) OR Cash on Pickup (COP) */}
                {orderType === "delivery" ? (
                  <div
                    role="radio"
                    aria-checked={paymentMode === "cod"}
                    tabIndex={0}
                    onClick={() => setPaymentMode("cod")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPaymentMode("cod");
                      }
                    }}
                    className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-hidden ${
                      paymentMode === "cod"
                        ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                        : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--border-color)]/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold shrink-0">
                          <Banknote size={18} />
                        </div>
                        <div>
                          <span className="font-bold text-sm text-[var(--text-main)] block">
                            Cash on Delivery
                          </span>
                          <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">
                            Pay at Doorstep
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          paymentMode === "cod" ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border-color)]"
                        }`}
                      >
                        {paymentMode === "cod" && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      Pay via cash or UPI scan directly to the delivery rider upon arrival.
                    </p>
                  </div>
                ) : (
                  <div
                    role="radio"
                    aria-checked={paymentMode === "cop"}
                    tabIndex={0}
                    onClick={() => setPaymentMode("cop")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPaymentMode("cop");
                      }
                    }}
                    className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-hidden ${
                      paymentMode === "cop"
                        ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                        : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--border-color)]/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold shrink-0">
                          <Banknote size={18} />
                        </div>
                        <div>
                          <span className="font-bold text-sm text-[var(--text-main)] block">
                            Cash on Pickup (COP)
                          </span>
                          <span className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">
                            Pay at Kitchen Counter
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          paymentMode === "cop" ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border-color)]"
                        }`}
                      >
                        {paymentMode === "cop" && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      Pay directly at the restaurant counter when collecting your hot food.
                    </p>
                  </div>
                )}

                {/* 2. Razorpay Payment Gateway */}
                <div
                  role="radio"
                  aria-checked={paymentMode === "razorpay"}
                  tabIndex={0}
                  onClick={() => setPaymentMode("razorpay")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPaymentMode("razorpay");
                    }
                  }}
                  className={`relative p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden ${
                    paymentMode === "razorpay"
                      ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 ring-1 ring-[var(--brand-accent)]"
                      : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--border-color)]/80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/20 text-[var(--brand-accent)] flex items-center justify-center font-bold shrink-0">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-[var(--text-main)] block">
                          Online Payment
                        </span>
                        <span className="text-[10px] text-[var(--brand-accent)] font-semibold uppercase tracking-wider">
                          UPI / Cards / NetBanking
                        </span>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        paymentMode === "razorpay" ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white" : "border-[var(--border-color)]"
                      }`}
                    >
                      {paymentMode === "razorpay" && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Fast instant checkout tested via standard Razorpay sandbox.
                  </p>
                </div>

                {/* 3. Dev Simulator */}
                <div
                  role="radio"
                  aria-checked={paymentMode === "simulator"}
                  tabIndex={0}
                  onClick={() => setPaymentMode("simulator")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPaymentMode("simulator");
                    }
                  }}
                  className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-hidden ${
                    paymentMode === "simulator"
                      ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40"
                      : "border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-[var(--border-color)]/80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
                        <Zap size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-[var(--text-main)] block">
                          Test Simulator
                        </span>
                        <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                          Instant Placement
                        </span>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        paymentMode === "simulator" ? "border-blue-500 bg-blue-500 text-white" : "border-[var(--border-color)]"
                      }`}
                    >
                      {paymentMode === "simulator" && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Instant mock placement for end-to-end testing of cancellation & live tracking.
                  </p>
                </div>
              </div>

              {/* Helper for Razorpay test info */}
              {paymentMode === "razorpay" && (
                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => setShowTestCards(!showTestCards)}
                    className="text-xs text-[var(--brand-accent)] hover:underline flex items-center gap-1.5 transition font-semibold"
                  >
                    <Info size={14} />
                    {showTestCards ? "Hide Sandbox Instructions" : "View Sandbox Test Credentials"}
                  </button>

                  {showTestCards && (
                    <div className="mt-2.5 p-4 bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl text-xs space-y-1.5 text-[var(--text-muted)]">
                      <p className="font-bold text-[var(--text-main)]">Razorpay Sandbox Testing:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>UPI:</strong> Use <code className="text-[var(--brand-accent)] font-mono">success@razorpay</code>.</li>
                        <li><strong>Card:</strong> Use card <code className="text-[var(--brand-accent)] font-mono">4111 1111 1111 1111</code> with any future expiry date and 123 CVV.</li>
                        <li><strong>OTP:</strong> Enter <code className="text-[var(--brand-accent)] font-mono">123456</code>.</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Operational Warnings / Errors */}
            {hasBlockingIssues && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-2 text-xs">
                <div className="font-bold flex items-center gap-2">
                  <AlertCircle size={17} className="shrink-0 text-amber-500" />
                  <span>Cannot place order due to kitchen operational constraints:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {kitchenValidations.map((v, i) => (
                    <li key={i}>
                      {v.isClosed && (
                        <span>
                          <strong>{v.name}</strong> is currently closed ({v.op.reason}). Please return to cart and remove items.
                        </span>
                      )}
                      {v.isBelowMin && (
                        <span>
                          Minimum order for <strong>{v.name}</strong> is ₹{v.minOrder} (current: ₹{v.subtotal}). Add ₹{v.minOrder - v.subtotal} more.
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-4 text-red-500 text-sm flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 5: Place Order Action Button */}
            <button
              type="submit"
              disabled={loading || hasBlockingIssues}
              className={`w-full font-black py-4 rounded-2xl text-sm transition shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                hasBlockingIssues
                  ? "opacity-50 cursor-not-allowed bg-stone-500 text-white"
                  : loading
                  ? "opacity-75 cursor-not-allowed bg-[var(--brand-accent)] text-white"
                  : paymentMode === "cod" || paymentMode === "cop"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-98"
                  : "bg-[var(--brand-accent)] hover:opacity-95 text-white shadow-[var(--brand-accent)]/20 active:scale-98"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{loadingStep || "Confirming Order..."}</span>
                </>
              ) : hasBlockingIssues ? (
                <span>Resolve Kitchen Issues to Place Order</span>
              ) : (
                <>
                  {paymentMode === "cod" || paymentMode === "cop" ? (
                    <Banknote size={18} />
                  ) : (
                    <Lock size={18} />
                  )}
                  <span>
                    {paymentMode === "cod"
                      ? `Place Order (Cash on Delivery) • ₹${total}`
                      : paymentMode === "cop"
                      ? `Place Order (Cash on Pickup) • ₹${total}`
                      : paymentMode === "razorpay"
                      ? `Pay ₹${total} via Razorpay (Online)`
                      : `Place Order via Test Simulator (₹${total})`}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT: Order Summary Snapshot Card & Offers */}
        <div className="sticky top-28 space-y-5">
          {/* Coupon & Offers Card */}
          <div className="bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-color)] shadow-xl space-y-4">
            <h2 className="text-base font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <Ticket size={18} className="text-[var(--brand-accent)]" />
              Apply Offers & Promo Code
            </h2>

            {appliedOffer ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-emerald-500 uppercase tracking-wider block">
                      {appliedOffer.code || "OFFER"} APPLIED
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Saved ₹{discountAmount} on your feast!
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  aria-label="Remove promo code"
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/15 transition cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500 focus:outline-hidden"
                  title="Remove coupon"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    aria-label="Promo code"
                    placeholder="Enter coupon code"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponError("");
                    }}
                    className="flex-1 bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-main)] font-mono uppercase focus:border-[var(--brand-accent)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon(couponInput)}
                    className="px-4 py-2.5 rounded-xl bg-[var(--brand-accent)] hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-[var(--brand-accent)]/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus:outline-hidden"
                  >
                    Apply
                  </button>
                </div>
                {couponError && (
                  <p className="text-[11px] text-rose-500 font-medium">{couponError}</p>
                )}

                {/* Available Offers Pills */}
                {availableOffers.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                      Active Deals for You
                    </span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {availableOffers.map((off) => {
                        const targetRestId = off.restaurant?._id || off.restaurant;
                        const hasRestMatch =
                          !targetRestId ||
                          Object.values(groupedRestaurants).some(
                            (g) => String(g.restaurant?._id || g.restaurant?.id) === String(targetRestId)
                          );
                        const qualifies = (!off.minOrder || subtotal >= off.minOrder) && hasRestMatch;

                        return (
                          <div
                            key={off._id}
                            onClick={() => handleApplyCoupon(off)}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                              qualifies
                                ? "border-dashed border-[var(--brand-accent)]/50 bg-[var(--brand-accent)]/5 hover:bg-[var(--brand-accent)]/10"
                                : "opacity-60 border-[var(--border-color)] bg-[var(--bg-sub)] hover:border-amber-500/50"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-xs text-[var(--brand-accent)] block">
                                  {off.code || off.title}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)]">
                                  {off.restaurant?.name ? `Kitchen: ${off.restaurant.name}` : "Platform-Wide"}
                                </span>
                              </div>
                              <span className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                                {off.description || (off.discountType === "percentage" ? `${off.discountValue}% OFF` : `₹${off.discountValue} OFF`)}
                              </span>
                              {off.minOrder > 0 && (
                                <span className="text-[10px] text-[var(--text-muted)] block">
                                  Min order: ₹{off.minOrder}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded-md shrink-0 ${
                                qualifies
                                  ? "bg-[var(--brand-accent)] text-white"
                                  : !hasRestMatch
                                  ? "bg-amber-500/20 text-amber-500"
                                  : "bg-stone-500/20 text-[var(--text-muted)]"
                              }`}
                            >
                              {qualifies ? "Apply" : !hasRestMatch ? "Kitchen Only" : `Min ₹${off.minOrder}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order Summary Snapshot Card */}
          <div className="bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-color)] shadow-xl">
            <h2 className="text-base font-extrabold text-[var(--text-main)] mb-4 flex items-center justify-between">
              <span>🧾 Order Summary</span>
              <span className="text-xs font-mono text-[var(--brand-accent)] font-bold bg-[var(--brand-accent)]/10 px-2 py-0.5 rounded-full">
                {items.length} {items.length > 1 ? "items" : "item"}
              </span>
            </h2>

            {/* Items List */}
            <div className="space-y-3 mb-6 max-h-72 overflow-y-auto pr-1">
              {items.map((item) => (
                <CheckoutItemRow key={item._id} item={item} />
              ))}
            </div>

            {/* Price Calculations */}
            <div className="border-t border-[var(--border-color)] pt-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Items Subtotal</span>
                <span className="text-[var(--text-main)] font-semibold">₹{subtotal}</span>
              </div>
              <div className="flex justify-between items-center text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <span>{orderType === "pickup" ? "Self Pickup Charge" : "Delivery Charge"}</span>
                  <HelpTooltip
                    content={
                      orderType === "pickup"
                        ? "Self-pickup at the restaurant counter is always ₹0 free of charge."
                        : isFreeDelivery
                        ? `Free delivery active! Your order value is over ₹${freeThreshold}.`
                        : `Standard doorstep delivery fee. Orders above ₹${freeThreshold} qualify for free delivery.`
                    }
                    title="Delivery Charges"
                    side="right"
                  />
                </span>
                <span className="text-[var(--text-main)] font-semibold">
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-500 font-bold uppercase">FREE</span>
                  ) : (
                    `₹${deliveryFee}`
                  )}
                </span>
              </div>

              {autoDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-500 font-semibold">
                  <span>⚡ Auto Kitchen Discount</span>
                  <span className="font-mono">- ₹{autoDiscountAmount}</span>
                </div>
              )}

              {couponDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-500 font-semibold">
                  <span>🎟️ Promo Coupon ({appliedOffer?.code})</span>
                  <span className="font-mono">- ₹{couponDiscountAmount}</span>
                </div>
              )}

              {orderType === "delivery" && isFreeDelivery && subtotal >= freeThreshold && (
                <p className="text-[11px] text-emerald-500 font-semibold">
                  ✦ Free delivery unlocked (Order &gt; ₹{freeThreshold})
                </p>
              )}

              <div className="flex justify-between items-center font-extrabold text-base text-[var(--text-main)] border-t border-[var(--border-color)] pt-3">
                <span className="flex items-center gap-1">
                  <span>Grand Total</span>
                  <HelpTooltip
                    content="All taxes and charges included. No surprise fees at checkout."
                    title="Total Payable"
                    side="right"
                  />
                </span>
                <span className="text-[var(--brand-accent)] font-mono text-xl">₹{total}</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[var(--border-color)] text-[11px] text-[var(--text-muted)] space-y-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>256-bit encrypted checkout</span>
              </div>
              <p>Historical price snapshot is locked upon placement.</p>
            </div>

            <Link
              href="/cart"
              className="block text-center text-xs text-[var(--text-muted)] hover:text-[var(--brand-accent)] mt-4 transition font-semibold"
            >
              ← Modify Cart Items
            </Link>
          </div>
        </div>
      </div>

      {/* Interactive Delivery Location Map Picker Modal */}
      <DeliveryLocationMapPicker
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onSelectLocation={handleSelectMapLocation}
        initialCoordinates={
          address.latitude && address.longitude
            ? { latitude: address.latitude, longitude: address.longitude }
            : null
        }
      />
    </main>
  );
}