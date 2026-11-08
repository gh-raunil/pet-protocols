"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  ShoppingBag,
  Clock,
  Phone,
  PhoneCall,
  MapPin,
  RefreshCw,
  ChefHat,
  Truck,
  XCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Bell,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Download,
  Search,
  FileSpreadsheet,
  ArrowRight,
  Radio,
  Printer,
  LayoutGrid,
  Check,
  Banknote,
  Zap,
  PackageCheck,
  Bike,
  UserCheck,
  X,
  SlidersHorizontal,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Layers,
} from "lucide-react";
import { playChime } from "@/lib/soundChimes";
import { formatOrderId } from "../dashboard/DashboardClient";
import { getOrderDistanceInfo } from "@/lib/geoDistance";
import OutOfRangeOrderModal from "@/components/orders/OutOfRangeOrderModal";
import LiveDeliveryMap from "@/components/orders/LiveDeliveryMap";
import Tooltip, { HelpTooltip } from "@/components/ui/Tooltip";

// Command Center Modular Components
import OrderCommandMetrics from "@/components/orders/OrderCommandMetrics";
import InlineDeliveryAssignModal from "@/components/orders/InlineDeliveryAssignModal";
import HandoverOtpModal from "@/components/orders/HandoverOtpModal";
import CancelOrderModal from "@/components/orders/CancelOrderModal";
import OrderDetailsDrawer from "@/components/orders/OrderDetailsDrawer";

const POLL_INTERVAL = 10000; // Poll every 10 seconds

export function checkIsPickup(order) {
  if (!order) return false;
  if (order.orderType === "pickup") return true;
  const method = String(order.paymentMethod || "").toLowerCase();
  const notes = String(order.notes || "").toLowerCase();
  const addressType = String(order.address?.addressType || "").toLowerCase();
  return (
    method.includes("pickup") ||
    method.includes("cop") ||
    notes.includes("[pickup]") ||
    addressType.includes("pickup")
  );
}

// Live elapsed kitchen timer helper with progressive urgency colors
export function getOrderElapsedInfo(createdAt, status, updatedAt) {
  if (status === "delivered") {
    let completionText = "Delivered";
    if (updatedAt && createdAt) {
      const totalMins = Math.max(1, Math.round((new Date(updatedAt) - new Date(createdAt)) / 60000));
      completionText = `Delivered (${totalMins}m)`;
    }
    return {
      text: `✓ ${completionText}`,
      color: "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800/80 dark:text-stone-300 dark:border-white/10 font-semibold",
      urgent: false,
    };
  }

  if (status === "cancelled") {
    return {
      text: "✕ Cancelled",
      color: "bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-900/60 dark:text-stone-400 dark:border-white/5",
      urgent: false,
    };
  }

  if (status === "ready") {
    return {
      text: "🍽️ Ready for Handoff",
      color: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500/30 font-semibold",
      urgent: false,
    };
  }

  if (status === "confirmed") {
    return {
      text: "✓ Confirmed",
      color: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-500/30 font-semibold",
      urgent: false,
    };
  }

  if (status === "out_for_delivery") {
    return {
      text: "🛵 Dispatched (On Delivery)",
      color: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-500/30 font-semibold",
      urgent: false,
    };
  }

  if (!createdAt) {
    return {
      text: "Just now",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/30",
      urgent: false,
    };
  }

  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const elapsedMins = Math.floor(elapsedMs / 60000);

  if (elapsedMins < 1) {
    return {
      text: "< 1m",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/30",
      urgent: false,
    };
  }

  if (elapsedMins < 10) {
    return {
      text: `${elapsedMins}m ago`,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/30 font-semibold",
      urgent: false,
    };
  }

  if (elapsedMins < 20) {
    return {
      text: `⚠️ ${elapsedMins}m ago`,
      color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-500/30 font-bold",
      urgent: false,
    };
  }

  return {
    text: `🚨 ${elapsedMins}m (Delayed)`,
    color: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-500/40 font-black animate-pulse",
    urgent: true,
  };
}

