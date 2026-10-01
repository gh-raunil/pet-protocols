"use client";

import Navbar from "./Navbar";
import Footer from "./Footer";
import CartDrawer from "../cart/CartDrawer";
import NotificationDrawer from "../notifications/NotificationDrawer";
import ServiceWorkerRegister from "../pwa/ServiceWorkerRegister";
import PWAInstallBanner from "../pwa/PWAInstallBanner";

export default function AppShell({ children }) {
  // Pure Customer / User Shell (Plus Jakarta Sans typography, customer navbar with live search, cart drawer, footer, PWA service worker & install prompt)
  return (
    <div className="min-h-screen flex flex-col font-jakarta">
      <ServiceWorkerRegister />
      <Navbar />
      <CartDrawer />
      <NotificationDrawer />
      <div className="flex-1">{children}</div>
      <PWAInstallBanner />
      <Footer />
    </div>
  );
}
