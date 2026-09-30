"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import CustomSpinner from "../ui/CustomSpinner";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function FeatureGuard({ featureKey, featureName, children }) {
  const { data: session, status } = useSession();
  const [enabledFeatures, setEnabledFeatures] = useState(
    session?.user?.enabledFeatures !== undefined ? session.user.enabledFeatures : null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.enabledFeatures !== undefined) {
      setEnabledFeatures(session.user.enabledFeatures);
    }
  }, [session?.user?.enabledFeatures]);

  useEffect(() => {
    let isMounted = true;
    if (status === "authenticated") {
      fetch("/api/restaurant/settings")
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          if (data.success && Array.isArray(data.restaurant?.enabledFeatures)) {
            setEnabledFeatures(data.restaurant.enabledFeatures);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [status]);

  if (status === "loading" || (loading && enabledFeatures === null)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-16">
        <CustomSpinner size="md" label={`Checking ${featureName || "Module"} Authorization...`} />
      </div>
    );
  }

  const activeFeatures = enabledFeatures !== null ? enabledFeatures : (session?.user?.enabledFeatures || []);
  const isAllowed = Array.isArray(activeFeatures) && activeFeatures.includes(featureKey);

  if (!isAllowed) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 sm:p-10 bg-white dark:bg-[#0d111a] border border-amber-200/90 dark:border-amber-500/20 rounded-3xl text-center shadow-xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-2xl shadow-xs">
          <ShieldAlert size={32} />
        </div>

        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[11px] uppercase tracking-wider border border-amber-200 dark:border-amber-800/50">
            Feature Access Restricted
          </span>
          <h2 className="text-2xl font-black text-stone-900 dark:text-white mt-3">
            {featureName || "Module"} Not Enabled
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
            The <strong className="text-stone-800 dark:text-stone-200">{featureName || featureKey}</strong> feature module is currently disabled for this restaurant branch by Superadmin.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft size={14} />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return children;
}
