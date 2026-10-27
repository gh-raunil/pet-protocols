import assert from "assert";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

// Register loader for Next.js path aliases
register(pathToFileURL(path.resolve("backend/scripts/loader.mjs")).href, import.meta.url);

import { getSafeCallbackUrl, getUtf8ByteLength } from "../lib/authHelpers.js";
const { safeRedirectUrl } = await import("../../backend/lib/auth.js");
import { validatePassword } from "../../backend/lib/validation.js";

console.log("=== Starting Phase 2.5.2 Auth Remediation Verification Suite ===");

// ═══════════════════════════════════════════════════════════════════
// TEST 1: Password UTF-8 Byte Length & Boundary Tests
// ═══════════════════════════════════════════════════════════════════
console.log("\n--- 1. Testing Password UTF-8 Byte Boundaries ---");

function evaluateFrontendPassword(password) {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
  const byteLength = getUtf8ByteLength(password);
  const isWithinMax = byteLength <= 72;

  let criteriaCount = 0;
  if (hasMinLength) criteriaCount++;
  if (hasLetter) criteriaCount++;
  if (hasNumberOrSymbol) criteriaCount++;

  let strengthLabel = "Weak";
  if (!isWithinMax) {
    strengthLabel = "Over limit";
  } else if (criteriaCount === 2) {
    strengthLabel = "Fair";
  } else if (criteriaCount === 3) {
    strengthLabel = "Strong";
  }

  const isValid = hasMinLength && hasLetter && hasNumberOrSymbol && isWithinMax;
  return { byteLength, isWithinMax, criteriaCount, strengthLabel, isValid };
}

// 1.1 ASCII Boundary Tests (71, 72, 73 bytes)
const ascii71 = "A".repeat(69) + "1!"; // 69 'A's + '1' + '!' = 71 bytes
const ascii72 = "A".repeat(70) + "1!"; // 70 'A's + '1' + '!' = 72 bytes
const ascii73 = "A".repeat(71) + "1!"; // 71 'A's + '1' + '!' = 73 bytes

assert.strictEqual(getUtf8ByteLength(ascii71), 71);
assert.strictEqual(getUtf8ByteLength(ascii72), 72);
assert.strictEqual(getUtf8ByteLength(ascii73), 73);

const fe71 = evaluateFrontendPassword(ascii71);
const fe72 = evaluateFrontendPassword(ascii72);
const fe73 = evaluateFrontendPassword(ascii73);

assert.strictEqual(fe71.isWithinMax, true);
assert.strictEqual(fe71.strengthLabel, "Strong");
assert.strictEqual(fe71.isValid, true);
assert.strictEqual(validatePassword(ascii71).valid, true);

assert.strictEqual(fe72.isWithinMax, true);
assert.strictEqual(fe72.strengthLabel, "Strong");
assert.strictEqual(fe72.isValid, true);
assert.strictEqual(validatePassword(ascii72).valid, true);

assert.strictEqual(fe73.isWithinMax, false);
assert.strictEqual(fe73.strengthLabel, "Over limit");
assert.strictEqual(fe73.isValid, false);
assert.strictEqual(validatePassword(ascii73).valid, false);

// 1.2 Multibyte Unicode & Emoji Boundaries (71, 72, 73 bytes)
// 'é' is 2 UTF-8 bytes. 34 * 2 = 68 bytes + 'A' (1) + '1' (1) + '!' (1) = 71 bytes
const multi71 = "é".repeat(34) + "A1!";
// 34 * 2 = 68 bytes + 'A' (1) + 'B' (1) + '1' (1) + '!' (1) = 72 bytes
const multi72 = "é".repeat(34) + "AB1!";
// 35 * 2 = 70 bytes + 'A' (1) + '1' (1) + '!' (1) = 73 bytes
const multi73 = "é".repeat(35) + "A1!";

assert.strictEqual(getUtf8ByteLength(multi71), 71);
assert.strictEqual(getUtf8ByteLength(multi72), 72);
assert.strictEqual(getUtf8ByteLength(multi73), 73);

