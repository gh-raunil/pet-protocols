"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function RestaurantRedirectPage() {
  const params = useParams();
  const slug = params?.slug ? (Array.isArray(params.slug) ? params.slug.join("/") : params.slug) : "dashboard";
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001";

  useEffect(() => {
    const target = `${adminUrl}/${slug}`;
    window.location.replace(target);
  }, [slug, adminUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">
      <div className="text-center space-y-4 p-8 bg-[#0d0d0d] border border-orange-500/20 rounded-2xl shadow-2xl">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-lg font-bold">Redirecting to Restaurant Admin Portal...</h2>
        <p className="text-xs text-gray-400">Taking you to {adminUrl}/{slug}</p>
      </div>
    </div>
  );
}
