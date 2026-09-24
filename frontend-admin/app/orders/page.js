import OrdersClient from "./OrdersClient";

export const metadata = {
  title: "Live Restaurant Orders — Pet Protocols",
  description: "Track and fulfill incoming restaurant orders in real-time.",
};

export default function RestaurantOrdersPage() {
  return <OrdersClient />;
}
