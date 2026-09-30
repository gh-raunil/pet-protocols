"use client";

import React from "react";

export default function CustomSpinner({
  size = "md",
  label = "Loading...",
  showLabel = true,
  className = "",
}) {
  const sizeMap = {
    sm: { box: "w-8 h-8", text: "text-xs" },
    md: { box: "w-14 h-14", text: "text-sm" },
    lg: { box: "w-20 h-20", text: "text-base" },
    xl: { box: "w-28 h-28", text: "text-lg" },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className={`loader-glow-wrapper ${currentSize.box}`}>
        <div className="loader-glow-ring-outer" />
        <div className="loader-glow-ring-inner" />
        <div className="loader-glow-core" />
      </div>

      {showLabel && label && (
        <p className={`font-medium tracking-wide text-slate-600 dark:text-slate-300 animate-pulse ${currentSize.text}`}>
          {label}
        </p>
      )}
    </div>
  );
}
