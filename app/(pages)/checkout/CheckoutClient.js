"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useCartStore from "@/lib/cartStore";
import Script from "next/script";
import Link from "next/link";

export default function CheckoutClient() {
  const { data: session } = useSession();

  const router = useRouter();

  const {
    items,
    getTotalPrice,
    clearCart,
  } = useCartStore();

  const [isMounted, setIsMounted] = useState(false);

  const [loading, setLoading] = useState(false);

  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const handleChange = (e) => {
    setAddress({
      ...address,
      [e.target.name]: e.target.value,
    });
  };

  const handlePayment = async () => {

    const {
      fullName,
      phone,
      street,
      city,
      state,
      pincode,
    } = address;

    if (
      !fullName ||
      !phone ||
      !street ||
      !city ||
      !state ||
      !pincode
    ) {
      alert("Please fill all delivery details");
      return;
    }

    if (phone.length !== 10) {
      alert("Please enter a valid 10-digit phone number");
      return;
    }

    try {

      setLoading(true);

      // Create Razorpay order
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: getTotalPrice() + 40,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert("Failed to create order. Try again.");
        setLoading(false);
        return;
      }

      // Razorpay popup
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: data.order.amount,
        currency: "INR",
        name: "Pet Protocols",
        description: "Fresh Food Order",
        order_id: data.order.id,

        handler: async function (response) {

          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              items,
              address,
              totalAmount: getTotalPrice() + 40,
              userId: session?.user?.id,
              userEmail: session?.user?.email,
            }),
          });

          const verifyData = await verifyRes.json();

          console.log("Verify response:", verifyData);

          if (verifyData.success) {

            await clearCart();

            console.log("Redirecting to order-confirmation...");

            window.location.href = "/order-confirmation";

          } else {

            alert("Payment verification failed. Contact support.");

          }
        },

        prefill: {
          name: session?.user?.name || "",
          email: session?.user?.email || "",
          contact: address.phone,
        },

        theme: {
          color: "#f97316",
        },

        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const razor = new window.Razorpay(options);

      razor.open();

    } catch (error) {

      console.error(error);

      alert("Something went wrong. Please try again.");

      setLoading(false);
    }
  };

  if (!isMounted) return null;

  const subtotal = getTotalPrice();

  const delivery = 40;

  const total = subtotal + delivery;

  return (
    <>
      {/* Razorpay Script */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <main className="min-h-screen pt-24 pb-12 px-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">

          <h1 className="text-4xl font-bold">
            Check<span className="text-brand-orange">out</span>
          </h1>

          <p className="text-brand-muted mt-1">
            Complete your order below
          </p>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-4">

            <div className="
              bg-brand-card
              rounded-2xl
              p-6
              border border-brand-border
            ">

              <h2 className="text-xl font-bold mb-6">
                🏠 Delivery Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Full Name */}
                <div>

                  <label className="text-brand-muted text-sm mb-1 block">
                    Full Name
                  </label>

                  <input
                    name="fullName"
                    placeholder="Rounak Kumar"
                    value={address.fullName}
                    onChange={handleChange}
                    className="
                      w-full
                      bg-brand-dark
                      border border-brand-border
                      rounded-xl
                      px-4 py-3
                      text-white
                      placeholder-brand-muted
                      outline-none
                      focus:border-brand-orange
                      transition
                    "
                  />

                </div>

                {/* Phone */}
                <div>

                  <label className="text-brand-muted text-sm mb-1 block">
                    Phone Number
                  </label>

                  <input
                    name="phone"
                    placeholder="10-digit number"
                    value={address.phone}
                    onChange={handleChange}
                    maxLength={10}
                    className="
                      w-full
                      bg-brand-dark
                      border border-brand-border
                      rounded-xl
                      px-4 py-3
                      text-white
                      placeholder-brand-muted
                      outline-none
                      focus:border-brand-orange
                      transition
                    "
                  />

                </div>

                {/* Street */}
                <div className="md:col-span-2">

                  <label className="text-brand-muted text-sm mb-1 block">
                    Street Address
                  </label>

                  <input
                    name="street"
                    placeholder="House no, Street, Area"
                    value={address.street}
                    onChange={handleChange}
                    className="
                      w-full
                      bg-brand-dark
                      border border-brand-border
                      rounded-xl
                      px-4 py-3
                      text-white
                      placeholder-brand-muted
                      outline-none
                      focus:border-brand-orange
                      transition
                    "
                  />

                </div>

                {/* City */}
                <div>

                  <label className="text-brand-muted text-sm mb-1 block">
                    City
                  </label>

                  <input
                    name="city"
                    placeholder="Koderma"
                    value={address.city}
                    onChange={handleChange}
                    className="
                      w-full
                      bg-brand-dark
                      border border-brand-border
                      rounded-xl
                      px-4 py-3
                      text-white
                      placeholder-brand-muted
                      outline-none
                      focus:border-brand-orange
                      transition
                    "
                  />

                </div>

                {/* State */}
                <div>

                  <label className="text-brand-muted text-sm mb-1 block">
                    State
                  </label>

                  <input
                    name="state"
                    placeholder="Jharkhand"
                    value={address.state}
                    onChange={handleChange}
                    className="
                      w-full
                      bg-brand-dark
                      border border-brand-border
                      rounded-xl
                      px-4 py-3
                      text-white
                      placeholder-brand-muted
                      outline-none
                      focus:border-brand-orange
                      transition
                    "
                  />

                </div>

                {/* Pincode */}
                <div>

                  <label className="text-brand-muted text-sm mb-1 block">
                    Pincode
                  </label>

                  <input
                    name="pincode"
                    placeholder="825409"
                    value={address.pincode}
                    onChange={handleChange}
                    maxLength={6}
                    className="
                      w-full
                      bg-brand-dark
                      border border-brand-border
                      rounded-xl
                      px-4 py-3
                      text-white
                      placeholder-brand-muted
                      outline-none
                      focus:border-brand-orange
                      transition
                    "
                  />

                </div>

              </div>

            </div>

          </div>

          {/* RIGHT */}
          <div className="sticky top-24">

            <div className="
              bg-brand-card
              rounded-2xl
              p-6
              border border-brand-border
            ">

              <h2 className="text-xl font-bold mb-6">
                🧾 Order Summary
              </h2>

              {/* Items */}
              <div className="
                space-y-3
                mb-6
                max-h-60
                pr-3
                overflow-y-auto
              ">

                {items.map((item) => (

                  <div
                    key={item._id}
                    className="flex items-center gap-3"
                  >

                    <img
                      src={item.image}
                      alt={item.name}
                      className="
                        w-12
                        h-12
                        rounded-lg
                        object-cover
                      "
                    />

                    <div className="flex-1">

                      <p className="
                        text-sm
                        font-medium
                        text-white
                        line-clamp-1
                      ">
                        {item.name}
                      </p>

                      <p className="text-xs text-brand-muted">
                        x{item.quantity}
                      </p>

                    </div>

                    <span className="
                      text-sm
                      text-brand-orange
                      font-semibold
                    ">
                      ₹{item.price * item.quantity}
                    </span>

                  </div>

                ))}

              </div>

              {/* Price */}
              <div className="
                border-t border-brand-border
                pt-4
                space-y-3
              ">

                <div className="
                  flex justify-between
                  text-brand-muted
                  text-sm
                ">
                  <span>Subtotal</span>
                  <span className="text-white">
                    ₹{subtotal}
                  </span>
                </div>

                <div className="
                  flex justify-between
                  text-brand-muted
                  text-sm
                ">
                  <span>Delivery Fee</span>
                  <span className="text-white">
                    ₹{delivery}
                  </span>
                </div>

                <div className="
                  flex justify-between
                  font-bold
                  text-lg
                  border-t border-brand-border
                  pt-3
                ">

                  <span>Total</span>

                  <span className="text-brand-orange">
                    ₹{total}
                  </span>

                </div>

              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayment}
                disabled={loading}
                className={`
                  w-full
                  mt-6
                  py-4
                  rounded-full
                  font-bold
                  text-lg
                  transition

                  ${
                    loading
                      ? "bg-brand-border text-brand-muted cursor-not-allowed"
                      : "bg-brand-orange text-white hover:opacity-90"
                  }
                `}
              >
                {loading
                  ? "Processing..."
                  : `Pay ₹${total}`
                }
              </button>

              {/* Back */}
              <Link
                href="/cart"
                className="
                  block
                  text-center
                  text-brand-muted
                  text-sm
                  mt-4
                  hover:text-white
                  transition
                "
              >
                ← Back to Cart
              </Link>

            </div>

          </div>

        </div>

      </main>
    </>
  );
}