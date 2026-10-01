import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Order from '@/models/Order';
import User from '@/models/User';
import Restaurant from '@/models/Restaurant';
import Product from '@/models/Product';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deductStockForOrder, restoreStockForOrder } from '@/lib/inventoryService';
import { sendPushForOrder } from '@/lib/pushService';

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
      .populate('restaurant', 'name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers cancellationSettings')
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
      const restDoc = await Restaurant.findById(targetRestId).lean();
      if (restDoc) {
        if (restDoc.isOpen === false || restDoc.isTemporarilyClosed || restDoc.acceptingOrders === false) {
          return NextResponse.json(
            { success: false, message: `${restDoc.name || 'Kitchen'} is currently closed or not accepting orders.` },
            { status: 400 }
          );
        }
      }

      const restSubtotal = restSnapshotItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
      overallSubtotal += restSubtotal;

      const minOrder = restDoc?.orderLimits?.minOrderAmount ?? 0;
      if (minOrder > 0 && restSubtotal < minOrder) {
        return NextResponse.json(
          { success: false, message: `Minimum order amount for ${restDoc?.name || 'this kitchen'} is ₹${minOrder}. Please add more items.` },
          { status: 400 }
        );
      }

      const isPickup = body.orderType === "pickup";
      const flatFee = restDoc?.chargeSettings?.flatDeliveryFee ?? 40;
      const freeThreshold = restDoc?.chargeSettings?.freeDeliveryThreshold ?? 500;

      const restDeliveryFee = isPickup
        ? 0
        : restSubtotal >= freeThreshold
        ? 0
        : flatFee;

      const discount = Number(body.discount) || 0;
      const restTotal = Math.max(0, restSubtotal + restDeliveryFee - discount);

      const isCod = paymentMethod?.toLowerCase().includes("cash on delivery") || paymentMethod?.toLowerCase().includes("cod");
      const isCop = paymentMethod?.toLowerCase().includes("cash on pickup") || paymentMethod?.toLowerCase().includes("cop");
      const paymentStatus = isCod || isCop ? "pending" : "test_paid";

      let finalPaymentMethod = paymentMethod;
      if (isCod) finalPaymentMethod = "Cash on Delivery (COD)";
      else if (isCop) finalPaymentMethod = "Cash on Pickup (COP)";

      const newOrder = await Order.create({
        user: userId,
        restaurant: targetRestId,
        items: restSnapshotItems,
        address,
        subtotal: restSubtotal,
        deliveryFee: restDeliveryFee,
        discount,
        totalAmount: restTotal,
        paymentStatus,
        paymentMethod: finalPaymentMethod,
        status: "pending",
        notes: isPickup ? `[PICKUP] ${notes}` : notes,
      });

      // Deduct ingredient stock safely based on dish recipes
      await deductStockForOrder(newOrder);

      const populatedOrder = await Order.findById(newOrder._id)
        .populate("restaurant", "name slug image phone address whatsappNumber showPhoneToCustomers showWhatsappToCustomers")
        .populate("user", "name email");

      createdOrders.push(populatedOrder);

      // Dispatch Web Push notification to customer confirming order placement
      sendPushForOrder(populatedOrder, {
        title: "Order Placed! 🍽️",
        body: `Your order #${populatedOrder._id.toString().slice(-6).toUpperCase()} has been received by ${populatedOrder.restaurant?.name || 'the kitchen'}.`,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/favicon-32x32.png",
        url: "/orders",
        tag: `order-${populatedOrder._id}`,
        data: {
          orderId: populatedOrder._id.toString(),
          status: "pending",
          url: "/orders",
        },
      }).catch((e) => console.warn("[Order Create Push] Non-blocking push warning:", e.message));
    }

    const hasCod = createdOrders.some((o) => o.paymentMethod?.toLowerCase().includes("cod"));

    return NextResponse.json(
      {
        success: true,
        message: hasCod
          ? "Order placed successfully with Cash on Delivery!"
          : "Order placed successfully with Test Payment!",
        order: createdOrders[0],
        orders: createdOrders,
      },
      { status: 201 }
    );

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH — Customer Order Cancellation
export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, reason = 'Cancelled by customer' } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Order ID is required' }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findById(orderId).populate('restaurant');
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    // Verify ownership
    const currentUser = await User.findOne({ email: session.user.email });
    const isOwner =
      (order.user && currentUser && order.user.toString() === currentUser._id.toString()) ||
      session.user.role === 'superadmin' ||
      (session.user.role === 'restaurant_admin' && order.restaurant?._id?.toString() === session.user.restaurantId);

    if (!isOwner) {
      return NextResponse.json({ success: false, message: 'Not authorized to cancel this order' }, { status: 403 });
    }

    // Check current order status
    if (order.status === 'cancelled') {
      return NextResponse.json({ success: false, message: 'Order is already cancelled' }, { status: 400 });
    }

    if (order.status !== 'pending') {
      return NextResponse.json({
        success: false,
        message: `Order cannot be cancelled because it is already ${order.status.replace(/_/g, ' ')}. Please contact the kitchen directly.`,
      }, { status: 400 });
    }

    // Check restaurant customer cancellation settings
    const cancelSettings = order.restaurant?.cancellationSettings || {};
    if (cancelSettings.allowCustomerCancel === false && session.user.role !== 'superadmin') {
      return NextResponse.json({
        success: false,
        message: 'This restaurant does not allow self-cancellation. Please contact the kitchen directly.',
      }, { status: 400 });
    }

    // Check cancellation time window
    const windowMinutes = Number(cancelSettings.customerCancelWindowMinutes) || 5;
    const createdAtMs = new Date(order.createdAt).getTime();
    const elapsedMinutes = (Date.now() - createdAtMs) / (60 * 1000);

    if (elapsedMinutes > windowMinutes && session.user.role !== 'superadmin') {
      return NextResponse.json({
        success: false,
        message: `The ${windowMinutes}-minute cancellation window has passed. Please contact the kitchen directly.`,
      }, { status: 400 });
    }

    // Cancel order
    order.status = 'cancelled';
    order.notes = order.notes ? `${order.notes} | Cancellation reason: ${reason}` : `Cancellation reason: ${reason}`;
    await order.save();

    // Restore stock if previously deducted
    if (order.stockDeducted && !order.stockRestored) {
      try {
        await restoreStockForOrder(order);
      } catch (stockErr) {
        console.warn('[Order Cancel] Stock restore warning:', stockErr.message);
      }
    }

    // Dispatch push notification to customer
    sendPushForOrder(order, {
      title: 'Order Cancelled ❌',
      body: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been cancelled.`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/favicon-32x32.png',
      url: '/orders',
      data: { orderId: order._id.toString(), status: 'cancelled', url: '/orders' },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully.',
      order,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}