/**
 * Distributed Rate Limiting & Client Identity Extraction Module
 *
 * Implements:
 * 1. Hardened client IP extraction with proxy hop verification and edge trust controls.
 * 2. Pluggable store integration (MemoryStore for local dev / single process; Upstash Redis REST for distributed/serverless).
 * 3. Categorized failure policies (Fail-open for Auth & Payments; Fail-closed for Web Push).
 * 4. Dedicated rate limiters for Sign-up, Login, Push-Test, Push-Subscribe, Payment Create-Order, and Payment Verify.
 */

import net from 'net';
import {
  getRateLimitStore,
  CALLER_CATEGORIES,
  handleStoreFailure,
  MemoryRateLimitStore,
  validateRateLimitConfig,
  _setCustomRateLimitStore,
  _resetRateLimitStore,
} from './rateLimitStore.js';

// Re-export configuration and testing utilities
export {
  validateRateLimitConfig,
  _setCustomRateLimitStore,
  _resetRateLimitStore,
  CALLER_CATEGORIES,
};

/**
 * Checks whether an IP address is a private, loopback, or link-local address.
 * Used during right-to-left X-Forwarded-For evaluation to skip trusted reverse proxy hops.
 *
 * @param {string} ip
 * @returns {boolean}
 */
export function isPrivateOrLoopbackIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim().replace(/^::ffff:/, '');

  if (trimmed === '::1' || trimmed === 'localhost' || trimmed === '127.0.0.1') return true;
  if (trimmed.startsWith('10.') || trimmed.startsWith('192.168.') || trimmed.startsWith('169.254.')) return true;
  if (trimmed.startsWith('127.')) return true;

  const match172 = trimmed.match(/^172\.(\d+)\./);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  const lower = trimmed.toLowerCase();
  if (lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) return true;

  return false;
}

/**
 * Safely extracts client IP from incoming request headers or socket address.
 * Never trusts arbitrary client-supplied leftmost X-Forwarded-For headers by default.
 *
 * Proxy Trust Policy:
 * 1. If RATE_LIMIT_TRUST_EDGE_HEADERS === 'true', verifies and accepts CF-Connecting-IP or X-Real-IP.
 * 2. If RATE_LIMIT_TRUSTED_HOPS is set (>0), extracts client IP from the right (ips.length - hops).
 * 3. If RATE_LIMIT_TRUST_PROXY === 'true' (or non-production default), walks from right skipping private proxy hops.
 * 4. In untrusted direct-origin mode, rejects forwarding headers and uses verified socket remote address.
 *
 * @param {Request|object} request
 * @returns {string}
 */
export function getClientIp(request) {
  if (!request) return '127.0.0.1';

  try {
    const headers = request.headers;
    const getHeader = (name) => {
      if (!headers) return null;
      if (typeof headers.get === 'function') {
        return headers.get(name);
      }
      return headers[name.toLowerCase()] || headers[name] || null;
    };

    // 1. Authoritative Edge / CDN headers (In production, requires RATE_LIMIT_TRUST_EDGE_HEADERS === 'true')
    const trustEdge =
      process.env.RATE_LIMIT_TRUST_EDGE_HEADERS === 'true' ||
      (process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_TRUST_EDGE_HEADERS !== 'false');
    if (trustEdge) {
      const cfConnectingIp = getHeader('cf-connecting-ip');
      if (cfConnectingIp && typeof cfConnectingIp === 'string') {
        const trimmed = cfConnectingIp.trim();
        if (net.isIP(trimmed)) return trimmed;
      }

      const xRealIp = getHeader('x-real-ip');
      if (xRealIp && typeof xRealIp === 'string') {
        const trimmed = xRealIp.trim();
        if (net.isIP(trimmed)) return trimmed;
      }
    }

    // 2. X-Forwarded-For Header Processing
    const xForwardedFor = getHeader('x-forwarded-for');
    if (xForwardedFor && typeof xForwardedFor === 'string') {
      const rawIps = xForwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean);
      const validIps = rawIps.filter((ip) => net.isIP(ip));

      if (validIps.length > 0) {
        const trustedHops = parseInt(process.env.RATE_LIMIT_TRUSTED_HOPS || '0', 10);
        const trustProxy =
          process.env.RATE_LIMIT_TRUST_PROXY === 'true' ||
          trustedHops > 0 ||
          process.env.NODE_ENV !== 'production';

        if (trustProxy) {
          if (trustedHops > 0) {
            const targetIndex = validIps.length - trustedHops;
            if (targetIndex >= 0) {
              return validIps[targetIndex];
            }
            return validIps[0];
          }

          // Dynamic Right-to-Left Traversal: Skip trusted private proxies to find outermost client IP
          for (let i = validIps.length - 1; i >= 0; i--) {
            if (!isPrivateOrLoopbackIp(validIps[i])) {
              return validIps[i];
            }
          }

          // If all entries are private/loopback, return the first entry
          return validIps[0];
        }
      }
    }

    // 3. Direct Socket Remote Address Fallback
    const socketAddress = request.socket?.remoteAddress || request.connection?.remoteAddress;
    if (socketAddress && typeof socketAddress === 'string') {
      const cleaned = socketAddress.replace(/^::ffff:/, '').trim();
      if (net.isIP(cleaned)) {
        return cleaned;
      }
    }
  } catch (_) {}

  return '127.0.0.1';
}

