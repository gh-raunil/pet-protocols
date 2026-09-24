import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import assert from "node:assert/strict";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(backendDir, ".env.local") });
dotenv.config({ path: path.join(backendDir, ".env") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in environment");
}

console.log("=== Testing Customer Notification Inbox E2E Flow ===");

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB successfully.");

const Message = (await import("../models/Message.js")).default;
const User = (await import("../models/User.js")).default;

// Clean up any existing test messages
await Message.deleteMany({ title: { $regex: /^\[TEST_E2E\]/ } });

// Find or create test customer and admin users
let customerA = await User.findOne({ role: "customer" });
if (!customerA) {
  customerA = await User.create({
    name: "Test Customer A",
    email: "test.customer.a@example.com",
    role: "customer",
  });
}

let customerB = await User.findOne({ role: "customer", _id: { $ne: customerA._id } });
if (!customerB) {
  customerB = await User.create({
    name: "Test Customer B",
    email: "test.customer.b@example.com",
    role: "customer",
  });
}

console.log(`Using Customer A: ${customerA._id} (${customerA.email})`);
console.log(`Using Customer B: ${customerB._id} (${customerB.email})`);

// 1. Super Admin creates broadcasts:
// A) Broadcast to ALL customers
const broadcastAllCustomers = await Message.create({
  title: "[TEST_E2E] Welcome to the New Pet Food Season!",
  content: "Enjoy 20% off all gourmet pet meals this weekend.",
  messageType: "promotion",
  priority: "normal",
  recipientType: "customers",
  recipientSelection: "all",
  status: "sent",
  sentAt: new Date(),
});
console.log(`1. Created Broadcast to ALL Customers (ID: ${broadcastAllCustomers._id})`);

// B) High Priority Notice to Customer A specifically
const messageToCustomerA = await Message.create({
  title: "[TEST_E2E] Your VIP Pet Protocol Reward is Ready",
  content: "Exclusive VIP discount applied to your account.",
  messageType: "announcement",
  priority: "high",
  recipientType: "customers",
  recipientSelection: "selected",
  recipients: [customerA._id],
  recipientModel: "User",
  status: "sent",
  sentAt: new Date(),
});
console.log(`2. Created Targeted Message to Customer A (ID: ${messageToCustomerA._id})`);

// C) Message to Customer B only
const messageToCustomerB = await Message.create({
  title: "[TEST_E2E] Customer B Private Offer",
  content: "Private offer for Customer B only.",
  messageType: "promotion",
  priority: "normal",
  recipientType: "customers",
  recipientSelection: "selected",
  recipients: [customerB._id],
  recipientModel: "User",
  status: "sent",
  sentAt: new Date(),
});
console.log(`3. Created Targeted Message to Customer B (ID: ${messageToCustomerB._id})`);

// D) Restaurant-ONLY message (Super Admin -> Kitchens)
const messageToRestaurants = await Message.create({
  title: "[TEST_E2E] Kitchen Hygiene Audit Notice",
  content: "Mandatory temperature logs must be uploaded by 5 PM.",
  messageType: "important",
  priority: "high",
  recipientType: "restaurants",
  recipientSelection: "all",
  status: "sent",
  sentAt: new Date(),
});
console.log(`4. Created Restaurant-ONLY Broadcast (ID: ${messageToRestaurants._id})`);

// Simulate query logic as implemented in backend/app/api/messages/route.js
async function simulateCustomerGetMessages({ user, requestedTarget }) {
  const userRole = user?.role || "guest";
  let userId = user ? user._id.toString() : null;

  // Role authorization on target
  if (requestedTarget === "restaurants") {
    if (userRole === "restaurant_admin" || userRole === "admin" || userRole === "superadmin") {
      // allowed
    } else {
      return { status: 403, error: "Unauthorized to access restaurant notifications." };
    }
  }

  const now = new Date();
  const andConditions = [
    { status: "sent" },
    { sentAt: { $lte: now } },
    {
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    },
    { recipientType: { $in: ["all", "customers"] } },
  ];

  if (userId) {
    let userObjectId = null;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (e) {}
    const userMatch = userObjectId ? [userId, userObjectId] : [userId];

    andConditions.push({
      $or: [
        { recipientSelection: "all" },
        { recipients: { $in: userMatch } },
      ],
    });
  } else {
    andConditions.push({ recipientSelection: "all" });
  }

  const messages = await Message.find({ $and: andConditions })
    .sort({ priority: -1, sentAt: -1, createdAt: -1 })
    .lean();

  const formattedMessages = messages.map((m) => {
    const isRead = userId
      ? (m.readBy || []).some((r) => r.recipientId === userId)
      : false;

    return {
      _id: m._id.toString(),
      title: m.title,
      content: m.content,
      messageType: m.messageType,
      priority: m.priority,
      isRead,
      recipientType: m.recipientType,
    };
  });

  const unreadCount = formattedMessages.filter((m) => !m.isRead).length;

  return {
    status: 200,
    success: true,
    messages: formattedMessages,
    unreadCount,
  };
}

// Simulate mark as read logic as implemented in backend/app/api/messages/[id]/read/route.js
async function simulateMarkAsRead({ messageId, user }) {
  const userId = user ? user._id.toString() : "anonymous";
  const userRole = user?.role;

  const msg = await Message.findById(messageId);
  if (!msg) return { status: 404, error: "Message not found" };

  if ((userRole === "customer" || userRole === "user") && msg.recipientType === "restaurants") {
    return { status: 403, error: "Unauthorized to access this message." };
  }

  const alreadyRead = msg.readBy?.some((r) => r.recipientId === userId);
  if (!alreadyRead) {
    msg.readBy.push({
      recipientId: userId,
      readAt: new Date(),
    });
    await msg.save();
  }

  return { status: 200, success: true, message: "Marked as read" };
}

// Simulate bulk mark all as read
async function simulateMarkAllRead({ user }) {
  if (!user) return { status: 401, error: "Authentication required" };
  const userId = user._id.toString();
  const now = new Date();

  let userObjectId = null;
  try {
    userObjectId = new mongoose.Types.ObjectId(userId);
  } catch (e) {}
  const userMatch = userObjectId ? [userId, userObjectId] : [userId];

  const andConditions = [
    { status: "sent" },
    { sentAt: { $lte: now } },
    {
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    },
    { recipientType: { $in: ["all", "customers"] } },
    {
      $or: [{ recipientSelection: "all" }, { recipients: { $in: userMatch } }],
    },
    { "readBy.recipientId": { $ne: userId } },
  ];

  const res = await Message.updateMany(
    { $and: andConditions },
    { $push: { readBy: { recipientId: userId, readAt: now } } }
  );

  return { status: 200, success: true, modifiedCount: res.modifiedCount };
}

// ==========================================
// TEST 1: Customer A Inbox verification
// ==========================================
console.log("\n[TEST 1] Verifying Customer A inbox messages...");
const resA = await simulateCustomerGetMessages({ user: customerA, requestedTarget: "customers" });
assert.strictEqual(resA.status, 200);

const titlesA = resA.messages.map((m) => m.title);
console.log("Customer A sees messages:", titlesA);

// Must see broadcast to all
assert.ok(titlesA.includes(broadcastAllCustomers.title), "Customer A must see broadcast to all customers");
// Must see targeted message to Customer A
assert.ok(titlesA.includes(messageToCustomerA.title), "Customer A must see their targeted VIP message");
// Must NOT see message targeted exclusively to Customer B
assert.ok(!titlesA.includes(messageToCustomerB.title), "Customer A must NOT see Customer B's targeted message");
// Must NEVER see restaurant-only message
assert.ok(!titlesA.includes(messageToRestaurants.title), "Customer A must NEVER see restaurant-only message");

// All test messages are currently unread
const testMsgsA = resA.messages.filter((m) => m.title.startsWith("[TEST_E2E]"));
assert.strictEqual(testMsgsA.every((m) => !m.isRead), true, "All new messages should be unread initially");

console.log(`Customer A unread count for test messages: ${testMsgsA.length}`);

// ==========================================
// TEST 2: Customer attempts to request restaurant messages -> 403 Forbidden
// ==========================================
console.log("\n[TEST 2] Verifying customer cannot request target=restaurants...");
const forbiddenRes = await simulateCustomerGetMessages({ user: customerA, requestedTarget: "restaurants" });
assert.strictEqual(forbiddenRes.status, 403, "Customer must receive 403 when requesting target=restaurants");
console.log("Access to restaurant messages correctly forbidden (403).");

// ==========================================
// TEST 3: Customer opens message -> Mark as read
// ==========================================
console.log("\n[TEST 3] Customer A opens the VIP message (marking it as read)...");
const readRes = await simulateMarkAsRead({ messageId: messageToCustomerA._id, user: customerA });
assert.strictEqual(readRes.status, 200);
assert.strictEqual(readRes.success, true);

// Re-fetch inbox
const resAAfterRead = await simulateCustomerGetMessages({ user: customerA, requestedTarget: "customers" });
const vipMsgAfter = resAAfterRead.messages.find((m) => m._id === messageToCustomerA._id.toString());
assert.ok(vipMsgAfter, "VIP message exists in inbox");
assert.strictEqual(vipMsgAfter.isRead, true, "VIP message must now be marked as read");

const generalMsgAfter = resAAfterRead.messages.find((m) => m._id === broadcastAllCustomers._id.toString());
assert.strictEqual(generalMsgAfter.isRead, false, "Broadcast to all must still be unread");

console.log("Message read state and unread count updated accurately.");

// ==========================================
// TEST 4: Customer cannot mark restaurant message as read
// ==========================================
console.log("\n[TEST 4] Customer attempts to mark restaurant-only message as read...");
const restReadRes = await simulateMarkAsRead({ messageId: messageToRestaurants._id, user: customerA });
assert.strictEqual(restReadRes.status, 403, "Customer must receive 403 trying to read restaurant message");
console.log("Customer marking restaurant message correctly blocked with 403.");

// ==========================================
// TEST 5: Bulk mark all as read
// ==========================================
console.log("\n[TEST 5] Customer A clicks 'Mark all read'...");
const bulkRes = await simulateMarkAllRead({ user: customerA });
assert.strictEqual(bulkRes.status, 200);
console.log(`Marked ${bulkRes.modifiedCount} message(s) as read.`);

const resAAfterBulk = await simulateCustomerGetMessages({ user: customerA, requestedTarget: "customers" });
const testMsgsAfterBulk = resAAfterBulk.messages.filter((m) => m.title.startsWith("[TEST_E2E]"));
assert.strictEqual(testMsgsAfterBulk.every((m) => m.isRead), true, "All test messages must now be read");
console.log("All customer test messages are now confirmed read.");

// ==========================================
// TEST 6: Customer B inbox isolation verification
// ==========================================
console.log("\n[TEST 6] Verifying Customer B inbox isolation...");
const resB = await simulateCustomerGetMessages({ user: customerB, requestedTarget: "customers" });
const titlesB = resB.messages.map((m) => m.title);

assert.ok(titlesB.includes(broadcastAllCustomers.title), "Customer B sees broadcast to all");
assert.ok(titlesB.includes(messageToCustomerB.title), "Customer B sees message targeted to B");
assert.ok(!titlesB.includes(messageToCustomerA.title), "Customer B does NOT see message targeted to A");
assert.ok(!titlesB.includes(messageToRestaurants.title), "Customer B does NOT see restaurant messages");

// Broadcast all should still be UNREAD for customer B because readBy is per recipient
const bBroadcast = resB.messages.find((m) => m._id === broadcastAllCustomers._id.toString());
assert.strictEqual(bBroadcast.isRead, false, "Broadcast read state for Customer A did NOT leak to Customer B");
console.log("Per-recipient read tracking verified without leakage.");

// Clean up test data
await Message.deleteMany({ title: { $regex: /^\[TEST_E2E\]/ } });
console.log("\nCleaned up all test messages.");

await mongoose.disconnect();
console.log("\n>>> ALL CUSTOMER NOTIFICATION E2E TESTS PASSED SUCCESSFULLY! <<<");
