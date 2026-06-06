import AdminClient from "./AdminClient";

export const metadata = {
  title: "Admin Dashboard",
  description: "Manage products, orders and users.",
};

export default function AdminPage() {
  return <AdminClient />;
}