/**
 * Checks and records a rate limit hit using sliding-window algorithm.
 * Supports both synchronous MemoryStore and asynchronous Upstash Redis Store.
 *
 * @param {string} key Unique identifier
 * @param {object} options
 * @param {number} options.maxRequests
 * @param {number} options.windowMs
 * @param {string} options.category 'auth' | 'payment' | 'push'
 * @returns {{ allowed: boolean, remaining: number, resetInSeconds: number } | Promise<{ allowed: boolean, remaining: number, resetInSeconds: number }>}
 */
export function checkRateLimit(key, options = {}) {
  const store = getRateLimitStore();
  const category = options.category || CALLER_CATEGORIES.AUTH;

  if (store instanceof MemoryRateLimitStore) {
    try {
      return store.check(key, options);
    } catch (err) {
      return handleStoreFailure(category, err);
    }
  }

  return (async () => {
    try {
      return await store.check(key, options);
    } catch (err) {
      return handleStoreFailure(category, err);
    }
  })();
}

/**
 * Checks whether a key is currently rate-limited WITHOUT recording an attempt.
 *
 * @param {string} key
 * @param {object} options
 * @returns {{ limited: boolean, resetInSeconds: number } | Promise<{ limited: boolean, resetInSeconds: number }>}
 */
export function isRateLimited(key, options = {}) {
  const store = getRateLimitStore();
  const category = options.category || CALLER_CATEGORIES.AUTH;

  if (store instanceof MemoryRateLimitStore) {
    try {
      return store.isLimited(key, options);
    } catch (err) {
      if (category === CALLER_CATEGORIES.PUSH) {
        return { limited: true, resetInSeconds: 60, degraded: true };
      }
      return { limited: false, resetInSeconds: 0, degraded: true };
    }
  }

  return (async () => {
    try {
      return await store.isLimited(key, options);
    } catch (err) {
      if (category === CALLER_CATEGORIES.PUSH) {
        return { limited: true, resetInSeconds: 60, degraded: true };
      }
      return { limited: false, resetInSeconds: 0, degraded: true };
    }
  })();
}

/**
 * Resets rate limit hits for a key.
 *
 * @param {string} key
 */
export function resetRateLimit(key) {
  const store = getRateLimitStore();
  if (store instanceof MemoryRateLimitStore) {
    return store.reset(key);
  }
  return store.reset(key);
}

/**
 * Pre-configured rate limiter for customer sign-up endpoint.
 * Default: Max 5 signups per 15 minutes per IP address.
 *
 * @param {Request|object} request
 */
