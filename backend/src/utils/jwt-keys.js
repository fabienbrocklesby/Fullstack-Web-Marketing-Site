/**
 * JWT Key Loader Utility
 *
 * Loads JWT signing keys from environment variables ONLY.
 * Production and development both use environment variables.
 * No filesystem fallbacks - keys must be explicitly provided.
 */

"use strict";

/**
 * Get the RS256 private key for license JWT signing.
 * @returns {string|null} The PEM-encoded private key, or null if not configured.
 */
function getRS256PrivateKey() {
  const key = process.env.JWT_PRIVATE_KEY;
  if (!key) {
    return null;
  }
  // Handle escaped newlines from env (e.g., "-----BEGIN...\\n...\\n-----END...")
  return key.replace(/\\n/g, "\n");
}

/**
 * Validate that required JWT keys are configured.
 * Call this at application startup to fail fast.
 * @param {Object} options
 * @param {boolean} options.requireRS256 - Whether RS256 private key is required
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateJwtConfig(options = {}) {
  const errors = [];

  // JWT_SECRET is used for customer portal tokens (HS256)
  if (!process.env.JWT_SECRET) {
    errors.push("JWT_SECRET is not set - required for customer authentication");
  }

  // JWT_PRIVATE_KEY is used for license activation tokens (RS256)
  if (options.requireRS256 && !process.env.JWT_PRIVATE_KEY) {
    errors.push("JWT_PRIVATE_KEY is not set - required for license activation");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  getRS256PrivateKey,
  validateJwtConfig,
};
