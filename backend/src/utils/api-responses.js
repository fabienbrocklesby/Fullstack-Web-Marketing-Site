/**
 * API Response Helpers for Licensing Endpoints (Stage 6A)
 *
 * Provides consistent response shapes for all licensing-related endpoints.
 * All success responses include `ok: true`, all error responses include
 * `ok: false`, `code`, and `message`.
 *
 * This keeps the codebase simple and predictable for desktop app integration.
 */

/**
 * Stable error codes for licensing API
 * Keep this list tight - only add codes that clients need to handle specifically.
 */
const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // Auth/Authz
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",

  // Resource not found
  NOT_FOUND: "NOT_FOUND",
  ENTITLEMENT_NOT_FOUND: "ENTITLEMENT_NOT_FOUND",
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",

  // Ownership/binding issues
  DEVICE_NOT_OWNED: "DEVICE_NOT_OWNED",
  DEVICE_NOT_BOUND: "DEVICE_NOT_BOUND",
  ENTITLEMENT_NOT_ACTIVE: "ENTITLEMENT_NOT_ACTIVE",

  // Limits
  MAX_DEVICES_EXCEEDED: "MAX_DEVICES_EXCEEDED",

  // Offline/challenge
  LIFETIME_NOT_SUPPORTED: "LIFETIME_NOT_SUPPORTED",
  CHALLENGE_INVALID: "CHALLENGE_INVALID",
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",
  REPLAY_REJECTED: "REPLAY_REJECTED",

  // Air-gapped offline codes
  INVALID_SETUP_CODE: "INVALID_SETUP_CODE",
  INVALID_PUBLIC_KEY: "INVALID_PUBLIC_KEY",
  INVALID_REQUEST_CODE: "INVALID_REQUEST_CODE",
  INVALID_DEACTIVATION_CODE: "INVALID_DEACTIVATION_CODE",
  SIGNATURE_VERIFICATION_FAILED: "SIGNATURE_VERIFICATION_FAILED",

  // System
  RATE_LIMITED: "RATE_LIMITED",
  RETIRED_ENDPOINT: "RETIRED_ENDPOINT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

/**
 * Send a successful response with `ok: true`
 * Merges provided payload with standard fields.
 *
 * @param {object} ctx - Koa context
 * @param {object} payload - Response data (will be spread into body)
 * @param {number} [status=200] - HTTP status code
 */
function sendOk(ctx, payload = {}, status = 200) {
  ctx.status = status;
  ctx.body = {
    ok: true,
    ...payload,
  };
}

/**
 * Send an error response with `ok: false`, `code`, and `message`
 *
 * @param {object} ctx - Koa context
 * @param {number} httpStatus - HTTP status code (400, 401, 403, 404, 409, 410, 429, 500)
 * @param {string} code - Stable error code from ErrorCodes
 * @param {string} message - Human-readable error message (stable, app-safe)
 * @param {object} [details] - Optional additional details (field-level errors, limits, etc.)
 */
function sendError(ctx, httpStatus, code, message, details = null) {
  ctx.status = httpStatus;
  const body = {
    ok: false,
    code,
    message,
  };
  if (details !== null && details !== undefined) {
    body.details = details;
  }
  ctx.body = body;
}

/**
 * Send a 410 Gone response for retired endpoints
 *
 * @param {object} ctx - Koa context
 * @param {string} message - Migration guidance message
 * @param {object} [migration] - Optional migration details (replacement endpoint, guide)
 */
function sendRetired(ctx, message, migration = null) {
  ctx.status = 410;
  const body = {
    ok: false,
    code: ErrorCodes.RETIRED_ENDPOINT,
    message,
  };
  if (migration) {
    body.details = { migration };
  }
  ctx.body = body;
}

module.exports = {
  ErrorCodes,
  sendOk,
  sendError,
  sendRetired,
};