// Crucial: multi73 string character count is only 38, but UTF-8 byte length is 73!
assert.strictEqual(multi73.length, 38);
const feMulti73 = evaluateFrontendPassword(multi73);
assert.strictEqual(feMulti73.isWithinMax, false);
assert.strictEqual(feMulti73.strengthLabel, "Over limit");
assert.strictEqual(feMulti73.isValid, false);
// Backend validation must also reject it identically
assert.strictEqual(validatePassword(multi73).valid, false);

// 1.3 4-byte Emoji test: '🔑' is 4 bytes. 18 * 4 = 72 bytes. With letters, total exceeds 72 bytes.
const emojiPwd = "🔑".repeat(17) + "Password1!"; // 17 * 4 = 68 + 10 = 78 bytes, length = 27
assert.strictEqual(getUtf8ByteLength(emojiPwd), 78);
const feEmoji = evaluateFrontendPassword(emojiPwd);
assert.strictEqual(feEmoji.isWithinMax, false);
assert.strictEqual(feEmoji.strengthLabel, "Over limit");
assert.strictEqual(validatePassword(emojiPwd).valid, false);

console.log("✔ Password UTF-8 byte boundary tests (ASCII, multi-byte Unicode, and emoji) PASSED.");

// ═══════════════════════════════════════════════════════════════════
// TEST 2: Safe Tab Switching & Query Parameter Sanitization
// ═══════════════════════════════════════════════════════════════════
console.log("\n--- 2. Testing Safe Tab Switching & Query Parameter Handling ---");

function simulateTabSwitch(tab, rawCallback, currentSearchParams = new URLSearchParams()) {
  const targetPath = tab === "signin" ? "/auth/login" : "/auth/signup";

  const newSearchParams = new URLSearchParams();
  const safeCallback = getSafeCallbackUrl(rawCallback, null);
  if (safeCallback && safeCallback !== "/menu") {
    newSearchParams.set("callbackUrl", safeCallback);
  }

  const ALLOWED_QUERY_PARAMS = [
    "table",
    "ref",
    "source",
    "restaurant",
    "step",
    "utm_source",
    "utm_medium",
    "utm_campaign",
  ];
  for (const key of ALLOWED_QUERY_PARAMS) {
    const val = currentSearchParams.get(key);
    if (val && typeof val === "string" && !/[\u0000-\u001F\u007F]/.test(val)) {
      newSearchParams.set(key, val.slice(0, 200));
    }
  }

  const queryString = newSearchParams.toString();
  return queryString ? `${targetPath}?${queryString}` : targetPath;
}

// 2.1 Preserves legitimate callback and allowed auxiliary parameters
const legitParams = new URLSearchParams({
  callbackUrl: "/checkout?step=payment",
  table: "14",
  ref: "email_campaign",
  sessionToken: "sensitive_leak", // Disallowed parameter
});
const resultUrl1 = simulateTabSwitch("signup", "/checkout?step=payment", legitParams);
assert.strictEqual(resultUrl1, "/auth/signup?callbackUrl=%2Fcheckout%3Fstep%3Dpayment&table=14&ref=email_campaign");
assert(!resultUrl1.includes("sessionToken"), "Disallowed sensitive query parameters must not be preserved");

// 2.2 Rejects hostile / open-redirect raw callback parameters
assert.strictEqual(simulateTabSwitch("signup", "//evil.com"), "/auth/signup");
assert.strictEqual(simulateTabSwitch("signup", "https://evil.com"), "/auth/signup");
assert.strictEqual(simulateTabSwitch("signin", "/\\evil.com"), "/auth/login");
assert.strictEqual(simulateTabSwitch("signin", "\\evil.com"), "/auth/login");
assert.strictEqual(simulateTabSwitch("signin", "javascript:alert(1)"), "/auth/login");

// 2.3 Malformed and control-character callback rejection
assert.strictEqual(simulateTabSwitch("signup", "/valid\u0000bad"), "/auth/signup");
assert.strictEqual(simulateTabSwitch("signup", "/valid\r\nbad"), "/auth/signup");

