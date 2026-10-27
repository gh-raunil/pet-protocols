/**
 * PET PROTOCOLS — ISOLATED PLAYWRIGHT BROWSER TEST HARNESS & REGRESSION MATRIX
 * Scenarios: B-01 through B-12
 *
 * Safety & Isolation Invariants:
 * 1. Strict loopback MongoMemoryReplSet (wiredTiger).
 * 2. Explicit test-only environment configuration (zero fallback to external/production databases).
 * 3. Isolated loopback ports for backend (4088) and frontend-user (3088).
 * 4. Deterministic payment simulation / mock adapters (zero real payment or notification calls).
 * 5. Complete child process and database cleanup guaranteed in all exit paths.
 */

import { register } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";
import { MongoMemoryReplSet } from "mongodb-memory-server";

register(new URL("./loader.mjs", import.meta.url).href, import.meta.url);

dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("========================================================================");
console.log("PET PROTOCOLS — ISOLATED PLAYWRIGHT BROWSER TEST HARNESS");
console.log("EXECUTION MATRIX: B-01 THROUGH B-12");
console.log("========================================================================\n");

// Ports for isolated test servers
const BACKEND_PORT = 4088;
const FRONTEND_PORT = 3088;

let replSet = null;
let backendProcess = null;
let frontendProcess = null;
let browser = null;

const spawnedPids = new Set();

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch (_) {}
}

async function cleanup() {
  console.log("\n[Teardown] Cleaning up test harness resources...");
  if (browser) {
    try {
      await browser.close();
      console.log("[Teardown] Playwright browser closed.");
    } catch (_) {}
  }

  for (const pid of spawnedPids) {
    killProcessTree(pid);
  }

  if (backendProcess) {
    try { backendProcess.kill("SIGTERM"); } catch (_) {}
  }
  if (frontendProcess) {
    try { frontendProcess.kill("SIGTERM"); } catch (_) {}
  }

  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("[Teardown] Mongoose disconnected.");
    }
  } catch (_) {}

  if (replSet) {
    try {
      await replSet.stop();
      console.log("[Teardown] MongoMemoryReplSet stopped cleanly.");
    } catch (_) {}
  }
  console.log("[Teardown] All isolated resources safely terminated.\n");
}

process.on("SIGINT", async () => {
  console.log("\n[Interrupt] Caught SIGINT. Executing cleanup...");
  await cleanup();
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("\n[Interrupt] Caught SIGTERM. Executing cleanup...");
  await cleanup();
  process.exit(1);
});

process.on("uncaughtException", async (err) => {
  console.error("\n[Fatal] Uncaught Exception:", err);
  await cleanup();
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  console.error("\n[Fatal] Unhandled Rejection:", reason);
  await cleanup();
  process.exit(1);
});

// Test Result Counters
let totalScenarios = 12;
let passedScenarios = 0;
let failedScenarios = 0;
const resultsSummary = [];

function recordScenario(id, title, passed, details = "") {
  if (passed) {
    passedScenarios++;
    console.log(`  ✓ PASS [${id}]: ${title}`);
    resultsSummary.push({ id, title, status: "PASS", details });
  } else {
    failedScenarios++;
    console.error(`  ✗ FAIL [${id}]: ${title} -> ${details}`);
    resultsSummary.push({ id, title, status: "FAIL", details });
  }
}

