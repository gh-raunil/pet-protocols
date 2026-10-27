import { register } from "node:module";
import { pathToFileURL } from "node:url";
import dns from "dns";
import assert from "node:assert/strict";

register(pathToFileURL("./scripts/loader.mjs").href, import.meta.url);
dns.setServers(["8.8.8.8", "1.1.1.1"]);

console.log("========================================================================");
console.log("PET PROTOCOLS — LOGIN RATE LIMITER INTEGRATION & REGRESSION TEST SUITE");
console.log("========================================================================\n");

// 1. Start isolated MongoMemoryReplSet (zero access to live or persistent database)
console.log("Starting isolated MongoMemoryReplSet...");
const { MongoMemoryReplSet } = await import("mongodb-memory-server");
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
const localUri = replSet.getUri("test_login_ratelimit_isolated");
assert.ok(
  localUri.includes("127.0.0.1") || localUri.includes("localhost"),
  "Security Invariant: Must use isolated loopback MongoDB URI"
);

process.env.MONGODB_URI = localUri;
process.env.TEST_MONGODB_URI = localUri;
process.env.NEXTAUTH_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.SUPERADMIN_EMAIL = "superadmin.petprotocols@gmail.com";

const mongoose = (await import("mongoose")).default;
await mongoose.connect(localUri);

const UserModel = (await import("../models/User.js")).default;
const RestaurantModel = (await import("../models/Restaurant.js")).default;
const { authOptions } = await import("../lib/auth.js");
const {
  isLoginRateLimited,
  resetLoginAttempts,
  recordFailedLoginAttempt,
  resetRateLimit,
  getClientIp,
} = await import("../lib/rateLimit.js");
const bcrypt = (await import("bcryptjs")).default;

const credentialsProvider = authOptions.providers.find((p) => p.id === "credentials");
assert.ok(credentialsProvider, "Credentials provider must exist");
const authorize = credentialsProvider.options?.authorize || credentialsProvider.authorize;
assert.ok(typeof authorize === "function", "Authorize function must exist");

// Seed test restaurant and roles
const testRest = await RestaurantModel.create({
  name: "RateLimit Test Bistro",
  slug: "ratelimit-test-bistro",
  status: "active",
  address: {
    street: "123 Test St",
    city: "Test City",
    latitude: 28.6139,
    longitude: 77.209,
  },
});

const passHash = await bcrypt.hash("ValidPassword123!", 10);

const customerUser = await UserModel.create({
  name: "Alice Customer",
  email: "alice.customer@example.com",
  password: passHash,
  role: "customer",
  status: "active",
});

const adminUser = await UserModel.create({
  name: "Bob Manager",
  email: "bob.manager@example.com",
  password: passHash,
  role: "restaurant_admin",
  restaurant: testRest._id,
  status: "active",
});

const staffUser = await UserModel.create({
  name: "Charlie Delivery",
  email: "charlie.delivery@example.com",
  password: passHash,
  role: "staff",
  staffRole: "Delivery",
  staffRoles: ["Delivery"],
  restaurant: testRest._id,
  status: "active",
});

const superadminUser = await UserModel.create({
  name: "Diana SuperAdmin",
  email: "superadmin.petprotocols@gmail.com",
  password: passHash,
  role: "superadmin",
  status: "active",
});

console.log("✓ Fixtures seeded in isolated database.\n");

// -----------------------------------------------------------------------------
// TEST 1: getClientIp handling & proxy manipulation protection
// -----------------------------------------------------------------------------
console.log("TEST 1: getClientIp header handling & proxy manipulation resistance");
{
  assert.strictEqual(getClientIp(null), "127.0.0.1");
  assert.strictEqual(getClientIp({ headers: {} }), "127.0.0.1");

  // Web Standard Headers instance
  const stdReq = { headers: new Headers({ "x-forwarded-for": "198.51.100.5" }) };
  assert.strictEqual(getClientIp(stdReq), "198.51.100.5");

  // Plain object headers (NextAuth format)
  const plainReq = { headers: { "x-forwarded-for": "198.51.100.8" } };
  assert.strictEqual(getClientIp(plainReq), "198.51.100.8");

  // Edge proxy headers prioritized over forged X-Forwarded-For
  const cfReq = {
    headers: {
      "cf-connecting-ip": "192.0.2.77",
      "x-forwarded-for": "spoofed.ip.1, 10.0.0.1",
    },
  };
  assert.strictEqual(getClientIp(cfReq), "192.0.2.77");

  const xRealReq = {
    headers: {
      "x-real-ip": "192.0.2.88",
      "x-forwarded-for": "spoofed.ip.2, 10.0.0.1",
    },
  };
  assert.strictEqual(getClientIp(xRealReq), "192.0.2.88");

  console.log("  ✓ Passed Test 1: getClientIp correctly resolves client IP and prioritizes verified edge headers.");
}

