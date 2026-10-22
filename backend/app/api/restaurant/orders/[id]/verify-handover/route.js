import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";
import { verifyAndCompleteDelivery } from "@/lib/deliveryOtpService";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

/**
 * POST — Dedicated Driver Handover Verification & Atomic Delivery Completion
 *
 * Enforces:
 * - Authenticated staff member with "Delivery" (or "Manager") role.
 * - Active driver assignment matching current user.
 * - Restaurant tenant scoping.
 * - 4-digit numeric OTP code constant-time verification.
 * - Attempt accounting and concurrency lockout.
 * - Atomic transition to "delivered", terminating live tracking and optionally recording COD cash payment.
 */
export async function POST(request, { params }) {
  try {
    const auth = await _requireRestaurantAdmin({ allowStaff: true, requiredPermission: "orders_update" });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const resolvedParams = params ? await params : {};
    const { id } = resolvedParams;
    if (!id) {
      return NextResponse.json({ success: false, message: "Order ID is required." }, { status: 400 });
    }

    await connectDB();

    const body = await request.json().catch(() => ({}));
    const otpCode = body.otpCode || body.deliveryOtpCode || body.code;
    const codPaymentHandler = body.codPaymentHandler || null;
    const notes = body.notes || "Delivered to customer following successful OTP handover verification";

    if (!otpCode) {
      return NextResponse.json(
        { success: false, message: "Handover OTP code is required." },
        { status: 400 }
      );
    }

    const verificationResult = await verifyAndCompleteDelivery({
      orderId: id,
      restaurantId: auth.restaurantId,
      staffUser: {
        ...(auth.user?.toObject ? auth.user.toObject() : auth.user),
        staffRoles: auth.staffRoles || auth.user?.staffRoles || [auth.user?.staffRole || "Delivery"],
      },
      otpCode,
      codPaymentHandler,
      transitionNote: notes,
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
  } catch (err) {
    console.error("[Driver Handover Verification Error]", err);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
