import crypto from "crypto";
import Order from "@/models/Order";
import { notifyOrderEvent } from "@/lib/pushService";
import { enqueueOrderEvents } from "@/lib/notificationOutboxService";

let _notifyOrderEvent = notifyOrderEvent;
export function _setTestNotifyOrderEvent(fn) {
  _notifyOrderEvent = fn;
}

let _preAtomicCommitHook = null;
export function _setTestPreAtomicCommitHook(fn) {
  _preAtomicCommitHook = fn;
}

const DEFAULT_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const REISSUE_COOLDOWN_SECONDS = 30;
const MAX_REISSUES_PER_ORDER = 5;

/**
 * Resolves the secret used for keyed HMAC digests and AES-256-GCM encryption at rest.
 * Fails closed in production, staging, and CI if unset or malformed.
 * Validates canonical format: exactly 64 hexadecimal characters (32 bytes).
 */
export function getDeliveryOtpSecret() {
  const secret = process.env.DELIVERY_OTP_SECRET;

  if (secret !== undefined && secret !== null) {
    const trimmed = typeof secret === "string" ? secret.trim() : "";
    if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      throw new Error(
        "[DeliveryOTP Security Error] DELIVERY_OTP_SECRET must be a 64-character hexadecimal string (32 bytes)."
      );
    }
    return trimmed.toLowerCase();
  }

  const isStrictEnv =
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "staging" ||
    Boolean(process.env.CI);

  if (isStrictEnv) {
    throw new Error(
      "[DeliveryOTP Security Error] Missing required DELIVERY_OTP_SECRET in environment. Refusing to issue or verify handover OTP."
    );
  }

  // Safe deterministic 32-byte hex fallback strictly for local dev and automated tests
  return "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

/**
 * Derives cryptographic sub-keys for HMAC-SHA-256 digest and AES-256-GCM encryption
 * using standard RFC 5869 HKDF (crypto.hkdfSync) with distinct domain-separated contexts.
 */
function deriveSubKeys() {
  const masterHex = getDeliveryOtpSecret();
  const masterSecret = Buffer.from(masterHex, "hex");
  const salt = Buffer.from("pet-protocols-delivery-otp-salt-v1", "utf8");

  const hmacKey = Buffer.from(
    crypto.hkdfSync("sha256", masterSecret, salt, Buffer.from("delivery-otp-hmac-v1", "utf8"), 32)
  );
  const aesKey = Buffer.from(
    crypto.hkdfSync("sha256", masterSecret, salt, Buffer.from("delivery-otp-aes-v1", "utf8"), 32)
  );

  return { hmacKey, aesKey };
}

/**
 * Generates a cryptographically secure 4-digit numeric code preserving leading zeros.
 * Uniform distribution over 0000 - 9999.
 * @returns {string} 4-digit string
 */
export function generateSecureOtpCode() {
  const num = crypto.randomInt(0, 10000);
  return num.toString().padStart(4, "0");
}

/**
 * Computes a keyed HMAC-SHA-256 digest bound to order ID, issuance ID, and OTP code.
 * Prevents transplanting digests between orders or across reissuances.
 */
export function computeOtpDigest(orderId, issuanceId, otpCode) {
  if (!orderId || !issuanceId || !otpCode) {
    throw new Error("Missing parameters for OTP digest computation");
  }
  const { hmacKey } = deriveSubKeys();
  const payload = `${orderId.toString()}:${issuanceId}:${otpCode.toString().trim()}`;
  return crypto.createHmac("sha256", hmacKey).update(payload).digest("hex");
}

/**
 * Performs constant-time comparison of candidate OTP code against stored HMAC digest.
 */
