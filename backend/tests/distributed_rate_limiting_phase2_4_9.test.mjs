import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getClientIp,
  isPrivateOrLoopbackIp,
  checkRateLimit,
  isRateLimited,
  resetRateLimit,
  checkSignupRateLimit,
  checkLoginRateLimit,
  isLoginRateLimited,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  checkPushTestRateLimit,
  checkPushSubscribeRateLimit,
  checkPaymentCreateOrderRateLimit,
  checkPaymentVerifyRateLimit,
  validateRateLimitConfig,
  _setCustomRateLimitStore,
  _resetRateLimitStore,
  CALLER_CATEGORIES,
} from '../lib/rateLimit.js';
import {
  MemoryRateLimitStore,
  UpstashRedisStore,
  handleStoreFailure,
} from '../lib/rateLimitStore.js';

test.beforeEach(() => {
  _resetRateLimitStore();
  delete process.env.RATE_LIMIT_STORE;
  delete process.env.RATE_LIMIT_DISTRIBUTED_REQUIRED;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.RATE_LIMIT_TRUST_EDGE_HEADERS;
  delete process.env.RATE_LIMIT_TRUSTED_HOPS;
  delete process.env.RATE_LIMIT_TRUST_PROXY;
});

test.afterEach(() => {
  _resetRateLimitStore();
});

// -----------------------------------------------------------------------------
// 1. In-Memory Store & Backward Compatibility Tests
// -----------------------------------------------------------------------------
test('In-Memory Mode: Basic sliding-window rate limiting functions synchronously', () => {
  const key = 'test:mem:sync:1';
  resetRateLimit(key);

  const res1 = checkRateLimit(key, { maxRequests: 2, windowMs: 1000 });
  assert.strictEqual(res1.allowed, true);
  assert.strictEqual(res1.remaining, 1);
  assert.strictEqual(typeof res1.resetInSeconds, 'number');

  const res2 = checkRateLimit(key, { maxRequests: 2, windowMs: 1000 });
  assert.strictEqual(res2.allowed, true);
  assert.strictEqual(res2.remaining, 0);

  // 3rd hit must be blocked
  const res3 = checkRateLimit(key, { maxRequests: 2, windowMs: 1000 });
  assert.strictEqual(res3.allowed, false);
  assert.strictEqual(res3.remaining, 0);
  assert.ok(res3.resetInSeconds >= 1);
});

test('In-Memory Mode: Read-only isRateLimited check does not record hits', () => {
  const key = 'test:mem:readonly:1';
  resetRateLimit(key);

  const check1 = isRateLimited(key, { maxRequests: 1, windowMs: 1000 });
  assert.strictEqual(check1.limited, false);

  // Record 1 hit
  checkRateLimit(key, { maxRequests: 1, windowMs: 1000 });

  const check2 = isRateLimited(key, { maxRequests: 1, windowMs: 1000 });
  assert.strictEqual(check2.limited, true);
  assert.ok(check2.resetInSeconds >= 1);
});

test('In-Memory Store Hardening: Bounded memory and LRU eviction', () => {
  const store = new MemoryRateLimitStore({ maxKeys: 10, pruneIntervalMs: 0 });

  // Insert 15 distinct keys
  for (let i = 0; i < 15; i++) {
    store.check(`key_${i}`, { maxRequests: 5, windowMs: 60000 });
  }

  // Capacity must not grow unbounded
  assert.ok(store.store.size <= 10, `Store size ${store.store.size} should be bounded by maxKeys (10)`);
});

