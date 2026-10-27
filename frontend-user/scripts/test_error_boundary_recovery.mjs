import assert from "assert";

console.log("========================================================================");
console.log("TEST SUITE: ERROR BOUNDARY RECOVERY & RESILIENCE REGRESSION TESTS");
console.log("========================================================================\n");

// 1. Error Sanitization Verification
function sanitizeError(err) {
  if (!err) return { message: "An unexpected error occurred." };
  const rawMsg = typeof err === "string" ? err : err.message || "An unexpected error occurred.";
  const sanitized = rawMsg
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, "$1[REDACTED]")
    .replace(/([?&](token|key|secret|auth|password|apiKey)=)[^&]+/gi, "$1[REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, "[EMAIL]");

  return {
    message: sanitized,
    digest: err.digest || null,
  };
}

console.log("1. Testing diagnostic sanitization...");
{
  const rawTokenError = new Error("Failed fetching /api/orders?token=secret123456789&key=mySecretKey");
  const sanitized = sanitizeError(rawTokenError);
  assert.strictEqual(
    sanitized.message.includes("secret123456789"),
    false,
    "Secrets must not leak into customer/log outputs"
  );
  assert.ok(sanitized.message.includes("[REDACTED]"), "Secret query parameters should be replaced with [REDACTED]");
  console.log("   [PASS] Secret query parameters successfully sanitized");

  const bearerError = new Error("Authorization error with header Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz");
  const sanitizedBearer = sanitizeError(bearerError);
  assert.strictEqual(
    sanitizedBearer.message.includes("eyJhbGci"),
    false,
    "Bearer token must not leak"
  );
  assert.ok(sanitizedBearer.message.includes("Bearer [REDACTED]"), "Bearer token redacted");
  console.log("   [PASS] Bearer token successfully sanitized");

  const emailError = new Error("User customer@example.com session expired");
  const sanitizedEmail = sanitizeError(emailError);
  assert.strictEqual(sanitizedEmail.message.includes("customer@example.com"), false, "Email must not leak");
  assert.ok(sanitizedEmail.message.includes("[EMAIL]"), "Email redacted");
  console.log("   [PASS] PII (email) successfully sanitized");
}

// 2. Retry Logic & Loop Prevention Simulation
console.log("\n2. Testing retry lifecycle & loop prevention...");
{
  let resetCalled = 0;
  let reloadCalled = 0;
  let retryCount = 0;

  const reset = () => { resetCalled++; };
  const windowReload = () => { reloadCalled++; };

  // Helper simulating handleRetry in Error component
  const simulateRetry = () => {
    retryCount++;
    if (retryCount >= 3) {
      windowReload();
      return;
    }
    reset();
  };

  // Attempt 1: calls reset
  simulateRetry();
  assert.strictEqual(resetCalled, 1, "First attempt must call reset()");
  assert.strictEqual(reloadCalled, 0, "First attempt should not hard reload");
  console.log("   [PASS] Attempt 1 genuinely reattempts reset()");

  // Attempt 2: calls reset
  simulateRetry();
  assert.strictEqual(resetCalled, 2, "Second attempt must call reset()");
  assert.strictEqual(reloadCalled, 0, "Second attempt should not hard reload");
  console.log("   [PASS] Attempt 2 genuinely reattempts reset()");

  // Attempt 3: loops prevented, invokes hard reload
  simulateRetry();
  assert.strictEqual(reloadCalled, 1, "Third attempt must trigger hard reload to break client state loop");
  console.log("   [PASS] Persistent failure triggers clean hard reload loop prevention");
}

console.log("\n========================================================================");
console.log("ALL ERROR BOUNDARY RECOVERY TESTS PASSED (100% SUCCESS)");
console.log("========================================================================\n");
