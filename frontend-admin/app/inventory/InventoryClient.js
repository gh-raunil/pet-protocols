"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import InventoryWorkspace from "@/components/workspaces/InventoryWorkspace";
import FeatureGuard from "@/components/auth/FeatureGuard";

export default function InventoryClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/inventory");
    }
  }, [status, router]);

  const restaurantName = session?.user?.restaurantName || "";

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors">
      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <FeatureGuard featureKey="inventory" featureName="Inventory & Stock Management">
          <InventoryWorkspace restaurantName={restaurantName} />
        </FeatureGuard>
      </main>
    </div>
  );
}
