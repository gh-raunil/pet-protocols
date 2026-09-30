import RestaurantLoginPage from "../page";

export const metadata = {
  title: "Staff Login — Pet Protocols Kitchen",
  description: "Official staff station login for Pet Protocols restaurant staff.",
};

export default function StaffLoginPage() {
  return <RestaurantLoginPage initialRole="staff" />;
}
