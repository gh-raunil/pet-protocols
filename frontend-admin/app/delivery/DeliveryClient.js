"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import DeliveryWorkspace from "@/components/workspaces/DeliveryWorkspace";
import FeatureGuard from "@/components/auth/FeatureGuard";

export default function DeliveryClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/delivery");
    }
  }, [status, router]);

  const restaurantName = session?.user?.restaurantName || "";

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors">
      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <FeatureGuard featureKey="delivery" featureName="Delivery Operations">
          <DeliveryWorkspace restaurantName={restaurantName} />
        </FeatureGuard>
      </main>
    </div>
  );
}
