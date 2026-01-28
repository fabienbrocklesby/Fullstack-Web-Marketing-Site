/**
 * Air-Gapped Offline Codes Utility
 *
 * Provides codec and cryptographic verification utilities for the air-gapped
 * device activation flow. This includes:
 * - Base64URL encoding/decoding
 * - Device setup code parsing and validation
 * - Ed25519 signature verification for refresh/deactivation codes
 * - Replay protection JTI recording
 *
 * This module uses only Node built-in crypto (no new dependencies).
 */

"use strict";

const crypto = require("crypto");

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Default offline activation token TTL: 72 hours in seconds.
 * Override via OFFLINE_ACTIVATION_TTL_SECONDS environment variable.
 */
const DEFAULT_OFFLINE_ACTIVATION_TTL_SECONDS = 72 * 60 * 60; // 72 hours

/**
 * Get the offline activation token TTL from environment or use default.
 * @returns {number} TTL in seconds
 */
function getOfflineActivationTtlSeconds() {
  const envTtl = parseInt(process.env.OFFLINE_ACTIVATION_TTL_SECONDS, 10);
  if (!isNaN(envTtl) && envTtl > 0) {
    return envTtl;
  }
  return DEFAULT_OFFLINE_ACTIVATION_TTL_SECONDS;
}

// -----------------------------------------------------------------------------
// Base64URL Encoding/Decoding
// -----------------------------------------------------------------------------

/**
 * Regex for valid base64url characters (URL-safe, no padding)
 */
const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Validate that a string is valid base64url format.
 * @param {string} input - String to validate
 * @returns {{ ok: boolean, error?: string }}
 */
function validateBase64Url(input) {
  if (typeof input !== "string") {
    return { ok: false, error: "Input must be a string" };
  }
  if (input.length === 0) {
    return { ok: false, error: "Input is empty" };
  }
  if (input.length < 20) {
    return { ok: false, error: "Code is too short" };
  }
  if (input.length > 50000) {
    return { ok: false, error: "Code is too large" };
  }
  if (!BASE64URL_REGEX.test(input)) {
    return { ok: false, error: "Code contains invalid characters (not base64url)" };
  }
  return { ok: true };
}

/**
 * Encode a buffer or string to base64url (URL-safe base64 without padding).
 * @param {Buffer|string} input - Input to encode
 * @returns {string} Base64URL encoded string
 */
function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");
  return buffer.toString("base64url");
}

/**
 * Decode a base64url string to Buffer.
 * @param {string} input - Base64URL encoded string
 * @returns {Buffer} Decoded buffer
 * @throws {Error} If input is not valid base64url
 */
function base64UrlDecode(input) {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }
  // base64url decoder in Node handles both URL-safe and standard base64
  return Buffer.from(input, "base64url");
}

/**
 * Decode a base64url JSON string to an object.
 * @param {string} input - Base64URL encoded JSON string
 * @returns {object} Parsed JSON object
 * @throws {Error} If input is not valid base64url or JSON
 */
function base64UrlDecodeJson(input) {
  const buffer = base64UrlDecode(input);
  const jsonStr = buffer.toString("utf-8");
  return JSON.parse(jsonStr);
}

/**
 * Encode an object to base64url JSON string.
 * @param {object} obj - Object to encode
 * @returns {string} Base64URL encoded JSON string
 */
function base64UrlEncodeJson(obj) {
  const jsonStr = JSON.stringify(obj);
  return base64UrlEncode(jsonStr);
}

// -----------------------------------------------------------------------------
// Code Validation Schemas
// -----------------------------------------------------------------------------

