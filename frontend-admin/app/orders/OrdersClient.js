"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Clock,
  Phone,
  MapPin,
  CheckCircle,
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
} from "lucide-react";
import { playChime } from "@/lib/soundChimes";
import { formatOrderId } from "../dashboard/DashboardClient";
import { getOrderDistanceInfo } from "@/lib/geoDistance";
import OutOfRangeOrderModal from "@/components/orders/OutOfRangeOrderModal";
import LiveDeliveryMap from "@/components/orders/LiveDeliveryMap";
import Tooltip, { HelpTooltip } from "@/components/ui/Tooltip";

const POLL_INTERVAL = 10000; // Poll every 10 seconds

export function checkIsPickup(order) {
  if (!order) return false;
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
  // If order is delivered, stop timer and show completion badge
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

  // If order is cancelled, stop timer and show cancelled badge
  if (status === "cancelled") {
    return {
      text: "✕ Cancelled",
      color: "bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-900/60 dark:text-stone-400 dark:border-white/5",
      urgent: false,
    };
  }

  // If order is ready for pickup/handoff
  if (status === "ready") {
    return {
      text: "🍽️ Ready for Handoff",
      color: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500/30 font-semibold",
      urgent: false,
    };
  }

  // If order is confirmed
  if (status === "confirmed") {
    return {
      text: "✓ Confirmed",
      color: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-500/30 font-semibold",
      urgent: false,
    };
  }

  // If order is out for delivery, show in-transit badge
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
  const elapsedMins = Math.max(0, Math.floor(elapsedMs / (1000 * 60)));
  if (elapsedMins < 1) {
    return {
      text: "Just now",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/30",
      urgent: false,
    };
  }
  if (elapsedMins < 10) {
    return {
      text: `${elapsedMins}m ago • On track`,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/30",
      urgent: false,
    };
  }
  if (elapsedMins < 20) {
    return {
      text: `${elapsedMins}m ago • Cooking`,
      color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-500/30",
      urgent: false,
    };
  }
  return {
    text: `🚨 ${elapsedMins}m ago • Delayed!`,
    color: "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-500/40 animate-pulse font-black",
    urgent: true,
  };
}

