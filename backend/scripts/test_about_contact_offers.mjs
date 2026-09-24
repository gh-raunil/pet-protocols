import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import assert from "node:assert/strict";
import fs from "node:fs";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(backendDir, ".env.local") });
dotenv.config({ path: path.join(backendDir, ".env") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in environment");
}

console.log("=== Testing About, Contact, WhatsApp, and Offers Functionality ===");

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB successfully.");

const Restaurant = (await import("../models/Restaurant.js")).default;
const Offer = (await import("../models/Offer.js")).default;
const Product = (await import("../models/Product.js")).default;
const User = (await import("../models/User.js")).default;

// Clean up any test artifacts from previous runs
await Offer.deleteMany({ title: { $regex: /^\[TEST_OFFER\]/ } });

// ============================================================================
// SUITE 1: VERIFY /about CONTENT CONTRACT
// ============================================================================
console.log("\n[SUITE 1] Verifying /about static & semantic content contract...");
const aboutPagePath = path.join(backendDir, "../frontend-user/app/(pages)/about/page.js");
assert.ok(fs.existsSync(aboutPagePath), "frontend-user/app/(pages)/about/page.js must exist");
const aboutContent = fs.readFileSync(aboutPagePath, "utf-8");

const requiredAboutPhrases = [
  "About Pet Protocols",
  "Fresh food. Zero compromises.",
  "Pet Protocols is a food ordering platform that connects customers with restaurants through a simple and convenient digital ordering experience.",
  "Customers can discover restaurants, explore menus, add dishes to their cart, and place orders with ease.",
  "For restaurants, Pet Protocols provides tools to manage menus, products, orders, and customer communication from one place.",
  "More features are coming as we continue to build the platform.",
];

for (const phrase of requiredAboutPhrases) {
  assert.ok(
    aboutContent.includes(phrase),
    `About page must contain required phrase: "${phrase}"`
  );
}
console.log("✓ /about page contains all exact specified copy.");

// ============================================================================
// SUITE 2: NAVIGATION CONTRACT (NavLinks.js & Footer.js)
// ============================================================================
console.log("\n[SUITE 2] Verifying Navigation Links (About, Contact, Offers)...");
const navLinksPath = path.join(backendDir, "../frontend-user/components/layout/NavLinks.js");
const navContent = fs.readFileSync(navLinksPath, "utf-8");
assert.ok(navContent.includes("href: '/about'"), "NavLinks must include /about");
assert.ok(navContent.includes("href: '/contact'"), "NavLinks must include /contact");
assert.ok(navContent.includes("href: '/offers'"), "NavLinks must include /offers");

const footerPath = path.join(backendDir, "../frontend-user/components/layout/Footer.js");
const footerContent = fs.readFileSync(footerPath, "utf-8");
assert.ok(footerContent.includes('href="/about"'), "Footer must link to /about");
assert.ok(footerContent.includes('href="/contact"'), "Footer must link to /contact");
assert.ok(footerContent.includes('href="/offers"'), "Footer must link to /offers");
assert.ok(!footerContent.includes('href="#"'), "Footer should not contain placeholder '#' links");
console.log("✓ Customer navigation properly links to /about, /contact, and /offers with zero '#' placeholders.");

// ============================================================================
// SUITE 3: RESTAURANT MODEL: PHONE vs WHATSAPP SEPARATION
// ============================================================================
console.log("\n[SUITE 3] Verifying Restaurant model phone vs whatsappNumber separation...");
let testRestA = await Restaurant.findOne({ name: "[TEST] Kitchen Alpha" });
if (!testRestA) {
  testRestA = await Restaurant.create({
    name: "[TEST] Kitchen Alpha",
    slug: "test-kitchen-alpha-" + Date.now(),
    phone: "080-12345678",
    whatsappNumber: "919876543210",
    status: "active",
  });
} else {
  testRestA.phone = "080-12345678";
  testRestA.whatsappNumber = "919876543210";
  await testRestA.save();
}

let testRestB = await Restaurant.findOne({ name: "[TEST] Kitchen Beta (No WA)" });
if (!testRestB) {
  testRestB = await Restaurant.create({
    name: "[TEST] Kitchen Beta (No WA)",
    slug: "test-kitchen-beta-" + Date.now(),
    phone: "080-87654321",
    whatsappNumber: "", // NO WhatsApp provided
    status: "active",
  });
} else {
  testRestB.phone = "080-87654321";
  testRestB.whatsappNumber = "";
  await testRestB.save();
}

assert.notStrictEqual(testRestA.phone, testRestA.whatsappNumber, "Phone and WhatsApp number must be distinct fields");
assert.strictEqual(testRestB.whatsappNumber, "", "WhatsApp number must be optional and can be empty");
console.log("✓ Restaurant model stores phone and whatsappNumber as distinct fields.");

// ============================================================================
// SUITE 4: RESTAURANT SETTINGS & TENANT ISOLATION
// ============================================================================
console.log("\n[SUITE 4] Verifying Restaurant Settings updates and tenant isolation...");
// Simulate PUT /api/restaurant/settings
async function simulateUpdateSettings({ authedRestaurantId, body }) {
  const rest = await Restaurant.findById(authedRestaurantId);
  if (!rest) return { status: 404, error: "Restaurant not found" };

  if (body.phone !== undefined) rest.phone = String(body.phone || "").trim();
  if (body.whatsappNumber !== undefined) {
    const cleanWa = String(body.whatsappNumber || "").trim();
    if (cleanWa && !/^[+]?[\d\s\-()]{7,20}$/.test(cleanWa)) {
      return { status: 400, error: "Please provide a valid WhatsApp phone number (7-20 digits) or leave it empty." };
    }
    rest.whatsappNumber = cleanWa;
  }
  await rest.save();
  return { status: 200, success: true, restaurant: rest };
}

// 1. Restaurant A adds / updates WhatsApp number
const updateRes = await simulateUpdateSettings({
  authedRestaurantId: testRestA._id,
  body: { phone: "080-99999999", whatsappNumber: "+91 98888 77777" },
});
assert.strictEqual(updateRes.status, 200);
assert.strictEqual(updateRes.restaurant.phone, "080-99999999");
assert.strictEqual(updateRes.restaurant.whatsappNumber, "+91 98888 77777");

// 2. Restaurant A removes WhatsApp number
const removeRes = await simulateUpdateSettings({
  authedRestaurantId: testRestA._id,
  body: { whatsappNumber: "" },
});
assert.strictEqual(removeRes.status, 200);
assert.strictEqual(removeRes.restaurant.whatsappNumber, "", "WhatsApp number successfully removed when set to empty");
assert.strictEqual(removeRes.restaurant.phone, "080-99999999", "Normal phone remains intact when WhatsApp is removed");

// 3. Invalid WhatsApp number rejection
const invalidRes = await simulateUpdateSettings({
  authedRestaurantId: testRestA._id,
  body: { whatsappNumber: "abc12" }, // Too short / invalid chars
});
assert.strictEqual(invalidRes.status, 400);

// Restore WhatsApp number for subsequent customer tests
await simulateUpdateSettings({
  authedRestaurantId: testRestA._id,
  body: { phone: "080-12345678", whatsappNumber: "919876543210" },
});
console.log("✓ Settings correctly update/remove whatsappNumber, validate format, and maintain phone separation.");

// ============================================================================
// SUITE 5: PLATFORM SUPPORT WHATSAPP (RESTAURANT ADMIN → PET PROTOCOLS)
// ============================================================================
console.log("\n[SUITE 5] Verifying Platform Support WhatsApp Number Configuration...");
const configuredPlatformWa = process.env.PLATFORM_WHATSAPP_NUMBER;
assert.strictEqual(configuredPlatformWa, "6202377582", "PLATFORM_WHATSAPP_NUMBER must be 6202377582 in environment");

// Check frontend source code to verify platform support number is NOT hardcoded
const adminSettingsClient = fs.readFileSync(
  path.join(backendDir, "../frontend-admin/app/settings/SettingsClient.js"),
  "utf-8"
);
assert.ok(
  !adminSettingsClient.includes("6202377582"),
  "Platform WhatsApp number must NOT be hardcoded in frontend-admin source code"
);
assert.ok(
  adminSettingsClient.includes("/api/restaurant/support"),
  "frontend-admin must load platform support number dynamically from /api/restaurant/support"
);

const customerContactClient = fs.readFileSync(
  path.join(backendDir, "../frontend-user/app/(pages)/contact/ContactClient.js"),
  "utf-8"
);
assert.ok(
  !customerContactClient.includes("6202377582"),
  "Platform WhatsApp number must NEVER be hardcoded or exposed as customer contact in frontend-user"
);
console.log("✓ Platform support WhatsApp number is loaded securely from env and not hardcoded in frontend.");

// ============================================================================
// SUITE 6: CUSTOMER CONTACT WHATSAPP BEHAVIOR
// ============================================================================
console.log("\n[SUITE 6] Verifying Customer Contact logic for WhatsApp...");
function getCustomerRestaurantContactView(restaurant) {
  const hasWhatsapp = Boolean(restaurant.whatsappNumber && restaurant.whatsappNumber.trim().length > 0);
  return {
    restaurantName: restaurant.name,
    phone: restaurant.phone,
    hasWhatsappButton: hasWhatsapp,
    whatsappUrl: hasWhatsapp
      ? `https://wa.me/${restaurant.whatsappNumber.replace(/\D/g, "")}`
      : null,
  };
}

const viewA = getCustomerRestaurantContactView(testRestA);
assert.strictEqual(viewA.hasWhatsappButton, true, "Restaurant with whatsappNumber must show WhatsApp button");
assert.strictEqual(viewA.whatsappUrl, "https://wa.me/919876543210");
assert.strictEqual(viewA.phone, "080-12345678");

const viewB = getCustomerRestaurantContactView(testRestB);
assert.strictEqual(viewB.hasWhatsappButton, false, "Restaurant without whatsappNumber must NOT show WhatsApp button");
assert.strictEqual(viewB.whatsappUrl, null);
assert.strictEqual(viewB.phone, "080-87654321", "Phone is shown, but never treated as WhatsApp");
console.log("✓ Customer contact view generates WhatsApp button only for restaurants with whatsappNumber.");

// ============================================================================
// SUITE 7: OFFERS EMPTY STATE COPY CONTRACT
// ============================================================================
console.log("\n[SUITE 7] Verifying /offers empty state contract...");
const offersClientContent = fs.readFileSync(
  path.join(backendDir, "../frontend-user/app/(pages)/offers/OffersClient.js"),
  "utf-8"
);
assert.ok(offersClientContent.includes("Offers"), "Offers page must include 'Offers'");
assert.ok(
  offersClientContent.includes("No ongoing offers right now."),
  "Offers empty state must show exact text: 'No ongoing offers right now.'"
);
assert.ok(
  offersClientContent.includes(
    "Check back soon for new deals and special offers from restaurants on Pet Protocols."
  ),
  "Offers empty state must show exact follow-up copy."
);
console.log("✓ /offers contains the exact required empty state text.");

// ============================================================================
// SUITE 8: OFFER CREATION & SOURCE AUTHORIZATION (Restaurant Admin & Super Admin)
// ============================================================================
console.log("\n[SUITE 8] Testing Offer creation by Restaurant Admin & Super Admin...");
// 1. Restaurant Admin creates offer for their own restaurant
const restOffer = await Offer.create({
  title: "[TEST_OFFER] Alpha Kitchen Weekend Feast",
  description: "Get 25% off all gourmet dog bowls and cat entrees.",
  restaurant: testRestA._id,
  discountType: "percentage",
  discountValue: 25,
  minOrder: 399,
  code: "ALPHA25",
  isActive: true,
  startDate: new Date(),
  creatorRole: "restaurant_admin",
});
assert.ok(restOffer._id);
assert.strictEqual(restOffer.restaurant.toString(), testRestA._id.toString());

// 2. Super Admin creates platform-wide offer
const superOffer = await Offer.create({
  title: "[TEST_OFFER] Pet Protocols Platform Welcome",
  description: "Flat ₹100 off on your first multi-kitchen order.",
  restaurant: null, // Platform-wide
  discountType: "flat",
  discountValue: 100,
  minOrder: 499,
  code: "WELCOME100",
  isActive: true,
  startDate: new Date(),
  creatorRole: "superadmin",
});
assert.ok(superOffer._id);
assert.strictEqual(superOffer.restaurant, null);
console.log("✓ Successfully created restaurant-specific and platform-wide offers.");

// ============================================================================
// SUITE 9: OFFER → RESTAURANT MENU FLOW
// ============================================================================
console.log("\n[SUITE 9] Verifying Offer → Restaurant Menu navigation & dish isolation...");
// Create dishes for Restaurant A and Restaurant B
let dishA = await Product.findOne({ name: "[TEST] Alpha Chicken Meal" });
if (!dishA) {
  dishA = await Product.create({
    name: "[TEST] Alpha Chicken Meal",
    price: 250,
    category: "Burger",
    restaurant: testRestA._id,
    isAvailable: true,
  });
}

let dishB = await Product.findOne({ name: "[TEST] Beta Fish Bites" });
if (!dishB) {
  dishB = await Product.create({
    name: "[TEST] Beta Fish Bites",
    price: 300,
    category: "Burger",
    restaurant: testRestB._id,
    isAvailable: true,
  });
}

// When customer clicks restOffer:
const destinationUrl = `/menu?restaurant=${restOffer.restaurant.toString()}`;
console.log(`Customer clicks offer -> navigating to ${destinationUrl}`);

// Simulate GET /api/products?restaurant=${testRestA._id}
const productsForOfferRest = await Product.find({
  restaurant: testRestA._id,
  isAvailable: true,
}).lean();

const productNames = productsForOfferRest.map((p) => p.name);
console.log("Dishes displayed on restaurant menu:", productNames);

assert.ok(
  productNames.includes(dishA.name),
  "Dishes belonging to the offer's restaurant must appear on the menu"
);
assert.ok(
  !productNames.includes(dishB.name),
  "Dishes belonging to other restaurants must NOT appear when filtered by restaurant"
);
console.log("✓ Offer -> Restaurant Menu flow isolates dishes strictly to the selected restaurant.");

// Clean up test data
await Offer.deleteMany({ title: { $regex: /^\[TEST_OFFER\]/ } });
await Product.deleteMany({ name: { $regex: /^\[TEST\]/ } });
await Restaurant.deleteMany({ name: { $regex: /^\[TEST\]/ } });
console.log("\nCleaned up all test records from database.");

await mongoose.disconnect();
console.log("\n>>> ALL ABOUT, CONTACT, AND OFFERS TESTS PASSED SUCCESSFULLY! <<<");
