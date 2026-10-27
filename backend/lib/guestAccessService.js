import crypto from "crypto";

export const GUEST_TOKEN_PREFIX = "gst_";
export const GUEST_TOKEN_BYTES = 32; // 256 bits of entropy
export const GUEST_TOKEN_EXPIRY_DAYS = 30; // 30-day default operational window

/**
 * Generate a cryptographically secure, unguessable guest access token.
 * Uses Node.js crypto.randomBytes(32) providing 256 bits of cryptographic entropy.
 * Never derived from order IDs, phone numbers, timestamps, or predictable seeds.
 */
export function generateGuestAccessToken() {
  const randomHex = crypto.randomBytes(GUEST_TOKEN_BYTES).toString("hex");
  return `${GUEST_TOKEN_PREFIX}${randomHex}`;
}

/**
 * Compute SHA-256 hexadecimal digest of a raw guest access token.
 * Only this cryptographic hash is stored in MongoDB (select: false).
 */
export function hashGuestAccessToken(token) {
  if (typeof token !== "string" || !token.trim()) {
    return null;
  }
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Constant-time safe verification of raw token against stored SHA-256 hash.
 * Prevents timing attacks.
 */
export function verifyGuestToken(rawToken, storedHash) {
  if (!rawToken || !storedHash || typeof rawToken !== "string" || typeof storedHash !== "string") {
    return false;
  }
  const computedHash = hashGuestAccessToken(rawToken);
  if (!computedHash) return false;

  const computedBuf = Buffer.from(computedHash, "utf8");
  const storedBuf = Buffer.from(storedHash, "utf8");

  if (computedBuf.length !== storedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(computedBuf, storedBuf);
}

/**
 * Extract guest access token from request headers or query parameters.
 * Precedence:
 * 1. 'x-guest-access-token' header
 * 2. 'Authorization: Bearer gst_...' header
 * 3. URL search parameter '?guestToken=...' or '?guestAccessToken=...'
 */
export function extractGuestAccessToken(request) {
  if (!request) return null;

  let token = null;

  // 1. Check HTTP request headers
  if (typeof request.headers?.get === "function") {
    token = request.headers.get("x-guest-access-token");
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && typeof authHeader === "string") {
        const parts = authHeader.trim().split(/\s+/);
        if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
          token = parts[1];
        } else if (parts.length === 1 && parts[0].startsWith(GUEST_TOKEN_PREFIX)) {
          token = parts[0];
        }
      }
    }
  }

  // 2. Fallback to URL search parameters if header was not sent
  if (!token && request.url) {
    try {
      const parsedUrl = new URL(request.url);
      token = parsedUrl.searchParams.get("guestToken") || parsedUrl.searchParams.get("guestAccessToken");
    } catch {
      // Ignore URL parsing errors
    }
  }

  if (typeof token === "string") {
    token = token.trim();
    if (token.startsWith(GUEST_TOKEN_PREFIX) && token.length >= 32) {
      return token;
    }
  }

  return null;
}

/**
 * Compute expiration date for a newly issued guest access token.
 */
export function computeGuestTokenExpiry(days = GUEST_TOKEN_EXPIRY_DAYS) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

/**
 * Resolves the server secret used for deterministic guest token derivation.
 * Checks GUEST_ACCESS_SECRET, DELIVERY_OTP_SECRET, and NEXTAUTH_SECRET.
 * Fails closed in production, staging, and CI environments if unconfigured.
 */
export function getGuestAccessSecret() {
  const customSecret = process.env.GUEST_ACCESS_SECRET;
  if (customSecret && typeof customSecret === "string" && customSecret.trim().length >= 32) {
    return customSecret.trim();
  }
  const otpSecret = process.env.DELIVERY_OTP_SECRET;
  if (otpSecret && typeof otpSecret === "string" && otpSecret.trim().length >= 32) {
    return otpSecret.trim();
  }
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (nextAuthSecret && typeof nextAuthSecret === "string" && nextAuthSecret.trim().length >= 32) {
    return nextAuthSecret.trim();
  }

  const isStrictEnv =
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "staging" ||
    Boolean(process.env.CI);

  if (isStrictEnv) {
    throw new Error(
      "[GuestAccess Security Error] Missing required server secret for guest token derivation in environment."
    );
  }

  // Safe deterministic 32-byte hex fallback strictly for local dev and isolated automated tests
  return "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

/**
 * Derives a deterministic, cryptographically secure guest access token bound to a verified seed.
 * Uses RFC 5869 HKDF (crypto.hkdfSync) with domain-separated info to produce 256 bits of entropy.
 * Format: gst_<64 hex characters>
 */
export function deriveGuestAccessToken(seed, context = "pet-protocols:guest-access") {
  if (!seed || typeof seed !== "string" || !seed.trim()) {
    // If no seed is provided, generate fresh CSPRNG random bytes
    return generateGuestAccessToken();
  }
  const masterKey = Buffer.from(getGuestAccessSecret(), "utf8");
  const salt = Buffer.from("pet-protocols:guest-token:v1", "utf8");
  const info = Buffer.from(`${context}:${seed.trim()}`, "utf8");

  const derivedKey = crypto.hkdfSync("sha256", masterKey, salt, info, GUEST_TOKEN_BYTES);
  return `${GUEST_TOKEN_PREFIX}${Buffer.from(derivedKey).toString("hex")}`;
}

/**
 * Check if a guestAccess document sub-record is active (not revoked, strictly unexpired).
 * Missing or null expiresAt is strictly treated as inactive (fails closed).
 */
export function isGuestAccessActive(guestAccess) {
  if (!guestAccess) return false;
  if (guestAccess.isRevoked) return false;
  if (!guestAccess.expiresAt) return false;
  const expiryTime = new Date(guestAccess.expiresAt).getTime();
  if (isNaN(expiryTime) || expiryTime <= Date.now()) {
    return false;
  }
  return true;
}

/**
 * Build a MongoDB query condition for authorizing guest access.
 * Enforces:
 * - Order has user: null (guest order)
 * - Matching tokenHash
 * - guestAccess.isRevoked is NOT true
 * - guestAccess.expiresAt is strictly present and later than current time (mandatory expiry)
 */
export function buildGuestOrderQuery(tokenHash, extraConditions = {}) {
  if (!tokenHash || typeof tokenHash !== "string" || !tokenHash.trim()) {
    // Fail-closed predicate: return an impossible match if tokenHash is missing or empty
    return { _id: null };
  }

  return {
    user: null,
    "guestAccess.tokenHash": tokenHash.trim(),
    "guestAccess.isRevoked": { $ne: true },
    "guestAccess.expiresAt": { $gt: new Date() },
    ...extraConditions,
  };
}
