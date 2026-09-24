"use client";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";

function AuthHandler() {
  const { data: session } = useSession();
  const timer = useRef(null);
  const TIMEOUT = 30 * 60 * 1000;

  const resetTimer = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (session) {
        signOut({ callbackUrl: "/login" });
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
