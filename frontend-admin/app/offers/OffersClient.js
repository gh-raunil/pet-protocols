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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto font-jakarta">
      <FeatureGuard featureKey="offers" featureName="Offers & Promotions">
        <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-xs">
          <OffersSection />
        </div>
      </FeatureGuard>
    </div>
  );
}