export function checkSignupRateLimit(request) {
  const ip = getClientIp(request);
  const key = `signup:${ip}`;
  return checkRateLimit(key, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    category: CALLER_CATEGORIES.AUTH,
  });
}

/**
 * Pre-configured rate limiter for failed login attempts.
 * Default: Max 10 failed attempts per 15 minutes per IP/email.
 *
 * @param {string} identifier
 */
export function checkLoginRateLimit(identifier) {
  const key = `login:${identifier}`;
  return checkRateLimit(key, {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    category: CALLER_CATEGORIES.AUTH,
  });
}

/**
 * Checks if a login identifier or { email, ip } context is currently locked out.
 * Implements dual-layer defense:
 * - Per-account limit: 10 failed attempts / 15m (targeted brute-force protection)
 * - Per-IP limit: 25 failed attempts / 15m (credential stuffing / spraying protection)
 *
 * @param {string|{ email?: string, ip?: string }} identifier
 * @returns {{ limited: boolean, resetInSeconds: number } | Promise<{ limited: boolean, resetInSeconds: number }>}
 */
export function isLoginRateLimited(identifier) {
  let email = null;
  let ip = null;

  if (typeof identifier === 'string') {
    email = identifier;
  } else if (identifier && typeof identifier === 'object') {
    email = identifier.email || null;
    ip = identifier.ip || null;
  }

  const store = getRateLimitStore();
  const category = CALLER_CATEGORIES.AUTH;

  if (store instanceof MemoryRateLimitStore) {
    if (email) {
      const emailRes = isRateLimited(`login:email:${email}`, { maxRequests: 10, windowMs: 15 * 60 * 1000, category });
      if (emailRes.limited) return emailRes;
      const legacyRes = isRateLimited(`login:${email}`, { maxRequests: 10, windowMs: 15 * 60 * 1000, category });
      if (legacyRes.limited) return legacyRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = isRateLimited(`login:ip:${ip}`, { maxRequests: 25, windowMs: 15 * 60 * 1000, category });
      if (ipRes.limited) return ipRes;
    }

    return { limited: false, resetInSeconds: 0 };
  }

  return (async () => {
    if (email) {
      const emailRes = await isRateLimited(`login:email:${email}`, { maxRequests: 10, windowMs: 15 * 60 * 1000, category });
      if (emailRes.limited) return emailRes;
      const legacyRes = await isRateLimited(`login:${email}`, { maxRequests: 10, windowMs: 15 * 60 * 1000, category });
      if (legacyRes.limited) return legacyRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = await isRateLimited(`login:ip:${ip}`, { maxRequests: 25, windowMs: 15 * 60 * 1000, category });
      if (ipRes.limited) return ipRes;
    }

    return { limited: false, resetInSeconds: 0 };
  })();
}

/**
 * Records a failed login attempt for an identifier or { email, ip } context.
 *
 * @param {string|{ email?: string, ip?: string }} identifier
 */
export function recordFailedLoginAttempt(identifier) {
  let email = null;
  let ip = null;

  if (typeof identifier === 'string') {
    email = identifier;
  } else if (identifier && typeof identifier === 'object') {
    email = identifier.email || null;
    ip = identifier.ip || null;
  }

  const store = getRateLimitStore();
  const windowMs = 15 * 60 * 1000;

  if (store instanceof MemoryRateLimitStore) {
    if (email) {
      store.record(`login:email:${email}`, { windowMs });
      store.record(`login:${email}`, { windowMs });
    }
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      store.record(`login:ip:${ip}`, { windowMs });
    }
    return true;
  }

  return (async () => {
    const promises = [];
    if (email) {
      promises.push(store.record(`login:email:${email}`, { windowMs }));
      promises.push(store.record(`login:${email}`, { windowMs }));
    }
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      promises.push(store.record(`login:ip:${ip}`, { windowMs }));
    }
    await Promise.allSettled(promises);
    return true;
  })();
}

/**
 * Resets failed login counters upon successful authentication.
 *
 * @param {string|{ email?: string, ip?: string }} identifier
 */
