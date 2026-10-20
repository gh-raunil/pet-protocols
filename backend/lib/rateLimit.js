/**
 * In-Memory Sliding-Window Rate Limiter
 *
 * Implements a lightweight, zero-cost rate limiting store for authentication endpoints.
 * Requires no external dependencies or paid infrastructure (no Redis / Upstash / AWS needed).
 * Includes automatic LRU pruning of stale records to prevent memory leaks.
 */

// Memory store: Map<key, Array<number timestamps>>
const rateLimitStore = new Map();

// Periodic prune interval (every 5 minutes)
let lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

function pruneStaleEntries(now) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;

  for (const [key, timestamps] of rateLimitStore.entries()) {
    // If all timestamps are older than 1 hour, remove key
    const recent = timestamps.filter((t) => now - t < 60 * 60 * 1000);
    if (recent.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, recent);
    }
  }
}

/**
 * Checks and records a rate limit hit using sliding-window algorithm.
 * @param {string} key Unique identifier (e.g. `signup:192.168.1.1` or `login:user@example.com`)
 * @param {object} options
 * @param {number} options.maxRequests Maximum allowed hits within window
 * @param {number} options.windowMs Window duration in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetInSeconds: number }}
 */
export function checkRateLimit(key, { maxRequests = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  pruneStaleEntries(now);

  const windowStart = now - windowMs;
  let timestamps = rateLimitStore.get(key) || [];

  // Filter out timestamps outside the sliding window
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    const resetInSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
    rateLimitStore.set(key, timestamps);
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  // Record this attempt
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - timestamps.length),
    resetInSeconds: Math.ceil(windowMs / 1000),
  };
}

/**
 * Checks whether a key is currently rate-limited WITHOUT recording an attempt.
 * @param {string} key
 * @param {object} options
 * @returns {{ limited: boolean, resetInSeconds: number }}
 */
export function isRateLimited(key, { maxRequests = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  const windowStart = now - windowMs;
  let timestamps = rateLimitStore.get(key) || [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    const resetInSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
    return { limited: true, resetInSeconds };
  }

  return { limited: false, resetInSeconds: 0 };
}

/**
 * Resets or clears rate limit hits for a specific key (useful after successful auth).
 * @param {string} key
 */
export function resetRateLimit(key) {
  rateLimitStore.delete(key);
}

/**
 * Safely extracts client IP from incoming request headers.
 * Handles proxies (x-forwarded-for first hop) and direct connections.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  if (!request) return '127.0.0.1';

  try {
    const headers = request.headers;
    const xForwardedFor = headers.get('x-forwarded-for');
    if (xForwardedFor) {
      // First IP in comma-separated list is the original client
      const clientIp = xForwardedFor.split(',')[0].trim();
      if (clientIp) return clientIp;
    }

    const xRealIp = headers.get('x-real-ip');
    if (xRealIp) return xRealIp.trim();

    const cfConnectingIp = headers.get('cf-connecting-ip');
    if (cfConnectingIp) return cfConnectingIp.trim();
  } catch (_) {}

  return '127.0.0.1';
}

/**
 * Pre-configured rate limiter for customer sign-up endpoint.
 * Default: Max 5 signups per 15 minutes per IP address.
 */
export function checkSignupRateLimit(request) {
  const ip = getClientIp(request);
  const key = `signup:${ip}`;
  return checkRateLimit(key, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  });
}

/**
 * Pre-configured rate limiter for failed login attempts.
 * Default: Max 10 failed attempts per 15 minutes per IP/email.
 */
export function checkLoginRateLimit(identifier) {
  const key = `login:${identifier}`;
  return checkRateLimit(key, {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  });
}

/**
 * Checks if a login identifier is currently locked out due to excessive failed attempts.
 */
export function isLoginRateLimited(identifier) {
  const key = `login:${identifier}`;
  return isRateLimited(key, {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  });
}

/**
 * Records a failed login attempt for an identifier.
 */
export function recordFailedLoginAttempt(identifier) {
  const key = `login:${identifier}`;
  const now = Date.now();
  let timestamps = rateLimitStore.get(key) || [];
  timestamps = timestamps.filter((t) => now - t < 15 * 60 * 1000);
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
}

/**
 * Resets failed login counters upon successful authentication.
 */
export function resetLoginAttempts(identifier) {
  resetRateLimit(`login:${identifier}`);
}
