"use client";

import Navbar from "./Navbar";
import Footer from "./Footer";
import CartDrawer from "../cart/CartDrawer";
import NotificationDrawer from "../notifications/NotificationDrawer";

export default function AppShell({ children }) {
  // Pure Customer / User Shell (Plus Jakarta Sans typography, customer navbar with live search, cart drawer & footer)
  return (
    <div className="min-h-screen flex flex-col font-jakarta">
      <Navbar />
      <CartDrawer />
      <NotificationDrawer />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