const CODE_SCHEMAS = {
  device_setup: {
    v: { type: "number", required: true, enum: [1] },
    type: { type: "string", required: true, enum: ["device_setup"] },
    deviceId: { type: "string", required: true, minLength: 3, maxLength: 256 },
    deviceName: { type: "string", required: false, maxLength: 256 },
    platform: { type: "string", required: false, maxLength: 64 },
    publicKey: { type: "string", required: true, minLength: 32, maxLength: 1024 },
    createdAt: { type: "string", required: true, maxLength: 64 },
  },
  lease_refresh_request: {
    v: { type: "number", required: true, enum: [1] },
    type: { type: "string", required: true, enum: ["lease_refresh_request"] },
    deviceId: { type: "string", required: true, minLength: 3, maxLength: 256 },
    entitlementId: { type: "number", required: true },
    jti: { type: "string", required: true, minLength: 8, maxLength: 128 },
    iat: { type: "string", required: true, maxLength: 64 },
    sig: { type: "string", required: true, minLength: 32, maxLength: 512 },
  },
  deactivation_code: {
    v: { type: "number", required: true, enum: [1] },
    type: { type: "string", required: true, enum: ["deactivation_code"] },
    deviceId: { type: "string", required: true, minLength: 3, maxLength: 256 },
    entitlementId: { type: "number", required: true },
    jti: { type: "string", required: true, minLength: 8, maxLength: 128 },
    iat: { type: "string", required: true, maxLength: 64 },
    sig: { type: "string", required: true, minLength: 32, maxLength: 512 },
  },
};

/**
 * Validate an object against a schema.
 * @param {object} obj - Object to validate
 * @param {object} schema - Schema definition
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
function validateSchema(obj, schema) {
  if (!obj || typeof obj !== "object") {
    return { valid: false, error: "Input must be an object" };
  }

  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];

    // Check required
    if (rules.required && (value === undefined || value === null)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }

    // Skip optional fields that are not present
    if (value === undefined || value === null) {
      continue;
    }

    // Check type
    if (rules.type === "number") {
      if (typeof value !== "number" || isNaN(value)) {
        return { valid: false, error: `Field ${field} must be a number` };
      }
    } else if (rules.type === "string") {
      if (typeof value !== "string") {
        return { valid: false, error: `Field ${field} must be a string` };
      }
      // Check length constraints
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        return { valid: false, error: `Field ${field} too short (min ${rules.minLength})` };
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        return { valid: false, error: `Field ${field} too long (max ${rules.maxLength})` };
      }
    }

    // Check enum
    if (rules.enum && !rules.enum.includes(value)) {
      return { valid: false, error: `Field ${field} must be one of: ${rules.enum.join(", ")}` };
    }
  }

  return { valid: true };
}

// -----------------------------------------------------------------------------
// Code Parsing
// -----------------------------------------------------------------------------

/**
 * Parse and validate a device setup code.
 * @param {string} setupCode - Base64URL encoded device setup code
 * @returns {{ ok: boolean, data?: object, error?: string, errorCode?: string }}
 */
function parseDeviceSetupCode(setupCode) {
  // Step 1: Validate base64url format
  const formatResult = validateBase64Url(setupCode);
  if (!formatResult.ok) {
    return { ok: false, error: formatResult.error, errorCode: "INVALID_BASE64URL" };
  }

  // Step 2: Size limit check (4KB max for setup code)
  if (setupCode.length > 4096) {
    return { ok: false, error: "Setup code too large (max 4KB)", errorCode: "CODE_TOO_LARGE" };
  }

  // Step 3: Decode and parse JSON
  let data;
  try {
    const buffer = base64UrlDecode(setupCode);
    const jsonStr = buffer.toString("utf-8");
    data = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: "Invalid code format (not valid JSON)", errorCode: "INVALID_JSON" };
  }

  // Step 4: Validate it's an object
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Invalid code format (expected object)", errorCode: "INVALID_STRUCTURE" };
  }

  // Step 5: Validate version
  if (data.v !== 1) {
    return { ok: false, error: `Unsupported code version: ${data.v}`, errorCode: "INVALID_VERSION" };
  }

  // Step 6: Validate type
  if (data.type !== "device_setup") {
    return { ok: false, error: `Invalid code type: expected device_setup, got ${data.type}`, errorCode: "INVALID_TYPE" };
  }

  // Step 7: Validate schema fields
  const validation = validateSchema(data, CODE_SCHEMAS.device_setup);
  if (!validation.valid) {
    return { ok: false, error: validation.error, errorCode: "INVALID_FIELDS" };
  }

  return { ok: true, data };
}

