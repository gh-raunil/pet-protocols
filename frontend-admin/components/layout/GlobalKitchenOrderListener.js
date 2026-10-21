"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { playChime } from "@/lib/soundChimes";
import { Bell, ArrowRight, X, Sparkles, ChefHat, Truck, MapPin } from "lucide-react";
import { useWebPush } from "@/hooks/useWebPush";

export default function GlobalKitchenOrderListener({ onPendingCountChange }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isDeliveryStaff =
    session?.user?.role === "staff" &&
    Array.isArray(session?.user?.staffRoles) &&
    session.user.staffRoles.includes("Delivery") &&
    !session.user.staffRoles.includes("Kitchen") &&
    !session.user.staffRoles.includes("Manager");

  const [activeAlert, setActiveAlert] = useState(null);
  const seenOrderIdsRef = useRef(new Set());
  const initialLoadRef = useRef(true);

  // Unobtrusive push permission prompt for admin
  const { isSupported: isPushSupported, permission: pushPermission, isSubscribed: isPushSubscribed, subscribe: subscribePush } = useWebPush();
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "authenticated" && isPushSupported && pushPermission === "default" && !isPushSubscribed) {
      const dismissed = localStorage.getItem("admin_push_prompt_dismissed") === "true";
      if (!dismissed) {
        setShowPushPrompt(true);
      }
    } else {
      setShowPushPrompt(false);
    }
  }, [status, isPushSupported, pushPermission, isPushSubscribed]);

  useEffect(() => {
    // Only poll if user is authenticated as restaurant admin / admin
    if (status !== "authenticated" || !session?.user) return;

    let isMounted = true;

    async function checkNewOrders() {
      try {
        const res = await fetch("/api/restaurant/orders?status=pending&date=all");
        if (!res.ok) return;
        const data = await res.json();

        if (data.success && Array.isArray(data.orders)) {
          const currentCount = data.orders.length;

          // Always report count to parent & broadcast real-time count of unresponded orders
          if (onPendingCountChange) {
            onPendingCountChange(currentCount);
          }
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("pet_protocols_pending_orders_count", String(currentCount));
            } catch (e) {}
            window.dispatchEvent(
              new CustomEvent("pet_protocols_unresponded_orders_count", {
                detail: { count: currentCount },
              })
            );
          }

          if (initialLoadRef.current) {
            // First run: record all existing pending order IDs so we don't alert old ones
            data.orders.forEach((o) => seenOrderIdsRef.current.add(o._id));
            initialLoadRef.current = false;
            return;
          }

          // Check if any order is new
          const newOrders = data.orders.filter((o) => !seenOrderIdsRef.current.has(o._id));

          // Keep seenOrderIds synchronized with current pending orders
          const currentPendingIds = new Set(data.orders.map((o) => o._id));
          seenOrderIdsRef.current = currentPendingIds;

          if (newOrders.length > 0 && isMounted) {
            const newest = newOrders[0];

            // Check if user has sound alerts enabled in local settings (default true)
            const soundEnabled = localStorage.getItem("pet_kitchen_sound_alerts") !== "false";
            if (soundEnabled) {
              playChime(null, 1.0); // Loud high-fidelity chime
            }

            const deliveryArea = [newest.address?.street, newest.address?.city]
              .filter(Boolean)
              .join(", ");

            // Trigger floating popup banner
            setActiveAlert({
              id: newest._id,
              orderId: newest.orderId || newest._id,
              customerName: newest.address?.fullName || newest.user?.name || "Customer",
              deliveryAddress: deliveryArea || "Customer Delivery Address",
              itemCount: newest.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
              totalAmount: newest.totalAmount || 0,
              paymentMethod: newest.paymentMethod || (newest.paymentStatus === "pending" ? "Cash on Delivery (COD)" : "Paid Online"),
              timestamp: new Date(),
            });
          }
        }
      } catch (err) {
        // Silent error handling for background polling
      }
    }

    // Run initial check
    checkNewOrders();

    // Event listener to immediately re-check on order respond or window focus
    function handleImmediateCheck() {
      checkNewOrders();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("pet_protocols_refresh_pending_orders", handleImmediateCheck);
      window.addEventListener("pet_protocols_order_responded", handleImmediateCheck);
      window.addEventListener("focus", handleImmediateCheck);
    }

    // Poll every 8 seconds
    const interval = setInterval(checkNewOrders, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("pet_protocols_refresh_pending_orders", handleImmediateCheck);
        window.removeEventListener("pet_protocols_order_responded", handleImmediateCheck);
        window.removeEventListener("focus", handleImmediateCheck);
      }
    };
  }, [status, session, onPendingCountChange]);

  if (!activeAlert && !showPushPrompt) return null;

  const displayId = activeAlert
    ? activeAlert.orderId.toString().startsWith("ORD_")
      ? `#${activeAlert.orderId.replace("ORD_", "PET-")}`
      : activeAlert.orderId.toString().startsWith("PET-")
      ? `#${activeAlert.orderId}`
      : `#PET-${activeAlert.id.toString().slice(-6).toUpperCase()}`
    : "";

  return (
    <>
      {/* 1. Live Incoming Order Floating Alert */}
      {activeAlert && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[440px] z-[9999] animate-bounce-in">
          <div
            onClick={() => {
              if (isDeliveryStaff) {
                router.push("/delivery");
              } else {
                router.push("/orders");
              }
              setActiveAlert(null);
            }}
            className={`cursor-pointer text-white p-4 rounded-2xl shadow-2xl border-2 backdrop-blur-md flex flex-col gap-2 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
              isDeliveryStaff
                ? "bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-600 border-blue-400/40 hover:shadow-blue-500/30"
                : "bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 border-orange-400/40 hover:shadow-orange-500/30"
            }`}
          >
            {/* Glow ambient background effect */}
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-white/20 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-white/20 rounded-xl backdrop-blur-sm animate-pulse">
                  {isDeliveryStaff ? (
                    <Truck className="w-5 h-5 text-white" />
                  ) : (
                    <ChefHat className="w-5 h-5 text-white" />
                  )}
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wider font-extrabold text-white/90 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {isDeliveryStaff ? "New Delivery Dispatch Order!" : "New Kitchen Order!"}
                  </div>
                  <div className="text-sm font-black text-white">{displayId}</div>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAlert(null);
                }}
                className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors"
                title="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Details: Tailored for Delivery vs Kitchen */}
            <div className="text-xs text-white/95 bg-black/20 p-2.5 rounded-xl space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="truncate max-w-[240px]">👤 {activeAlert.customerName}</span>
                <span className="text-sm font-extrabold text-amber-300">₹{activeAlert.totalAmount}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/80">
                <span className="truncate max-w-[260px] flex items-center gap-1">
                  <MapPin size={11} className="shrink-0 text-amber-300" />
                  {activeAlert.deliveryAddress}
                </span>
                <span className="shrink-0 font-semibold">{activeAlert.paymentMethod}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-white/80">
                {isDeliveryStaff
                  ? "Click banner to open Delivery Operations"
                  : "Click banner to open in Kitchen Orders"}
              </span>
              <span className="text-xs font-bold text-white flex items-center gap-1 bg-white/25 px-2.5 py-1 rounded-full hover:bg-white/35 transition-colors">
                {isDeliveryStaff ? "Open Delivery" : "Open Orders"} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Unobtrusive Desktop Push Notification Permission Prompt (One-time, dismissible) */}
      {showPushPrompt && !activeAlert && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[380px] z-[9990] animate-fade-in">
          <div className="bg-zinc-900 border border-orange-500/40 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-orange-500/20 text-orange-400 rounded-xl shrink-0">
                <Bell className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs font-bold text-white">Enable Desktop Order Alerts</div>
                <div className="text-[11px] text-zinc-400">Get alerts even if this tab is closed</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await subscribePush();
                  setShowPushPrompt(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow transition cursor-pointer"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("admin_push_prompt_dismissed", "true");
                  setShowPushPrompt(false);
                }}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
