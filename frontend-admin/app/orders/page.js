import { Suspense } from "react";
import OrdersClient from "./OrdersClient";

export const metadata = {
  title: "Order Command Center — पेट Protocols",
  description: "Track and fulfill incoming restaurant orders in real-time.",
};

export default function RestaurantOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-stone-500 font-mono">
          Loading Order Command Center...
        </div>
      }
    >
      <OrdersClient />
    </Suspense>
  );
}

