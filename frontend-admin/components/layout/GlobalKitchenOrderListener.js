"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { playChime } from "@/lib/soundChimes";
import { Bell, ArrowRight, X, Sparkles, ChefHat } from "lucide-react";

export default function GlobalKitchenOrderListener() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [activeAlert, setActiveAlert] = useState(null);
  const seenOrderIdsRef = useRef(new Set());
  const initialLoadRef = useRef(true);

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
          if (initialLoadRef.current) {
            // First run: just record all existing pending order IDs so we don't alert old ones
            data.orders.forEach((o) => seenOrderIdsRef.current.add(o._id));
            initialLoadRef.current = false;
            return;
          }

          // Check if any order is new
          const newOrders = data.orders.filter((o) => !seenOrderIdsRef.current.has(o._id));

          if (newOrders.length > 0 && isMounted) {
            const newest = newOrders[0];
            // Add to seen set
            newOrders.forEach((o) => seenOrderIdsRef.current.add(o._id));

            // Check if user has sound alerts enabled in local settings (default true)
            const soundEnabled = localStorage.getItem("pet_kitchen_sound_alerts") !== "false";
            if (soundEnabled) {
              playChime(null, 1.0); // Loud high-fidelity chime
            }

            // Trigger floating popup banner
            setActiveAlert({
              id: newest._id,
              orderId: newest.orderId || newest._id,
              customerName: newest.address?.fullName || newest.user?.name || "Customer",
              itemCount: newest.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
              totalAmount: newest.totalAmount || 0,
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

    // Poll every 8 seconds
    const interval = setInterval(checkNewOrders, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [status, session]);

  if (!activeAlert) return null;

  const displayId = activeAlert.orderId.toString().startsWith("ORD_")
    ? `#${activeAlert.orderId.replace("ORD_", "PET-")}`
    : activeAlert.orderId.toString().startsWith("PET-")
    ? `#${activeAlert.orderId}`
    : `#PET-${activeAlert.id.toString().slice(-6).toUpperCase()}`;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[420px] z-[9999] animate-bounce-in">
      <div
        onClick={() => {
          router.push("/orders");
          setActiveAlert(null);
        }}
        className="cursor-pointer bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white p-4 rounded-2xl shadow-2xl border-2 border-orange-400/40 backdrop-blur-md flex flex-col gap-2 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-orange-500/30"
      >
        {/* Glow ambient background effect */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-white/20 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-white/20 rounded-xl backdrop-blur-sm animate-pulse">
              <ChefHat className="w-5 h-5 text-white" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wider font-extrabold text-orange-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                New Kitchen Order!
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

        <div className="text-xs text-orange-50 bg-black/15 p-2 rounded-xl flex items-center justify-between">
          <span className="font-semibold truncate max-w-[200px]">
            👤 {activeAlert.customerName} ({activeAlert.itemCount} items)
          </span>
          <span className="font-extrabold text-white text-sm">₹{activeAlert.totalAmount}</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-orange-200">Click banner to open in Kitchen Orders</span>
          <span className="text-xs font-bold text-white flex items-center gap-1 bg-white/25 px-2.5 py-1 rounded-full hover:bg-white/35 transition-colors">
            Open Orders <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
