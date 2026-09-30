import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Supplier from "@/models/Supplier";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function GET() {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    await connectDB();

    const suppliers = await Supplier.find({ restaurant: restaurantId })
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ success: true, suppliers });
  } catch (error) {
    console.error("Get suppliers error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const body = await request.json();

    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const whatsapp = body.whatsapp?.trim() || "";
    const email = body.email?.trim() || "";
    const address = body.address?.trim() || "";
    const items = body.items?.trim() || "";
    const notes = body.notes?.trim() || "";

    if (!name) {
      return NextResponse.json({ success: false, message: "Supplier name is required" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ success: false, message: "Phone number is required" }, { status: 400 });
    }

    await connectDB();

    const supplier = await Supplier.create({
      restaurant: restaurantId,
      name,
      phone,
      whatsapp,
      email,
      address,
      items,
      notes,
    });

    return NextResponse.json({ success: true, supplier }, { status: 201 });
  } catch (error) {
    console.error("Create supplier error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