export function resetLoginAttempts(identifier) {
  let email = null;
  if (typeof identifier === 'string') {
    email = identifier;
  } else if (identifier && typeof identifier === 'object') {
    email = identifier.email || null;
  }

  const store = getRateLimitStore();
  if (store instanceof MemoryRateLimitStore) {
    if (email) {
      resetRateLimit(`login:email:${email}`);
      resetRateLimit(`login:${email}`);
    }
    return;
  }

  return (async () => {
    if (email) {
      await Promise.allSettled([
        resetRateLimit(`login:email:${email}`),
        resetRateLimit(`login:${email}`),
      ]);
    }
  })();
}

/**
 * Pre-configured rate limiter for push-test endpoint.
 * Default: Max 5 test notifications per minute per user ID,
 * and max 10 test notifications per minute per client IP.
 * Enforces FAIL-CLOSED policy on store failure.
 *
 * @param {string} userId
 * @param {Request|object} request
 * @returns {{ allowed: boolean, remaining: number, resetInSeconds: number } | Promise<{ allowed: boolean, remaining: number, resetInSeconds: number }>}
 */
export function checkPushTestRateLimit(userId, request) {
  const ip = getClientIp(request);
  const options = {
    maxRequests: 5,
    windowMs: 60 * 1000,
    category: CALLER_CATEGORIES.PUSH,
  };

  const store = getRateLimitStore();
  if (store instanceof MemoryRateLimitStore) {
    if (userId) {
      const userRes = checkRateLimit(`push_test:user:${userId}`, options);
      if (!userRes.allowed) return userRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = checkRateLimit(`push_test:ip:${ip}`, {
        maxRequests: 10,
        windowMs: 60 * 1000,
        category: CALLER_CATEGORIES.PUSH,
      });
      if (!ipRes.allowed) return ipRes;
    }

    return { allowed: true, remaining: 5, resetInSeconds: 60 };
  }

  return (async () => {
    if (userId) {
      const userRes = await checkRateLimit(`push_test:user:${userId}`, options);
      if (!userRes.allowed) return userRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = await checkRateLimit(`push_test:ip:${ip}`, {
        maxRequests: 10,
        windowMs: 60 * 1000,
        category: CALLER_CATEGORIES.PUSH,
      });
      if (!ipRes.allowed) return ipRes;
    }

    return { allowed: true, remaining: 5, resetInSeconds: 60 };
  })();
}

/**
 * Pre-configured rate limiter for push-subscribe endpoint.
 * Default: Max 10 registrations per 5 minutes per user ID,
 * and max 15 registrations per 5 minutes per client IP.
 * Enforces FAIL-CLOSED policy on store failure.
 *
 * @param {string} userId
 * @param {Request|object} request
 * @returns {{ allowed: boolean, remaining: number, resetInSeconds: number } | Promise<{ allowed: boolean, remaining: number, resetInSeconds: number }>}
 */
export function checkPushSubscribeRateLimit(userId, request) {
  const ip = getClientIp(request);
  const options = {
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
    category: CALLER_CATEGORIES.PUSH,
  };

  const store = getRateLimitStore();
  if (store instanceof MemoryRateLimitStore) {
    if (userId) {
      const userRes = checkRateLimit(`push_sub:user:${userId}`, options);
      if (!userRes.allowed) return userRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = checkRateLimit(`push_sub:ip:${ip}`, {
        maxRequests: 15,
        windowMs: 5 * 60 * 1000,
        category: CALLER_CATEGORIES.PUSH,
      });
      if (!ipRes.allowed) return ipRes;
    }

    return { allowed: true, remaining: 10, resetInSeconds: 300 };
  }

  return (async () => {
    if (userId) {
      const userRes = await checkRateLimit(`push_sub:user:${userId}`, options);
      if (!userRes.allowed) return userRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = await checkRateLimit(`push_sub:ip:${ip}`, {
        maxRequests: 15,
        windowMs: 5 * 60 * 1000,
        category: CALLER_CATEGORIES.PUSH,
      });
      if (!ipRes.allowed) return ipRes;
    }

    return { allowed: true, remaining: 10, resetInSeconds: 300 };
  })();
}

