"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import Image from "next/image";

import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
} from "lucide-react";

import useCartStore from "@/lib/cartStore";

import { useSession } from "next-auth/react";

import { useRouter } from "next/navigation";

const CartClient = () => {

  // Zustand Store
  const {
    items,
    increaseQty,
    decreaseQty,
    removeItem,
    getTotalPrice,
  } = useCartStore();

  // Prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false);

  // Auth session
  const { data: session } = useSession();

  // Router
  const router = useRouter();

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent hydration issues
  if (!isMounted) return null;

  // Delivery fee
  const deliveryFee = 40;

  // Price calculations
  const subtotal = getTotalPrice();

  const total = subtotal + deliveryFee;

  // Checkout Handler
  const handleCheckout = () => {

    // If not logged in
    if (!session) {

      router.push(
        "/auth/login?callbackUrl=/checkout"
      );

      return;
    }

    // If logged in
    router.push("/checkout");
  };

  // Empty Cart UI
  if (items.length === 0) {
    return (
      <main
        className="
          min-h-screen
          pt-32
          pb-20
          px-6
          flex
          items-center
          justify-center
        "
      >

        <div className="text-center">

          {/* Icon */}
          <div
            className="
              w-24
              h-24
              mx-auto
              rounded-full
              bg-brand-card
              flex
              items-center
              justify-center
              border border-brand-border
            "
          >

            <ShoppingBag
              size={40}
              className="text-brand-orange"
            />

          </div>

          {/* Heading */}
          <h1 className="text-4xl font-bold mt-8">
            Your Cart is Empty
          </h1>

          {/* Description */}
          <p className="text-brand-muted mt-3 text-lg">
            Looks like you haven’t added anything yet.
          </p>

          {/* Button */}
          <Link
            href="/menu"
            className="
              inline-flex
              items-center
              justify-center
              mt-8
              bg-brand-orange
              text-white
              px-8
              py-4
              rounded-full
              font-semibold
              hover:scale-105
              transition
              duration-300
            "
          >
            Browse Menu
          </Link>

        </div>

      </main>
    );
  }

  return (
    <main
      className="
        min-h-screen
        pt-32
        pb-20
        px-6
        max-w-7xl
        mx-auto
      "
    >

      {/* Heading */}
      <div className="mb-12">

        <h1 className="text-5xl font-bold">
          Your{" "}
          <span className="text-brand-orange">
            Cart
          </span>
        </h1>

        <p className="text-brand-muted mt-3 text-lg">
          {items.length} item(s) in your cart
        </p>

      </div>

      {/* Layout Grid */}
      <div
        className="
          grid
          grid-cols-1
          lg:grid-cols-3
          gap-8
        "
      >

        {/* LEFT SIDE */}
        <div className="lg:col-span-2 space-y-5">

          {items.map((item) => (

            <div
              key={item._id}
              className="
                bg-brand-card
                border border-brand-border
                rounded-3xl
                p-5
                flex
                gap-5
                items-center
              "
            >

              {/* Product Image */}
              <Image
                src={item.image || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500"}
                alt={item.name}
                width={112}
                height={112}
                className="
                  w-28
                  h-28
                  object-cover
                  rounded-2xl
                  border border-white/10
                "
              />

              {/* Content */}
              <div className="flex-1">

                {/* Top Row */}
                <div
                  className="
                    flex
                    items-start
                    justify-between
                    gap-4
                  "
                >

                  {/* Info */}
                  <div>

                    <h2 className="text-2xl font-bold">
                      {item.name}
                    </h2>

                    <p className="text-brand-muted mt-2">
                      ₹{item.price}
                    </p>

                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(item._id)}
                    className="
                      w-10
                      h-10
                      rounded-full
                      bg-red-500/10
                      text-red-400
                      flex
                      items-center
                      justify-center
                      hover:scale-110
                      transition
                    "
                  >

                    <Trash2 size={18} />

                  </button>

                </div>

                {/* Quantity Controls */}
                <div
                  className="
                    flex
                    items-center
                    gap-4
                    mt-6
                  "
                >

                  {/* Minus */}
                  <button
                    onClick={() => decreaseQty(item._id)}
                    className="
                      w-10
                      h-10
                      rounded-full
                      bg-brand-dark
                      border border-brand-border
                      flex
                      items-center
                      justify-center
                      hover:border-brand-orange
                      transition
                    "
                  >

                    <Minus size={16} />

                  </button>

                  {/* Quantity */}
                  <span
                    className="
                      text-xl
                      font-bold
                      min-w-[30px]
                      text-center
                    "
                  >
                    {item.quantity}
                  </span>

                  {/* Plus */}
                  <button
                    onClick={() => increaseQty(item._id)}
                    className="
                      w-10
                      h-10
                      rounded-full
                      bg-brand-orange
                      text-white
                      flex
                      items-center
                      justify-center
                      hover:scale-105
                      transition
                    "
                  >

                    <Plus size={16} />

                  </button>

                </div>

              </div>

            </div>

          ))}

        </div>

        {/* RIGHT SIDE */}
        <div>

          <div
            className="
              bg-brand-card
              border border-brand-border
              rounded-3xl
              p-7
              sticky
              top-28
            "
          >

            {/* Title */}
            <h2 className="text-3xl font-bold mb-8">
              Order Summary
            </h2>

            {/* Subtotal */}
            <div
              className="
                flex
                items-center
                justify-between
                text-lg
                mb-5
              "
            >

              <span className="text-brand-muted">
                Subtotal
              </span>

              <span className="font-semibold">
                ₹{subtotal}
              </span>

            </div>

            {/* Delivery */}
            <div
              className="
                flex
                items-center
                justify-between
                text-lg
                mb-6
              "
            >

              <span className="text-brand-muted">
                Delivery Fee
              </span>

              <span className="font-semibold">
                ₹{deliveryFee}
              </span>

            </div>

            {/* Divider */}
            <div className="border-t border-brand-border my-6" />

            {/* Total */}
            <div
              className="
                flex
                items-center
                justify-between
                text-2xl
                font-bold
              "
            >

              <span>Total</span>

              <span className="text-brand-orange">
                ₹{total}
              </span>

            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              className="
                w-full
                mt-8
                bg-brand-orange
                text-white
                py-4
                rounded-2xl
                font-semibold
                text-lg
                flex
                items-center
                justify-center
                hover:scale-[1.02]
                transition
                duration-300
              "
            >
              Proceed to Checkout →
            </button>

          </div>

        </div>

      </div>

    </main>
  );
};

export default CartClient;