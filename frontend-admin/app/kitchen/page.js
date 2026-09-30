import KitchenClient from "./KitchenClient";

export const metadata = {
  title: "Kitchen Display System (KDS) — Pet Protocols Kitchen",
  description: "Live kitchen tickets, preparation times, and cooking queue.",
};

export default function KitchenPage() {
  return <KitchenClient />;
}