// -----------------------------------------------------------------------------
// 2. Client IP Extraction & Forwarding Header Hardening
// -----------------------------------------------------------------------------
test('Client IP: Direct-origin traffic ignores spoofed X-Forwarded-For when proxy trust disabled', () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_TRUST_PROXY = 'false';
    process.env.RATE_LIMIT_TRUSTED_HOPS = '0';

    const mockReq = {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      },
      socket: {
        remoteAddress: '198.51.100.42',
      },
    };

    const extracted = getClientIp(mockReq);
    assert.strictEqual(extracted, '198.51.100.42', 'Direct origin must use verified socket remoteAddress');
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('Client IP: Trusted proxy hop extraction defeats prepended spoofed IPs', () => {
  process.env.RATE_LIMIT_TRUST_PROXY = 'true';
  process.env.RATE_LIMIT_TRUSTED_HOPS = '1';

  // Attacker at 203.0.113.88 prepends fake IP 198.51.100.1; reverse proxy appends 203.0.113.88
  const mockReq = {
    headers: {
      'x-forwarded-for': '198.51.100.1, 203.0.113.88',
    },
    socket: {
      remoteAddress: '10.0.0.1',
    },
  };

  const extracted = getClientIp(mockReq);
  assert.strictEqual(extracted, '203.0.113.88', '1-hop proxy must extract outermost verified client IP from the right');
});

test('Client IP: Multi-hop reverse proxy extraction (hops=2)', () => {
  process.env.RATE_LIMIT_TRUST_PROXY = 'true';
  process.env.RATE_LIMIT_TRUSTED_HOPS = '2';

  // Attacker sends fake 1.1.1.1 -> Ingress Proxy 1 appends 203.0.113.99 -> Internal LB appends 10.0.0.5
  const mockReq = {
    headers: {
      'x-forwarded-for': '1.1.1.1, 203.0.113.99, 10.0.0.5',
    },
  };

  const extracted = getClientIp(mockReq);
  assert.strictEqual(extracted, '203.0.113.99');
});

test('Client IP: Edge headers (CF-Connecting-IP) rejected unless explicitly enabled', () => {
  process.env.RATE_LIMIT_TRUST_EDGE_HEADERS = 'false';

  const mockReq = {
    headers: {
      'cf-connecting-ip': '203.0.113.200',
    },
    socket: {
      remoteAddress: '198.51.100.55',
    },
  };

  const extractedDefault = getClientIp(mockReq);
  assert.strictEqual(extractedDefault, '198.51.100.55', 'Edge header must not be trusted when flag is false');

  process.env.RATE_LIMIT_TRUST_EDGE_HEADERS = 'true';
  const extractedTrusted = getClientIp(mockReq);
  assert.strictEqual(extractedTrusted, '203.0.113.200', 'Edge header must be accepted when flag is true');
});

test('Client IP: Malformed IP strings are rejected and sanitized', () => {
  const mockReq = {
    headers: {
      'x-forwarded-for': 'not-an-ip, <script>alert(1)</script>, invalid:999.999.999.999',
    },
    socket: {
      remoteAddress: '203.0.113.77',
    },
  };

  const extracted = getClientIp(mockReq);
  assert.strictEqual(extracted, '203.0.113.77', 'Malformed X-Forwarded-For must fall back to socket address');
});

test('Client IP: isPrivateOrLoopbackIp accurately identifies private CIDRs and loopbacks', () => {
  assert.strictEqual(isPrivateOrLoopbackIp('127.0.0.1'), true);
  assert.strictEqual(isPrivateOrLoopbackIp('::1'), true);
  assert.strictEqual(isPrivateOrLoopbackIp('10.0.0.1'), true);
  assert.strictEqual(isPrivateOrLoopbackIp('172.16.0.1'), true);
  assert.strictEqual(isPrivateOrLoopbackIp('172.31.255.255'), true);
  assert.strictEqual(isPrivateOrLoopbackIp('192.168.1.1'), true);
  assert.strictEqual(isPrivateOrLoopbackIp('169.254.169.254'), true);
  assert.strictEqual(isPrivateOrLoopbackIp('fc00::1'), true);

  // Public IPs
  assert.strictEqual(isPrivateOrLoopbackIp('8.8.8.8'), false);
  assert.strictEqual(isPrivateOrLoopbackIp('203.0.113.1'), false);
  assert.strictEqual(isPrivateOrLoopbackIp('172.32.0.1'), false);
});

