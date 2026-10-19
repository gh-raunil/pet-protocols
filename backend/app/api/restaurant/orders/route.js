import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { restoreStockForOrder } from "@/lib/inventoryService";
import { executeOrderRefund, retryFailedDeduction } from "@/lib/refundService";
import { notifyOrderEvent, sendPushToUser } from "@/lib/pushService";
import { getOrderDistanceInfo } from "@/lib/geoDistance";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

// GET — List orders for this restaurant
export async function GET(request) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "orders_view" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurant, restaurantId } = auth;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const dateParam = searchParams.get("date"); // YYYY-MM-DD or 'all'
    const searchQuery = (searchParams.get("search") || "").trim();

    let filter = { restaurant: restaurantId };
    if (status && status !== "all") {
      filter.status = status;
    }

    if (dateParam && dateParam !== "all" && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [year, month, day] = dateParam.split("-").map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    if (searchQuery) {
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const stripped = searchQuery.replace(/^#/, "").trim();
      const cleanId = stripped.replace(/^PET-/i, "").replace(/^ORD_/i, "").trim();

      const orConditions = [
        { "address.fullName": { $regex: escapeRegex(searchQuery), $options: "i" } },
        { "address.recipientName": { $regex: escapeRegex(searchQuery), $options: "i" } },
        { "address.phone": { $regex: escapeRegex(stripped), $options: "i" } },
        { "address.recipientPhone": { $regex: escapeRegex(stripped), $options: "i" } },
        { orderId: { $regex: escapeRegex(stripped), $options: "i" } },
      ];

      if (cleanId) {
        orConditions.push({ orderId: { $regex: escapeRegex(cleanId), $options: "i" } });
        orConditions.push({
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: escapeRegex(cleanId),
              options: "i",
            },
          },
        });
      }

      filter.$or = orConditions;
    }

    let orders = await Order.find(filter)
      .populate("user", "name email phone")
      .populate("restaurant", "name slug phone address deliverySettings")
      .sort({ createdAt: -1 })
      .lean();

    // Fallback: If searching by orderId or customer and 0 results found in filtered date range, search across all dates
    if (orders.length === 0 && searchQuery && filter.createdAt) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.createdAt;
      orders = await Order.find(fallbackFilter)
        .populate("user", "name email phone")
        .populate("restaurant", "name slug phone address deliverySettings")
        .sort({ createdAt: -1 })
        .lean();
    }

    // Attach delivery distance and out-of-range indicators, ensuring restaurant coordinates
    orders = orders.map((order) => {
      const distInfo = getOrderDistanceInfo(order, restaurant);
      let restObj = order.restaurant || restaurant;
      if (restObj) {
        let rLat = restObj.address?.latitude || 0;
        let rLng = restObj.address?.longitude || 0;
        if (!rLat || !rLng || (rLat === 0 && rLng === 0)) {
          const destLat = order.address?.latitude || order.customerLocation?.latitude;
          if (destLat && Math.abs(destLat - 12.97) < 0.2) {
            rLat = 12.9698;
            rLng = 79.1550;
          } else if (destLat) {
            rLat = destLat - 0.005;
            rLng = (order.address?.longitude || order.customerLocation?.longitude || 79.15) - 0.005;
          } else {
            rLat = 12.9698;
            rLng = 79.1550;
          }
          restObj = {
            ...restObj,
            address: {
              ...(restObj.address || {}),
              latitude: rLat,
              longitude: rLng,
            },
          };
        }
      }
      return {
        ...order,
        restaurant: restObj,
        deliveryDistanceKm: order.deliveryDistanceKm ?? distInfo.distanceKm,
        isOutOfRange: order.isOutOfRange ?? distInfo.isOutOfRange,
        maxRangeKm: distInfo.maxRangeKm,
      };
    });

    return NextResponse.json({
      success: true,
      orders,
      restaurantCreatedAt: restaurant?.createdAt || null,
      restaurantName: restaurant?.name || "",
      restaurant,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT — Update order status (scoped to restaurant)
export async function PUT(request) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "orders_update" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const body = await request.json();
    const {
      orderId,
      orderIds,
      status,
      paymentStatus,
      notes,
      assignedDeliveryStaff,
      codPaymentHandler,
      action,
      acceptedOutOfRange,
      deliveryDistanceKm,
      cancellationReason,
    } = body;

    if (!orderId && (!orderIds || !orderIds.length)) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    await connectDB();

    if (action === "settle_cod_cash") {
      // Manager/Admin settling COD cash collected by staff
      if (auth.isStaff && !auth.isAdmin && !auth.staffRoles.includes("Manager")) {
        return NextResponse.json(
          { success: false, message: "Only managers or restaurant admins can settle staff COD cash." },
          { status: 403 }
        );
      }

      const targetOrderIds = Array.isArray(orderIds) && orderIds.length > 0
        ? orderIds
        : (orderId ? [orderId] : []);

      if (targetOrderIds.length === 0) {
        return NextResponse.json({ success: false, message: "Order ID(s) required." }, { status: 400 });
      }

      const ordersToSettle = await Order.find({ _id: { $in: targetOrderIds }, restaurant: restaurantId });
      if (!ordersToSettle || ordersToSettle.length === 0) {
        return NextResponse.json({ success: false, message: "No matching orders found to settle." }, { status: 404 });
      }

      const settledAtTime = new Date();
      const managerInfo = {
        id: auth.user?._id,
        name: auth.user?.name || "Manager",
      };

      await Order.updateMany(
        { _id: { $in: targetOrderIds }, restaurant: restaurantId },
        {
          $set: {
            "codPaymentHandler.settledWithManager": true,
            "codPaymentHandler.settledAt": settledAtTime,
            "codPaymentHandler.settledBy": managerInfo,
          },
        }
      );

      // Notify delivery staff member(s) that their cash handover was received & confirmed
      try {
        const staffMap = {};
        ordersToSettle.forEach((o) => {
          const handlerId = o.codPaymentHandler?.id;
          if (handlerId) {
            if (!staffMap[handlerId]) staffMap[handlerId] = [];
            staffMap[handlerId].push(o);
          }
        });

        for (const [staffId, staffOrders] of Object.entries(staffMap)) {
          const totalAmt = staffOrders.reduce(
            (sum, o) => sum + (o.codPaymentHandler?.amount || o.totalAmount || 0),
            0
          );
          sendPushToUser(staffId, {
            title: "Cash Handover Confirmed! 💰",
            body: `Manager ${managerInfo.name} confirmed handover of ₹${totalAmt.toFixed(2)} cash for ${staffOrders.length} order(s). Your balance is cleared!`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/badge-96x96.png",
            url: "/delivery",
            data: { url: "/delivery", type: "cod_settlement" },
          });
        }
      } catch (pushErr) {
        console.warn("[Cash Settlement Push Error]", pushErr.message);
      }

      const refreshedOrder = orderId ? await Order.findById(orderId) : null;
      return NextResponse.json({
        success: true,
        message: `Settled COD cash for ${targetOrderIds.length} order(s) with manager.`,
        order: refreshedOrder,
      });
    }

    const order = await Order.findOne({ _id: orderId, restaurant: restaurantId });
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found or does not belong to your restaurant." },
        { status: 404 }
      );
    }

    if (action === "retry_inventory") {
      const retryResult = await retryFailedDeduction({
        orderId: order._id,
        initiatedBy: "restaurant",
      });
      const refreshedOrder = await Order.findById(order._id);
      return NextResponse.json({
        success: retryResult.success,
        result: retryResult,
        order: refreshedOrder,
        message: retryResult.message,
      }, { status: retryResult.success ? 200 : 400 });
    }

    if (!status && !paymentStatus && notes === undefined && !assignedDeliveryStaff && !codPaymentHandler && !acceptedOutOfRange) {
      return NextResponse.json({ success: false, message: "At least one field must be provided." }, { status: 400 });
    }

    const previousStatus = order.status;
    if (status) {
      if (!["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"].includes(status)) {
        return NextResponse.json({ success: false, message: `Invalid status '${status}'.` }, { status: 400 });
      }

      // Role-based transition guard for staff
      if (auth.isStaff && !auth.isAdmin) {
        const isDeliveryStaff = auth.staffRoles.includes("Delivery");
        const isKitchenStaff = auth.staffRoles.includes("Kitchen");
        const isManager = auth.staffRoles.includes("Manager");

        if (!isManager) {
          if (isDeliveryStaff && !isKitchenStaff) {
            // Delivery staff can only transition to out_for_delivery or delivered
            if (!["out_for_delivery", "delivered"].includes(status)) {
              return NextResponse.json(
                { success: false, message: "Delivery staff can only transition orders to 'out_for_delivery' or 'delivered'." },
                { status: 403 }
              );
            }
          } else if (isKitchenStaff && !isDeliveryStaff) {
            // Kitchen staff can only transition to confirmed, preparing, ready, or cancelled
            if (!["confirmed", "preparing", "ready", "cancelled"].includes(status)) {
              return NextResponse.json(
                { success: false, message: "Kitchen staff can only transition orders to 'confirmed', 'preparing', or 'ready'." },
                { status: 403 }
              );
            }
          }
        }
      }

      if (status === "cancelled") {
        if (order.status === "delivered") {
          return NextResponse.json({ success: false, message: "Delivered orders cannot be cancelled." }, { status: 400 });
        }
        if (order.status === "cancelled") {
          const isRestorationIncomplete =
            !order.stockRestored &&
            (order.stockDeducted ||
              (Array.isArray(order.stockDeduction?.deductedIngredients) && order.stockDeduction.deductedIngredients.length > 0) ||
              order.stockDeduction?.status === 'partial_failed');
          const isRefundEligible =
            ['paid', 'refund_pending'].includes(order.paymentStatus) &&
            (order.paymentMethod?.toLowerCase().includes('razorpay') || order.paymentMethod?.toLowerCase().includes('online'));
          const isRefundIncomplete =
            isRefundEligible &&
            order.refundDetails?.status !== 'processed';

          if (!isRestorationIncomplete && !isRefundIncomplete) {
            return NextResponse.json({ success: false, message: "Order is already cancelled." }, { status: 400 });
          }
        }
      } else if (["delivered", "cancelled"].includes(order.status) && status !== order.status) {
        return NextResponse.json(
          { success: false, message: `Orders with terminal status '${order.status}' cannot transition to '${status}'.` },
          { status: 400 }
        );
      }

      if (typeof order.canTransitionTo === "function" && !order.canTransitionTo(status)) {
        return NextResponse.json(
          { success: false, message: `Cannot transition order from '${order.status}' to '${status}'.` },
          { status: 400 }
        );
      }

      const distInfo = getOrderDistanceInfo(order, auth.restaurant);
      const effectiveDistance = deliveryDistanceKm ?? distInfo.distanceKm;

      if (acceptedOutOfRange) {
        order.acceptedOutOfRange = true;
        order.isOutOfRange = true;
        order.deliveryDistanceKm = effectiveDistance ?? order.deliveryDistanceKm;
        order.acceptedOutOfRangeBy = {
          userId: auth.user?._id ? String(auth.user._id) : null,
          name: auth.user?.name || "Manager",
          role: auth.user?.role || "restaurant_admin",
          acceptedAt: new Date(),
        };
      }

      if (cancellationReason) {
        order.cancellationReason = cancellationReason;
      }

      const transitionNote =
        notes ||
        (acceptedOutOfRange
          ? `Accepted out-of-range order (${effectiveDistance ? effectiveDistance.toFixed(1) : "10+"} km > 10 km limit) by ${auth.user?.name || "Manager"}`
          : (status === "cancelled" ? (cancellationReason || "Cancelled by restaurant staff") : ""));

      if (typeof order.addStatusTransition === "function") {
        order.addStatusTransition(
          status,
          {
            userId: auth.user?._id,
            role: auth.user?.role || "restaurant_admin",
            name: auth.user?.name || "Restaurant Staff",
          },
          transitionNote
        );
      } else {
        order.status = status;
      }

      // Explicit guarantee: activate live tracking and assign driver on out_for_delivery
      if (status === "out_for_delivery") {
        const isPickup = typeof order.isPickupOrder === "function" ? order.isPickupOrder() : false;
        if (!isPickup) {
          if (typeof order.startDeliveryTracking === "function") {
            order.startDeliveryTracking({
              userId: auth.user?._id,
              role: auth.user?.role || "restaurant_staff",
              name: auth.user?.name || "Delivery Staff",
            });
          } else {
            order.deliveryTracking = order.deliveryTracking || {};
            order.deliveryTracking.isLive = true;
            order.deliveryTracking.startedAt = order.deliveryTracking.startedAt || new Date();
            order.deliveryTracking.endedAt = null;
            order.deliveryTracking.endReason = null;
          }
        }
        if (!order.assignedDeliveryStaff?.id && auth.user?._id) {
          order.assignedDeliveryStaff = {
            id: auth.user._id,
            name: auth.user.name || "Delivery Staff",
            phone: auth.user.phone || "",
            email: auth.user.email || "",
            assignedAt: new Date(),
          };
        }
      } else if (["delivered", "cancelled"].includes(status)) {
        if (typeof order.stopDeliveryTracking === "function") {
          order.stopDeliveryTracking(status === "delivered" ? "delivered" : "cancelled");
        } else if (order.deliveryTracking) {
          order.deliveryTracking.isLive = false;
          order.deliveryTracking.endedAt = new Date();
          order.deliveryTracking.endReason = status === "delivered" ? "delivered" : "cancelled";
        }
      }
    }
    if (paymentStatus) {
      if (paymentStatus === "refunded" && order.refundDetails?.status !== "processed") {
        return NextResponse.json(
          { success: false, message: "Orders cannot be marked refunded without confirmed gateway refund." },
          { status: 400 }
        );
      }
      if (order.paymentStatus === "reconciliation_required" && paymentStatus !== order.paymentStatus) {
        return NextResponse.json(
          { success: false, message: "Order payment status is reconciliation_required and cannot be altered by restaurant admin." },
          { status: 400 }
        );
      }

      // Guard: Cash on delivery orders cannot be marked as paid before being picked up (must be out_for_delivery or delivered)
      const isCodMethod = String(order.paymentMethod || "").toLowerCase().includes("cod") || String(order.paymentMethod || "").toLowerCase().includes("cash");
      if (paymentStatus === "paid" && isCodMethod) {
        const targetStatus = status || order.status;
        if (targetStatus !== "out_for_delivery" && targetStatus !== "delivered") {
          return NextResponse.json(
            { success: false, message: "Cash on delivery orders cannot be marked as paid before being picked up for delivery." },
            { status: 400 }
          );
        }
      }

      order.paymentStatus = paymentStatus;
    }
    if (typeof notes === "string") order.notes = notes;
    if (assignedDeliveryStaff) {
      order.assignedDeliveryStaff = {
        id: assignedDeliveryStaff.id || auth.user?._id,
        name: assignedDeliveryStaff.name || auth.user?.name || "Delivery Staff",
        phone: assignedDeliveryStaff.phone || auth.user?.phone || "",
        email: assignedDeliveryStaff.email || auth.user?.email || "",
        assignedAt: new Date(),
      };
    }
    if (codPaymentHandler) {
      const isCollected = codPaymentHandler.collected !== undefined ? Boolean(codPaymentHandler.collected) : true;

      // Guard: Cash collection cannot be recorded before picking up the order
      if (isCollected) {
        const targetStatus = status || order.status;
        if (targetStatus !== "out_for_delivery" && targetStatus !== "delivered") {
          return NextResponse.json(
            { success: false, message: "Cash on delivery cannot be collected before the order is picked up for delivery." },
            { status: 400 }
          );
        }
      }

      order.codPaymentHandler = {
        id: codPaymentHandler.id || auth.user?._id,
        name: codPaymentHandler.name || auth.user?.name || "Delivery Staff",
        phone: codPaymentHandler.phone || auth.user?.phone || "",
        amount: Number(codPaymentHandler.amount !== undefined ? codPaymentHandler.amount : (order.totalAmount || 0)),
        collected: isCollected,
        collectedAt: codPaymentHandler.collectedAt || (isCollected ? new Date() : null),
        settledWithManager: codPaymentHandler.settledWithManager !== undefined
          ? Boolean(codPaymentHandler.settledWithManager)
          : Boolean(order.codPaymentHandler?.settledWithManager),
        settledAt: codPaymentHandler.settledWithManager ? (order.codPaymentHandler?.settledAt || new Date()) : null,
      };
      if (order.codPaymentHandler.collected) {
        order.paymentStatus = "paid";
      }
    }
    await order.save();

    let stockRestorationResult = null;
    let refundResult = null;
    if (status === "cancelled") {
      if (!order.stockRestored) {
        stockRestorationResult = await restoreStockForOrder(order);
      }

      // Execute refund if eligible
      const isRefundEligible =
        ['paid', 'refund_pending'].includes(order.paymentStatus) &&
        (order.paymentMethod?.toLowerCase().includes("razorpay") || order.paymentMethod?.toLowerCase().includes("online"));

      if (isRefundEligible) {
        if (order.refundDetails?.status !== 'processed') {
          try {
            refundResult = await executeOrderRefund({
              orderId: order._id,
              reason: notes || "Cancelled by restaurant admin",
              initiatedBy: "restaurant",
            });
          } catch (refErr) {
            console.warn(`[Restaurant Cancel] Refund warning for order ${order._id}:`, refErr.message);
            refundResult = { success: false, error: refErr.message };
          }
        } else {
          refundResult = { success: true, alreadyRefunded: true };
        }
      } else if (order.paymentStatus === 'reconciliation_required' || order.refundDetails?.status === 'reconciliation_required') {
        refundResult = {
          success: false,
          status: 'reconciliation_required',
          requiresManualReconciliation: true,
          message: 'Order is in reconciliation_required state. Refund redispatch is prohibited during cancellation.',
        };
      }
    }

    // Send Web Push notification if order status changed
    if (status && status !== previousStatus) {
      Order.findById(order._id)
        .populate('restaurant', 'name slug phone')
        .populate('user', 'name email phone')
        .then((populated) => {
          notifyOrderEvent(populated || order, 'status_update', {
            status,
            previousStatus,
            reason: notes,
          }).catch((pushErr) => {
            console.warn('[Order Update Push] Non-blocking push warning:', pushErr.message);
          });
        })
        .catch(() => {
          notifyOrderEvent(order, 'status_update', { status, previousStatus, reason: notes }).catch(() => {});
        });
    }

    const refreshedOrder = await Order.findById(order._id);

    let cancelMessage = "Order updated successfully";
    if (status === "cancelled") {
      cancelMessage = "Order cancelled successfully.";
      if (refundResult) {
        if (refundResult.success) {
          cancelMessage = "Order cancelled and refund processed successfully.";
        } else if (refundResult.requiresManualReconciliation || refundResult.status === "reconciliation_required") {
          cancelMessage = "Order cancelled. Refund outcome is uncertain and has been queued for manual reconciliation.";
        } else if (refundResult.status === "refund_pending") {
          cancelMessage = "Order cancelled. Refund is pending and has been queued for processing.";
        } else if (refundResult.inProgress) {
          cancelMessage = "Order cancelled. Refund is currently processing.";
        } else if (refundResult.status === "failed") {
          cancelMessage = `Order cancelled, but refund failed: ${refundResult.error || refundResult.message}.`;
        }
      }
    }

    if (status === "cancelled" && stockRestorationResult && !stockRestorationResult.success && !stockRestorationResult.alreadyRestored) {
      return NextResponse.json({
        success: true,
        orderCancelled: true,
        inventoryRestored: false,
        refund: refundResult,
        message: stockRestorationResult.requiresManualReconciliation
          ? "Order updated to cancelled, but inventory requires manual reconciliation."
          : stockRestorationResult.inProgress
          ? "Order updated to cancelled, but inventory restoration is currently in progress."
          : "Order updated to cancelled, but inventory restoration was incomplete.",
        order: refreshedOrder,
        stockRestoration: stockRestorationResult,
      });
    }

    return NextResponse.json({
      success: true,
      orderCancelled: status === "cancelled",
      inventoryRestored: status === "cancelled" ? true : undefined,
      refund: refundResult,
      message: cancelMessage,
      order: refreshedOrder,
      stockRestoration: stockRestorationResult,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const PATCH = PUT;

