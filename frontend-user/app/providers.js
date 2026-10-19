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