/**
 * Parse and validate a lease refresh request code.
 * @param {string} requestCode - Base64URL encoded request code
 * @returns {{ ok: boolean, data?: object, error?: string, errorCode?: string }}
 */
function parseLeaseRefreshRequestCode(requestCode) {
  // Step 1: Validate base64url format
  const formatResult = validateBase64Url(requestCode);
  if (!formatResult.ok) {
    return { ok: false, error: formatResult.error, errorCode: "INVALID_BASE64URL" };
  }

  // Step 2: Size limit check (2KB max)
  if (requestCode.length > 2048) {
    return { ok: false, error: "Request code too large (max 2KB)", errorCode: "CODE_TOO_LARGE" };
  }

  // Step 3: Decode and parse JSON
  let data;
  try {
    const buffer = base64UrlDecode(requestCode);
    const jsonStr = buffer.toString("utf-8");
    data = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: "Invalid code format (not valid JSON)", errorCode: "INVALID_JSON" };
  }

  // Step 4: Validate it's an object
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Invalid code format (expected object)", errorCode: "INVALID_STRUCTURE" };
  }

  // Step 5: Validate version
  if (data.v !== 1) {
    return { ok: false, error: `Unsupported code version: ${data.v}`, errorCode: "INVALID_VERSION" };
  }

  // Step 6: Validate type
  if (data.type !== "lease_refresh_request") {
    return { ok: false, error: `Invalid code type: expected lease_refresh_request, got ${data.type}`, errorCode: "INVALID_TYPE" };
  }

  // Step 7: Validate schema fields
  const validation = validateSchema(data, CODE_SCHEMAS.lease_refresh_request);
  if (!validation.valid) {
    return { ok: false, error: validation.error, errorCode: "INVALID_FIELDS" };
  }

  return { ok: true, data };
}

/**
 * Parse and validate a deactivation code.
 * @param {string} deactivationCode - Base64URL encoded deactivation code
 * @returns {{ ok: boolean, data?: object, error?: string, errorCode?: string }}
 */
function parseDeactivationCode(deactivationCode) {
  // Step 1: Validate base64url format
  const formatResult = validateBase64Url(deactivationCode);
  if (!formatResult.ok) {
    return { ok: false, error: formatResult.error, errorCode: "INVALID_BASE64URL" };
  }

  // Step 2: Size limit check (2KB max)
  if (deactivationCode.length > 2048) {
    return { ok: false, error: "Deactivation code too large (max 2KB)", errorCode: "CODE_TOO_LARGE" };
  }

  // Step 3: Decode and parse JSON
  let data;
  try {
    const buffer = base64UrlDecode(deactivationCode);
    const jsonStr = buffer.toString("utf-8");
    data = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: "Invalid code format (not valid JSON)", errorCode: "INVALID_JSON" };
  }

  // Step 4: Validate it's an object
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Invalid code format (expected object)", errorCode: "INVALID_STRUCTURE" };
  }

  // Step 5: Validate version
  if (data.v !== 1) {
    return { ok: false, error: `Unsupported code version: ${data.v}`, errorCode: "INVALID_VERSION" };
  }

  // Step 6: Validate type
  if (data.type !== "deactivation_code") {
    return { ok: false, error: `Invalid code type: expected deactivation_code, got ${data.type}`, errorCode: "INVALID_TYPE" };
  }

  // Step 7: Validate schema fields
  const validation = validateSchema(data, CODE_SCHEMAS.deactivation_code);
  if (!validation.valid) {
    return { ok: false, error: validation.error, errorCode: "INVALID_FIELDS" };
  }

  return { ok: true, data };
}

