import { NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import Order from "@/models/Order";

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      address,
      totalAmount,
      userId,
      userEmail,
    } = body;

    // Debug log — MUST be before return
    console.log("Body received:", {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      totalAmount,
    });

    // Step 1 — Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    console.log("Expected:", expectedSignature);
    console.log("Received:", razorpay_signature);
    console.log("Match:", expectedSignature === razorpay_signature);

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, message: "Invalid payment signature" },
        { status: 400 },
      );
    }

    // Step 2 — Connect DB ← THIS WAS MISSING!
    await connectDB();

    const User = (await import("@/models/User")).default;
    const dbUser = await User.findOne({
      $or: [
        { _id: userId.length === 24 ? userId : null },
        { email: body.userEmail },
      ],
    });

    // Step 3 — Save order
    await Order.create({
      user: dbUser?._id || null,
      items: items.map((item) => ({
        product: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      })),
      address,
      totalAmount,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      status: "paid",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
