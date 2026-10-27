import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueDeliveryOtpForOrder, getDeliveryOtpSecret } from "@/lib/deliveryOtpService";
import {
  hashGuestAccessToken,
  extractGuestAccessToken,
  buildGuestOrderQuery,
} from "@/lib/guestAccessService";

let _getServerSession = getServerSession;
export function _setTestGetServerSession(fn) {
  _getServerSession = fn;
}

async function resolveSession() {
  try {
    return await _getServerSession(authOptions);
  } catch {
    return null;
  }
}

/**
 * GET — Authenticated Customer Handover OTP Retrieval
 * Strictly owner-scoped. Returns the plaintext 4-digit OTP for active delivery orders.
 */
export async function GET(request, { params }) {
  try {
    const session = await resolveSession();
    const guestToken = extractGuestAccessToken(request);

    if (!session?.user && !guestToken) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please log in or provide guest access token." }, { status: 401 });
    }

    const resolvedParams = params ? await params : {};
    const { id } = resolvedParams;
    if (!id) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    await connectDB();

    const isObjectId = id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
    const orderIdentifierFilter = {
      $or: [{ orderId: id }, ...(isObjectId ? [{ _id: id }] : [])],
    };

    let query = {};
    const userRole = session?.user?.role;

    if (userRole === "superadmin") {
      query = orderIdentifierFilter;
    } else if (userRole === "restaurant_admin" || userRole === "staff") {
      const dbUser = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!dbUser) {
        return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      }

      const targetOrder = await Order.findOne(orderIdentifierFilter).select("+deliveryOtp.codeDigest +deliveryOtp.encryptedCode");
      if (!targetOrder) {
        return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
      }

      // Check tenant match
      const orderRestId = targetOrder.restaurant?.toString();
      const userRestId = dbUser.restaurant?.toString();
      if (!userRestId || orderRestId !== userRestId) {
        return NextResponse.json(
          { success: false, message: "Access denied. Order belongs to another restaurant." },
          { status: 403 }
        );
      }

      const isManager = userRole === "restaurant_admin" || (Array.isArray(dbUser.staffRoles) && dbUser.staffRoles.includes("Manager")) || dbUser.staffRole === "Manager";
      const assignedDriverId = targetOrder.assignedDeliveryStaff?.id?.toString();
      const isAssignedDriver = assignedDriverId && assignedDriverId === dbUser._id.toString();

      // Dual-party authorization:
      if (targetOrder.deliveryAssignmentMode === "manager_self_delivery") {
        if (!isManager) {
          return NextResponse.json(
            { success: false, message: "Access denied. This is a manager self-delivery order." },
            { status: 403 }
          );
        }
      } else {
        if (!isAssignedDriver && !isManager) {
          return NextResponse.json(
            { success: false, message: "Access denied. Only the assigned delivery person or restaurant manager can access the handover OTP." },
            { status: 403 }
          );
        }
      }

      query = { _id: targetOrder._id };
    } else if (session?.user) {
      // Customer: strictly enforce ownership via customer user ID.
      // Phone matching against guest orders is strictly removed to prevent account spoofing.
      const dbUser = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!dbUser) {
        return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      }

      let customerOwnership;
      if (guestToken) {
        customerOwnership = {
          $or: [
            { user: dbUser._id },
            buildGuestOrderQuery(hashGuestAccessToken(guestToken)),
          ],
        };
      } else {
        customerOwnership = { user: dbUser._id };
      }

      query = {
        $and: [
          orderIdentifierFilter,
          customerOwnership,
        ],
      };
    } else {
      // Guest: authorized strictly via validated guest access token
      query = {
        $and: [
          orderIdentifierFilter,
          buildGuestOrderQuery(hashGuestAccessToken(guestToken)),
        ],
      };
    }

    const order = await Order.findOne(query).select("+deliveryOtp.codeDigest +deliveryOtp.encryptedCode");
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found or access denied." }, { status: 404 });
    }

    const isPickup = typeof order.isPickupOrder === "function" ? order.isPickupOrder() : Order.isPickupOrder(order);
    if (isPickup) {
      return NextResponse.json(
        { success: false, message: "Pickup orders do not require delivery handover OTP." },
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
          message: "Delivery handover code will be generated once your order is picked up and out for delivery.",
        },
        { status: 200 }
      );
    }

    // Retrieve or issue active OTP
    const otpResult = await issueDeliveryOtpForOrder(order, { forceRegenerate: false, requestedBy: "customer" });
    if (!otpResult.success) {
      return NextResponse.json(
        { success: false, message: otpResult.message },
        { status: otpResult.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      otpCode: otpResult.otpCode,
      issuanceId: otpResult.issuanceId,
      expiresAt: otpResult.expiresAt,
      status: otpResult.status,
      attemptCount: otpResult.attemptCount,
      maxAttempts: otpResult.maxAttempts,
      reissueCooldownSeconds: 30,
    });
  } catch (err) {
    console.error("[Customer Handover OTP GET Error]", err);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

/**
 * POST — Reissue Delivery Handover OTP
 * Invalidates any prior active OTP code and generates a fresh 4-digit code.
 * Rate limited with 30s cooldown and cumulative max reissues.
 */
export async function POST(request, { params }) {
  try {
    const session = await resolveSession();
    const guestToken = extractGuestAccessToken(request);

    if (!session?.user && !guestToken) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please log in or provide guest access token." }, { status: 401 });
    }

    const resolvedParams = params ? await params : {};
    const { id } = resolvedParams;
    if (!id) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    await connectDB();

    const isObjectId = id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
    const orderIdentifierFilter = {
      $or: [{ orderId: id }, ...(isObjectId ? [{ _id: id }] : [])],
    };

    let query = {};
    const userRole = session?.user?.role;

    if (userRole === "superadmin") {
      query = orderIdentifierFilter;
    } else if (userRole === "restaurant_admin" || userRole === "staff") {
      return NextResponse.json(
        { success: false, message: "Access denied. Restaurant and delivery staff cannot reissue customer handover OTPs." },
        { status: 403 }
      );
    } else if (session?.user) {
      const dbUser = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!dbUser) {
        return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      }

      let customerOwnership;
      if (guestToken) {
        customerOwnership = {
          $or: [
            { user: dbUser._id },
            buildGuestOrderQuery(hashGuestAccessToken(guestToken)),
          ],
        };
      } else {
        customerOwnership = { user: dbUser._id };
      }

      query = {
        $and: [
          orderIdentifierFilter,
          customerOwnership,
        ],
      };
    } else {
      // Guest: authorized strictly via validated guest access token
      query = {
        $and: [
          orderIdentifierFilter,
          buildGuestOrderQuery(hashGuestAccessToken(guestToken)),
        ],
      };
    }

    const order = await Order.findOne(query).select("+deliveryOtp.codeDigest +deliveryOtp.encryptedCode");
    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found or access denied." }, { status: 404 });
    }

    const isPickup = typeof order.isPickupOrder === "function" ? order.isPickupOrder() : Order.isPickupOrder(order);
    if (isPickup) {
      return NextResponse.json(
        { success: false, message: "Pickup orders do not require delivery handover OTP." },
        { status: 400 }
      );
    }

    if (order.status !== "out_for_delivery") {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot reissue handover OTP for order in status '${order.status}'. Handover code is only available while out for delivery.`,
        },
        { status: 400 }
      );
    }

    // Force regeneration
    const otpResult = await issueDeliveryOtpForOrder(order, { forceRegenerate: true, requestedBy: "customer" });
    if (!otpResult.success) {
      return NextResponse.json(
        { success: false, message: otpResult.message },
        { status: otpResult.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      reissued: true,
      otpCode: otpResult.otpCode,
      issuanceId: otpResult.issuanceId,
      expiresAt: otpResult.expiresAt,
      status: otpResult.status,
      attemptCount: otpResult.attemptCount,
      maxAttempts: otpResult.maxAttempts,
      reissueCooldownSeconds: 30,
      message: "New delivery handover code issued. Prior code has been invalidated.",
    });
  } catch (err) {
    console.error("[Customer Handover OTP POST Error]", err);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
