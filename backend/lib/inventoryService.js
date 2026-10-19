import crypto from "crypto";
import connectDB from "./db";
import Recipe from "@/models/Recipe";
import Ingredient from "@/models/Ingredient";
import StockMovement from "@/models/StockMovement";
import Order from "@/models/Order";

let _testDeductionPauseHook = null;
let _testRestorationPauseHook = null;

export function _setTestDeductionPauseHook(hook) {
  _testDeductionPauseHook = hook;
}

export function _setTestRestorationPauseHook(hook) {
  _testRestorationPauseHook = hook;
}

/**
 * Roll back any partially deducted ingredients for an order.
 * Idempotent: Uses deterministic rollback operation keys in appliedRestorations to prevent duplicate increments.
 */
async function rollbackPartialDeductions(order, restaurantId, leaseToken, leaseGeneration) {
  const freshOrder = await Order.findById(order._id);
  const checkpointed = freshOrder?.stockDeduction?.deductedIngredients || [];
  if (checkpointed.length === 0) return;

  // Read already-restored ingredients from fresh document to ensure idempotency across crash retries
  const alreadyRestoredList = freshOrder?.stockRestoration?.restoredIngredients || [];
  const alreadyRestoredMap = new Set(alreadyRestoredList.map((r) => r.ingredient?.toString()));

  for (const item of checkpointed) {
    if (!item.ingredient || !item.quantity || item.quantity <= 0) continue;
    const ingIdStr = item.ingredient.toString();

    // Unified compensation key: exactly matches restoreStockForOrder deterministic key
    const opKey = `${order._id.toString()}_${ingIdStr}_restore`;

    // 1. If already durably checkpointed as restored on the order, skip stock increment
    if (alreadyRestoredMap.has(ingIdStr)) {
      continue;
    }

    // 2. Atomic conditional increment on Ingredient
    const prevDoc = await Ingredient.findOneAndUpdate(
      {
        _id: item.ingredient,
        restaurant: restaurantId,
        "appliedRestorations.opKey": { $ne: opKey },
      },
      {
        $inc: { currentStock: item.quantity },
        $push: {
          appliedRestorations: {
            opKey,
            orderId: order._id,
            quantity: item.quantity,
            date: new Date(),
          },
        },
      },
      { returnDocument: "before" }
    );

    let stockBefore;
    let stockAfter;
    if (prevDoc) {
      stockBefore = prevDoc.currentStock;
      stockAfter = stockBefore + item.quantity;
    } else {
      const refetched = await Ingredient.findById(item.ingredient);
      stockBefore = refetched ? refetched.currentStock - item.quantity : 0;
      stockAfter = refetched ? refetched.currentStock : item.quantity;
    }

    // 3. Idempotent StockMovement for audit trail
    let rbMovement = await StockMovement.findOne({ idempotencyKey: opKey });
    if (!rbMovement) {
      try {
        await StockMovement.create({
          restaurant: restaurantId,
          ingredient: item.ingredient,
          ingredientName: item.ingredientName || "Ingredient",
          quantity: item.quantity,
          unit: item.unit || "unit",
          type: "order_restoration",
          reason: `Deduction Rollback: Insufficient stock for subsequent ingredient in Order #${order.orderId || order._id.toString().slice(-6).toUpperCase()}`,
          referenceId: order._id.toString(),
          idempotencyKey: opKey,
          stockBefore,
          stockAfter,
          date: new Date(),
        });
      } catch (movErr) {
        if (movErr.code !== 11000) {
          console.warn("[InventoryService] Rollback StockMovement error:", movErr.message);
        }
      }
    }

    // 4. DURABLE ORDER CHECKPOINT FIRST: Record in restoredIngredients and pull from deductedIngredients
    // Must succeed before opKey is removed from Ingredient!
    if (leaseToken) {
      const fenceFilter = {
        _id: order._id,
        "stockDeduction.leaseToken": leaseToken,
      };
      if (typeof leaseGeneration !== "undefined" && leaseGeneration !== null) {
        fenceFilter["stockDeduction.leaseGeneration"] = leaseGeneration;
      }

      const checkpointUpdate = await Order.updateOne(
        fenceFilter,
        {
          $pull: { "stockDeduction.deductedIngredients": { ingredient: item.ingredient } },
          $push: {
            "stockRestoration.restoredIngredients": {
              ingredient: item.ingredient,
              ingredientName: item.ingredientName || "Ingredient",
              quantity: item.quantity,
              unit: item.unit || "unit",
              opKey,
              date: new Date(),
              restoredBy: "deduction_rollback",
            },
          },
        }
      );

      if (checkpointUpdate.matchedCount === 0) {
        // Lease was revoked, superseded, or expired! Stop and do not remove opKey
        break;
      }
    } else {
      await Order.updateOne(
        { _id: order._id },
        {
          $pull: { "stockDeduction.deductedIngredients": { ingredient: item.ingredient } },
          $push: {
            "stockRestoration.restoredIngredients": {
              ingredient: item.ingredient,
              ingredientName: item.ingredientName || "Ingredient",
              quantity: item.quantity,
              unit: item.unit || "unit",
              opKey,
              date: new Date(),
              restoredBy: "deduction_rollback",
            },
          },
        }
      );
    }
    alreadyRestoredMap.add(ingIdStr);
  }
}

