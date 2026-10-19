import crypto from 'crypto';

/**
 * Server-only Razorpay HTTP client with first-class X-Refund-Idempotency support.
 * Implements the standard Razorpay Payment Gateway refund contract:
 * POST /v1/payments/:id/refund
 *
 * Security & Reliability Constraints:
 * - Uses HTTPS and HTTP Basic Authentication with server-side Razorpay credentials.
 * - Always sends caller-supplied X-Refund-Idempotency header.
 * - Never logs or exposes credentials, API secrets, or Authorization headers.
 * - Does not perform blind automatic retries.
 * - Classifies responses: 2xx success, 409 conflict, 400 bad request / payload mismatch, 5xx server error, network errors.
 */

let _testHttpTransport = null;

/**
 * Set an in-memory transport hook for testing without issuing real network calls.
 * @param {Function|null} transportFn - async ({ url, method, headers, body }) => ({ status, data, headers })
 */
export function _setTestHttpTransport(transportFn) {
  _testHttpTransport = transportFn;
}

/**
 * Reset test transport hook to default.
 */
export function _resetTestHttpTransport() {
  _testHttpTransport = null;
}

/**
 * Compute a deterministic SHA-256 fingerprint of the refund request payload.
 * Used to verify payload consistency across attempts with the same idempotency key.
 */
