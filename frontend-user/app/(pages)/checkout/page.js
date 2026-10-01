import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";

export const metadata = {
  title: "Checkout",
  description: "Complete your order and pay securely.",
};

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-32 pb-24 text-center text-sm text-[var(--text-muted)] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[var(--brand-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CheckoutClient />
    </Suspense>
  );
}