"use client";

import RestaurantAdminNav from "./RestaurantAdminNav";

export default function AppShell({ children }) {
  // Pure Restaurant Admin Shell (Plus Jakarta Sans typography, kitchen navigation & Superadmin broadcast ticker)
  return (
    <div className="min-h-screen flex flex-col font-jakarta">
      <RestaurantAdminNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