// -----------------------------------------------------------------------------
// Ed25519 Key Handling
// -----------------------------------------------------------------------------

/**
 * Import an Ed25519 public key from base64 SPKI DER format.
 * @param {string} publicKeyBase64 - Base64 encoded SPKI DER public key
 * @returns {{ ok: boolean, publicKey?: crypto.KeyObject, error?: string }}
 */
function importEd25519PublicKey(publicKeyBase64) {
  try {
    const keyBuffer = Buffer.from(publicKeyBase64, "base64");

    // Import as SPKI DER
    const publicKey = crypto.createPublicKey({
      key: keyBuffer,
      format: "der",
      type: "spki",
    });

    // Verify it's Ed25519
    if (publicKey.asymmetricKeyType !== "ed25519") {
      return {
        ok: false,
        error: `Invalid key type: expected ed25519, got ${publicKey.asymmetricKeyType}`,
      };
    }

    return { ok: true, publicKey };
  } catch (err) {
    return { ok: false, error: `Failed to import public key: ${err.message}` };
  }
}

/**
 * Compute SHA256 hash of SPKI bytes.
 * @param {string} publicKeyBase64 - Base64 encoded SPKI DER public key
 * @returns {string} Hex-encoded SHA256 hash
 */
function computePublicKeyHash(publicKeyBase64) {
  const keyBuffer = Buffer.from(publicKeyBase64, "base64");
  return crypto.createHash("sha256").update(keyBuffer).digest("hex");
}

// -----------------------------------------------------------------------------
// Signature Building and Verification
// -----------------------------------------------------------------------------

/**
 * Build the canonical signature message for lease refresh request.
 * Format: "LL|v1|lease_refresh_request\n<deviceId>\n<entitlementId>\n<jti>\n<iat>"
 * @param {object} params
 * @param {string} params.deviceId
 * @param {number} params.entitlementId
 * @param {string} params.jti
 * @param {string} params.iat
 * @returns {Buffer} Message buffer
 */
function buildLeaseRefreshSignatureMessage({ deviceId, entitlementId, jti, iat }) {
  const message = `LL|v1|lease_refresh_request\n${deviceId}\n${entitlementId}\n${jti}\n${iat}`;
  return Buffer.from(message, "utf-8");
}

/**
 * Build the canonical signature message for deactivation code.
 * Format: "LL|v1|deactivation_code\n<deviceId>\n<entitlementId>\n<jti>\n<iat>"
 * @param {object} params
 * @param {string} params.deviceId
 * @param {number} params.entitlementId
 * @param {string} params.jti
 * @param {string} params.iat
 * @returns {Buffer} Message buffer
 */
function buildDeactivationSignatureMessage({ deviceId, entitlementId, jti, iat }) {
  const message = `LL|v1|deactivation_code\n${deviceId}\n${entitlementId}\n${jti}\n${iat}`;
  return Buffer.from(message, "utf-8");
}

/**
 * Verify an Ed25519 signature.
 * @param {Buffer} message - Message that was signed
 * @param {string} signatureBase64Url - Base64URL encoded signature
 * @param {crypto.KeyObject} publicKey - Ed25519 public key
 * @returns {boolean} True if signature is valid
 */