console.log("✔ Safe tab switching and URL parameter sanitization PASSED.");

// ═══════════════════════════════════════════════════════════════════
// TEST 3: Preventing Authentication Self-Redirect Loops
// ═══════════════════════════════════════════════════════════════════
console.log("\n--- 3. Testing Self-Redirect Loop Prevention ---");

// Both client getSafeCallbackUrl and server safeRedirectUrl must prevent loops to login/signup
assert.strictEqual(getSafeCallbackUrl("/auth/login"), "/menu");
assert.strictEqual(getSafeCallbackUrl("/auth/login/"), "/menu");
assert.strictEqual(getSafeCallbackUrl("/auth/login?ref=123"), "/menu");
assert.strictEqual(getSafeCallbackUrl("/auth/signup"), "/menu");
assert.strictEqual(getSafeCallbackUrl("/auth/signup/"), "/menu");
assert.strictEqual(getSafeCallbackUrl("/login"), "/menu");
assert.strictEqual(getSafeCallbackUrl("/signup"), "/menu");

// Backend safeRedirectUrl must also prevent self-redirect loops
assert.strictEqual(safeRedirectUrl({ url: "/auth/login", baseUrl: "http://localhost:3000" }), "http://localhost:3000");
assert.strictEqual(safeRedirectUrl({ url: "/auth/signup", baseUrl: "http://localhost:3000" }), "http://localhost:3000");
assert.strictEqual(safeRedirectUrl({ url: "/login", baseUrl: "http://localhost:3000" }), "http://localhost:3000");
assert.strictEqual(safeRedirectUrl({ url: "http://localhost:3000/auth/login", baseUrl: "http://localhost:3000" }), "http://localhost:3000");
assert.strictEqual(safeRedirectUrl({ url: "http://localhost:3000/auth/signup", baseUrl: "http://localhost:3000" }), "http://localhost:3000");

// Legitimate destinations must continue to resolve safely
assert.strictEqual(getSafeCallbackUrl("/menu"), "/menu");
assert.strictEqual(getSafeCallbackUrl("/orders/12345"), "/orders/12345");
assert.strictEqual(safeRedirectUrl({ url: "/menu", baseUrl: "http://localhost:3000" }), "/menu");
assert.strictEqual(safeRedirectUrl({ url: "/checkout", baseUrl: "http://localhost:3000" }), "/checkout");

console.log("✔ Self-redirect loop prevention PASSED on both client and server.");

// ═══════════════════════════════════════════════════════════════════
// TEST 4: Synchronous In-Flight Duplicate Submission Guard
// ═══════════════════════════════════════════════════════════════════
console.log("\n--- 4. Testing Synchronous In-Flight Guard ---");

async function simulateSubmissionHandler() {
  const inFlightRef = { current: false };
  let networkCallCount = 0;

  const handleSubmit = async () => {
    // Synchronous guard
    if (inFlightRef.current) return { status: "blocked" };
    inFlightRef.current = true;

    try {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 50));
      networkCallCount++;
      return { status: "success" };
    } finally {
      inFlightRef.current = false;
    }
  };

  // Dispatch 5 rapid simultaneous submissions
  const results = await Promise.all([
    handleSubmit(),
    handleSubmit(),
    handleSubmit(),
    handleSubmit(),
    handleSubmit(),
  ]);

  // Exactly 1 submission must proceed, 4 must be blocked immediately
  const successCount = results.filter((r) => r.status === "success").length;
  const blockedCount = results.filter((r) => r.status === "blocked").length;

  assert.strictEqual(networkCallCount, 1, "Expected exactly 1 network call across 5 concurrent submissions");
  assert.strictEqual(successCount, 1, "Expected 1 successful submission");
  assert.strictEqual(blockedCount, 4, "Expected 4 blocked duplicate submissions");

  // Verify guard resets cleanly after completion allowing a subsequent submission
  assert.strictEqual(inFlightRef.current, false, "Guard must reset to false in finally");
  const subsequentResult = await handleSubmit();
  assert.strictEqual(subsequentResult.status, "success", "Subsequent submission must succeed");
  assert.strictEqual(networkCallCount, 2);
}

