"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ label = "Back" }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white bg-surface-secondary hover:bg-surface-elevated border border-border-default transition active:scale-95 cursor-pointer shadow-xs"
    >
      <ArrowLeft size={13} />
      <span>{label}</span>
    </button>
  );
}