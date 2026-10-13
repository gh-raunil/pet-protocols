import RestaurantAdminProfileClient from "./ProfileClient";

export const metadata = {
  title: "Kitchen Manager Profile — पेट Protocols Partner Hub",
  description: "Branch manager identity, shift roster, POS hardware status, and operational controls.",
};

export default function RestaurantProfilePage() {
  return <RestaurantAdminProfileClient />;
}
