/**
 * AI Token Utility (Portal AI API - Stage 1)
 *
 * Provides functions to mint and verify short-lived AI tokens for the desktop app.
 * AI tokens are separate from customer JWTs and lease tokens.
 *
 * Token type: "ai"
 * Default TTL: 15 minutes (900 seconds)
 * Algorithm: RS256 if keys configured, else HS256 fallback for dev
 */

"use strict";

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getRS256PrivateKey } = require("./jwt-keys");

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Default AI token TTL: 15 minutes in seconds.
 * Override via AI_TOKEN_TTL_SECONDS environment variable.
 */
const DEFAULT_AI_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * Get the AI token TTL from environment or use default.
 * @returns {number} TTL in seconds
 */
function getAiTokenTtlSeconds() {
  const envTtl = parseInt(process.env.AI_TOKEN_TTL_SECONDS, 10);
  if (!isNaN(envTtl) && envTtl > 0) {
    return envTtl;
  }
  return DEFAULT_AI_TOKEN_TTL_SECONDS;
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

/**
 * Get signing config: prefer RS256 if keys are available, else HS256 fallback.
 * @returns {{ key: string, algorithm: string }}
 */
function getSigningConfig() {
  const privateKey = getRS256PrivateKey();
  if (privateKey) {
    return { key: privateKey, algorithm: "RS256" };
  }
  // Fallback to HS256 with JWT_SECRET (dev friendliness)
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("No signing key configured: JWT_PRIVATE_KEY or JWT_SECRET required");
  }
  return { key: secret, algorithm: "HS256" };
}

/**
 * Get verification config: prefer RS256 if keys are available, else HS256 fallback.
 * @returns {{ key: string, algorithms: string[] }}
 */
function getVerifyConfig() {
  const publicKey = getRS256PublicKey();
  if (publicKey) {
    return { key: publicKey, algorithms: ["RS256"] };
  }
  // Fallback to HS256 with JWT_SECRET
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("No verification key configured: JWT_PUBLIC_KEY or JWT_SECRET required");
  }
  return { key: secret, algorithms: ["HS256"] };
}

// -----------------------------------------------------------------------------
// AI Token Functions
// -----------------------------------------------------------------------------

/**
 * Mint an AI token for the desktop app.
 *
 * @param {Object} params
 * @param {number} params.customerId - The customer ID
 * @param {number} [params.entitlementId] - The active entitlement ID (optional but recommended)
 * @param {number} [ttlSeconds] - Override TTL in seconds (default: 15 min)
 * @returns {{ token: string, expiresAt: string, jti: string }}
 */
function mintAiToken({ customerId, entitlementId }, ttlSeconds) {
  if (!customerId) {
    throw new Error("customerId is required to mint AI token");
  }

  const { key, algorithm } = getSigningConfig();

  const now = Math.floor(Date.now() / 1000);
  const ttl = ttlSeconds || getAiTokenTtlSeconds();
  const exp = now + ttl;
  const jti = crypto.randomUUID();

  const payload = {
    // Standard claims
    iss: process.env.JWT_ISSUER || "lightlane",
    sub: `ai:customer:${customerId}`,
    jti,
    iat: now,
    exp,
    // Custom claims
    type: "ai",
    customerId,
  };

  // Only include entitlementId if provided
  if (entitlementId) {
    payload.entitlementId = entitlementId;
  }

  const token = jwt.sign(payload, key, { algorithm });

  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    jti,
  };
}

/**
 * Verify an AI token and return its decoded claims.
 *
 * @param {string} token - The AI JWT token
 * @returns {{ valid: true, claims: Object } | { valid: false, error: string, code: string }}
 */
function verifyAiToken(token) {
  if (!token || typeof token !== "string") {
    return {
      valid: false,
      error: "Token is required",
      code: "TOKEN_MISSING",
    };
  }

  const { key, algorithms } = getVerifyConfig();

  try {
    const decoded = jwt.verify(token, key, { algorithms });

    // Validate token type
    if (decoded.type !== "ai") {
      return {
        valid: false,
        error: `Invalid token type: expected 'ai', got '${decoded.type || "undefined"}'`,
        code: "INVALID_TOKEN_TYPE",
      };
    }

    // Validate required claims
    if (!decoded.customerId) {
      return {
        valid: false,
        error: "Token missing customerId claim",
        code: "INVALID_TOKEN_CLAIMS",
      };
    }

    return {
      valid: true,
      claims: decoded,
    };
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return {
        valid: false,
        error: "AI token has expired",
        code: "TOKEN_EXPIRED",
        expiredAt: err.expiredAt,
      };
    }
    if (err.name === "JsonWebTokenError") {
      return {
        valid: false,
        error: `Invalid AI token: ${err.message}`,
        code: "TOKEN_INVALID",
      };
    }
    return {
      valid: false,
      error: `Token verification failed: ${err.message}`,
      code: "TOKEN_VERIFICATION_FAILED",
    };
  }
}

module.exports = {
  mintAiToken,
  verifyAiToken,
  getAiTokenTtlSeconds,
  DEFAULT_AI_TOKEN_TTL_SECONDS,
};
