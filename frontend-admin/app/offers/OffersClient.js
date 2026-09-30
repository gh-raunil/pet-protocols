"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import FeatureGuard from "@/components/auth/FeatureGuard";
import OffersSection from "@/app/settings/components/OffersSection";

export default function OffersClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/offers");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <FeatureGuard featureKey="offers" featureName="Offers & Promotions">
          <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm shadow-stone-200/40 dark:shadow-none">
            <OffersSection />
          </div>
        </FeatureGuard>
      </main>
    </div>
  );
}