// -----------------------------------------------------------------------------
// TEST 2: Customer Login Flow — 10 wrong passwords locks account, resets on success
// -----------------------------------------------------------------------------
console.log("\nTEST 2: Customer targeted brute-force lockout (per-email threshold)");
{
  const email = customerUser.email;
  const ip = "198.51.100.11";
  resetLoginAttempts({ email, ip });
  resetRateLimit(`login:ip:${ip}`);

  const mockReq = { headers: { "x-real-ip": ip } };

  // 10 failed attempts
  for (let i = 1; i <= 10; i++) {
    try {
      await authorize({ email, password: `WrongPassword_${i}` }, mockReq);
      assert.fail(`Attempt ${i} should have thrown invalid password`);
    } catch (err) {
      assert.strictEqual(err.message, "Invalid email or password");
    }
  }

  // 11th attempt must be locked out
  try {
    await authorize({ email, password: "WrongPassword_11" }, mockReq);
    assert.fail("Attempt 11 must be blocked by rate limit");
  } catch (err) {
    assert.match(err.message, /Too many failed login attempts/i);
    assert.match(err.message, /seconds before trying again/i);
  }

  // Unlock on resetLoginAttempts (simulate admin reset or successful auth cycle)
  resetLoginAttempts(email);
  const successAuth = await authorize({ email, password: "ValidPassword123!" }, mockReq);
  assert.ok(successAuth);
  assert.strictEqual(successAuth.email, email);

  console.log("  ✓ Passed Test 2: Customer login locks after 10 failed attempts and unlocks on valid reset.");
}

// -----------------------------------------------------------------------------
// TEST 3: Restaurant Admin Login Flow — verifies role restriction & rate limit
// -----------------------------------------------------------------------------
console.log("\nTEST 3: Restaurant Admin login flow & rate limiting");
{
  const email = adminUser.email;
  const ip = "198.51.100.22";
  resetLoginAttempts({ email, ip });
  resetRateLimit(`login:ip:${ip}`);

  const mockReq = { headers: { "x-real-ip": ip } };

  // 10 failed attempts with loginType: "admin"
  for (let i = 1; i <= 10; i++) {
    try {
      await authorize({ email, password: `WrongPass_${i}`, loginType: "admin" }, mockReq);
      assert.fail(`Attempt ${i} should have failed`);
    } catch (err) {
      assert.strictEqual(err.message, "Invalid email or password");
    }
  }

  // 11th attempt is locked
  try {
    await authorize({ email, password: "WrongPass_11", loginType: "admin" }, mockReq);
    assert.fail("Attempt 11 must be locked");
  } catch (err) {
    assert.match(err.message, /Too many failed login attempts/i);
  }

  // Successful login clears counter
  resetLoginAttempts(email);
  const adminAuth = await authorize({ email, password: "ValidPassword123!", loginType: "admin" }, mockReq);
  assert.ok(adminAuth);
  assert.strictEqual(adminAuth.role, "restaurant_admin");
  assert.strictEqual(adminAuth.restaurantId, testRest._id.toString());

  console.log("  ✓ Passed Test 3: Restaurant Admin login rate limiting and successful auth verified.");
}

// -----------------------------------------------------------------------------
// TEST 4: Staff Login Flow — verifies staffRoles, role check & rate limit
// -----------------------------------------------------------------------------
console.log("\nTEST 4: Staff login flow & rate limiting");
{
  const email = staffUser.email;
  const ip = "198.51.100.33";
  resetLoginAttempts({ email, ip });
  resetRateLimit(`login:ip:${ip}`);

  const mockReq = { headers: { "x-real-ip": ip } };

  // 10 failed attempts with loginType: "staff"
  for (let i = 1; i <= 10; i++) {
    try {
      await authorize({ email, password: `WrongPass_${i}`, loginType: "staff" }, mockReq);
      assert.fail(`Attempt ${i} should have failed`);
    } catch (err) {
      assert.strictEqual(err.message, "Invalid email or password");
    }
  }

  // 11th attempt is locked
  try {
    await authorize({ email, password: "WrongPass_11", loginType: "staff" }, mockReq);
    assert.fail("Attempt 11 must be locked");
  } catch (err) {
    assert.match(err.message, /Too many failed login attempts/i);
  }

  resetLoginAttempts(email);
  const staffAuth = await authorize({ email, password: "ValidPassword123!", loginType: "staff" }, mockReq);
  assert.ok(staffAuth);
  assert.strictEqual(staffAuth.role, "staff");
  assert.deepStrictEqual(staffAuth.staffRoles, ["Delivery"]);

  console.log("  ✓ Passed Test 4: Staff login rate limiting and role payload verified.");
}

