import assert from 'node:assert';
import {
  isValidEmail,
  normalizeEmail,
  isValidPhone,
  normalizePhone,
  validatePassword,
} from '../lib/validation.js';
import {
  checkRateLimit,
  isRateLimited,
  resetRateLimit,
  checkSignupRateLimit,
  isLoginRateLimited,
  recordFailedLoginAttempt,
  resetLoginAttempts,
} from '../lib/rateLimit.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('PET PROTOCOLS - AUTHENTICATION VALIDATION & RATE LIMITING SUITE');
  console.log('================================================================\n');

  console.log('--- 1. Email Format Validation & Normalization ---');

  test('Accepts standard valid email addresses', () => {
    assert.strictEqual(isValidEmail('customer@example.com'), true);
    assert.strictEqual(isValidEmail('user.name+tag@domain.co.in'), true);
    assert.strictEqual(isValidEmail('admin_123@petprotocols.org'), true);
    assert.strictEqual(isValidEmail('superadmin.petprotocols@gmail.com'), true);
  });

  test('Rejects malformed and dangerous email addresses', () => {
    assert.strictEqual(isValidEmail(''), false);
    assert.strictEqual(isValidEmail(null), false);
    assert.strictEqual(isValidEmail(undefined), false);
    assert.strictEqual(isValidEmail('plainaddress'), false);
    assert.strictEqual(isValidEmail('@missinguser.com'), false);
    assert.strictEqual(isValidEmail('user@.com'), false);
    assert.strictEqual(isValidEmail('user@domain'), false); // missing TLD
    assert.strictEqual(isValidEmail('user@domain.c'), false); // TLD < 2 chars
    assert.strictEqual(isValidEmail('user..name@example.com'), false); // double dot
    assert.strictEqual(isValidEmail('.user@example.com'), false); // leading dot
    assert.strictEqual(isValidEmail('user@example.com.'), false); // trailing dot
    assert.strictEqual(isValidEmail('user name@example.com'), false); // space
    assert.strictEqual(isValidEmail('user@example..com'), false); // double dot domain
  });

  test('Normalizes emails cleanly (lowercases, trims) without mangling dots', () => {
    assert.strictEqual(normalizeEmail('  User.Test@Example.COM  '), 'user.test@example.com');
    assert.strictEqual(normalizeEmail('ROUNAK@GMAIL.COM'), 'rounak@gmail.com');
  });

  console.log('\n--- 2. Phone Number Validation & Normalization ---');

  test('Accepts standard Indian 10-digit mobile numbers in various formats', () => {
    assert.strictEqual(isValidPhone('9876543210'), true);
    assert.strictEqual(isValidPhone('8123456789'), true);
    assert.strictEqual(isValidPhone('7012345678'), true);
    assert.strictEqual(isValidPhone('6202377582'), true);
    assert.strictEqual(isValidPhone('+91 9876543210'), true);
    assert.strictEqual(isValidPhone('+91-98765-43210'), true);
    assert.strictEqual(isValidPhone('09876543210'), true);
    assert.strictEqual(isValidPhone('919876543210'), true);
  });

  test('Accepts standard E.164 international numbers', () => {
    assert.strictEqual(isValidPhone('+14155552671'), true);
    assert.strictEqual(isValidPhone('+442071838750'), true);
  });

  test('Rejects invalid phone numbers', () => {
    assert.strictEqual(isValidPhone(''), false);
    assert.strictEqual(isValidPhone(null), false);
    assert.strictEqual(isValidPhone('12345'), false); // too short
    assert.strictEqual(isValidPhone('1234567890'), false); // does not start with 6-9 for 10-digit Indian
    assert.strictEqual(isValidPhone('abcdefghij'), false); // alphabetic
    assert.strictEqual(isValidPhone('0000000000'), false);
  });

  test('Normalizes Indian mobile numbers to canonical 10 digits', () => {
    assert.strictEqual(normalizePhone('+91 98765 43210'), '9876543210');
    assert.strictEqual(normalizePhone('+91-98765-43210'), '9876543210');
    assert.strictEqual(normalizePhone('09876543210'), '9876543210');
    assert.strictEqual(normalizePhone('919876543210'), '9876543210');
    assert.strictEqual(normalizePhone('9876543210'), '9876543210');
  });

  console.log('\n--- 3. Password Security & Algorithmic DoS Protection ---');

  test('Accepts strong passwords meeting requirements', () => {
    const res1 = validatePassword('Password123!');
    assert.strictEqual(res1.valid, true);
    const res2 = validatePassword('SuperSecret#2026');
    assert.strictEqual(res2.valid, true);
    const res3 = validatePassword('correct horse battery staple 9');
    assert.strictEqual(res3.valid, true);
  });

  test('Rejects passwords under 8 characters', () => {
    const res = validatePassword('Short1!');
    assert.strictEqual(res.valid, false);
    assert.match(res.message, /at least 8 characters/);
  });

  test('Rejects passwords exceeding 72 bytes (bcrypt DoS protection)', () => {
    const hugePassword = 'A'.repeat(75) + '1!';
    const res = validatePassword(hugePassword);
    assert.strictEqual(res.valid, false);
    assert.match(res.message, /maximum length/);
  });

  test('Rejects passwords without numbers or symbols', () => {
    const res = validatePassword('AllLettersOnly');
    assert.strictEqual(res.valid, false);
    assert.match(res.message, /at least one number or special character/);
  });

  test('Rejects empty or whitespace-only passwords', () => {
    assert.strictEqual(validatePassword('').valid, false);
    assert.strictEqual(validatePassword('        ').valid, false);
    assert.strictEqual(validatePassword(null).valid, false);
  });

  console.log('\n--- 4. Sliding-Window Rate Limiter Store ---');

  test('Sliding window limits hits and returns correct remaining counts', () => {
    const testKey = 'test:rate_limit_unit';
    resetRateLimit(testKey);

    for (let i = 1; i <= 3; i++) {
      const res = checkRateLimit(testKey, { maxRequests: 3, windowMs: 1000 });
      assert.strictEqual(res.allowed, true, `Attempt ${i} should be allowed`);
      assert.strictEqual(res.remaining, 3 - i);
    }

    // 4th attempt exceeds limit
    const blocked = checkRateLimit(testKey, { maxRequests: 3, windowMs: 1000 });
    assert.strictEqual(blocked.allowed, false);
    assert.strictEqual(blocked.remaining, 0);
    assert.strictEqual(blocked.resetInSeconds >= 1, true);

    // Resetting clears the lock
    resetRateLimit(testKey);
    const afterReset = checkRateLimit(testKey, { maxRequests: 3, windowMs: 1000 });
    assert.strictEqual(afterReset.allowed, true);
  });

  test('Failed login attempt tracker tracks and resets properly', () => {
    const email = 'victim@example.com';
    resetLoginAttempts(email);

    assert.strictEqual(isLoginRateLimited(email).limited, false);

    // Simulate 10 failed login attempts
    for (let i = 0; i < 10; i++) {
      recordFailedLoginAttempt(email);
    }

    // 11th check should be locked out
    const lockCheck = isLoginRateLimited(email);
    assert.strictEqual(lockCheck.limited, true);
    assert.strictEqual(lockCheck.resetInSeconds > 0, true);

    // On successful login, reset unlocks account
    resetLoginAttempts(email);
    assert.strictEqual(isLoginRateLimited(email).limited, false);
  });

  test('Signup rate limiter handles mock request object safely', () => {
    const mockReq = {
      headers: new Headers({
        'x-forwarded-for': '203.0.113.195, 10.0.0.1',
      }),
    };

    resetRateLimit('signup:203.0.113.195');

    for (let i = 0; i < 5; i++) {
      const res = checkSignupRateLimit(mockReq);
      assert.strictEqual(res.allowed, true);
    }

    // 6th signup should be blocked
    const blocked = checkSignupRateLimit(mockReq);
    assert.strictEqual(blocked.allowed, false);

    resetRateLimit('signup:203.0.113.195');
  });

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
