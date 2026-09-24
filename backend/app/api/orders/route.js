import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Order from '@/models/Order';
import User from '@/models/User';
import Restaurant from '@/models/Restaurant';
import Product from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET — Fetch customer's orders (with optional ?orderId= filter)
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get('orderId') || searchParams.get('id');

    let query = {};

    if (session.user.role === 'superadmin') {
      // Superadmin can view all orders
      query = {};
    } else if (session.user.role === 'restaurant_admin') {
      query = { restaurant: session.user.restaurantId };
    } else {
      // Customer
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }
      query = { $or: [{ user: user._id }, { 'address.phone': user.phone }] };
    }

    if (orderIdParam) {
      if (orderIdParam.length === 24 && /^[0-9a-fA-F]{24}$/.test(orderIdParam)) {
        query._id = orderIdParam;
      } else {
        query.orderId = orderIdParam;
      }
    }

    const orders = await Order.find(query)
      .populate('restaurant', 'name slug image phone address')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    const order = orders.length > 0 ? orders[0] : null;

    return NextResponse.json({ success: true, order, orders });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST — Place an order (Mock/Test payment checkout)
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { items, address, paymentMethod = 'Mock Test Payment', notes = '' } = body;

    if (!items || !items.length) {
      return NextResponse.json({ success: false, message: 'Cart items are required' }, { status: 400 });
    }

    if (!address || !address.fullName || !address.street || !address.phone) {
      return NextResponse.json({ success: false, message: 'Complete delivery address is required' }, { status: 400 });
    }

    await connectDB();

    let userId = null;
    if (session?.user?.email) {
      const user = await User.findOne({ email: session.user.email });
      if (user) userId = user._id;
    }

    // Fetch all products in cart from database to get their accurate restaurant association
    const productIds = items.map((item) => item._id || item.product).filter(Boolean);
    const dbProducts = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

    const fallbackRest = await Restaurant.findOne({ status: "active" });
    const fallbackRestId = fallbackRest?._id?.toString();

    // Group items by their owning restaurant
    const itemsByRestaurant = new Map();

    for (const item of items) {
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
        type: item.type || item.foodType || dbProd?.type || "veg",
      });
    }

    if (itemsByRestaurant.size === 0) {
      return NextResponse.json({ success: false, message: "Invalid restaurant for order" }, { status: 400 });
    }

    const createdOrders = [];
    let overallSubtotal = 0;

    for (const [targetRestId, restSnapshotItems] of itemsByRestaurant.entries()) {
      const restSubtotal = restSnapshotItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
      overallSubtotal += restSubtotal;

      const restDeliveryFee =
        itemsByRestaurant.size === 1
          ? restSubtotal > 499
            ? 0
            : 40
          : createdOrders.length === 0 && overallSubtotal <= 499
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
        paymentStatus: "test_paid",
        paymentMethod,
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
        message: "Order placed successfully with Test Payment!",
        order: createdOrders[0],
        orders: createdOrders,
      },
      { status: 201 }
    );

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}