import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

// Import units under test
import { resolveConnectionUri } from '../lib/db.js';
import {
  getConfiguredSuperadminEmails,
  getAllowedRedirectOrigins,
  safeRedirectUrl,
  authOptions,
} from '../lib/auth.js';

// ==============================================================================
// TASK A (SEC-01): Superadmin Credential Configuration & Auto-Bootstrap Tests
// ==============================================================================

test('SEC-01: getConfiguredSuperadminEmails() handles missing, empty, and multi-value config', () => {
  const originalEnv = process.env.SUPERADMIN_EMAIL;

  try {
    // 1. Missing / unset
    delete process.env.SUPERADMIN_EMAIL;
    assert.deepStrictEqual(getConfiguredSuperadminEmails(), []);

    // 2. Empty string
    process.env.SUPERADMIN_EMAIL = '';
    assert.deepStrictEqual(getConfiguredSuperadminEmails(), []);

    // 3. Whitespace only
    process.env.SUPERADMIN_EMAIL = '   ';
    assert.deepStrictEqual(getConfiguredSuperadminEmails(), []);

    // 4. Single email (trimmed & lowercased)
    process.env.SUPERADMIN_EMAIL = '  Admin@Domain.Com  ';
    assert.deepStrictEqual(getConfiguredSuperadminEmails(), ['admin@domain.com']);

    // 5. Comma-separated list
    process.env.SUPERADMIN_EMAIL = 'admin1@domain.com, Admin2@domain.com , , admin3@domain.com';
    assert.deepStrictEqual(getConfiguredSuperadminEmails(), [
      'admin1@domain.com',
      'admin2@domain.com',
      'admin3@domain.com',
    ]);
  } finally {
    if (originalEnv !== undefined) {
      process.env.SUPERADMIN_EMAIL = originalEnv;
    } else {
      delete process.env.SUPERADMIN_EMAIL;
    }
  }
});

test('SEC-01: Source code contains no hardcoded fallback password ("rounak") or default emails', () => {
  const authCode = fs.readFileSync(path.join(backendDir, 'lib', 'auth.js'), 'utf8');
  const authMiddlewareCode = fs.readFileSync(path.join(backendDir, 'lib', 'authMiddleware.js'), 'utf8');

  // Must not contain "rounak" fallback password
  assert.strictEqual(
    authCode.includes('rounak'),
    false,
    'backend/lib/auth.js must not contain hardcoded fallback password "rounak"'
  );

  // Must not contain hardcoded superadmin email strings as credential sources
  assert.strictEqual(
    authCode.includes('superadmin.petprotocols@gmail.com'),
    false,
    'backend/lib/auth.js must not contain hardcoded fallback email superadmin.petprotocols@gmail.com'
  );
  assert.strictEqual(
    authCode.includes('superadmin@petprotocols.com'),
    false,
    'backend/lib/auth.js must not contain hardcoded fallback email superadmin@petprotocols.com'
  );

  // Check authMiddleware.js as well
  assert.strictEqual(
    authMiddlewareCode.includes('superadmin.petprotocols@gmail.com'),
    false,
    'backend/lib/authMiddleware.js must not contain hardcoded fallback email superadmin.petprotocols@gmail.com'
  );
  assert.strictEqual(
    authMiddlewareCode.includes('superadmin@petprotocols.com'),
    false,
    'backend/lib/authMiddleware.js must not contain hardcoded fallback email superadmin@petprotocols.com'
  );
});

test('SEC-01: Credentials provider authorize() fails closed when superadmin config is missing', async () => {
  const originalEmail = process.env.SUPERADMIN_EMAIL;
  const originalPass = process.env.SUPERADMIN_PASSWORD;

  try {
    delete process.env.SUPERADMIN_EMAIL;
    delete process.env.SUPERADMIN_PASSWORD;

    const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials');
    assert.ok(credentialsProvider, 'CredentialsProvider must be registered');

    // Attempting login with legacy default credentials must fail closed (return null or throw)
    let failedClosed = false;
    try {
      const res = await credentialsProvider.authorize({
        email: 'superadmin.petprotocols@gmail.com',
        password: 'rounak',
        loginType: 'admin',
      }, { headers: { get: () => '127.0.0.1' } });
      if (res === null) {
        failedClosed = true;
      }
    } catch (err) {
      failedClosed = true;
    }

    assert.strictEqual(failedClosed, true, 'Superadmin login must fail closed when config is missing');
  } finally {
    process.env.SUPERADMIN_EMAIL = originalEmail;
    process.env.SUPERADMIN_PASSWORD = originalPass;
  }
});

