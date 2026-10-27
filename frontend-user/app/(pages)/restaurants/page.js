import { Suspense } from "react";
import RestaurantsClient from "./RestaurantsClient";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Restaurants Near You | पेट Protocols",
  description:
    "Discover top-rated partner restaurants and your favourite cuisines, all in one place on पेट Protocols.",
};

export default function RestaurantsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-36 pb-20 flex flex-col items-center justify-center gap-3 bg-[var(--bg-main)] text-[var(--text-main)] transition-colors">
          <Loader2 className="animate-spin w-8 h-8 text-[#FF7900]" />
          <p className="text-xs text-[var(--text-muted)] font-semibold">
            Loading restaurants...
          </p>
        </div>
      }
    >
      <RestaurantsClient />
    </Suspense>
  );
}
