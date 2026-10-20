"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useId,
  useCallback,
  cloneElement,
  isValidElement,
} from "react";
import { createPortal } from "react-dom";
import { HelpCircle, Info } from "lucide-react";

/**
 * Robust, accessible, beginner-friendly Tooltip component for Kitchen, Delivery & Staff.
 * Features:
 * - Rendered in document.body via Portal to prevent table, modal, or card clipping
 * - Collision detection & automatic flip when near viewport edges
 * - Accessible: role="tooltip", aria-describedby, keyboard focus & Escape dismiss
 * - Touch-friendly: tap to toggle on mobile, tap-outside dismiss
 * - 150ms hover delay to prevent flash when cursor traverses
 */
export default function Tooltip({
  children,
  content,
  title,
  placement = "top", // "top" | "bottom" | "left" | "right"
  delay = 150,
  className = "",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, actualPlacement: placement });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timerRef = useRef(null);
  const id = useId();

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const gap = 8;
    const padding = 8;
    let actualPlacement = placement;

    // Check vertical flips
    if (placement === "top" && triggerRect.top - tooltipRect.height - gap < padding) {
      actualPlacement = "bottom";
    } else if (
      placement === "bottom" &&
      triggerRect.bottom + tooltipRect.height + gap > window.innerHeight - padding
    ) {
      actualPlacement = "top";
    }

    // Check horizontal flips
    if (placement === "left" && triggerRect.left - tooltipRect.width - gap < padding) {
      actualPlacement = "right";
    } else if (
      placement === "right" &&
      triggerRect.right + tooltipRect.width + gap > window.innerWidth - padding
    ) {
      actualPlacement = "left";
    }

    let top = 0;
    let left = 0;

    if (actualPlacement === "top") {
      top = triggerRect.top + scrollY - tooltipRect.height - gap;
      left = triggerRect.left + scrollX + (triggerRect.width - tooltipRect.width) / 2;
    } else if (actualPlacement === "bottom") {
      top = triggerRect.bottom + scrollY + gap;
      left = triggerRect.left + scrollX + (triggerRect.width - tooltipRect.width) / 2;
    } else if (actualPlacement === "left") {
      top = triggerRect.top + scrollY + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.left + scrollX - tooltipRect.width - gap;
    } else if (actualPlacement === "right") {
      top = triggerRect.top + scrollY + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.right + scrollX + gap;
    }

    // Clamp horizontally within screen
    const minLeft = scrollX + padding;
    const maxLeft = scrollX + window.innerWidth - tooltipRect.width - padding;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    setCoords({ top, left, actualPlacement });
  }, [placement]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener("scroll", handleScrollOrResize, { passive: true });
      window.addEventListener("resize", handleScrollOrResize, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  // Outside click & Escape listener for accessibility & mobile touch
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const show = () => {
    if (disabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsOpen(true);
    }, delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(false);
  };

  const toggle = (e) => {
    if (disabled || !content) return;
    // On touch devices or click, toggle
    if (e.pointerType === "touch" || !isOpen) {
      setIsOpen((prev) => !prev);
    }
  };

  if (!content) return children;

  // Wrap child element in accessible trigger wrapper
  const triggerElement = (
    <span
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={(e) => {
        if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
          toggle(e);
        }
      }}
      aria-describedby={isOpen ? id : undefined}
      className="inline-flex max-w-full"
    >
      {children}
    </span>
  );

  return (
    <>
      {triggerElement}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            style={{
              position: "absolute",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className={`z-[999999] pointer-events-none transition-all duration-150 animate-in fade-in-0 zoom-in-95 ${className}`}
          >
            <div className="bg-stone-900/95 dark:bg-[#151926]/95 text-stone-100 text-[11px] font-medium leading-relaxed px-3 py-1.5 rounded-xl border border-white/10 shadow-2xl backdrop-blur-md max-w-xs break-words pointer-events-auto">
              {title && (
                <div className="font-bold text-white text-xs mb-0.5 border-b border-white/10 pb-0.5">
                  {title}
                </div>
              )}
              <div className="text-stone-200">{content}</div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * Dedicated beginner-friendly Contextual Help Icon Tooltip
 * Renders an unobtrusive small info/help icon that can be hovered or tapped.
 */
export function HelpTooltip({
  content,
  title,
  placement = "top",
  icon = "help", // "help" | "info"
  className = "",
  size = 14,
  label = "More information",
}) {
  const IconComponent = icon === "info" ? Info : HelpCircle;

  return (
    <Tooltip content={content} title={title} placement={placement}>
      <button
        type="button"
        aria-label={label}
        className={`inline-flex items-center justify-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 transition-colors focus:outline-hidden focus:ring-1 focus:ring-orange-500 cursor-help ${className}`}
      >
        <IconComponent size={size} />
      </button>
    </Tooltip>
  );
}
