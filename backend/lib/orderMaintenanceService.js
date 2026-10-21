import crypto from "crypto";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Restaurant from "@/models/Restaurant";
import Waste from "@/models/Waste";
import { executeOrderRefund } from "@/lib/refundService";
import { notifyOrderEvent } from "@/lib/pushService";

/**
 * Idempotently records Waste entries for an order with prepared food.
 * Fenced with lease tokens and checkpoints each ingredient to prevent duplicates across retries.
 *
 * @param {Object} order - Order document or populated order
 * @param {Object} options
 * @param {string} options.reasonNote - Contextual note for waste record
 * @returns {Promise<Object>} Status and count of logged waste entries
 */
export async function logWasteForOrder(order, { reasonNote = "" } = {}) {
  await connectDB();

  const freshOrder = await Order.findById(order._id);
  if (!freshOrder) {
    return { success: false, message: "Order not found" };
  }

  // If already marked completed, skip
  if (freshOrder.wasteLogging?.status === "completed") {
    return { success: true, alreadyCompleted: true, count: freshOrder.wasteLogging.loggedIngredients?.length || 0 };
  }

  // Deduce ingredient items
  const deductedItems = Array.isArray(freshOrder.deductedIngredients) && freshOrder.deductedIngredients.length > 0
    ? freshOrder.deductedIngredients
    : (Array.isArray(freshOrder.stockDeduction?.deductedIngredients) ? freshOrder.stockDeduction.deductedIngredients : []);

  if (deductedItems.length === 0) {
    // Historical order with no recipe deductions: complete without fabricating quantities (Rule #2)
    await Order.updateOne(
      { _id: freshOrder._id },
      { $set: { "wasteLogging.status": "completed", "wasteLogging.lastAttemptAt": new Date() } }
    );
    return { success: true, count: 0, message: "No deducted ingredients recorded on order." };
  }

  // Fenced lease acquisition on waste logging (30-second TTL)
  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(Date.now() + 30000);

  const lockQuery = {
    _id: freshOrder._id,
    $or: [
      { "wasteLogging.status": { $in: ["not_applicable", "pending", "failed", null] } },
      { "wasteLogging.status": { $exists: false } },
      {
        "wasteLogging.status": "in_progress",
        $or: [
          { "wasteLogging.leaseExpiresAt": { $lt: new Date() } },
          { "wasteLogging.leaseExpiresAt": null },
        ],
      },
    ],
  };

  const acquired = await Order.findOneAndUpdate(
    lockQuery,
    {
      $set: {
        "wasteLogging.status": "in_progress",
        "wasteLogging.leaseToken": leaseToken,
        "wasteLogging.leaseExpiresAt": leaseExpiresAt,
        "wasteLogging.lastAttemptAt": new Date(),
      },
      $inc: { "wasteLogging.attemptCount": 1 },
    },
    { returnDocument: "after" }
  );

  if (!acquired) {
    // Another worker is actively logging this order's waste
    return { success: false, inProgress: true, message: "Waste logging currently in progress by another worker." };
  }

  const alreadyLoggedKeys = new Set(
    (acquired.wasteLogging?.loggedIngredients || []).map((li) => li.opKey || `waste_${acquired._id}_${li.ingredient}`)
  );

  const errors = [];
  let newlyLogged = 0;

  for (const item of deductedItems) {
    if (!item.ingredient || !item.quantity || item.quantity <= 0) continue;
    const ingIdStr = item.ingredient.toString();
    const opKey = `waste_${acquired._id.toString()}_${ingIdStr}`;

    if (alreadyLoggedKeys.has(opKey)) {
      continue; // Skip already recorded ingredient
    }

    try {
      // Check collection for existing waste record with this opKey or order notes
      const existing = await Waste.findOne({
        $or: [
          { opKey },
          { notes: { $regex: acquired._id.toString() }, ingredient: item.ingredient },
        ],
      });

      if (!existing) {
        await Waste.create({
          restaurant: acquired.restaurant,
          ingredient: item.ingredient,
          ingredientName: item.ingredientName || "Prepared Ingredient",
          quantity: item.quantity,
          unit: item.unit || "unit",
          reason: "Spoiled",
          cost: 0,
          date: new Date(),
          order: acquired._id,
          opKey,
          notes: reasonNote
            ? (reasonNote.includes(acquired.orderId || acquired._id.toString()) ? reasonNote : `${reasonNote} (Order #${acquired.orderId || acquired._id})`)
            : `Prepared food discarded for order #${acquired.orderId || acquired._id}`,
        });
      }

      // Checkpoint this ingredient on the order document under active lease
      await Order.updateOne(
        { _id: acquired._id, "wasteLogging.leaseToken": leaseToken },
        {
          $push: {
            "wasteLogging.loggedIngredients": {
              ingredient: item.ingredient,
              ingredientName: item.ingredientName || "Prepared Ingredient",
              quantity: item.quantity,
              unit: item.unit || "unit",
              opKey,
              loggedAt: new Date(),
            },
          },
        }
      );

      alreadyLoggedKeys.add(opKey);
      newlyLogged++;
    } catch (err) {
      errors.push({ ingredient: ingIdStr, error: err.message });
      console.warn(`[WasteLogging Error] Order ${acquired._id}, Ingredient ${ingIdStr}:`, err.message);
    }
  }

  if (errors.length > 0) {
    await Order.updateOne(
      { _id: acquired._id, "wasteLogging.leaseToken": leaseToken },
      {
        $set: {
          "wasteLogging.status": "failed",
          "wasteLogging.lastError": errors.map((e) => e.error).join("; "),
          "wasteLogging.leaseToken": null,
        },
      }
    );
    return { success: false, errors, newlyLogged };
  }

  await Order.updateOne(
    { _id: acquired._id, "wasteLogging.leaseToken": leaseToken },
    {
      $set: {
        "wasteLogging.status": "completed",
        "wasteLogging.lastError": null,
        "wasteLogging.leaseToken": null,
      },
    }
  );

  return { success: true, newlyLogged, totalLogged: alreadyLoggedKeys.size };
}

