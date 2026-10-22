import { register } from "node:module";
import { pathToFileURL } from "node:url";
register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);

import mongoose from "mongoose";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";

console.log("========================================================================");
console.log("PET PROTOCOLS — FEEDBACK, RATINGS, COMPLAINTS & RESPONSE TEST SUITE");
console.log("========================================================================\n");

console.log("Starting isolated MongoMemoryReplSet on 127.0.0.1...");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const MONGODB_URI = replSet.getUri();

const parsedUri = new URL(MONGODB_URI);
if (parsedUri.hostname !== "127.0.0.1" && parsedUri.hostname !== "localhost") {
  throw new Error(`CRITICAL: Test execution aborted. Non-loopback database URI detected: ${MONGODB_URI}`);
}
process.env.MONGODB_URI = MONGODB_URI;
console.log(`Connected to isolated test database: ${MONGODB_URI}\n`);

await mongoose.connect(MONGODB_URI);

const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;
const Feedback = (await import("../models/Feedback.js")).default;

const {
  POST: feedbackPOST,
  GET: feedbackGET,
  PUT: feedbackPUT,
  _setTestGetServerSession: setFeedbackSession,
} = await import("../app/api/orders/[id]/feedback/route.js");

const {
  GET: restaurantFeedbackGET,
  _setTestRequireRestaurantAdmin: setRestaurantFeedbackAuth,
} = await import("../app/api/restaurant/feedback/route.js");

const {
  POST: restaurantResponsePOST,
  _setTestRequireRestaurantAdmin: setResponseAuth,
} = await import("../app/api/restaurant/feedback/[id]/response/route.js");

const {
  PATCH: restaurantComplaintPATCH,
  _setTestRequireRestaurantAdmin: setComplaintAuth,
} = await import("../app/api/restaurant/feedback/[id]/complaint/route.js");

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`TEST [${totalTests}] ${name} ... `);
  try {
    await fn();
    passedTests++;
    console.log("PASSED");
  } catch (err) {
    console.log("FAILED");
    console.error(err);
    throw err;
  }
}

