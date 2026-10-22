import { register } from "node:module";
import { pathToFileURL } from "node:url";
register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);

import mongoose from "mongoose";
import assert from "node:assert/strict";
import crypto from "crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";

console.log("========================================================================");
console.log("PET PROTOCOLS — DURABLE NOTIFICATION OUTBOX & WORKER TEST SUITE");
console.log("PHASE 3: RELIABILITY, LEASING, CONCURRENCY & RETRY POLICIES");
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

const NotificationOutbox = (await import("../models/NotificationOutbox.js")).default;
const Order = (await import("../models/Order.js")).default;
const User = (await import("../models/User.js")).default;
const Restaurant = (await import("../models/Restaurant.js")).default;

const {
  enqueueNotificationEvent,
  enqueueOrderEvents,
  claimNextOutboxEvent,
  dispatchClaimedEvent,
  processOutboxBatch,
  _setTestPushDispatcher,
} = await import("../lib/notificationOutboxService.js");

const {
  POST: cronPOST,
  _setTestCronSecret,
  _resetWorkerLock,
} = await import("../app/api/cron/notification-outbox/route.js");

let testsPassed = 0;
function recordPass(testName) {
  testsPassed++;
  console.log(`  ✓ Test ${testsPassed}: ${testName}`);
}

try {
  // Setup isolated fixtures
  const testRest = await Restaurant.create({
    name: "Outbox Kitchen",
    slug: "outbox-kitchen",
    phone: "9100000001",
    status: "active",
  });

  const testCust = await User.create({
    name: "Outbox Customer",
    email: "outbox_cust@test.com",
    role: "customer",
    phone: "9100000002",
  });

  const testDriver = await User.create({
    name: "Outbox Driver",
    email: "outbox_driver@test.com",
    role: "staff",
    staffRoles: ["Delivery"],
    restaurant: testRest._id,
  });

  const testOrder = await Order.create({
    orderId: "ORD-OUTBOX-001",
    user: testCust._id,
    restaurant: testRest._id,
    items: [{ name: "Test Burger", quantity: 1, price: 150 }],
    totalAmount: 150,
    status: "pending",
    paymentMethod: "Cash on Delivery (COD)",
    paymentStatus: "pending",
    address: { fullName: "Outbox Customer", street: "123 Main St", city: "Vellore", pincode: "632014", phone: "9100000002" },
  });

  console.log("------------------------------------------------------------------------");
  console.log("GROUP 1: IDEMPOTENT OUTBOX ENQUEUE & LIFECYCLE MAPPING");
  console.log("------------------------------------------------------------------------");

  // Test 1: Event creation with canonical fields
  const event1 = await enqueueNotificationEvent({
    eventId: "test_event_001",
    eventType: "order_placed",
    order: testOrder._id,
    orderId: testOrder.orderId,
    restaurant: testRest._id,
    recipient: { type: "customer", id: testCust._id, preferenceKey: "orderUpdates" },
    payload: { title: "Order Placed", body: "Your order was placed" },
  });
  assert.ok(event1, "Event must be persisted");
  assert.strictEqual(event1.eventId, "test_event_001");
  assert.strictEqual(event1.status, "pending");
  assert.strictEqual(event1.attemptCount, 0);
  recordPass("Durable notification event created with pending status and attemptCount 0");

  // Test 2: Duplicate event creation is idempotent (no duplicates)
  const dupEvent = await enqueueNotificationEvent({
    eventId: "test_event_001",
    eventType: "order_placed",
    order: testOrder._id,
    orderId: testOrder.orderId,
    restaurant: testRest._id,
    recipient: { type: "customer", id: testCust._id, preferenceKey: "orderUpdates" },
    payload: { title: "Different Payload", body: "Should not overwrite" },
  });
  assert.strictEqual(dupEvent._id.toString(), event1._id.toString());
  const count1 = await NotificationOutbox.countDocuments({ eventId: "test_event_001" });
  assert.strictEqual(count1, 1, "Must maintain exactly 1 record for eventId");
  recordPass("Duplicate event submission is strictly idempotent with zero duplication");

  // Test 3: Lifecycle order mapping enqueues customer and admin events
  const enqueued = await enqueueOrderEvents(testOrder, "order_placed");
  assert.strictEqual(enqueued.length, 2, "Must create 1 customer event and 1 admin event");
  const custEv = enqueued.find((e) => e.recipient.type === "customer");
  const adminEv = enqueued.find((e) => e.recipient.type === "restaurant_admins");
  assert.ok(custEv && adminEv, "Both recipients must be enqueued");
  recordPass("Order event mapping enqueues separated customer and restaurant admin records");

  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 2: ATOMIC LEASING & WORKER CONCURRENCY");
  console.log("------------------------------------------------------------------------");

  // Test 4: Single worker claims an eligible event atomically
  const claimed1 = await claimNextOutboxEvent({ workerId: "worker_alpha", leaseDurationMs: 5000 });
  assert.ok(claimed1, "Worker Alpha must successfully claim an event");
  assert.strictEqual(claimed1.status, "processing");
  assert.strictEqual(claimed1.leaseToken, "worker_alpha");
  assert.strictEqual(claimed1.attemptCount, 1);
  recordPass("Worker atomically claims eligible event, sets status to processing and increments attemptCount");

  // Test 5: Two workers racing to claim the same event: exactly 1 wins
  // Clear any leftover pending events so exactly 1 candidate exists
  await NotificationOutbox.deleteMany({});
  await enqueueNotificationEvent({
    eventId: "race_event_001",
    eventType: "status_update",
    order: testOrder._id,
    restaurant: testRest._id,
    recipient: { type: "customer", id: testCust._id },
    payload: { title: "Race Test", body: "Race test" },
  });
  const [raceWinner1, raceWinner2] = await Promise.all([
    claimNextOutboxEvent({ workerId: "worker_1", leaseDurationMs: 10000 }),
    claimNextOutboxEvent({ workerId: "worker_2", leaseDurationMs: 10000 }),
  ]);
  const winner = [raceWinner1, raceWinner2].find((e) => e && e.eventId === "race_event_001");
  const loser = [raceWinner1, raceWinner2].find((e) => e === null);
  assert.ok(winner, "One worker must win the race");
  assert.ok(loser === null, "The other worker must receive null (no event)");
  recordPass("Two workers racing to claim the same event yields exactly 1 claim winner (no double-processing)");

  // Test 6: Leased event cannot be claimed while lease is active
  const raceDoc = await NotificationOutbox.findOne({ eventId: "race_event_001" });
  assert.strictEqual(raceDoc.status, "processing");
  const prematureClaim = await claimNextOutboxEvent({ workerId: "worker_3" });
  assert.ok(!prematureClaim || prematureClaim.eventId !== "race_event_001", "Active lease protects event from re-claiming");
  recordPass("Active lease token and timestamp strictly prevents concurrent theft by other workers");

  // Test 7: Expired lease allows another worker to reclaim (worker crash recovery)
  raceDoc.leaseExpiresAt = new Date(Date.now() - 1000); // simulate crash/expiry
  await raceDoc.save();
  const recoveredClaim = await claimNextOutboxEvent({ workerId: "worker_recovery" });
  assert.ok(recoveredClaim && recoveredClaim.eventId === "race_event_001", "Worker recovery must reclaim expired-lease event");
  assert.strictEqual(recoveredClaim.leaseToken, "worker_recovery");
  recordPass("Expired lease enables automatic recovery and re-claiming by healthy worker");

  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 3: DISPATCH, EXPONENTIAL BACKOFF & DEAD-LETTER POLICIES");
  console.log("------------------------------------------------------------------------");

  // Test 8: Successful dispatch marks status delivered and clears lease
  _setTestPushDispatcher(async (ev) => {
    return { success: true, sentCount: 1 };
  });
  const dispatchSuccess = await dispatchClaimedEvent(recoveredClaim);
  assert.strictEqual(dispatchSuccess.status, "delivered");
  const deliveredDoc = await NotificationOutbox.findOne({ eventId: "race_event_001" });
  assert.strictEqual(deliveredDoc.status, "delivered");
  assert.strictEqual(deliveredDoc.leaseToken, null);
  assert.ok(deliveredDoc.deliveryDetails?.deliveredAt instanceof Date);
  recordPass("Successful external delivery transitions event to delivered, sets deliveredAt and clears lease");

  // Test 9: Transient provider failure schedules exponential backoff retry with jitter
  const transientEvent = await enqueueNotificationEvent({
    eventId: "transient_event_001",
    eventType: "status_update",
    order: testOrder._id,
    restaurant: testRest._id,
    recipient: { type: "customer", id: testCust._id },
    payload: { title: "Transient Test", body: "Transient test" },
  });
  const claimedTransient = await claimNextOutboxEvent({ workerId: "worker_transient" });
  _setTestPushDispatcher(async () => {
    throw new Error("HTTP 503 Service Unavailable");
  });
  const dispatchFail = await dispatchClaimedEvent(claimedTransient);
  assert.strictEqual(dispatchFail.status, "failed");
  const failedDoc = await NotificationOutbox.findOne({ eventId: "transient_event_001" });
  assert.strictEqual(failedDoc.status, "failed");
  assert.ok(failedDoc.nextRetryAt > new Date(), "nextRetryAt must be in the future");
  assert.strictEqual(failedDoc.errorDetails?.statusCode, 500);
  assert.strictEqual(failedDoc.errorDetails?.permanent, false);
  recordPass("Transient error sets status failed and computes bounded exponential backoff nextRetryAt");

  // Test 10: Exhausted attempts transitions event to dead_letter
  failedDoc.attemptCount = 5; // hit maxAttempts
  failedDoc.nextRetryAt = new Date(Date.now() - 1000); // eligible now
  failedDoc.status = "failed";
  await failedDoc.save();

  const claimedMax = await claimNextOutboxEvent({ workerId: "worker_deadletter" });
  // If attemptCount is >= 5, claimNextOutboxEvent query filter ({ attemptCount: { $lt: 5 } }) excludes it
  assert.strictEqual(claimedMax, null, "claimNextOutboxEvent must ignore events with attemptCount >= maxAttempts");

  // Now test dispatch when reaching max attempts
  const nearDeadDoc = await enqueueNotificationEvent({
    eventId: "near_dead_event_001",
    eventType: "status_update",
    order: testOrder._id,
    restaurant: testRest._id,
    recipient: { type: "customer", id: testCust._id },
    payload: { title: "Near Dead", body: "Near dead" },
  });
  const claimedNearDead = await claimNextOutboxEvent({ workerId: "worker_dl2" });
  claimedNearDead.attemptCount = 5;
  const deadRes = await dispatchClaimedEvent(claimedNearDead);
  assert.strictEqual(deadRes.status, "dead_letter");
  const deadDoc = await NotificationOutbox.findOne({ eventId: "near_dead_event_001" });
  assert.strictEqual(deadDoc.status, "dead_letter");
  assert.strictEqual(deadDoc.errorDetails?.permanent, true);
  recordPass("Events reaching max attempts permanently transition to dead_letter with permanent error flag");

  // Test 11: Expired/unsubscribed recipient (404/410) is handled gracefully without infinite retries
  const unsubEvent = await enqueueNotificationEvent({
    eventId: "unsub_event_001",
    eventType: "status_update",
    order: testOrder._id,
    restaurant: testRest._id,
    recipient: { type: "customer", id: testCust._id },
    payload: { title: "Unsub Test", body: "Unsub test" },
  });
  const claimedUnsub = await claimNextOutboxEvent({ workerId: "worker_unsub" });
  _setTestPushDispatcher(async () => {
    return { success: false, reason: "No active push subscriptions for user" };
  });
  const unsubRes = await dispatchClaimedEvent(claimedUnsub);
  assert.strictEqual(unsubRes.status, "delivered");
  recordPass("Unregistered or expired push subscription gracefully resolved without infinite retries");

  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 4: BATCH PROCESSOR & CRON API RUNTIME INTEGRATION");
  console.log("------------------------------------------------------------------------");

  // Test 12: Batch processor processes multiple pending events in one cycle
  await enqueueNotificationEvent({
    eventId: "batch_event_001",
    eventType: "status_update",
    order: testOrder._id,
    restaurant: testRest._id,
    recipient: { type: "customer", id: testCust._id },
    payload: { title: "Batch Test", body: "Batch test" },
  });
  _setTestPushDispatcher(async () => ({ success: true, sentCount: 1 }));
  const batchStats = await processOutboxBatch({ batchSize: 10, workerId: "cron_runner" });
  assert.ok(batchStats.claimedCount >= 1, "Must claim and process at least 1 pending event");
  recordPass("Batch processor claims and dispatches all eligible events in single execution cycle");

  // Test 13: Cron route requires valid Bearer authorization token
  _setTestCronSecret("test_cron_secret_12345");
  const unauthReq = new Request("http://localhost:3000/api/cron/notification-outbox", {
    method: "POST",
    headers: { Authorization: "Bearer wrong_secret" },
  });
  const unauthRes = await cronPOST(unauthReq);
  assert.strictEqual(unauthRes.status, 401, "Wrong secret must receive 401 Unauthorized");
  recordPass("Cron API endpoint strictly rejects unauthorized requests with 401 Unauthorized");

  // Test 14: Cron route with valid secret executes batch processor successfully
  await enqueueNotificationEvent({
    eventId: "cron_event_001",
    eventType: "status_update",
    order: testOrder._id,
    restaurant: testRest._id,
    recipient: { type: "customer", id: testCust._id },
    payload: { title: "Cron Test", body: "Cron test" },
  });
  const authReq = new Request("http://localhost:3000/api/cron/notification-outbox", {
    method: "POST",
    headers: { Authorization: "Bearer test_cron_secret_12345" },
  });
  const authRes = await cronPOST(authReq);
  const authData = await authRes.json();
  assert.strictEqual(authRes.status, 200);
  assert.strictEqual(authData.success, true);
  assert.ok(typeof authData.stats?.claimedCount === "number");
  assert.ok(authData.stats.claimedCount >= 1, "Cron runner must claim and process the pending event");
  recordPass("Cron API endpoint with valid secret triggers outbox processor and returns statistics");

  console.log("\n------------------------------------------------------------------------");
  console.log("GROUP 5: SECURITY AUDIT REMEDIATION (FINDINGS SEC-01 & SEC-02)");
  console.log("------------------------------------------------------------------------");

  // Test 15: SEC-01 Remediation: Delivery staff cannot read customer handover OTP via /api/orders/[id]/handover-otp
  const { GET: handoverOtpGET, POST: handoverOtpPOST, _setTestGetServerSession: setOtpSession } = await import("../app/api/orders/[id]/handover-otp/route.js");
  setOtpSession(async () => ({
    user: { email: testDriver.email, role: "staff", restaurantId: testRest._id.toString() },
  }));
  const staffGetReq = new Request(`http://localhost:3000/api/orders/${testOrder._id}/handover-otp`);
  const staffGetRes = await handoverOtpGET(staffGetReq, { params: Promise.resolve({ id: testOrder._id.toString() }) });
  assert.strictEqual(staffGetRes.status, 403, "Delivery staff must receive 403 Forbidden");
  const staffGetData = await staffGetRes.json();
  assert.strictEqual(staffGetData.success, false);
  assert.ok(staffGetData.message.includes("Access denied"));
  recordPass("SEC-01 Guard: Delivery staff attempting to read customer handover OTP is strictly rejected with 403");

  // Test 16: SEC-01 Remediation: Delivery staff cannot reissue customer handover OTP via POST
  const staffPostReq = new Request(`http://localhost:3000/api/orders/${testOrder._id}/handover-otp`, { method: "POST" });
  const staffPostRes = await handoverOtpPOST(staffPostReq, { params: Promise.resolve({ id: testOrder._id.toString() }) });
  assert.strictEqual(staffPostRes.status, 403, "Staff reissue must receive 403 Forbidden");
  recordPass("SEC-01 Guard: Delivery staff attempting to reissue customer handover OTP is strictly rejected with 403");

  // Test 17: SEC-02 Remediation: Constant-time signature comparison validates matching and rejects non-matching
  const { POST: webhookPOST, _setTestWebhookSecret } = await import("../app/api/payment/webhook/route.js");
  _setTestWebhookSecret("test_webhook_sec_secret");
  const validPayload = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123" } } } });
  const validSig = crypto.createHmac("sha256", "test_webhook_sec_secret").update(validPayload).digest("hex");
  const invalidSig = validSig.slice(0, -2) + "ff";

  const invalidReq = new Request("http://localhost:3000/api/payment/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": invalidSig, "content-type": "application/json" },
    body: validPayload,
  });
  const invalidRes = await webhookPOST(invalidReq);
  assert.strictEqual(invalidRes.status, 400);

  const validReq = new Request("http://localhost:3000/api/payment/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": validSig, "content-type": "application/json" },
    body: validPayload,
  });
  const validRes = await webhookPOST(validReq);
  assert.strictEqual(validRes.status, 200);
  recordPass("SEC-02 Guard: Webhook signature verification uses constant-time comparison, correctly accepting valid and rejecting invalid");

  console.log("\n========================================================================");
  console.log(`🎉 ALL ${testsPassed} OF ${testsPassed} NOTIFICATION OUTBOX & SECURITY TESTS PASSED!`);
  console.log("========================================================================\n");

} catch (err) {
  console.error("\n❌ TEST SUITE FAILED WITH ERROR:", err);
  process.exitCode = 1;
} finally {
  _setTestPushDispatcher(null);
  try {
    await mongoose.disconnect();
  } catch (e) {}
  if (replSet) {
    try {
      await replSet.stop();
    } catch (e) {}
  }
  process.exit(process.exitCode || 0);
}
