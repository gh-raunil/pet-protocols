"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

const ToastContext = createContext(null);

let globalToastHandler = null;
const recentMessages = new Map();

export const toast = {
  success: (msg, opts) => globalToastHandler?.("success", msg, opts),
  error: (msg, opts) => globalToastHandler?.("error", msg, opts),
  warning: (msg, opts) => globalToastHandler?.("warning", msg, opts),
  info: (msg, opts) => globalToastHandler?.("info", msg, opts),
  loading: (msg, opts) => globalToastHandler?.("loading", msg, opts),
  custom: (renderFn, opts) => globalToastHandler?.("custom", renderFn, opts),
  remove: (id) => globalToastHandler?.remove(id),
};
// Add self-reference so const { toast } = useToast() works alongside const toast = useToast()
toast.toast = toast;

// Intelligent message parser for customer facing toasts
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

  // String with ": " separator where prefix is short (e.g. "Order #104: Confirmed")
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
  if (lower.includes("cart") || lower.includes("dish") || lower.includes("item") || lower.includes("quantity")) return "Cart & Selection";
  if (lower.includes("order") || lower.includes("checkout") || lower.includes("kitchen")) return "Order Status";
  if (lower.includes("coupon") || lower.includes("offer") || lower.includes("discount") || lower.includes("promo")) return "Special Offer";
  if (lower.includes("address") || lower.includes("location") || lower.includes("deliver")) return "Delivery Details";
  if (lower.includes("payment") || lower.includes("refund") || lower.includes("upi") || lower.includes("card")) return "Payment & Billing";
  if (lower.includes("profile") || lower.includes("account") || lower.includes("login") || lower.includes("otp") || lower.includes("logout")) return "Account & Security";
  if (lower.includes("push") || lower.includes("notification") || lower.includes("alert")) return "Live Alerts";

  switch (type) {
    case "success":
      return "Action Completed";
    case "error":
      return "Something Went Wrong";
    case "warning":
      return "Notice";
    case "loading":
      return "Please Wait";
    case "info":
    default:
      return "Notification";
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
    badgeText: "WORKING",
    badgeClass: "bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border-[var(--brand-accent)]/25",
    iconBg: "bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border-[var(--brand-accent)]/20 shadow-[var(--brand-accent)]/10",
    borderAccent: "border-l-[var(--brand-accent)]",
    glowColor: "rgba(255, 90, 31, 0.18)",
    progressBar: "from-orange-500 via-amber-400 to-orange-400",
    spinIcon: true,
  },
  info: {
    icon: Info,
    badgeText: "UPDATE",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
    iconBg: "bg-sky-500/10 text-sky-500 border-sky-500/20 shadow-sky-500/10",
    borderAccent: "border-l-sky-500",
    glowColor: "rgba(14, 165, 233, 0.18)",
    progressBar: "from-sky-500 via-cyan-400 to-sky-400",
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const isNavHidden = useHideOnScroll();

  const removeToast = useCallback((id, direction = "fade") => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true, exitDirection: direction } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 240);
  }, []);

  const addToast = useCallback(
    (type, content, opts = {}) => {
      // Deduplicate identical message within 1000ms
      const msgKey = typeof content === "string" ? content : "custom";
      const now = Date.now();
      if (recentMessages.has(msgKey) && now - recentMessages.get(msgKey) < 1000) {
        return null;
      }
      recentMessages.set(msgKey, now);

      const id = opts.id || Math.random().toString(36).substring(2, 9);
      const defaultDuration = type === "loading" ? 0 : 3800;
      const duration = opts.duration !== undefined ? opts.duration : defaultDuration;

      const newToast = {
        id,
        type,
        content,
        opts,
        duration,
        exiting: false,
        exitDirection: "none",
        createdAt: now,
      };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Limit to max 4 active to prevent blocking
      return id;
    },
    []
  );

  useEffect(() => {
    globalToastHandler = (type, content, opts) => addToast(type, content, opts);
    globalToastHandler.remove = (id) => removeToast(id, "fade");
    return () => {
      globalToastHandler = null;
    };
  }, [addToast, removeToast]);

  return (
    <ToastContext.Provider value={toast}>
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
      {children}
      {/* Toast Overlay Container:
          - When navbar is visible: sits comfortably below navbar (top-[4.5rem] sm:top-20)
          - When navbar hides on scroll: slides smoothly to the top (top-3 sm:top-4)
          - Mobile responsive: left-3 right-3 on mobile so it never overflows or gets cut off */}
      <div
        className={`fixed z-[99999] pointer-events-none flex flex-col gap-2.5 transition-all duration-300 ease-out left-3 right-3 sm:left-auto sm:right-6 sm:w-auto sm:max-w-md ${
          isNavHidden ? "top-3 sm:top-4" : "top-[4.5rem] sm:top-20"
        }`}
        aria-live="polite"
        role="region"
      >
        {toasts.map((t) => (
          <SwipeableToastItem key={t.id} toast={t} onDismiss={(dir) => removeToast(t.id, dir)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function SwipeableToastItem({ toast, onDismiss }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipe = useRef(false);

  const duration = toast.duration ?? 3800;
  const remainingTimeRef = useRef(duration);
  const timerStartRef = useRef(Date.now());
  const timerIdRef = useRef(null);

  // Resume or start timer
  const startTimer = useCallback(() => {
    if (duration <= 0) return;
    timerStartRef.current = Date.now();
    timerIdRef.current = setTimeout(() => {
      onDismiss("fade");
    }, remainingTimeRef.current);
  }, [duration, onDismiss]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
      const elapsed = Date.now() - timerStartRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }
  }, []);

  useEffect(() => {
    if (!isHovered && !isDragging) {
      startTimer();
    } else {
      pauseTimer();
    }
    return () => {
      if (timerIdRef.current) clearTimeout(timerIdRef.current);
    };
  }, [isHovered, isDragging, startTimer, pauseTimer]);

  const handlePointerDown = (e) => {
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    setIsDragging(true);
    isHorizontalSwipe.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Detect intentional horizontal swipe vs vertical page scrolling
    if (!isHorizontalSwipe.current) {
      if (Math.abs(dx) > Math.abs(dy) + 4) {
        isHorizontalSwipe.current = true;
      }
    }

    if (isHorizontalSwipe.current) {
      setDragX(dx);
    }
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    // If swiped more than 50px in either direction, dismiss toast!
    if (Math.abs(dragX) > 50) {
      const dir = dragX > 0 ? "right" : "left";
      onDismiss(dir);
    } else {
      setDragX(0); // Snap back
    }
  };

  // Exit animation transform
  let transform = `translateX(${dragX}px)`;
  let opacity = Math.max(0, 1 - Math.abs(dragX) / 180);

  if (toast.exiting) {
    if (toast.exitDirection === "left") {
      transform = "translateX(-120%)";
      opacity = 0;
    } else if (toast.exitDirection === "right") {
      transform = "translateX(120%)";
      opacity = 0;
    } else {
      transform = "translateY(-8px) scale(0.95)";
      opacity = 0;
    }
  }

  // Custom renderer support
  if (toast.type === "custom" && typeof toast.content === "function") {
    return (
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform,
          opacity,
          touchAction: "pan-y",
          transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease",
        }}
        className="pointer-events-auto cursor-grab active:cursor-grabbing select-none"
      >
        {toast.content({ id: toast.id, visible: !toast.exiting })}
      </div>
    );
  }

  const cfg = typeConfig[toast.type] || typeConfig.info;
  const IconComponent = cfg.icon;
  const { title, description, badge } = parseToastContent(toast.content, toast.type);
  const isCustomElement = React.isValidElement(toast.content);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform,
        opacity,
        touchAction: "pan-y",
        transition: isDragging ? "none" : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease",
      }}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#10141e]/95 border border-stone-200/80 dark:border-stone-800/80 text-stone-900 dark:text-white shadow-2xl shadow-black/20 dark:shadow-black/60 backdrop-blur-2xl p-4 min-w-[290px] sm:min-w-[340px] max-w-md border-l-[4px] ${cfg.borderAccent} cursor-grab active:cursor-grabbing select-none group`}
    >
      {/* Ambient glow sphere */}
      <div
        className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl transition-opacity duration-500"
        style={{ backgroundColor: cfg.glowColor }}
      />

      {isCustomElement ? (
        toast.content
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
              onDismiss("fade");
            }}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800/60 transition shrink-0 -mr-1 -mt-1 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {duration > 0 && toast.type !== "loading" ? (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-stone-100 dark:bg-stone-900/40 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${cfg.progressBar}`}
            style={{
              animation: `richToastProgress ${duration}ms linear forwards`,
              animationPlayState: isHovered || isDragging ? "paused" : "running",
            }}
          />
        </div>
      ) : toast.type === "loading" ? (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-100 dark:bg-stone-900/40 overflow-hidden">
          <div className={`h-full w-1/3 bg-gradient-to-r ${cfg.progressBar} animate-[richToastIndeterminate_1.5s_infinite_ease-in-out]`} />
        </div>
      ) : null}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx || toast;
}
export default toast;