/**
 * Deduct stock for an order based on recipes of ordered dishes.
 * 
 * Phase 2A.5 Crash-Safe Protocol:
 * 1. Persist Snapshot First: Computes recipe requirements and durably saves `order.deductedIngredients`
 *    before mutating any stock. Retries use this immutable snapshot instead of mutable recipes.
 * 2. Atomic Fenced Lease: Acquires a leaseToken and increments leaseGeneration. Prevents concurrent
 *    duplicate deductions for the same order.
 * 3. Conditional In-DB Sufficient Stock Decrement: Atomically checks `currentStock >= required` and
 *    `appliedDeductions.opKey != opKey`. Stock can never go below 0 or be decremented twice.
 * 4. Fenced Per-Ingredient Checkpointing: Checkpoints each ingredient deduction into `order.stockDeduction.deductedIngredients`.
 * 5. Targeted Cleanup: Safely pulls `opKey` from `Ingredient.appliedDeductions` only after checkpoint persistence.
 * 6. Partial Failure Rollback: If any ingredient has insufficient stock or fails, rolls back already
 *    deducted ingredients idempotently and records recoverable `missingRequirements` without leaking stock.
 */
export async function deductStockForOrder(orderOrId) {
  try {
    await connectDB();
    const isOrderDoc =
      orderOrId &&
      typeof orderOrId === "object" &&
      Array.isArray(orderOrId.items);
    const order = isOrderDoc
      ? orderOrId
      : await Order.findById(orderOrId?._id || orderOrId);

    if (!order) return { success: false, reason: "Order not found" };

    if (order.stockDeducted || order.stockDeduction?.status === "completed") {
      return {
        success: true,
        message: "Stock already deducted for this order",
        alreadyDeducted: true,
        deductedSnapshot: order.deductedIngredients || [],
      };
    }

    // Cancellation fencing: do not deduct if order restoration is currently active
    const lockExpiry = new Date(Date.now() - 15000);
    if (
      order.stockRestoration?.status === "in_progress" &&
      order.stockRestoration.lastAttemptAt &&
      order.stockRestoration.lastAttemptAt > lockExpiry
    ) {
      return {
        success: false,
        aborted: true,
        inProgress: true,
        message: "Stock deduction blocked: Order cancellation restoration is currently in progress",
      };
    }

    const restaurantId = order.restaurant?._id || order.restaurant;
    if (!restaurantId) {
      return { success: false, reason: "Order has no associated restaurant" };
    }

    // Step 1: Pre-persist intended deduction snapshot if not already persisted
    let snapshotList = order.deductedIngredients;
    const hasPrePersistedSnapshot = Array.isArray(snapshotList) && snapshotList.length > 0;

    if (!hasPrePersistedSnapshot) {
      snapshotList = [];
      const items = order.items || [];

      for (const item of items) {
        const productId = item.product?._id || item.product;
        const orderQty = Number(item.quantity) || 1;

        let recipe = null;
        if (productId) {
          recipe = await Recipe.findOne({
            restaurant: restaurantId,
            product: productId,
          });
        }
        if (!recipe && item.name) {
          recipe = await Recipe.findOne({
            restaurant: restaurantId,
            productName: { $regex: new RegExp(`^${item.name.trim()}$`, "i") },
          });
        }

        if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
          continue;
        }

        for (const recipeIng of recipe.ingredients) {
          const ingId = recipeIng.ingredient;
          const requiredPerDish = Number(recipeIng.quantity) || 0;
          const totalDeduct = requiredPerDish * orderQty;

          if (totalDeduct <= 0) continue;

          const ingDoc = await Ingredient.findOne({
            _id: ingId,
            restaurant: restaurantId,
          });

          snapshotList.push({
            ingredient: ingId,
            ingredientName: ingDoc?.name || recipeIng.ingredientName || "Unknown ingredient",
            quantity: totalDeduct,
            unit: ingDoc?.unit || recipeIng.unit || "unit",
            product: productId || null,
            productName: item.name || "Unknown dish",
          });
        }
      }

      // Persist intended snapshot to Order before any stock mutation occurs
      if (snapshotList.length > 0) {
        await Order.updateOne(
          {
            _id: order._id,
            $or: [
              { deductedIngredients: { $exists: false } },
              { deductedIngredients: { $size: 0 } },
            ],
          },
          { $set: { deductedIngredients: snapshotList } }
        );
      }
    }

    // If order has no ingredient requirements (e.g. digital products or dishes without recipes)
    if (snapshotList.length === 0) {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            stockDeducted: true,
            "stockDeduction.status": "completed",
            deductedIngredients: [],
          },
        }
      );
      return {
        success: true,
        message: "No ingredients required for this order",
        deductedSnapshot: [],
      };
    }

    // Step 2: Atomic Lease Acquisition & Fencing
    const leaseToken = crypto.randomUUID();

    const lockedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        stockDeducted: { $ne: true },
        status: { $ne: "cancelled" },
        stockRestored: { $ne: true },
        "stockRestoration.status": { $nin: ["in_progress", "completed"] },
        $or: [
          { "stockDeduction.status": { $in: ["not_deducted", "failed", "partial_failed", null] } },
          { "stockDeduction.status": { $exists: false } },
          {
            "stockDeduction.status": "in_progress",
            $or: [
              { "stockDeduction.lastAttemptAt": { $lt: lockExpiry } },
              { "stockDeduction.lastAttemptAt": null },
              { "stockDeduction.lastAttemptAt": { $exists: false } },
            ],
          },
        ],
      },
      {
        $set: {
          "stockDeduction.status": "in_progress",
          "stockDeduction.leaseToken": leaseToken,
          "stockDeduction.lastAttemptAt": new Date(),
        },
        $inc: {
          "stockDeduction.leaseGeneration": 1,
          "stockDeduction.attemptCount": 1,
        },
      },
      { returnDocument: "after" }
    );

    if (!lockedOrder) {
      const checkOrder = await Order.findById(order._id);
      if (checkOrder?.status === "cancelled" || checkOrder?.stockRestored) {
        return {
          success: false,
          aborted: true,
          message: "Stock deduction blocked: Order is cancelled or stock already restored",
        };
      }
      if (checkOrder?.stockDeducted || checkOrder?.stockDeduction?.status === "completed") {
        return {
          success: true,
          message: "Stock already deducted for this order",
          alreadyDeducted: true,
          deductedSnapshot: checkOrder.deductedIngredients || [],
        };
      }
      return {
        success: false,
        message: "Stock deduction is currently in progress",
        inProgress: true,
      };
    }

    const leaseGeneration = lockedOrder.stockDeduction?.leaseGeneration || 1;

    // Step 3: Build required ingredients map from immutable snapshot
    const effectiveSnapshot = (lockedOrder.deductedIngredients && lockedOrder.deductedIngredients.length > 0)
      ? lockedOrder.deductedIngredients
      : snapshotList;

    const requiredIngredientsMap = new Map();
    for (const item of effectiveSnapshot) {
      if (!item.ingredient) continue;
      const ingKey = item.ingredient.toString();
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      if (requiredIngredientsMap.has(ingKey)) {
        requiredIngredientsMap.get(ingKey).requiredTotal += qty;
      } else {
        requiredIngredientsMap.set(ingKey, {
          ingId: item.ingredient,
          requiredTotal: qty,
          ingredientName: item.ingredientName || "",
          unit: item.unit || "unit",
          product: item.product || null,
          productName: item.productName || "",
        });
      }
    }

    // Read already checkpointed deductions on this order from previous attempts
    const checkpointedList = lockedOrder.stockDeduction?.deductedIngredients || [];
    const alreadyDeductedMap = new Map();
    for (const d of checkpointedList) {
      if (d.ingredient) {
        alreadyDeductedMap.set(d.ingredient.toString(), d);
      }
    }

    // Check if any previous rollback or restoration compensated this ingredient
    const restoredList = lockedOrder.stockRestoration?.restoredIngredients || [];
    const compensatedSet = new Set(restoredList.map((r) => r.ingredient?.toString()));

    // Step 4: Atomically deduct each ingredient with in-DB sufficient stock enforcement
    for (const [ingKey, ingData] of requiredIngredientsMap.entries()) {
      // If recorded as deducted, but was subsequently rolled back or compensated, it MUST be re-deducted!
      if (alreadyDeductedMap.has(ingKey) && !compensatedSet.has(ingKey)) {
        continue;
      }

      // If it was compensated/rolled back, remove it from alreadyDeductedMap
      if (alreadyDeductedMap.has(ingKey) && compensatedSet.has(ingKey)) {
        alreadyDeductedMap.delete(ingKey);
      }

      // Fencing check: verify this worker still owns the lease and order is not cancelled/restored
      const activeOrderCheck = await Order.findOne({
        _id: lockedOrder._id,
        "stockDeduction.leaseToken": leaseToken,
        "stockDeduction.leaseGeneration": leaseGeneration,
        "stockDeduction.status": "in_progress",
        status: { $ne: "cancelled" },
        stockRestored: { $ne: true },
        "stockRestoration.status": { $nin: ["in_progress", "completed"] },
      });
      if (!activeOrderCheck) {
        return {
          success: false,
          aborted: true,
          message: "Deduction aborted: Worker lease expired, superseded, or revoked by cancellation.",
        };
      }

      if (typeof _testDeductionPauseHook === "function") {
        await _testDeductionPauseHook({
          orderId: lockedOrder._id,
          leaseToken,
          leaseGeneration,
          ingredientId: ingData.ingId,
        });
      }

      const opKey = `${lockedOrder._id.toString()}_${ingData.ingId.toString()}_g${leaseGeneration}_deduct`;
      const legacyOpKey = `${lockedOrder._id.toString()}_${ingData.ingId.toString()}_deduct`;
      const cancellationRestoreOpKey = `${lockedOrder._id.toString()}_${ingData.ingId.toString()}_restore`;

      const ingDoc = await Ingredient.findOne({
        _id: ingData.ingId,
        restaurant: restaurantId,
      });

      if (!ingDoc) {
        // Ingredient missing from restaurant branch -> Rollback and fail
        await rollbackPartialDeductions(lockedOrder, restaurantId, leaseToken, leaseGeneration);
        const missingReq = {
          product: ingData.product,
          productName: ingData.productName,
          ingredient: ingData.ingId,
          requiredQuantity: ingData.requiredTotal,
          availableStock: 0,
          reason: `Ingredient ID '${ingKey}' was not found in restaurant branch`,
        };

        await Order.updateOne(
          {
            _id: lockedOrder._id,
            "stockDeduction.leaseToken": leaseToken,
            "stockDeduction.leaseGeneration": leaseGeneration,
          },
          {
            $set: {
              stockDeducted: false,
              "stockDeduction.status": "partial_failed",
              "stockDeduction.missingRequirements": [missingReq],
              "stockDeduction.lastError": missingReq.reason,
            },
          }
        );

        return {
          success: false,
          insufficientStock: true,
          message: missingReq.reason,
          missingRequirements: [missingReq],
        };
      }

      // Check if this ingredient has already been decremented by this order
      // (matches this worker's opKey, legacy opKey, or a prior generation's opKey for this order)
      const opKeyPrefix = `${lockedOrder._id.toString()}_${ingData.ingId.toString()}_`;
      const matchedDeduction = (ingDoc.appliedDeductions || []).find(
        (d) =>
          d.opKey === opKey ||
          d.opKey === legacyOpKey ||
          (d.opKey && d.opKey.startsWith(opKeyPrefix) && d.opKey.endsWith('_deduct'))
      );
      const isAlreadyAppliedOnIng = !!matchedDeduction && !compensatedSet.has(ingKey);
      let stockBefore = ingDoc.currentStock;
      let stockAfter = ingDoc.currentStock - ingData.requiredTotal;

      if (!isAlreadyAppliedOnIng) {
        // Atomic conditional decrement enforcing sufficient stock in the DB update query ($gte)
        // Cancellation guard: never decrement if cancellation restoration already restored this ingredient
        const updatedDoc = await Ingredient.findOneAndUpdate(
          {
            _id: ingData.ingId,
            restaurant: restaurantId,
            currentStock: { $gte: ingData.requiredTotal },
            "appliedDeductions.opKey": {
              $nin: [opKey, legacyOpKey],
              $not: new RegExp(`^${lockedOrder._id.toString()}_${ingData.ingId.toString()}_(g\\d+_)?deduct$`),
            },
            "appliedRestorations.opKey": { $ne: cancellationRestoreOpKey },
          },
          {
            $inc: { currentStock: -ingData.requiredTotal },
            $push: {
              appliedDeductions: {
                opKey,
                orderId: lockedOrder._id,
                quantity: ingData.requiredTotal,
                date: new Date(),
              },
            },
          },
          { returnDocument: "before" }
        );

        if (updatedDoc) {
          stockBefore = updatedDoc.currentStock;
          stockAfter = stockBefore - ingData.requiredTotal;
        } else {
          // Re-fetch to distinguish between already applied concurrently vs cancellation vs insufficient stock
          const refetched = await Ingredient.findById(ingData.ingId);
          const hasOpKeyNow = refetched?.appliedDeductions?.some(
            (d) =>
              d.opKey === opKey ||
              d.opKey === legacyOpKey ||
              (d.opKey && d.opKey.startsWith(opKeyPrefix) && d.opKey.endsWith('_deduct'))
          );

          if (hasOpKeyNow) {
            stockBefore = refetched.currentStock + ingData.requiredTotal;
            stockAfter = refetched.currentStock;
          } else {
            // Check if cancellation finished or revoked lease while worker was paused
            const orderCheckCancelled = await Order.findOne({
              _id: lockedOrder._id,
              $or: [
                { status: "cancelled" },
                { stockRestored: true },
                { "stockRestoration.status": { $in: ["in_progress", "completed"] } },
              ],
            });
            if (orderCheckCancelled) {
              return {
                success: false,
                aborted: true,
                message: "Stock deduction blocked: Order was cancelled or restoration is active/completed",
              };
            }

            // Insufficient stock!
            const availableStock = refetched ? refetched.currentStock : 0;
            await rollbackPartialDeductions(lockedOrder, restaurantId, leaseToken, leaseGeneration);

            const missingReq = {
              product: ingData.product,
              productName: ingData.productName,
              ingredient: ingData.ingId,
              requiredQuantity: ingData.requiredTotal,
              availableStock,
              reason: `Insufficient stock for '${ingDoc.name}'. Required: ${ingData.requiredTotal}, Available: ${availableStock}`,
            };

            await Order.updateOne(
              {
                _id: lockedOrder._id,
                "stockDeduction.leaseToken": leaseToken,
                "stockDeduction.leaseGeneration": leaseGeneration,
              },
              {
                $set: {
                  stockDeducted: false,
                  "stockDeduction.status": "partial_failed",
                  "stockDeduction.missingRequirements": [missingReq],
                  "stockDeduction.lastError": missingReq.reason,
                },
              }
            );

            return {
              success: false,
              insufficientStock: true,
              message: missingReq.reason,
              missingRequirements: [missingReq],
            };
          }
        }
      } else {
        // Already decremented prior to crash before order checkpoint
        stockBefore = ingDoc.currentStock + ingData.requiredTotal;
        stockAfter = ingDoc.currentStock;
      }

      // Idempotent StockMovement creation using unique idempotencyKey
      const effectiveOpKey = matchedDeduction?.opKey || opKey;
      let movement = await StockMovement.findOne({
        idempotencyKey: { $in: [opKey, legacyOpKey, effectiveOpKey] },
      });
      if (!movement) {
        try {
          movement = await StockMovement.create({
            restaurant: restaurantId,
            ingredient: ingData.ingId,
            ingredientName: ingDoc.name || ingData.ingredientName,
            quantity: -ingData.requiredTotal,
            unit: ingDoc.unit || ingData.unit || "unit",
            type: "order",
            reason: `Order #${lockedOrder.orderId || lockedOrder._id.toString().slice(-6).toUpperCase()}`,
            referenceId: lockedOrder._id.toString(),
            idempotencyKey: effectiveOpKey,
            stockBefore,
            stockAfter,
            date: new Date(),
          });
        } catch (movErr) {
          if (movErr.code === 11000) {
            movement = await StockMovement.findOne({
              idempotencyKey: { $in: [opKey, legacyOpKey, effectiveOpKey] },
            });
          } else {
            throw movErr;
          }
        }
      }

      // If this ingredient was previously compensated, pull the old checkpoint entry first
      if (compensatedSet.has(ingKey)) {
        await Order.updateOne(
          {
            _id: lockedOrder._id,
            "stockDeduction.leaseToken": leaseToken,
            "stockDeduction.leaseGeneration": leaseGeneration,
          },
          {
            $pull: {
              "stockDeduction.deductedIngredients": { ingredient: ingData.ingId },
            },
          }
        );
      }

      // Fenced progress checkpoint on Order document
      const checkpointResult = await Order.updateOne(
        {
          _id: lockedOrder._id,
          "stockDeduction.leaseToken": leaseToken,
          "stockDeduction.leaseGeneration": leaseGeneration,
          "stockDeduction.status": "in_progress",
          status: { $ne: "cancelled" },
          stockRestored: { $ne: true },
          "stockDeduction.deductedIngredients.ingredient": { $ne: ingData.ingId },
        },
        {
          $push: {
            "stockDeduction.deductedIngredients": {
              ingredient: ingData.ingId,
              ingredientName: ingDoc.name || ingData.ingredientName,
              quantity: ingData.requiredTotal,
              movementId: movement?._id,
              opKey,
              deductedAt: new Date(),
            },
          },
        }
      );

      if (checkpointResult.matchedCount === 0) {
        const verifyLease = await Order.findOne({
          _id: lockedOrder._id,
          "stockDeduction.leaseToken": leaseToken,
          "stockDeduction.leaseGeneration": leaseGeneration,
          "stockDeduction.status": "in_progress",
          status: { $ne: "cancelled" },
          stockRestored: { $ne: true },
        });
        if (!verifyLease) {
          // Worker lease lost, superseded, or revoked by cancellation!
          // We MUST execute atomic self-compensation if stock was decremented in this pass!
          if (!isAlreadyAppliedOnIng) {
            try {
              await Ingredient.updateOne(
                {
                  _id: ingData.ingId,
                  "appliedDeductions.opKey": opKey,
                },
                {
                  $inc: { currentStock: ingData.requiredTotal },
                  $pull: { appliedDeductions: { opKey } },
                }
              );
            } catch (compErr) {
              console.error("[InventoryService] Deduction self-compensation failed:", compErr.message);
            }
          }
          return {
            success: false,
            aborted: true,
            message: "Deduction aborted and self-compensated: Worker lease expired, superseded, or revoked during checkpointing.",
          };
        }
      }

      // Checkpoint confirmed. Durable operation marker is PRESERVED on Ingredient (never removed post-checkpoint)
    }

    // Step 5: Finalize Order deduction status (Lease-Fenced & Cancellation-Safe)
    const finalizeResult = await Order.updateOne(
      {
        _id: lockedOrder._id,
        "stockDeduction.leaseToken": leaseToken,
        "stockDeduction.leaseGeneration": leaseGeneration,
        status: { $ne: "cancelled" },
        stockRestored: { $ne: true },
      },
      {
        $set: {
          stockDeducted: true,
          "stockDeduction.status": "completed",
          "stockDeduction.lastError": null,
          "stockDeduction.missingRequirements": [],
        },
      }
    );

    if (finalizeResult.matchedCount === 0) {
      return {
        success: false,
        aborted: true,
        message: "Deduction finalization aborted: Order was cancelled or lease superseded before completion.",
      };
    }

    return {
      success: true,
      message: "Stock deducted successfully",
      deductedSnapshot: effectiveSnapshot,
    };
  } catch (err) {
    console.error("Error deducting stock for order:", err);
    try {
      const orderId = typeof orderOrId === "object" && orderOrId?._id ? orderOrId._id : orderOrId;
      const fenceFilter = { _id: orderId };
      if (typeof leaseToken !== "undefined" && leaseToken) {
        fenceFilter["stockDeduction.leaseToken"] = leaseToken;
      }
      if (typeof leaseGeneration !== "undefined" && leaseGeneration) {
        fenceFilter["stockDeduction.leaseGeneration"] = leaseGeneration;
      }
      await Order.updateOne(
        fenceFilter,
        {
          $set: {
            "stockDeduction.status": "failed",
            "stockDeduction.lastError": err.message,
          },
        }
      );
    } catch (_) {}
    return { success: false, error: err.message };
  }
}

