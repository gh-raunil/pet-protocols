import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import https from 'node:https';

// Import unit under test
import {
  POST as pushTestHandler,
  _setTestSession,
  _setTestPushSender,
  _resetTestHooks,
} from '../app/api/push/test/route.js';

import {
  isRestrictedIp,
  isAllowedPushHostname,
  validatePushEndpoint,
  createSecurePushAgent,
  sanitizePushLog,
  _setTestDnsResolver,
  _resetTestDnsResolver,
} from '../lib/pushEndpointValidator.js';

import {
  checkPushTestRateLimit,
  resetRateLimit,
} from '../lib/rateLimit.js';

import {
  sendPushNotification,
} from '../lib/pushService.js';

import User from '../models/User.js';
import PushSubscription from '../models/PushSubscription.js';

// ==============================================================================
// Safe Test Environment Configuration & Mocking
// ==============================================================================
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mock_push_test_db';

global.mongoose = { conn: { readyState: 1 }, promise: Promise.resolve({ readyState: 1 }) };
if (!mongoose.connection) {
  mongoose.connection = {};
}
mongoose.connection.readyState = 1;

// In-memory mock stores for User and PushSubscription
const mockUsers = new Map();
const mockPushSubscriptions = new Map();

function seedMockUser(userData) {
  const user = {
    _id: userData._id || new mongoose.Types.ObjectId(),
    name: userData.name || 'Test User',
    email: (userData.email || 'user@example.com').toLowerCase().trim(),
    role: userData.role || 'customer',
    status: userData.status || 'active',
  };
  mockUsers.set(user.email, user);
  return user;
}

// Mock User.findOne
User.findOne = function (query) {
  let matched = null;
  if (query.email) {
    const qEmail = (typeof query.email === 'string' ? query.email : query.email?.toString?.() || '').toLowerCase().trim();
    matched = mockUsers.get(qEmail) || null;
  } else if (query._id) {
    for (const u of mockUsers.values()) {
      if (u._id.toString() === query._id.toString()) {
        matched = u;
        break;
      }
    }
  }

  return {
    select: () => Promise.resolve(matched),
    lean: () => Promise.resolve(matched),
    then: (resolve) => resolve(matched),
  };
};

User.findById = function (id) {
  let matched = null;
  for (const u of mockUsers.values()) {
    if (u._id.toString() === (id?.toString?.() || id)) {
      matched = u;
      break;
    }
  }
  return {
    select: () => Promise.resolve(matched),
    lean: () => Promise.resolve(matched),
    then: (resolve) => resolve(matched),
  };
};

// Mock PushSubscription
PushSubscription.findOne = function (query) {
  let matched = null;
  if (query.endpoint) {
    matched = mockPushSubscriptions.get(query.endpoint) || null;
  }
  return {
    select: () => Promise.resolve(matched),
    lean: () => Promise.resolve(matched),
    then: (resolve) => resolve(matched),
  };
};

PushSubscription.find = function (query) {
  const results = [];
  for (const sub of mockPushSubscriptions.values()) {
    if (query.user && sub.user?.toString() !== query.user?.toString()) continue;
    if (query.status && sub.status !== query.status) continue;
    results.push(sub);
  }
  return {
    select: () => Promise.resolve(results),
    lean: () => Promise.resolve(results),
    sort: () => ({ lean: () => Promise.resolve(results), then: (resolve) => resolve(results) }),
    then: (resolve) => resolve(results),
  };
};

PushSubscription.deleteOne = async function (query) {
  if (query.endpoint && mockPushSubscriptions.has(query.endpoint)) {
    mockPushSubscriptions.delete(query.endpoint);
    return { deletedCount: 1 };
  }
  return { deletedCount: 0 };
};

// Helper to create synthetic Request objects
function createMockRequest(body, headers = {}) {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return {
    headers: {
      get: (name) => headers[name.toLowerCase()] || headers[name] || null,
      ...headers,
    },
    json: async () => JSON.parse(bodyText),
    text: async () => bodyText,
  };
}

// ==============================================================================
// 1. IP Range & Address Classification Tests (SSRF Core)
// ==============================================================================

