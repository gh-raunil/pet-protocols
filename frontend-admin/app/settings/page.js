import { Suspense } from "react";
import SettingsClient from "./SettingsClient";

export const metadata = {
  title: "Restaurant Settings — Pet Protocols",
  description: "Configure restaurant details and operating information.",
};

export default function RestaurantSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-zinc-400">
          Loading Settings Center...
        </div>
      }
    >
      <SettingsClient />
    </Suspense>
  );
}