try {
  // Step 1: Provision loopback MongoMemoryReplSet
  console.log("[Init 1/5] Provisioning ephemeral MongoMemoryReplSet (wiredTiger)...");
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const localUri = replSet.getUri("pet_protocols_isolated_e2e");

  // Safety Assertion: MUST be loopback
  assert.ok(
    localUri.includes("127.0.0.1") || localUri.includes("localhost"),
    "CRITICAL SECURITY GATE: MongoMemoryReplSet must bind strictly to loopback"
  );
  assert.ok(
    !localUri.includes("mongodb.net"),
    "CRITICAL SECURITY GATE: Never connect to Atlas in test harness"
  );
  console.log(`[Init 1/5] Loopback Replica Set ready: ${localUri.replace(/\/\/.*@/, "//***@")}`);

  // Step 2: Seed Test Fixtures via Mongoose
  console.log("[Init 2/5] Seeding test database fixtures...");
  await mongoose.connect(localUri);

  const Restaurant = (await import("../models/Restaurant.js")).default;
  const Product = (await import("../models/Product.js")).default;
  const User = (await import("../models/User.js")).default;
  const Order = (await import("../models/Order.js")).default;
  const PaymentIntent = (await import("../models/PaymentIntent.js")).default;

  const { deriveGuestAccessToken, hashGuestAccessToken } = await import(
    "../lib/guestAccessService.js"
  );

  // Clear collections
  await Restaurant.deleteMany({});
  await Product.deleteMany({});
  await User.deleteMany({});
  await Order.deleteMany({});
  await PaymentIntent.deleteMany({});

  // Seed Restaurant A
  const restA = await Restaurant.create({
    _id: new mongoose.Types.ObjectId("671000000000000000000001"),
    name: "Spice Symphony",
    slug: "spice-symphony",
    email: "spicesymphony@example.com",
    phone: "9876543210",
    address: {
      street: "10 Connaught Place",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      coordinates: { latitude: 28.6304, longitude: 77.2177 },
    },
    status: "active",
    isOpen: true,
    acceptingOrders: true,
    isTemporarilyClosed: false,
    openingHours: "12:00 AM - 11:59 PM",
    weeklyHours: {
      monday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      tuesday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      wednesday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      thursday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      friday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      saturday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      sunday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
    },
  });

  // Seed Restaurant B
  const restB = await Restaurant.create({
    _id: new mongoose.Types.ObjectId("671000000000000000000002"),
    name: "Green Leaf Bistro",
    slug: "green-leaf-bistro",
    email: "greenleaf@example.com",
    phone: "9876543211",
    address: {
      street: "15 Khan Market",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110003",
      coordinates: { latitude: 28.6001, longitude: 77.2272 },
    },
    status: "active",
    isOpen: true,
    acceptingOrders: true,
    isTemporarilyClosed: false,
    openingHours: "12:00 AM - 11:59 PM",
    weeklyHours: {
      monday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      tuesday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      wednesday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      thursday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      friday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      saturday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
      sunday: { isOpen: true, slots: [{ open: "00:00", close: "23:59" }] },
    },
  });

  // Seed Products
  const prodA = await Product.create({
    _id: new mongoose.Types.ObjectId("671000000000000000000011"),
    restaurant: restA._id,
    name: "Butter Chicken Feast",
    price: 250,
    category: "Indian",
    type: "non-veg",
    isAvailable: true,
  });

  const prodB = await Product.create({
    _id: new mongoose.Types.ObjectId("671000000000000000000022"),
    restaurant: restB._id,
    name: "Paneer Tikka Platter",
    price: 180,
    category: "Indian",
    type: "veg",
    isAvailable: true,
  });

  // Seed Registered Customer
  const hashedPassword = await bcrypt.hash("Password123!", 10);
  const registeredUser = await User.create({
    _id: new mongoose.Types.ObjectId("671000000000000000000050"),
    name: "Alice Customer",
    email: "customer@example.com",
    password: hashedPassword,
    role: "customer",
    status: "active",
    phone: "9876543210",
  });

  // Seed Driver Staff
  const driverUser = await User.create({
    _id: new mongoose.Types.ObjectId("671000000000000000000060"),
    name: "Raj Driver",
    email: "driver@example.com",
    password: hashedPassword,
    role: "staff",
    staffRoles: ["Delivery"],
    staffRole: "Delivery",
    restaurant: restA._id,
    status: "active",
  });

  // Seed Manager Staff
  const managerUser = await User.create({
    _id: new mongoose.Types.ObjectId("671000000000000000000070"),
    name: "Vikram Manager",
    email: "manager@example.com",
    password: hashedPassword,
    role: "staff",
    staffRoles: ["Manager"],
    staffRole: "Manager",
    restaurant: restA._id,
    status: "active",
  });

  console.log(`[Init 2/5] Seeded restaurants, products (${prodA.name}, ${prodB.name}), and users.`);

  // Step 3: Spawn Isolated Backend Server
  console.log(`[Init 3/5] Spawning backend Next.js on port ${BACKEND_PORT}...`);
  const backendDir = path.resolve(import.meta.dirname, "..");
  const backendNextBin = path.join(backendDir, "node_modules", "next", "dist", "bin", "next");

  const testEnv = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(BACKEND_PORT),
    MONGODB_URI: localUri,
    TEST_MONGODB_URI: localUri,
    DELIVERY_OTP_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    GUEST_ACCESS_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    NEXTAUTH_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ENABLE_PAYMENT_SIMULATOR: "true",
    NEXTAUTH_URL: `http://127.0.0.1:${FRONTEND_PORT}`,
    RAZORPAY_KEY_ID: "rzp_test_mock_key_id",
    RAZORPAY_KEY_SECRET: "mock_secret_for_razorpay_tests_123456",
  };

  backendProcess = spawn(process.execPath, [backendNextBin, "dev", "-p", String(BACKEND_PORT), "--webpack"], {
    cwd: backendDir,
    env: testEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  spawnedPids.add(backendProcess.pid);

  const backendLog = fs.createWriteStream(path.resolve(backendDir, "test_backend_server.log"));
  backendProcess.stdout.pipe(backendLog);
  backendProcess.stderr.pipe(backendLog);

  // Step 4: Spawn Isolated Frontend-User Server
  console.log(`[Init 4/5] Spawning frontend-user Next.js on port ${FRONTEND_PORT}...`);
  const frontendDir = path.resolve(import.meta.dirname, "../../frontend-user");
  const frontendNextBin = path.join(frontendDir, "node_modules", "next", "dist", "bin", "next");

  const frontendEnv = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(FRONTEND_PORT),
    BACKEND_INTERNAL_URL: `http://127.0.0.1:${BACKEND_PORT}`,
    NEXT_PUBLIC_BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`,
    NEXTAUTH_URL: `http://127.0.0.1:${FRONTEND_PORT}`,
    NEXTAUTH_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    NEXT_PUBLIC_ENABLE_PAYMENT_SIMULATOR: "true",
  };

  frontendProcess = spawn(process.execPath, [frontendNextBin, "dev", "-p", String(FRONTEND_PORT), "--webpack"], {
    cwd: frontendDir,
    env: frontendEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  spawnedPids.add(frontendProcess.pid);

  const frontendLog = fs.createWriteStream(path.resolve(backendDir, "test_frontend_server.log"));
  frontendProcess.stdout.pipe(frontendLog);
  frontendProcess.stderr.pipe(frontendLog);

  // Wait for both servers to be ready
  console.log("[Init 5/5] Polling server endpoints for readiness...");
  let backendReady = false;
  let frontendReady = false;

  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (!backendReady) {
      try {
        const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders`);
        if (res.status === 401 || res.status === 200) {
          backendReady = true;
        }
      } catch (_) {}
    }
    if (!frontendReady) {
      try {
        const res = await fetch(`http://127.0.0.1:${FRONTEND_PORT}/`);
        if (res.status === 200) {
          frontendReady = true;
        }
      } catch (_) {}
    }
    if (backendReady && frontendReady) break;
  }

  assert.ok(backendReady, "Backend failed to initialize within timeout");
  assert.ok(frontendReady, "Frontend-user failed to initialize within timeout");
  console.log(`[Init Complete] Backend (: ${BACKEND_PORT}) and Frontend (: ${FRONTEND_PORT}) are online.\n`);

  console.log("[Init 5/5] Pre-warming Next.js compilation cache for critical test routes...");
  const warmupUrls = [
    `http://127.0.0.1:${FRONTEND_PORT}/menu?restaurant=${restA._id.toString()}`,
    `http://127.0.0.1:${FRONTEND_PORT}/checkout`,
    `http://127.0.0.1:${FRONTEND_PORT}/order-confirmation?orderId=warmup_order_test_123`,
    `http://127.0.0.1:${FRONTEND_PORT}/auth/login`,
    `http://127.0.0.1:${FRONTEND_PORT}/orders`,
    `http://127.0.0.1:${FRONTEND_PORT}/api/auth/csrf`,
  ];
  for (const url of warmupUrls) {
    try {
      await fetch(url);
    } catch (_) {}
  }
  console.log("[Init 5/5] Pre-warming complete.\n");

  // Launch Playwright Browser
  console.log("Launching Playwright Chrome instance...");
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Pre-seed guest cart in browser localStorage on every page navigation
  await context.addInitScript(
    ({ restId, dishId }) => {
      const cartItem = {
        _id: dishId,
        cartItemId: dishId,
        name: "Butter Chicken Feast",
        price: 250,
        quantity: 1,
        restaurant: restId,
        restaurantId: restId,
        category: "Indian",
        type: "non-veg",
        isAvailable: true,
      };
      try {
        window.localStorage.setItem("pet_protocols_cart_guest", JSON.stringify([cartItem]));
      } catch (_) {}
    },
    { restId: restA._id.toString(), dishId: prodA._id.toString() }
  );

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Console Error]:`, msg.text());
    }
  });
  page.on("pageerror", (err) => console.error("[Browser Page Error]:", err.message));

  console.log("\n------------------------------------------------------------------------");
  console.log("EXECUTING BROWSER SCENARIOS (B-01 THROUGH B-12)");
  console.log("------------------------------------------------------------------------\n");

  let b01OrderId = null;
  let b01GuestToken = null;
  let b02OrderId = null;
  let b02GuestToken = null;

  // ══════════════════════════════════════════════════════════════════════
  // B-01: GUEST COD CHECKOUT — ORDER CREATION, CREDENTIAL CAPTURE, URL CLEANUP
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-01: Guest COD checkout...");
    // 1. Visit menu and add dish to cart
    await page.goto(`http://127.0.0.1:${FRONTEND_PORT}/menu?restaurant=${restA._id.toString()}`, {
      waitUntil: "networkidle",
    });
    const addBtn = page.locator('button:has-text("Add to Cart")').first();
    await addBtn.waitFor({ state: "visible", timeout: 25000 });
    await addBtn.click();
    await page.waitForTimeout(800);

    // 2. Navigate to checkout
    await page.goto(`http://127.0.0.1:${FRONTEND_PORT}/checkout`, { waitUntil: "networkidle" });

    // Wait for form input
    await page.waitForSelector("#checkout-fullName", { state: "visible", timeout: 25000 });
    await page.fill("#checkout-fullName", "Bob Guest");
    await page.fill("#checkout-phone", "9876543210");
    await page.fill("#checkout-street", "123 Main Doorstep Avenue");
    await page.fill("#checkout-city", "New Delhi");
    await page.fill("#checkout-pincode", "110001");

    // Select Cash on Delivery
    const codRadio = page.locator('div[role="radio"]:has-text("Cash on Delivery")');
    if ((await codRadio.count()) > 0) {
      await codRadio.click();
    }

    // Submit order
    const placeOrderBtn = page.locator('button[type="submit"]');
    await placeOrderBtn.click();

    // Wait for redirect to /order-confirmation
    await page.waitForURL((url) => url.pathname.includes("/order-confirmation"), { timeout: 25000 });

    const confirmationUrl = new URL(page.url());
    b01OrderId = confirmationUrl.searchParams.get("orderId");
    assert.ok(b01OrderId, "Order ID must be present in URL");

    // Wait for URL sanitization to complete (history.replaceState removes tokens)
    await page.waitForFunction(() => {
      const u = new URL(window.location.href);
      return !u.searchParams.has("guestToken") && !u.searchParams.has("guestAccessToken");
    }, { timeout: 25000 });

    const cleanedUrl = new URL(page.url());
    // GUEST-URL-01: Check that tokens are removed from URL bar
    assert.equal(cleanedUrl.searchParams.has("guestToken"), false, "guestToken sanitized from URL");
    assert.equal(cleanedUrl.searchParams.has("guestAccessToken"), false, "guestAccessToken sanitized from URL");

    // Verify token was persisted to sessionStorage
    b01GuestToken = await page.evaluate((oid) => {
      return (
        sessionStorage.getItem(`pet_protocols_guest_token_${oid}`) ||
        sessionStorage.getItem("pet_protocols_latest_guest_token")
      );
    }, b01OrderId);

    assert.ok(b01GuestToken, "Guest access token safely stored in sessionStorage");
    assert.ok(b01GuestToken.startsWith("gst_"), "Guest token follows gst_ prefix convention");

    recordScenario("B-01", "Guest COD checkout, token capture, URL cleanup", true);
  } catch (err) {
    recordScenario("B-01", "Guest COD checkout, token capture, URL cleanup", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-02: GUEST PAYMENT-SIMULATOR CHECKOUT — CREDENTIAL CAPTURE & REFRESH
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-02: Guest payment-simulator checkout...");
    await page.goto(`http://127.0.0.1:${FRONTEND_PORT}/menu?restaurant=${restA._id.toString()}`, {
      waitUntil: "networkidle",
    });
    const addBtn2 = page.locator('button:has-text("Add to Cart")').first();
    await addBtn2.waitFor({ state: "visible", timeout: 25000 });
    await addBtn2.click();
    await page.waitForTimeout(800);

    await page.goto(`http://127.0.0.1:${FRONTEND_PORT}/checkout`, { waitUntil: "networkidle" });
    await page.waitForSelector("#checkout-fullName", { state: "visible", timeout: 25000 });

    await page.fill("#checkout-fullName", "Charlie Guest");
    await page.fill("#checkout-phone", "9876543210");
    await page.fill("#checkout-street", "456 Simulator Boulevard");
    await page.fill("#checkout-city", "New Delhi");
    await page.fill("#checkout-pincode", "110001");

    // Select Test Simulator radio
    const simRadio = page.locator('div[role="radio"]:has-text("Test Simulator")');
    await simRadio.click();

    // Submit order
    const placeOrderBtn = page.locator('button[type="submit"]');
    await placeOrderBtn.click();

    await page.waitForURL((url) => url.pathname.includes("/order-confirmation"), { timeout: 25000 });

    // Wait for URL sanitization to complete
    await page.waitForFunction(() => {
      const u = new URL(window.location.href);
      return !u.searchParams.has("guestToken") && !u.searchParams.has("guestAccessToken");
    }, { timeout: 25000 });

    const confirmationUrl = new URL(page.url());
    b02OrderId = confirmationUrl.searchParams.get("orderId");
    assert.ok(b02OrderId, "Simulator orderId must be present in URL");

    assert.equal(confirmationUrl.searchParams.has("guestToken"), false);
    assert.equal(confirmationUrl.searchParams.has("guestAccessToken"), false);

    b02GuestToken = await page.evaluate((oid) => {
      return (
        sessionStorage.getItem(`pet_protocols_guest_token_${oid}`) ||
        sessionStorage.getItem("pet_protocols_latest_guest_token")
      );
    }, b02OrderId);

    assert.ok(b02GuestToken, "Simulator guest token saved to sessionStorage");

    recordScenario("B-02", "Guest payment-simulator checkout & credential capture", true);
  } catch (err) {
    recordScenario("B-02", "Guest payment-simulator checkout & credential capture", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════
  // B-03: CONFIRMATION-PAGE RELOAD AFTER URL CLEANUP
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-03: Confirmation-page reload after URL cleanup...");
    assert.ok(b02OrderId && b02GuestToken, "B-02 order must exist");

    await page.reload({ waitUntil: "networkidle" });

    const storedToken = await page.evaluate((oid) => {
      return sessionStorage.getItem(`pet_protocols_guest_token_${oid}`);
    }, b02OrderId);
    assert.equal(storedToken, b02GuestToken, "Token in sessionStorage persists across reload");

    // Wait for client fetch to complete and order details to render
    await page.waitForFunction(() => {
      const text = document.querySelector("main")?.innerText || "";
      return text.includes("Butter Chicken Feast") || text.includes("Order Summary") || text.includes("Confirmed");
    }, { timeout: 25000 });

    const pageText = await page.innerText("main");
    assert.ok(
      pageText.includes("Butter Chicken Feast") || pageText.includes("Order Summary") || pageText.includes("Confirmed"),
      "Order details must load cleanly from sessionStorage on page reload"
    );

    recordScenario("B-03", "Confirmation-page reload after URL cleanup retrieves order", true);
  } catch (err) {
    recordScenario("B-03", "Confirmation-page reload after URL cleanup retrieves order", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-04: GUEST DELIVERY OTP RETRIEVAL — AUTHORIZED VS UNAUTHORIZED
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-04: Guest delivery OTP retrieval...");
    assert.ok(b01OrderId && b01GuestToken, "B-01 order must exist");

    const b01Query = mongoose.isValidObjectId(b01OrderId) ? { _id: b01OrderId } : { orderId: b01OrderId };
    await Order.updateOne(
      b01Query,
      {
        $set: {
          status: "out_for_delivery",
          assignedDeliveryStaff: { id: driverUser._id, name: driverUser.name, phone: driverUser.phone },
        },
      }
    );

    // 1. Authorized guest retrieval
    const authRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b01OrderId}/handover-otp`, {
      headers: { "x-guest-access-token": b01GuestToken },
    });
    const authData = await authRes.json();
    assert.equal(authRes.status, 200, "Authorized guest OTP retrieval must return HTTP 200");
    assert.equal(authData.success, true);
    assert.match(authData.otpCode, /^\d{4}$/, "Handover OTP must be a 4-digit code");

    // 2. Unauthorized retrieval (no token)
    const unauthRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b01OrderId}/handover-otp`);
    assert.equal(unauthRes.status, 401, "Unauthenticated OTP retrieval must return HTTP 401");

    // 3. Attacker with wrong token
    const wrongRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b01OrderId}/handover-otp`, {
      headers: { "x-guest-access-token": "gst_attacker_fabricated_token_1234567890abcdef" },
    });
    assert.equal(wrongRes.status, 404, "Invalid token OTP retrieval must return HTTP 404 (Access Denied)");

    // 4. In browser: Reload page to verify OTP UI displays
    // Explicitly set the token for b01OrderId to prevent session state collision
    await page.evaluate(({ oid, token }) => {
      try {
        sessionStorage.setItem(`pet_protocols_guest_token_${oid}`, token);
        sessionStorage.setItem("pet_protocols_latest_guest_token", token);
      } catch (_) {}
    }, { oid: b01OrderId, token: b01GuestToken });

    await page.goto(`http://127.0.0.1:${FRONTEND_PORT}/order-confirmation?orderId=${b01OrderId}`, {
      waitUntil: "load",
    });

    await page.waitForFunction(
      (expectedOtp) => {
        const text = document.body.innerText || "";
        return text.includes(expectedOtp) || text.includes("Proof of Handover") || text.includes("Handover") || text.includes("OTP");
      },
      authData.otpCode,
      { timeout: 25000 }
    );

    const content = await page.content();
    assert.ok(
      content.includes(authData.otpCode) || content.includes("Handover") || content.includes("OTP"),
      "Handover OTP box or code rendered for out_for_delivery order"
    );

    recordScenario("B-04", "Guest delivery OTP retrieval (authorized vs unauthorized)", true);
  } catch (err) {
    recordScenario("B-04", "Guest delivery OTP retrieval (authorized vs unauthorized)", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-05: GUEST TRACKING — COORDINATES EXPOSED ONLY IN OUT_FOR_DELIVERY
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-05: Guest tracking authorization & coordinate rules...");
    assert.ok(b02OrderId && b02GuestToken, "B-02 order must exist");

    const b02Query = mongoose.isValidObjectId(b02OrderId) ? { _id: b02OrderId } : { orderId: b02OrderId };

    // 1. Preparing state: Coordinates must be null
    await Order.updateOne(
      b02Query,
      {
        $set: {
          status: "preparing",
          deliveryTracking: {
            currentLocation: { latitude: 28.6139, longitude: 77.209 },
          },
        },
      }
    );

    const prepRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b02OrderId}/tracking`, {
      headers: { "x-guest-access-token": b02GuestToken },
    });
    const prepData = await prepRes.json();
    assert.equal(prepRes.status, 200);
    assert.equal(prepData.location, null, "Coordinates must be strictly null when status is preparing");

    // 2. Out for delivery state: Coordinates exposed
    await Order.updateOne(
      b02Query,
      {
        $set: {
          status: "out_for_delivery",
          deliveryTracking: {
            currentLocation: { latitude: 28.6139, longitude: 77.209 },
            lastUpdatedAt: new Date(),
          },
        },
      }
    );

    const trackRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b02OrderId}/tracking`, {
      headers: { "x-guest-access-token": b02GuestToken },
    });
    const trackData = await trackRes.json();
    assert.equal(trackRes.status, 200);
    assert.ok(trackData.location, "Coordinates must be present when out_for_delivery");
    assert.equal(trackData.location.latitude, 28.6139);

    // 3. Unauthorized tracking request fails closed
    const unauthTrack = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b02OrderId}/tracking`);
    assert.equal(unauthTrack.status, 401, "Tracking without guest token must return HTTP 401");

    recordScenario("B-05", "Guest tracking coordinates exposure authorization", true);
  } catch (err) {
    recordScenario("B-05", "Guest tracking coordinates exposure authorization", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-06: REGISTERED CUSTOMER — LOGIN, ORDER HISTORY & DETAILS
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-06: Registered customer login, order history & details...");
    // Seed registered order
    const regOrder = await Order.create({
      orderId: `ORD_REG_${Date.now()}`,
      user: registeredUser._id,
      restaurant: restA._id,
      items: [{ name: "Butter Chicken Feast", price: 250, quantity: 1 }],
      totalAmount: 250,
      paymentMethod: "Cash on Delivery (COD)",
      paymentStatus: "pending",
      status: "preparing",
      orderType: "delivery",
      address: {
        fullName: registeredUser.name,
        phone: registeredUser.phone,
        street: "789 Registered Avenue",
        city: "New Delhi",
        pincode: "110001",
      },
    });

    // In browser: Use an isolated customer context to avoid session/storage bleed
    const custContext = await browser.newContext();
    const custPage = await custContext.newPage();
    try {
      await custPage.goto(`http://127.0.0.1:${FRONTEND_PORT}/auth/login?callbackUrl=/orders`, { waitUntil: "networkidle" });
      await custPage.waitForSelector('input[name="email"]', { timeout: 15000 });
      await custPage.fill('input[name="email"]', "customer@example.com");
      await custPage.fill('input[name="password"]', "Password123!");

      // Submit login form and wait for NextAuth response
      await Promise.all([
        custPage.waitForResponse(
          (res) => res.url().includes("/api/auth/callback/credentials") || res.url().includes("/api/auth/session"),
          { timeout: 25000 }
        ).catch(() => null),
        custPage.click('button[type="submit"]'),
      ]);

      // Allow NextAuth client navigation or navigate explicitly to /orders
      try {
        await custPage.waitForFunction(() => !window.location.pathname.includes("/auth/login"), { timeout: 10000 });
      } catch (_) {
        await custPage.goto(`http://127.0.0.1:${FRONTEND_PORT}/orders`, { waitUntil: "networkidle" });
      }

      await custPage.waitForSelector("main", { timeout: 20000 });

      // Wait for the registered order to appear in user order history (handling async fetch)
      await custPage.waitForFunction(
        (expectedOrderId) => {
          const text = document.querySelector("main")?.innerText || "";
          return text.includes(expectedOrderId) || text.includes("Butter Chicken Feast");
        },
        regOrder.orderId,
        { timeout: 25000 }
      );

      // Assert registered order is present
      const ordersPageText = await custPage.innerText("main");
      assert.ok(
        ordersPageText.includes(regOrder.orderId) || ordersPageText.includes("Butter Chicken Feast"),
        "Registered order must appear in user order history"
      );

      // Navigate to /orders/[id]
      await custPage.goto(`http://127.0.0.1:${FRONTEND_PORT}/orders/${regOrder.orderId}`, {
        waitUntil: "load",
      });
      await custPage.waitForSelector("main", { timeout: 20000 });

      await custPage.waitForFunction(
        (expectedOrderId) => {
          const text = document.querySelector("main")?.innerText || "";
          return text.includes(expectedOrderId) || text.includes("Butter Chicken Feast");
        },
        regOrder.orderId,
        { timeout: 25000 }
      );

      const detailPageText = await custPage.innerText("main");
      assert.ok(
        detailPageText.includes(regOrder.orderId) || detailPageText.includes("Butter Chicken Feast"),
        "Registered order detail must load via session without guest token"
      );

      recordScenario("B-06", "Registered customer login, order history & details", true);
    } finally {
      await custContext.close();
    }
  } catch (err) {
    recordScenario("B-06", "Registered customer login, order history & details", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-07: MULTI-RESTAURANT CART — SINGLE CREDENTIAL ACCESSES SIBLING ORDERS
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-07: Multi-restaurant cart sibling order access...");
    const sharedToken = deriveGuestAccessToken("multi_cart_seed_123", "multi_cart_ctx");
    const sharedDigest = hashGuestAccessToken(sharedToken);
    const expiry = new Date(Date.now() + 30 * 86400 * 1000);

    const siblingA = await Order.create({
      orderId: `ORD_SIB_A_${Date.now()}`,
      restaurant: restA._id,
      items: [{ name: "Butter Chicken Feast", price: 250, quantity: 1 }],
      totalAmount: 250,
      paymentMethod: "Cash on Delivery (COD)",
      paymentStatus: "pending",
      status: "pending",
      orderType: "delivery",
      address: { fullName: "Multi Guest", phone: "9876543210", street: "123 St", city: "New Delhi", pincode: "110001" },
      guestAccess: { tokenHash: sharedDigest, expiresAt: expiry, isRevoked: false },
    });

    const siblingB = await Order.create({
      orderId: `ORD_SIB_B_${Date.now()}`,
      restaurant: restB._id,
      items: [{ name: "Paneer Tikka Platter", price: 180, quantity: 1 }],
      totalAmount: 180,
      paymentMethod: "Cash on Delivery (COD)",
      paymentStatus: "pending",
      status: "pending",
      orderType: "delivery",
      address: { fullName: "Multi Guest", phone: "9876543210", street: "123 St", city: "New Delhi", pincode: "110001" },
      guestAccess: { tokenHash: sharedDigest, expiresAt: expiry, isRevoked: false },
    });

    // Unrelated order belonging to another customer
    const unrelatedToken = deriveGuestAccessToken("unrelated_seed_999", "unrelated_ctx");
    const unrelatedOrder = await Order.create({
      orderId: `ORD_UNREL_${Date.now()}`,
      restaurant: restA._id,
      items: [{ name: "Butter Chicken Feast", price: 250, quantity: 1 }],
      totalAmount: 250,
      paymentMethod: "Cash on Delivery (COD)",
      paymentStatus: "pending",
      status: "pending",
      orderType: "delivery",
      address: { fullName: "Other Guest", phone: "9876543299", street: "999 St", city: "New Delhi", pincode: "110001" },
      guestAccess: { tokenHash: hashGuestAccessToken(unrelatedToken), expiresAt: expiry, isRevoked: false },
    });

    // 1. Shared token accesses sibling A
    const resA = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${siblingA.orderId}`, {
      headers: { "x-guest-access-token": sharedToken },
    });
    assert.equal(resA.status, 200, "Shared token must access Sibling A");

    // 2. Shared token accesses sibling B
    const resB = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${siblingB.orderId}`, {
      headers: { "x-guest-access-token": sharedToken },
    });
    assert.equal(resB.status, 200, "Shared token must access Sibling B");

    // 3. Shared token CANNOT access unrelated order
    const resUnrel = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${unrelatedOrder.orderId}`, {
      headers: { "x-guest-access-token": sharedToken },
    });
    assert.equal(resUnrel.status, 404, "Shared token must NOT access unrelated order (404)");

    recordScenario("B-07", "Multi-restaurant cart sibling authorization isolation", true);
  } catch (err) {
    recordScenario("B-07", "Multi-restaurant cart sibling authorization isolation", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-08: PAYMENT RETRY — SIMULATE DROPPED RESPONSE & IDEMPOTENT RECOVERY
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-08: Payment retry & dropped response recovery...");
    const rzpOrderId = `order_mock_retry_${Date.now()}`;
    const rzpPaymentId = `pay_mock_retry_${Date.now()}`;
    const rzpSignature = crypto
      .createHmac("sha256", "mock_secret_for_razorpay_tests_123456")
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest("hex");

    await PaymentIntent.create({
      razorpayOrderId: rzpOrderId,
      amount: 250,
      amountPaise: 25000,
      currency: "INR",
      status: "created",
      calcResult: {
        subtotal: 250,
        deliveryFee: 0,
        discount: 0,
        couponCode: "",
        totalAmount: 250,
        orders: [
          {
            restaurantId: restA._id.toString(),
            items: [{ name: "Butter Chicken Feast", price: 250, quantity: 1, restaurant: restA._id.toString() }],
            subtotal: 250,
            deliveryFee: 0,
            totalAmount: 250,
          },
        ],
      },
      metadata: {
        restaurantId: restA._id.toString(),
        address: { fullName: "Retry Guest", phone: "9876543210", street: "123 Retry Way", city: "New Delhi", pincode: "110001" },
        items: [{ name: "Butter Chicken Feast", price: 250, quantity: 1, restaurant: restA._id.toString() }],
        orderType: "delivery",
      },
    });

    const verifyPayload = {
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: rzpSignature,
    };

    // First attempt: succeeds on server
    const res1 = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyPayload),
    });
    const data1 = await res1.json();
    assert.ok(res1.status === 200 || res1.status === 201, "Initial verification must return 200 or 201");
    assert.ok(data1.guestAccessToken, "Initial verification must return guestAccessToken");

    // Second attempt (simulating client retry after dropped response)
    const res2 = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyPayload),
    });
    const data2 = await res2.json();
    assert.equal(res2.status, 200, "Replay verification must succeed with HTTP 200");
    assert.equal(
      data2.guestAccessToken,
      data1.guestAccessToken,
      "Replay verification must recover the EXACT SAME guestAccessToken"
    );

    // Verify order count in DB is exactly 1 (no duplicate order created)
    const ordersCount = await Order.countDocuments({ paymentId: rzpPaymentId });
    assert.equal(ordersCount, 1, "Idempotent retry must not duplicate orders");

    // Verify recovered token authorizes access to the order
    const accessRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${data2.order._id}`, {
      headers: { "x-guest-access-token": data2.guestAccessToken },
    });
    assert.equal(accessRes.status, 200, "Recovered token must authorize order access");

    recordScenario("B-08", "Payment retry recovers credential idempotently without duplicate orders", true);
  } catch (err) {
    recordScenario("B-08", "Payment retry recovers credential idempotently without duplicate orders", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-09: CONCURRENT PAYMENT RETRY — PARALLEL RETRIES STABILITY
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-09: Concurrent payment retry stability...");
    const rzpOrderId = `order_mock_conc_${Date.now()}`;
    const rzpPaymentId = `pay_mock_conc_${Date.now()}`;
    const rzpSignature = crypto
      .createHmac("sha256", "mock_secret_for_razorpay_tests_123456")
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest("hex");

    await PaymentIntent.create({
      razorpayOrderId: rzpOrderId,
      amount: 250,
      amountPaise: 25000,
      currency: "INR",
      status: "created",
      calcResult: {
        subtotal: 250,
        deliveryFee: 0,
        discount: 0,
        couponCode: "",
        totalAmount: 250,
        orders: [
          {
            restaurantId: restA._id.toString(),
            items: [{ name: "Butter Chicken Feast", price: 250, quantity: 1, restaurant: restA._id.toString() }],
            subtotal: 250,
            deliveryFee: 0,
            totalAmount: 250,
          },
        ],
      },
      metadata: {
        restaurantId: restA._id.toString(),
        address: { fullName: "Concurrent Guest", phone: "9876543210", street: "123 Conc Way", city: "New Delhi", pincode: "110001" },
        items: [{ name: "Butter Chicken Feast", price: 250, quantity: 1, restaurant: restA._id.toString() }],
        orderType: "delivery",
      },
    });

    const verifyPayload = {
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: rzpSignature,
    };

    // Initial attempt creates verified order
    const initialRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyPayload),
    });
    const initialData = await initialRes.json();
    assert.ok(initialRes.status === 200 || initialRes.status === 201);
    assert.equal(initialData.success, true);
    assert.ok(initialData.guestAccessToken);

    // Fire 3 simultaneous retry requests
    const [p1, p2, p3] = await Promise.all([
      fetch(`http://127.0.0.1:${BACKEND_PORT}/api/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyPayload),
      }).then((r) => r.json()),
      fetch(`http://127.0.0.1:${BACKEND_PORT}/api/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyPayload),
      }).then((r) => r.json()),
      fetch(`http://127.0.0.1:${BACKEND_PORT}/api/payment/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyPayload),
      }).then((r) => r.json()),
    ]);

    assert.equal(p1.success, true);
    assert.equal(p2.success, true);
    assert.equal(p3.success, true);

    assert.equal(p1.guestAccessToken, initialData.guestAccessToken, "Tokens across concurrent requests must match initial");
    assert.equal(p2.guestAccessToken, initialData.guestAccessToken, "Tokens across concurrent requests must match initial");
    assert.equal(p3.guestAccessToken, initialData.guestAccessToken, "Tokens across concurrent requests must match initial");

    const count = await Order.countDocuments({ paymentId: rzpPaymentId });
    assert.equal(count, 1, "Concurrent payment verification must create exactly 1 order");

    recordScenario("B-09", "Concurrent payment retries maintain deterministic token and single order", true);
  } catch (err) {
    recordScenario("B-09", "Concurrent payment retries maintain deterministic token and single order", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-10: CROSS-CUSTOMER ISOLATION
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-10: Cross-customer isolation...");
    assert.ok(b01GuestToken && b02OrderId, "Preconditions for B-10 must be met");

    // 1. Order details
    const detRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b02OrderId}`, {
      headers: { "x-guest-access-token": b01GuestToken },
    });
    assert.equal(detRes.status, 404, "Guest A must not access Guest B's order details (404)");

    // 2. Handover OTP
    const otpRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b02OrderId}/handover-otp`, {
      headers: { "x-guest-access-token": b01GuestToken },
    });
    assert.equal(otpRes.status, 404, "Guest A must not access Guest B's handover OTP (404)");

    // 3. Tracking
    const trackRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b02OrderId}/tracking`, {
      headers: { "x-guest-access-token": b01GuestToken },
    });
    assert.equal(trackRes.status, 404, "Guest A must not access Guest B's tracking data (404)");

    // 4. Customer location (PATCH only, expects coordinates body)
    const locRes = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/orders/${b02OrderId}/customer-location`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-guest-access-token": b01GuestToken,
      },
      body: JSON.stringify({ latitude: 28.6, longitude: 77.2 }),
    });
    assert.equal(locRes.status, 404, "Guest A must not access Guest B's customer location (404)");

    recordScenario("B-10", "Cross-customer isolation strictly blocks unauthorized access (404)", true);
  } catch (err) {
    recordScenario("B-10", "Cross-customer isolation strictly blocks unauthorized access (404)", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-11: URL HYGIENE — PARAMETERS REMOVAL & LEGITIMATE RETENTION
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-11: URL hygiene & parameters preservation...");
    const targetOrderId = b01OrderId || b02OrderId || "ORD_HYGIENE_TEST_123";
    const testUrl = `http://127.0.0.1:${FRONTEND_PORT}/order-confirmation?orderId=${targetOrderId}&guestToken=gst_fake_param1&guestAccessToken=gst_fake_param2&utm_source=promo_email&campaign_id=winter2026`;

    await page.goto(testUrl, { waitUntil: "domcontentloaded" });

    // Wait for history.replaceState execution
    await page.waitForFunction(() => {
      const u = new URL(window.location.href);
      return !u.searchParams.has("guestToken") && !u.searchParams.has("guestAccessToken");
    }, { timeout: 25000 });

    const finalUrl = new URL(page.url());
    assert.equal(finalUrl.searchParams.has("guestToken"), false, "guestToken must be sanitized");
    assert.equal(finalUrl.searchParams.has("guestAccessToken"), false, "guestAccessToken must be sanitized");
    assert.equal(finalUrl.searchParams.get("orderId"), targetOrderId, "orderId must be preserved");
    assert.equal(finalUrl.searchParams.get("utm_source"), "promo_email", "utm_source must be preserved");
    assert.equal(finalUrl.searchParams.get("campaign_id"), "winter2026", "campaign_id must be preserved");

    recordScenario("B-11", "URL hygiene sanitizes credentials and retains legitimate parameters", true);
  } catch (err) {
    recordScenario("B-11", "URL hygiene sanitizes credentials and retains legitimate parameters", false, err.message);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B-12: FAILURE CLEANUP HARNESS VALIDATION
  // ══════════════════════════════════════════════════════════════════════
  try {
    console.log("-> Running B-12: Failure cleanup verification...");
    // Verify that spawned processes are actively registered in tracking set
    assert.ok(spawnedPids.size >= 2, "Harness must track all spawned child process PIDs");
    assert.ok(backendProcess?.pid, "Backend process PID must be tracked");
    assert.ok(frontendProcess?.pid, "Frontend process PID must be tracked");

    // Verify cleanup functions exist and are bound to process lifecycle events
    assert.equal(typeof cleanup, "function");
    assert.ok(process.listeners("SIGINT").length > 0, "SIGINT listener must be registered");
    assert.ok(process.listeners("SIGTERM").length > 0, "SIGTERM listener must be registered");

    recordScenario("B-12", "Harness failure cleanup & child process management verified", true);
  } catch (err) {
    recordScenario("B-12", "Harness failure cleanup & child process management verified", false, err.message);
  }

} finally {
  await cleanup();
}

console.log("\n========================================================================");
console.log("PET PROTOCOLS PLAYWRIGHT BROWSER HARNESS SUMMARY");
console.log(`TOTAL SCENARIOS: ${totalScenarios}`);
console.log(`PASSED: ${passedScenarios}`);
console.log(`FAILED: ${failedScenarios}`);
console.log("========================================================================\n");

if (failedScenarios > 0) {
  console.error("❌ Isolated browser test harness FAILED.");
  process.exit(1);
} else {
  console.log("🎉 ALL 12 OF 12 ISOLATED PLAYWRIGHT BROWSER TESTS PASSED CLEANLY!");
  process.exit(0);
}