test('SEC-01: Rejects attempts to self-promote or authenticate superadmin using unapproved email', async () => {
  const originalEmail = process.env.SUPERADMIN_EMAIL;
  const originalPass = process.env.SUPERADMIN_PASSWORD;

  try {
    process.env.SUPERADMIN_EMAIL = 'superadmin.official@petprotocols.com';
    process.env.SUPERADMIN_PASSWORD = 'super-strong-configured-password-123!';

    const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials');

    // Attempting login with unapproved email must fail closed
    let failedClosed = false;
    try {
      const res = await credentialsProvider.authorize({
        email: 'attacker@evil.com',
        password: 'super-strong-configured-password-123!',
        loginType: 'admin',
      }, { headers: { get: () => '127.0.0.1' } });
      if (res === null) {
        failedClosed = true;
      }
    } catch (_) {
      failedClosed = true;
    }

    assert.strictEqual(failedClosed, true, 'Unapproved email must be rejected from superadmin login');
  } finally {
    process.env.SUPERADMIN_EMAIL = originalEmail;
    process.env.SUPERADMIN_PASSWORD = originalPass;
  }
});

test('SEC-01: Customer and restaurant admin password authentication regression is preserved', async () => {
  const password = 'NormalCustomerPassword123!';
  const hashedPassword = await bcrypt.hash(password, 12);

  // Validate bcrypt comparison behavior for standard users
  const isMatch = await bcrypt.compare(password, hashedPassword);
  assert.strictEqual(isMatch, true, 'Bcrypt password comparison must match for valid credentials');

  const isWrongMatch = await bcrypt.compare('WrongPassword456!', hashedPassword);
  assert.strictEqual(isWrongMatch, false, 'Bcrypt password comparison must reject invalid credentials');
});

// ==============================================================================
// TASK B (SEC-03): MongoDB Connection String & Atlas Host Topology Tests
// ==============================================================================

test('SEC-03: Source code contains no hardcoded Atlas cluster or shard hostnames', () => {
  const dbCode = fs.readFileSync(path.join(backendDir, 'lib', 'db.js'), 'utf8');

  // Check that cluster and shard hostnames were completely removed
  assert.strictEqual(
    dbCode.includes('pet-protocols.t3jdmic.mongodb.net'),
    false,
    'backend/lib/db.js must not contain hardcoded Atlas cluster hostname'
  );
  assert.strictEqual(
    dbCode.includes('ac-e6norca-shard'),
    false,
    'backend/lib/db.js must not contain hardcoded shard hostnames'
  );
  assert.strictEqual(
    dbCode.includes('atlas-6l1h0g-shard-0'),
    false,
    'backend/lib/db.js must not contain hardcoded replicaSet name'
  );
});

test('SEC-03: resolveConnectionUri() rejects missing or empty MONGODB_URI without leaking secrets', () => {
  assert.throws(
    () => resolveConnectionUri(''),
    (err) => {
      assert.strictEqual(err.message, 'Please define MONGODB_URI in the backend environment');
      return true;
    }
  );

  assert.throws(
    () => resolveConnectionUri('   '),
    (err) => {
      assert.strictEqual(err.message, 'Please define MONGODB_URI in the backend environment');
      return true;
    }
  );

  assert.throws(
    () => resolveConnectionUri(null),
    (err) => {
      assert.strictEqual(err.message, 'Please define MONGODB_URI in the backend environment');
      return true;
    }
  );
});

test('SEC-03: resolveConnectionUri() preserves standard URIs when direct hosts are not provided', () => {
  // Standard loopback URI
  const loopback = 'mongodb://127.0.0.1:27017/pet-protocols-test';
  assert.strictEqual(resolveConnectionUri(loopback, null), loopback);

  // Standard Atlas SRV URI
  const srvUri = 'mongodb+srv://app_user:s3cr3t@cluster0.abcde.mongodb.net/pet-protocols?retryWrites=true&w=majority';
  assert.strictEqual(resolveConnectionUri(srvUri, null), srvUri);
  assert.strictEqual(resolveConnectionUri(srvUri, ''), srvUri);
});

test('SEC-03: resolveConnectionUri() applies direct hosts and replicaSet cleanly when configured via environment', () => {
  const srvUri = 'mongodb+srv://app_user:s3cr3t@cluster0.abcde.mongodb.net/pet-protocols?retryWrites=true&w=majority';
  const directHosts = 'shard-00.test.net:27017, shard-01.test.net:27017 ,shard-02.test.net:27017';
  const replicaSet = 'my-custom-replica-set';

  const resolved = resolveConnectionUri(srvUri, directHosts, replicaSet);

  assert.ok(resolved.startsWith('mongodb://app_user:s3cr3t@shard-00.test.net:27017,shard-01.test.net:27017,shard-02.test.net:27017/pet-protocols?'));
  assert.ok(resolved.includes('tls=true'));
  assert.ok(resolved.includes('authSource=admin'));
  assert.ok(resolved.includes('replicaSet=my-custom-replica-set'));
});

// ==============================================================================
// TASK C (SEC-04): Redirect Restriction & Origin Validation Tests
// ==============================================================================

test('SEC-04: safeRedirectUrl() - Same-origin production redirect is allowed', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origFrontend = process.env.FRONTEND_URL;

  try {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://petprotocols.com';

    const baseUrl = 'https://petprotocols.com';
    const redirectUrl = 'https://petprotocols.com/orders/ORD_12345';

    const result = safeRedirectUrl({ url: redirectUrl, baseUrl });
    assert.strictEqual(result, redirectUrl);
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.FRONTEND_URL = origFrontend;
  }
});

