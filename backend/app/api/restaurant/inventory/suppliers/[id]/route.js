import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Supplier from "@/models/Supplier";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function PUT(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;
    const body = await request.json();

    await connectDB();

    const supplier = await Supplier.findOne({ _id: id, restaurant: restaurantId });
    if (!supplier) {
      return NextResponse.json({ success: false, message: "Supplier not found" }, { status: 404 });
    }

    if (body.name !== undefined) supplier.name = body.name.trim();
    if (body.phone !== undefined) supplier.phone = body.phone.trim();
    if (body.whatsapp !== undefined) supplier.whatsapp = body.whatsapp.trim();
    if (body.email !== undefined) supplier.email = body.email.trim();
    if (body.address !== undefined) supplier.address = body.address.trim();
    if (body.items !== undefined) supplier.items = body.items.trim();
    if (body.notes !== undefined) supplier.notes = body.notes.trim();

    await supplier.save();

    return NextResponse.json({ success: true, supplier });
  } catch (error) {
    console.error("Update supplier error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;
    await connectDB();

    const deleted = await Supplier.findOneAndDelete({ _id: id, restaurant: restaurantId });
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Supplier deleted successfully" });
  } catch (error) {
    console.error("Delete supplier error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
