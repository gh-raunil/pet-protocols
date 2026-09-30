import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Recipe from "@/models/Recipe";
import { requireRestaurantAdmin } from "@/lib/authMiddleware";

export async function DELETE(request, { params }) {
  try {
    const auth = await requireRestaurantAdmin({ allowStaff: true });
    if (auth.error) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { restaurantId } = auth;
    const { id } = await params;
    await connectDB();

    const deleted = await Recipe.findOneAndDelete({ _id: id, restaurant: restaurantId });
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Recipe not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Recipe removed successfully" });
  } catch (error) {
    console.error("Delete recipe error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