test('SSRF-IP: Loopback IPv4 addresses are strictly restricted', () => {
  assert.strictEqual(isRestrictedIp('127.0.0.1'), true);
  assert.strictEqual(isRestrictedIp('127.0.0.2'), true);
  assert.strictEqual(isRestrictedIp('127.1.2.3'), true);
  assert.strictEqual(isRestrictedIp('127.255.255.254'), true);
});

test('SSRF-IP: IPv4 Private Networks (RFC 1918) are strictly restricted', () => {
  // 10.0.0.0/8
  assert.strictEqual(isRestrictedIp('10.0.0.1'), true);
  assert.strictEqual(isRestrictedIp('10.254.254.254'), true);
  // 172.16.0.0/12
  assert.strictEqual(isRestrictedIp('172.16.0.1'), true);
  assert.strictEqual(isRestrictedIp('172.31.255.254'), true);
  // 192.168.0.0/16
  assert.strictEqual(isRestrictedIp('192.168.0.1'), true);
  assert.strictEqual(isRestrictedIp('192.168.1.100'), true);
});

test('SSRF-IP: Link-Local & Cloud Metadata (169.254.0.0/16) are strictly restricted', () => {
  assert.strictEqual(isRestrictedIp('169.254.169.254'), true, 'AWS/GCP/Azure metadata IP must be blocked');
  assert.strictEqual(isRestrictedIp('169.254.0.1'), true);
  assert.strictEqual(isRestrictedIp('169.254.255.254'), true);
});

test('SSRF-IP: Shared Address Space / CGNAT (100.64.0.0/10) is restricted', () => {
  assert.strictEqual(isRestrictedIp('100.64.0.1'), true);
  assert.strictEqual(isRestrictedIp('100.127.255.254'), true);
});

test('SSRF-IP: Multicast, Reserved, and Broadcast IPv4 addresses are restricted', () => {
  assert.strictEqual(isRestrictedIp('0.0.0.0'), true);
  assert.strictEqual(isRestrictedIp('224.0.0.1'), true);
  assert.strictEqual(isRestrictedIp('239.255.255.255'), true);
  assert.strictEqual(isRestrictedIp('240.0.0.1'), true);
  assert.strictEqual(isRestrictedIp('255.255.255.255'), true);
});

test('SSRF-IP: Loopback, Private, and Link-Local IPv6 addresses are strictly restricted', () => {
  assert.strictEqual(isRestrictedIp('::1'), true, 'IPv6 loopback');
  assert.strictEqual(isRestrictedIp('[::1]'), true, 'Bracketed IPv6 loopback');
  assert.strictEqual(isRestrictedIp('::'), true, 'IPv6 unspecified');
  assert.strictEqual(isRestrictedIp('fe80::1'), true, 'IPv6 link-local');
  assert.strictEqual(isRestrictedIp('fc00::1'), true, 'IPv6 unique local (ULA)');
  assert.strictEqual(isRestrictedIp('fd12:3456:789a::1'), true, 'IPv6 unique local (ULA)');
  assert.strictEqual(isRestrictedIp('ff02::1'), true, 'IPv6 multicast');
});

test('SSRF-IP: IPv4-Mapped IPv6 addresses unmap and enforce IPv4 restrictions', () => {
  assert.strictEqual(isRestrictedIp('::ffff:127.0.0.1'), true, 'IPv4-mapped loopback');
  assert.strictEqual(isRestrictedIp('::ffff:169.254.169.254'), true, 'IPv4-mapped metadata');
  assert.strictEqual(isRestrictedIp('::ffff:10.0.0.1'), true, 'IPv4-mapped private 10.x');
  assert.strictEqual(isRestrictedIp('::ffff:192.168.1.1'), true, 'IPv4-mapped private 192.168.x');
});

test('SSRF-IP: Legitimate public internet IP addresses are recognized as safe', () => {
  assert.strictEqual(isRestrictedIp('142.250.190.46'), false, 'Google public IP');
  assert.strictEqual(isRestrictedIp('17.248.190.253'), false, 'Apple public IP');
  assert.strictEqual(isRestrictedIp('34.107.221.82'), false, 'Mozilla autopush public IP');
  assert.strictEqual(isRestrictedIp('20.42.65.88'), false, 'Microsoft public IP');
  assert.strictEqual(isRestrictedIp('2607:f8b0:4005:809::200e'), false, 'Google public IPv6');
});

// ==============================================================================
// 2. Push Provider Hostname & URL Validation Policy Tests
// ==============================================================================

