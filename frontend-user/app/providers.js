"use client";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import useCartStore from "@/lib/cartStore";
import useFavoritesStore from "@/lib/favoritesStore";

function AuthHandler() {
  const { data: session, status } = useSession();
  const { clearCartLocal, loadCart } = useCartStore();
  const { loadFavorites, clearFavoritesLocal } = useFavoritesStore();
  const prevEmailRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (session?.user?.email) {
      const currentEmail = session.user.email;
      if (prevEmailRef.current !== currentEmail) {
        setTimeout(() => {
          loadCart(currentEmail);
          loadFavorites(currentEmail);
        }, 100);
        prevEmailRef.current = currentEmail;
        initializedRef.current = true;
      }
    } else if (status === "unauthenticated") {
      if (prevEmailRef.current) {
        clearCartLocal();
        clearFavoritesLocal();
        prevEmailRef.current = null;
      } else if (!initializedRef.current) {
        loadCart(null); // load guest cart from device storage
        loadFavorites(null); // load guest favorites from device storage
        initializedRef.current = true;
      }
    }
  }, [session?.user?.email, status]);

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
