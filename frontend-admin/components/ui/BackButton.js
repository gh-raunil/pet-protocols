"use client";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm font-medium"
    >
      ← Back to Menu
    </button>
  );
}