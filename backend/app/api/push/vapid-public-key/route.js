import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      { success: false, message: "VAPID public key not configured on server" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    publicKey,
  });
}
