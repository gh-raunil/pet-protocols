"use client";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";

function AuthHandler() {
  const { data: session, status } = useSession();
  const { clearCartLocal, loadCart, clearCart } = useCartStore();
  const { loadFavorites, clearFavoritesLocal } = useFavoritesStore();
  const prevEmailRef = useRef(null);
  const timer = useRef(null);
  const TIMEOUT = 30 * 60 * 1000;

  useEffect(() => {
    if (session?.user?.email) {
      const currentEmail = session.user.email;
      if (prevEmailRef.current !== currentEmail) {
        setTimeout(() => {
          loadCart();
          loadFavorites(currentEmail);
        }, 100);
        prevEmailRef.current = currentEmail;
      }
    } else if (status === "unauthenticated") {
      if (prevEmailRef.current) {
        clearCartLocal();
        clearFavoritesLocal();
        prevEmailRef.current = null;
      } else {
        loadFavorites(null); // guest favorites
      }
    }
  }, [session?.user?.email, status]);

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
