"use client";

import React, { useState } from "react";
import { Toaster, toast, resolveValue } from "react-hot-toast";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from "lucide-react";

// Helper to format / parse content into title and description
function parseToastContent(rawContent, type) {
  if (typeof rawContent === "object" && rawContent !== null && !React.isValidElement(rawContent)) {
    return {
      title: rawContent.title || defaultTitleForType(type),
      description: rawContent.message || rawContent.description || "",
      badge: rawContent.badge,
    };
  }

  const str = typeof rawContent === "string" ? rawContent : String(rawContent || "");

  // Multiline string
  if (str.includes("\n")) {
    const lines = str.split("\n");
    return {
      title: lines[0],
      description: lines.slice(1).join(" "),
      badge: null,
    };
  }

  // String with ": " separator where prefix is short (e.g. "Order #123: Preparing")
  if (str.includes(": ")) {
    const parts = str.split(": ");
    if (parts[0].length <= 26) {
      return {
        title: parts[0],
        description: parts.slice(1).join(": "),
        badge: null,
      };
    }
  }

  // Single string
  return {
    title: defaultTitleForType(type, str),
    description: str,
    badge: null,
  };
}

function defaultTitleForType(type, message = "") {
  const lower = typeof message === "string" ? message.toLowerCase() : "";
  if (lower.includes("order")) return "Order Update";
  if (lower.includes("dish") || lower.includes("product") || lower.includes("menu") || lower.includes("stock")) return "Kitchen & Menu";
  if (lower.includes("coupon") || lower.includes("offer")) return "Promotion Applied";
  if (lower.includes("password") || lower.includes("account") || lower.includes("login") || lower.includes("staff")) return "Security & Access";
  if (lower.includes("saved") || lower.includes("updated") || lower.includes("created")) return "Changes Confirmed";
  if (lower.includes("push") || lower.includes("device") || lower.includes("notification")) return "Live Alerts";
  if (lower.includes("refund") || lower.includes("reconciliation") || lower.includes("payment")) return "Payment & Refund";

  switch (type) {
    case "success":
      return "Action Successful";
    case "error":
      return "Attention Required";
    case "warning":
      return "System Warning";
    case "loading":
      return "Processing Request";
    case "blank":
    case "info":
    default:
      return "Platform Notice";
  }
}

const typeConfig = {
  success: {
    icon: CheckCircle2,
    badgeText: "SUCCESS",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10",
    borderAccent: "border-l-emerald-500",
    glowColor: "rgba(16, 185, 129, 0.18)",
    progressBar: "from-emerald-500 via-teal-400 to-emerald-400",
  },
  error: {
    icon: AlertCircle,
    badgeText: "ERROR",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
    iconBg: "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-500/10",
    borderAccent: "border-l-rose-500",
    glowColor: "rgba(244, 63, 94, 0.18)",
    progressBar: "from-rose-500 via-red-400 to-rose-400",
  },
  warning: {
    icon: AlertTriangle,
    badgeText: "WARNING",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    iconBg: "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10",
    borderAccent: "border-l-amber-500",
    glowColor: "rgba(245, 158, 11, 0.18)",
    progressBar: "from-amber-500 via-orange-400 to-amber-400",
  },
  loading: {
    icon: Loader2,
    badgeText: "PROCESSING",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25",
    iconBg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20 shadow-indigo-500/10",
    borderAccent: "border-l-indigo-500",
    glowColor: "rgba(99, 102, 241, 0.18)",
    progressBar: "from-indigo-500 via-violet-400 to-indigo-400",
    spinIcon: true,
  },
  blank: {
    icon: Info,
    badgeText: "NOTICE",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
    iconBg: "bg-sky-500/10 text-sky-500 border-sky-500/20 shadow-sky-500/10",
    borderAccent: "border-l-sky-500",
    glowColor: "rgba(14, 165, 233, 0.18)",
    progressBar: "from-sky-500 via-cyan-400 to-sky-400",
  },
};

function RichToastCard({ toast: t }) {
  const [isHovered, setIsHovered] = useState(false);
  const cfg = typeConfig[t.type] || typeConfig.blank;
  const IconComponent = cfg.icon;

  const rawContent = resolveValue(t.message, t);
  const { title, description, badge } = parseToastContent(rawContent, t.type);

  const duration = t.duration || 3800;
  const isCustomElement = React.isValidElement(rawContent);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#0c1017]/95 border border-stone-200/80 dark:border-stone-800/80 text-stone-900 dark:text-white shadow-2xl shadow-black/20 dark:shadow-black/60 backdrop-blur-2xl p-4 min-w-[300px] sm:min-w-[340px] max-w-md border-l-[4px] ${cfg.borderAccent} group ${
        t.visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-2 scale-95"
      }`}
      {...t.ariaProps}
    >
      {/* Dynamic ambient glow circle */}
      <div
        className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl transition-opacity duration-500"
        style={{ backgroundColor: cfg.glowColor }}
      />

      {isCustomElement ? (
        rawContent
      ) : (
        <div className="flex items-start gap-3 relative z-10">
          {/* Status Icon Badge */}
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-sm mt-0.5 ${cfg.iconBg}`}
          >
            <IconComponent
              className={`w-5 h-5 ${cfg.spinIcon ? "animate-spin" : ""}`}
            />
          </div>

          {/* Text & Metadata Container */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wider uppercase rounded-md border ${cfg.badgeClass}`}
                >
                  {badge || cfg.badgeText}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-stone-400 dark:text-stone-500 font-medium">
                  <span className="w-1 h-1 rounded-full bg-stone-300 dark:bg-stone-600 animate-pulse" />
                  just now
                </span>
              </div>
            </div>

            <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white leading-tight tracking-tight">
              {title}
            </h4>
            {description ? (
              <p className="text-[11px] sm:text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed break-words font-normal">
                {description}
              </p>
            ) : null}
          </div>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toast.dismiss(t.id);
            }}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/60 transition shrink-0 -mr-1 -mt-1 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {t.type !== "loading" ? (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-stone-100 dark:bg-stone-900/40 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${cfg.progressBar}`}
            style={{
              animation: `richToastProgress ${duration}ms linear forwards`,
              animationPlayState: isHovered ? "paused" : "running",
            }}
          />
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-100 dark:bg-stone-900/40 overflow-hidden">
          <div className={`h-full w-1/3 bg-gradient-to-r ${cfg.progressBar} animate-[richToastIndeterminate_1.5s_infinite_ease-in-out]`} />
        </div>
      )}
    </div>
  );
}

export default function RichToaster() {
  return (
    <>
      <style>{`
        @keyframes richToastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes richToastIndeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
      <Toaster
        position="top-right"
        containerClassName="!z-[99999]"
        toastOptions={{
          duration: 3800,
        }}
      >
        {(t) => <RichToastCard toast={t} />}
      </Toaster>
    </>
  );
}
