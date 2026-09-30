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

const POLL_INTERVAL = 10000; // Poll every 10 seconds

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
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Kitchen Alert, Audio & Operational States
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState(new Set());
  const [rushMode, setRushMode] = useState(false);
  const [packedItems, setPackedItems] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("restaurant_packed_items");
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });
  const [currentTimeTick, setCurrentTimeTick] = useState(Date.now());
  const [kitchenActive, setKitchenActive] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("restaurant_kitchen_active") !== "false";
    }
    return true;
  });

  // Ticking timer clock every 30 seconds for live order urgency badges
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Check if a dish is packed
  const isDishPacked = (order, idx) => {
    if (order.status === "cancelled") {
      return false;
    }
    if (order.status === "out_for_delivery" || order.status === "delivered") {
      return true;
    }
    return Boolean(packedItems[`${order._id}_${idx}`]);
  };

  // Dish checklist toggle: selectable when pending, locked once order is accepted
  const toggleItemPacked = (order, idx) => {
    if (order.status === "out_for_delivery" || order.status === "delivered" || order.status === "cancelled") {
      return;
    }
    const key = `${order._id}_${idx}`;

    // 1. When order arrives (pending), admin can freely check/uncheck dishes to verify them
    if (order.status === "pending") {
      setPackedItems((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        try {
          localStorage.setItem("restaurant_packed_items", JSON.stringify(next));
        } catch (e) {}
        return next;
      });
      return;
    }

    // 2. Once order is accepted (preparing), any checked item CANNOT be unchecked
    if (order.status === "preparing") {
      if (packedItems[key]) {
        return; // Locked: cannot be unchecked after order is accepted
      }
      setPackedItems((prev) => {
        const next = { ...prev, [key]: true };
        try {
          localStorage.setItem("restaurant_packed_items", JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  };

  // Pack all dishes in an order (only during preparing)
  const packAllDishes = (order) => {
    if (order.status !== "preparing") return;
    setPackedItems((prev) => {
      const next = { ...prev };
      (order.items || []).forEach((_, idx) => {
        next[`${order._id}_${idx}`] = true;
      });
      try {
        localStorage.setItem("restaurant_packed_items", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

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

  async function handleUpdateStatus(orderId, nextStatus) {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch("/api/restaurant/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus }),
      });

      const data = await res.json();
      if (data.success) {
        const orderObj = orders.find((o) => o._id === orderId);
        const displayId = formatOrderId(orderObj || { _id: orderId });
        setFeedback({
          type: "success",
          message: `Order ${displayId} updated to ${nextStatus.toUpperCase()}`,
        });
        setOrders((prev) =>
          prev.map((o) => (o._id === orderId ? { ...o, status: nextStatus, updatedAt: new Date().toISOString() } : o))
        );
        if (nextStatus === "out_for_delivery" || nextStatus === "delivered") {
          setPackedItems((prev) => {
            const next = { ...prev };
            const orderObj = orders.find((o) => o._id === orderId);
            (orderObj?.items || []).forEach((_, idx) => {
              next[`${orderId}_${idx}`] = true;
            });
            try {
              localStorage.setItem("restaurant_packed_items", JSON.stringify(next));
            } catch (e) {}
            return next;
          });
        }
        setHighlightedOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
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
    { id: "preparing", label: "Preparing" },
    { id: "out_for_delivery", label: "Out for Delivery" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const statusBadgeStyles = {
    pending:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    preparing:
      "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
    out_for_delivery:
      "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30",
    delivered:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
    cancelled:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  };

  return (
    <div className="min-h-screen bg-stone-50/60 dark:bg-[#07090e] text-stone-900 dark:text-white font-jakarta transition-colors relative selection:bg-orange-500/20 selection:text-orange-600">
      {/* Soft warm ambient background glow for light mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-100/60 via-amber-50/30 to-transparent dark:from-orange-500/5 dark:via-transparent dark:to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      <main className="pt-20 sm:pt-28 pb-28 sm:pb-24 px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-5">
        
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
            <button
              onClick={() => setRushMode(!rushMode)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
                rushMode
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 shadow-xs"
                  : "bg-white dark:bg-white/5 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/10"
              }`}
              title="Toggle Rush Hour compact ticket grid"
            >
              <LayoutGrid size={13} className={rushMode ? "text-amber-600 dark:text-amber-400" : "text-stone-400"} />
              <span>{rushMode ? "Rush Mode ON" : "Rush Mode"}</span>
            </button>

            {/* Chime sound test / toggle */}
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
            >
              {soundEnabled ? <Volume2 size={13} className="text-emerald-600 dark:text-emerald-400" /> : <VolumeX size={13} className="text-stone-400" />}
              <span>{soundEnabled ? "Chime On" : "Chime Muted"}</span>
            </button>

            {/* Download Report Button */}
            <button
              onClick={downloadOrdersReport}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-white/10 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
              title="Download Orders CSV Report"
            >
              <Download size={13} className="text-stone-500 dark:text-stone-400" />
              <span>Export CSV</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchOrders(true)}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
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
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer ${
                filterStatus === tab.id
                  ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-sm"
                  : "bg-white/90 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/80 dark:border-white/10 hover:bg-stone-100/60 dark:hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
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

                  const totalItems = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
                  const packedCount = (order.items || []).filter((_, idx) => isDishPacked(order, idx)).length;
                  const allPacked = totalItems > 0 && packedCount === (order.items || []).length;

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
                            <button
                              type="button"
                              onClick={() => handlePrintKOT(order)}
                              title="Print Kitchen Ticket (KOT)"
                              className="p-1 rounded-lg bg-stone-100 dark:bg-white/10 hover:bg-stone-200 dark:hover:bg-white/20 text-stone-600 dark:text-stone-300 transition cursor-pointer"
                            >
                              <Printer size={13} />
                            </button>
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

                          {isCod ? (
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                              COD ₹{order.totalAmount}
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                              Paid Online
                            </span>
                          )}
                        </div>

                        {/* Special Note if any */}
                        {order.notes && (
                          <div className="text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-2 rounded-xl font-medium">
                            <strong>Note:</strong> {order.notes}
                          </div>
                        )}

                        {/* Checklist of Dishes */}
                        <div className="space-y-1 pt-1 border-t border-stone-100 dark:border-white/5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 uppercase tracking-wider pb-0.5">
                            <span>Dishes ({order.items?.length || 0})</span>
                            {allPacked ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                <Check size={11} /> All Packed
                              </span>
                            ) : order.status === "preparing" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-stone-400">
                                  Locked 🔒
                                </span>
                                <button
                                  type="button"
                                  onClick={() => packAllDishes(order)}
                                  className="text-[10px] text-stone-600 dark:text-stone-300 hover:underline font-bold cursor-pointer"
                                >
                                  Pack All
                                </button>
                              </div>
                            ) : order.status === "pending" ? (
                              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold">
                                Tap to verify dishes
                              </span>
                            ) : null}
                          </div>

                          <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                            {(order.items || []).map((item, idx) => {
                              const isPacked = isDishPacked(order, idx);
                              const canClick = order.status === "pending" || (order.status === "preparing" && !isPacked);
                              const itemTitle =
                                order.status === "pending"
                                  ? isPacked
                                    ? "Verified (click to uncheck before accepting)"
                                    : "Click to select/verify dish before accepting"
                                  : isPacked
                                  ? "Locked: Cannot be unchecked after order is accepted"
                                  : "Click to pack (locks once checked)";

                              return (
                                <div
                                  key={idx}
                                  title={itemTitle}
                                  onClick={() => canClick && toggleItemPacked(order, idx)}
                                  className={`flex items-center justify-between p-1.5 rounded-lg border text-xs select-none transition ${
                                    canClick
                                      ? "cursor-pointer hover:border-stone-400 dark:hover:border-white/20"
                                      : "cursor-default"
                                  } ${
                                    isPacked
                                      ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/25 text-stone-700 dark:text-stone-300 font-medium"
                                      : "bg-stone-50/80 dark:bg-white/[0.02] border-stone-200/70 dark:border-white/5 text-stone-800 dark:text-stone-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                      isPacked ? "bg-emerald-500 border-emerald-500 text-white" : "border-stone-300 dark:border-stone-600"
                                    }`}>
                                      {isPacked && <Check size={9} />}
                                    </div>
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
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Primary Action Button Stepper */}
                      <div className="pt-2 border-t border-stone-100 dark:border-white/10 flex items-center gap-2">
                        {order.status === "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={updatingOrderId === order._id}
                              onClick={() => handleUpdateStatus(order._id, "preparing")}
                              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <ChefHat size={13} />
                              <span>Accept & Cook</span>
                            </button>
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
                          </>
                        )}

                        {order.status === "preparing" && (
                          <button
                            type="button"
                            disabled={updatingOrderId === order._id}
                            onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
                            className="w-full py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Zap size={13} />
                            <span>Mark Ready (Dispatch)</span>
                          </button>
                        )}

                        {order.status === "out_for_delivery" && (
                          <button
                            type="button"
                            disabled={updatingOrderId === order._id}
                            onClick={() => handleUpdateStatus(order._id, "delivered")}
                            className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Truck size={13} />
                            <span>Confirm Delivered</span>
                          </button>
                        )}

                        {order.status === "delivered" && (
                          <div className="w-full py-1.5 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            ✓ Fulfilled
                          </div>
                        )}

                        {order.status === "cancelled" && (
                          <div className="w-full py-1.5 text-center text-xs font-bold text-rose-500 bg-rose-500/10 rounded-xl border border-rose-500/20">
                            ✕ Cancelled
                          </div>
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

                  const totalItems = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
                  const packedCount = (order.items || []).filter((_, idx) => isDishPacked(order, idx)).length;
                  const allPacked = totalItems > 0 && packedCount === (order.items || []).length;

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

                        {/* Interactive Dish Checklist */}
                        <div className="space-y-2.5 bg-stone-50/80 dark:bg-white/[0.02] p-3.5 sm:p-4 rounded-2xl border border-stone-200/70 dark:border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                              Dish Checklist ({order.items?.length || 0} {order.items?.length === 1 ? "item" : "items"})
                            </span>
                            <div className="text-[11px] font-semibold text-stone-400 flex items-center gap-2">
                              {allPacked ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                  <Check size={12} /> All Items Packed ✓
                                </span>
                              ) : order.status === "preparing" ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-stone-400 text-[10px]">Locked 🔒</span>
                                  <button
                                    type="button"
                                    onClick={() => packAllDishes(order)}
                                    className="px-2 py-0.5 rounded-md bg-stone-200/70 hover:bg-stone-300 dark:bg-white/10 dark:hover:bg-white/20 text-stone-800 dark:text-stone-200 text-[10px] font-bold transition cursor-pointer"
                                  >
                                    Pack All
                                  </button>
                                </div>
                              ) : order.status === "pending" ? (
                                <span className="text-stone-500 dark:text-stone-400 text-[10px] font-medium">
                                  Verify before accepting
                                </span>
                              ) : (
                                <span>Awaiting Acceptance</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                            {(order.items || []).map((item, idx) => {
                              const isPacked = isDishPacked(order, idx);
                              const canClick = order.status === "pending" || (order.status === "preparing" && !isPacked);
                              const itemTitle =
                                order.status === "pending"
                                  ? isPacked
                                    ? "Verified (click to uncheck before accepting order)"
                                    : "Click to select/verify dish before accepting order"
                                  : isPacked
                                  ? "Locked: Checked item cannot be unchecked after order is accepted"
                                  : "Click to mark packed (locks once checked)";

                              return (
                                <div
                                  key={idx}
                                  title={itemTitle}
                                  onClick={() => canClick && toggleItemPacked(order, idx)}
                                  className={`flex items-center justify-between p-2 rounded-xl border text-xs select-none transition ${
                                    canClick
                                      ? "cursor-pointer hover:border-stone-400 dark:hover:border-white/20"
                                      : "cursor-default"
                                  } ${
                                    isPacked
                                      ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/25 text-stone-700 dark:text-stone-300 font-medium"
                                      : "bg-white dark:bg-white/[0.03] border-stone-200/80 dark:border-white/5 text-stone-800 dark:text-stone-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition ${
                                      isPacked
                                        ? "bg-emerald-500 border-emerald-500 text-white"
                                        : "border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-white/5"
                                    }`}>
                                      {isPacked && <Check size={11} strokeWidth={3} />}
                                    </div>
                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-stone-100 dark:bg-white/10 text-stone-800 dark:text-stone-200 border border-stone-200/60 dark:border-white/10 shrink-0">
                                      {item.quantity}×
                                    </span>
                                    <span className={`font-semibold truncate ${isPacked ? "text-stone-500 dark:text-stone-400 line-through" : "text-stone-900 dark:text-white"}`}>
                                      {item.name}
                                    </span>
                                  </div>
                                  <span className="font-mono text-stone-500 dark:text-stone-400 text-xs shrink-0 ml-2">
                                    ₹{(item.price || 0) * (item.quantity || 1)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="pt-2 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 border-t border-stone-200/60 dark:border-white/5">
                            <span>Payment: <strong className="text-stone-700 dark:text-stone-300">{order.paymentMethod || "Direct"}</strong></span>
                            <span className={`font-bold uppercase text-[10px] tracking-wide ${isCod ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {order.paymentStatus === "pending" ? "Pending at Doorstep" : (order.paymentStatus || "Paid")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Primary One-Click Action Stepper Bar */}
                      <div className="pt-3 border-t border-stone-100 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        {/* Print KOT Button */}
                        <button
                          type="button"
                          onClick={() => handlePrintKOT(order)}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-white/10 text-xs font-bold transition active:scale-95 cursor-pointer"
                        >
                          <Printer size={13} className="text-stone-500" />
                          <span>Print KOT Slip</span>
                        </button>

                        <div className="flex items-center gap-2 justify-end">
                          {order.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={updatingOrderId === order._id}
                                onClick={() => handleUpdateStatus(order._id, "preparing")}
                                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <ChefHat size={14} />
                                <span>Accept & Start Cooking</span>
                              </button>
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
                            </>
                          )}

                          {order.status === "preparing" && (
                            <button
                              type="button"
                              disabled={updatingOrderId === order._id}
                              onClick={() => handleUpdateStatus(order._id, "out_for_delivery")}
                              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Zap size={14} />
                              <span>Mark Food Ready (Dispatch)</span>
                            </button>
                          )}

                          {order.status === "out_for_delivery" && (
                            <button
                              type="button"
                              disabled={updatingOrderId === order._id}
                              onClick={() => handleUpdateStatus(order._id, "delivered")}
                              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Truck size={14} />
                              <span>Confirm Order Delivered</span>
                            </button>
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

      </main>
    </div>
  );
}
