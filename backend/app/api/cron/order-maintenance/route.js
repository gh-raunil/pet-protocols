import crypto from "crypto";
import { NextResponse } from "next/server";
import { processStalePickupOrders } from "@/lib/orderMaintenanceService";

let _testCronSecret = null;
let _isMaintenanceRunning = false;

export function _setTestCronSecret(secret) {
  _testCronSecret = secret;
}

export function _resetMaintenanceLock() {
  _isMaintenanceRunning = false;
}

function getCronSecret() {
  if (_testCronSecret !== null) return _testCronSecret;
  return process.env.CRON_SECRET || null;
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

async function handleMaintenanceTrigger(request) {
  const secret = getCronSecret();

  if (!secret) {
    console.warn("[OrderMaintenanceCron] CRON_SECRET is not configured in environment variables.");
    return NextResponse.json(
      { success: false, message: "Cron service misconfigured: authorization secret is required." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, message: "Unauthorized: missing Bearer token." },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7).trim();
  if (!safeCompare(token, secret)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized: invalid cron authorization token." },
      { status: 401 }
    );
  }

  if (_isMaintenanceRunning) {
    return NextResponse.json({
      success: true,
      inProgress: true,
      message: "Order maintenance worker is already in progress.",
    });
  }

  _isMaintenanceRunning = true;
  try {
    const results = await processStalePickupOrders();
    return NextResponse.json({
      success: true,
      message: `Order maintenance completed: ${results.processedCount} stale pickup orders dismissed.`,
      results,
    });
  } catch (error) {
    console.error("[OrderMaintenanceCron Error]", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    _isMaintenanceRunning = false;
  }
}

export async function GET(request) {
  return handleMaintenanceTrigger(request);
}

export async function POST(request) {
  return handleMaintenanceTrigger(request);
}
