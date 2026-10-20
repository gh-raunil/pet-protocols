/**
 * Authentication and Contact Field Validation & Normalization
 *
 * Implements strict, no-cost client & server validation to protect against:
 * 1. Garbage/invalid email registrations and malformed domains.
 * 2. Algorithmic DoS via oversized passwords (>72 bytes bcrypt truncation threshold).
 * 3. Trivial or single-character passwords.
 * 4. Inconsistent or invalid phone number formats across addresses and orders.
 */

// RFC 5322 compliant regex for practical email validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Standard Indian mobile number regex (10 digits starting with 6, 7, 8, or 9)
// Allows optional +91, 91, or 0 prefix, and optional spaces/hyphens
const INDIA_PHONE_REGEX = /^(?:(?:\+?91[\s-]?)?|0?)([6-9]\d{9})$/;

// General E.164 international phone number format (7 to 15 digits)
const E164_PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

/**
 * Validates format of an email address.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) return false;

  if (!EMAIL_REGEX.test(trimmed)) return false;

  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.length > 64) return false;

  // Domain must contain a valid TLD (at least 2 letters)
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;
  const tld = domainParts[domainParts.length - 1];
  if (!/^[a-zA-Z]{2,24}$/.test(tld)) return false;

  return true;
}

/**
 * Normalizes an email address consistently across the application.
 * Note: Lowercases and trims whitespace. Does NOT remove dots from Gmail
 * addresses to preserve backward-compatibility with existing database records.
 * @param {string} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Validates a contact phone number.
 * Accepts standard 10-digit Indian mobile numbers (with or without +91 / 91 / 0)
 * or general international E.164 formats.
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (!cleaned) return false;

  // Indian mobile format: 10 digits starting with 6-9 (optional +91, 91, or 0)
  if (INDIA_PHONE_REGEX.test(cleaned)) {
    return true;
  }

  // International E.164 format: must start with '+' followed by country code and 7-15 digits
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return true;
  }

  return false;
}

/**
 * Normalizes a phone number to standard format.
 * For 10-digit Indian numbers, extracts the canonical 10 digits.
 * For numbers with + prefix, retains the cleaned E.164 string.
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const cleaned = phone.replace(/[\s\-()]/g, '');

  const indiaMatch = cleaned.match(INDIA_PHONE_REGEX);
  if (indiaMatch && indiaMatch[1]) {
    return indiaMatch[1]; // Canonical 10 digits (e.g. "9876543210")
  }

  return cleaned;
}

/**
 * Validates password length and complexity.
 * - Min length: 8 characters
 * - Max length: 72 bytes (prevents bcrypt truncation vulnerability and DoS attacks)
 * - Must not be only whitespace
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }

  if (password.trim().length === 0) {
    return { valid: false, message: 'Password cannot consist solely of whitespace.' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }

  // Bcrypt only hashes up to 72 bytes. Submitting arbitrarily large strings
  // can be abused for CPU-exhaustion / algorithmic DoS.
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > 72) {
    return { valid: false, message: 'Password exceeds maximum length (72 bytes).' };
  }

  // Must have at least one letter and at least one digit or symbol
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigitOrSpecial = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

  if (!hasLetter || !hasDigitOrSpecial) {
    return {
      valid: false,
      message: 'Password must contain at least one letter and at least one number or special character.',
    };
  }

  return { valid: true };
}
