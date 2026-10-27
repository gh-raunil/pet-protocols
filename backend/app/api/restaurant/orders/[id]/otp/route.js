import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { decryptOtpCode, issueDeliveryOtpForOrder } from "@/lib/deliveryOtpService";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

/**
 * GET — Dual-Party Authorized Handover OTP Retrieval
 *
 * Enforces:
 * - Scoped strictly to authenticated restaurant.
 * - Allowed ONLY for:
 *   1. The currently assigned delivery person.
 *   2. The authorized restaurant manager / admin (for coordination / customer support / self-delivery).
 * - Strictly rejects unrelated delivery drivers (403).
 * - Strictly rejects cross-restaurant managers (404/Isolated).
 * - Active only during 'out_for_delivery' transit status.
 */
export async function GET(request, { params }) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "orders_view" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const resolvedParams = params ? await params : {};
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findOne({ _id: id, restaurant: restaurantId }).select(
      "+deliveryOtp.codeDigest +deliveryOtp.encryptedCode"
    );

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found or does not belong to your restaurant." },
        { status: 404 }
      );
    }

    const isPickup = typeof order.isPickupOrder === "function" ? order.isPickupOrder() : order.orderType === "pickup";
    if (isPickup) {
      return NextResponse.json(
        { success: false, message: "Pickup orders do not use delivery handover OTP." },
        { status: 400 }
      );
    }

    if (["delivered", "cancelled"].includes(order.status)) {
      return NextResponse.json(
        {
          success: false,
          terminal: true,
          status: order.status,
          message: `Order is already ${order.status}. Handover OTP is no longer active.`,
        },
        { status: 400 }
      );
    }

    if (order.status !== "out_for_delivery") {
      return NextResponse.json(
        {
          success: false,
          notActiveYet: true,
          status: order.status,
          message: `Delivery handover OTP is only active while order is out for delivery. Current status: '${order.status}'.`,
        },
        { status: 400 }
      );
    }

    // Determine user authority
    const isLeadAdmin = auth.isAdmin || auth.user?.role === "restaurant_admin" || auth.user?.role === "admin";
    const userRoles = Array.isArray(auth.staffRoles) ? auth.staffRoles : (auth.user?.staffRoles || []);
    const isManager = isLeadAdmin || userRoles.includes("Manager");

    const assignedDriverId = order.assignedDeliveryStaff?.id?.toString();
    const currentUserId = auth.user?._id?.toString();
    const isAssignedDriver = assignedDriverId && assignedDriverId === currentUserId;
    const isManagerSelfDelivery = order.deliveryAssignmentMode === "manager_self_delivery";

    // Dual-party authorization rules:
    // 1. If manager-self-delivery: ONLY the manager who owns the restaurant/order can access
    if (isManagerSelfDelivery) {
      if (!isManager) {
        return NextResponse.json(
          {
            success: false,
            message: "Access denied. This order is a manager self-delivery. Delivery staff cannot access this OTP.",
          },
          { status: 403 }
        );
      }
    } else {
      // 2. If staff delivery: Either the assigned delivery driver OR the restaurant manager can access
      if (!isAssignedDriver && !isManager) {
        return NextResponse.json(
          {
            success: false,
            message: "Access denied. You are not the assigned delivery person or authorized manager for this order.",
          },
          { status: 403 }
        );
      }
    }

    // Ensure OTP is generated/active
    let otpData = order.deliveryOtp;
    if (!otpData?.encryptedCode || otpData.status !== "issued") {
      const issueRes = await issueDeliveryOtpForOrder(order, { forceRegenerate: false, requestedBy: "system" });
      if (!issueRes.success) {
        return NextResponse.json(
          { success: false, message: issueRes.message || "Failed to generate handover OTP." },
          { status: issueRes.status || 400 }
        );
      }
      return NextResponse.json({
        success: true,
        otpCode: issueRes.otpCode,
        issuanceId: issueRes.issuanceId,
        expiresAt: issueRes.expiresAt,
        status: issueRes.status,
        attemptCount: issueRes.attemptCount,
        maxAttempts: issueRes.maxAttempts,
        deliveryAssignmentMode: order.deliveryAssignmentMode || "staff",
        assignedDeliveryStaff: order.assignedDeliveryStaff,
      });
    }

    // Decrypt AES-256-GCM ciphertext bound to order ID and issuance ID
    const decrypted = decryptOtpCode(otpData.encryptedCode, {
      orderId: order._id,
      issuanceId: otpData.issuanceId,
    });

    if (!decrypted) {
      return NextResponse.json(
        { success: false, message: "Handover OTP payload verification failed. Please ask customer to reissue." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      otpCode: decrypted,
      issuanceId: otpData.issuanceId,
      expiresAt: otpData.expiresAt,
      status: otpData.status,
      attemptCount: otpData.attemptCount,
      maxAttempts: otpData.maxAttempts || 5,
      deliveryAssignmentMode: order.deliveryAssignmentMode || "staff",
      assignedDeliveryStaff: order.assignedDeliveryStaff,
    });
  } catch (error) {
    console.error("[Restaurant Order OTP GET Error]", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to retrieve handover OTP." },
      { status: 500 }
    );
  }
}
