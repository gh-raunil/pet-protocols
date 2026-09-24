import DashboardClient from "./DashboardClient";

export const metadata = {
  title: "Restaurant Dashboard — Pet Protocols",
  description: "Manage restaurant products, live orders, and metrics.",
};

export default function RestaurantDashboardPage() {
  return <DashboardClient />;
}