function verifyEd25519Signature(message, signatureBase64Url, publicKey) {
  try {
    const signatureBuffer = base64UrlDecode(signatureBase64Url);
    return crypto.verify(null, message, publicKey, signatureBuffer);
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Replay Protection
// -----------------------------------------------------------------------------

/**
 * Record a JTI for replay protection. If the JTI already exists, returns replay rejection.
 * @param {object} strapi - Strapi instance
 * @param {object} params
 * @param {string} params.jti - Unique identifier
 * @param {"LEASE_REFRESH_REQUEST"|"DEACTIVATION_CODE"} params.kind - Code type
 * @param {number} params.customerId
 * @param {number} params.entitlementId
 * @param {string} params.deviceId
 * @param {Date} [params.expiresAt] - Optional expiry for cleanup purposes
 * @returns {{ ok: boolean, replay?: boolean, error?: string }}
 */
async function recordJtiOrReplay(strapi, { jti, kind, customerId, entitlementId, deviceId, expiresAt }) {
  try {
    // Check if JTI already exists
    const existing = await strapi.entityService.findMany(
      "api::offline-code-use.offline-code-use",
      { filters: { jti }, limit: 1 }
    );

    if (existing && existing.length > 0) {
      return { ok: false, replay: true, error: "Code has already been used (replay rejected)" };
    }

    // Record the JTI
    await strapi.entityService.create("api::offline-code-use.offline-code-use", {
      data: {
        jti,
        kind,
        customerId,
        entitlementId,
        deviceId,
        usedAt: new Date(),
        expiresAt: expiresAt || null,
      },
    });

    return { ok: true };
  } catch (err) {
    // Handle unique constraint violation (race condition)
    if (err.message && err.message.includes("unique")) {
      return { ok: false, replay: true, error: "Code has already been used (replay rejected)" };
    }
    return { ok: false, error: `Failed to record code use: ${err.message}` };
  }
}

// -----------------------------------------------------------------------------
// Activation Package Building
// -----------------------------------------------------------------------------

/**
 * Build an activation package for offline device provisioning.
 * @param {object} params
 * @param {string} params.activationToken - RS256 signed activation JWT
 * @param {string} params.leaseToken - RS256 signed lease JWT
 * @param {string} params.leaseExpiresAt - ISO timestamp
 * @param {string} [params.entitlementExpiresAt] - ISO timestamp for trial expiry (null for lifetime/subscription)
 * @returns {string} Base64URL encoded activation package JSON
 */
function buildActivationPackage({ activationToken, leaseToken, leaseExpiresAt, entitlementExpiresAt }) {
  const packageObj = {
    v: 1,
    type: "activation_package",
    activationToken,
    leaseToken,
    leaseExpiresAt,
  };
  // Include entitlement expiry only if set (trial entitlements)
  if (entitlementExpiresAt) {
    packageObj.entitlementExpiresAt = entitlementExpiresAt;
  }
  return base64UrlEncodeJson(packageObj);
}

/**
 * Build a lease refresh response code.
 * @param {object} params
 * @param {string} params.leaseToken - RS256 signed lease JWT
 * @param {string} params.leaseExpiresAt - ISO timestamp
 * @param {string} [params.entitlementExpiresAt] - ISO timestamp for trial expiry (null for lifetime/subscription)
 * @returns {string} Base64URL encoded refresh response JSON
 */
function buildRefreshResponseCode({ leaseToken, leaseExpiresAt, entitlementExpiresAt }) {
  const responseObj = {
    v: 1,
    type: "lease_refresh_response",
    leaseToken,
    leaseExpiresAt,
  };
  // Include entitlement expiry only if set (trial entitlements)
  if (entitlementExpiresAt) {
    responseObj.entitlementExpiresAt = entitlementExpiresAt;
  }
  return base64UrlEncodeJson(responseObj);
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

module.exports = {
  // Configuration
  getOfflineActivationTtlSeconds,
  DEFAULT_OFFLINE_ACTIVATION_TTL_SECONDS,

  // Base64URL
  base64UrlEncode,
  base64UrlDecode,
  base64UrlDecodeJson,
  base64UrlEncodeJson,
  validateBase64Url,

  // Code parsing
  parseDeviceSetupCode,
  parseLeaseRefreshRequestCode,
  parseDeactivationCode,

  // Ed25519
  importEd25519PublicKey,
  computePublicKeyHash,
  verifyEd25519Signature,

  // Signature building
  buildLeaseRefreshSignatureMessage,
  buildDeactivationSignatureMessage,

  // Replay protection
  recordJtiOrReplay,

  // Package building
  buildActivationPackage,
  buildRefreshResponseCode,
};