/**
 * Scans for cancelled orders with unfinished side effects (waste logging or gateway refunds)
 * and safely resumes them without duplicate processing or modifying order status.
 *
 * @param {Object} options
 * @param {string|null} options.restaurantId
 * @param {number} options.batchSize
 * @returns {Promise<Object>} Recovery execution summary
 */
export async function recoverCancelledOrderSideEffects({ restaurantId = null, batchSize = 25 } = {}) {
  await connectDB();

  const filter = {
    status: "cancelled",
    $or: [
      { "wasteLogging.status": { $in: ["pending", "in_progress", "failed"] } },
      {
        paymentStatus: { $in: ["paid", "refund_pending"] },
        "refundDetails.status": { $nin: ["processed", "reconciliation_required"] },
        "refundDetails.requiresManualReconciliation": { $ne: true },
        $or: [
          { paymentMethod: { $regex: /razorpay|online/i } },
          { paymentId: { $exists: true, $ne: null } },
        ],
      },
    ],
  };

  if (restaurantId) {
    filter.restaurant = restaurantId;
  }

  const incompleteOrders = await Order.find(filter).limit(batchSize);
  const recoveryResults = {
    scanned: incompleteOrders.length,
    wasteRecovered: 0,
    refundsRecovered: 0,
    errors: [],
  };

  for (const order of incompleteOrders) {
    // 1. Recover waste logging if incomplete
    if (order.wasteLogging?.status !== "completed") {
      const isPreparedFood =
        order.stockRestored === true ||
        (Array.isArray(order.deductedIngredients) && order.deductedIngredients.length > 0) ||
        (Array.isArray(order.stockDeduction?.deductedIngredients) && order.stockDeduction.deductedIngredients.length > 0);

      if (isPreparedFood) {
        try {
          const wasteRes = await logWasteForOrder(order, {
            reasonNote: order.cancellationReason || `Prepared food waste recovered for order #${order.orderId || order._id}`,
          });
          if (wasteRes.success) {
            recoveryResults.wasteRecovered++;
          }
        } catch (wErr) {
          recoveryResults.errors.push({ orderId: order._id.toString(), step: "waste", error: wErr.message });
        }
      } else {
        await Order.updateOne({ _id: order._id }, { $set: { "wasteLogging.status": "not_applicable" } });
      }
    }

    // 2. Recover gateway refund if incomplete
    const isPrepaid =
      ["paid", "refund_pending"].includes(order.paymentStatus) &&
      (order.paymentMethod?.toLowerCase().includes("razorpay") || order.paymentMethod?.toLowerCase().includes("online"));

    if (isPrepaid && order.refundDetails?.status !== "processed" && !order.refundDetails?.requiresManualReconciliation) {
      try {
        const refRes = await executeOrderRefund({
          orderId: order._id,
          reason: order.cancellationReason || "Automated recovery of cancelled order refund",
          initiatedBy: "cancellation_recovery_worker",
        });
        if (refRes.success) {
          recoveryResults.refundsRecovered++;
        }
      } catch (rErr) {
        recoveryResults.errors.push({ orderId: order._id.toString(), step: "refund", error: rErr.message });
      }
    }
  }

  return recoveryResults;
}

/**
 * Safely processes and auto-dismisses stale uncollected counter pickup orders.
 * Also invokes recovery of unfinished cancellation side effects.
 *
 * Rules:
 * 1. NEVER cancel active delivery orders (out_for_delivery is strictly excluded).
 * 2. ONLY evaluate orders sitting in 'ready' status that are pickup orders.
 * 3. Timeout is measured strictly from when the order entered 'ready' status.
 * 4. Prepared food is NOT returned to raw ingredient stock; instead Waste records
 *    are created using verified recipe/ingredient data.
 * 5. Eligible online prepaid orders undergo full idempotently tracked refund evaluation.
 * 6. Customers are notified of cancellation via push service.
 *
 * @param {Object} options
 * @param {string|null} options.restaurantId - Optional filter by specific restaurant
 * @param {number|null} options.managerLimitMinutes - Optional override for timeout
 * @returns {Promise<Object>} Summary of processed orders
 */
