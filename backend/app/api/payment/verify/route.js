import { NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/db';
import Order from '@/models/Order';
import User from '@/models/User';
import Restaurant from '@/models/Restaurant';
import Product from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      address,
      notes = '',
      totalAmount,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, message: 'Missing Razorpay verification parameters' },
        { status: 400 }
      );
    }

    // Step 1: Verify HMAC signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('Payment verification failed: RAZORPAY_KEY_SECRET is not configured on server.');
      return NextResponse.json(
        { success: false, message: 'Payment verification service is currently unavailable.' },
        { status: 503 }
      );
    }

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('Razorpay signature mismatch for order:', razorpay_order_id);
      return NextResponse.json(
        { success: false, message: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Step 2: Connect DB
    await connectDB();

    // Find User
    let userId = null;
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || body.userEmail;

    if (userEmail) {
      const dbUser = await User.findOne({ email: userEmail });
      if (dbUser) userId = dbUser._id;
    } else if (body.userId && body.userId.length === 24) {
      const dbUser = await User.findById(body.userId);
      if (dbUser) userId = dbUser._id;
    }

    // Step 3: Fetch all products in cart from database to get their accurate restaurant association
    const productIds = (items || []).map((item) => item._id || item.product).filter(Boolean);
    const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    const fallbackRest = await Restaurant.findOne({ status: "active" });
    const fallbackRestId = fallbackRest?._id?.toString();

    // Group items by their owning restaurant
    const itemsByRestaurant = new Map();

    for (const item of (items || [])) {
      const prodId = (item._id || item.product)?.toString();
      const dbProd = productMap.get(prodId);
      const restId = (
        item.restaurantId ||
        item.restaurant?._id ||
        item.restaurant ||
        dbProd?.restaurant?.toString() ||
        body.restaurantId ||
        fallbackRestId
      )?.toString();

      if (!restId) continue;

      if (!itemsByRestaurant.has(restId)) {
        itemsByRestaurant.set(restId, []);
      }

      const price = Number(item.price) || (dbProd ? Number(dbProd.price) : 0);
      const qty = Number(item.quantity) || 1;

      itemsByRestaurant.get(restId).push({
        product: prodId,
        name: item.name || dbProd?.name || "Dish",
        price,
        quantity: qty,
        image: item.image || dbProd?.image || "",
        category: item.category || dbProd?.category || "",
        foodType: item.foodType || item.type || dbProd?.type || "veg",
      });
    }

    if (itemsByRestaurant.size === 0) {
      return NextResponse.json(
        { success: false, message: "Could not associate order with an active restaurant" },
        { status: 400 }
      );
    }

    const createdOrders = [];
    let cumulativeSubtotal = 0;

    for (const [targetRestId, restSnapshotItems] of itemsByRestaurant.entries()) {
      const restSubtotal = restSnapshotItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
      cumulativeSubtotal += restSubtotal;

      const restDeliveryFee =
        itemsByRestaurant.size === 1
          ? restSubtotal > 499
            ? 0
            : 40
          : createdOrders.length === 0 && cumulativeSubtotal <= 499
          ? 40
          : 0;
      const restTotal = restSubtotal + restDeliveryFee;

      const newOrder = await Order.create({
        user: userId,
        restaurant: targetRestId,
        items: restSnapshotItems,
        address,
        subtotal: restSubtotal,
        deliveryFee: restDeliveryFee,
        totalAmount: restTotal,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        paymentStatus: "paid",
        paymentMethod: "Razorpay (Test Mode)",
        status: "pending",
        notes,
      });

      const populatedOrder = await Order.findById(newOrder._id)
        .populate("restaurant", "name slug image phone address")
        .populate("user", "name email");

      createdOrders.push(populatedOrder);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Payment verified and order placed successfully!",
        order: createdOrders[0],
        orders: createdOrders,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Razorpay verification error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Payment verification failed. Please contact support.' },
      { status: 500 }
    );
  }
}