test('SSRF-URL: Standard legitimate browser push providers are allowed', () => {
  assert.strictEqual(isAllowedPushHostname('fcm.googleapis.com'), true);
  assert.strictEqual(isAllowedPushHostname('android.googleapis.com'), true);
  assert.strictEqual(isAllowedPushHostname('web.push.apple.com'), true);
  assert.strictEqual(isAllowedPushHostname('1-web.push.apple.com'), true);
  assert.strictEqual(isAllowedPushHostname('updates.push.services.mozilla.com'), true);
  assert.strictEqual(isAllowedPushHostname('wns2-bn1P.notify.windows.com'), true);
});

test('SSRF-URL: Arbitrary, internal, and deceptive hostnames are rejected', () => {
  assert.strictEqual(isAllowedPushHostname('localhost'), false);
  assert.strictEqual(isAllowedPushHostname('sub.localhost'), false);
  assert.strictEqual(isAllowedPushHostname('internal.corp'), false);
  assert.strictEqual(isAllowedPushHostname('metadata.google.internal'), false);
  assert.strictEqual(isAllowedPushHostname('instance-data'), false);
  assert.strictEqual(isAllowedPushHostname('127.0.0.1'), false);
  assert.strictEqual(isAllowedPushHostname('169.254.169.254'), false);
  // Regex evasion attempts (prefix/suffix tricks)
  assert.strictEqual(isAllowedPushHostname('fcm.googleapis.com.evil.com'), false);
  assert.strictEqual(isAllowedPushHostname('evil-fcm.googleapis.com'), false);
  assert.strictEqual(isAllowedPushHostname('push.apple.com.attacker.org'), false);
  assert.strictEqual(isAllowedPushHostname('attacker.com'), false);
});

test('SSRF-URL: Non-HTTPS protocols, malformed URLs, and non-443 ports are rejected', async () => {
  // Plain HTTP
  const httpRes = await validatePushEndpoint('http://fcm.googleapis.com/fcm/send/abc');
  assert.strictEqual(httpRes.valid, false);
  assert.match(httpRes.error, /https:/i);

  // File protocol
  const fileRes = await validatePushEndpoint('file:///etc/passwd');
  assert.strictEqual(fileRes.valid, false);

  // Non-standard port (4000, 80, 8080)
  const portRes1 = await validatePushEndpoint('https://fcm.googleapis.com:8080/fcm/send/abc');
  assert.strictEqual(portRes1.valid, false);
  assert.match(portRes1.error, /port/i);

  const portRes2 = await validatePushEndpoint('https://fcm.googleapis.com:4000/fcm/send/abc');
  assert.strictEqual(portRes2.valid, false);

  // Embedded credentials
  const credsRes = await validatePushEndpoint('https://admin:secret@fcm.googleapis.com/fcm/send/abc');
  assert.strictEqual(credsRes.valid, false);
  assert.match(credsRes.error, /credentials/i);

  // ASCII control characters
  const ctrlRes = await validatePushEndpoint('https://fcm.googleapis.com\r\n/fcm/send/abc');
  assert.strictEqual(ctrlRes.valid, false);
});

// ==============================================================================
// 3. DNS Resolution & Rebinding Protection Tests
// ==============================================================================

test('SSRF-DNS: Hostname resolving to loopback or private IP is blocked (DNS Rebinding)', async () => {
  // Mock DNS resolving to 127.0.0.1
  _setTestDnsResolver(async () => [{ address: '127.0.0.1', family: 4 }]);

  try {
    const res = await validatePushEndpoint('https://fcm.googleapis.com/fcm/send/test-sub');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /restricted\/internal IP/i);
  } finally {
    _resetTestDnsResolver();
  }
});

test('SSRF-DNS: Hostname resolving to AWS/GCP metadata IP (169.254.169.254) is blocked', async () => {
  _setTestDnsResolver(async () => [{ address: '169.254.169.254', family: 4 }]);

  try {
    const res = await validatePushEndpoint('https://fcm.googleapis.com/fcm/send/test-sub');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /restricted\/internal IP/i);
  } finally {
    _resetTestDnsResolver();
  }
});