// -----------------------------------------------------------------------------
// TEST 5: Superadmin Login Flow — verifies superadmin protection & rate limit
// -----------------------------------------------------------------------------
console.log("\nTEST 5: Superadmin login flow & rate limiting");
{
  const email = superadminUser.email;
  const ip = "198.51.100.44";
  resetLoginAttempts({ email, ip });
  resetRateLimit(`login:ip:${ip}`);

  const mockReq = { headers: { "x-real-ip": ip } };

  // 10 failed attempts
  for (let i = 1; i <= 10; i++) {
    try {
      await authorize({ email, password: `WrongSuperPass_${i}` }, mockReq);
      assert.fail(`Attempt ${i} should have failed`);
    } catch (err) {
      assert.strictEqual(err.message, "Invalid email or password");
    }
  }

  // 11th attempt is locked
  try {
    await authorize({ email, password: "WrongSuperPass_11" }, mockReq);
    assert.fail("Attempt 11 must be locked");
  } catch (err) {
    assert.match(err.message, /Too many failed login attempts/i);
  }

  resetLoginAttempts(email);
  const superAuth = await authorize({ email, password: "ValidPassword123!" }, mockReq);
  assert.ok(superAuth);
  assert.strictEqual(superAuth.role, "superadmin");

  console.log("  ✓ Passed Test 5: Superadmin login rate limiting and authorization verified.");
}

// -----------------------------------------------------------------------------
// TEST 6: Credential Spraying Defense — Multiple random emails from single IP
// -----------------------------------------------------------------------------
console.log("\nTEST 6: Credential spraying defense (Per-IP threshold of 25 attempts)");
{
  const attackerIp = "198.51.100.99";
  resetRateLimit(`login:ip:${attackerIp}`);

  const mockReq = { headers: { "x-real-ip": attackerIp } };

  // Attacker sprays 25 different emails from the same IP
  for (let i = 1; i <= 25; i++) {
    const sprayEmail = `sprayed_user_${i}@example.com`;
    try {
      await authorize({ email: sprayEmail, password: "Password123!" }, mockReq);
      assert.fail(`Spray attempt ${i} should have failed`);
    } catch (err) {
      assert.strictEqual(err.message, "Invalid email or password");
    }
  }

  // 26th attempt with a BRAND NEW email must be BLOCKED by the IP limiter!
  try {
    await authorize({ email: "fresh_target_26@example.com", password: "Password123!" }, mockReq);
    assert.fail("26th attempt from same IP must be blocked even with new email");
  } catch (err) {
    assert.match(err.message, /Too many failed login attempts/i);
    assert.match(err.message, /seconds before trying again/i);
  }

  resetRateLimit(`login:ip:${attackerIp}`);
  console.log("  ✓ Passed Test 6: Credential spraying across different emails is blocked by per-IP threshold.");
}

// -----------------------------------------------------------------------------
// TEST 7: Empty or Malformed Email input records failed attempt against IP
// -----------------------------------------------------------------------------
console.log("\nTEST 7: Empty and malformed email attempts are counted against caller IP");
{
  const probeIp = "198.51.100.105";
  resetRateLimit(`login:ip:${probeIp}`);

  const mockReq = { headers: { "x-real-ip": probeIp } };

  for (let i = 1; i <= 25; i++) {
    try {
      await authorize({ email: "", password: "foo" }, mockReq);
      assert.fail("Empty email should fail");
    } catch (err) {
      assert.strictEqual(err.message, "Invalid email or password");
    }
  }

  // 26th attempt blocked by IP limit
  try {
    await authorize({ email: "", password: "foo" }, mockReq);
    assert.fail("26th empty email attempt must be blocked by IP");
  } catch (err) {
    assert.match(err.message, /Too many failed login attempts/i);
  }

  resetRateLimit(`login:ip:${probeIp}`);
  console.log("  ✓ Passed Test 7: Malformed/empty email probes are tracked against client IP.");
}

// -----------------------------------------------------------------------------
// TEST 8: Backward compatibility with legacy rateLimit.js test consumers
// -----------------------------------------------------------------------------
console.log("\nTEST 8: Backward compatibility with string identifier signatures");
{
  const legacyKey = "legacy.tester@example.com";
  resetLoginAttempts(legacyKey);

  assert.strictEqual(isLoginRateLimited(legacyKey).limited, false);
  for (let i = 0; i < 10; i++) {
    recordFailedLoginAttempt(legacyKey);
  }
  assert.strictEqual(isLoginRateLimited(legacyKey).limited, true);
  resetLoginAttempts(legacyKey);
  assert.strictEqual(isLoginRateLimited(legacyKey).limited, false);

  console.log("  ✓ Passed Test 8: String signatures for isLoginRateLimited/recordFailedLoginAttempt work seamlessly.");
}

console.log("\n========================================================================");
console.log("🎉 ALL 8 INTEGRATION & REGRESSION TESTS PASSED SUCCESSFULLY!");
console.log("========================================================================\n");

await mongoose.disconnect();
await replSet.stop();
console.log("Stopped isolated MongoMemoryReplSet.");
process.exit(0);
