"use client";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
import useCartStore from "@/lib/cartStore";

function AuthHandler() {
  const { data: session } = useSession();
  const { clearCartLocal , loadCart } = useCartStore();
  const prevEmailRef = useRef(null);
  const timer = useRef(null);
  const TIMEOUT = 30 * 60 * 1000;

  useEffect(() => {
    if (session?.user?.email) {
      const currentEmail = session.user.email;
      if (prevEmailRef.current !== currentEmail) {
        console.log("NEW LOGIN — loading cart for:", currentEmail);
        setTimeout(() => loadCart(), 500);
        prevEmailRef.current = currentEmail;
      }
    }

    if (!session && prevEmailRef.current) {
      console.log("LOGOUT — clearing cart locally only");
      clearCartLocal(); // ← only clear local, keep DB
      prevEmailRef.current = null;
    }
  }, [session?.user?.email]);

  const resetTimer = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (session) {
        clearCart();
        signOut({ callbackUrl: "/" });
      }
    }, TIMEOUT);
  };

  useEffect(() => {
    if (!session) return;
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [session]);

  return null;
}

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <AuthHandler />
      {children}
    </SessionProvider>
  );
}