export function computePayloadFingerprint(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const stableNotes = {};
  if (payload.notes && typeof payload.notes === 'object') {
    if (payload.notes.opKey) stableNotes.opKey = String(payload.notes.opKey);
    if (payload.notes.orderId) stableNotes.orderId = String(payload.notes.orderId);
    if (payload.notes.paymentIntentId) stableNotes.paymentIntentId = String(payload.notes.paymentIntentId);
  }
  const canonical = {
    amount: payload.amount,
    currency: payload.currency || 'INR',
    speed: payload.speed || 'normal',
    notes: stableNotes,
    receipt: payload.receipt || '',
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/**
 * Generate a stable, valid Razorpay refund idempotency key.
 * Constraints from Razorpay contract:
 * - Must be at least 10 characters long.
 * - Must only contain alphanumeric characters (A-Z, a-z, 0-9), hyphens (-), and underscores (_).
 * Format: refkey_<entityType>_<entityId>
 */
export function generateRefundIdempotencyKey(entityType, entityId) {
  const safeType = String(entityType || 'entity').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeId = String(entityId || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '');
  const key = `refkey_${safeType}_${safeId}`;
  if (key.length < 10) {
    return `${key}_${crypto.randomBytes(4).toString('hex')}`;
  }
  return key;
}

/**
 * Validate that an idempotency key conforms strictly to Razorpay's contract.
 */
export function validateIdempotencyKey(key) {
  if (typeof key !== 'string') {
    return { valid: false, reason: 'Idempotency key must be a string' };
  }
  if (key.length < 10) {
    return { valid: false, reason: 'The idempotency key must be at least 10 characters long' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return { valid: false, reason: 'The idempotency key must only contain alphanumeric characters, underscores, and hyphens' };
  }
  return { valid: true };
}

/**
 * Sanitize an error or request object for safe logging (stripping credentials).
 */
export function sanitizeForLogging(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  if ('Authorization' in clone) clone.Authorization = '[REDACTED]';
  if ('authorization' in clone) clone.authorization = '[REDACTED]';
  if ('keySecret' in clone) clone.keySecret = '[REDACTED]';
  if ('secret' in clone) clone.secret = '[REDACTED]';
  if ('password' in clone) clone.password = '[REDACTED]';
  return clone;
}

/**
 * Execute a refund against Razorpay API using direct HTTP POST and X-Refund-Idempotency.
 *
 * @param {Object} options
 * @param {string} options.paymentId - Razorpay payment ID (pay_...)
 * @param {number} options.amountPaise - Amount in smallest currency unit (paise for INR)
 * @param {string} options.idempotencyKey - Caller-supplied idempotency key (>= 10 chars, [a-zA-Z0-9_-])
 * @param {Object} [options.notes] - Key-value metadata (max 15 pairs)
 * @param {string} [options.speed='normal'] - 'normal' or 'optimum'
 * @param {string} [options.receipt] - Internal reference receipt number
 * @param {string} [options.keyId] - Optional key ID override (defaults to process.env.RAZORPAY_KEY_ID)
 * @param {string} [options.keySecret] - Optional key secret override (defaults to process.env.RAZORPAY_KEY_SECRET)
 * @param {string} [options.baseUrl] - Base API URL (defaults to https://api.razorpay.com/v1)
 * @param {number} [options.timeoutMs=10000] - Request timeout in milliseconds
 * @returns {Promise<Object>} Execution result with classification
 */
export async function executeRefund(options = {}) {
  const {
    paymentId,
    amountPaise,
    idempotencyKey,
    notes = {},
    speed = 'normal',
    receipt = '',
    keyId = process.env.RAZORPAY_KEY_ID,
    keySecret = process.env.RAZORPAY_KEY_SECRET,
    baseUrl = 'https://api.razorpay.com/v1',
    timeoutMs = 10000,
  } = options;

  // 1. Input Validations
  if (!paymentId || typeof paymentId !== 'string' || paymentId.trim().length === 0) {
    return {
      success: false,
      badRequest: true,
      definitiveError: true,
      error: 'Invalid paymentId: Payment ID is required for refund dispatch.',
    };
  }

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return {
      success: false,
      badRequest: true,
      definitiveError: true,
      error: 'Invalid amountPaise: Amount must be a positive integer in smallest currency unit.',
    };
  }

  const keyValidation = validateIdempotencyKey(idempotencyKey);
  if (!keyValidation.valid) {
    return {
      success: false,
      badRequest: true,
      definitiveError: true,
      error: keyValidation.reason,
    };
  }

  // 2. Credential Check (only required if no mock transport is installed)
  if (!_testHttpTransport && (!keyId || !keySecret)) {
    return {
      success: false,
      unconfigured: true,
      definitiveError: true,
      error: 'Razorpay credentials not configured on server (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).',
    };
  }

  // 3. Construct Request Body and Headers
  const requestBody = {
    amount: amountPaise,
    speed: speed || 'normal',
  };
  if (receipt) {
    requestBody.receipt = String(receipt);
  }
  if (notes && typeof notes === 'object' && Object.keys(notes).length > 0) {
    requestBody.notes = notes;
  }

  const authHeader = `Basic ${Buffer.from(`${keyId || 'mock_key'}:${keySecret || 'mock_secret'}`).toString('base64')}`;
  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
    'X-Refund-Idempotency': idempotencyKey,
  };

  const targetUrl = `${baseUrl.replace(/\/+$/, '')}/payments/${encodeURIComponent(paymentId)}/refund`;

  // 4. Dispatch via Test Transport Hook or Native Fetch
  try {
    let responseStatus;
    let responseData;
    let responseHeaders = {};

    if (typeof _testHttpTransport === 'function') {
      const mockResult = await _testHttpTransport({
        url: targetUrl,
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        idempotencyKey,
        paymentId,
        amountPaise,
      });
      responseStatus = mockResult?.status || 200;
      responseData = mockResult?.data;
      responseHeaders = mockResult?.headers || {};
    } else {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      try {
        const fetchRes = await fetch(targetUrl, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        responseStatus = fetchRes.status;
        const text = await fetchRes.text();
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = { raw: text };
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // 5. Result Classification per Razorpay Gateway Contract

    // 5a. Success: 200 OK / 201 Created
    if (responseStatus >= 200 && responseStatus < 300) {
      const refundId = responseData?.id || null;
      const status = responseData?.status || 'processed';
      return {
        success: true,
        statusCode: responseStatus,
        refundId,
        status,
        refund: responseData,
        message: `Refund of ₹${(amountPaise / 100).toFixed(2)} processed successfully (Refund ID: ${refundId}).`,
      };
    }

    // 5b. HTTP 409 Conflict: In-progress idempotency key or concurrent processing
    if (responseStatus === 409) {
      const errDesc = responseData?.error?.description || responseData?.description || 'Request with this idempotency key is already in progress.';
      return {
        success: false,
        statusCode: 409,
        conflict: true,
        inProgress: true,
        uncertain: true, // Must quarantine; previous request may still land!
        error: `HTTP 409 Conflict: ${errDesc}`,
        raw: responseData,
      };
    }

    // 5c. HTTP 400 Bad Request: Format error, invalid payment ID, or payload mismatch
    if (responseStatus === 400) {
      const errDesc = responseData?.error?.description || responseData?.description || 'Bad Request';
      const isMismatch =
        errDesc.toLowerCase().includes('different request with the same idempotency key') ||
        errDesc.toLowerCase().includes('payload does not match') ||
        errDesc.toLowerCase().includes('payload mismatch') ||
        errDesc.toLowerCase().includes('already been processed');

      return {
        success: false,
        statusCode: 400,
        badRequest: true,
        payloadMismatch: isMismatch,
        definitiveError: true,
        error: isMismatch
          ? `HTTP 400 Payload Mismatch: Different request with the same idempotency key has already been processed.`
          : `HTTP 400 Bad Request: ${errDesc}`,
        raw: responseData,
      };
    }

    // 5d. HTTP 429 Too Many Requests: Rate limit exceeded, gateway outcome unresolved
    if (responseStatus === 429) {
      const errDesc = responseData?.error?.description || responseData?.description || 'Too Many Requests: Rate limit exceeded.';
      return {
        success: false,
        statusCode: 429,
        rateLimited: true,
        uncertain: true, // Gateway rate limit may have occurred after or during dispatch; outcome is unresolved
        error: `HTTP 429 Rate Limited: ${errDesc}`,
        raw: responseData,
      };
    }

    // 5e. HTTP 5xx Server Error: Uncertain gateway state
    if (responseStatus >= 500) {
      const errDesc = responseData?.error?.description || responseData?.description || `HTTP ${responseStatus} Internal Server Error`;
      return {
        success: false,
        statusCode: responseStatus,
        gatewayError: true,
        uncertain: true, // Gateway threw 5xx; refund might have landed before error!
        error: `Gateway Error (${responseStatus}): ${errDesc}`,
        raw: responseData,
      };
    }

    // 5f. Other HTTP 4xx Client Errors (401, 403, 404, etc.)
    const errDesc = responseData?.error?.description || responseData?.description || `HTTP ${responseStatus} Error`;
    return {
      success: false,
      statusCode: responseStatus,
      clientError: true,
      definitiveError: true,
      error: `Client Error (${responseStatus}): ${errDesc}`,
      raw: responseData,
    };
  } catch (err) {
    // 6. Network Errors, Timeouts, Aborts, Connection Resets
    const isTimeout = err.name === 'AbortError' || err.code === 'ETIMEDOUT' || /timeout/i.test(err.message);
    const isConnReset = err.code === 'ECONNRESET' || /connection reset/i.test(err.message);

    return {
      success: false,
      networkError: true,
      uncertain: true, // Network dropped while in-flight; outcome is uncertain!
      isTimeout,
      isConnReset,
      error: `${isTimeout ? 'ETIMEDOUT' : isConnReset ? 'ECONNRESET' : 'NetworkError'}: ${err.message}`,
    };
  }
}

/**
 * Standalone client export providing high-level interface.
 */
export const razorpayHttpClient = {
  executeRefund,
  computePayloadFingerprint,
  generateRefundIdempotencyKey,
  validateIdempotencyKey,
  _setTestHttpTransport,
  _resetTestHttpTransport,
};

export default razorpayHttpClient;
