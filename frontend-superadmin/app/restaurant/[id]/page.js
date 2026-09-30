import RestaurantDetailsClient from "./RestaurantDetailsClient";

export const metadata = {
  title: "Restaurant Branch Management — Super Admin",
  description: "Manage restaurant feature access flags, branch admins, and storefront settings.",
};

export default function RestaurantDetailsPage() {
  return <RestaurantDetailsClient />;
}