// Global Kitchen Order Ticket (KOT) standard thermal print slip
export function handlePrintKOT(order) {
  if (!order) return;
  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) return;

  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString();
  const customer = order.address?.fullName || order.user?.name || "Customer";
  const phone = order.address?.phone || order.user?.phone || "N/A";
  const address = order.address?.street ? `${order.address.street}, ${order.address.city || ""}` : "";
  const uniqueId = formatOrderId(order);
  const paymentMode = (order.paymentMethod || "").toLowerCase();
  const isCod = paymentMode.includes("cod") || paymentMode.includes("cash") || order.paymentStatus === "pending";

  const itemsHtml = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="font-weight: bold; width: 32px; vertical-align: top;">${item.quantity}×</td>
        <td style="vertical-align: top;">
          <strong>${item.name}</strong>
          ${item.variantName ? `<br><small style="color:#555;">[${item.variantName}]</small>` : ""}
          ${item.servingLabel ? `<br><small style="color:#555;">Portion: ${item.servingLabel}</small>` : ""}
        </td>
        <td style="text-align: right; vertical-align: top; font-family: monospace;">₹${(item.price || 0) * (item.quantity || 1)}</td>
      </tr>
    `
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>KOT - ${uniqueId}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 8px; color: #000; }
          .center { text-align: center; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .tag { display: inline-block; padding: 3px 8px; border: 2px solid #000; font-weight: bold; font-size: 15px; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2 style="margin: 0; font-size: 16px;">पेट Protocols</h2>
          <p style="margin: 1px 0; font-size: 10px; text-transform: uppercase;">Kitchen Order Ticket (KOT)</p>
          <div class="tag">${uniqueId}</div>
          <p style="margin: 1px 0; font-size: 10px;">${dateStr}</p>
        </div>
        <div class="divider"></div>
        <p style="margin: 2px 0;"><strong>Customer:</strong> ${customer}</p>
        <p style="margin: 2px 0;"><strong>Phone:</strong> ${phone}</p>
        ${address ? `<p style="margin: 2px 0; font-size: 10px;"><strong>Address:</strong> ${address}</p>` : ""}
        ${order.notes ? `<p style="margin: 4px 0; background: #e5e5e5; padding: 4px; border-left: 3px solid #000;"><strong>NOTE:</strong> ${order.notes}</p>` : ""}
        <div class="divider"></div>
        <table>
          <thead>
            <tr style="border-bottom: 1px solid #000; text-align: left; font-size: 11px;">
              <th>QTY</th>
              <th>ITEM</th>
              <th style="text-align: right;">AMT</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="divider"></div>
        <table style="font-weight: bold; font-size: 13px;">
          <tr><td>Total:</td><td style="text-align: right; font-size: 15px;">₹${order.totalAmount}</td></tr>
          <tr><td>Payment:</td><td style="text-align: right; font-size: 11px;">${isCod ? "COLLECT CASH (COD)" : "PAID ONLINE"}</td></tr>
        </table>
        <div class="divider"></div>
        <p class="center" style="font-size: 9px; margin-top: 8px;">• Check dish seals before dispatch •</p>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export default function OrdersClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isDeliveryOnlyStaff =
    session?.user?.role === "staff" &&
    Array.isArray(session?.user?.staffRoles) &&
    session.user.staffRoles.includes("Delivery") &&
    !session.user.staffRoles.includes("Kitchen") &&
    !session.user.staffRoles.includes("Manager");

  const isManagerOrAdmin =
    session?.user?.role === "lead_admin" ||
    session?.user?.role === "admin" ||
    session?.user?.role === "restaurant_admin" ||
    session?.user?.role === "superadmin" ||
    (session?.user?.role === "staff" &&
      Array.isArray(session?.user?.staffRoles) &&
      session.user.staffRoles.includes("Manager"));

  useEffect(() => {
    if (status === "loading") return;
    if (isDeliveryOnlyStaff) {
      router.replace("/delivery");
    }
  }, [isDeliveryOnlyStaff, status, router]);

  const todayStr = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurantCreatedAt, setRestaurantCreatedAt] = useState(null);
  const [currentRestaurant, setCurrentRestaurant] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [expandedMapOrderIds, setExpandedMapOrderIds] = useState(new Set());

  // Modal & Drawer States
  const [selectedDrawerOrder, setSelectedDrawerOrder] = useState(null);
  const [assignModalOrder, setAssignModalOrder] = useState(null);
  const [handoverOtpModalOrder, setHandoverOtpModalOrder] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [outOfRangePrompt, setOutOfRangePrompt] = useState(null);

  // Delivery fleet staff list
  const [deliveryStaffList, setDeliveryStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // OTP Verification Modal state
  const [handoverOtpSubmitting, setHandoverOtpSubmitting] = useState(false);
  const [handoverOtpError, setHandoverOtpError] = useState("");
  const [handoverAttemptsRemaining, setHandoverAttemptsRemaining] = useState(null);

  // Operational toggles
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState(new Set());
  const [rushMode, setRushMode] = useState(false);
  const [currentTimeTick, setCurrentTimeTick] = useState(0);
  const [kitchenActive, setKitchenActive] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("restaurant_kitchen_active") !== "false";
    }
    return true;
  });
  const [isUpdatingKitchen, setIsUpdatingKitchen] = useState(false);

  useEffect(() => {
    function handleKitchenChange(e) {
      if (e.detail && typeof e.detail.active === "boolean") {
        setTimeout(() => {
          setKitchenActive(e.detail.active);
        }, 0);
      }
    }
    function handleStorage(e) {
      if (e.key === "restaurant_kitchen_active") {
        setTimeout(() => {
          setKitchenActive(e.newValue !== "false");
        }, 0);
      }
    }
    window.addEventListener("pet_protocols_kitchen_active_changed", handleKitchenChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("pet_protocols_kitchen_active_changed", handleKitchenChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const resumeOrdersFromBanner = async () => {
    if (isUpdatingKitchen) return;
    setIsUpdatingKitchen(true);
    try {
      const res = await fetch("/api/restaurant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isOpen: true,
          acceptingOrders: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setKitchenActive(true);
        if (typeof window !== "undefined") {
          localStorage.setItem("restaurant_kitchen_active", "true");
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("pet_protocols_kitchen_active_changed", {
                detail: { active: true },
              })
            );
          }, 0);
        }
        toast.success("Accepting orders — storefront is now open.");
      } else {
        toast.error(data.message || "Failed to update restaurant status.");
      }
    } catch (err) {
      toast.error("Network error updating restaurant status.");
    } finally {
      setIsUpdatingKitchen(false);
    }
  };

  // Auto-Print KOT Preference
  const [autoPrintKot, setAutoPrintKot] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("restaurant_auto_print_kot") === "true";
    }
    return false;
  });

  const toggleAutoPrintKot = () => {
    const next = !autoPrintKot;
    setAutoPrintKot(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("restaurant_auto_print_kot", String(next));
    }
    toast.success(next ? "Auto-print KOT on order accept: ENABLED" : "Auto-print KOT: DISABLED");
  };

  // Timer ticker
  useEffect(() => {
    setCurrentTimeTick(Date.now());
    const timer = setInterval(() => setCurrentTimeTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const isFetchingRef = useRef(false);
  const knownOrderIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);

  // Load orders
  const fetchOrders = useCallback(
    async (isManual = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isManual) {
        setIsRefreshing(true);
      }

      try {
        const params = new URLSearchParams();
        // Only pass recognized backend statuses in query
        const backendStatuses = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];
        if (backendStatuses.includes(filterStatus)) {
          params.append("status", filterStatus);
        }
        if (selectedDate) params.append("date", selectedDate);
        if (searchQuery.trim()) params.append("search", searchQuery.trim());

        const res = await fetch(`/api/restaurant/orders?${params.toString()}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.orders)) {
          const incomingOrders = data.orders;
          if (data.restaurantCreatedAt) {
            setRestaurantCreatedAt(data.restaurantCreatedAt);
          }
          if (data.restaurant) {
            setCurrentRestaurant(data.restaurant);
          }

          if (isInitialLoadRef.current) {
            incomingOrders.forEach((o) => knownOrderIdsRef.current.add(o._id));
            isInitialLoadRef.current = false;
          } else {
            const newPendingOrders = incomingOrders.filter(
              (o) => o.status === "pending" && !knownOrderIdsRef.current.has(o._id)
            );

            if (newPendingOrders.length > 0) {
              if (soundEnabled) {
                playChime(null, 1.0);
              }

              const newest = newPendingOrders[0];
              const totalItems =
                newest.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 1;

              setNewOrderAlert({
                id: newest._id,
                orderId: formatOrderId(newest),
                customerName: newest.address?.fullName || "Customer",
                totalAmount: newest.totalAmount,
                itemCount: totalItems,
                count: newPendingOrders.length,
              });

              setHighlightedOrderIds((prev) => {
                const next = new Set(prev);
                newPendingOrders.forEach((o) => next.add(o._id));
                return next;
              });

              setTimeout(() => {
                setNewOrderAlert(null);
              }, 10000);

              newPendingOrders.forEach((o) => knownOrderIdsRef.current.add(o._id));
            }

            incomingOrders.forEach((o) => knownOrderIdsRef.current.add(o._id));
          }

          setOrders(incomingOrders);

          // Keep selected drawer order in sync if open
          setSelectedDrawerOrder((prev) => {
            if (!prev) return null;
            return incomingOrders.find((o) => o._id === prev._id) || prev;
          });

          // Sync pending count to local storage & header
          if (selectedDate === todayStr || !selectedDate || selectedDate === "all") {
            const activePendingCount = incomingOrders.filter((o) => o.status === "pending").length;
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("pet_protocols_pending_orders_count", String(activePendingCount));
              } catch (e) {}
              window.dispatchEvent(
                new CustomEvent("pet_protocols_unresponded_orders_count", {
                  detail: { count: activePendingCount },
                })
              );
            }
          }
        }
      } catch (err) {
        console.error("Order polling failed:", err);
        if (isManual) {
          toast.error("Failed to refresh orders.");
        }
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [filterStatus, selectedDate, searchQuery, soundEnabled, todayStr]
  );



  // Load delivery staff
  const fetchDeliveryStaff = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const res = await fetch("/api/restaurant/delivery-staff");
      const data = await res.json();
      if (data.success && Array.isArray(data.deliveryStaff)) {
        setDeliveryStaffList(data.deliveryStaff);
      } else {
        toast.error(data.message || "Failed to load delivery staff list.");
      }
    } catch (err) {
      console.error("Fetch delivery staff error:", err);
      toast.error("Network error fetching delivery personnel.");
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  // Polling loop
  useEffect(() => {
    if (!session?.user) return;
    setLoading(true);
    fetchOrders(false);
    fetchDeliveryStaff();

    const intervalId = setInterval(() => {
      fetchOrders(false);
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [session, fetchOrders, fetchDeliveryStaff]);

  // Deep Link Handling from Dashboard `?orderId=...`
  const deepLinkedOrderId = searchParams.get("orderId");
  useEffect(() => {
    if (!deepLinkedOrderId || orders.length === 0) return;
    const cleanTarget = deepLinkedOrderId.trim().toLowerCase().replace(/^#/, "").replace(/^pet-/i, "").replace(/^ord_/i, "");
    const found = orders.find((o) => {
      const oId = (o._id || "").toString().toLowerCase();
      const rawId = (o.orderId || "").toLowerCase();
      const formatted = formatOrderId(o).toLowerCase();
      return (
        oId === deepLinkedOrderId.toLowerCase() ||
        oId.includes(cleanTarget) ||
        rawId.includes(cleanTarget) ||
        formatted.includes(cleanTarget)
      );
    });

    if (found) {
      setSelectedDrawerOrder(found);
      setHighlightedOrderIds((prev) => new Set([...prev, found._id]));
      setTimeout(() => {
        const cardEl = document.getElementById(`order-card-${found._id}`);
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 200);
    }
  }, [deepLinkedOrderId, orders]);



  // Compute active order workload map for couriers from actual active orders
  const activeOrdersMap = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const driverId = o.assignedDeliveryStaff?.id;
      if (driverId && ["confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)) {
        map[driverId] = (map[driverId] || 0) + 1;
      }
    });
    return map;
  }, [orders]);

  // Compute Summary Metrics for Command Center
  const commandMetrics = useMemo(() => {
    let actionNeeded = 0;
    let preparing = 0;
    let ready = 0;
    let outForDelivery = 0;
    let deliveredToday = 0;

    orders.forEach((o) => {
      const isPickup = checkIsPickup(o);
      const isPending = o.status === "pending";
      const isReadyUnassigned = o.status === "ready" && !isPickup && !o.assignedDeliveryStaff?.id;
      const isDelayedPrep =
        o.status === "preparing" &&
        o.createdAt &&
        currentTimeTick - new Date(o.createdAt).getTime() > 20 * 60 * 1000;

      if (isPending || isReadyUnassigned || isDelayedPrep) {
        actionNeeded++;
      }

      if (o.status === "preparing") {
        preparing++;
      } else if (o.status === "ready") {
        ready++;
      } else if (o.status === "out_for_delivery") {
        outForDelivery++;
      } else if (o.status === "delivered") {
        deliveredToday++;
      }
    });

    return { actionNeeded, preparing, ready, outForDelivery, deliveredToday };
  }, [orders, currentTimeTick]);

  // Status updates
  async function handleUpdateStatus(orderId, nextStatus, extra = {}) {
    const targetOrder = orders.find((o) => o._id === orderId);
    const isPickup = targetOrder ? checkIsPickup(targetOrder) : false;

    // Enforce business rules:
    if (nextStatus === "out_for_delivery" && !isPickup) {
      if (targetOrder && targetOrder.status !== "ready") {
        toast.error("Order must be cooked and marked 'Ready for Handoff' before dispatching!");
        return;
      }
      if (!targetOrder?.assignedDeliveryStaff?.id) {
        toast.error("Please assign a delivery courier before dispatching!");
        handleOpenAssignModal(targetOrder);
        return;
      }
    }

    if (nextStatus === "delivered" && !isPickup) {
      setHandoverOtpError("");
      setHandoverAttemptsRemaining(null);
      setHandoverOtpModalOrder(targetOrder);
      return;
    }

    try {
      setUpdatingOrderId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus, ...extra }),
      });

      const data = await res.json();
      if (data.success) {
        const orderObj = orders.find((o) => o._id === orderId) || targetOrder;
        const wasPending = orderObj?.status === "pending";
        const displayId = formatOrderId(orderObj || { _id: orderId });

        toast.success(
          extra.acceptedOutOfRange
            ? `Out-of-range order ${displayId} ACCEPTED by Manager!`
            : `Order ${displayId} updated to ${nextStatus.toUpperCase()}`
        );

        if (autoPrintKot && wasPending && (nextStatus === "confirmed" || nextStatus === "preparing")) {
          handlePrintKOT(orderObj);
        }

        const updatedOrder = {
          ...orderObj,
          status: nextStatus,
          ...extra,
          updatedAt: new Date().toISOString(),
        };

        setOrders((prev) => prev.map((o) => (o._id === orderId ? updatedOrder : o)));

        if (selectedDrawerOrder?._id === orderId) {
          setSelectedDrawerOrder(updatedOrder);
        }

        setHighlightedOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });

        if (wasPending && nextStatus !== "pending" && typeof window !== "undefined") {
          const remainingPending = orders.filter(
            (o) => o._id !== orderId && o.status === "pending"
          ).length;

          try {
            localStorage.setItem("pet_protocols_pending_orders_count", String(remainingPending));
          } catch (e) {}

          window.dispatchEvent(
            new CustomEvent("pet_protocols_unresponded_orders_count", {
              detail: { count: remainingPending },
            })
          );
        }
      } else {
        toast.error(data.message || "Failed to update order status.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error updating order status.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function handleAcceptOrderWithRangeCheck(order) {
    const distInfo = getOrderDistanceInfo(order, currentRestaurant);
    const maxRange =
      order.restaurant?.deliverySettings?.deliveryRadiusKm ||
      currentRestaurant?.deliverySettings?.deliveryRadiusKm ||
      10;

    const effectiveDist = order.deliveryDistanceKm ?? distInfo?.distanceKm;
    const isOutOfRange =
      (order.isOutOfRange || (effectiveDist !== null && effectiveDist > maxRange)) &&
      !checkIsPickup(order);

    if (isOutOfRange && !order.acceptedOutOfRange) {
      setOutOfRangePrompt({
        order,
        distanceKm: effectiveDist || 10.1,
        maxRangeKm: maxRange,
      });
      return;
    }

    handleUpdateStatus(order._id, "preparing");
  }

  // Assign Driver Modal Handlers
  const handleOpenAssignModal = (order) => {
    setAssignModalOrder(order);
    fetchDeliveryStaff();
  };

  const handleConfirmAssignDriver = async (orderId, staffObj) => {
    try {
      setAssignSubmitting(true);
      const res = await fetch(`/api/restaurant/orders/${orderId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryStaffId: staffObj._id || staffObj.id }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        toast.success(`Order assigned to ${staffObj.name}! 🛵`);
        setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, ...data.order } : o)));
        if (selectedDrawerOrder?._id === orderId) {
          setSelectedDrawerOrder((prev) => ({ ...prev, ...data.order }));
        }
        setAssignModalOrder(null);
      } else {
        toast.error(data.message || "Failed to assign driver.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error assigning delivery driver.");
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleConfirmSelfDelivery = async (orderId) => {
    try {
      setAssignSubmitting(true);
      const res = await fetch(`/api/restaurant/orders/${orderId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfDelivery: true }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        toast.success("Self-delivery confirmed! 🚗");
        setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, ...data.order } : o)));
        if (selectedDrawerOrder?._id === orderId) {
          setSelectedDrawerOrder((prev) => ({ ...prev, ...data.order }));
        }
        setAssignModalOrder(null);
      } else {
        toast.error(data.message || "Failed to set self-delivery.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error selecting self-delivery.");
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Handover OTP Verification
  const handleVerifyHandoverOtp = async (orderId, otpCode) => {
    try {
      setHandoverOtpSubmitting(true);
      setHandoverOtpError("");
      const res = await fetch(`/api/restaurant/orders/${orderId}/verify-handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otpCode,
          notes: `Delivery completed by manager ${session?.user?.name || "Manager"}`,
        }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        toast.success("Delivery completed successfully! Handover verified. 🎉");
        setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, ...data.order, status: "delivered" } : o)));
        if (selectedDrawerOrder?._id === orderId) {
          setSelectedDrawerOrder((prev) => ({ ...prev, ...data.order, status: "delivered" }));
        }
        setHandoverOtpModalOrder(null);
      } else {
        setHandoverOtpError(data.message || "Failed to verify handover OTP.");
        if (typeof data.remainingAttempts === "number") {
          setHandoverAttemptsRemaining(data.remainingAttempts);
        }
      }
    } catch (err) {
      console.error(err);
      setHandoverOtpError("Network error verifying handover OTP.");
    } finally {
      setHandoverOtpSubmitting(false);
    }
  };

  // Cancel order handler
  const handleConfirmCancel = async (orderId, reason) => {
    await handleUpdateStatus(orderId, "cancelled", { cancellationReason: reason });
    setCancelModalOrder(null);
  };

  // Toggle Live Map
  const toggleLiveMap = (orderId) => {
    setExpandedMapOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  // COD Cash Settlement
  async function handleSettleCodCash(orderId) {
    if (!confirm("Confirm settling this COD cash collection with manager?")) return;
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "settle_cod_cash" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("COD Cash marked as settled with manager.");
        setOrders((prev) =>
          prev.map((o) =>
            o._id === orderId
              ? {
                  ...o,
                  codPaymentHandler: {
                    ...(o.codPaymentHandler || {}),
                    settledWithManager: true,
                    settledAt: new Date().toISOString(),
                  },
                }
              : o
          )
        );
      } else {
        toast.error(data.message || "Failed to settle cash.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error settling COD cash.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // Filtered orders list
  const displayedOrders = useMemo(() => {
    return orders.filter((order) => {
      const isPickup = checkIsPickup(order);
      const isCod =
        String(order.paymentMethod || "").toLowerCase().includes("cod") ||
        String(order.paymentMethod || "").toLowerCase().includes("cash") ||
        order.paymentStatus === "pending";

      // 1. Search Query Match
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase().replace(/^#/, "");
        const cleanQ = q.replace(/^pet-/i, "").replace(/^ord_/i, "");
        const formatted = formatOrderId(order).toLowerCase().replace(/^#/, "");
        const rawId = (order.orderId || "").toLowerCase();
        const mongoId = (order._id || "").toString().toLowerCase();
        const customer = (order.address?.fullName || order.user?.name || "").toLowerCase();
        const phone = (order.address?.phone || order.user?.phone || "").toLowerCase();
        const matchesSearch =
          formatted.includes(q) ||
          formatted.includes(cleanQ) ||
          rawId.includes(q) ||
          rawId.includes(cleanQ) ||
          mongoId.includes(q) ||
          mongoId.includes(cleanQ) ||
          customer.includes(q) ||
          phone.includes(q);

        if (!matchesSearch) return false;
      }

      // 2. Status / Category Filter
      if (filterStatus === "all") return true;

      if (filterStatus === "action_needed") {
        const isPending = order.status === "pending";
        const isReadyUnassigned = order.status === "ready" && !isPickup && !order.assignedDeliveryStaff?.id;
        const isDelayed =
          order.status === "preparing" &&
          order.createdAt &&
          currentTimeTick - new Date(order.createdAt).getTime() > 20 * 60 * 1000;
        return isPending || isReadyUnassigned || isDelayed;
      }

      if (filterStatus === "incoming") {
        return order.status === "pending";
      }

      if (filterStatus === "delivery") {
        return !isPickup && order.orderType !== "pickup";
      }

      if (filterStatus === "pickup") {
        return isPickup || order.orderType === "pickup";
      }

      if (filterStatus === "unassigned") {
        return !isPickup && !["delivered", "cancelled"].includes(order.status) && !order.assignedDeliveryStaff?.id;
      }

      if (filterStatus === "exceptions") {
        const isDelayed =
          order.status === "preparing" &&
          order.createdAt &&
          currentTimeTick - new Date(order.createdAt).getTime() > 25 * 60 * 1000;
        const isUnresponded =
          (order.status === "pending" || order.status === "confirmed") &&
          order.createdAt &&
          currentTimeTick - new Date(order.createdAt).getTime() > 15 * 60 * 1000;
        return order.status === "cancelled" || order.isOutOfRange || isDelayed || isUnresponded || (isCod && order.paymentStatus === "pending");
      }

      return order.status === filterStatus;
    });
  }, [orders, searchQuery, filterStatus, currentTimeTick]);

  // CSV Report Export
  function downloadOrdersReport() {
    const exportTarget = displayedOrders.length > 0 ? displayedOrders : orders;
    if (!exportTarget || exportTarget.length === 0) {
      toast.error("No orders to download for this selection.");
      return;
    }

    const headers = [
      "Order ID",
      "Date",
      "Time",
      "Customer Name",
      "Phone",
      "Fulfillment",
      "Dishes Summary",
      "Total Amount (INR)",
      "Status",
      "Payment Method",
      "Payment Status",
      "Driver Assigned",
    ];

    const rows = exportTarget.map((o) => {
      const orderDate = new Date(o.createdAt);
      const formattedDate = !isNaN(orderDate) ? orderDate.toISOString().split("T")[0] : "";
      const formattedTime = !isNaN(orderDate) ? orderDate.toLocaleTimeString() : "";
      const uniqueId = formatOrderId(o);
      const isPickup = checkIsPickup(o);
      const itemsSummary = (o.items || [])
        .map((it) => `${it.quantity || 1}x ${it.name || "Dish"}`)
        .join(" | ")
        .replace(/"/g, '""');
      const customerName = (o.address?.fullName || o.user?.name || "Customer").replace(/"/g, '""');
      const phone = (o.address?.phone || o.user?.phone || "").replace(/"/g, '""');
      const driver = (o.assignedDeliveryStaff?.name || "Unassigned").replace(/"/g, '""');

      return [
        `"${uniqueId}"`,
        `"${formattedDate}"`,
        `"${formattedTime}"`,
        `"${customerName}"`,
        `"${phone}"`,
        `"${isPickup ? "Pickup" : "Delivery"}"`,
        `"${itemsSummary}"`,
        o.totalAmount || 0,
        `"${o.status}"`,
        `"${o.paymentMethod || "COD"}"`,
        `"${o.paymentStatus || "paid"}"`,
        `"${driver}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pet_protocols_orders_${selectedDate || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Orders report exported!");
  }

  const isTodaySelected = selectedDate === todayStr;

  const minSelectableDate = useMemo(() => {
    if (restaurantCreatedAt) {
      try {
        return new Date(restaurantCreatedAt).toISOString().split("T")[0];
      } catch (e) {}
    }
    return "2024-01-01";
  }, [restaurantCreatedAt]);

  const countsByTab = useMemo(() => {
    const counts = {
      all: orders.length,
      action_needed: 0,
      incoming: 0,
      delivery: 0,
      pickup: 0,
      unassigned: 0,
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
      exceptions: 0,
    };

    orders.forEach((order) => {
      const isPickup = checkIsPickup(order);
      const isCod =
        String(order.paymentMethod || "").toLowerCase().includes("cod") ||
        String(order.paymentMethod || "").toLowerCase().includes("cash") ||
        order.paymentStatus === "pending";

      if (isPickup) counts.pickup++;
      else counts.delivery++;

      if (order.status in counts) {
        counts[order.status]++;
      }

      if (order.status === "pending") {
        counts.incoming++;
      }

      const isReadyUnassigned = order.status === "ready" && !isPickup && !order.assignedDeliveryStaff?.id;
      const isDelayed =
        order.status === "preparing" &&
        order.createdAt &&
        currentTimeTick - new Date(order.createdAt).getTime() > 20 * 60 * 1000;

      if (order.status === "pending" || isReadyUnassigned || isDelayed) {
        counts.action_needed++;
      }

      if (!isPickup && !["delivered", "cancelled"].includes(order.status) && !order.assignedDeliveryStaff?.id) {
        counts.unassigned++;
      }

      const isOrderDelayed =
        order.status === "preparing" &&
        order.createdAt &&
        currentTimeTick - new Date(order.createdAt).getTime() > 25 * 60 * 1000;
      const isUnresponded =
        (order.status === "pending" || order.status === "confirmed") &&
        order.createdAt &&
        currentTimeTick - new Date(order.createdAt).getTime() > 15 * 60 * 1000;

      if (order.status === "cancelled" || order.isOutOfRange || isOrderDelayed || isUnresponded || (isCod && order.paymentStatus === "pending")) {
        counts.exceptions++;
      }
    });

    return counts;
  }, [orders, currentTimeTick]);

  const filterTabs = [
    { id: "all", label: "All Orders", count: countsByTab.all },
    {
      id: "action_needed",
      label: "⚡ Action Needed",
      badgeCount: countsByTab.action_needed,
      count: countsByTab.action_needed,
    },
    {
      id: "incoming",
      label: "🛎️ Incoming New",
      badgeCount: countsByTab.incoming,
      count: countsByTab.incoming,
    },
    { id: "delivery", label: "🛵 Delivery", count: countsByTab.delivery },
    { id: "pickup", label: "🛍️ Pickup", count: countsByTab.pickup },
    {
      id: "unassigned",
      label: "⚠️ Needs Courier",
      badgeCount: countsByTab.unassigned,
      count: countsByTab.unassigned,
    },
    { id: "pending", label: "Pending", count: countsByTab.pending },
    { id: "confirmed", label: "Confirmed", count: countsByTab.confirmed },
    { id: "preparing", label: "In Kitchen", count: countsByTab.preparing },
    { id: "ready", label: "Ready", count: countsByTab.ready },
    { id: "out_for_delivery", label: "On Road", count: countsByTab.out_for_delivery },
    { id: "delivered", label: "Delivered", count: countsByTab.delivered },
    { id: "cancelled", label: "Cancelled", count: countsByTab.cancelled },
    { id: "exceptions", label: "⚠️ Exceptions", badgeCount: countsByTab.exceptions, count: countsByTab.exceptions },
  ];

  return (
    <div className="min-h-screen bg-transparent text-stone-900 dark:text-white font-jakarta transition-colors relative pb-16">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 min-w-0">
        
        {/* Sticky Kitchen Paused Alert */}
        {!kitchenActive && (
          <div className="bg-rose-500/15 border border-rose-500/30 rounded-2xl p-4 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <h4 className="font-extrabold text-sm text-rose-900 dark:text-rose-100">
                  Kitchen is currently PAUSED
                </h4>
                <p className="text-xs text-rose-700/90 dark:text-rose-300">
                  Your storefront is temporarily not accepting incoming customer orders.
                </p>
              </div>
            </div>
            <button
              onClick={resumeOrdersFromBanner}
              disabled={isUpdatingKitchen}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
            >
              Resume Orders Now
            </button>
          </div>
        )}

        {/* ── HEADER & OPERATION CONTROLS ───────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
                Order <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">Command Center</span>
              </h1>
              
              <div
                className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-xs"
                title="Live connection active: Orders sync in real-time"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="tracking-wide text-[11px]">Live Sync Active</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
              Unified kitchen operations, driver assignment, real-time dispatch and delivery monitoring.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Auto Print KOT Toggle */}
            <Tooltip content="Automatically trigger KOT printer window when accepting an order" placement="bottom">
              <button
                type="button"
                onClick={toggleAutoPrintKot}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
                  autoPrintKot
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                    : "bg-white dark:bg-white/5 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/10"
                }`}
              >
                <Printer size={13} className={autoPrintKot ? "text-orange-500" : "text-stone-400"} />
                <span>{autoPrintKot ? "Auto-KOT: ON" : "Auto-KOT"}</span>
              </button>
            </Tooltip>

            {/* Rush Mode Toggle */}
            <Tooltip content="Toggle compact ticket grid for high-volume rush hours" placement="bottom">
              <button
                type="button"
                onClick={() => setRushMode(!rushMode)}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
                  rushMode
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                    : "bg-white dark:bg-white/5 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/10"
                }`}
              >
                <LayoutGrid size={13} className={rushMode ? "text-amber-600 dark:text-amber-400" : "text-stone-400"} />
                <span>{rushMode ? "Rush Mode ON" : "Rush Mode"}</span>
              </button>
            </Tooltip>

            {/* Chime toggle */}
            <Tooltip content={soundEnabled ? "Audio chime on incoming orders • Click to mute" : "Chime muted • Click to enable"} placement="bottom">
              <button
                type="button"
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  if (!soundEnabled) playChime(null, 1.0);
                }}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
                  soundEnabled
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-white dark:bg-white/5 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/10"
                }`}
              >
                {soundEnabled ? <Volume2 size={13} className="text-emerald-600" /> : <VolumeX size={13} className="text-stone-400" />}
                <span>{soundEnabled ? "Chime On" : "Muted"}</span>
              </button>
            </Tooltip>

            {/* Export CSV */}
            <Tooltip content="Export active queue to CSV spreadsheet" placement="bottom">
              <button
                type="button"
                onClick={downloadOrdersReport}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                <span>Export CSV</span>
              </button>
            </Tooltip>

            {/* Manual Refresh */}
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => fetchOrders(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin text-orange-500" : "text-stone-500"} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── METRICS SUMMARY CARDS ─────────────────────────────────── */}
        <OrderCommandMetrics
          metrics={commandMetrics}
          activeFilter={filterStatus}
          onSelectFilter={setFilterStatus}
        />

        {/* ── SEARCH & FILTER CONTROLS BAR ─────────────────────────── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-stone-100/90 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 shrink-0">
            <input
              type="date"
              value={selectedDate === "all" ? "" : selectedDate}
              min={minSelectableDate}
              max={todayStr}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                }
              }}
              className="px-2.5 py-1 text-xs font-bold rounded-xl bg-white dark:bg-stone-800 text-stone-900 dark:text-white border border-stone-200/60 dark:border-white/10 outline-hidden"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                isTodaySelected
                  ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate("all")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedDate === "all"
                  ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-xs"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
              }`}
            >
              All Dates
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID (#PET-...), Customer, or Phone..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-2xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-white/10 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-stone-900 dark:text-white outline-hidden transition shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ── FILTER CHIPS SCROLLBAR ───────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto subtle-scrollbar pb-1 w-full min-w-0">
          {filterTabs.map((tab) => {
            const isSelected = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-xs"
                    : "bg-white/90 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/80 dark:border-white/10 hover:bg-stone-100/60 dark:hover:bg-white/10"
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badgeCount === "number" && tab.badgeCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    {tab.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── NEW ORDER BANNER ALERT ─────────────────────────────────── */}
        {newOrderAlert && (
          <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 rounded-2xl p-4 text-white shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl shrink-0">
                🛎️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded text-orange-200">
                    New Order Received!
                  </span>
                  <span className="font-mono font-bold text-xs">
                    {newOrderAlert.orderId}
                  </span>
                </div>
                <p className="text-xs text-orange-100 font-medium mt-0.5">
                  {newOrderAlert.customerName} ordered {newOrderAlert.itemCount} dish(es) •{" "}
                  <span className="font-bold text-white">₹{newOrderAlert.totalAmount}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setNewOrderAlert(null)}
              className="text-xs bg-black/30 hover:bg-black/40 text-white px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer"
            >
              Acknowledge ✓
            </button>
          </div>
        )}

        {/* ── ORDERS QUEUE ─────────────────────────────────────────── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-orange-500">
            <RefreshCw className="animate-spin w-8 h-8" />
            <p className="text-xs text-stone-500 font-semibold">Loading orders queue...</p>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl bg-white/50 dark:bg-[#10141f]/50 p-8">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-stone-400" />
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              {searchQuery
                ? "No matching orders found"
                : isTodaySelected
                ? "No orders found in this view"
                : `No orders found for ${selectedDate}`}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "Try searching by another Order ID, customer name or phone number."
                : "Incoming customer orders will appear here in real-time."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedOrders.map((order) => {
              const uniqueId = formatOrderId(order);
              const isNewlyArrived = highlightedOrderIds.has(order._id);
              const elapsedInfo = getOrderElapsedInfo(order.createdAt, order.status, order.updatedAt);
              const isPickup = checkIsPickup(order);
              const isCod =
                String(order.paymentMethod || "").toLowerCase().includes("cod") ||
                String(order.paymentMethod || "").toLowerCase().includes("cash") ||
                order.paymentStatus === "pending";

              const totalItems =
                order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;

              const isUpdating = updatingOrderId === order._id;

              return (
                <div
                  key={order._id}
                  id={`order-card-${order._id}`}
                  className={`bg-white dark:bg-stone-900/90 rounded-3xl p-5 border transition-all duration-200 shadow-xs hover:shadow-md ${
                    isNewlyArrived
                      ? "border-orange-500 ring-2 ring-orange-500/20"
                      : "border-stone-200/80 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20"
                  }`}
                >
                  {/* Card Top: Header / Status / Timer / Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-white/5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-black text-sm text-stone-900 dark:text-white bg-stone-100 dark:bg-white/10 px-2.5 py-1 rounded-xl">
                        {uniqueId}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                          isPickup
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25"
                        }`}
                      >
                        {isPickup ? "🛍️ Counter Pickup" : "🛵 Delivery"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${elapsedInfo.color}`}
                      >
                        <Clock size={10} />
                        <span>{elapsedInfo.text}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="font-mono font-black text-base text-stone-900 dark:text-white">
                          ₹{order.totalAmount}
                        </span>
                        <span
                          className={`ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            isCod
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {isCod ? "COD" : "Paid"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Middle: Customer, Address, Courier Status, Items */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                    {/* Customer & Address */}
                    <div className="space-y-1.5 text-xs">
                      <div className="font-bold text-stone-900 dark:text-white flex items-center justify-between">
                        <span>{order.address?.fullName || order.user?.name || "Customer"}</span>
                        {order.address?.phone && (
                          <a
                            href={`tel:${order.address.phone}`}
                            className="text-orange-600 dark:text-orange-400 hover:underline font-mono"
                          >
                            {order.address.phone}
                          </a>
                        )}
                      </div>
                      {!isPickup && (
                        <div className="text-stone-500 dark:text-stone-400 flex items-start gap-1">
                          <MapPin size={13} className="text-stone-400 shrink-0 mt-0.5" />
                          <span className="truncate">
                            {order.address?.street
                              ? `${order.address.street}, ${order.address.city || ""}`
                              : "Address on file"}
                          </span>
                        </div>
                      )}
                      {order.notes && (
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[11px] font-medium border border-amber-500/20 truncate">
                          Note: {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Delivery Partner Status */}
                    <div className="text-xs space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        Fulfillment &amp; Courier
                      </span>
                      {isPickup ? (
                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-bold flex items-center gap-1.5">
                          <span>🛍️</span>
                          <span>Counter Pickup by Customer</span>
                        </div>
                      ) : order.assignedDeliveryStaff?.id ? (
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0">🛵</span>
                            <div className="truncate">
                              <span className="font-bold">{order.assignedDeliveryStaff.name}</span>
                              {order.assignedDeliveryStaff.phone && (
                                <span className="font-mono text-[11px] text-blue-500 block truncate">
                                  {order.assignedDeliveryStaff.phone}
                                </span>
                              )}
                            </div>
                          </div>
                          {order.status !== "delivered" && order.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(order)}
                              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer"
                            >
                              Change
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center justify-between gap-2">
                          <span className="font-bold flex items-center gap-1">
                            <AlertCircle size={13} />
                            <span>Unassigned Driver</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(order)}
                            className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] transition cursor-pointer"
                          >
                            Assign Driver
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Items Summary Preview */}
                    <div className="text-xs space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                        Dishes ({totalItems})
                      </span>
                      <div className="max-h-16 overflow-y-auto space-y-1 pr-1 subtle-scrollbar">
                        {order.items?.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-stone-700 dark:text-stone-300">
                            <span className="truncate">
                              {it.quantity}× {it.name}
                            </span>
                            <span className="font-mono shrink-0 ml-1">
                              ₹{(it.price || 0) * (it.quantity || 1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live Map Drawer if expanded */}
                  {expandedMapOrderIds.has(order._id) && !isPickup && (
                    <div className="my-3 rounded-2xl overflow-hidden border border-stone-200 dark:border-white/10 shadow-inner">
                      <LiveDeliveryMap order={order} />
                    </div>
                  )}

                  {/* Card Bottom: Contextual Action Buttons */}
                  <div className="pt-3.5 border-t border-stone-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2.5">
                    {/* Secondary Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintKOT(order)}
                        title="Print Kitchen Ticket (KOT)"
                        className="p-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <Printer size={13} />
                        <span className="hidden sm:inline">KOT</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDrawerOrder(order)}
                        className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <span>Details</span>
                        <ChevronRight size={13} />
                      </button>

                      {!isPickup && ["out_for_delivery", "delivered"].includes(order.status) && (
                        <button
                          type="button"
                          onClick={() => toggleLiveMap(order._id)}
                          className="px-3 py-2 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <MapPin size={13} />
                          <span>{expandedMapOrderIds.has(order._id) ? "Hide Map" : "GPS Route"}</span>
                        </button>
                      )}

                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() => setCancelModalOrder(order)}
                          className="px-3 py-2 rounded-xl border border-rose-300/80 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold transition cursor-pointer"
                        >
                          {order.status === "pending" ? "Reject" : "Cancel"}
                        </button>
                      )}
                    </div>

                    {/* Primary Lifecycle Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.status === "pending" && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleAcceptOrderWithRangeCheck(order)}
                          className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          <span>Accept &amp; Cook</span>
                        </button>
                      )}

                      {order.status === "confirmed" && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order._id, "preparing")}
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <ChefHat size={14} />
                          <span>Start Cooking</span>
                        </button>
                      )}

                      {order.status === "preparing" && (
                        isPickup ? (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(order._id, "ready")}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <PackageCheck size={14} />
                            <span>Mark Ready for Pickup</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(order._id, "ready")}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <PackageCheck size={14} />
                            <span>Mark Cooked &amp; Ready</span>
                          </button>
                        )
                      )}

                      {order.status === "ready" && (
                        isPickup ? (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(order._id, "delivered")}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            <span>Confirm Counter Handover</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              if (!order.assignedDeliveryStaff?.id) {
                                toast.error("Please assign a delivery courier before dispatching!");
                                handleOpenAssignModal(order);
                              } else {
                                handleUpdateStatus(order._id, "out_for_delivery");
                              }
                            }}
                            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Truck size={14} />
                            <span>Dispatch for Delivery</span>
                          </button>
                        )
                      )}

                      {order.status === "out_for_delivery" && !isPickup && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => {
                            setHandoverOtpError("");
                            setHandoverAttemptsRemaining(null);
                            setHandoverOtpModalOrder(order);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-extrabold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          <span>Verify Handover OTP</span>
                        </button>
                      )}

                      {order.status === "delivered" && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-xs font-bold">
                            <CheckCircle2 size={14} /> Delivered
                          </span>
                          {isCod && order.codPaymentHandler?.collected && !order.codPaymentHandler?.settledWithManager && (
                            <button
                              type="button"
                              onClick={() => handleSettleCodCash(order._id)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition cursor-pointer"
                            >
                              Settle COD Cash
                            </button>
                          )}
                        </div>
                      )}

                      {order.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 text-xs font-bold">
                          <XCircle size={14} /> Cancelled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODALS & SLIDE-OVER DRAWERS ───────────────────────────── */}

      {/* 1. Contextual Order Details Drawer */}
      <OrderDetailsDrawer
        isOpen={Boolean(selectedDrawerOrder)}
        order={selectedDrawerOrder}
        onClose={() => setSelectedDrawerOrder(null)}
        onUpdateStatus={handleUpdateStatus}
        onOpenAssign={handleOpenAssignModal}
        onOpenHandoverOtp={(ord) => {
          setHandoverOtpError("");
          setHandoverAttemptsRemaining(null);
          setHandoverOtpModalOrder(ord);
        }}
        onOpenCancel={(ord) => setCancelModalOrder(ord)}
        onPrintKot={handlePrintKOT}
        updatingOrderId={updatingOrderId}
      />

      {/* 2. Inline Delivery Assignment Drawer / Modal */}
      <InlineDeliveryAssignModal
        isOpen={Boolean(assignModalOrder)}
        order={assignModalOrder}
        deliveryStaff={deliveryStaffList}
        loadingStaff={loadingStaff}
        activeOrdersMap={activeOrdersMap}
        isManager={isManagerOrAdmin}
        onAssign={handleConfirmAssignDriver}
        onSelfDelivery={handleConfirmSelfDelivery}
        onClose={() => setAssignModalOrder(null)}
        submitting={assignSubmitting}
      />

      {/* 3. Secure Handover OTP Verification Modal */}
      <HandoverOtpModal
        isOpen={Boolean(handoverOtpModalOrder)}
        order={handoverOtpModalOrder}
        onVerify={handleVerifyHandoverOtp}
        onClose={() => setHandoverOtpModalOrder(null)}
        submitting={handoverOtpSubmitting}
        error={handoverOtpError}
        remainingAttempts={handoverAttemptsRemaining}
      />

      {/* 4. Cancellation & Rejection Reason Modal */}
      <CancelOrderModal
        isOpen={Boolean(cancelModalOrder)}
        order={cancelModalOrder}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelModalOrder(null)}
        submitting={updatingOrderId === cancelModalOrder?._id}
      />

      {/* 5. Out-of-Range Order Manager Confirmation Dialog */}
      {outOfRangePrompt && (
        <OutOfRangeOrderModal
          isOpen={Boolean(outOfRangePrompt)}
          order={outOfRangePrompt.order}
          distanceKm={outOfRangePrompt.distanceKm}
          maxRangeKm={outOfRangePrompt.maxRangeKm}
          updating={updatingOrderId === outOfRangePrompt.order._id}
          onAccept={() => {
            handleUpdateStatus(outOfRangePrompt.order._id, "preparing", {
              acceptedOutOfRange: true,
              deliveryDistanceKm: outOfRangePrompt.distanceKm,
            });
            setOutOfRangePrompt(null);
          }}
          onReject={() => {
            handleUpdateStatus(outOfRangePrompt.order._id, "cancelled", {
              cancellationReason: `Rejected by manager: Out of delivery range (${outOfRangePrompt.distanceKm} km > ${outOfRangePrompt.maxRangeKm} km limit)`,
            });
            setOutOfRangePrompt(null);
          }}
          onClose={() => setOutOfRangePrompt(null)}
        />
      )}
    </div>
  );
}
