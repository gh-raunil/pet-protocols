import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueDeliveryOtpForOrder, getDeliveryOtpSecret } from "@/lib/deliveryOtpService";

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
    if (!session || !session.user) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please log in." }, { status: 401 });
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
    const userRole = session.user.role;

    if (userRole === "superadmin") {
      query = orderIdentifierFilter;
    } else if (userRole === "restaurant_admin" || userRole === "staff") {
      return NextResponse.json(
        { success: false, message: "Access denied. Restaurant and delivery staff are prohibited from viewing customer handover OTPs." },
        { status: 403 }
      );
    } else {
      // Customer: strictly enforce ownership via user ID or address phone
      const dbUser = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!dbUser) {
        return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      }

      query = {
        $and: [
          orderIdentifierFilter,
          {
            $or: [
              { user: dbUser._id },
              ...(dbUser.phone ? [{ "address.phone": dbUser.phone }] : []),
            ],
          },
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
    if (!session || !session.user) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please log in." }, { status: 401 });
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
    const userRole = session.user.role;

    if (userRole === "superadmin") {
      query = orderIdentifierFilter;
    } else if (userRole === "restaurant_admin" || userRole === "staff") {
      return NextResponse.json(
        { success: false, message: "Access denied. Restaurant and delivery staff cannot reissue customer handover OTPs." },
        { status: 403 }
      );
    } else {
      const dbUser = await User.findOne({ email: session.user.email?.toLowerCase().trim() });
      if (!dbUser) {
        return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      }

      query = {
        $and: [
          orderIdentifierFilter,
          {
            $or: [
              { user: dbUser._id },
              ...(dbUser.phone ? [{ "address.phone": dbUser.phone }] : []),
            ],
          },
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