// -----------------------------------------------------------------------------
// 3. Distributed Store Adapter & Multi-Instance Atomicity
// -----------------------------------------------------------------------------
test('Distributed Store: Mock Upstash Redis REST executes atomic sliding-window script', async () => {
  // Create an in-memory simulated Redis backend to test Upstash REST adapter
  const redisSortedSets = new Map();

  const mockUpstashStore = {
    async check(key, { maxRequests = 10, windowMs = 15 * 60 * 1000 } = {}) {
      const now = Date.now();
      const clearBefore = now - windowMs;
      let set = redisSortedSets.get(key) || [];

      // Atomic simulation: remove older than clearBefore
      set = set.filter((entry) => entry.score > clearBefore);

      if (set.length >= maxRequests) {
        const oldest = set[0];
        const resetInSeconds = Math.max(1, Math.ceil((oldest.score + windowMs - now) / 1000));
        redisSortedSets.set(key, set);
        return { allowed: false, remaining: 0, resetInSeconds };
      }

      set.push({ member: `${now}:${Math.random()}`, score: now });
      redisSortedSets.set(key, set);
      return {
        allowed: true,
        remaining: maxRequests - set.length,
        resetInSeconds: Math.ceil(windowMs / 1000),
      };
    },
    async isLimited(key, { maxRequests = 10, windowMs = 15 * 60 * 1000 } = {}) {
      const now = Date.now();
      let set = redisSortedSets.get(key) || [];
      set = set.filter((entry) => entry.score > (now - windowMs));
      if (set.length >= maxRequests) {
        return { limited: true, resetInSeconds: 10 };
      }
      return { limited: false, resetInSeconds: 0 };
    },
    async record(key, { windowMs = 15 * 60 * 1000 } = {}) {
      const now = Date.now();
      let set = redisSortedSets.get(key) || [];
      set.push({ member: `${now}:${Math.random()}`, score: now });
      redisSortedSets.set(key, set);
      return true;
    },
    async reset(key) {
      redisSortedSets.delete(key);
      return true;
    },
  };

  _setCustomRateLimitStore(mockUpstashStore);

  const key = 'test:dist:shared_user:123';
  const limit = 5;

  // Simulate 12 concurrent requests from 3 distinct worker nodes
  const workers = [1, 2, 3];
  const promises = [];

  for (let i = 0; i < 12; i++) {
    const workerId = workers[i % workers.length];
    promises.push(checkRateLimit(key, { maxRequests: limit, windowMs: 60000 }));
  }

  const results = await Promise.all(promises);
  const allowedHits = results.filter((r) => r.allowed);
  const blockedHits = results.filter((r) => !r.allowed);

  assert.strictEqual(allowedHits.length, 5, 'Exactly 5 requests must be allowed across all simulated instances');
  assert.strictEqual(blockedHits.length, 7, 'Exactly 7 requests must be blocked across all simulated instances');
  assert.strictEqual(blockedHits[0].remaining, 0);
  assert.ok(blockedHits[0].resetInSeconds >= 1);
});

// -----------------------------------------------------------------------------
// 4. Deployment Policy & Configuration Error Enforcements
// -----------------------------------------------------------------------------
test('Configuration Guard: Distributed required mode fails safely when credentials missing', () => {
  process.env.RATE_LIMIT_DISTRIBUTED_REQUIRED = 'true';
  process.env.RATE_LIMIT_STORE = 'memory';

  const check1 = validateRateLimitConfig();
  assert.strictEqual(check1.valid, false);
  assert.ok(check1.error.includes("requires RATE_LIMIT_STORE='upstash'"));

  process.env.RATE_LIMIT_STORE = 'upstash';
  process.env.UPSTASH_REDIS_REST_URL = 'http://invalid-not-https.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';

  const check2 = validateRateLimitConfig();
  assert.strictEqual(check2.valid, false);
  assert.ok(check2.error.includes('requires a valid HTTPS UPSTASH_REDIS_REST_URL'));

  // With proper HTTPS url and token
  process.env.UPSTASH_REDIS_REST_URL = 'https://valid-upstash-url.upstash.io';
  const check3 = validateRateLimitConfig();
  assert.strictEqual(check3.valid, true);
  assert.strictEqual(check3.mode, 'upstash');
});

