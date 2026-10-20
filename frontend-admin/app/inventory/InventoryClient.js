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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-jakarta">
      <FeatureGuard featureKey="inventory" featureName="Inventory & Stock Management">
        <InventoryWorkspace restaurantName={restaurantName} />
      </FeatureGuard>
    </div>
  );
}
