/**
 * Rate Limiter Store Adapters & Distributed Failure Policy
 *
 * Implements:
 * 1. MemoryRateLimitStore: Bounded LRU in-memory store for local development & single-process nodes.
 * 2. UpstashRedisStore: Atomic sliding-window rate limiter via Upstash Redis REST using native fetch.
 * 3. Categorized Failure Policy:
 *    - AUTH: Fail-open with bounded logging (preserves login/signup availability).
 *    - PAYMENT: Fail-open with bounded logging (guarantees payment checkout & verification availability).
 *    - PUSH: Fail-closed with logging (prevents spam/probing & protects notification quotas).
 */

export const CALLER_CATEGORIES = {
  AUTH: 'auth',
  PAYMENT: 'payment',
  PUSH: 'push',
};

/**
 * Validates rate limit configuration based on environment variables.
 * Enforces that distributed mode cannot silently fall back to in-memory when required.
 *
 * @returns {{ valid: boolean, error?: string, mode: string }}
 */
export function validateRateLimitConfig() {
  const isDistributedRequired = process.env.RATE_LIMIT_DISTRIBUTED_REQUIRED === 'true';
  const storeType = (process.env.RATE_LIMIT_STORE || 'memory').toLowerCase().trim();

  if (isDistributedRequired) {
    if (storeType !== 'upstash') {
      return {
        valid: false,
        error: `[RateLimit Configuration Error] RATE_LIMIT_DISTRIBUTED_REQUIRED=true requires RATE_LIMIT_STORE='upstash', but received '${storeType}'.`,
        mode: storeType,
      };
    }
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
      return {
        valid: false,
        error: '[RateLimit Configuration Error] RATE_LIMIT_DISTRIBUTED_REQUIRED=true requires a valid HTTPS UPSTASH_REDIS_REST_URL.',
        mode: storeType,
      };
    }
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return {
        valid: false,
        error: '[RateLimit Configuration Error] RATE_LIMIT_DISTRIBUTED_REQUIRED=true requires a non-empty UPSTASH_REDIS_REST_TOKEN.',
        mode: storeType,
      };
    }
  }

  return { valid: true, mode: storeType };
}

/**
 * Handles store communication failures according to the caller's safety classification.
 *
 * @param {string} category 'auth' | 'payment' | 'push'
 * @param {Error|any} error
 * @returns {{ allowed: boolean, remaining: number, resetInSeconds: number, degraded: boolean, failurePolicy: string }}
 */
export function handleStoreFailure(category, error) {
  const safeMessage = error?.message || 'Rate limit store unavailable';

  if (category === CALLER_CATEGORIES.PUSH) {
    console.error(`[RateLimit Error: PUSH] Store communication failure. Enforcing FAIL-CLOSED policy: ${safeMessage}`);
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: 60,
      degraded: true,
      failurePolicy: 'fail_closed',
    };
  }

  if (category === CALLER_CATEGORIES.PAYMENT) {
    console.warn(`[RateLimit Warning: PAYMENT] Store communication failure. Preserving checkout availability (FAIL-OPEN): ${safeMessage}`);
    return {
      allowed: true,
      remaining: 1,
      resetInSeconds: 0,
      degraded: true,
      failurePolicy: 'fail_open',
    };
  }

  // Default: AUTH category
  console.warn(`[RateLimit Warning: AUTH] Store communication failure. Preserving login availability (FAIL-OPEN): ${safeMessage}`);
  return {
    allowed: true,
    remaining: 1,
    resetInSeconds: 0,
    degraded: true,
    failurePolicy: 'fail_open',
  };
}

/**
 * Bounded In-Memory Rate Limit Store
 */
export class MemoryRateLimitStore {
  constructor(options = {}) {
    this.store = new Map();
    this.maxKeys = options.maxKeys || 10000;
    this.lastPrune = Date.now();
    this.pruneIntervalMs = options.pruneIntervalMs || 5 * 60 * 1000;
  }

  pruneStaleEntries(now) {
    if (now - this.lastPrune < this.pruneIntervalMs && this.store.size < this.maxKeys) {
      return;
    }
    this.lastPrune = now;

    for (const [key, timestamps] of this.store.entries()) {
      const recent = timestamps.filter((t) => now - t < 60 * 60 * 1000);
      if (recent.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, recent);
      }
    }

    // Bounded memory protection: If still exceeding max keys, evict oldest 10%
    if (this.store.size >= this.maxKeys) {
      const toEvict = Math.ceil(this.maxKeys * 0.1);
      let evicted = 0;
      for (const key of this.store.keys()) {
        this.store.delete(key);
        evicted++;
        if (evicted >= toEvict) break;
      }
    }
  }

  check(key, { maxRequests = 10, windowMs = 15 * 60 * 1000 } = {}) {
    const now = Date.now();
    this.pruneStaleEntries(now);

    const windowStart = now - windowMs;
    let timestamps = this.store.get(key) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= maxRequests) {
      const oldestInWindow = timestamps[0];
      const resetInSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      this.store.set(key, timestamps);
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds,
      };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - timestamps.length),
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  isLimited(key, { maxRequests = 10, windowMs = 15 * 60 * 1000 } = {}) {
    const now = Date.now();
    const windowStart = now - windowMs;
    let timestamps = this.store.get(key) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= maxRequests) {
      const oldestInWindow = timestamps[0];
      const resetInSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      return { limited: true, resetInSeconds };
    }

    return { limited: false, resetInSeconds: 0 };
  }

  record(key, { windowMs = 15 * 60 * 1000 } = {}) {
    const now = Date.now();
    this.pruneStaleEntries(now);
    let timestamps = this.store.get(key) || [];
    timestamps = timestamps.filter((t) => now - t < windowMs);
    timestamps.push(now);
    this.store.set(key, timestamps);
    return true;
  }

  reset(key) {
    this.store.delete(key);
    return true;
  }

  clear() {
    this.store.clear();
  }
}

