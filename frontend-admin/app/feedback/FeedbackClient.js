"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import FeedbackWorkspace from "@/components/workspaces/FeedbackWorkspace";

export default function FeedbackClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/feedback");
    }
  }, [status, router]);

  const restaurantName = session?.user?.restaurantName || "";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-jakarta">
      <FeedbackWorkspace restaurantName={restaurantName} />
    </div>
  );
}
