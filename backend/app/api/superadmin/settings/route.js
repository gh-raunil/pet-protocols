import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import PlatformSetting from "@/models/PlatformSetting";
import { requireSuperAdmin } from "@/lib/authMiddleware";

// GET — Fetch platform global settings
export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    await connectDB();

    let settings = await PlatformSetting.findOne({ key: "global" });
    if (!settings) {
      settings = await PlatformSetting.create({ key: "global" });
    }

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT — Update platform global settings
export async function PUT(request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    await connectDB();

    let settings = await PlatformSetting.findOne({ key: "global" });
    if (!settings) {
      settings = new PlatformSetting({ key: "global" });
    }

    if (body.platformName !== undefined) settings.platformName = String(body.platformName).trim();
    if (body.platformFeePercent !== undefined) settings.platformFeePercent = Number(body.platformFeePercent) || 0;
    if (body.taxPercent !== undefined) settings.taxPercent = Number(body.taxPercent) || 0;
    if (body.maintenanceMode !== undefined) settings.maintenanceMode = Boolean(body.maintenanceMode);
    if (body.supportEmail !== undefined) settings.supportEmail = String(body.supportEmail).trim();
    if (body.supportPhone !== undefined) settings.supportPhone = String(body.supportPhone).trim();
    if (body.autoApproveRestaurants !== undefined) settings.autoApproveRestaurants = Boolean(body.autoApproveRestaurants);
    if (body.timezone !== undefined) settings.timezone = String(body.timezone).trim();

    await settings.save();

    return NextResponse.json({
      success: true,
      message: "Platform settings updated successfully.",
      settings,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
