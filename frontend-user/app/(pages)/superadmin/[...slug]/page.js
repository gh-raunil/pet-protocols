"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function SuperadminCatchAllRedirectPage() {
  const params = useParams();
  const slug = params?.slug ? (Array.isArray(params.slug) ? params.slug.join("/") : params.slug) : "";
  const superadminUrl = process.env.NEXT_PUBLIC_SUPERADMIN_URL || "http://localhost:3002";

  useEffect(() => {
    const target = slug ? `${superadminUrl}/${slug}` : `${superadminUrl}/`;
    window.location.replace(target);
  }, [slug, superadminUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">
      <div className="text-center space-y-4 p-8 bg-[#0d0d0d] border border-red-500/20 rounded-2xl shadow-2xl">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-lg font-bold">Redirecting to Superadmin Control Panel...</h2>
        <p className="text-xs text-gray-400">Taking you to {superadminUrl}/{slug}</p>
      </div>
    </div>
  );
}
