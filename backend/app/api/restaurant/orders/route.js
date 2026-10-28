import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import Waste from "@/models/Waste";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { restoreStockForOrder } from "@/lib/inventoryService";
import { executeOrderRefund, retryFailedDeduction } from "@/lib/refundService";
import { notifyOrderEvent, sendPushToUser } from "@/lib/pushService";
import { enqueueOrderEvents } from "@/lib/notificationOutboxService";
import { getOrderDistanceInfo } from "@/lib/geoDistance";
import { processStalePickupOrders, logWasteForOrder } from "@/lib/orderMaintenanceService";
import { verifyAndCompleteDelivery, issueDeliveryOtpForOrder } from "@/lib/deliveryOtpService";

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

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const paymentStatusParam = searchParams.get("paymentStatus");
    const orderTypeParam = searchParams.get("orderType");

    if (paymentStatusParam && paymentStatusParam !== "all") {
      filter.paymentStatus = paymentStatusParam;
    }
    if (orderTypeParam && orderTypeParam !== "all") {
      filter.orderType = orderTypeParam;
    }

    let sortObj = {};
    if (sortBy === "amount" || sortBy === "totalAmount") {
      sortObj.totalAmount = sortOrder;
    } else {
      sortObj.createdAt = sortOrder;
    }
    sortObj._id = sortOrder;

    let totalOrders = await Order.countDocuments(filter);
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
    const limit = limitParam === "all" ? 0 : (limitParam ? Math.max(1, parseInt(limitParam, 10) || 25) : 0);
    let totalPages = limit > 0 ? Math.ceil(totalOrders / limit) : 1;

    let query = Order.find(filter)
      .populate("user", "name email phone")
      .populate("restaurant", "name slug phone address deliverySettings")
      .sort(sortObj);

    if (limit > 0) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    let orders = await query.lean();

    // Fallback: If searching by orderId or customer and 0 results found in filtered date range, search across all dates
    if (orders.length === 0 && searchQuery && filter.createdAt) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.createdAt;
      totalOrders = await Order.countDocuments(fallbackFilter);
      totalPages = limit > 0 ? Math.ceil(totalOrders / limit) : 1;

      let fallbackQuery = Order.find(fallbackFilter)
        .populate("user", "name email phone")
        .populate("restaurant", "name slug phone address deliverySettings")
        .sort(sortObj);

      if (limit > 0) {
        fallbackQuery = fallbackQuery.skip((page - 1) * limit).limit(limit);
      }

      orders = await fallbackQuery.lean();
    }

    // Attach delivery distance and out-of-range indicators, ensuring restaurant coordinates
    orders = orders.map((order) => {
      const distInfo = getOrderDistanceInfo(order, restaurant);
      const restObj = order.restaurant || restaurant;
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
      totalOrders: totalOrders ?? orders.length,
      totalPages: totalPages ?? 1,
      currentPage: page ?? 1,
      limit: limit || orders.length,
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

      const rawTargetIds = Array.isArray(orderIds) && orderIds.length > 0
        ? orderIds
        : (orderId ? [orderId] : []);

      if (rawTargetIds.length === 0) {
        return NextResponse.json({ success: false, message: "Order ID(s) required." }, { status: 400 });
      }

      // Deduplicate IDs and validate 24-character hexadecimal ObjectId format
      const targetOrderIds = [];
      const skippedOrders = [];

      for (const rawId of rawTargetIds) {
        const strId = String(rawId || "").trim();
        if (/^[0-9a-fA-F]{24}$/.test(strId)) {
          if (!targetOrderIds.includes(strId)) {
            targetOrderIds.push(strId);
          }
        } else {
          skippedOrders.push({
            orderId: strId,
            reason: "invalid_id_format",
            message: "Order ID is not a valid 24-character hexadecimal ObjectId.",
          });
        }
      }

      if (targetOrderIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "No valid order IDs provided to settle.",
            settledCount: 0,
            skippedCount: skippedOrders.length,
            skippedOrders,
          },
          { status: 400 }
        );
      }

      // Pre-fetch candidate documents across requested IDs to categorize ineligibility reasons
      const candidateOrders = await Order.find({ _id: { $in: targetOrderIds } }).lean();
      const ordersMap = new Map(candidateOrders.map((o) => [o._id.toString(), o]));

      const eligibleCandidates = [];

      for (const tId of targetOrderIds) {
        const ord = ordersMap.get(tId);
        if (!ord) {
          skippedOrders.push({
            orderId: tId,
            reason: "not_found",
            message: "Order does not exist.",
          });
          continue;
        }

        if (ord.restaurant?.toString() !== restaurantId.toString()) {
          skippedOrders.push({
            orderId: tId,
            reason: "cross_restaurant_forbidden",
            message: "Order belongs to another restaurant. Access denied.",
          });
          continue;
        }

        const isCod = typeof Order.isCodOrder === "function" ? Order.isCodOrder(ord) : /cod|cash/i.test(ord.paymentMethod || "");
        if (!isCod) {
          skippedOrders.push({
            orderId: tId,
            reason: "not_cod_payment",
            message: `Order payment method is '${ord.paymentMethod || "unknown"}'. Only COD/cash orders can be settled.`,
          });
          continue;
        }

        if (ord.status === "cancelled") {
          skippedOrders.push({
            orderId: tId,
            reason: "order_cancelled",
            message: "Cancelled orders cannot be settled for COD cash.",
          });
          continue;
        }

        if (["refunded", "failed"].includes(ord.paymentStatus)) {
          skippedOrders.push({
            orderId: tId,
            reason: "ineligible_payment_status",
            message: `Order payment status is '${ord.paymentStatus}'. Ineligible for COD cash settlement.`,
          });
          continue;
        }

        if (ord.codPaymentHandler?.collected !== true) {
          skippedOrders.push({
            orderId: tId,
            reason: "cash_not_collected",
            message: "Cash collection has not been recorded by delivery staff for this order.",
          });
          continue;
        }

        if (ord.codPaymentHandler?.settledWithManager === true) {
          skippedOrders.push({
            orderId: tId,
            reason: "already_settled",
            message: "Order COD cash has already been settled with manager.",
          });
          continue;
        }

        eligibleCandidates.push(ord);
      }

      const settledAtTime = new Date();
      const managerInfo = {
        id: auth.user?._id,
        name: auth.user?.name || "Manager",
      };

      const settledOrders = [];

      // Concurrency-Safe Conditional Atomic Write per eligible order
      for (const candidate of eligibleCandidates) {
        const atomicQuery = {
          _id: candidate._id,
          restaurant: restaurantId,
          paymentMethod: { $regex: /cod|cash/i },
          status: { $ne: "cancelled" },
          paymentStatus: { $nin: ["refunded", "failed"] },
          "codPaymentHandler.collected": true,
          "codPaymentHandler.settledWithManager": { $ne: true },
        };

        const updateOp = {
          $set: {
            settledAt: settledAtTime,
            "codPaymentHandler.settledWithManager": true,
            "codPaymentHandler.settledAt": settledAtTime,
            "codPaymentHandler.settledBy": managerInfo,
          },
          $push: {
            statusHistory: {
              status: candidate.status,
              changedAt: settledAtTime,
              changedBy: {
                userId: auth.user?._id,
                role: auth.user?.role || "manager",
                name: auth.user?.name || "Manager",
              },
              note: `COD cash of ₹${Number(candidate.codPaymentHandler?.amount || candidate.totalAmount || 0).toFixed(2)} settled with manager ${managerInfo.name}`,
            },
          },
          $inc: { __v: 1 },
        };

        const updated = await Order.findOneAndUpdate(atomicQuery, updateOp, { returnDocument: "after" });
        if (updated) {
          settledOrders.push(updated);
        } else {
          // A concurrent manager request settled this order in the race window
          skippedOrders.push({
            orderId: candidate._id.toString(),
            reason: "concurrent_settlement_conflict",
            message: "Order was concurrently settled by another manager request.",
          });
        }
      }

      // Notify delivery staff member(s) that their cash handover was received & confirmed
      // ONLY notify for orders that were ACTUALLY settled in THIS transaction
      try {
        const staffMap = {};
        settledOrders.forEach((o) => {
          const handlerId = o.codPaymentHandler?.id;
          if (handlerId) {
            const hIdStr = handlerId.toString();
            if (!staffMap[hIdStr]) staffMap[hIdStr] = [];
            staffMap[hIdStr].push(o);
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

      // Single-order request handling
      if (!Array.isArray(orderIds) && orderId) {
        if (settledOrders.length === 1) {
          return NextResponse.json({
            success: true,
            message: "COD Cash marked as settled with manager.",
            settledCount: 1,
            skippedCount: 0,
            settledOrders: [settledOrders[0]._id.toString()],
            skippedOrders: [],
            order: settledOrders[0],
          });
        }

        const skipInfo = skippedOrders[0] || { reason: "settlement_failed", message: "Failed to settle COD cash." };
        let statusCode = 400;
        if (["not_found", "cross_restaurant_forbidden"].includes(skipInfo.reason)) {
          statusCode = 404;
        } else if (["already_settled", "concurrent_settlement_conflict"].includes(skipInfo.reason)) {
          statusCode = 409;
        }

        return NextResponse.json(
          {
            success: false,
            message: skipInfo.message,
            reason: skipInfo.reason,
            settledCount: 0,
            skippedCount: 1,
            skippedOrders,
          },
          { status: statusCode }
        );
      }

      // Batch array request handling
      if (settledOrders.length === 0) {
        const allAlreadySettled = skippedOrders.every(
          (s) => s.reason === "already_settled" || s.reason === "concurrent_settlement_conflict"
        );
        return NextResponse.json(
          {
            success: false,
            message: allAlreadySettled
              ? "All requested orders have already been settled with manager."
              : "No eligible orders were settled.",
            settledCount: 0,
            skippedCount: skippedOrders.length,
            skippedOrders,
          },
          { status: allAlreadySettled ? 409 : 400 }
        );
      }

      const refreshedOrder = orderId ? await Order.findById(orderId) : (settledOrders[0] || null);
      const batchMsg = skippedOrders.length > 0
        ? `Settled COD cash for ${settledOrders.length} order(s) with manager. (${skippedOrders.length} skipped as ineligible or already settled)`
        : `Settled COD cash for ${settledOrders.length} order(s) with manager.`;

      return NextResponse.json({
        success: true,
        message: batchMsg,
        settledCount: settledOrders.length,
        skippedCount: skippedOrders.length,
        settledOrders: settledOrders.map((o) => o._id.toString()),
        skippedOrders,
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

      // Mandatory Secure Handover Verification (OTP) for ordinary delivery completion
      if (status === "delivered" && !isPickup) {
        const otpCode = body.deliveryOtpCode || body.otpCode || body.code;
        if (!otpCode) {
          return NextResponse.json(
            {
              success: false,
              message: "Delivery orders require valid customer handover OTP verification by the assigned driver to be marked delivered.",
            },
            { status: 400 }
          );
        }

        const verificationResult = await verifyAndCompleteDelivery({
          orderId: order._id,
          restaurantId,
          staffUser: {
            ...(auth.user?.toObject ? auth.user.toObject() : auth.user),
            staffRoles: auth.staffRoles || auth.user?.staffRoles || [auth.user?.staffRole || "Delivery"],
          },
          otpCode,
          codPaymentHandler,
          transitionNote: notes || "Delivered to customer following successful OTP handover verification",
        });

        if (!verificationResult.success) {
          return NextResponse.json(
            {
              success: false,
              message: verificationResult.message,
              invalidCode: Boolean(verificationResult.invalidCode),
              remainingAttempts: verificationResult.remainingAttempts,
              codeExpired: Boolean(verificationResult.codeExpired),
              attemptsExceeded: Boolean(verificationResult.attemptsExceeded),
              conflict: Boolean(verificationResult.conflict),
            },
            { status: verificationResult.status || 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: verificationResult.message,
          order: verificationResult.order,
        });
      }
    }

    // Driver assignment & dispatch validation (Rules B, C, & D)
    let validatedDriverDoc = null;
    let validatedAssignmentMode = null;
    let validatedAssignmentStatus = null;

    if (body.action === "self_delivery" || body.selfDelivery === true) {
      const isLeadAdmin = auth.isAdmin || auth.user?.role === "restaurant_admin" || auth.user?.role === "admin";
      const userRoles = Array.isArray(auth.staffRoles) ? auth.staffRoles : (auth.user?.staffRoles || []);
      const isManager = isLeadAdmin || userRoles.includes("Manager");

      if (!isManager) {
        return NextResponse.json(
          { success: false, message: "Access denied. Only restaurant managers can select self-delivery." },
          { status: 403 }
        );
      }
      validatedDriverDoc = {
        id: auth.user._id,
        name: `${auth.user.name || "Manager"} (Self-Delivery)`,
        phone: auth.user.phone || "",
        email: auth.user.email || "",
        assignedAt: new Date(),
      };
      validatedAssignmentMode = "manager_self_delivery";
      validatedAssignmentStatus = "accepted";
    } else if (assignedDeliveryStaff && assignedDeliveryStaff.id) {
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
      validatedAssignmentMode = "staff";
      validatedAssignmentStatus = "assigned";
    } else if (status === "out_for_delivery") {
      // If no driver specified and order has no assigned driver, OR if driver explicitly self-picks up parcel (if manager assigns or not):
      const isActorDriver = auth.isStaff && Array.isArray(auth.staffRoles) && auth.staffRoles.includes("Delivery");
      if (isActorDriver && !isPickup) {
        if (!order.assignedDeliveryStaff?.id || body.selfPickup === true || body.claimSelf === true) {
          validatedDriverDoc = {
            id: auth.user._id,
            name: auth.user.name || "Delivery Staff",
            phone: auth.user.phone || "",
            email: auth.user.email || "",
            assignedAt: new Date(),
          };
          validatedAssignmentMode = "staff";
          validatedAssignmentStatus = "accepted";
        }
      }
    }

    // Rule B & D Dispatch Authorization Guard:
    if (status === "out_for_delivery" && !isPickup) {
      const effectiveDriverId = validatedDriverDoc?.id || order.assignedDeliveryStaff?.id;
      if (!effectiveDriverId) {
        return NextResponse.json(
          {
            success: false,
            message: "Cannot dispatch delivery order without an assigned delivery person. Please assign a delivery person or select 'Deliver This Order Myself' first.",
          },
          { status: 400 }
        );
      }

      // Rule D: If actor is non-manager delivery staff, they MUST be the currently assigned driver
      const isLeadAdmin = auth.isAdmin || auth.user?.role === "restaurant_admin" || auth.user?.role === "admin";
      const userRoles = Array.isArray(auth.staffRoles) ? auth.staffRoles : (auth.user?.staffRoles || []);
      const isManager = isLeadAdmin || userRoles.includes("Manager");

      if (!isManager) {
        if (String(effectiveDriverId) !== String(auth.user._id)) {
          return NextResponse.json(
            { success: false, message: "Access denied. You are not the assigned delivery person for this order." },
            { status: 403 }
          );
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
      if (paymentStatus === "paid") {
        if (!order.paidAt) setFields.paidAt = new Date();
        if (!order.settledAt) setFields.settledAt = new Date();
      }
    }
    if (body.paymentMethod && typeof body.paymentMethod === "string") {
      setFields.paymentMethod = body.paymentMethod.trim();
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
      setFields.dispatchedAt = new Date();
      setFields.dispatchedBy = {
        id: auth.user?._id,
        name: auth.user?.name || "Staff",
        role: auth.user?.role || "restaurant_admin",
      };
      if (!order.assignmentStatus || order.assignmentStatus === "assigned") {
        setFields.assignmentStatus = "accepted";
      }
    } else if (["delivered", "cancelled"].includes(status)) {
      setFields["deliveryTracking.isLive"] = false;
      setFields["deliveryTracking.endedAt"] = new Date();
      setFields["deliveryTracking.endReason"] = status === "delivered" ? "delivered" : "cancelled";
    }

    if (validatedDriverDoc) {
      setFields.assignedDeliveryStaff = validatedDriverDoc;
      if (validatedAssignmentMode) {
        setFields.deliveryAssignmentMode = validatedAssignmentMode;
      }
      if (validatedAssignmentStatus) {
        setFields.assignmentStatus = validatedAssignmentStatus;
      }
      setFields.assignedBy = {
        id: auth.user?._id,
        name: auth.user?.name || "Manager",
        role: auth.user?.role || "restaurant_admin",
      };
    }

    if (codPaymentHandler) {
      const isCodOrder = typeof order.isCodOrder === "function" ? order.isCodOrder() : Order.isCodOrder(order);
      if (isCodOrder) {
        const isManagerOrAdmin = auth.isAdmin || (Array.isArray(auth.staffRoles) && auth.staffRoles.includes("Manager"));
        const isCollected = codPaymentHandler.collected !== undefined ? Boolean(codPaymentHandler.collected) : true;
        const allowSettlement = isManagerOrAdmin && Boolean(codPaymentHandler.settledWithManager);
        const settledState = allowSettlement
          ? true
          : Boolean(order.codPaymentHandler?.settledWithManager);

        const expectedAmount = Number.isFinite(order.totalAmount) && order.totalAmount >= 0 ? order.totalAmount : 0;

        setFields.codPaymentHandler = {
          id: auth.user?._id,
          name: auth.user?.name || "Delivery Staff",
          phone: auth.user?.phone || "",
          amount: expectedAmount,
          collected: isCollected,
          collectedAt: codPaymentHandler.collectedAt || (isCollected ? new Date() : null),
          settledWithManager: settledState,
          settledAt: settledState ? (order.codPaymentHandler?.settledAt || new Date()) : null,
          settledBy: allowSettlement
            ? { id: auth.user?._id, name: auth.user?.name || "Manager" }
            : (order.codPaymentHandler?.settledBy || null),
        };
        if (isCollected) {
          setFields.paymentStatus = "paid";
        }
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

    // Auto-issue active Delivery Handover OTP upon order dispatch
    if (status === "out_for_delivery" && !isPickup) {
      await issueDeliveryOtpForOrder(updatedOrder, { requestedBy: "system" }).catch((err) => {
        console.warn("[DeliveryOTP System Auto-Issuance Warning]", err.message);
      });
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

    // Send Web Push notification & persist Outbox event if order status changed
    if (status && status !== previousStatus) {
      Order.findById(updatedOrder._id)
        .populate('restaurant', 'name slug phone')
        .populate('user', 'name email phone')
        .then((populated) => {
          const target = populated || updatedOrder;
          notifyOrderEvent(target, 'status_update', {
            status,
            previousStatus,
            reason: transitionNote,
          }).catch((pushErr) => {
            console.warn('[Order Update Push] Non-blocking push warning:', pushErr.message);
          });
          enqueueOrderEvents(target, 'status_update', {
            status,
            previousStatus,
            reason: transitionNote,
            notifyRestaurant: status === 'cancelled',
          }).catch((outboxErr) => {
            console.warn('[Order Update Outbox] Non-blocking outbox warning:', outboxErr.message);
          });
        })
        .catch(() => {
          notifyOrderEvent(updatedOrder, 'status_update', { status, previousStatus, reason: transitionNote }).catch(() => {});
          enqueueOrderEvents(updatedOrder, 'status_update', { status, previousStatus, reason: transitionNote }).catch(() => {});
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