// 80mm Kitchen Order Ticket (KOT) Thermal Receipt Printer
export function handlePrintKOT(order) {
  const uniqueId = formatOrderId(order);
  const dateStr = new Date(order.createdAt).toLocaleString();
  const customer = order.address?.fullName || order.user?.name || "Customer";
  const phone = order.address?.phone || "N/A";
  const address = `${order.address?.street || ""}, ${order.address?.city || ""}`.trim();
  const paymentMode = order.paymentMethod || (order.paymentStatus === "pending" ? "Cash on Delivery (COD)" : "Paid Online");
  const isCod = paymentMode.toLowerCase().includes("cod") || paymentMode.toLowerCase().includes("cash") || order.paymentStatus === "pending";

  const itemsHtml = (order.items || []).map((it) => `
    <tr style="border-bottom: 1px dashed #bbb;">
      <td style="padding: 5px 0; font-weight: bold; font-size: 13px;">${it.quantity}x</td>
      <td style="padding: 5px 4px; font-size: 13px;">${it.name}</td>
      <td style="padding: 5px 0; text-align: right; font-size: 13px;">₹${(it.price || 0) * (it.quantity || 1)}</td>
    </tr>
  `).join("");

  const printWindow = window.open("", "_blank", "width=380,height=600");
  if (!printWindow) {
    alert("Please allow popups in your browser to print Kitchen Order Tickets.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>KOT - ${uniqueId}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body { font-family: monospace, -apple-system, sans-serif; width: 72mm; margin: 0 auto; color: #000; font-size: 12px; line-height: 1.3; }
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
        <p class="center" style="font-size: 9px; margin-top: 8px;">• Check all dish seals before dispatch •</p>
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

  const isDeliveryOnlyStaff =
    session?.user?.role === "staff" &&
    Array.isArray(session?.user?.staffRoles) &&
    session.user.staffRoles.includes("Delivery") &&
    !session.user.staffRoles.includes("Kitchen") &&
    !session.user.staffRoles.includes("Manager");

  const isManagerOrAdmin =
    session?.user?.role === "lead_admin" ||
    session?.user?.role === "admin" ||
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
  const [selectedDate, setSelectedDate] = useState(todayStr); // Default to current date
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurantCreatedAt, setRestaurantCreatedAt] = useState(null);
  const [currentRestaurant, setCurrentRestaurant] = useState(null);
  const [outOfRangePrompt, setOutOfRangePrompt] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [expandedMapOrderIds, setExpandedMapOrderIds] = useState(new Set());

  const toggleLiveMap = (orderId) => {
    setExpandedMapOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Kitchen Alert, Audio & Operational States
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

  // Ticking timer clock every 30 seconds for live order urgency badges
  useEffect(() => {
    setCurrentTimeTick(Date.now());
    const timer = setInterval(() => setCurrentTimeTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Refs for polling and concurrency management
  const isFetchingRef = useRef(false);
  const knownOrderIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/orders");
    }
  }, [status, router]);

  // Load orders from backend
  const fetchOrders = useCallback(
    async (isManual = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isManual) {
        setIsRefreshing(true);
      }

      try {
        const params = new URLSearchParams();
        if (filterStatus && filterStatus !== "all") params.append("status", filterStatus);
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
            // Check for new pending orders
            const newPendingOrders = incomingOrders.filter(
              (o) => o.status === "pending" && !knownOrderIdsRef.current.has(o._id)
            );

            if (newPendingOrders.length > 0) {
              // Sound alert
              if (soundEnabled) {
                playChime(null, 1.0);
              }

              const newest = newPendingOrders[0];
              const totalItems = newest.items?.reduce(
                (sum, it) => sum + (it.quantity || 1),
                0
              ) || 1;

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
        }
      } catch (err) {
        console.error("Order polling failed:", err);
        if (isManual) {
          setFeedback({ type: "error", message: "Failed to load orders." });
        }
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [filterStatus, selectedDate, searchQuery, soundEnabled]
  );

  // Initial load and periodic polling interval
  useEffect(() => {
    if (!session?.user) return;

    setLoading(true);
    fetchOrders(false);

    const intervalId = setInterval(() => {
      fetchOrders(false);
    }, POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [session, filterStatus, selectedDate, fetchOrders]);

  async function handleUpdateStatus(orderId, nextStatus, extra = {}) {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus, ...extra }),
      });

      const data = await res.json();
      if (data.success) {
        const orderObj = orders.find((o) => o._id === orderId);
        const wasPending = orderObj?.status === "pending";
        const displayId = formatOrderId(orderObj || { _id: orderId });
        setFeedback({
          type: "success",
          message: extra.acceptedOutOfRange
            ? `Out-of-range order ${displayId} (${extra.deliveryDistanceKm} km) ACCEPTED by Manager!`
            : `Order ${displayId} updated to ${nextStatus.toUpperCase()}`,
        });
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, status: nextStatus, ...extra, updatedAt: new Date().toISOString() } : o))
        );
        setHighlightedOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });

        // If a pending order was responded to, immediately broadcast reduced count & sync
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
          window.dispatchEvent(
            new CustomEvent("pet_protocols_order_responded", {
              detail: { orderId, nextStatus },
            })
          );
        }
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to update order status." });
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
        setFeedback({ type: "success", message: "COD Cash marked as settled with manager." });
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
        setFeedback({ type: "error", message: data.message || "Failed to settle cash." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Network error settling COD cash." });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // Filter orders client-side for instantaneous feedback across orderId, #PET-xxx, mongo _id, customer name & phone
  const displayedOrders = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return orders;
    const q = searchQuery.trim().toLowerCase().replace(/^#/, "");
    const cleanQ = q.replace(/^pet-/i, "").replace(/^ord_/i, "");
    return orders.filter((order) => {
      const formatted = formatOrderId(order).toLowerCase().replace(/^#/, "");
      const rawId = (order.orderId || "").toLowerCase();
      const mongoId = (order._id || "").toString().toLowerCase();
      const customer = (order.address?.fullName || order.user?.name || "").toLowerCase();
      const phone = (order.address?.phone || order.user?.phone || "").toLowerCase();
      return (
        formatted.includes(q) ||
        formatted.includes(cleanQ) ||
        rawId.includes(q) ||
        rawId.includes(cleanQ) ||
        mongoId.includes(q) ||
        mongoId.includes(cleanQ) ||
        customer.includes(q) ||
        phone.includes(q)
      );
    });
  }, [orders, searchQuery]);

  function handleSearch(e) {
    if (e) e.preventDefault();
    fetchOrders(true);
  }

  // Export orders to CSV using Blob with BOM (prevents truncation on # fragments and supports Excel)
  function downloadOrdersReport() {
    const exportTarget = displayedOrders.length > 0 ? displayedOrders : orders;
    if (!exportTarget || exportTarget.length === 0) {
      alert("No orders to download for this selection.");
      return;
    }

    const headers = [
      "Order ID",
      "Date",
      "Time",
      "Customer Name",
      "Phone",
      "Items Count",
      "Dishes Summary",
      "Total Amount (INR)",
      "Status",
      "Payment Status",
      "Delivery Address",
    ];

    const rows = exportTarget.map((o) => {
      const orderDate = new Date(o.createdAt);
      const formattedDate = !isNaN(orderDate) ? orderDate.toISOString().split("T")[0] : "";
      const formattedTime = !isNaN(orderDate) ? orderDate.toLocaleTimeString() : "";
      const uniqueId = formatOrderId(o);
      const itemsCount = o.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0;
      const itemsSummary = (o.items || [])
        .map((it) => `${it.quantity || 1}x ${it.name || "Dish"}`)
        .join(" | ")
        .replace(/"/g, '""');
      const address = `${o.address?.street || ""}, ${o.address?.city || ""}`.replace(/"/g, '""');
      const customerName = (o.address?.fullName || o.user?.name || "Customer").replace(/"/g, '""');
      const phone = (o.address?.phone || o.user?.phone || "").replace(/"/g, '""');

      return [
        `"${uniqueId}"`,
        `"${formattedDate}"`,
        `"${formattedTime}"`,
        `"${customerName}"`,
        `"${phone}"`,
        itemsCount,
        `"${itemsSummary}"`,
        o.totalAmount || 0,
        `"${o.status}"`,
        `"${o.paymentStatus || "paid"}"`,
        `"${address}"`,
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
  }

  // Min selectable date: restaurant createdAt date
  const minSelectableDate = useMemo(() => {
    if (restaurantCreatedAt) {
      try {
        return new Date(restaurantCreatedAt).toISOString().split("T")[0];
      } catch (e) {}
    }
    return "2024-01-01";
  }, [restaurantCreatedAt]);

  const isTodaySelected = selectedDate === todayStr;

  const statusTabs = [
    { id: "all", label: "All Orders" },
    { id: "pending", label: "Pending" },
    { id: "confirmed", label: "Confirmed" },
    { id: "preparing", label: "Preparing" },
    { id: "ready", label: "Ready" },
    { id: "out_for_delivery", label: "Out for Delivery" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const statusBadgeStyles = {
    pending:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    confirmed:
      "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30",
    preparing:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
    ready:
      "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30",
    out_for_delivery:
      "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30",
    delivered:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
    cancelled:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  };

  if (isDeliveryOnlyStaff) {
    return (
      <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] flex items-center justify-center p-6 text-center font-jakarta">
        <div className="max-w-md bg-white dark:bg-[#10141f] p-8 rounded-3xl border border-stone-200 dark:border-white/10 shadow-xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Truck size={28} />
          </div>
          <h2 className="text-xl font-extrabold text-stone-900 dark:text-white">Delivery Operations Workspace</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Delivery staff are assigned to the <strong>Delivery Operations</strong> portal to pick up packages, share live GPS transit, and collect cash at doorstep. Redirecting you now...
          </p>
          <button
            onClick={() => router.replace("/delivery")}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Go to Delivery Portal Now →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-stone-900 dark:text-white font-jakarta transition-colors relative">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 min-w-0">
        
        {/* ── STICKY KITCHEN PAUSED WARNING BANNER ─────────────────── */}
        {!kitchenActive && (
          <div className="bg-rose-500/15 border border-rose-500/30 rounded-2xl p-4 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm animate-in fade-in">
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
              onClick={() => {
                setKitchenActive(true);
                if (typeof window !== "undefined") {
                  localStorage.setItem("restaurant_kitchen_active", "true");
                }
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition active:scale-95 shrink-0 cursor-pointer"
            >
              Resume Orders Now
            </button>
          </div>
        )}

        {/* ── HEADER & LIVE STATUS CHIP ───────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
                Kitchen Display <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">System</span>
              </h1>
              
              {/* Professional Live Status Indicator */}
              <div
                className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-xs"
                title="Live connection active: Kitchen orders poll every 10 seconds automatically"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="tracking-wide text-[11px]">Live Kitchen Sync</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
              Live incoming kitchen tickets with instant alerts and date history.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Rush Mode Toggle */}
            <Tooltip
              content="Toggle compact ticket grid for high-volume kitchen rush hours"
              placement="bottom"
            >
              <button
                onClick={() => setRushMode(!rushMode)}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
                  rushMode
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 shadow-xs"
                    : "bg-white dark:bg-white/5 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/10"
                }`}
                aria-label="Toggle Rush Hour compact ticket grid"
              >
                <LayoutGrid size={13} className={rushMode ? "text-amber-600 dark:text-amber-400" : "text-stone-400"} />
                <span>{rushMode ? "Rush Mode ON" : "Rush Mode"}</span>
              </button>
            </Tooltip>

            {/* Chime sound test / toggle */}
            <Tooltip
              content={
                soundEnabled
                  ? "Audio alerts enabled for incoming orders • Click to mute"
                  : "Audio alerts muted • Click to enable sound notifications"
              }
              placement="bottom"
            >
              <button
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  if (!soundEnabled) playChime(null, 1.0);
                }}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
                  soundEnabled
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                    : "bg-white dark:bg-white/5 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/10"
                }`}
                aria-label="Toggle kitchen audio alert"
              >
                {soundEnabled ? <Volume2 size={13} className="text-emerald-600 dark:text-emerald-400" /> : <VolumeX size={13} className="text-stone-400" />}
                <span>{soundEnabled ? "Chime On" : "Chime Muted"}</span>
              </button>
            </Tooltip>

            {/* Download Report Button */}
            <Tooltip content="Export filtered orders into a downloadable CSV report" placement="bottom">
              <button
                onClick={downloadOrdersReport}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-white/10 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                aria-label="Download Orders CSV Report"
              >
                <Download size={13} className="text-stone-500 dark:text-stone-400" />
                <span>Export CSV</span>
              </button>
            </Tooltip>

            {/* Manual Refresh Button */}
            <Tooltip content="Refresh orders immediately and sync ticket timers" placement="bottom">
              <button
                onClick={() => fetchOrders(true)}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                aria-label="Refresh orders"
              >
                <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ── DATE FILTER BAR & SEARCH BAR ────────────────────────── */}
        <div className="bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-3 sm:p-4 shadow-xs">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Date Controls */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 bg-stone-50 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 rounded-xl px-3 py-2 text-xs flex-1 sm:flex-initial">
                <Calendar className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="font-semibold text-stone-500 dark:text-stone-400 shrink-0">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  min={minSelectableDate}
                  max={todayStr}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-stone-900 dark:text-white font-mono font-bold outline-none cursor-pointer text-xs w-full sm:w-auto"
                />
              </div>

              <div className="inline-flex rounded-xl bg-stone-100 dark:bg-white/5 p-1 border border-stone-200/60 dark:border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isTodaySelected
                      ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === "all"
                      ? "bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                  }`}
                >
                  All Dates
                </button>
              </div>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 md:max-w-sm">
              <div className="flex items-center flex-1 bg-stone-50 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 rounded-xl px-3 py-2 focus-within:border-stone-400 dark:focus-within:border-stone-600 transition">
                <Search className="w-3.5 h-3.5 text-stone-400 shrink-0 mr-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Order ID (#PET-...) or customer..."
                  className="w-full bg-transparent text-stone-900 dark:text-white placeholder-stone-400 text-xs outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      fetchOrders(true);
                    }}
                    className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs transition shadow-xs shrink-0 active:scale-95 cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        {/* ── NEW ORDER VISUAL NOTIFICATION BANNER ─────────────────── */}
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

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`p-3.5 rounded-xl flex items-center justify-between border text-xs font-semibold ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400"
            }`}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback({ type: "", message: "" })}
              className="opacity-70 hover:opacity-100 ml-4 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto subtle-scrollbar pb-1.5 w-full min-w-0">
          {statusTabs.map((tab) => {
            const isPendingTab = tab.id === "pending";
            const pendingCount = isPendingTab ? orders.filter((o) => o.status === "pending").length : 0;

            return (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === tab.id
                    ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-sm"
                    : "bg-white/90 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/80 dark:border-white/10 hover:bg-stone-100/60 dark:hover:bg-white/10"
                }`}
              >
                <span>{tab.label}</span>
                {isPendingTab && pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── ORDERS LIST ─────────────────────────────────────────── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-orange-500">
            <RefreshCw className="animate-spin w-8 h-8" />
            <p className="text-xs text-stone-500 font-semibold">Loading live kitchen orders...</p>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl bg-white/50 dark:bg-[#10141f]/50 p-8">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-stone-400" />
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              {searchQuery
                ? "No matching orders found"
                : isTodaySelected
                ? "No orders placed today yet"
                : `No orders found for ${selectedDate}`}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "Check your spelling or try searching by customer name."
                : isTodaySelected
                ? "Incoming customer orders for today will appear here in real-time."
                : "You can switch to another date or choose 'All Dates' above."}
            </p>
          </div>
        ) : (
          <div>
            {rushMode ? (
              /* ── RUSH MODE: COMPACT KITCHEN TICKET GRID ─────────────────────── */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {displayedOrders.map((order) => {
                  const uniqueId = formatOrderId(order);
                  const isNewlyArrived = highlightedOrderIds.has(order._id);
                  const elapsedInfo = getOrderElapsedInfo(order.createdAt, order.status, order.updatedAt);
                  const paymentModeStr = (order.paymentMethod || "").toLowerCase();
                  const isCod = paymentModeStr.includes("cod") || paymentModeStr.includes("cash") || order.paymentStatus === "pending";
                  const isPickup = checkIsPickup(order);

                  const totalItems = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;

                  return (
                    <div
                      key={order._id}
                      className={`bg-white/95 dark:bg-[#10141f]/95 backdrop-blur-md rounded-2xl p-4 border transition flex flex-col justify-between gap-3 shadow-xs ${
                        isNewlyArrived
                          ? "border-orange-500 shadow-md ring-2 ring-orange-500/20"
                          : "border-stone-200/90 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20"
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Compact Header: ID, Live Timer, Price */}
                        <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-white/10 pb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-stone-900 dark:text-white bg-stone-100 dark:bg-white/10 px-2 py-0.5 rounded-md border border-stone-200/80 dark:border-white/10">
                              {uniqueId}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${elapsedInfo.color}`}>
                              <Clock size={10} />
                              <span>{elapsedInfo.text}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Tooltip content="Print Kitchen Order Ticket (KOT) for chef prep line and packaging" placement="top">
                              <button
                                type="button"
                                onClick={() => handlePrintKOT(order)}
                                aria-label="Print Kitchen Ticket (KOT)"
                                className="p-1 rounded-lg bg-stone-100 dark:bg-white/10 hover:bg-stone-200 dark:hover:bg-white/20 text-stone-600 dark:text-stone-300 transition cursor-pointer"
                              >
                                <Printer size={13} />
                              </button>
                            </Tooltip>
                            <span className="font-mono font-black text-sm text-stone-900 dark:text-white">
                              ₹{order.totalAmount}
                            </span>
                          </div>
                        </div>

                        {/* Customer & Payment Chip */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="truncate font-bold text-stone-800 dark:text-stone-200">
                            {order.address?.fullName || order.user?.name || "Customer"}
                            {order.address?.phone && (
                              <span className="font-normal font-mono text-[11px] text-stone-500 ml-1.5">
                                • {order.address.phone}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isPickup && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                                Pickup
                              </span>
                            )}
                            {order.isOutOfRange && (
                              <Tooltip
                                content={`Delivery distance is ${order.deliveryDistanceKm || ">10"} km, which exceeds standard kitchen delivery radius.`}
                                placement="top"
                              >
                                <span
                                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border flex items-center gap-1 cursor-help ${
                                    order.acceptedOutOfRange
                                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25"
                                      : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 animate-pulse"
                                  }`}
                                >
                                  <AlertTriangle size={10} />
                                  <span>
                                    {order.acceptedOutOfRange
                                      ? `Out of Range (${order.deliveryDistanceKm}k)`
                                      : `⚠️ ${order.deliveryDistanceKm || ">10"}km`}
                                  </span>
                                </span>
                              </Tooltip>
                            )}
                            {isCod ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                COD ₹{order.totalAmount}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                Paid Online
                              </span>
                            )}
                          </div>
                        </div>

                        {/* COD Cash Collection & Manager Settlement status in Rush Mode */}
                        {isCod && order.codPaymentHandler?.collected && (
                          <div className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 p-2 rounded-xl flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1 truncate max-w-[200px]">
                              <Banknote size={12} className="text-amber-600 shrink-0" />
                              <span>₹{order.codPaymentHandler?.amount || order.totalAmount} by {order.codPaymentHandler?.name || "Delivery Staff"}</span>
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider shrink-0 ${
                              order.codPaymentHandler?.settledWithManager
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                            }`}>
                              {order.codPaymentHandler?.settledWithManager ? "Settled" : "Pending Handover"}
                            </span>
                          </div>
                        )}

                        {/* Delivery Boy Details / Which Staff Took the Order */}
                        {order.assignedDeliveryStaff?.name ? (
                          <div className="text-[11px] bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-200 p-2 rounded-xl flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1.5 truncate">
                              <span>🛵</span>
                              <span>Delivery Boy: {order.assignedDeliveryStaff.name}</span>
                            </span>
                            {order.assignedDeliveryStaff.phone && (
                              <a
                                href={`tel:${order.assignedDeliveryStaff.phone}`}
                                className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold hover:underline shrink-0"
                              >
                                {order.assignedDeliveryStaff.phone}
                              </a>
                            )}
                          </div>
                        ) : !isPickup && (order.status === "out_for_delivery" || order.status === "ready") ? (
                          <div className="text-[10px] bg-stone-100 dark:bg-white/5 text-stone-500 px-2 py-1 rounded-lg flex items-center gap-1">
                            <span>🛵</span>
                            <span>Delivery Boy: Awaiting pickup assignment</span>
                          </div>
                        ) : null}

                        {/* Special Note if any */}
                        {order.notes && (
                          <div className="text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-2 rounded-xl font-medium">
                            <strong>Note:</strong> {order.notes}
                          </div>
                        )}

                        {/* Dishes List (Fast display for kitchen in Rush Mode - no checkboxes) */}
                        <div className="space-y-1 pt-1 border-t border-stone-100 dark:border-white/5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 uppercase tracking-wider pb-0.5">
                            <span>Dishes ({order.items?.length || 0})</span>
                            <span className="text-[10px] font-medium text-stone-400">Total: {totalItems}</span>
                          </div>

                          <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                            {(order.items || []).map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-1.5 rounded-lg border border-stone-200/70 dark:border-white/5 bg-stone-50/80 dark:bg-white/[0.02] text-xs select-none text-stone-800 dark:text-stone-200"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="inline-flex items-center justify-center px-1 rounded text-[10px] font-mono font-bold bg-stone-100 dark:bg-white/10 text-stone-800 dark:text-stone-200 border border-stone-200/60 dark:border-white/10 shrink-0">
                                    {item.quantity}×
                                  </span>
                                  <span className="font-semibold truncate">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="font-mono text-[11px] text-stone-400 shrink-0 ml-1">
                                  ₹{(item.price || 0) * (item.quantity || 1)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Primary Action Button Stepper */}
                      <div className="pt-2 border-t border-stone-100 dark:border-white/10 flex items-center gap-2">
                        {order.status === "pending" && (
                          <>
                            <Tooltip content="Accept order and notify kitchen staff to prepare the dishes" position="top">
                              <button
                                type="button"
                                disabled={updatingOrderId === order._id}
                                onClick={() => handleAcceptOrderWithRangeCheck(order)}
                                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <ChefHat size={13} />
                                <span>Accept & Cook</span>
                              </button>
                            </Tooltip>
                            <Tooltip content="Reject or cancel this order if unable to fulfill" position="top">
                              <button
                                type="button"
                                disabled={updatingOrderId === order._id}
                                onClick={() => {
                                  if (confirm(`Cancel order ${uniqueId}?`)) {
                                    handleUpdateStatus(order._id, "cancelled");
                                  }
                                }}
                                className="py-2 px-2.5 rounded-xl border border-rose-300 dark:border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold cursor-pointer disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </Tooltip>
                          </>
                        )}

                        {order.status === "confirmed" && (
                          <Tooltip content="Confirm cooking has started at the kitchen station" position="top">
                            <button
                              type="button"
                              disabled={updatingOrderId === order._id}
                              onClick={() => handleUpdateStatus(order._id, "preparing")}
                              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <ChefHat size={13} />
                              <span>Start Cooking</span>
                            </button>
                          </Tooltip>
                        )}

                        {order.status === "preparing" && (
                          isPickup ? (
                            <Tooltip fullWidth className="w-full" content="Mark food packed and ready for counter pickup by customer" position="top">
                              <button
                                type="button"
                                disabled={updatingOrderId === order._id}
                                onClick={() => handleUpdateStatus(order._id, "ready")}
                                className="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] transition-all duration-200 shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/35 border border-emerald-400/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                  <PackageCheck size={13} className="text-white" />
                                </div>
                                <span>Mark Ready for Pickup</span>
                                <span className="text-[10px] opacity-80 font-bold ml-0.5">✓</span>
                              </button>
                            </Tooltip>
                          ) : (
                            <Tooltip content="Hand over food parcel to driver and mark out for delivery" position="top">
                              <button
                                type="button"
                                disabled={updatingOrderId === order._id}
                                onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
                                className="w-full py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Truck size={13} />
                                <span>Dispatch for Delivery</span>
                              </button>
                            </Tooltip>
                          )
                        )}

                        {order.status === "ready" && (
                          isPickup ? (
                            <Tooltip content="Confirm customer has collected order at the counter" position="top">
                              <button
                                type="button"
                                disabled={updatingOrderId === order._id}
                                onClick={() => handleUpdateStatus(order._id, "delivered")}
                                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 size={13} />
                                <span>Confirm Customer Picked Up</span>
                              </button>
                            </Tooltip>
                          ) : (
                            <Tooltip content="Hand over to delivery driver and dispatch to customer" position="top">
                              <button
                                type="button"
                                disabled={updatingOrderId === order._id}
                                onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
                                className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Truck size={13} />
                                <span>Dispatch for Delivery</span>
                              </button>
                            </Tooltip>
                          )
                        )}

                        {order.status === "out_for_delivery" && (
                          <Tooltip content="Confirm successful doorstep delivery to customer" position="top">
                            <button
                              type="button"
                              disabled={updatingOrderId === order._id}
                              onClick={() => handleUpdateStatus(order._id, "delivered")}
                              className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Truck size={13} />
                              <span>Confirm Delivered</span>
                            </button>
                          </Tooltip>
                        )}

                        {order.status === "delivered" && (
                          <Tooltip content="This order has been fulfilled and completed successfully" position="top">
                            <div className="w-full py-1.5 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20 cursor-default">
                              ✓ Fulfilled
                            </div>
                          </Tooltip>
                        )}

                        {order.status === "cancelled" && (
                          <Tooltip content="This order was cancelled and was not fulfilled" position="top">
                            <div className="w-full py-1.5 text-center text-xs font-bold text-rose-500 bg-rose-500/10 rounded-xl border border-rose-500/20 cursor-default">
                              ✕ Cancelled
                            </div>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── DETAILED CARDS VIEW ─────────────────────────────────────────── */
              <div className="space-y-4">
                {displayedOrders.map((order) => {
                  const uniqueId = formatOrderId(order);
                  const isNewlyArrived = highlightedOrderIds.has(order._id);
                  const elapsedInfo = getOrderElapsedInfo(order.createdAt, order.status, order.updatedAt);
                  const paymentModeStr = (order.paymentMethod || "").toLowerCase();
                  const isCod = paymentModeStr.includes("cod") || paymentModeStr.includes("cash") || order.paymentStatus === "pending";
                  const isPickup = checkIsPickup(order);

                  const totalItems = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;

                  return (
                    <div
                      key={order._id}
                      className={`bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all duration-200 border ${
                        isNewlyArrived
                          ? "border-orange-500 shadow-lg shadow-orange-500/10 ring-2 ring-orange-500/20"
                          : "border-stone-200/90 dark:border-white/10 shadow-xs hover:border-stone-300 dark:hover:border-white/20"
                      }`}
                    >
                      {/* Top Bar: Order ID, Live Kitchen Timer, Status & Total */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-stone-100 dark:border-white/10">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Sleek Monospace POS ID Badge */}
                          <span className="font-mono text-xs sm:text-sm font-extrabold tracking-tight bg-stone-900 text-white dark:bg-white dark:text-stone-950 px-2.5 py-1 rounded-lg shadow-xs">
                            {uniqueId}
                          </span>

                          {/* Live Kitchen Elapsed Timer */}
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 shadow-xs ${elapsedInfo.color}`}>
                            <Clock size={11} />
                            <span>{elapsedInfo.text}</span>
                          </span>

                          <span className="text-[11px] text-stone-400 dark:text-stone-500 font-mono">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                          {/* Pickup Badge */}
                          {isPickup && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
                              Pickup
                            </span>
                          )}

                          {/* Payment Badge (COD vs Online) */}
                          {isCod ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                              <Banknote size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>COD</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Paid Online</span>
                            </span>
                          )}

                          {/* Status Badge */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                              statusBadgeStyles[order.status] || "bg-stone-100 text-stone-700 border-stone-200"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span>{order.status.replace("_", " ")}</span>
                          </span>

                          {/* Out of Range Notice Badge */}
                          {order.isOutOfRange && (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${
                                order.acceptedOutOfRange
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25"
                                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 animate-pulse"
                              }`}
                            >
                              <AlertTriangle size={12} />
                              <span>
                                {order.acceptedOutOfRange
                                  ? `✓ Out of Range (${order.deliveryDistanceKm} km)`
                                  : `⚠️ Out of Range (${order.deliveryDistanceKm} km)`}
                              </span>
                            </span>
                          )}

                          {/* Order Total */}
                          <span className="text-base sm:text-lg font-black text-stone-900 dark:text-white font-mono ml-1">
                            ₹{order.totalAmount}
                          </span>
                        </div>
                      </div>

                      {/* Order Details Body */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        {/* Customer & Delivery Address Details */}
                        <div className="space-y-2.5 bg-stone-50/80 dark:bg-white/[0.02] p-3.5 sm:p-4 rounded-2xl border border-stone-200/70 dark:border-white/5 flex flex-col justify-between gap-3">
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                              Customer & Delivery Details
                            </span>
                            <div className="text-sm font-bold text-stone-900 dark:text-white">
                              {order.address?.fullName || order.user?.name || "Customer"}
                            </div>
                            {order.address?.phone && (
                              <div className="text-xs text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                                <Phone size={12} className="text-stone-400 shrink-0" />
                                <a
                                  href={`tel:${order.address.phone}`}
                                  className="font-mono font-semibold text-stone-700 dark:text-stone-200 hover:text-orange-500 transition"
                                >
                                  {order.address.phone}
                                </a>
                              </div>
                            )}
                            {order.address?.street && (
                              <div className="text-xs text-stone-500 dark:text-stone-400 flex items-start gap-1.5 leading-relaxed">
                                <MapPin size={12} className="text-stone-400 shrink-0 mt-0.5" />
                                <span>
                                  {order.address.street}, {order.address.city || ""}{" "}
                                  {order.address.pincode ? `(${order.address.pincode})` : ""}
                                </span>
                              </div>
                            )}

                            {/* Delivery Boy / Staff Assigned */}
                            {order.assignedDeliveryStaff?.name ? (
                              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
                                <span className="font-bold uppercase tracking-wider text-[10px] text-blue-600 dark:text-blue-400 block">
                                  Delivery Boy / Assigned Staff
                                </span>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <span className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                                    <span>🛵</span>
                                    <span>{order.assignedDeliveryStaff.name}</span>
                                  </span>
                                  {order.assignedDeliveryStaff.phone && (
                                    <a
                                      href={`tel:${order.assignedDeliveryStaff.phone}`}
                                      className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      {order.assignedDeliveryStaff.phone}
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : !isPickup ? (
                              <div className="p-2 rounded-xl bg-stone-100 dark:bg-white/5 text-[11px] text-stone-500 flex items-center gap-1.5">
                                <span>🛵</span>
                                <span>Delivery Boy: Awaiting driver pickup</span>
                              </div>
                            ) : (
                              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-semibold flex items-center gap-1.5">
                                <span>🛍️</span>
                                <span>Counter Self-Pickup Order</span>
                              </div>
                            )}
                          </div>

                          {/* Highlighted Special Cooking Instructions */}
                          {order.notes && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                              <span className="text-sm leading-none shrink-0">🏷️</span>
                              <div>
                                <span className="font-bold uppercase tracking-wider text-[10px] block text-amber-700 dark:text-amber-400">
                                  Customer Request:
                                </span>
                                <span className="font-medium">{order.notes}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Order Items List */}
                        <div className="space-y-2.5 bg-stone-50/80 dark:bg-white/[0.02] p-3.5 sm:p-4 rounded-2xl border border-stone-200/70 dark:border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                              Order Items ({order.items?.length || 0} {order.items?.length === 1 ? "item" : "items"})
                            </span>
                            <span className="text-[11px] font-medium text-stone-400">
                              Total dishes: {totalItems}
                            </span>
                          </div>

                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                            {(order.items || []).map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded-xl border border-stone-200/80 dark:border-white/5 bg-white dark:bg-white/[0.03] text-xs select-none"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-stone-100 dark:bg-white/10 text-stone-800 dark:text-stone-200 border border-stone-200/60 dark:border-white/10 shrink-0">
                                    {item.quantity}×
                                  </span>
                                  <span className="font-semibold truncate text-stone-900 dark:text-white">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="font-mono text-stone-500 dark:text-stone-400 text-xs shrink-0 ml-2">
                                  ₹{(item.price || 0) * (item.quantity || 1)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2 flex flex-col gap-1.5 text-xs text-stone-500 dark:text-stone-400 border-t border-stone-200/60 dark:border-white/5">
                            <div className="flex items-center justify-between">
                              <span>Payment: <strong className="text-stone-700 dark:text-stone-300">{order.paymentMethod || "Direct"}</strong></span>
                              <span className={`font-bold uppercase text-[10px] tracking-wide ${isCod ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                {order.paymentStatus === "pending" ? "Pending at Doorstep" : (order.paymentStatus || "Paid")}
                              </span>
                            </div>

                            {/* Detailed COD Cash Collected & Manager Settlement Info */}
                            {isCod && order.codPaymentHandler?.collected && (
                              <div className="mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                                <span className="font-medium flex items-center gap-1.5">
                                  <Banknote size={14} className="text-amber-600 shrink-0" />
                                  <span>Cash Collected: <strong className="font-bold">₹{order.codPaymentHandler?.amount || order.totalAmount}</strong> by <strong className="font-bold">{order.codPaymentHandler?.name || "Delivery Staff"}</strong></span>
                                </span>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    order.codPaymentHandler?.settledWithManager
                                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                      : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                  }`}>
                                    {order.codPaymentHandler?.settledWithManager ? "✓ Settled with Manager" : "⚠️ Pending Manager Handover"}
                                  </span>
                                  {isManagerOrAdmin && !order.codPaymentHandler?.settledWithManager && (
                                    <Tooltip content="Confirm that the delivery driver has handed over the collected cash to the register" position="top">
                                      <button
                                        type="button"
                                        onClick={() => handleSettleCodCash(order._id)}
                                        disabled={updatingOrderId === order._id}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer transition disabled:opacity-50"
                                      >
                                        Mark Settled
                                      </button>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Live Delivery Map for Manager (Static Restaurant + Staff Live GPS + Customer Doorstep) */}
                      {expandedMapOrderIds.has(order._id) && (
                        <div className="my-3 rounded-2xl overflow-hidden border border-blue-500/30 bg-stone-900 shadow-md">
                          <div className="p-2.5 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between text-xs">
                            <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                              <Radio size={14} className="animate-pulse text-blue-500" />
                              <span>Live Delivery Dispatch Map</span>
                            </span>
                            <span className="text-[11px] text-stone-400">
                              Restaurant (Fixed) • Driver (Live GPS) • Customer (Doorstep)
                            </span>
                          </div>
                          <div className="p-2">
                            <LiveDeliveryMap
                              orderId={order.orderId || order._id}
                              initialStatus={order.status}
                              restaurant={order.restaurant}
                              destination={order.address}
                              deliveryTracking={order.deliveryTracking}
                              recipientName={order.address?.fullName}
                              isStaffView={false}
                              isManagerView={true}
                            />
                          </div>
                        </div>
                      )}

                      {/* Primary One-Click Action Stepper Bar */}
                      <div className="pt-3 border-t border-stone-100 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        {/* Print KOT Button */}
                        <Tooltip content="Print a Kitchen Order Ticket (KOT) receipt for the cooking station" position="top">
                          <button
                            type="button"
                            onClick={() => handlePrintKOT(order)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-white/10 text-xs font-bold transition active:scale-95 cursor-pointer"
                          >
                            <Printer size={13} className="text-stone-500" />
                            <span>Print KOT Slip</span>
                          </button>
                        </Tooltip>

                        <div className="flex items-center gap-2 justify-end">
                          {order.status === "pending" && (
                            <>
                              <Tooltip content="Accept order and notify kitchen to begin preparation" position="top">
                                <button
                                  type="button"
                                  disabled={updatingOrderId === order._id}
                                  onClick={() => handleAcceptOrderWithRangeCheck(order)}
                                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <ChefHat size={14} />
                                  <span>Accept & Start Cooking</span>
                                </button>
                              </Tooltip>
                              <Tooltip content="Reject or cancel this order if unable to fulfill" position="top">
                                <button
                                  type="button"
                                  disabled={updatingOrderId === order._id}
                                  onClick={() => {
                                    if (confirm(`Cancel order ${uniqueId}?`)) {
                                      handleUpdateStatus(order._id, "cancelled");
                                    }
                                  }}
                                  className="px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold text-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </Tooltip>
                            </>
                          )}

                          {order.status === "confirmed" && (
                            <Tooltip content="Confirm kitchen has started cooking this order" position="top">
                              <button
                                type="button"
                                disabled={updatingOrderId === order._id}
                                onClick={() => handleUpdateStatus(order._id, "preparing")}
                                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <ChefHat size={14} />
                                <span>Start Cooking</span>
                              </button>
                            </Tooltip>
                          )}

                          {order.status === "preparing" && (
                            isPickup ? (
                              <Tooltip content="Mark food packed and ready for counter pickup by customer" position="top">
                                <button
                                  type="button"
                                  disabled={updatingOrderId === order._id}
                                  onClick={() => handleUpdateStatus(order._id, "ready")}
                                  className="w-full sm:w-auto px-4 py-2 rounded-xl font-extrabold text-xs text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all shadow-sm border border-emerald-400/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <PackageCheck size={14} />
                                  <span>Mark Ready for Pickup</span>
                                </button>
                              </Tooltip>
                            ) : (
                              <Tooltip content="Hand over food parcel to driver and mark out for delivery" position="top">
                                <button
                                  type="button"
                                  disabled={updatingOrderId === order._id}
                                  onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
                                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Truck size={14} />
                                  <span>Dispatch for Delivery</span>
                                </button>
                              </Tooltip>
                            )
                          )}

                          {order.status === "ready" && (
                            isPickup ? (
                              <Tooltip content="Confirm customer has collected order at the counter" position="top">
                                <button
                                  type="button"
                                  disabled={updatingOrderId === order._id}
                                  onClick={() => handleUpdateStatus(order._id, "delivered")}
                                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} />
                                  <span>Confirm Customer Picked Up</span>
                                </button>
                              </Tooltip>
                            ) : (
                              <Tooltip content="Hand over to delivery driver and dispatch to customer" position="top">
                                <button
                                  type="button"
                                  disabled={updatingOrderId === order._id}
                                  onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
                                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Truck size={14} />
                                  <span>Dispatch for Delivery</span>
                                </button>
                              </Tooltip>
                            )
                          )}

                          {order.status === "out_for_delivery" && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {!isPickup && (
                                <Tooltip content="View live delivery route showing restaurant, delivery staff GPS, and customer doorstep" position="top">
                                  <button
                                    type="button"
                                    onClick={() => toggleLiveMap(order._id)}
                                    className="px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <MapPin size={13} />
                                    <span>{expandedMapOrderIds.has(order._id) ? "Hide Live Map" : "View Live Route"}</span>
                                  </button>
                                </Tooltip>
                              )}

                              <Tooltip content="Confirm successful doorstep delivery to customer" position="top">
                                <button
                                  type="button"
                                  disabled={updatingOrderId === order._id}
                                  onClick={() => handleUpdateStatus(order._id, "delivered")}
                                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                  <Truck size={14} />
                                  <span>Confirm Order Delivered</span>
                                </button>
                              </Tooltip>
                            </div>
                          )}

                          {order.status === "delivered" && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-500/25 text-xs font-bold">
                              <CheckCircle2 size={14} /> Order Fulfilled
                            </span>
                          )}

                          {order.status === "cancelled" && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/25 text-xs font-bold">
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
        )}

      </div>

      {/* Explicit Out-of-Range Order Manager Confirmation Dialog */}
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