/**
 * Upstash Redis REST Store (Atomic Sliding Window via Lua script)
 */
export class UpstashRedisStore {
  constructor(options = {}) {
    this.url = (options.url || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
    this.token = options.token || process.env.UPSTASH_REDIS_REST_TOKEN || '';
    this.timeoutMs = options.timeoutMs || 3000;
  }

  async _execCommand(commandArray) {
    if (!this.url || !this.token) {
      throw new Error('[UpstashStore] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandArray),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Upstash HTTP Error ${response.status}: ${text}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`Upstash Redis Error: ${data.error}`);
      }

      return data.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  async check(key, { maxRequests = 10, windowMs = 15 * 60 * 1000 } = {}) {
    const now = Date.now();
    const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;
    const luaScript = `
      local key = KEYS[1]
      local windowMs = tonumber(ARGV[1])
      local maxRequests = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local member = ARGV[4]
      local clearBefore = now - windowMs

      redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
      local current = redis.call('ZCARD', key)

      if current < maxRequests then
        redis.call('ZADD', key, now, member)
        redis.call('PEXPIRE', key, windowMs + 2000)
        return {1, maxRequests - current - 1, math.ceil(windowMs / 1000)}
      else
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local resetSec = math.ceil(windowMs / 1000)
        if oldest and #oldest >= 2 then
          local oldestScore = tonumber(oldest[2])
          resetSec = math.max(1, math.ceil((oldestScore + windowMs - now) / 1000))
        end
        return {0, 0, resetSec}
      end
    `;

    const result = await this._execCommand(['EVAL', luaScript, 1, key, String(windowMs), String(maxRequests), String(now), member]);
    const allowed = Array.isArray(result) && result[0] === 1;
    const remaining = Array.isArray(result) ? Number(result[1]) : 0;
    const resetInSeconds = Array.isArray(result) ? Number(result[2]) : Math.ceil(windowMs / 1000);

    return {
      allowed,
      remaining,
      resetInSeconds,
    };
  }

  async isLimited(key, { maxRequests = 10, windowMs = 15 * 60 * 1000 } = {}) {
    const now = Date.now();
    const luaScript = `
      local key = KEYS[1]
      local windowMs = tonumber(ARGV[1])
      local maxRequests = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local clearBefore = now - windowMs

      redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
      local current = redis.call('ZCARD', key)

      if current >= maxRequests then
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local resetSec = math.ceil(windowMs / 1000)
        if oldest and #oldest >= 2 then
          local oldestScore = tonumber(oldest[2])
          resetSec = math.max(1, math.ceil((oldestScore + windowMs - now) / 1000))
        end
        return {1, resetSec}
      else
        return {0, 0}
      end
    `;

    const result = await this._execCommand(['EVAL', luaScript, 1, key, String(windowMs), String(maxRequests), String(now)]);
    const limited = Array.isArray(result) && result[0] === 1;
    const resetInSeconds = Array.isArray(result) ? Number(result[1]) : 0;

    return {
      limited,
      resetInSeconds,
    };
  }

  async record(key, { windowMs = 15 * 60 * 1000 } = {}) {
    const now = Date.now();
    const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;
    const luaScript = `
      local key = KEYS[1]
      local windowMs = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])
      local member = ARGV[3]
      local clearBefore = now - windowMs

      redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
      redis.call('ZADD', key, now, member)
      redis.call('PEXPIRE', key, windowMs + 2000)
      return 1
    `;
    await this._execCommand(['EVAL', luaScript, 1, key, String(windowMs), String(now), member]);
    return true;
  }

  async reset(key) {
    await this._execCommand(['DEL', key]);
    return true;
  }
}

// Global active store singleton
const defaultMemoryStore = new MemoryRateLimitStore();
let customStore = null;

/**
 * Test hook: override active store
 */
export function _setCustomRateLimitStore(store) {
  customStore = store;
}

/**
 * Test hook: reset custom store
 */
export function _resetRateLimitStore() {
  customStore = null;
  defaultMemoryStore.clear();
}

/**
 * Retrieves the configured rate limit store.
 * Enforces startup configuration check if distributed mode is required.
 *
 * @returns {MemoryRateLimitStore | UpstashRedisStore}
 */
export function getRateLimitStore() {
  if (customStore) {
    return customStore;
  }

  const validation = validateRateLimitConfig();
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (validation.mode === 'upstash') {
    return new UpstashRedisStore();
  }

  return defaultMemoryStore;
}
