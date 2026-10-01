"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  Home,
  Briefcase,
  Plus,
  Check,
  Banknote,
  Truck,
  ShoppingBag,
} from "lucide-react";

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

  const { items, getTotalPrice, clearCart } = useCartStore();

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState("");
  const [paymentMode, setPaymentMode] = useState("cod"); // "cod" | "razorpay" | "simulator"
  const [showTestCards, setShowTestCards] = useState(false);

  // Address and Saved Addresses states
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [saveAddressToProfile, setSaveAddressToProfile] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("Home");

  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
  });
  const [notes, setNotes] = useState("");

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

  const handleSelectSavedAddress = (saved) => {
    setSelectedAddressId(saved._id);
    setAddress({
      fullName: saved.fullName || session?.user?.name || "",
      phone: saved.phone || session?.user?.phone || "",
      street: saved.street || "",
      city: saved.city || "New Delhi",
      state: saved.state || "Delhi",
      pincode: saved.pincode || "110001",
    });
    setSaveAddressToProfile(false);
  };

  const handleSelectCustomAddress = () => {
    setSelectedAddressId("new");
    setAddress({
      fullName: session?.user?.name || "",
      phone: session?.user?.phone || "",
      street: "",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
    });
    setSaveAddressToProfile(true);
  };

  const handleChange = (e) => {
    setAddress({
      ...address,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const validateDeliveryDetails = () => {
    if (!address.fullName.trim()) {
      setError("Please enter your recipient full name.");
      return false;
    }
    if (!address.phone.trim() || address.phone.trim().length < 8) {
      setError("Please enter a valid 10-digit delivery contact number.");
      return false;
    }
    if (!address.street.trim()) {
      setError("Please provide your delivery street, house, or apartment address.");
      return false;
    }
    if (!address.pincode.trim()) {
      setError("Please provide a valid delivery area pincode.");
      return false;
    }
    return true;
  };

  const saveAddressIfRequested = async () => {
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
          isDefault: savedAddresses.length === 0,
        }),
      });
    } catch (e) {
      console.warn("Could not save address to profile:", e);
    }
  };

  // 1. Razorpay Real / Sandbox Checkout Flow
  const handleRazorpayCheckout = async () => {
    if (!validateDeliveryDetails()) return;

    setLoading(true);
    setLoadingStep("Initializing secure Razorpay payment gateway...");
    setError("");

    try {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          address,
          notes,
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
        name: "Pet Protocols",
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
                address,
                notes,
                totalAmount: total,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setLoadingStep("Order confirmed! Redirecting...");
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
    if (!validateDeliveryDetails()) return;

    setLoading(true);
    setLoadingStep("Placing instant simulation order...");
    setError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          address,
          notes,
          paymentMethod: "Instant Simulator (Test Mode)",
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Failed to place order.");
        setLoading(false);
        return;
      }

      await saveAddressIfRequested();
      await clearCart();
      const targetOrderId = data.order?._id || data.orderId || "";
      router.push(targetOrderId ? `/order-confirmation?orderId=${targetOrderId}` : "/order-confirmation");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred during simulator checkout.");
      setLoading(false);
    }
  };

  // 3. Cash on Delivery (COD) Checkout Flow
  const handleCodCheckout = async () => {
    if (!validateDeliveryDetails()) return;

    setLoading(true);
    setLoadingStep("Confirming Cash on Delivery order...");
    setError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          address,
          notes,
          paymentMethod: "Cash on Delivery (COD)",
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Failed to place COD order.");
        setLoading(false);
        return;
      }

      await saveAddressIfRequested();
      await clearCart();
      const targetOrderId = data.order?._id || data.orderId || "";
      router.push(targetOrderId ? `/order-confirmation?orderId=${targetOrderId}` : "/order-confirmation");
    } catch (err) {
      console.error("COD checkout error:", err);
      setError("An unexpected error occurred while placing Cash on Delivery order.");
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate submissions

    if (paymentMode === "razorpay") {
      handleRazorpayCheckout();
    } else if (paymentMode === "cod") {
      handleCodCheckout();
    } else {
      handleSimulatorCheckout();
    }
  };

  if (!isMounted) return null;

  const subtotal = getTotalPrice();
  const delivery = subtotal > 499 ? 0 : 40;
  const total = subtotal + delivery;

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
    { num: 1, label: "Delivery Mode" },
    { num: 2, label: "Address & Contact" },
    { num: 3, label: "Order Review" },
    { num: 4, label: "Payment Selection" },
    { num: 5, label: "Place Order" },
  ];

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-[var(--text-main)] transition-colors">
      {/* ── 5-STEP CHECKOUT BREADCRUMB PROGRESS BAR ────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--brand-accent)] uppercase tracking-wider mb-2">
          <ShieldCheck size={15} /> Multi-Kitchen Secure Checkout
        </div>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-[var(--text-main)]">
          Checkout & Order Confirmation
        </h1>

        {/* Visual Steps Indicator */}
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
        {/* LEFT: Delivery Address & Payment Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1 & 2: Delivery Address Card */}
            <div className="bg-[var(--bg-card)] rounded-3xl p-6 md:p-8 border border-[var(--border-color)] shadow-xl space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center">
                    <Truck size={17} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[var(--text-main)]">
                      Delivery Address & Contact
                    </h2>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Doorstep delivery dispatched upon preparation
                    </span>
                  </div>
                </div>

                {session?.user && (
                  <Link
                    href="/profile"
                    className="text-xs text-[var(--brand-accent)] hover:underline font-semibold transition"
                  >
                    Manage saved addresses →
                  </Link>
                )}
              </div>

              {/* Saved Addresses Selection */}
              {savedAddresses.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={13} className="text-[var(--brand-accent)]" />
                    Select a Saved Location
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr._id;
                      return (
                        <div
                          key={addr._id}
                          onClick={() => handleSelectSavedAddress(addr)}
                          className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
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
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-[var(--brand-accent)] animate-pulse" />
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
                      onClick={handleSelectCustomAddress}
                      className={`p-3.5 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        selectedAddressId === "new"
                          ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] ring-1 ring-[var(--brand-accent)]"
                          : "border-[var(--border-color)] bg-[var(--bg-sub)] text-[var(--text-muted)] hover:border-[var(--brand-accent)]/40 hover:text-[var(--text-main)]"
                      }`}
                    >
                      <Plus size={16} className="mb-1 text-[var(--brand-accent)]" />
                      <span className="text-xs font-bold">New Address</span>
                      <span className="text-[10px] opacity-75">Deliver to a new place</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                    Recipient Full Name *
                  </label>
                  <input
                    name="fullName"
                    placeholder="e.g. Rahul Roy"
                    value={address.fullName}
                    onChange={handleChange}
                    required
                    className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                    Contact Phone Number *
                  </label>
                  <input
                    name="phone"
                    placeholder="e.g. 9876543210"
                    value={address.phone}
                    onChange={handleChange}
                    required
                    className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] transition shadow-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                    House / Flat / Street / Landmark *
                  </label>
                  <input
                    name="street"
                    placeholder="e.g. Flat 302, Green Valley Apartments"
                    value={address.street}
                    onChange={handleChange}
                    required
                    className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                    City *
                  </label>
                  <input
                    name="city"
                    placeholder="New Delhi"
                    value={address.city}
                    onChange={handleChange}
                    required
                    className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                    Pincode *
                  </label>
                  <input
                    name="pincode"
                    placeholder="110001"
                    value={address.pincode}
                    onChange={handleChange}
                    required
                    className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] transition shadow-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[var(--text-muted)] text-xs font-semibold uppercase mb-1 block">
                    Kitchen / Delivery Special Instructions
                  </label>
                  <input
                    placeholder="e.g. Ring bell, leave at reception, extra napkins"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[var(--bg-sub)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] text-sm focus:border-[var(--brand-accent)] transition shadow-sm"
                  />
                </div>

                {/* Save address option */}
                {selectedAddressId === "new" && (
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

            {/* Step 4: Payment Method Selection */}
            <div className="bg-[var(--bg-card)] rounded-3xl p-6 md:p-8 border border-[var(--border-color)] shadow-xl space-y-4">
              <h2 className="text-base font-extrabold text-[var(--text-main)] flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
                <CreditCard size={18} className="text-[var(--brand-accent)]" />
                Select Payment Method
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. Cash on Delivery (COD) */}
                <div
                  onClick={() => setPaymentMode("cod")}
                  className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all ${
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

                {/* 2. Razorpay Payment Gateway */}
                <div
                  onClick={() => setPaymentMode("razorpay")}
                  className={`relative p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all ${
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
                          Razorpay Gateway
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
                    Instant online checkout tested via standard Razorpay sandbox.
                  </p>
                </div>

                {/* 3. Dev Simulator */}
                <div
                  onClick={() => setPaymentMode("simulator")}
                  className={`p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all ${
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
                          Dev Simulator
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
                    Quick mock order placement for testing order management and status tracker.
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

            {error && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-4 text-red-500 text-sm flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 5: Place Order Action Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full font-black py-4 rounded-2xl text-sm transition shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                loading
                  ? "opacity-75 cursor-not-allowed bg-[var(--brand-accent)] text-white"
                  : paymentMode === "cod"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-98"
                  : "bg-[var(--brand-accent)] hover:opacity-95 text-white shadow-[var(--brand-accent)]/20 active:scale-98"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{loadingStep || "Confirming Order..."}</span>
                </>
              ) : (
                <>
                  {paymentMode === "cod" ? <Banknote size={18} /> : <Lock size={18} />}
                  <span>
                    {paymentMode === "cod"
                      ? `Place Order (Cash on Delivery) • ₹${total}`
                      : paymentMode === "razorpay"
                      ? `Pay ₹${total} via Razorpay (Sandbox)`
                      : `Place Order via Dev Simulator (₹${total})`}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT: Order Summary Snapshot Card */}
        <div className="sticky top-28 space-y-4">
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
                <div
                  key={item._id}
                  className="flex items-center gap-3 bg-[var(--bg-sub)] p-2.5 rounded-2xl border border-[var(--border-color)]"
                >
                  <Image
                    src={item.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200"}
                    alt={item.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[var(--text-main)] truncate">{item.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Qty: {item.quantity} × ₹{item.price}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-[var(--brand-accent)] shrink-0">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="border-t border-[var(--border-color)] pt-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Items Subtotal</span>
                <span className="text-[var(--text-main)] font-semibold">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Delivery Charge</span>
                <span className="text-[var(--text-main)] font-semibold">
                  {delivery === 0 ? <span className="text-emerald-500 font-bold">FREE</span> : `₹${delivery}`}
                </span>
              </div>
              {subtotal > 499 && (
                <p className="text-[11px] text-emerald-500 font-semibold">
                  ✦ Free delivery unlocked (Order &gt; ₹499)
                </p>
              )}
              <div className="flex justify-between font-extrabold text-base text-[var(--text-main)] border-t border-[var(--border-color)] pt-3">
                <span>Grand Total</span>
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
    </main>
  );
}