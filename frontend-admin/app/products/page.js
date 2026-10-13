import ProductsClient from "./ProductsClient";

export const metadata = {
  title: "Manage Restaurant Products — पेट Protocols",
  description: "Add, edit, price, and toggle availability of your restaurant dishes.",
};

export default function RestaurantProductsPage() {
  return <ProductsClient />;
}