/**
 * Pre-configured rate limiter for Payment Order Creation endpoint.
 * Default: Max 15 order creation attempts per 5 minutes per user ID,
 * and max 25 attempts per 5 minutes per client IP.
 * Enforces FAIL-OPEN policy on store failure to preserve customer checkout availability.
 *
 * @param {string} userId
 * @param {Request|object} request
 * @returns {{ allowed: boolean, remaining: number, resetInSeconds: number } | Promise<{ allowed: boolean, remaining: number, resetInSeconds: number }>}
 */
export function checkPaymentCreateOrderRateLimit(userId, request) {
  const ip = getClientIp(request);
  const options = {
    maxRequests: 15,
    windowMs: 5 * 60 * 1000,
    category: CALLER_CATEGORIES.PAYMENT,
  };

  const store = getRateLimitStore();
  if (store instanceof MemoryRateLimitStore) {
    if (userId) {
      const userRes = checkRateLimit(`pay_order:user:${userId}`, options);
      if (!userRes.allowed) return userRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = checkRateLimit(`pay_order:ip:${ip}`, {
        maxRequests: 25,
        windowMs: 5 * 60 * 1000,
        category: CALLER_CATEGORIES.PAYMENT,
      });
      if (!ipRes.allowed) return ipRes;
    }

    return { allowed: true, remaining: 15, resetInSeconds: 300 };
  }

  return (async () => {
    if (userId) {
      const userRes = await checkRateLimit(`pay_order:user:${userId}`, options);
      if (!userRes.allowed) return userRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = await checkRateLimit(`pay_order:ip:${ip}`, {
        maxRequests: 25,
        windowMs: 5 * 60 * 1000,
        category: CALLER_CATEGORIES.PAYMENT,
      });
      if (!ipRes.allowed) return ipRes;
    }

    return { allowed: true, remaining: 15, resetInSeconds: 300 };
  })();
}

/**
 * Pre-configured rate limiter for Payment Verification endpoint.
 * Default: Max 15 verification attempts per 5 minutes per Razorpay order ID,
 * and max 30 attempts per 5 minutes per client IP.
 * Enforces FAIL-OPEN policy on store failure to preserve confirmation availability.
 *
 * @param {string} orderId
 * @param {Request|object} request
 * @returns {{ allowed: boolean, remaining: number, resetInSeconds: number } | Promise<{ allowed: boolean, remaining: number, resetInSeconds: number }>}
 */
export function checkPaymentVerifyRateLimit(orderId, request) {
  const ip = getClientIp(request);
  const options = {
    maxRequests: 15,
    windowMs: 5 * 60 * 1000,
    category: CALLER_CATEGORIES.PAYMENT,
  };

  const store = getRateLimitStore();
  if (store instanceof MemoryRateLimitStore) {
    if (orderId) {
      const orderRes = checkRateLimit(`pay_verify:order:${orderId}`, options);
      if (!orderRes.allowed) return orderRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = checkRateLimit(`pay_verify:ip:${ip}`, {
        maxRequests: 30,
        windowMs: 5 * 60 * 1000,
        category: CALLER_CATEGORIES.PAYMENT,
      });
      if (!ipRes.allowed) return ipRes;
    }

    return { allowed: true, remaining: 15, resetInSeconds: 300 };
  }

  return (async () => {
    if (orderId) {
      const orderRes = await checkRateLimit(`pay_verify:order:${orderId}`, options);
      if (!orderRes.allowed) return orderRes;
    }

    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      const ipRes = await checkRateLimit(`pay_verify:ip:${ip}`, {
        maxRequests: 30,
        windowMs: 5 * 60 * 1000,
        category: CALLER_CATEGORIES.PAYMENT,
      });
      if (!ipRes.allowed) return ipRes;
    }

    return { allowed: true, remaining: 15, resetInSeconds: 300 };
  })();
}
