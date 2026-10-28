import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

let _requireRestaurantAdmin = requireRestaurantAdmin;
export function _setTestRequireRestaurantAdmin(fn) {
  _requireRestaurantAdmin = fn;
}

/**
 * GET — Restaurant Side OTP Access Prohibition
 *
 * Security Policy:
 * The delivery handover OTP is strictly confidential to the customer.
 * Restaurant staff, managers, and drivers cannot view the OTP.
 * Delivery staff/managers must request the code from the customer at the doorstep
 * and verify it using POST /api/restaurant/orders/[id]/verify-handover.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Access denied. Delivery handover OTP is confidential to the customer. Restaurant side cannot view OTP and must verify customer code at doorstep.",
    },
    { status: 403 }
  );
}
