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
      title: rawContent.title || rawContent.message || defaultTitleForType(type),
      description: rawContent.title ? (rawContent.message || rawContent.description || "") : (rawContent.description || ""),
      badge: rawContent.badge || null,
    };
  }

  const str = typeof rawContent === "string" ? rawContent.trim() : String(rawContent || "").trim();

  // Multiline string
  if (str.includes("\n")) {
    const lines = str.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      title: lines[0] || defaultTitleForType(type),
      description: lines.slice(1).join(" "),
      badge: null,
    };
  }

  // String with ": " separator where prefix is short (e.g. "Order #104: Confirmed")
  if (str.includes(": ")) {
    const parts = str.split(": ");
    if (parts[0].length <= 26 && parts.slice(1).join(": ").trim().length > 0) {
      return {
        title: parts[0],
        description: parts.slice(1).join(": "),
        badge: null,
      };
    }
  }

  // Single string: The string itself is the primary readable message (e.g. "Added to cart")
  return {
    title: str || defaultTitleForType(type),
    description: "",
    badge: null,
  };
}

function defaultTitleForType(type, message = "") {
  const lower = typeof message === "string" ? message.toLowerCase() : "";
  if (lower.includes("cart") || lower.includes("dish") || lower.includes("item") || lower.includes("quantity")) return "Cart Updated";
  if (lower.includes("order") || lower.includes("checkout") || lower.includes("kitchen")) return "Order Status";
  if (lower.includes("coupon") || lower.includes("offer") || lower.includes("discount") || lower.includes("promo")) return "Special Offer";
  if (lower.includes("address") || lower.includes("location") || lower.includes("deliver")) return "Delivery Details";
  if (lower.includes("payment") || lower.includes("refund") || lower.includes("upi") || lower.includes("card")) return "Payment & Billing";
  if (lower.includes("profile") || lower.includes("account") || lower.includes("login") || lower.includes("otp") || lower.includes("logout")) return "Account";
  if (lower.includes("push") || lower.includes("notification") || lower.includes("alert")) return "Alerts";

  switch (type) {
    case "success":
      return "Success";
    case "error":
      return "Error";
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
    badgeText: "Success",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    borderAccent: "border-l-emerald-500",
    glowColor: "rgba(16, 185, 129, 0.08)",
    progressBar: "from-emerald-500 to-teal-400",
  },
  error: {
    icon: AlertCircle,
    badgeText: "Error",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    borderAccent: "border-l-rose-500",
    glowColor: "rgba(244, 63, 94, 0.08)",
    progressBar: "from-rose-500 to-red-400",
  },
  warning: {
    icon: AlertTriangle,
    badgeText: "Warning",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    borderAccent: "border-l-amber-500",
    glowColor: "rgba(245, 158, 11, 0.08)",
    progressBar: "from-amber-500 to-orange-400",
  },
  loading: {
    icon: Loader2,
    badgeText: "Loading",
    badgeClass: "bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border-[var(--brand-accent)]/20",
    iconBg: "bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border-[var(--brand-accent)]/20",
    borderAccent: "border-l-[var(--brand-accent)]",
    glowColor: "rgba(234, 88, 12, 0.08)",
    progressBar: "from-[var(--brand-accent)] to-amber-500",
    spinIcon: true,
  },
  info: {
    icon: Info,
    badgeText: "Info",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    borderAccent: "border-l-sky-500",
    glowColor: "rgba(14, 165, 233, 0.08)",
    progressBar: "from-sky-500 to-cyan-400",
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
    }, 220);
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
      const defaultDuration =
        type === "loading"
          ? 0
          : type === "error"
          ? 3200
          : 2200;
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
        @media (prefers-reduced-motion: reduce) {
          .rich-toast-item {
            transition: opacity 0.15s ease !important;
            transform: none !important;
          }
          .rich-toast-progress {
            animation: none !important;
          }
        }
      `}</style>
      {children}
      {/* Toast Overlay Container:
          - When navbar is visible: sits comfortably below navbar (top-[4.5rem] sm:top-20)
          - When navbar hides on scroll: slides smoothly to the top (top-3 sm:top-4)
          - Mobile responsive: left-3 right-3 with max-w-sm so it never overflows or obscures crucial controls */}
      <div
        className={`fixed z-[99999] pointer-events-none flex flex-col gap-2 transition-all duration-300 ease-out left-3 right-3 sm:left-auto sm:right-6 sm:w-auto sm:max-w-sm ${
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

  const duration = toast.duration ?? (toast.type === "error" ? 3200 : 2200);
  const remainingTimeRef = useRef(duration);
  const timerStartRef = useRef(0);
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
      transform = "translateY(-6px) scale(0.97)";
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
          transition: isDragging ? "none" : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease",
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
        transition: isDragging
          ? "none"
          : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease",
      }}
      className={`rich-toast-item pointer-events-auto relative overflow-hidden rounded-xl bg-[var(--bg-card)]/95 border border-[var(--border-color)] text-[var(--text-main)] shadow-lg shadow-black/5 dark:shadow-black/25 backdrop-blur-md px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-[280px] sm:min-w-[320px] max-w-sm border-l-[3px] ${cfg.borderAccent} cursor-grab active:cursor-grabbing select-none group`}
    >
      {/* Subtle ambient accent glow */}
      <div
        className="pointer-events-none absolute -top-6 -right-6 w-20 h-20 rounded-full blur-xl opacity-60 transition-opacity duration-300"
        style={{ backgroundColor: cfg.glowColor }}
      />

      {isCustomElement ? (
        toast.content
      ) : (
        <div className="flex items-start gap-2.5 sm:gap-3 relative z-10">
          {/* Status Icon Badge */}
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${cfg.iconBg}`}
          >
            <IconComponent
              className={`w-4 h-4 shrink-0 ${cfg.spinIcon ? "animate-spin" : ""}`}
            />
          </div>

          {/* Text & Metadata Container */}
          <div className="flex-1 min-w-0 pr-0.5">
            {badge && (
              <span
                className={`inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold tracking-wider uppercase rounded border mb-1 ${cfg.badgeClass}`}
              >
                {badge}
              </span>
            )}

            <h4 className="text-xs sm:text-sm font-semibold text-[var(--text-main)] leading-snug tracking-tight break-words">
              {title}
            </h4>
            {description ? (
              <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed break-words font-normal">
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
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition shrink-0 -mr-1 -mt-0.5 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {duration > 0 && toast.type !== "loading" ? (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--border-color)]/30 overflow-hidden">
          <div
            className={`rich-toast-progress h-full bg-gradient-to-r ${cfg.progressBar}`}
            style={{
              animation: `richToastProgress ${duration}ms linear forwards`,
              animationPlayState: isHovered || isDragging ? "paused" : "running",
            }}
          />
        </div>
      ) : toast.type === "loading" ? (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--border-color)]/30 overflow-hidden">
          <div
            className={`rich-toast-progress h-full w-1/3 bg-gradient-to-r ${cfg.progressBar} animate-[richToastIndeterminate_1.5s_infinite_ease-in-out]`}
          />
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