/**
 * Release an active deduction lease safely with lease token verification.
 * Stale workers cannot release a newer worker's lease.
 */
export async function releaseDeductionLease(orderId, leaseToken) {
  await connectDB();
  return await Order.updateOne(
    { _id: orderId, "stockDeduction.leaseToken": leaseToken },
    {
      $set: {
        "stockDeduction.status": "not_deducted",
        "stockDeduction.leaseToken": null,
      },
    }
  );
}

/**
 * Restore stock if an order is cancelled or refunded.
 * 
 * Hardened Implementation (Phase 2A.1):
 * 1. Snapshot-Driven: Uses the immutable `order.deductedIngredients` snapshot created during checkout.
 *    Does not re-query mutable recipes. Legacy orders without snapshots safely report
 *    `requiresManualReconciliation` without guessing.
 * 2. Lease-Fenced: Acquires a leaseToken and increments leaseGeneration. Before every ingredient
 *    mutation and checkpoint, verifies the lease has not expired or been acquired by another worker.
 * 3. Crash-Safe & Idempotent Atomic Operations: Uses atomic conditional updates on Ingredient with
 *    `appliedRestorations.opKey: { $ne: opKey }`. If a crash occurs after $inc, the retry detects that
 *    opKey is already in appliedRestorations and never applies a second increment.
 * 4. Idempotent StockMovements: Enforces database-level uniqueness via `StockMovement.idempotencyKey: opKey`.
 * 5. Fenced Checkpointing: Progress is checkpointed with `leaseToken`, preventing stale workers from
 *    interleaving progress.
 */
