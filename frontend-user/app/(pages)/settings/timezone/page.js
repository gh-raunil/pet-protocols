import TimezoneSettingsClient from "./TimezoneSettingsClient";

export const metadata = {
  title: "Time Zone & Clock — Settings | पेट Protocols",
  description: "Select your operational time zone and synchronize kitchen delivery timestamps.",
};

export default function TimezoneSettingsPage() {
  return <TimezoneSettingsClient />;
}