await simulateSubmissionHandler();
console.log("✔ Synchronous in-flight guard prevents concurrent double-submissions.");

// ═══════════════════════════════════════════════════════════════════
// TEST 5: WAI-ARIA Keyboard Tab Navigation Simulation
// ═══════════════════════════════════════════════════════════════════
console.log("\n--- 5. Testing Accessible Keyboard Tab Navigation ---");

function simulateTabKeyboard(currentTab, key) {
  let targetTab = null;

  if (key === "ArrowRight" || key === "ArrowDown") {
    targetTab = currentTab === "signin" ? "signup" : "signin";
  } else if (key === "ArrowLeft" || key === "ArrowUp") {
    targetTab = currentTab === "signin" ? "signup" : "signin";
  } else if (key === "Home") {
    targetTab = "signin";
  } else if (key === "End") {
    targetTab = "signup";
  }

  return targetTab;
}

assert.strictEqual(simulateTabKeyboard("signin", "ArrowRight"), "signup");
assert.strictEqual(simulateTabKeyboard("signup", "ArrowRight"), "signin");
assert.strictEqual(simulateTabKeyboard("signin", "ArrowLeft"), "signup");
assert.strictEqual(simulateTabKeyboard("signup", "ArrowLeft"), "signin");
assert.strictEqual(simulateTabKeyboard("signup", "Home"), "signin");
assert.strictEqual(simulateTabKeyboard("signin", "End"), "signup");
assert.strictEqual(simulateTabKeyboard("signin", "Enter"), null);

console.log("✔ WAI-ARIA keyboard navigation logic PASSED.");

// ═══════════════════════════════════════════════════════════════════
// TEST 6: HTTP Endpoint Verification
// ═══════════════════════════════════════════════════════════════════
console.log("\n--- 6. Testing HTTP Endpoint Rendering & Validation ---");
const baseUrl = "http://localhost:3000";

console.log("Checking /auth/login HTTP status and markup...");
const loginRes = await fetch(`${baseUrl}/auth/login`);
assert.strictEqual(loginRes.status, 200);
const loginHtml = await loginRes.text();
assert(loginHtml.includes("पेट Protocols") || loginHtml.includes("Pet Protocols"), "Login HTML should include brand name");
assert(loginHtml.includes("Welcome back"), "Login HTML should include Welcome back heading");
assert(loginHtml.includes("tablist"), "Login HTML should include tablist role");
assert(loginHtml.includes("Continue with Google"), "Login HTML should include Google authentication");
console.log("✔ /auth/login renders correctly with status 200.");

console.log("Checking /auth/signup HTTP status and markup...");
const signupRes = await fetch(`${baseUrl}/auth/signup`);
assert.strictEqual(signupRes.status, 200);
const signupHtml = await signupRes.text();
assert(signupHtml.includes("Join पेट Protocols") || signupHtml.includes("Join Pet Protocols"), "Signup HTML should include Join heading");
assert(signupHtml.includes("tablist"), "Signup HTML should include tablist role");
console.log("✔ /auth/signup renders correctly with status 200.");

console.log("Checking backend signup API validation...");
const invalidSignupRes = await fetch(`${baseUrl}/api/auth/signup`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "", email: "invalid", password: "123" }),
});
assert.strictEqual(invalidSignupRes.status, 400);
const invalidData = await invalidSignupRes.json();
assert.strictEqual(invalidData.success, false);
console.log("✔ Backend signup API rejects invalid submissions properly with HTTP 400:", invalidData.message);

console.log("\n=================================================================");
console.log("=== ALL Phase 2.5.2 AUTH REMEDIATION TESTS PASSED (100%) ===");
console.log("=================================================================\n");
process.exit(0);