export async function restoreStockForOrder(orderOrId) {
  let leaseToken = null;
  let leaseGeneration = null;
  try {
    await connectDB();
    const targetId = typeof orderOrId === "object" && orderOrId._id ? orderOrId._id : orderOrId;

    if (!targetId) return { success: false, reason: "Order ID is required" };

    let order = await Order.findById(targetId);
    if (!order) return { success: false, reason: "Order not found" };

    const restaurantId = order.restaurant?._id || order.restaurant;
    if (!restaurantId) {
      return { success: false, reason: "Order has no associated restaurant" };
    }

    const lockExpiry = new Date(Date.now() - 15000);

    // Mutual exclusion: Block restoration if deduction is currently in progress
    if (
      order.stockDeduction?.status === "in_progress" &&
      order.stockDeduction.lastAttemptAt &&
      order.stockDeduction.lastAttemptAt > lockExpiry
    ) {
      return {
        success: false,
        inProgress: true,
        message: "Stock restoration blocked: Stock deduction is currently in progress for this order",
      };
    }

    if (order.stockRestored || order.stockRestoration?.status === "completed") {
      return { success: true, message: "Stock already restored for this order", alreadyRestored: true };
    }

    // Reconcile uncheckpointed in-flight deductions from crashed deduction workers
    const uncheckpointedIngs = await Ingredient.find({
      "appliedDeductions.orderId": order._id,
      restaurant: restaurantId,
    });

    if (uncheckpointedIngs && uncheckpointedIngs.length > 0) {
      for (const ingDoc of uncheckpointedIngs) {
        const isRestoredInOrder = order.stockRestoration?.restoredIngredients?.some(
          (r) => r.ingredient?.toString() === ingDoc._id.toString()
        );
        const isRestoredInDoc = (ingDoc.appliedRestorations || []).some(
          (r) => r.orderId && r.orderId.toString() === order._id.toString()
        );
        if (isRestoredInOrder || isRestoredInDoc) {
          continue;
        }

        const appDeds = (ingDoc.appliedDeductions || []).filter(
          (d) => d.orderId && d.orderId.toString() === order._id.toString()
        );
        for (const appDed of appDeds) {
          await Order.updateOne(
            {
              _id: order._id,
              "stockDeduction.deductedIngredients.ingredient": { $ne: ingDoc._id },
            },
            {
              $push: {
                "stockDeduction.deductedIngredients": {
                  ingredient: ingDoc._id,
                  ingredientName: ingDoc.name,
                  quantity: appDed.quantity,
                  opKey: appDed.opKey,
                  deductedAt: appDed.date || new Date(),
                },
              },
            }
          );
        }
      }
      const refreshedOrder = await Order.findById(order._id);
      if (refreshedOrder) {
        order = refreshedOrder;
      }
    }

    const hasPartialDeductions =
      !order.stockDeducted &&
      Array.isArray(order.stockDeduction?.deductedIngredients) &&
      order.stockDeduction.deductedIngredients.length > 0;

    if (!order.stockDeducted && !hasPartialDeductions) {
      return { success: true, message: "No stock was deducted for this order", alreadyRestored: true };
    }

    // Step 1: Snapshot Check — Require immutable deduction snapshot
    const deductedSnapshot = hasPartialDeductions
      ? order.stockDeduction.deductedIngredients
      : order.deductedIngredients;

    if (!deductedSnapshot || !Array.isArray(deductedSnapshot) || deductedSnapshot.length === 0) {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            "stockRestoration.status": "partial_failed",
            "stockRestoration.lastError": "Legacy order lacks an immutable inventory deduction snapshot. Manual inventory verification is required.",
            stockRestored: false,
          },
        }
      );
      return {
        success: false,
        requiresManualReconciliation: true,
        message: "Legacy order lacks an immutable inventory deduction snapshot. Manual inventory verification is required.",
      };
    }

    // Step 2: Atomic Lease Acquisition & Fencing (atomically revoke deduction lease)
    leaseToken = crypto.randomUUID();

    const lockedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        stockRestored: { $ne: true },
        $and: [
          {
            $or: [
              { stockDeducted: true },
              { "stockDeduction.deductedIngredients.0": { $exists: true } },
            ],
          },
          {
            $or: [
              { "stockRestoration.status": { $in: ["not_restored", "failed", "partial_failed", null] } },
              { "stockRestoration.status": { $exists: false } },
              {
                "stockRestoration.status": "in_progress",
                $or: [
                  { "stockRestoration.lastAttemptAt": { $lt: lockExpiry } },
                  { "stockRestoration.lastAttemptAt": null },
                  { "stockRestoration.lastAttemptAt": { $exists: false } },
                ],
              },
            ],
          },
        ],
      },
      {
        $set: {
          "stockRestoration.status": "in_progress",
          "stockRestoration.leaseToken": leaseToken,
          "stockRestoration.lastAttemptAt": new Date(),
          "stockDeduction.leaseToken": null,
          "stockDeduction.status": "revoked",
        },
        $inc: {
          "stockRestoration.leaseGeneration": 1,
          "stockRestoration.attemptCount": 1,
        },
      },
      { returnDocument: 'after' }
    );

    if (!lockedOrder) {
      const checkOrder = await Order.findById(order._id);
      if (checkOrder?.stockRestored || checkOrder?.stockRestoration?.status === "completed") {
        return { success: true, message: "Stock already restored for this order", alreadyRestored: true };
      }
      return { success: false, message: "Stock restoration is currently in progress", inProgress: true };
    }

    leaseGeneration = lockedOrder.stockRestoration?.leaseGeneration;

    // Step 3: Build required ingredients map from immutable deduction snapshot
    const effectiveSnapshotToRestore =
      lockedOrder.deductedIngredients && lockedOrder.deductedIngredients.length > 0 && lockedOrder.stockDeducted
        ? lockedOrder.deductedIngredients
        : (lockedOrder.stockDeduction?.deductedIngredients || deductedSnapshot);

    const requiredIngredientsMap = new Map();
    for (const item of effectiveSnapshotToRestore) {
      if (!item.ingredient) continue;
      const ingKey = item.ingredient.toString();
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      if (requiredIngredientsMap.has(ingKey)) {
        requiredIngredientsMap.get(ingKey).requiredTotal += qty;
      } else {
        requiredIngredientsMap.set(ingKey, {
          ingId: item.ingredient,
          requiredTotal: qty,
          ingredientName: item.ingredientName || "",
          unit: item.unit || "unit",
          productName: item.productName || "",
        });
      }
    }

    // Read durable restored progress from previous attempts
    const restoredIngredientsList = lockedOrder.stockRestoration?.restoredIngredients || [];
    const alreadyRestoredMap = new Map();
    for (const r of restoredIngredientsList) {
      if (r.ingredient) {
        alreadyRestoredMap.set(r.ingredient.toString(), r);
      }
    }

    // Step 4: Atomically restore each ingredient with fencing and operation keys
    let restoredCount = 0;
    const missingRequirements = [];

    for (const [ingKey, ingData] of requiredIngredientsMap.entries()) {
      if (alreadyRestoredMap.has(ingKey)) {
        restoredCount++;
        continue;
      }

      // Fencing check: verify this worker still owns the lease
      const activeOrderCheck = await Order.findOne({
        _id: lockedOrder._id,
        "stockRestoration.leaseToken": leaseToken,
        "stockRestoration.leaseGeneration": leaseGeneration,
      });
      if (!activeOrderCheck) {
        return {
          success: false,
          aborted: true,
          message: "Restoration aborted: Worker lease expired or superseded by another worker.",
        };
      }

      if (typeof _testRestorationPauseHook === "function") {
        await _testRestorationPauseHook({
          orderId: lockedOrder._id,
          leaseToken,
          leaseGeneration,
          ingredientId: ingData.ingId,
        });
      }

      // Check ingredient exists in this restaurant
      const ingDoc = await Ingredient.findOne({
        _id: ingData.ingId,
        restaurant: restaurantId,
      });

      if (!ingDoc) {
        missingRequirements.push({
          product: null,
          productName: ingData.productName,
          reason: `Ingredient ID '${ingKey}' was not found in restaurant branch`,
        });
        continue;
      }

      const opKey = `${lockedOrder._id.toString()}_${ingData.ingId.toString()}_restore`;
      const isAlreadyAppliedOnIng = ingDoc.appliedRestorations?.some((r) => r.opKey === opKey);

      let stockBefore = ingDoc.currentStock;
      let stockAfter = ingDoc.currentStock + ingData.requiredTotal;

      if (!isAlreadyAppliedOnIng) {
        // Atomic conditional increment: only increments if opKey is not yet in appliedRestorations.
        // opKey is preserved permanently until order checkpoint succeeds (no $slice cap).
        const prevDoc = await Ingredient.findOneAndUpdate(
          {
            _id: ingData.ingId,
            restaurant: restaurantId,
            "appliedRestorations.opKey": { $ne: opKey },
          },
          {
            $inc: { currentStock: ingData.requiredTotal },
            $push: {
              appliedRestorations: {
                opKey,
                orderId: lockedOrder._id,
                quantity: ingData.requiredTotal,
                date: new Date(),
              },
            },
          },
          { returnDocument: 'before' }
        );

        if (prevDoc) {
          stockBefore = prevDoc.currentStock;
          stockAfter = stockBefore + ingData.requiredTotal;
        } else {
          // If update returned null, opKey was already applied concurrently or prior to crash
          const refetched = await Ingredient.findById(ingData.ingId);
          stockBefore = refetched ? refetched.currentStock - ingData.requiredTotal : ingDoc.currentStock;
          stockAfter = refetched ? refetched.currentStock : stockBefore + ingData.requiredTotal;
        }
      } else {
        // Already incremented prior to crash
        stockBefore = ingDoc.currentStock - ingData.requiredTotal;
        stockAfter = ingDoc.currentStock;
      }

      // Idempotent StockMovement creation using unique idempotencyKey
      let movement = await StockMovement.findOne({ idempotencyKey: opKey });
      if (!movement) {
        try {
          movement = await StockMovement.create({
            restaurant: restaurantId,
            ingredient: ingData.ingId,
            ingredientName: ingDoc.name || ingData.ingredientName,
            quantity: ingData.requiredTotal,
            unit: ingDoc.unit || ingData.unit || "unit",
            type: "order_restoration",
            reason: `Order Cancelled #${lockedOrder.orderId || lockedOrder._id.toString().slice(-6).toUpperCase()}`,
            referenceId: lockedOrder._id.toString(),
            idempotencyKey: opKey,
            stockBefore,
            stockAfter,
            date: new Date(),
          });
        } catch (movErr) {
          if (movErr.code === 11000) {
            movement = await StockMovement.findOne({ idempotencyKey: opKey });
          } else {
            throw movErr;
          }
        }
      }

      // Fenced progress checkpoint on Order document
      const checkpointResult = await Order.updateOne(
        {
          _id: lockedOrder._id,
          "stockRestoration.leaseToken": leaseToken,
          "stockRestoration.leaseGeneration": leaseGeneration,
          "stockRestoration.restoredIngredients.ingredient": { $ne: ingData.ingId },
        },
        {
          $push: {
            "stockRestoration.restoredIngredients": {
              ingredient: ingData.ingId,
              ingredientName: ingDoc.name,
              quantity: ingData.requiredTotal,
              movementId: movement?._id,
              opKey,
              restoredAt: new Date(),
            },
          },
        }
      );

      if (checkpointResult.matchedCount === 0) {
        // Verify lease was not lost
        const verifyLease = await Order.findOne({
          _id: lockedOrder._id,
          "stockRestoration.leaseToken": leaseToken,
          "stockRestoration.leaseGeneration": leaseGeneration,
        });
        if (!verifyLease) {
          return {
            success: false,
            aborted: true,
            message: "Restoration aborted: Worker lease expired or superseded during checkpointing.",
          };
        }
      }

      // Checkpoint is durably written to Order and lease ownership verified.
      // Durable operation marker is PRESERVED on Ingredient (never removed post-checkpoint)
      restoredCount++;
    }

    // Step 5: Finalize Order restoration status (Lease-Fenced)
    if (missingRequirements.length > 0) {
      await Order.updateOne(
        {
          _id: lockedOrder._id,
          "stockRestoration.leaseToken": leaseToken,
          "stockRestoration.leaseGeneration": leaseGeneration,
        },
        {
          $set: {
            "stockRestoration.status": "partial_failed",
            "stockRestoration.missingRequirements": missingRequirements,
            "stockRestoration.lastError": `Partial restoration: ${missingRequirements.map((m) => m.reason).join("; ")}`,
            stockRestored: false,
          },
        }
      );

      return {
        success: false,
        partial: true,
        message: "Inventory restoration incomplete due to missing ingredients in kitchen branch.",
        missingRequirements,
      };
    }

    // All ingredients restored successfully
    const finalizeResult = await Order.updateOne(
      {
        _id: lockedOrder._id,
        "stockRestoration.leaseToken": leaseToken,
        "stockRestoration.leaseGeneration": leaseGeneration,
      },
      {
        $set: {
          stockRestored: true,
          "stockRestoration.status": "completed",
          "stockRestoration.lastError": null,
          "stockDeduction.deductedIngredients": [],
        },
      }
    );

    if (finalizeResult.matchedCount === 0) {
      return {
        success: false,
        aborted: true,
        message: "Restoration finalization aborted: Lease was superseded before completion.",
      };
    }

    return {
      success: true,
      message: "Stock restored successfully",
      restoredIngredientsCount: restoredCount,
    };

  } catch (err) {
    console.error("Error restoring stock for order:", err);
    try {
      const orderId = typeof orderOrId === "object" && orderOrId?._id ? orderOrId._id : orderOrId;
      const fenceFilter = { _id: orderId };
      if (typeof leaseToken !== "undefined" && leaseToken) {
        fenceFilter["stockRestoration.leaseToken"] = leaseToken;
      }
      if (typeof leaseGeneration !== "undefined" && leaseGeneration) {
        fenceFilter["stockRestoration.leaseGeneration"] = leaseGeneration;
      }
      await Order.updateOne(
        fenceFilter,
        {
          $set: {
            "stockRestoration.status": "failed",
            "stockRestoration.lastError": err.message,
          },
        }
      );
    } catch (_) {}
    return { success: false, error: err.message };
  }
}

/**
 * Release an active restoration lease safely with lease token verification.
 * Stale workers cannot release a newer worker's lease.
 */
export async function releaseRestorationLease(orderId, leaseToken) {
  await connectDB();
  return await Order.updateOne(
    { _id: orderId, "stockRestoration.leaseToken": leaseToken },
    {
      $set: {
        "stockRestoration.status": "not_restored",
        "stockRestoration.leaseToken": null,
      },
    }
  );
}