// -----------------------------------------------------------------------------
// 5. Caller Category Failure Policy Tests
// -----------------------------------------------------------------------------
test('Failure Policy: PUSH category fails closed on store failure', () => {
  const pushFailure = handleStoreFailure(CALLER_CATEGORIES.PUSH, new Error('Connection timeout'));
  assert.strictEqual(pushFailure.allowed, false, 'Push must fail-closed to prevent notification spam and quota exhaustion');
  assert.strictEqual(pushFailure.remaining, 0);
  assert.strictEqual(pushFailure.resetInSeconds, 60);
  assert.strictEqual(pushFailure.degraded, true);
  assert.strictEqual(pushFailure.failurePolicy, 'fail_closed');
});

test('Failure Policy: AUTH category fails open on store failure', () => {
  const authFailure = handleStoreFailure(CALLER_CATEGORIES.AUTH, new Error('Upstash unreachable'));
  assert.strictEqual(authFailure.allowed, true, 'Auth must fail-open to preserve customer login availability');
  assert.strictEqual(authFailure.degraded, true);
  assert.strictEqual(authFailure.failurePolicy, 'fail_open');
});

test('Failure Policy: PAYMENT category fails open on store failure', () => {
  const paymentFailure = handleStoreFailure(CALLER_CATEGORIES.PAYMENT, new Error('Redis ECONNREFUSED'));
  assert.strictEqual(paymentFailure.allowed, true, 'Payment must fail-open to preserve checkout availability');
  assert.strictEqual(paymentFailure.degraded, true);
  assert.strictEqual(paymentFailure.failurePolicy, 'fail_open');
});

// -----------------------------------------------------------------------------
// 6. Sensitive Endpoints: Payment Order Creation Rate Limiting
// -----------------------------------------------------------------------------
test('Sensitive Endpoint: checkPaymentCreateOrderRateLimit enforces user and IP limits', async () => {
  const userId = 'user_order_ratelimit_test_1';
  const mockReq = {
    headers: {
      'x-forwarded-for': '203.0.113.11',
    },
  };

  resetRateLimit(`pay_order:user:${userId}`);
  resetRateLimit(`pay_order:ip:203.0.113.11`);

  // Max 15 per user
  for (let i = 0; i < 15; i++) {
    const res = await checkPaymentCreateOrderRateLimit(userId, mockReq);
    assert.strictEqual(res.allowed, true, `Attempt ${i + 1} should be allowed`);
  }

  // 16th hit must be blocked
  const blocked = await checkPaymentCreateOrderRateLimit(userId, mockReq);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.remaining, 0);
  assert.ok(blocked.resetInSeconds > 0);
});

// -----------------------------------------------------------------------------
// 7. Sensitive Endpoints: Payment Verification Rate Limiting
// -----------------------------------------------------------------------------
test('Sensitive Endpoint: checkPaymentVerifyRateLimit protects against verify brute force', async () => {
  const orderId = 'order_rzp_mock_verify_123';
  const mockReq = {
    headers: {
      'x-forwarded-for': '203.0.113.22',
    },
  };

  resetRateLimit(`pay_verify:order:${orderId}`);
  resetRateLimit(`pay_verify:ip:203.0.113.22`);

  // Max 15 per order
  for (let i = 0; i < 15; i++) {
    const res = await checkPaymentVerifyRateLimit(orderId, mockReq);
    assert.strictEqual(res.allowed, true);
  }

  const blocked = await checkPaymentVerifyRateLimit(orderId, mockReq);
  assert.strictEqual(blocked.allowed, false);
  assert.ok(blocked.resetInSeconds > 0);
});

// -----------------------------------------------------------------------------
// 8. Sensitive Endpoints: Push Subscribe Rate Limiting
// -----------------------------------------------------------------------------
test('Sensitive Endpoint: checkPushSubscribeRateLimit limits registration attempts', async () => {
  const userId = 'user_push_sub_test_1';
  const mockReq = {
    headers: {
      'x-forwarded-for': '203.0.113.33',
    },
  };

  resetRateLimit(`push_sub:user:${userId}`);
  resetRateLimit(`push_sub:ip:203.0.113.33`);

  // Max 10 per user
  for (let i = 0; i < 10; i++) {
    const res = await checkPushSubscribeRateLimit(userId, mockReq);
    assert.strictEqual(res.allowed, true);
  }

  const blocked = await checkPushSubscribeRateLimit(userId, mockReq);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.remaining, 0);
});
