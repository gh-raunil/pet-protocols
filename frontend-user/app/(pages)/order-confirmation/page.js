import { Suspense } from "react";
import OrderConfirmationClient from "./OrderConfirmationClient";
import { RefreshCw } from "lucide-react";

export const metadata = {
  title: "Order Confirmed — Pet Protocols",
  description: "Track your food order progress live from our partner kitchen.",
};

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-black text-orange-500">
          <RefreshCw className="animate-spin w-8 h-8" />
          <p className="text-xs text-white/50 font-semibold">Loading your order confirmation...</p>
        </div>
      }
    >
      <OrderConfirmationClient />
    </Suspense>
  );
}