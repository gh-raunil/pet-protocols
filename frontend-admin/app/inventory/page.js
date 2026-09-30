import InventoryClient from "./InventoryClient";

export const metadata = {
  title: "Inventory & Stock Control — Pet Protocols Kitchen",
  description: "Manage menu items availability, 86'd sold out dishes, and stock status.",
};

export default function InventoryPage() {
  return <InventoryClient />;
}
