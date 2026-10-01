"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

const ToastContext = createContext(null);

let globalToastHandler = null;
const recentMessages = new Map();

export const toast = {
  success: (msg, opts) => globalToastHandler?.("success", msg, opts),
  error: (msg, opts) => globalToastHandler?.("error", msg, opts),
  warning: (msg, opts) => globalToastHandler?.("warning", msg, opts),
  info: (msg, opts) => globalToastHandler?.("info", msg, opts),
  custom: (renderFn, opts) => globalToastHandler?.("custom", renderFn, opts),
  remove: (id) => globalToastHandler?.remove(id),
};
// Add self-reference so const { toast } = useToast() works alongside const toast = useToast()
toast.toast = toast;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const isNavHidden = useHideOnScroll();

  const removeToast = useCallback((id, direction = "fade") => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true, exitDirection: direction } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
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
      const duration = opts.duration ?? 2500; // 2.5s duration for comfortable reading

      const newToast = {
        id,
        type,
        content,
        opts,
        exiting: false,
        exitDirection: "none",
        createdAt: now,
      };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Limit to max 4 active to prevent blocking

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id, "fade");
        }, duration);
      }
      return id;
    },
    [removeToast]
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
      {children}
      {/* Toast Overlay Container:
          - When navbar is visible: sits comfortably below navbar (top-[4.5rem] sm:top-20)
          - When navbar hides on scroll: slides smoothly to the top (top-3 sm:top-4)
          - Mobile responsive: left-3 right-3 on mobile so it never overflows or gets cut off */}
      <div
        className={`fixed z-[99999] pointer-events-none flex flex-col gap-2 transition-all duration-300 ease-out left-3 right-3 sm:left-auto sm:right-6 sm:w-auto sm:max-w-md ${
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
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipe = useRef(false);

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

  const iconMap = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-[var(--brand-accent)] shrink-0" />,
  };

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
      className={`pointer-events-auto cursor-grab active:cursor-grabbing select-none flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[var(--bg-card)]/95 border border-[var(--border-color)] text-[var(--text-main)] shadow-2xl shadow-black/30 backdrop-blur-xl transition-shadow hover:shadow-2xl border-l-4 ${
        toast.type === "success"
          ? "border-l-emerald-500"
          : toast.type === "error"
          ? "border-l-rose-500"
          : toast.type === "warning"
          ? "border-l-amber-500"
          : "border-l-[var(--brand-accent)]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {iconMap[toast.type] || iconMap.info}
        <span className="text-xs sm:text-sm font-semibold leading-snug break-words">
          {toast.content}
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss("fade");
        }}
        className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-sub)] transition shrink-0 ml-1"
        aria-label="Dismiss toast"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx || toast;
}
export default toast;