export async function processStalePickupOrders({ restaurantId = null, managerLimitMinutes = null } = {}) {
  await connectDB();

  // Step 0: Recover any unfinished side effects from past cancellations
  const recoverySummary = await recoverCancelledOrderSideEffects({ restaurantId });

  const restaurantFilter = { status: "active" };
  if (restaurantId) {
    restaurantFilter._id = restaurantId;
  }
  const restaurants = await Restaurant.find(restaurantFilter).lean();

  const results = {
    recoverySummary,
    processedCount: 0,
    cancelledOrders: [],
    errors: [],
  };

  for (const rest of restaurants) {
    const autoDismiss = rest?.orderingSettings?.autoDismissUncollectedOrders !== false;
    const timeoutMins = managerLimitMinutes || Number(rest?.orderingSettings?.uncollectedTimeoutMinutes || 60);

    if (!autoDismiss || timeoutMins <= 0) continue;

    // Strict criteria:
    // - status MUST be 'ready'
    // - Order MUST be a counter pickup order
    const candidateOrders = await Order.find({
      restaurant: rest._id,
      status: "ready",
      $or: [
        { orderType: "pickup" },
        { paymentMethod: { $regex: /pickup|cop/i } },
        { notes: { $regex: /\[pickup\]/i } },
        { "address.addressType": "pickup" },
        { address: null },
      ],
    });

    for (const order of candidateOrders) {
      try {
        // Enforce canonical pickup check
        const isPickup = typeof order.isPickupOrder === "function"
          ? order.isPickupOrder()
          : (Order.isPickupOrder ? Order.isPickupOrder(order) : true);

        if (!isPickup) {
          // Safety assertion: Delivery orders must NEVER be auto-dismissed by pickup timeout
          continue;
        }

        // Measure age strictly from when the order entered 'ready' status
        let readyAt = null;
        if (Array.isArray(order.statusHistory) && order.statusHistory.length > 0) {
          const readyEntry = order.statusHistory.slice().reverse().find((h) => h.status === "ready");
          if (readyEntry && readyEntry.changedAt) {
            readyAt = new Date(readyEntry.changedAt);
          }
        }
        if (!readyAt) {
          readyAt = order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt);
        }

        const elapsedMs = Date.now() - readyAt.getTime();
        const timeoutMs = timeoutMins * 60 * 1000;
        if (elapsedMs < timeoutMs) {
          // Order has not yet reached the uncollected timeout duration
          continue;
        }

        const elapsedMins = Math.round(elapsedMs / 60000);
        const reasonMsg = `Auto-dismissed: Uncollected pickup order timed out after ${elapsedMins}m at counter (manager limit: ${timeoutMins}m)`;

        // Atomic conditional claim to prevent duplicate cancellation or race conditions
        const claimed = await Order.findOneAndUpdate(
          {
            _id: order._id,
            status: "ready",
          },
          {
            $set: {
              status: "cancelled",
              cancellationReason: reasonMsg,
              stockRestored: true, // Mark so raw stock restoration is not performed
              "stockRestoration.status": "completed",
              "wasteLogging.status": "pending",
            },
            $push: {
              statusHistory: {
                status: "cancelled",
                changedAt: new Date(),
                changedBy: { role: "system", name: "System (Auto-Dismiss Pickup)" },
                note: reasonMsg,
              },
            },
            $inc: { __v: 1 },
          },
          { returnDocument: "after" }
        );

        if (!claimed) {
          // Concurrently modified or collected at counter
          continue;
        }

        // 1. Record Waste for prepared food idempotently
        const wasteResult = await logWasteForOrder(claimed, {
          reasonNote: `Prepared food discarded on auto-dismissal of order #${claimed.orderId || claimed._id}: ${reasonMsg}`,
        });

        // 2. Safe full refund evaluation for eligible prepaid online orders
        let refundResult = null;
        const isPrepaid =
          ["paid", "refund_pending"].includes(claimed.paymentStatus) &&
          (claimed.paymentMethod?.toLowerCase().includes("razorpay") || claimed.paymentMethod?.toLowerCase().includes("online"));

        if (isPrepaid && claimed.refundDetails?.status !== "processed") {
          try {
            refundResult = await executeOrderRefund({
              orderId: claimed._id,
              reason: reasonMsg,
              initiatedBy: "system_auto_dismiss",
            });
          } catch (refErr) {
            console.warn("[Auto-Dismiss Refund Error]", claimed._id, refErr.message);
            refundResult = { success: false, error: refErr.message };
          }
        }

        // 3. Dispatch customer notification
        try {
          await notifyOrderEvent(claimed, "status_update", {
            status: "cancelled",
            previousStatus: "ready",
            reason: reasonMsg,
          });
        } catch (pushErr) {
          console.warn("[Auto-Dismiss Push Error]", claimed._id, pushErr.message);
        }

        results.processedCount++;
        results.cancelledOrders.push({
          orderId: claimed.orderId || claimed._id.toString(),
          elapsedMinutes: elapsedMins,
          wasteResult,
          refundResult,
        });
      } catch (orderErr) {
        results.errors.push({
          orderId: order._id?.toString(),
          error: orderErr.message,
        });
      }
    }
  }

  return results;
}
