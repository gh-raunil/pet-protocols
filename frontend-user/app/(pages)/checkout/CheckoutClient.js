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
  Sparkles,
  Zap,
  Info,
  Lock,
  MapPin,
  Home,
  Briefcase,
  Plus,
  Check,
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
  const [paymentMode, setPaymentMode] = useState("razorpay"); // "razorpay" | "simulator"
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
    // Preload script
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

  // Redirect if not logged in
  useEffect(() => {
    if (isMounted && !session) {
      router.push("/auth/login?callbackUrl=/checkout");
    }
  }, [isMounted, session, router]);

  // Redirect if cart empty
  useEffect(() => {
    if (isMounted && items.length === 0) {
      router.push("/menu");
    }
  }, [isMounted, items, router]);

  const handleSelectSavedAddress = (addr) => {
    setSelectedAddressId(addr._id);
    setAddress({
      fullName: addr.fullName,
      phone: addr.phone,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
    });
    setSaveAddressToProfile(false);
    setError("");
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
    setError("");
  };

  const handleChange = (e) => {
    setAddress({
      ...address,
      [e.target.name]: e.target.value,
    });
    if (selectedAddressId !== "new") {
      setSelectedAddressId("new");
      setSaveAddressToProfile(true);
    }
    setError("");
  };

  const validateDeliveryDetails = () => {
    const { fullName, phone, street, city, state, pincode } = address;
    if (!fullName || !phone || !street || !city || !state || !pincode) {
      setError("Please fill in all delivery details.");
      return false;
    }

    if (phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return false;
    }
    return true;
  };

  // Helper to persist address into user profile if requested
  const saveAddressIfRequested = async () => {
    if (saveAddressToProfile && address.street?.trim() && address.pincode?.trim()) {
      try {
        await fetch("/api/user/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...address,
            label: newAddressLabel || "Home",
            isDefault: savedAddresses.length === 0,
          }),
        });
      } catch (err) {
        console.warn("Could not save address to profile:", err);
      }
    }
  };

  // 1. Full Razorpay Standard Gateway Checkout Flow
  const handleRazorpayCheckout = async () => {
    if (!validateDeliveryDetails()) return;

    setLoading(true);
    setLoadingStep("Connecting to Razorpay gateway...");
    setError("");

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Unable to initialize Razorpay SDK. Please check your internet connection.");
        setLoading(false);
        return;
      }

      const subtotal = getTotalPrice();
      const delivery = subtotal > 499 ? 0 : 40;
      const total = subtotal + delivery;

      // Create Order on Backend
      setLoadingStep("Creating secure payment order...");
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total }),
      });

      const orderData = await orderRes.json();
      if (!orderData.success || !orderData.order) {
        setError(orderData.message || "Failed to create Razorpay payment order.");
        setLoading(false);
        return;
      }

      setLoadingStep("Launching payment window...");

      // Configure Razorpay Standard Modal options
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
        description: `Pet Gourmet Order (${items.length} items)`,
        order_id: orderData.order.id,
        prefill: {
          name: address.fullName,
          contact: address.phone,
          email: session?.user?.email || "customer@petprotocols.com",
        },
        theme: {
          color: "#f97316", // Brand orange accent
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
      console.error("Checkout error:", err);
      setError("An unexpected error occurred while launching Razorpay.");
      setLoading(false);
    }
  };

  // 2. Direct Mock Simulator Fallback
  const handleSimulatorCheckout = async () => {
    if (!validateDeliveryDetails()) return;

    setLoading(true);
    setLoadingStep("Simulating instant payment & dispatching order...");
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (paymentMode === "razorpay") {
      handleRazorpayCheckout();
    } else {
      handleSimulatorCheckout();
    }
  };

  if (!isMounted) return null;

  const subtotal = getTotalPrice();
  const delivery = subtotal > 499 ? 0 : 40;
  const total = subtotal + delivery;

  return (
    <main className="min-h-screen pt-28 pb-20 px-6 max-w-7xl mx-auto text-white">
      {/* Header */}
      <div className="mb-8">
        <span className="text-orange-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
          <ShieldCheck size={14} /> Multi-Kitchen Secure Checkout
        </span>
        <h1 className="text-4xl font-extrabold mt-1">
          Check<span className="text-orange-500">out</span>
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Complete your order using Razorpay Payment Gateway (Test Mode) with instant multi-method support.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Delivery Address Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-[#0d0d0d] rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  🏠 Delivery Address & Contact
                </h2>
                {session?.user && (
                  <Link
                    href="/profile"
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium transition flex items-center gap-1"
                  >
                    Manage saved addresses →
                  </Link>
                )}
              </div>

              {/* Saved Addresses Selector Cards */}
              {savedAddresses.length > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={14} className="text-orange-400" />
                      Select a Saved Location
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {savedAddresses.length} saved address{savedAddresses.length > 1 ? "es" : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {savedAddresses.map((addr) => {
                      const isSelected = selectedAddressId === addr._id;
                      return (
                        <div
                          key={addr._id}
                          onClick={() => handleSelectSavedAddress(addr)}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10 ring-1 ring-orange-500"
                              : "border-white/10 bg-[#141414] hover:border-white/25"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              {addr.label === "Home" ? (
                                <Home size={13} className="text-orange-400" />
                              ) : addr.label === "Work" ? (
                                <Briefcase size={13} className="text-blue-400" />
                              ) : (
                                <MapPin size={13} className="text-green-400" />
                              )}
                              {addr.label || "Home"}
                            </span>
                            <div className="flex items-center gap-1">
                              {addr.isDefault && (
                                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-medium">
                                  Default
                                </span>
                              )}
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-semibold text-gray-200 truncate">
                            {addr.fullName}
                          </p>
                          <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                            {addr.street}, {addr.city} - {addr.pincode}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-1 font-mono">
                            📞 {addr.phone}
                          </p>
                        </div>
                      );
                    })}

                    {/* New Address option */}
                    <div
                      onClick={handleSelectCustomAddress}
                      className={`p-3.5 rounded-xl border border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        selectedAddressId === "new"
                          ? "border-orange-500 bg-orange-500/10 text-orange-400 ring-1 ring-orange-500"
                          : "border-white/20 bg-[#141414]/60 hover:border-white/40 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Plus size={16} className="mb-1 text-orange-400" />
                      <span className="text-xs font-bold">New Address</span>
                      <span className="text-[10px] text-gray-500">Deliver to a different place</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase mb-1 block">
                    Full Name *
                  </label>
                  <input
                    name="fullName"
                    placeholder="e.g. Rahul Roy"
                    value={address.fullName}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase mb-1 block">
                    Phone Number *
                  </label>
                  <input
                    name="phone"
                    placeholder="e.g. 9876543210"
                    value={address.phone}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-gray-400 text-xs font-semibold uppercase mb-1 block">
                    Street Address / Flat / Landmark *
                  </label>
                  <input
                    name="street"
                    placeholder="e.g. Flat 402, Sunshine Residency, Green Park"
                    value={address.street}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase mb-1 block">
                    City *
                  </label>
                  <input
                    name="city"
                    placeholder="New Delhi"
                    value={address.city}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase mb-1 block">
                    State *
                  </label>
                  <input
                    name="state"
                    placeholder="Delhi"
                    value={address.state}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase mb-1 block">
                    Pincode *
                  </label>
                  <input
                    name="pincode"
                    placeholder="110016"
                    value={address.pincode}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500 transition"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase mb-1 block">
                    Special Cooking / Delivery Notes
                  </label>
                  <input
                    placeholder="e.g. Extra napkins, less spicy"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-orange-500 transition"
                  />
                </div>

                {/* Save Address to Profile Option */}
                {selectedAddressId === "new" && (
                  <div className="md:col-span-2 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white transition">
                      <input
                        type="checkbox"
                        checked={saveAddressToProfile}
                        onChange={(e) => setSaveAddressToProfile(e.target.checked)}
                        className="rounded border-white/20 bg-[#141414] text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Save this address to my profile for future orders</span>
                    </label>

                    {saveAddressToProfile && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">Save as:</span>
                        {["Home", "Work", "Other"].map((lbl) => (
                          <button
                            type="button"
                            key={lbl}
                            onClick={() => setNewAddressLabel(lbl)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition font-medium cursor-pointer ${
                              newAddressLabel === lbl
                                ? "border-orange-500 bg-orange-500/20 text-orange-400"
                                : "border-white/10 bg-[#141414] text-gray-400 hover:border-white/20"
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

            {/* PAYMENT METHOD SELECTOR */}
            <div className="bg-[#0d0d0d] rounded-2xl p-6 md:p-8 border border-white/10 shadow-xl space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                💳 Choose Payment Option
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Razorpay Payment Gateway */}
                <div
                  onClick={() => setPaymentMode("razorpay")}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    paymentMode === "razorpay"
                      ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10"
                      : "border-white/10 bg-[#141414] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-white block">
                          Razorpay Gateway
                        </span>
                        <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">
                          Test Mode Active
                        </span>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        paymentMode === "razorpay"
                          ? "border-orange-500 bg-orange-500 text-white"
                          : "border-white/30"
                      }`}
                    >
                      {paymentMode === "razorpay" && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    UPI, Credit/Debit Cards, NetBanking, and Wallets simulated via Razorpay test interface.
                  </p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-gray-300">
                    <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded">UPI</span>
                    <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded">Visa / MC</span>
                    <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded">NetBanking</span>
                  </div>
                </div>

                {/* Option 2: Instant Simulator */}
                <div
                  onClick={() => setPaymentMode("simulator")}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    paymentMode === "simulator"
                      ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10"
                      : "border-white/10 bg-[#141414] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                        <Zap size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-white block">
                          Instant Simulator
                        </span>
                        <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                          Bypass Modal
                        </span>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        paymentMode === "simulator"
                          ? "border-orange-500 bg-orange-500 text-white"
                          : "border-white/30"
                      }`}
                    >
                      {paymentMode === "simulator" && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    One-click order placement simulator without triggering the external payment popup.
                  </p>
                </div>
              </div>

              {/* Helper Toggle for Razorpay Test Info */}
              {paymentMode === "razorpay" && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowTestCards(!showTestCards)}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1.5 transition font-semibold"
                  >
                    <Info size={14} />
                    {showTestCards ? "Hide Razorpay Test Credentials" : "View Razorpay Test Mode Credentials"}
                  </button>

                  {showTestCards && (
                    <div className="mt-3 p-4 bg-[#141414] border border-white/10 rounded-xl text-xs space-y-2 text-gray-300 animate-in fade-in">
                      <p className="font-bold text-white text-xs">🧪 Razorpay Test Payment Instructions:</p>
                      <ul className="list-disc pl-5 space-y-1 text-gray-400">
                        <li>
                          <strong className="text-white">UPI:</strong> Enter <code className="text-orange-400 bg-white/5 px-1 py-0.5 rounded font-mono">success@razorpay</code> and click approve.
                        </li>
                        <li>
                          <strong className="text-white">Card:</strong> Any card number like <code className="text-orange-400 bg-white/5 px-1 py-0.5 rounded font-mono">4111 1111 1111 1111</code>, any future expiry date, and any 3-digit CVV.
                        </li>
                        <li>
                          <strong className="text-white">OTP:</strong> Enter <code className="text-orange-400 bg-white/5 px-1 py-0.5 rounded font-mono">123456</code> in the mock bank verification.
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{loadingStep || "Processing..."}</span>
                </>
              ) : (
                <>
                  <Lock size={18} />
                  <span>
                    {paymentMode === "razorpay"
                      ? `Pay ₹${total} with Razorpay`
                      : `Place Order via Simulator (₹${total})`}
                  </span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT: Order Summary & Snapshot Review */}
        <div className="sticky top-24">
          <div className="bg-[#0d0d0d] rounded-2xl p-6 border border-white/10 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-5 flex items-center justify-between">
              <span>🧾 Order Summary</span>
              <span className="text-xs font-mono text-orange-400 font-semibold bg-orange-500/10 px-2 py-0.5 rounded">
                {items.length} item{items.length > 1 ? "s" : ""}
              </span>
            </h2>

            {/* Items */}
            <div className="space-y-3 mb-6 max-h-72 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center gap-3 bg-[#141414] p-2.5 rounded-xl border border-white/5"
                >
                  <Image
                    src={item.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200"}
                    alt={item.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                    <p className="text-[11px] text-gray-400">
                      Qty: {item.quantity} × ₹{item.price}
                    </p>
                  </div>
                  <span className="text-sm font-mono font-bold text-orange-400 shrink-0">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="border-t border-white/10 pt-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Items Subtotal</span>
                <span className="text-white font-semibold">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Delivery Charge</span>
                <span className="text-white font-semibold">
                  {delivery === 0 ? <span className="text-green-400 font-bold">FREE</span> : `₹${delivery}`}
                </span>
              </div>
              {subtotal > 499 && (
                <p className="text-[11px] text-green-400 font-semibold">
                  ✦ Free delivery unlocked (Order &gt; ₹499)
                </p>
              )}
              <div className="flex justify-between font-extrabold text-base text-white border-t border-white/10 pt-3">
                <span>Grand Total</span>
                <span className="text-orange-400 font-mono text-xl">₹{total}</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-gray-500 space-y-1">
              <div className="flex items-center gap-1.5 text-gray-400">
                <ShieldCheck size={14} className="text-green-400" />
                <span>256-bit encrypted checkout</span>
              </div>
              <p>Historical price snapshot is locked upon placement.</p>
            </div>

            <Link
              href="/cart"
              className="block text-center text-xs text-gray-400 hover:text-white mt-4 transition"
            >
              ← Modify Cart Items
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}