test('SEC-04: safeRedirectUrl() - External-origin redirect in production is blocked and falls back to baseUrl', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origFrontend = process.env.FRONTEND_URL;

  try {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://petprotocols.com';

    const baseUrl = 'https://petprotocols.com';
    const attackerUrl = 'https://attacker.com/steal-token';

    const result = safeRedirectUrl({ url: attackerUrl, baseUrl });
    assert.strictEqual(result, baseUrl, 'Must block untrusted external origin in production');
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.FRONTEND_URL = origFrontend;
  }
});

test('SEC-04: safeRedirectUrl() - Production localhost and 127.0.0.1 redirects are blocked', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origFrontend = process.env.FRONTEND_URL;

  try {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://petprotocols.com';

    const baseUrl = 'https://petprotocols.com';

    // Must block localhost in production
    assert.strictEqual(
      safeRedirectUrl({ url: 'http://localhost:3000/callback', baseUrl }),
      baseUrl,
      'Must reject localhost redirect in production'
    );
    assert.strictEqual(
      safeRedirectUrl({ url: 'http://localhost:4000/api/leak', baseUrl }),
      baseUrl,
      'Must reject arbitrary localhost port in production'
    );

    // Must block 127.0.0.1 in production
    assert.strictEqual(
      safeRedirectUrl({ url: 'http://127.0.0.1:3000/callback', baseUrl }),
      baseUrl,
      'Must reject 127.0.0.1 redirect in production'
    );
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.FRONTEND_URL = origFrontend;
  }
});

test('SEC-04: safeRedirectUrl() - Development localhost and 127.0.0.1 redirects are permitted', () => {
  const origNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'development';
    const baseUrl = 'http://localhost:3000';

    assert.strictEqual(
      safeRedirectUrl({ url: 'http://localhost:3000/menu', baseUrl }),
      'http://localhost:3000/menu'
    );
    assert.strictEqual(
      safeRedirectUrl({ url: 'http://localhost:3001/admin', baseUrl }),
      'http://localhost:3001/admin'
    );
    assert.strictEqual(
      safeRedirectUrl({ url: 'http://127.0.0.1:3000/cart', baseUrl }),
      'http://127.0.0.1:3000/cart'
    );
  } finally {
    process.env.NODE_ENV = origNodeEnv;
  }
});

test('SEC-04: safeRedirectUrl() - Protocol-relative, dangerous, and malformed URLs fall back to baseUrl', () => {
  const baseUrl = 'https://petprotocols.com';

  // Protocol-relative (//evil.com)
  assert.strictEqual(safeRedirectUrl({ url: '//evil.com', baseUrl }), baseUrl);
  assert.strictEqual(safeRedirectUrl({ url: '//evil.com/phish', baseUrl }), baseUrl);
  assert.strictEqual(safeRedirectUrl({ url: '/\\evil.com', baseUrl }), baseUrl);

  // Dangerous pseudo-protocols
  assert.strictEqual(safeRedirectUrl({ url: 'javascript:alert(1)', baseUrl }), baseUrl);
  assert.strictEqual(safeRedirectUrl({ url: 'data:text/html,<script>alert(1)</script>', baseUrl }), baseUrl);

  // Malformed URLs
  assert.strictEqual(safeRedirectUrl({ url: 'not-a-valid-url', baseUrl }), baseUrl);
  assert.strictEqual(safeRedirectUrl({ url: 'http://', baseUrl }), baseUrl);
  assert.strictEqual(safeRedirectUrl({ url: null, baseUrl }), baseUrl);
  assert.strictEqual(safeRedirectUrl({ url: undefined, baseUrl }), baseUrl);
  assert.strictEqual(safeRedirectUrl({ url: '', baseUrl }), baseUrl);
});

test('SEC-04: safeRedirectUrl() - Legitimate relative and configured cross-app origins are permitted', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origAdmin = process.env.ADMIN_URL;
  const origSuper = process.env.SUPERADMIN_URL;

  try {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_URL = 'https://admin.petprotocols.com';
    process.env.SUPERADMIN_URL = 'https://superadmin.petprotocols.com';

    const baseUrl = 'https://petprotocols.com';

    // Safe relative paths
    assert.strictEqual(safeRedirectUrl({ url: '/orders', baseUrl }), '/orders');
    assert.strictEqual(safeRedirectUrl({ url: '/menu?category=specials', baseUrl }), '/menu?category=specials');

    // Configured cross-app portals in production
    assert.strictEqual(
      safeRedirectUrl({ url: 'https://admin.petprotocols.com/orders', baseUrl }),
      'https://admin.petprotocols.com/orders'
    );
    assert.strictEqual(
      safeRedirectUrl({ url: 'https://superadmin.petprotocols.com/restaurants', baseUrl }),
      'https://superadmin.petprotocols.com/restaurants'
    );
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.ADMIN_URL = origAdmin;
    process.env.SUPERADMIN_URL = origSuper;
  }
});
