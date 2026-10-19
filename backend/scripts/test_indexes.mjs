/**
 * READ-ONLY Database Index Verifier
 * 
 * Safety invariants:
 * - Strictly inspects collection.indexes() only.
 * - NEVER calls syncIndexes(), createIndex(), dropIndex(), or any DDL.
 * - Read-only inspection of index keys, uniqueness, and partialFilterExpressions.
 */
import mongoose from "mongoose";

// Models
import Order from "../models/Order.js";
import Ingredient from "../models/Ingredient.js";
import StockMovement from "../models/StockMovement.js";
import PaymentIntent from "../models/PaymentIntent.js";
import Product from "../models/Product.js";

const EXPECTED_SPECS = {
  Order: [
    { key: { _id: 1 }, name: "_id_" },
    {
      key: { paymentId: 1, restaurant: 1 },
      unique: true,
      partialFilterExpression: { paymentStatus: "paid", paymentId: { $type: "string" } },
    },
    {
      key: { restaurant: 1, idempotencyKey: 1 },
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: "string" } },
    },
  ],
  Ingredient: [
    { key: { _id: 1 }, name: "_id_" },
    { key: { restaurant: 1, name: 1 } },
    { key: { "appliedRestorations.opKey": 1 } },
    { key: { "appliedDeductions.opKey": 1 } },
  ],
  StockMovement: [
    { key: { _id: 1 }, name: "_id_" },
    { key: { idempotencyKey: 1 }, unique: true },
    { key: { restaurant: 1, ingredient: 1, date: -1 } },
  ],
  PaymentIntent: [
    { key: { _id: 1 }, name: "_id_" },
    { key: { razorpayOrderId: 1 }, unique: true },
  ],
};

function keysMatch(k1, k2) {
  if (!k1 || !k2) return false;
  const entries1 = Object.entries(k1);
  const entries2 = Object.entries(k2);
  if (entries1.length !== entries2.length) return false;
  return entries1.every(([k, v]) => k2[k] === v);
}

function partialMatch(p1, p2) {
  if (!p1 && !p2) return true;
  if (!p1 || !p2) return false;
  return JSON.stringify(p1) === JSON.stringify(p2);
}

export async function verifyIndexesReadOnly(targetUri = null) {
  const uri = targetUri || process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pet-protocols-test";
  
  const isExistingConnection = mongoose.connection.readyState === 1;
  if (!isExistingConnection) {
    await mongoose.connect(uri);
  }

  const results = {
    collections: {},
    totalExpected: 0,
    totalFound: 0,
    missing: [],
    redundant: [],
    mismatched: [],
    readOnlyVerified: true,
  };

  const models = { Order, Ingredient, StockMovement, PaymentIntent };

  for (const [modelName, Model] of Object.entries(models)) {
    // Strictly read-only inspection using collection.indexes()
    let actualIndexes = [];
    try {
      actualIndexes = await Model.collection.indexes();
    } catch (err) {
      actualIndexes = [];
    }

    const expectedList = EXPECTED_SPECS[modelName] || [];
    results.collections[modelName] = {
      actualCount: actualIndexes.length,
      expectedCount: expectedList.length,
      indexes: actualIndexes,
    };

    results.totalExpected += expectedList.length;

    for (const exp of expectedList) {
      const match = actualIndexes.find((act) => keysMatch(act.key, exp.key));
      if (!match) {
        results.missing.push({ model: modelName, expected: exp });
      } else {
        results.totalFound++;
        // Check uniqueness if expected
        if (exp.unique && !match.unique) {
          results.mismatched.push({ model: modelName, key: exp.key, issue: "Expected unique: true, but actual is not unique" });
        }
        // Check partial filter expression
        if (exp.partialFilterExpression && !partialMatch(exp.partialFilterExpression, match.partialFilterExpression)) {
          results.mismatched.push({
            model: modelName,
            key: exp.key,
            issue: `Expected partial filter ${JSON.stringify(exp.partialFilterExpression)} vs actual ${JSON.stringify(match.partialFilterExpression)}`,
          });
        }
      }
    }

    // Check for redundant standalone idempotencyKey index on Order
    if (modelName === "Order") {
      const standaloneIdemKey = actualIndexes.find(
        (act) => Object.keys(act.key).length === 1 && act.key.idempotencyKey === 1
      );
      if (standaloneIdemKey) {
        results.redundant.push({
          model: "Order",
          key: { idempotencyKey: 1 },
          reason: "Redundant standalone index. Covered by compound unique index { restaurant: 1, idempotencyKey: 1 }",
        });
      }
    }
  }

  if (!isExistingConnection) {
    await mongoose.disconnect();
  }

  return results;
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith("test_indexes.mjs")) {
  verifyIndexesReadOnly()
    .then((res) => {
      console.log("=== READ-ONLY DATABASE INDEX VERIFICATION REPORT ===");
      console.log(`Total Expected: ${res.totalExpected}, Found: ${res.totalFound}`);
      console.log(`Missing Indexes: ${res.missing.length}`);
      if (res.missing.length > 0) {
        console.warn("Missing:", JSON.stringify(res.missing, null, 2));
      }
      console.log(`Mismatched Options: ${res.mismatched.length}`);
      if (res.mismatched.length > 0) {
        console.warn("Mismatched:", JSON.stringify(res.mismatched, null, 2));
      }
      console.log(`Redundant Declarations: ${res.redundant.length}`);
      if (res.redundant.length > 0) {
        console.log("Redundant:", JSON.stringify(res.redundant, null, 2));
      }
      console.log("Safety Check: Strictly read-only verifier, 0 DDL statements executed.");
      process.exit(res.missing.length === 0 ? 0 : 1);
    })
    .catch((err) => {
      console.error("Index verification failed:", err);
      process.exit(1);
    });
}
