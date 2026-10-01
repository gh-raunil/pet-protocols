import { Suspense } from "react";
import MenuClient from "./MenuClient.js";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Menu — Pet Protocols",
  description: "Browse our full menu — burgers, pizzas, momos, fries and cold drinks.",
};

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-36 pb-20 flex flex-col items-center justify-center gap-3 bg-[var(--bg-main)] text-[var(--text-main)] transition-colors">
          <Loader2 className="animate-spin w-8 h-8 text-[var(--brand-accent)]" />
          <p className="text-xs text-[var(--text-muted)] font-semibold">Loading menu...</p>
        </div>
      }
    >
      <MenuClient />
    </Suspense>
  );
}