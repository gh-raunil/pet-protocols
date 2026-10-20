import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import assert from 'node:assert';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register ESM loader for Next.js API route imports
register(pathToFileURL('./scripts/loader.mjs').href, import.meta.url);

const { default: connectDB } = await import('../lib/db.js');
const { default: User } = await import('../models/User.js');
const { POST: signupPOST } = await import('../app/api/auth/signup/route.js');
const { resetRateLimit } = await import('../lib/rateLimit.js');

let passed = 0;
let failed = 0;

function reportTest(name, success, error = null) {
  if (success) {
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } else {
    failed++;
    console.error(`  ✗ [FAIL] ${name}`);
    if (error) console.error(`    Error:`, error.message || error);
  }
}

function makeMockRequest(body, headers = {}) {
  const reqHeaders = new Headers({
    'content-type': 'application/json',
    'x-forwarded-for': '198.51.100.42',
    ...headers,
  });

  return {
    headers: reqHeaders,
    async json() {
      return body;
    },
  };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('PET PROTOCOLS - AUTH ROUTE & SECURITY INTEGRATION SUITE');
  console.log('================================================================\n');

  try {
    await connectDB();
  } catch (err) {
    console.warn('Database connection note (tests will proceed with route validation):', err.message);
  }

  // Clear rate limits for test IP
  resetRateLimit('signup:198.51.100.42');

  // Test 1: Empty payload rejected
  try {
    const res = await signupPOST(makeMockRequest({}));
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    reportTest('Signup route rejects empty payload with HTTP 400', true);
  } catch (err) {
    reportTest('Signup route rejects empty payload with HTTP 400', false, err);
  }

  // Test 2: Invalid email rejected
  try {
    const res = await signupPOST(makeMockRequest({
      name: 'Test User',
      email: 'not-an-email-address',
      password: 'ValidPassword123!',
    }));
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.match(data.message, /valid email address/i);
    reportTest('Signup route rejects malformed email address', true);
  } catch (err) {
    reportTest('Signup route rejects malformed email address', false, err);
  }

  // Test 3: Password under 8 chars rejected
  try {
    const res = await signupPOST(makeMockRequest({
      name: 'Test User',
      email: 'valid.user@example.com',
      password: 'P1!',
    }));
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.match(data.message, /at least 8 characters/i);
    reportTest('Signup route rejects short passwords (< 8 chars)', true);
  } catch (err) {
    reportTest('Signup route rejects short passwords (< 8 chars)', false, err);
  }

  // Test 4: Password exceeding 72 bytes rejected (Bcrypt algorithmic DoS protection)
  try {
    const hugePassword = 'A'.repeat(80) + '1!';
    const res = await signupPOST(makeMockRequest({
      name: 'Test User',
      email: 'valid.user@example.com',
      password: hugePassword,
    }));
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.match(data.message, /maximum length/i);
    reportTest('Signup route rejects oversized passwords (> 72 bytes DoS protection)', true);
  } catch (err) {
    reportTest('Signup route rejects oversized passwords (> 72 bytes DoS protection)', false, err);
  }

  // Test 5: Superadmin email reservation protected
  try {
    const res = await signupPOST(makeMockRequest({
      name: 'Fake Superadmin',
      email: 'superadmin.petprotocols@gmail.com',
      password: 'Password123!',
    }));
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.match(data.message, /not permitted via public signup/i);
    reportTest('Signup route prevents public registration with superadmin email', true);
  } catch (err) {
    reportTest('Signup route prevents public registration with superadmin email', false, err);
  }

  // Test 6: Rate limiting on signup
  try {
    const testIp = '198.51.100.99';
    resetRateLimit(`signup:${testIp}`);

    // Fire 5 requests
    for (let i = 0; i < 5; i++) {
      await signupPOST(makeMockRequest(
        { name: 'Spammer', email: 'spam@example.com', password: 'P' },
        { 'x-forwarded-for': testIp }
      ));
    }

    // 6th request must be 429
    const blockedRes = await signupPOST(makeMockRequest(
      { name: 'Spammer', email: 'spam@example.com', password: 'Password123!' },
      { 'x-forwarded-for': testIp }
    ));
    const blockedData = await blockedRes.json();
    assert.strictEqual(blockedRes.status, 429);
    assert.strictEqual(blockedData.success, false);
    assert.match(blockedData.message, /too many registration attempts/i);
    assert.ok(blockedRes.headers.get('retry-after'));
    reportTest('Signup route enforces 5 signups / 15m rate limit returning HTTP 429', true);

    resetRateLimit(`signup:${testIp}`);
  } catch (err) {
    reportTest('Signup route enforces 5 signups / 15m rate limit returning HTTP 429', false, err);
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTestSuite();
