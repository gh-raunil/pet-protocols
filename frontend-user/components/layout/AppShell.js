"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import CartDrawer from "../cart/CartDrawer";
import NotificationDrawer from "../notifications/NotificationDrawer";
import LocationModal from "../location/LocationModal";
import ServiceWorkerRegister from "../pwa/ServiceWorkerRegister";
import PWAInstallBanner from "../pwa/PWAInstallBanner";
import CustomerBottomNavigation from "./CustomerBottomNavigation";

export default function AppShell({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/auth/login" || pathname === "/login";

  // Pure Customer / User Shell (Plus Jakarta Sans typography, customer navbar with live search, cart drawer, footer, PWA service worker & install prompt, mobile bottom navigation)
  return (
    <div className="min-h-screen flex flex-col font-jakarta w-full max-w-full overflow-x-hidden">
      <ServiceWorkerRegister />
      <Navbar />
      <CartDrawer />
      <NotificationDrawer />
      <LocationModal />
      <div className="flex-1 w-full max-w-full min-w-0 overflow-x-hidden pb-16 md:pb-0">{children}</div>
      <CustomerBottomNavigation />
      <PWAInstallBanner />
      {!isLoginPage && <Footer />}
    </div>
  );
}