test('SSRF-DNS: Multiple IP resolution where one IP is private is blocked', async () => {
  _setTestDnsResolver(async () => [
    { address: '142.250.190.46', family: 4 },
    { address: '10.0.0.1', family: 4 },
  ]);

  try {
    const res = await validatePushEndpoint('https://fcm.googleapis.com/fcm/send/test-sub');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /restricted\/internal IP/i);
  } finally {
    _resetTestDnsResolver();
  }
});

test('SSRF-AGENT: createSecurePushAgent() blocks socket connection if DNS resolves to restricted IP', async () => {
  _setTestDnsResolver(async () => [{ address: '127.0.0.1', family: 4 }]);

  try {
    const agent = createSecurePushAgent();
    assert.ok(agent instanceof https.Agent);

    await new Promise((resolve) => {
      agent.options.lookup('fcm.googleapis.com', {}, (err) => {
        assert.ok(err, 'Expected error from secure agent lookup');
        assert.match(err.message, /SSRF Blocked/i);
        resolve();
      });
    });
  } finally {
    _resetTestDnsResolver();
  }
});

// ==============================================================================
// 4. API Route Authentication & Authorization Tests (/api/push/test)
// ==============================================================================

test('AUTH: Unauthenticated caller is rejected with 401 even when subscription payload is present', async () => {
  _resetTestHooks();
  _setTestSession(null); // No session

  const maliciousBody = {
    subscription: {
      endpoint: 'http://169.254.169.254/latest/meta-data/',
      keys: { p256dh: 'fake_key', auth: 'fake_auth' },
    },
  };

  const req = createMockRequest(maliciousBody);
  const response = await pushTestHandler(req);

  assert.strictEqual(response.status, 401);
  const data = await response.json();
  assert.strictEqual(data.success, false);
  assert.match(data.message, /Authentication required/i);
});

test('AUTH: Suspended or inactive account is rejected with 403', async () => {
  _resetTestHooks();
  const suspendedUser = seedMockUser({
    email: 'suspended@petprotocols.com',
    status: 'suspended',
    role: 'customer',
  });

  _setTestSession({ user: { email: suspendedUser.email } });

  const req = createMockRequest({});
  const response = await pushTestHandler(req);

  assert.strictEqual(response.status, 403);
  const data = await response.json();
  assert.strictEqual(data.success, false);
  assert.match(data.message, /suspended/i);
});

test('AUTH: Unauthorized role is rejected with 403', async () => {
  _resetTestHooks();
  const unauthorizedUser = seedMockUser({
    email: 'hacker@example.com',
    status: 'active',
    role: 'unauthorized_role',
  });

  _setTestSession({ user: { email: unauthorizedUser.email } });

  const req = createMockRequest({});
  const response = await pushTestHandler(req);

  assert.strictEqual(response.status, 403);
  const data = await response.json();
  assert.strictEqual(data.success, false);
  assert.match(data.message, /unauthorized/i);
});

// ==============================================================================
// 5. SSRF Endpoint Rejection via /api/push/test Handler
// ==============================================================================

test('SSRF-ROUTE: Authenticated request targeting localhost is rejected with 400', async () => {
  _resetTestHooks();
  const activeUser = seedMockUser({ email: 'user1@petprotocols.com', status: 'active', role: 'customer' });
  _setTestSession({ user: { email: activeUser.email } });

  const attackBody = {
    subscription: {
      endpoint: 'https://127.0.0.1:4000/api/admin/secrets',
      keys: { p256dh: 'dummyKey', auth: 'dummyAuth' },
    },
  };

  const req = createMockRequest(attackBody);
  const response = await pushTestHandler(req);

  assert.strictEqual(response.status, 400);
  const data = await response.json();
  assert.strictEqual(data.success, false);
  assert.match(data.message, /Invalid push subscription endpoint/i);
});

test('SSRF-ROUTE: Authenticated request targeting AWS/GCP metadata service is rejected with 400', async () => {
  _resetTestHooks();
  const activeUser = seedMockUser({ email: 'user2@petprotocols.com', status: 'active', role: 'customer' });
  _setTestSession({ user: { email: activeUser.email } });

  const attackBody = {
    subscription: {
      endpoint: 'https://169.254.169.254/computeMetadata/v1/',
      keys: { p256dh: 'dummyKey', auth: 'dummyAuth' },
    },
  };

  const req = createMockRequest(attackBody);
  const response = await pushTestHandler(req);

  assert.strictEqual(response.status, 400);
  const data = await response.json();
  assert.strictEqual(data.success, false);
  assert.match(data.message, /Invalid push subscription endpoint/i);
});

