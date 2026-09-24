import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

// GET — Secure endpoint providing Pet Protocols support WhatsApp to authorized Restaurant Admins
export async function GET() {
  try {
    const auth = await requireRestaurantAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    return NextResponse.json({
      success: true,
      platformWhatsapp: process.env.PLATFORM_WHATSAPP_NUMBER || "6202377582",
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
