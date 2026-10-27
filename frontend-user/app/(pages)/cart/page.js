import { Suspense } from "react";
import CartClient from "./CartClient";

export const metadata = {
  title: "Your Cart",
  description: "Review your cart and proceed to checkout.",
};

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-32 pb-24 text-center text-sm text-[var(--text-muted)] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[var(--brand-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CartClient />
    </Suspense>
  );
}