export function verifyOtpDigest(orderId, issuanceId, candidateCode, storedDigest) {
  if (!candidateCode || typeof candidateCode !== "string" || !/^\d{4}$/.test(candidateCode.trim())) {
    return false;
  }
  if (!storedDigest || typeof storedDigest !== "string" || storedDigest.length !== 64) {
    return false;
  }
  const candidateDigest = computeOtpDigest(orderId, issuanceId, candidateCode.trim());
  const a = Buffer.from(candidateDigest, "hex");
  const b = Buffer.from(storedDigest, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Encrypts OTP code using AES-256-GCM for encrypted-at-rest storage in MongoDB.
 * Binds ciphertext to orderId and issuanceId via Authenticated Additional Data (AAD).
 * Never stores plaintext OTP in database.
 */
export function encryptOtpCode(otpCode, { orderId, issuanceId } = {}) {
  const { aesKey } = deriveSubKeys();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

  if (orderId && issuanceId) {
    const aad = Buffer.from(`${orderId.toString()}:${issuanceId.toString()}`, "utf8");
    cipher.setAAD(aad);
  }

  let ciphertext = cipher.update(otpCode.toString().trim(), "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  if (orderId && issuanceId) {
    return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
  }
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
}

/**
 * Decrypts AES-256-GCM encrypted OTP payload in-memory for authorized customer retrieval.
 * Authenticates AAD context if present, failing closed if payload or context was tampered.
 */
export function decryptOtpCode(encryptedPayload, { orderId, issuanceId } = {}) {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    return null;
  }
  const parts = encryptedPayload.split(":");
  let hasAad = false;
  let ivHex, authTagHex, cipherHex;

  if (parts.length === 4 && parts[0] === "v1") {
    hasAad = true;
    [, ivHex, authTagHex, cipherHex] = parts;
  } else if (parts.length === 3) {
    [ivHex, authTagHex, cipherHex] = parts;
  } else {
    return null;
  }

  try {
    const { aesKey } = deriveSubKeys();
    const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    if (hasAad) {
      if (!orderId || !issuanceId) {
        return null;
      }
      const aad = Buffer.from(`${orderId.toString()}:${issuanceId.toString()}`, "utf8");
      decipher.setAAD(aad);
    }

    let decrypted = decipher.update(cipherHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return /^\d{4}$/.test(decrypted) ? decrypted : null;
  } catch (err) {
    return null;
  }
}

/**
 * Issues or retrieves the active handover OTP for an eligible delivery order.
 *
 * @param {Object} order - Mongoose Order document or ID
 * @param {Object} options
 * @param {boolean} options.forceRegenerate - If true, reissues a new code invalidating prior code
 * @param {string} options.requestedBy - Actor ("customer" | "system")
 * @returns {Promise<Object>} Result containing plaintext code (for initial response only) and metadata
 */
export async function issueDeliveryOtpForOrder(order, { forceRegenerate = false, requestedBy = "system" } = {}) {
  const orderDoc = typeof order._id !== "undefined" ? order : await Order.findById(order);
  if (!orderDoc) {
    return { success: false, status: 404, message: "Order not found." };
  }

  // Counter pickups do not use delivery OTP
  const isPickup = typeof orderDoc.isPickupOrder === "function" ? orderDoc.isPickupOrder() : Order.isPickupOrder(orderDoc);
  if (isPickup) {
    return { success: false, status: 400, message: "Pickup orders do not require delivery handover OTP." };
  }

  // Must be in out_for_delivery status to issue/use handover code
  if (orderDoc.status !== "out_for_delivery") {
    return {
      success: false,
      status: 400,
      message: `Delivery OTP is only active during delivery transit ('out_for_delivery'). Current status: '${orderDoc.status}'.`,
    };
  }

  const existingOtp = orderDoc.deliveryOtp;
  const now = new Date();

  // If already issued, unexpired, and not force regenerated, return existing active code
  if (
    !forceRegenerate &&
    existingOtp?.status === "issued" &&
    existingOtp.expiresAt &&
    new Date(existingOtp.expiresAt) > now &&
    existingOtp.attemptCount < (existingOtp.maxAttempts || MAX_ATTEMPTS) &&
    existingOtp.encryptedCode
  ) {
    const decrypted = decryptOtpCode(existingOtp.encryptedCode, {
      orderId: orderDoc._id,
      issuanceId: existingOtp.issuanceId,
    });
    if (decrypted) {
      return {
        success: true,
        alreadyIssued: true,
        otpCode: decrypted,
        issuanceId: existingOtp.issuanceId,
        expiresAt: existingOtp.expiresAt,
        status: existingOtp.status,
        attemptCount: existingOtp.attemptCount,
        maxAttempts: existingOtp.maxAttempts || MAX_ATTEMPTS,
      };
    }
  }

  // Rate-limiting check for reissuance
  if (forceRegenerate && existingOtp?.lastIssuedAt) {
    const elapsedSeconds = (now.getTime() - new Date(existingOtp.lastIssuedAt).getTime()) / 1000;
    if (elapsedSeconds < REISSUE_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(REISSUE_COOLDOWN_SECONDS - elapsedSeconds);
      return {
        success: false,
        status: 429,
        message: `Please wait ${waitSeconds}s before requesting a new handover code.`,
      };
    }

    const currentReissues = Number(existingOtp.reissueCount || 0);
    if (currentReissues >= MAX_REISSUES_PER_ORDER) {
      return {
        success: false,
        status: 429,
        message: `Maximum handover code reissues (${MAX_REISSUES_PER_ORDER}) exceeded for this delivery.`,
      };
    }
  }

  // Generate fresh secure 4-digit code
  const otpCode = generateSecureOtpCode();
  const issuanceId = crypto.randomUUID();
  const codeDigest = computeOtpDigest(orderDoc._id, issuanceId, otpCode);
  const encryptedCode = encryptOtpCode(otpCode, { orderId: orderDoc._id, issuanceId });
  const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_MINUTES * 60 * 1000);

  const updateDoc = {
    $set: {
      "deliveryOtp.status": "issued",
      "deliveryOtp.issuanceId": issuanceId,
      "deliveryOtp.codeDigest": codeDigest,
      "deliveryOtp.encryptedCode": encryptedCode,
      "deliveryOtp.expiresAt": expiresAt,
      "deliveryOtp.attemptCount": 0,
      "deliveryOtp.maxAttempts": MAX_ATTEMPTS,
      "deliveryOtp.lastIssuedAt": now,
      "deliveryOtp.lastAttemptAt": null,
      "deliveryOtp.lockedUntil": null,
      "deliveryOtp.verifiedAt": null,
      "deliveryOtp.verifiedBy": null,
    },
    $inc: {
      "deliveryOtp.reissueCount": forceRegenerate ? 1 : 0,
      __v: 1,
    },
  };

  const updated = await Order.findOneAndUpdate(
    { _id: orderDoc._id, status: "out_for_delivery" },
    updateDoc,
    { returnDocument: "after" }
  );

  if (!updated) {
    return {
      success: false,
      status: 409,
      message: "Order status was concurrently modified while generating handover code.",
    };
  }

  return {
    success: true,
    reissued: Boolean(forceRegenerate),
    otpCode,
    issuanceId,
    expiresAt,
    status: "issued",
    attemptCount: 0,
    maxAttempts: MAX_ATTEMPTS,
  };
}

/**
 * Atomically validates driver handover code and completes delivery order.
 * Protects against race conditions, replay, reassignments, and cancellations.
 *
 * @param {Object} params
 * @param {string} params.orderId - MongoDB order ID
 * @param {string} params.restaurantId - Scoped restaurant ID
 * @param {Object} params.staffUser - Authenticated user record
 * @param {string} params.otpCode - 4-digit handover code submitted by driver
 * @param {Object} params.codPaymentHandler - Optional COD cash collection payload
 * @returns {Promise<Object>} Outcome of atomic handover verification
 */
export async function verifyAndCompleteDelivery({
  orderId,
  restaurantId,
  staffUser,
  otpCode,
  codPaymentHandler = null,
  transitionNote = "Delivered to customer following successful OTP handover verification",
}) {
  if (!orderId) {
    return { success: false, status: 400, message: "Order ID is required." };
  }

  // 1. Fetch current order document to verify eligibility and driver assignment
  const order = await Order.findOne({ _id: orderId, restaurant: restaurantId }).select(
    "+deliveryOtp.codeDigest +deliveryOtp.encryptedCode"
  );
  if (!order) {
    return { success: false, status: 404, message: "Order not found." };
  }

  // Counter pickup check
  const isPickup = typeof order.isPickupOrder === "function" ? order.isPickupOrder() : Order.isPickupOrder(order);
  if (isPickup) {
    return { success: false, status: 400, message: "Pickup orders do not require delivery handover OTP." };
  }

  // Lifecycle state check: Order must be currently out_for_delivery
  if (order.status !== "out_for_delivery") {
    return {
      success: false,
      status: 400,
      message: `Cannot verify handover for order with status '${order.status}'. Handover verification requires 'out_for_delivery'.`,
    };
  }

  // Driver authorization check: Staff must be active Delivery role
  const rawRoles = Array.isArray(staffUser?.staffRoles) && staffUser.staffRoles.length > 0
    ? staffUser.staffRoles
    : (staffUser?.staffRole ? [staffUser.staffRole] : [staffUser?.role]);
  const staffRoles = rawRoles.filter(Boolean);
  const isDeliveryStaff = staffRoles.includes("Delivery");
  const isManager = staffRoles.includes("Manager") || staffUser?.role === "restaurant_admin" || staffUser?.role === "superadmin";

  if (!isDeliveryStaff && !isManager) {
    return {
      success: false,
      status: 403,
      message: "Access denied. Only authorized delivery staff can verify customer handover.",
    };
  }

  // Driver assignment check: Driver must be the currently assigned driver
  const assignedId = order.assignedDeliveryStaff?.id?.toString();
  const staffId = staffUser?._id?.toString();

  if (!assignedId) {
    return {
      success: false,
      status: 400,
      message: "This order does not have an assigned delivery driver. Claim the order before completing delivery.",
    };
  }

  if (assignedId !== staffId && !isManager) {
    return {
      success: false,
      status: 403,
      message: "Access denied. You are not the assigned delivery driver for this order.",
    };
  }

  // 2. Validate OTP format
  const sanitizedCode = typeof otpCode === "string" ? otpCode.trim() : "";
  if (!/^\d{4}$/.test(sanitizedCode)) {
    return {
      success: false,
      status: 400,
      message: "Invalid handover code format. Handover code must be exactly 4 digits.",
    };
  }

  const otpData = order.deliveryOtp;
  const now = new Date();

  // 3. Verify OTP state
  if (!otpData || !otpData.codeDigest || !otpData.issuanceId) {
    return {
      success: false,
      status: 400,
      message: "No active delivery handover code found for this order. Please ask the customer to refresh their tracker.",
    };
  }

  // Check attempt limit
  const maxAttempts = otpData.maxAttempts || MAX_ATTEMPTS;
  if (otpData.attemptCount >= maxAttempts || otpData.status === "max_attempts_exceeded") {
    return {
      success: false,
      status: 429,
      attemptsExceeded: true,
      message: "Maximum verification attempts exceeded. Please ask the customer to generate a new handover code.",
    };
  }

  // Check expiry
  if (otpData.status === "expired" || (otpData.expiresAt && new Date(otpData.expiresAt) <= now)) {
    if (otpData.status !== "expired") {
      await Order.updateOne(
        { _id: order._id, "deliveryOtp.issuanceId": otpData.issuanceId },
        { $set: { "deliveryOtp.status": "expired" } }
      );
    }
    return {
      success: false,
      status: 400,
      codeExpired: true,
      message: "The customer's handover code has expired. Please ask the customer to tap 'Reissue Code' on their screen.",
    };
  }

  if (otpData.status !== "issued") {
    return {
      success: false,
      status: 400,
      message: `Handover code is not active (current status: '${otpData.status}'). Please ask the customer to reissue.`,
    };
  }

  // 4. Verify candidate digest using constant-time comparison
  const isValid = verifyOtpDigest(order._id, otpData.issuanceId, sanitizedCode, otpData.codeDigest);

  if (!isValid) {
    // Record failed attempt atomically
    const newAttemptCount = (otpData.attemptCount || 0) + 1;
    const isNowLocked = newAttemptCount >= maxAttempts;

    await Order.findOneAndUpdate(
      {
        _id: order._id,
        "deliveryOtp.issuanceId": otpData.issuanceId,
        "deliveryOtp.status": "issued",
      },
      {
        $inc: { "deliveryOtp.attemptCount": 1 },
        $set: {
          "deliveryOtp.lastAttemptAt": now,
          ...(isNowLocked ? { "deliveryOtp.status": "max_attempts_exceeded", "deliveryOtp.lockedUntil": new Date(Date.now() + 5 * 60 * 1000) } : {}),
        },
      }
    );

    const remainingAttempts = Math.max(0, maxAttempts - newAttemptCount);
    return {
      success: false,
      status: 400,
      invalidCode: true,
      remainingAttempts,
      message: isNowLocked
        ? "Incorrect handover code. Maximum attempts exceeded. Customer must reissue a new code."
        : `Incorrect handover code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
    };
  }

  // 5. ATOMIC COMPLETION: Code is valid! Transition to delivered atomically
  const atomicQuery = {
    _id: order._id,
    restaurant: restaurantId,
    status: "out_for_delivery",
    "deliveryOtp.issuanceId": otpData.issuanceId,
    "deliveryOtp.status": "issued",
    "deliveryOtp.expiresAt": { $gt: now },
    "deliveryOtp.attemptCount": { $lt: maxAttempts },
  };

  // F2 Security Invariant: Driver-specific completion must enforce current assignment at atomic boundary
  if (!isManager) {
    atomicQuery["assignedDeliveryStaff.id"] = { $in: [staffUser._id, String(staffUser._id)] };
  }

  const setFields = {
    status: "delivered",
    "deliveryOtp.status": "verified",
    "deliveryOtp.verifiedAt": now,
    "deliveryOtp.verifiedBy": {
      id: staffUser._id,
      name: staffUser.name || "Delivery Staff",
      phone: staffUser.phone || "",
    },
    "deliveryTracking.isLive": false,
    "deliveryTracking.endedAt": now,
    "deliveryTracking.endReason": "delivered",
    "deliveryTracking.lastUpdatedAt": now,
  };

  // F3 Security Invariant: Server-Authoritative COD Collection & Prohibit Driver Self-Settlement
  const isCodOrder = typeof order.isCodOrder === "function" ? order.isCodOrder() : Order.isCodOrder(order);

  if (isCodOrder) {
    const isAlreadyPaid = order.paymentStatus === "paid" || order.codPaymentHandler?.collected === true;
    if (!isAlreadyPaid) {
      const validAmount = Number.isFinite(order.totalAmount) && order.totalAmount >= 0 ? order.totalAmount : 0;
      setFields.codPaymentHandler = {
        id: staffUser._id,
        name: staffUser.name || "Delivery Staff",
        phone: staffUser.phone || "",
        amount: validAmount,
        collected: true,
        collectedAt: now,
        settledWithManager: false, // Drivers CANNOT self-settle
        settledAt: null,
        settledBy: null,
      };
      setFields.paymentStatus = "paid";
      setFields.paidAt = now;
    }
  }

  const updateOperation = {
    $set: setFields,
    $push: {
      statusHistory: {
        status: "delivered",
        changedAt: now,
        changedBy: {
          userId: staffUser._id,
          role: staffUser.role || "staff",
          name: staffUser.name || "Delivery Staff",
        },
        note: transitionNote,
      },
    },
    $inc: { __v: 1 },
  };

  if (typeof _preAtomicCommitHook === "function") {
    await _preAtomicCommitHook(order);
  }

  const updatedOrder = await Order.findOneAndUpdate(atomicQuery, updateOperation, { returnDocument: "after" });

  if (!updatedOrder) {
    // Check if the update conflict was caused by driver reassignment
    const currentOrder = await Order.findById(order._id).select("status assignedDeliveryStaff").lean();
    if (
      currentOrder &&
      currentOrder.assignedDeliveryStaff?.id &&
      String(currentOrder.assignedDeliveryStaff.id) !== staffId &&
      !isManager
    ) {
      return {
        success: false,
        status: 409,
        conflict: true,
        reassigned: true,
        message: "Conflict: Order has been reassigned to another delivery driver. Handover verification aborted.",
      };
    }

    return {
      success: false,
      status: 409,
      conflict: true,
      message: "Conflict: Order was concurrently modified, cancelled, or already delivered. Verification aborted.",
    };
  }

  // F4: Restore customer and restaurant push notification dispatch upon delivery completion
  try {
    Order.findById(updatedOrder._id)
      .populate("restaurant", "name slug phone")
      .populate("user", "name email phone")
      .then((populated) => {
        const notifyFn = _notifyOrderEvent || notifyOrderEvent;
        notifyFn(populated || updatedOrder, "status_update", {
          status: "delivered",
          previousStatus: "out_for_delivery",
          reason: transitionNote,
        }).catch((pushErr) => {
          console.warn("[DeliveryOTP Push Warning] Non-blocking push notification warning:", pushErr.message);
        });
        enqueueOrderEvents(populated || updatedOrder, "status_update", {
          status: "delivered",
          previousStatus: "out_for_delivery",
          reason: transitionNote,
        }).catch((outboxErr) => {
          console.warn("[DeliveryOTP Outbox Warning] Non-blocking outbox warning:", outboxErr.message);
        });
      })
      .catch(() => {});
  } catch (err) {
    console.warn("[DeliveryOTP Push Dispatch Warning]", err.message);
  }

  return {
    success: true,
    status: 200,
    order: updatedOrder,
    message: "Handover successfully verified! Order marked delivered.",
  };
}
