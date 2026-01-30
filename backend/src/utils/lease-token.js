/**
 * Lease Token Utility (Stage 5)
 *
 * Provides functions to mint and verify lease tokens for subscription-based
 * offline validation. Lease tokens are signed JWTs that prove a device has
 * an active entitlement for a limited time (default 7 days).
 *
 * Lifetime/founders entitlements do NOT require lease tokens - they are valid forever.
 */

"use strict";

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getRS256PrivateKey } = require("./jwt-keys");

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Default lease TTL: 7 days in seconds.
 * Override via LEASE_TOKEN_TTL_SECONDS environment variable.
 */
const DEFAULT_LEASE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Challenge TTL: 10 minutes in seconds.
 * Short-lived for offline challenge/response flow.
 */
const CHALLENGE_TTL_SECONDS = 10 * 60; // 10 minutes

/**
 * Get the lease token TTL from environment or use default.
 * @returns {number} TTL in seconds
 */
function getLeaseTtlSeconds() {
  const envTtl = parseInt(process.env.LEASE_TOKEN_TTL_SECONDS, 10);
  if (!isNaN(envTtl) && envTtl > 0) {
    return envTtl;
  }
  return DEFAULT_LEASE_TTL_SECONDS;
}

/**
 * Get the RS256 public key for verification.
 * @returns {string|null} The PEM-encoded public key, or null if not configured.
 */
function getRS256PublicKey() {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) {
    return null;
  }
  return key.replace(/\\n/g, "\n");
}

// -----------------------------------------------------------------------------
// Lease Token Functions
// -----------------------------------------------------------------------------

/**
 * Mint a lease token for a device/entitlement binding.
 *
 * @param {Object} params
 * @param {number} params.entitlementId - The entitlement ID
 * @param {number} params.customerId - The customer ID
 * @param {string} params.deviceId - The device identifier
 * @param {string} params.tier - The entitlement tier (maker, pro, etc.)
 * @param {boolean} params.isLifetime - Whether the entitlement is lifetime
 * @param {number} [ttlSeconds] - Override TTL in seconds (default: 7 days)
 * @returns {{ token: string, expiresAt: string, issuedAt: string, jti: string } | null}
 *          Returns null if isLifetime is true (no lease needed)
 */
function mintLeaseToken(
  { entitlementId, customerId, deviceId, tier, isLifetime },
  ttlSeconds
) {
  // Lifetime entitlements don't need lease tokens
  if (isLifetime) {
    return null;
  }

  const privateKey = getRS256PrivateKey();
  if (!privateKey) {
    throw new Error("JWT_PRIVATE_KEY not configured - cannot mint lease token");
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = ttlSeconds || getLeaseTtlSeconds();
  const exp = now + ttl;
  const jti = crypto.randomUUID();

  const payload = {
    // Standard claims
    iss: process.env.JWT_ISSUER || "lightlane",
    sub: `ent:${entitlementId}:dev:${deviceId}`,
    jti,
    iat: now,
    exp,
    // Custom claims
    purpose: "lease",
    entitlementId,
    customerId,
    deviceId,
    tier,
    isLifetime: false,
  };

  const token = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
  });

  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    issuedAt: new Date(now * 1000).toISOString(),
    jti,
  };
}

/**
 * Verify a lease token and return its decoded claims.
 *
 * @param {string} token - The JWT lease token
 * @returns {Object} Decoded claims including entitlementId, customerId, deviceId, tier
 * @throws {Error} If token is invalid, expired, or has wrong purpose
 */
function verifyLeaseToken(token) {
  const publicKey = getRS256PublicKey();
  if (!publicKey) {
    throw new Error("JWT_PUBLIC_KEY not configured - cannot verify lease token");
  }

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    });

    // Validate purpose
    if (decoded.purpose !== "lease") {
      throw new Error(`Invalid token purpose: expected 'lease', got '${decoded.purpose}'`);
    }

    return decoded;
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      const error = new Error("Lease token has expired");
      error.code = "LEASE_EXPIRED";
      error.expiredAt = err.expiredAt;
      throw error;
    }
    if (err.name === "JsonWebTokenError") {
      const error = new Error(`Invalid lease token: ${err.message}`);
      error.code = "LEASE_INVALID";
      throw error;
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Offline Challenge Functions
// -----------------------------------------------------------------------------

/**
 * Mint an offline challenge token.
 * This is a short-lived token that the offline machine can present to
 * request a new lease token via the portal.
 *
 * @param {Object} params
 * @param {number} params.entitlementId - The entitlement ID
 * @param {number} [params.customerId] - The customer ID (if known)
 * @param {string} params.deviceId - The device identifier
 * @returns {{ challenge: string, expiresAt: string, serverTime: string, nonce: string }}
 */
function mintOfflineChallenge({ entitlementId, customerId, deviceId }) {
  const privateKey = getRS256PrivateKey();
  if (!privateKey) {
    throw new Error("JWT_PRIVATE_KEY not configured - cannot mint challenge");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + CHALLENGE_TTL_SECONDS;
  const nonce = crypto.randomUUID();

  const payload = {
    iss: process.env.JWT_ISSUER || "lightlane",
    sub: `challenge:${entitlementId}:${deviceId}`,
    jti: nonce, // jti doubles as nonce for replay protection
    iat: now,
    exp,
    purpose: "offline_challenge",
    entitlementId,
    customerId: customerId || null,
    deviceId,
    nonce,
  };

  const challenge = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
  });

  return {
    challenge,
    expiresAt: new Date(exp * 1000).toISOString(),
    serverTime: new Date(now * 1000).toISOString(),
    nonce,
  };
}

/**
 * Verify an offline challenge token.
 *
 * @param {string} challenge - The challenge JWT
 * @returns {Object} Decoded claims including entitlementId, deviceId, nonce
 * @throws {Error} If token is invalid, expired, or has wrong purpose
 */
function verifyOfflineChallenge(challenge) {
  const publicKey = getRS256PublicKey();
  if (!publicKey) {
    throw new Error("JWT_PUBLIC_KEY not configured - cannot verify challenge");
  }

  try {
    const decoded = jwt.verify(challenge, publicKey, {
      algorithms: ["RS256"],
    });

    // Validate purpose
    if (decoded.purpose !== "offline_challenge") {
      throw new Error(`Invalid token purpose: expected 'offline_challenge', got '${decoded.purpose}'`);
    }

    return decoded;
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      const error = new Error("Challenge has expired");
      error.code = "CHALLENGE_EXPIRED";
      error.expiredAt = err.expiredAt;
      throw error;
    }
    if (err.name === "JsonWebTokenError") {
      const error = new Error(`Invalid challenge: ${err.message}`);
      error.code = "CHALLENGE_INVALID";
      throw error;
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

module.exports = {
  // Lease tokens
  mintLeaseToken,
  verifyLeaseToken,
  getLeaseTtlSeconds,

  // Offline challenge
  mintOfflineChallenge,
  verifyOfflineChallenge,

  // Constants
  DEFAULT_LEASE_TTL_SECONDS,
  CHALLENGE_TTL_SECONDS,
};
