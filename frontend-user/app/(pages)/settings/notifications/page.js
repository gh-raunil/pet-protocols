import NotificationSettingsClient from "./NotificationSettingsClient";

export const metadata = {
  title: "Notification Preferences — Settings | पेट Protocols",
  description: "Configure your live lock-screen push notifications, order event milestones, and active registered devices.",
};

export default function NotificationSettingsPage() {
  return <NotificationSettingsClient />;
}