test('SSRF-ROUTE: Authenticated request targeting external unapproved host is rejected with 400', async () => {
  _resetTestHooks();
  const activeUser = seedMockUser({ email: 'user3@petprotocols.com', status: 'active', role: 'customer' });
  _setTestSession({ user: { email: activeUser.email } });

  const attackBody = {
    subscription: {
      endpoint: 'https://attacker-c2.evil.com/webhook',
      keys: { p256dh: 'dummyKey', auth: 'dummyAuth' },
    },
  };

  const req = createMockRequest(attackBody);
  const response = await pushTestHandler(req);

  assert.strictEqual(response.status, 400);
  const data = await response.json();
  assert.strictEqual(data.success, false);
  assert.match(data.message, /not a recognized or trusted Web Push provider/i);
});

// ==============================================================================
// 6. Multi-Tenant Cross-User Push Subscription Protection
// ==============================================================================

test('TENANT: User cannot trigger push to an endpoint registered to a different account', async () => {
  _resetTestHooks();
  const victimUser = seedMockUser({ email: 'victim@petprotocols.com', status: 'active', role: 'customer' });
  const attackerUser = seedMockUser({ email: 'attacker@petprotocols.com', status: 'active', role: 'customer' });

  const victimEndpoint = 'https://fcm.googleapis.com/fcm/send/victim-device-token';
  mockPushSubscriptions.set(victimEndpoint, {
    endpoint: victimEndpoint,
    user: victimUser._id,
    status: 'active',
  });

  _setTestSession({ user: { email: attackerUser.email } });

  // Mock DNS to return public IP so endpoint validation passes
  _setTestDnsResolver(async () => [{ address: '142.250.190.46', family: 4 }]);

  try {
    const req = createMockRequest({
      subscription: {
        endpoint: victimEndpoint,
        keys: { p256dh: 'mockKey', auth: 'mockAuth' },
      },
    });

    const response = await pushTestHandler(req);
    assert.strictEqual(response.status, 403);
    const data = await response.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /belongs to another user account/i);
  } finally {
    _resetTestDnsResolver();
  }
});

// ==============================================================================
// 7. Rate Limiting Tests
// ==============================================================================

test('RATE-LIMIT: Exceeding test push requests per minute triggers 429 Too Many Requests', async () => {
  _resetTestHooks();
  const testUser = seedMockUser({ email: 'ratelimit@petprotocols.com', status: 'active', role: 'customer' });
  _setTestSession({ user: { email: testUser.email } });

  resetRateLimit(`push_test:user:${testUser._id}`);

  // Mock sender so successful dispatches don't make network calls
  _setTestPushSender(async () => ({ success: true, sentCount: 1 }));

  // First 5 requests should pass
  for (let i = 0; i < 5; i++) {
    const req = createMockRequest({});
    const res = await pushTestHandler(req);
    assert.strictEqual(res.status, 200, `Request ${i + 1} should succeed`);
  }

  // 6th request within window must be rate limited (429)
  const req6 = createMockRequest({});
  const res6 = await pushTestHandler(req6);
  assert.strictEqual(res6.status, 429, '6th request should be rate limited');

  const data6 = await res6.json();
  assert.strictEqual(data6.success, false);
  assert.match(data6.message, /Rate limit exceeded/i);
  assert.ok(res6.headers.get('Retry-After'), 'Retry-After header must be set');
});

// ==============================================================================
// 8. Legitimate Test Push Delivery (Mocked Happy Path)
// ==============================================================================

test('LEGITIMATE: Authorized customer test push to valid endpoint succeeds', async () => {
  _resetTestHooks();
  const customer = seedMockUser({ email: 'goodcustomer@petprotocols.com', status: 'active', role: 'customer' });
  _setTestSession({ user: { email: customer.email } });

  _setTestDnsResolver(async () => [{ address: '142.250.190.46', family: 4 }]);

  let sentPayload = null;
  _setTestPushSender(async (sub, payload, options) => {
    sentPayload = { sub, payload, options };
    return { success: true };
  });

  try {
    const validEndpoint = 'https://fcm.googleapis.com/fcm/send/my-legitimate-device';
    const req = createMockRequest({
      subscription: {
        endpoint: validEndpoint,
        keys: { p256dh: 'sample_p256dh_key', auth: 'sample_auth_secret' },
      },
    });

    const response = await pushTestHandler(req);
    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.match(data.message, /successfully/i);

    // Verify timeout was passed to push client
    assert.ok(sentPayload);
    assert.strictEqual(sentPayload.options.timeout, 8000, 'Push client must enforce timeout');
  } finally {
    _resetTestDnsResolver();
  }
});

