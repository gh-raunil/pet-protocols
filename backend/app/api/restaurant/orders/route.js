import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { restoreStockForOrder } from "@/lib/inventoryService";
import { executeOrderRefund, retryFailedDeduction } from "@/lib/refundService";
import { notifyOrderEvent } from "@/lib/pushService";

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
        { "address.phone": { $regex: escapeRegex(stripped), $options: "i" } },
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
      .sort({ createdAt: -1 })
      .lean();

    // Fallback: If searching by orderId or customer and 0 results found in filtered date range, search across all dates
    if (orders.length === 0 && searchQuery && filter.createdAt) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.createdAt;
      orders = await Order.find(fallbackFilter)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .lean();
    }

    return NextResponse.json({
      success: true,
      orders,
      restaurantCreatedAt: restaurant?.createdAt || null,
      restaurantName: restaurant?.name || "",
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
    const { orderId, status, paymentStatus, notes, assignedDeliveryStaff, codPaymentHandler, action } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    await connectDB();

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

    if (!status && !paymentStatus && notes === undefined && !assignedDeliveryStaff && !codPaymentHandler) {
      return NextResponse.json({ success: false, message: "At least one field must be provided." }, { status: 400 });
    }

    const previousStatus = order.status;
    if (status) {
      if (!["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"].includes(status)) {
        return NextResponse.json({ success: false, message: `Invalid status '${status}'.` }, { status: 400 });
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

      if (typeof order.addStatusTransition === "function") {
        order.addStatusTransition(
          status,
          {
            userId: auth.user?._id,
            role: auth.user?.role || "restaurant_admin",
            name: auth.user?.name || "Restaurant Staff",
          },
          notes || (status === "cancelled" ? "Cancelled by restaurant staff" : "")
        );
      } else {
        order.status = status;
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
      order.codPaymentHandler = {
        id: codPaymentHandler.id || auth.user?._id,
        name: codPaymentHandler.name || auth.user?.name || "Staff",
        phone: codPaymentHandler.phone || auth.user?.phone || "",
        collected: codPaymentHandler.collected !== undefined ? codPaymentHandler.collected : true,
        collectedAt: new Date(),
      };
      if (codPaymentHandler.collected) {
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

