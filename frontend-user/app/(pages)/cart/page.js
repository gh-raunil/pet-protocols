import CartClient from "./CartClient";

export const metadata = {
  title: "Your Cart",
  description: "Review your cart and proceed to checkout.",
};

export default function CartPage() {
  return <CartClient />;
}