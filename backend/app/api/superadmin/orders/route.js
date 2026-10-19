import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { requireSuperAdmin } from "@/lib/authMiddleware";
import { notifyOrderEvent } from "@/lib/pushService";
import { restoreStockForOrder } from "@/lib/inventoryService";
import { executeOrderRefund, retryFailedDeduction, reconcileOrderRefund } from "@/lib/refundService";

let _requireSuperAdmin = requireSuperAdmin;
export function _setTestRequireSuperAdmin(fn) {
  _requireSuperAdmin = fn;
}

// GET — List all platform orders across all restaurants
export async function GET(request) {
  try {
    const auth = await _requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const restaurantId = searchParams.get("restaurantId")?.trim() || "";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const query = {};

    if (restaurantId && restaurantId !== "all") {
      query.restaurant = restaurantId;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { orderId: regex },
        { "address.fullName": regex },
        { "address.phone": regex },
      ];
    }

    const orders = await Order.find(query)
      .populate("restaurant", "name slug phone")
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      orders,
      total: orders.length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH — Superadmin update order status or resolution notes
export async function PATCH(request) {
  try {
    const auth = await _requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { orderId, status, notes, action } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Order ID is required." },
        { status: 400 }
      );
    }

    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }

    // Direct action support: refund, reconcile_refund, or retry_inventory
    if (action === "refund") {
      if (
        order.paymentStatus === "reconciliation_required" ||
        order.refundDetails?.status === "reconciliation_required" ||
        order.refundDetails?.requiresManualReconciliation
      ) {
        return NextResponse.json({
          success: false,
          message: "Order requires manual reconciliation. Direct refund redispatch is prohibited to prevent duplicate payouts.",
        }, { status: 400 });
      }

      const refundResult = await executeOrderRefund({
        orderId: order._id,
        reason: notes || "Manual refund triggered by Super Admin",
        initiatedBy: "superadmin",
      });
      const refreshedOrder = await Order.findById(order._id);
      return NextResponse.json({
        success: refundResult.success,
        refund: refundResult,
        order: refreshedOrder,
        message: refundResult.message,
      }, { status: refundResult.success ? 200 : 400 });
    }

    if (action === "reconcile_refund") {
      const { refundId: reqRefundId } = body;
      const reconResult = await reconcileOrderRefund({
        orderId: order._id,
        refundId: reqRefundId,
        initiatedBy: "superadmin",
      });
      const refreshedOrder = await Order.findById(order._id);
      return NextResponse.json({
        success: reconResult.success,
        refund: reconResult,
        order: refreshedOrder,
        message: reconResult.message,
      }, { status: reconResult.success ? 200 : 400 });
    }

    if (action === "retry_inventory") {
      const retryResult = await retryFailedDeduction({
        orderId: order._id,
        initiatedBy: "superadmin",
      });
      const refreshedOrder = await Order.findById(order._id);
      return NextResponse.json({
        success: retryResult.success,
        result: retryResult,
        order: refreshedOrder,
        message: retryResult.message,
      }, { status: retryResult.success ? 200 : 400 });
    }

    const previousStatus = order.status;

    if (status) {
      if (!["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"].includes(status)) {
        return NextResponse.json({ success: false, message: `Invalid status '${status}'.` }, { status: 400 });
      }

      // Safeguard against invalid state regressions
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
            role: "superadmin",
            name: auth.user?.name || "Super Admin",
          },
          notes || (status === "cancelled" ? "Cancelled by Super Admin" : "")
        );
      } else {
        order.status = status;
      }
    }

    if (notes !== undefined) {
      order.notes = notes;
    }

    await order.save();

    // If order was transitioned to cancelled, restore stock exactly once via hardened inventory service
    let stockRestorationResult = null;
    let refundResult = null;
    if (status === "cancelled") {
      if (!order.stockRestored) {
        stockRestorationResult = await restoreStockForOrder(order);
        if (!stockRestorationResult.success && !stockRestorationResult.alreadyRestored && !stockRestorationResult.inProgress) {
          console.warn(`[Superadmin Cancel] Stock restoration warning for order ${order._id}:`, stockRestorationResult.message || stockRestorationResult.error);
        }
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
              reason: notes || "Cancelled by Super Admin",
              initiatedBy: "superadmin",
            });
          } catch (refErr) {
            console.warn(`[Superadmin Cancel] Refund warning for order ${order._id}:`, refErr.message);
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

    if (status && status !== previousStatus) {
      notifyOrderEvent(order, 'status_update', { status, reason: notes, notifyRestaurant: true }).catch(() => {});
    }

    const refreshedOrder = await Order.findById(order._id);

    let cancelMessage = "Order updated successfully by Super Admin.";
    if (status === "cancelled") {
      cancelMessage = "Order cancelled successfully by Super Admin.";
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
          ? "Order cancelled by Super Admin, but inventory requires manual reconciliation."
          : stockRestorationResult.inProgress
          ? "Order cancelled by Super Admin, but inventory restoration is currently in progress."
          : "Order cancelled by Super Admin, but inventory restoration was incomplete.",
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