test('LEGITIMATE: Authorized user with active devices in DB dispatches push to their devices', async () => {
  _resetTestHooks();
  const customer = seedMockUser({ email: 'multidevice@petprotocols.com', status: 'active', role: 'customer' });
  _setTestSession({ user: { email: customer.email } });

  const deviceEndpoint = 'https://web.push.apple.com/my-device-sub';
  mockPushSubscriptions.set(deviceEndpoint, {
    endpoint: deviceEndpoint,
    user: customer._id,
    status: 'active',
  });

  _setTestPushSender(async (userObj, payload) => {
    return { success: true, sentCount: 1 };
  });

  const req = createMockRequest({}); // No direct subscription in body
  const response = await pushTestHandler(req);

  assert.strictEqual(response.status, 200);
  const data = await response.json();
  assert.strictEqual(data.success, true);
  assert.match(data.message, /1 active device/i);
});

// ==============================================================================
// 9. Data Hygiene & Sensitive Logging Protection
// ==============================================================================

test('HYGIENE: sanitizePushLog scrubs URL query parameters and full tokens', () => {
  const secretEndpoint = 'https://fcm.googleapis.com/fcm/send/secret_device_token_xyz123?auth_token=super_secret';
  const sanitized = sanitizePushLog(secretEndpoint);

  assert.strictEqual(sanitized.includes('super_secret'), false, 'Query secret must not be in sanitized log');
  assert.strictEqual(sanitized.includes('xyz123'), false, 'Full token must not be in sanitized log');
  assert.strictEqual(sanitized.startsWith('https://fcm.googleapis.com'), true);
});

// ==============================================================================
// 10. Redirect Protection Tests
// ==============================================================================

test('REDIRECT: Redirect target pointing to restricted destination is blocked', async () => {
  // If an outbound request or redirect returns a 301/302 to cloud metadata or internal port
  const blockedRedirectTargets = [
    'http://169.254.169.254/latest/meta-data/',
    'https://127.0.0.1:4000/api/admin/secrets',
    'https://metadata.google.internal/computeMetadata/v1/',
    'http://10.0.0.1/admin',
  ];

  for (const target of blockedRedirectTargets) {
    const val = await validatePushEndpoint(target);
    assert.strictEqual(val.valid, false, `Redirect target '${target}' must be rejected by validator`);
  }
});

// ==============================================================================
// 11. Subscription Registration SSRF Protection (/api/push/subscribe)
// ==============================================================================

test('SUBSCRIBE: Registration route rejects internal or metadata endpoints with 400', async () => {
  const { POST: subscribeHandler } = await import('../app/api/push/subscribe/route.js');

  const attackPayloads = [
    { endpoint: 'http://169.254.169.254/latest/meta-data', keys: { p256dh: 'k', auth: 'a' } },
    { endpoint: 'https://127.0.0.1:4000/internal', keys: { p256dh: 'k', auth: 'a' } },
    { endpoint: 'https://attacker-domain.org/push', keys: { p256dh: 'k', auth: 'a' } },
  ];

  for (const sub of attackPayloads) {
    const req = createMockRequest({ subscription: sub });
    const res = await subscribeHandler(req);
    assert.strictEqual(res.status, 400, `Expected 400 rejection for endpoint ${sub.endpoint}`);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /Invalid push subscription endpoint/i);
  }
});

// ==============================================================================
// 12. Defense-in-Depth in sendPushNotification
// ==============================================================================

test('DEFENSE-IN-DEPTH: sendPushNotification directly rejects unsafe endpoints without sending', async () => {
  const result = await sendPushNotification(
    {
      endpoint: 'https://169.254.169.254/latest/meta-data',
      keys: { p256dh: 'testKey', auth: 'testAuth' },
    },
    { test: true }
  );

  assert.strictEqual(result.success, false);
  assert.match(result.reason, /Unsafe push endpoint/i);
});