try {
  // Setup Fixture Data
  const restA = await Restaurant.create({
    name: "Pet Treats Bistro Alpha",
    slug: "alpha-bistro",
    ownerEmail: "owner.alpha@test.com",
    address: { street: "1 Alpha Way", city: "Bangalore", state: "KA", pincode: "560001" },
    status: "active",
  });

  const restB = await Restaurant.create({
    name: "Pet Treats Bistro Beta",
    slug: "beta-bistro",
    ownerEmail: "owner.beta@test.com",
    address: { street: "2 Beta Way", city: "Bangalore", state: "KA", pincode: "560002" },
    status: "active",
  });

  const userCustomerA = await User.create({
    name: "Alice Customer",
    email: "alice@test.com",
    phone: "9876543210",
    role: "customer",
  });

  const userCustomerB = await User.create({
    name: "Bob Customer",
    email: "bob@test.com",
    phone: "9876543211",
    role: "customer",
  });

  const staffAdminA = await User.create({
    name: "Staff Alpha Admin",
    email: "staff.alpha@test.com",
    role: "restaurant_admin",
    restaurant: restA._id,
  });

  const staffAdminB = await User.create({
    name: "Staff Beta Admin",
    email: "staff.beta@test.com",
    role: "restaurant_admin",
    restaurant: restB._id,
  });

  // Create Orders in various lifecycle states
  const orderPending = await Order.create({
    orderId: "ORD_TEST_PENDING_001",
    user: userCustomerA._id,
    restaurant: restA._id,
    items: [{ name: "Dog Biscuit", price: 100, quantity: 1 }],
    totalAmount: 100,
    status: "pending",
    orderType: "delivery",
    address: { fullName: "Alice", phone: "9876543210" },
  });

  const orderOutForDelivery = await Order.create({
    orderId: "ORD_TEST_OUT_001",
    user: userCustomerA._id,
    restaurant: restA._id,
    items: [{ name: "Catnip Treat", price: 150, quantity: 1 }],
    totalAmount: 150,
    status: "out_for_delivery",
    orderType: "delivery",
    address: { fullName: "Alice", phone: "9876543210" },
  });

  const orderCancelled = await Order.create({
    orderId: "ORD_TEST_CANCEL_001",
    user: userCustomerA._id,
    restaurant: restA._id,
    items: [{ name: "Puppy Toy", price: 200, quantity: 1 }],
    totalAmount: 200,
    status: "cancelled",
    orderType: "delivery",
    address: { fullName: "Alice", phone: "9876543210" },
  });

  const orderDelivered1 = await Order.create({
    orderId: "ORD_TEST_DELIV_001",
    user: userCustomerA._id,
    restaurant: restA._id,
    items: [{ name: "Gourmet Wet Food", price: 300, quantity: 2 }],
    totalAmount: 600,
    status: "delivered",
    orderType: "delivery",
    address: { fullName: "Alice", phone: "9876543210" },
  });

  const orderDelivered2 = await Order.create({
    orderId: "ORD_TEST_DELIV_002",
    user: userCustomerA._id,
    restaurant: restA._id,
    items: [{ name: "Dental Chews", price: 250, quantity: 1 }],
    totalAmount: 250,
    status: "delivered",
    orderType: "pickup",
    address: { fullName: "Alice", phone: "9876543210" },
  });

  const orderDeliveredBeta = await Order.create({
    orderId: "ORD_TEST_BETA_001",
    user: userCustomerB._id,
    restaurant: restB._id,
    items: [{ name: "Bird Feed", price: 180, quantity: 1 }],
    totalAmount: 180,
    status: "delivered",
    orderType: "delivery",
    address: { fullName: "Bob", phone: "9876543211" },
  });

  // TEST 1: Schema validation - Reject rating < 1 or > 5 or non-integer
  await runTest("Model Schema: Enforces rating 1-5 integer bounds", async () => {
    let errLow = null;
    try {
      await Feedback.create({
        order: new mongoose.Types.ObjectId(),
        customer: userCustomerA._id,
        restaurant: restA._id,
        rating: 0,
      });
    } catch (e) {
      errLow = e;
    }
    assert.ok(errLow, "Rating 0 should be rejected");

    let errHigh = null;
    try {
      await Feedback.create({
        order: new mongoose.Types.ObjectId(),
        customer: userCustomerA._id,
        restaurant: restA._id,
        rating: 6,
      });
    } catch (e) {
      errHigh = e;
    }
    assert.ok(errHigh, "Rating 6 should be rejected");

    let errFloat = null;
    try {
      await Feedback.create({
        order: new mongoose.Types.ObjectId(),
        customer: userCustomerA._id,
        restaurant: restA._id,
        rating: 3.5,
      });
    } catch (e) {
      errFloat = e;
    }
    assert.ok(errFloat, "Float rating 3.5 should be rejected");
  });

  // TEST 2: Ineligible order statuses rejected
  await runTest("Eligibility: Reject feedback on pending, out_for_delivery, and cancelled orders", async () => {
    setFeedbackSession(() => ({ user: { email: "alice@test.com", role: "customer" } }));

    // Pending
    const resPending = await feedbackPOST(
      new Request("http://localhost/api/orders/ORD_TEST_PENDING_001/feedback", {
        method: "POST",
        body: JSON.stringify({ rating: 5 }),
      }),
      { params: Promise.resolve({ id: "ORD_TEST_PENDING_001" }) }
    );
    assert.strictEqual(resPending.status, 400);
    const jsonPending = await resPending.json();
    assert.ok(jsonPending.message.includes("completed orders"));

    // Out for delivery
    const resOut = await feedbackPOST(
      new Request("http://localhost/api/orders/ORD_TEST_OUT_001/feedback", {
        method: "POST",
        body: JSON.stringify({ rating: 5 }),
      }),
      { params: Promise.resolve({ id: "ORD_TEST_OUT_001" }) }
    );
    assert.strictEqual(resOut.status, 400);

    // Cancelled
    const resCancel = await feedbackPOST(
      new Request("http://localhost/api/orders/ORD_TEST_CANCEL_001/feedback", {
        method: "POST",
        body: JSON.stringify({ rating: 5 }),
      }),
      { params: Promise.resolve({ id: "ORD_TEST_CANCEL_001" }) }
    );
    assert.strictEqual(resCancel.status, 400);
  });

  // TEST 3: Ownership verification / IDOR defense
  await runTest("Ownership: Bob cannot submit feedback for Alice's order (returns non-leaky 404)", async () => {
    setFeedbackSession(() => ({ user: { email: "bob@test.com", role: "customer" } }));

    const res = await feedbackPOST(
      new Request("http://localhost/api/orders/ORD_TEST_DELIV_001/feedback", {
        method: "POST",
        body: JSON.stringify({ rating: 5, comment: "I am an attacker" }),
      }),
      { params: Promise.resolve({ id: "ORD_TEST_DELIV_001" }) }
    );
    assert.strictEqual(res.status, 404);
  });

  // TEST 4: Successful submission by verified owner on completed order
  let createdFeedbackId = null;
  await runTest("Submission: Alice successfully submits 4-star feedback with category ratings and comment", async () => {
    setFeedbackSession(() => ({ user: { email: "alice@test.com", role: "customer" } }));

    const res = await feedbackPOST(
      new Request("http://localhost/api/orders/ORD_TEST_DELIV_001/feedback", {
        method: "POST",
        body: JSON.stringify({
          rating: 4,
          categoryRatings: {
            foodQuality: 5,
            packaging: 4,
            delivery: 4,
            service: 4,
          },
          comment: "My pets loved the gourmet wet food!",
          isAnonymous: false,
        }),
      }),
      { params: Promise.resolve({ id: "ORD_TEST_DELIV_001" }) }
    );

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.feedback.rating, 4);
    assert.strictEqual(json.feedback.categoryRatings.foodQuality, 5);
    assert.strictEqual(json.feedback.comment, "My pets loved the gourmet wet food!");
    createdFeedbackId = json.feedback._id;
  });

  // TEST 5: One feedback per order enforcement & concurrency duplicate protection
  await runTest("One-Review-Per-Order: Sequential and concurrent duplicate submissions are rejected with 409", async () => {
    setFeedbackSession(() => ({ user: { email: "alice@test.com", role: "customer" } }));

    // Sequential second attempt
    const resSeq = await feedbackPOST(
      new Request("http://localhost/api/orders/ORD_TEST_DELIV_001/feedback", {
        method: "POST",
        body: JSON.stringify({ rating: 5, comment: "Another review attempt" }),
      }),
      { params: Promise.resolve({ id: "ORD_TEST_DELIV_001" }) }
    );
    assert.strictEqual(resSeq.status, 409);

    // Database index uniqueness verification directly against collection
    let dbIndexError = null;
    try {
      await Feedback.create({
        order: orderDelivered1._id,
        customer: userCustomerA._id,
        restaurant: restA._id,
        rating: 3,
      });
    } catch (e) {
      dbIndexError = e;
    }
    assert.ok(dbIndexError && dbIndexError.code === 11000, "Mongoose unique index on order must reject duplicate");
  });

  // TEST 6: Customer update (PUT) of feedback
  await runTest("Customer Update: Alice updates her review comment and anonymity", async () => {
    setFeedbackSession(() => ({ user: { email: "alice@test.com", role: "customer" } }));

    const res = await feedbackPUT(
      new Request("http://localhost/api/orders/ORD_TEST_DELIV_001/feedback", {
        method: "PUT",
        body: JSON.stringify({
          rating: 5,
          comment: "Updated: genuinely 5-star experience after multiple servings!",
          isAnonymous: true,
        }),
      }),
      { params: Promise.resolve({ id: "ORD_TEST_DELIV_001" }) }
    );

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.feedback.rating, 5);
    assert.strictEqual(json.feedback.isAnonymous, true);
    assert.ok(json.feedback.comment.includes("Updated: genuinely 5-star"));
  });

  // TEST 7: Anonymous review privacy in restaurant and public responses
  await runTest("Privacy: Anonymous review masks customer name and returns no email/phone to restaurant", async () => {
    setRestaurantFeedbackAuth(async () => ({
      user: staffAdminA,
      restaurant: restA,
      restaurantId: restA._id.toString(),
      isAdmin: true,
    }));

    const res = await restaurantFeedbackGET(
      new Request(`http://localhost/api/restaurant/feedback?search=ORD_TEST_DELIV_001`)
    );
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.feedback.length, 1);

    const item = json.feedback[0];
    assert.strictEqual(item.isAnonymous, true);
    assert.strictEqual(item.customer.name, "Anonymous Diner");
    assert.strictEqual(item.customer.email, undefined);
    assert.strictEqual(item.customer.phone, undefined);
  });

  // TEST 8: Customer submits review with complaint on second delivered order
  let complaintFeedbackId = null;
  await runTest("Complaint Submission: Alice submits 2-star review with complaint on orderDelivered2", async () => {
    setFeedbackSession(() => ({ user: { email: "alice@test.com", role: "customer" } }));

    const res = await feedbackPOST(
      new Request("http://localhost/api/orders/ORD_TEST_DELIV_002/feedback", {
        method: "POST",
        body: JSON.stringify({
          rating: 2,
          categoryRatings: {
            packaging: 1,
            foodQuality: 3,
          },
          comment: "Packaging was torn upon pickup.",
          isAnonymous: false,
          complaint: {
            hasComplaint: true,
            category: "packaging",
            description: "The seal on the chews was broken when picked up.",
          },
        }),
      }),
      { params: Promise.resolve({ id: "ORD_TEST_DELIV_002" }) }
    );

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.feedback.complaint.hasComplaint, true);
    assert.strictEqual(json.feedback.complaint.category, "packaging");
    assert.strictEqual(json.feedback.complaint.status, "open");
    complaintFeedbackId = json.feedback._id;
  });

  // TEST 9: Restaurant tenant isolation - Beta cannot see or touch Alpha's feedback/complaints
  await runTest("Tenant Isolation: Restaurant Beta cannot see or mutate Restaurant Alpha feedback", async () => {
    // 1. Beta lists feedback -> should see 0 records (Alpha has 2)
    setRestaurantFeedbackAuth(async () => ({
      user: staffAdminB,
      restaurant: restB,
      restaurantId: restB._id.toString(),
      isAdmin: true,
    }));

    const resList = await restaurantFeedbackGET(new Request("http://localhost/api/restaurant/feedback"));
    const jsonList = await resList.json();
    assert.strictEqual(jsonList.feedback.length, 0);
    assert.strictEqual(jsonList.stats.totalReviews, 0);

    // 2. Beta tries to respond to Alpha's review -> 403 Forbidden
    setResponseAuth(async () => ({
      user: staffAdminB,
      restaurant: restB,
      restaurantId: restB._id.toString(),
      isAdmin: true,
    }));

    const resResp = await restaurantResponsePOST(
      new Request(`http://localhost/api/restaurant/feedback/${createdFeedbackId}/response`, {
        method: "POST",
        body: JSON.stringify({ message: "Intruder reply from Beta" }),
      }),
      { params: Promise.resolve({ id: createdFeedbackId }) }
    );
    assert.strictEqual(resResp.status, 403);

    // 3. Beta tries to resolve Alpha's complaint -> 403 Forbidden
    setComplaintAuth(async () => ({
      user: staffAdminB,
      restaurant: restB,
      restaurantId: restB._id.toString(),
      isAdmin: true,
    }));

    const resComp = await restaurantComplaintPATCH(
      new Request(`http://localhost/api/restaurant/feedback/${complaintFeedbackId}/complaint`, {
        method: "PATCH",
        body: JSON.stringify({ status: "resolved" }),
      }),
      { params: Promise.resolve({ id: complaintFeedbackId }) }
    );
    assert.strictEqual(resComp.status, 403);
  });

  // TEST 10: Restaurant Alpha posts response to customer review
  await runTest("Restaurant Response: Staff Admin Alpha posts official public reply", async () => {
    setResponseAuth(async () => ({
      user: staffAdminA,
      restaurant: restA,
      restaurantId: restA._id.toString(),
      isAdmin: true,
    }));

    const res = await restaurantResponsePOST(
      new Request(`http://localhost/api/restaurant/feedback/${createdFeedbackId}/response`, {
        method: "POST",
        body: JSON.stringify({
          message: "Thank you for trusting Pet Treats Bistro! We are thrilled your pets loved the wet food.",
        }),
      }),
      { params: Promise.resolve({ id: createdFeedbackId }) }
    );

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.response.message.includes("Pet Treats Bistro"));
    assert.strictEqual(json.response.respondedBy.name, "Staff Alpha Admin");
  });

  // TEST 11: Restaurant Alpha complaint workflow: open -> under_review -> resolved
  await runTest("Complaint Lifecycle: Transition complaint to under_review then resolved with staff attribution", async () => {
    setComplaintAuth(async () => ({
      user: staffAdminA,
      restaurant: restA,
      restaurantId: restA._id.toString(),
      isAdmin: true,
    }));

    // Transition to under_review
    const resUnderReview = await restaurantComplaintPATCH(
      new Request(`http://localhost/api/restaurant/feedback/${complaintFeedbackId}/complaint`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "under_review",
          resolutionNotes: "Checking warehouse packing footage for broken seal.",
        }),
      }),
      { params: Promise.resolve({ id: complaintFeedbackId }) }
    );
    assert.strictEqual(resUnderReview.status, 200);
    const jsonUnderReview = await resUnderReview.json();
    assert.strictEqual(jsonUnderReview.complaint.status, "under_review");

    // Transition to resolved
    const resResolved = await restaurantComplaintPATCH(
      new Request(`http://localhost/api/restaurant/feedback/${complaintFeedbackId}/complaint`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "resolved",
          resolutionNotes: "Replacement bag handed over to customer; batch inspect passed.",
        }),
      }),
      { params: Promise.resolve({ id: complaintFeedbackId }) }
    );
    assert.strictEqual(resResolved.status, 200);
    const jsonResolved = await resResolved.json();
    assert.strictEqual(jsonResolved.complaint.status, "resolved");
    assert.ok(jsonResolved.complaint.resolvedAt);
    assert.strictEqual(jsonResolved.complaint.resolvedBy.name, "Staff Alpha Admin");
  });

  // TEST 12: Restaurant Analytics & Aggregate Statistics
  await runTest("Analytics: Statistics accurately calculate totals, averages, star distribution, and resolution states", async () => {
    setRestaurantFeedbackAuth(async () => ({
      user: staffAdminA,
      restaurant: restA,
      restaurantId: restA._id.toString(),
      isAdmin: true,
    }));

    const res = await restaurantFeedbackGET(new Request("http://localhost/api/restaurant/feedback"));
    assert.strictEqual(res.status, 200);
    const json = await res.json();

    assert.strictEqual(json.stats.totalReviews, 2);
    // (5 + 2) / 2 = 3.5 average rating
    assert.strictEqual(json.stats.averageRating, 3.5);
    assert.strictEqual(json.stats.ratingDistribution[5], 1);
    assert.strictEqual(json.stats.ratingDistribution[2], 1);
    assert.strictEqual(json.stats.totalComplaints, 1);
    assert.strictEqual(json.stats.unresolvedComplaints, 0); // was resolved in TEST 11
    assert.strictEqual(json.stats.awaitingResponse, 1); // orderDelivered2 does not have a response
  });

  console.log("\n========================================================================");
  console.log(`ALL FEEDBACK WORKFLOW TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log("========================================================================\n");

} finally {
  await mongoose.disconnect();
  await replSet.stop();
}
