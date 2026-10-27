/**
 * Authentication Helper Utilities for Pet Protocols Frontend
 */

export function isAuthLoopPath(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  const clean = pathname.replace(/\/+$/, "").toLowerCase();
  return (
    clean === "/auth/login" ||
    clean === "/auth/signup" ||
    clean === "/login" ||
    clean === "/signup"
  );
}

/**
 * Calculates accurate UTF-8 byte length across browser and Node environments.
 */
export function getUtf8ByteLength(str) {
  if (!str || typeof str !== "string") return 0;
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str).length;
  }
  return Buffer.byteLength(str, "utf8");
}

/**
 * Validates and sanitizes callbackUrl to prevent open redirects, SSRF vulnerabilities,
 * and post-authentication self-redirect loops.
 */
export function getSafeCallbackUrl(rawUrl, fallback = "/menu") {
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed) return fallback;

  // Reject protocol-relative or backslash-tricked paths
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return fallback;
  }

  // Must begin with a single slash
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "https://petprotocols.internal");
    if (parsed.origin !== "https://petprotocols.internal") {
      return fallback;
    }
    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return fallback;
    }
    // Reject ASCII control characters
    if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
      return fallback;
    }
    // Prevent self-redirect loops back to login/signup
    if (isAuthLoopPath(parsed.pathname)) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
