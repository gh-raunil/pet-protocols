import RestaurantLoginPage from "../page";

export const metadata = {
  title: "Staff Login — पेट Protocols Kitchen",
  description: "Official staff station login for पेट Protocols restaurant staff.",
};

export default function StaffLoginPage() {
  return <RestaurantLoginPage initialRole="staff" />;
}
