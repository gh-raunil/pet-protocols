import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import Waste from "@/models/Waste";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { restoreStockForOrder } from "@/lib/inventoryService";
import { executeOrderRefund, retryFailedDeduction } from "@/lib/refundService";
import { notifyOrderEvent, sendPushToUser } from "@/lib/pushService";
import { getOrderDistanceInfo } from "@/lib/geoDistance";
import { processStalePickupOrders, logWasteForOrder } from "@/lib/orderMaintenanceService";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

// GET — List orders for this restaurant (Strictly Read-Only)
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

    if (action === "dismiss_stale_pickups") {
      if (auth.isStaff && !auth.isAdmin && !auth.staffRoles.includes("Manager")) {
        return NextResponse.json(
          { success: false, message: "Only managers or restaurant admins can trigger stale pickup maintenance." },
          { status: 403 }
        );
      }
      await connectDB();
      const maintenanceRes = await processStalePickupOrders({ restaurantId });
      return NextResponse.json({
        success: true,
        message: `Processed stale pickup maintenance: ${maintenanceRes.processedCount} order(s) cancelled.`,
        results: maintenanceRes,
      });
    }

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
    const isPickup = typeof order.isPickupOrder === "function" ? order.isPickupOrder() : order.orderType === "pickup";

    if (status) {
      if (!["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"].includes(status)) {
        return NextResponse.json({ success: false, message: `Invalid status '${status}'.` }, { status: 400 });
      }

      // Pickup orders cannot transition to out_for_delivery
      if (status === "out_for_delivery" && isPickup) {
        return NextResponse.json(
          { success: false, message: "Pickup orders do not transition to 'out_for_delivery'. Mark as 'ready' and 'delivered' at counter." },
          { status: 400 }
        );
      }

      // Rule #3: Default-deny role-based transition guard for staff
      if (auth.isStaff && !auth.isAdmin) {
        const userRoles = Array.isArray(auth.staffRoles) ? auth.staffRoles : [];
        const isManager = userRoles.includes("Manager");

        if (!isManager) {
          const allowedTransitions = new Set();

          for (const role of userRoles) {
            if (role === "Kitchen") {
              ["confirmed", "preparing", "ready", "cancelled"].forEach((s) => allowedTransitions.add(s));
            } else if (role === "Delivery") {
              ["out_for_delivery", "delivered"].forEach((s) => allowedTransitions.add(s));
            } else if (role === "Cashier") {
              if (isPickup) {
                ["confirmed", "ready", "delivered"].forEach((s) => allowedTransitions.add(s));
              }
            }
          }

          if (!allowedTransitions.has(status)) {
            return NextResponse.json(
              {
                success: false,
                message: `Access denied. Staff role(s) [${userRoles.join(", ")}] not authorized to transition ${isPickup ? "pickup" : "delivery"} order to '${status}'.`,
              },
              { status: 403 }
            );
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
    }

    // Driver assignment validation (Rule #4 & Finding B & G)
    let validatedDriverDoc = null;
    if (assignedDeliveryStaff && assignedDeliveryStaff.id) {
      const driverUser = await User.findOne({
        _id: assignedDeliveryStaff.id,
        restaurant: restaurantId,
        role: "staff",
        staffRoles: "Delivery",
        status: "active",
      });
      if (!driverUser) {
        return NextResponse.json(
          { success: false, message: "Selected staff member is not an active delivery driver for this restaurant." },
          { status: 400 }
        );
      }
      validatedDriverDoc = {
        id: driverUser._id,
        name: driverUser.name,
        phone: driverUser.phone || "",
        email: driverUser.email || "",
        assignedAt: new Date(),
      };
    } else if (status === "out_for_delivery" && !order.assignedDeliveryStaff?.id) {
      // If no driver specified and order has no assigned driver:
      // Only auto-assign if the actor is an actual delivery driver self-dispatching
      const isActorDriver = auth.isStaff && Array.isArray(auth.staffRoles) && auth.staffRoles.includes("Delivery");
      if (isActorDriver && !isPickup) {
        validatedDriverDoc = {
          id: auth.user._id,
          name: auth.user.name || "Delivery Staff",
          phone: auth.user.phone || "",
          email: auth.user.email || "",
          assignedAt: new Date(),
        };
      }
      // If manager dispatches, validatedDriverDoc remains null so the delivery driver can claim on first GPS ping
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

      // Guard: Cash on delivery/pickup orders validation (Finding E)
      const isCodMethod = String(order.paymentMethod || "").toLowerCase().includes("cod") || String(order.paymentMethod || "").toLowerCase().includes("cash");
      if (paymentStatus === "paid" && isCodMethod) {
        const targetStatus = status || order.status;
        if (isPickup) {
          if (!["confirmed", "ready", "delivered"].includes(targetStatus)) {
            return NextResponse.json(
              { success: false, message: "Cash on pickup cannot be marked as paid before the order is ready or delivered." },
              { status: 400 }
            );
          }
        } else {
          if (targetStatus !== "out_for_delivery" && targetStatus !== "delivered") {
            return NextResponse.json(
              { success: false, message: "Cash on delivery orders cannot be marked as paid before being picked up for delivery." },
              { status: 400 }
            );
          }
        }
      }
    }

    if (codPaymentHandler) {
      const isCollected = codPaymentHandler.collected !== undefined ? Boolean(codPaymentHandler.collected) : true;
      if (isCollected) {
        const targetStatus = status || order.status;
        if (isPickup) {
          if (!["confirmed", "ready", "delivered"].includes(targetStatus)) {
            return NextResponse.json(
              { success: false, message: "Cash on pickup cannot be collected before the order is ready or delivered." },
              { status: 400 }
            );
          }
        } else {
          if (targetStatus !== "out_for_delivery" && targetStatus !== "delivered") {
            return NextResponse.json(
              { success: false, message: "Cash on delivery cannot be collected before the order is picked up for delivery." },
              { status: 400 }
            );
          }
        }
      }
    }

    const distInfo = getOrderDistanceInfo(order, auth.restaurant);
    const effectiveDistance = deliveryDistanceKm ?? distInfo.distanceKm;

    const transitionNote =
      notes ||
      (acceptedOutOfRange
        ? `Accepted out-of-range order (${effectiveDistance ? effectiveDistance.toFixed(1) : "10+"} km > 10 km limit) by ${auth.user?.name || "Manager"}`
        : (status === "cancelled" ? (cancellationReason || "Cancelled by restaurant staff") : ""));

    // Rule #6: Atomic conditional state update to prevent race conditions & lost updates
    const atomicQuery = {
      _id: order._id,
      restaurant: restaurantId,
      status: previousStatus,
    };

    const setFields = {};
    if (status) {
      setFields.status = status;
    }
    if (paymentStatus) {
      setFields.paymentStatus = paymentStatus;
    }
    if (typeof notes === "string") {
      setFields.notes = notes;
    }
    if (acceptedOutOfRange) {
      setFields.acceptedOutOfRange = true;
      setFields.isOutOfRange = true;
      setFields.deliveryDistanceKm = effectiveDistance ?? order.deliveryDistanceKm;
      setFields.acceptedOutOfRangeBy = {
        userId: auth.user?._id ? String(auth.user._id) : null,
        name: auth.user?.name || "Manager",
        role: auth.user?.role || "restaurant_admin",
        acceptedAt: new Date(),
      };
    }
    if (cancellationReason) {
      setFields.cancellationReason = cancellationReason;
    }

    if (status === "out_for_delivery" && !isPickup) {
      setFields["deliveryTracking.isLive"] = true;
      setFields["deliveryTracking.startedAt"] = order.deliveryTracking?.startedAt || new Date();
      setFields["deliveryTracking.endedAt"] = null;
      setFields["deliveryTracking.endReason"] = null;
    } else if (["delivered", "cancelled"].includes(status)) {
      setFields["deliveryTracking.isLive"] = false;
      setFields["deliveryTracking.endedAt"] = new Date();
      setFields["deliveryTracking.endReason"] = status === "delivered" ? "delivered" : "cancelled";
    }

    if (validatedDriverDoc) {
      setFields.assignedDeliveryStaff = validatedDriverDoc;
    }

    if (codPaymentHandler) {
      const isCollected = codPaymentHandler.collected !== undefined ? Boolean(codPaymentHandler.collected) : true;
      setFields.codPaymentHandler = {
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
      if (isCollected) {
        setFields.paymentStatus = "paid";
      }
    }

    const updateOperation = {
      $set: setFields,
      $inc: { __v: 1 },
    };

    if (status && status !== previousStatus) {
      updateOperation.$push = {
        statusHistory: {
          status,
          changedAt: new Date(),
          changedBy: {
            userId: auth.user?._id,
            role: auth.user?.role || "restaurant_admin",
            name: auth.user?.name || "Restaurant Staff",
          },
          note: transitionNote,
        },
      };
    }

    const updatedOrder = await Order.findOneAndUpdate(atomicQuery, updateOperation, { returnDocument: "after" });

    if (!updatedOrder) {
      return NextResponse.json(
        {
          success: false,
          conflict: true,
          message: `Conflict: Order status was concurrently modified from '${previousStatus}'. Please reload and retry.`,
        },
        { status: 409 }
      );
    }

    // Side effects executed strictly AFTER atomic state transition commits
    let stockRestorationResult = null;
    let refundResult = null;

    if (status === "cancelled") {
      const isPreparedFood = ["ready", "out_for_delivery", "preparing"].includes(previousStatus);

      if (isPreparedFood) {
        // Rule #2: Prepared food is discarded. Log Waste; do not restore raw stock
        await Order.updateOne(
          { _id: updatedOrder._id },
          { $set: { stockRestored: true, "stockRestoration.status": "completed", "wasteLogging.status": "pending" } }
        );
        const wasteRes = await logWasteForOrder(updatedOrder, {
          reasonNote: `Prepared food discarded on cancellation of order #${updatedOrder.orderId || updatedOrder._id} (prior status: ${previousStatus})`,
        });
        stockRestorationResult = { success: wasteRes.success, message: "Prepared food discarded and logged as waste." };
      } else if (!updatedOrder.stockRestored) {
        // Unprepared order: restore raw ingredient stock safely
        stockRestorationResult = await restoreStockForOrder(updatedOrder);
      }

      // Rule #1: Execute safe full-refund if eligible
      const isRefundEligible =
        ['paid', 'refund_pending'].includes(updatedOrder.paymentStatus) &&
        (updatedOrder.paymentMethod?.toLowerCase().includes("razorpay") || updatedOrder.paymentMethod?.toLowerCase().includes("online"));

      if (isRefundEligible) {
        if (updatedOrder.refundDetails?.status !== 'processed') {
          try {
            refundResult = await executeOrderRefund({
              orderId: updatedOrder._id,
              reason: transitionNote || "Cancelled by restaurant staff",
              initiatedBy: "restaurant",
            });
          } catch (refErr) {
            console.warn(`[Restaurant Cancel] Refund warning for order ${updatedOrder._id}:`, refErr.message);
            refundResult = { success: false, error: refErr.message };
          }
        } else {
          refundResult = { success: true, alreadyRefunded: true };
        }
      } else if (updatedOrder.paymentStatus === 'reconciliation_required' || updatedOrder.refundDetails?.status === 'reconciliation_required') {
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
      Order.findById(updatedOrder._id)
        .populate('restaurant', 'name slug phone')
        .populate('user', 'name email phone')
        .then((populated) => {
          notifyOrderEvent(populated || updatedOrder, 'status_update', {
            status,
            previousStatus,
            reason: transitionNote,
          }).catch((pushErr) => {
            console.warn('[Order Update Push] Non-blocking push warning:', pushErr.message);
          });
        })
        .catch(() => {
          notifyOrderEvent(updatedOrder, 'status_update', { status, previousStatus, reason: transitionNote }).catch(() => {});
        });
    }

    const refreshedOrder = await Order.findById(updatedOrder._id);

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


