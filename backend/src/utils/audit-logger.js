/**
 * Security Audit Logger
 *
 * Structured logging for security-relevant actions.
 * Never logs secrets, tokens, MACs, or raw license keys.
 * Masks sensitive data before logging.
 */

const SENSITIVE_PATTERNS = [
  /key|token|secret|password|mac|jwt|activation/i,
];

/**
 * Mask sensitive string values
 * Shows first 4 and last 4 chars, masks middle with ***
 */
function maskSensitive(value, showChars = 4) {
  if (!value || typeof value !== "string") return "[REDACTED]";
  if (value.length <= showChars * 2) return "[REDACTED]";
  return `${value.slice(0, showChars)}***${value.slice(-showChars)}`;
}

/**
 * Sanitize an object by masking sensitive fields
 */
function sanitizeObject(obj, depth = 0) {
  if (depth > 3 || !obj || typeof obj !== "object") return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if the key name suggests sensitive data
    const isSensitiveKey = SENSITIVE_PATTERNS.some((pattern) =>
      pattern.test(key)
    );

    if (isSensitiveKey && typeof value === "string") {
      sanitized[key] = maskSensitive(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Get client IP from Koa context
 */
function getClientIp(ctx) {
  return (
    ctx.request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    ctx.request.headers["x-real-ip"] ||
    ctx.request.ip ||
    "unknown"
  );
}

/**
 * Create an audit log entry
 *
 * @param {string} action - Action identifier (e.g., "license_activate", "login_failed")
 * @param {Object} options - Log options
 * @param {Object} options.ctx - Koa context (for IP, user-agent)
 * @param {string} options.outcome - "success" | "failure"
 * @param {string} options.reason - Reason code (e.g., "invalid_key", "rate_limited")
 * @param {number|string} options.customerId - Customer ID if known
 * @param {Object} options.metadata - Additional metadata (will be sanitized)
 */
function auditLog(action, options = {}) {
  const { ctx, outcome = "success", reason = null, customerId = null, metadata = {} } = options;

  const entry = {
    timestamp: new Date().toISOString(),
    action,
    outcome,
    ...(reason && { reason }),
    ...(customerId && { customerId }),
    ip: ctx ? getClientIp(ctx) : "unknown",
    userAgent: ctx?.request?.headers?.["user-agent"] || "unknown",
    ...(Object.keys(metadata).length > 0 && { metadata: sanitizeObject(metadata) }),
  };

  // Use Strapi logger if available, otherwise console
  const logFn =
    typeof strapi !== "undefined" && strapi.log
      ? outcome === "failure"
        ? strapi.log.warn.bind(strapi.log)
        : strapi.log.info.bind(strapi.log)
      : outcome === "failure"
        ? console.warn
        : console.log;

  logFn(`[AUDIT] ${JSON.stringify(entry)}`);

  return entry;
}

// Pre-configured audit loggers for common actions
const audit = {
  /**
   * Log license activation attempt
   */
  licenseActivation(ctx, { outcome, reason, customerId, licenseKeyMasked }) {
    return auditLog("license_activate", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: { licenseKey: licenseKeyMasked },
    });
  },

  /**
   * Log license deactivation attempt
   */
  licenseDeactivation(ctx, { outcome, reason, customerId, licenseKeyMasked }) {
    return auditLog("license_deactivate", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: { licenseKey: licenseKeyMasked },
    });
  },

  /**
   * Log license reset attempt (admin action)
   */
  licenseReset(ctx, { outcome, reason, adminAction = true }) {
    return auditLog("license_reset", {
      ctx,
      outcome,
      reason,
      metadata: { adminAction },
    });
  },

  /**
   * Log manual credit attempt (admin action)
   */
  manualCredit(ctx, { outcome, reason, amount, customerId }) {
    return auditLog("manual_credit", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: { amount },
    });
  },

  /**
   * Log customer login attempt
   */
  customerLogin(ctx, { outcome, reason, customerId, email }) {
    return auditLog("customer_login", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: { email: email ? maskSensitive(email, 3) : undefined },
    });
  },

  /**
   * Log customer registration attempt
   */
  customerRegister(ctx, { outcome, reason, customerId, email }) {
    return auditLog("customer_register", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: { email: email ? maskSensitive(email, 3) : undefined },
    });
  },

  /**
   * Log rate limit trigger
   */
  rateLimited(ctx, endpoint, details = {}) {
    return auditLog("rate_limited", {
      ctx,
      outcome: "blocked",
      reason: "rate_limit_exceeded",
      metadata: { endpoint, ...details },
    });
  },

  /**
   * Log admin token validation failure
   */
  adminTokenInvalid(ctx, { endpoint }) {
    return auditLog("admin_token_invalid", {
      ctx,
      outcome: "failure",
      reason: "invalid_admin_token",
      metadata: { endpoint },
    });
  },

  // -------------------------------------------------------------------------
  // Stage 4: Device-based activation audit events
  // -------------------------------------------------------------------------

  /**
   * Log device registration attempt
   */
  deviceRegister(ctx, { outcome, reason, customerId, deviceId, deviceIdHash }) {
    return auditLog("device_register", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: { deviceId: deviceIdHash || maskSensitive(deviceId, 8) },
    });
  },

  /**
   * Log device-based activation attempt
   */
  deviceActivate(ctx, { outcome, reason, customerId, entitlementId, deviceId, deviceIdHash }) {
    return auditLog("device_activate", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId,
        deviceId: deviceIdHash || maskSensitive(deviceId, 8),
      },
    });
  },

  /**
   * Log device refresh attempt
   */
  deviceRefresh(ctx, { outcome, reason, customerId, entitlementId, deviceId, deviceIdHash }) {
    return auditLog("device_refresh", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId,
        deviceId: deviceIdHash || maskSensitive(deviceId, 8),
      },
    });
  },

  /**
   * Log device deactivation attempt
   */
  deviceDeactivate(ctx, { outcome, reason, customerId, entitlementId, deviceId, deviceIdHash }) {
    return auditLog("device_deactivate", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId,
        deviceId: deviceIdHash || maskSensitive(deviceId, 8),
      },
    });
  },

  // -------------------------------------------------------------------------
  // Stage 5: Lease Token & Offline Refresh audit events
  // -------------------------------------------------------------------------

  /**
   * Log lease token issuance (online refresh)
   */
  leaseIssued(ctx, { outcome, reason, customerId, entitlementId, deviceId, jti }) {
    return auditLog("lease_issued", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId,
        deviceId: maskSensitive(deviceId, 8),
        jti: jti ? jti.slice(0, 8) + "..." : null,
      },
    });
  },

  /**
   * Log offline challenge generation
   */
  offlineChallenge(ctx, { outcome, reason, customerId, entitlementId, deviceId, nonce, error }) {
    return auditLog("offline_challenge", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId,
        deviceId: deviceId ? maskSensitive(deviceId, 8) : null,
        nonce: nonce ? nonce.slice(0, 8) + "..." : null,
        error: error || null,
      },
    });
  },

  /**
   * Log offline refresh attempt
   */
  offlineRefresh(ctx, { outcome, reason, customerId, entitlementId, deviceId, jti, leaseJti, error }) {
    return auditLog("offline_refresh", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId,
        deviceId: deviceId ? maskSensitive(deviceId, 8) : null,
        challengeJti: jti ? jti.slice(0, 8) + "..." : null,
        leaseJti: leaseJti ? leaseJti.slice(0, 8) + "..." : null,
        error: error || null,
      },
    });
  },

  // -------------------------------------------------------------------------
  // Air-Gapped Offline Activation audit events
  // -------------------------------------------------------------------------

  /**
   * Log offline provision attempt (air-gapped device activation)
   */
  offlineProvision(ctx, { outcome, reason, customerId, entitlementId, deviceId, jti, error }) {
    return auditLog("offline_provision", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId,
        deviceId: deviceId ? maskSensitive(deviceId, 8) : null,
        activationJti: jti ? jti.slice(0, 8) + "..." : null,
        error: error || null,
      },
    });
  },

  /**
   * Log offline lease refresh attempt (air-gapped device refresh via signed request code)
   */
  offlineLeaseRefresh(ctx, { outcome, reason, customerId, entitlementId, deviceId, jti, leaseJti, error }) {
    return auditLog("offline_lease_refresh", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId,
        deviceId: deviceId ? maskSensitive(deviceId, 8) : null,
        requestJti: jti ? jti.slice(0, 8) + "..." : null,
        leaseJti: leaseJti ? leaseJti.slice(0, 8) + "..." : null,
        error: error || null,
      },
    });
  },

  /**
   * Log offline deactivation attempt (air-gapped device deactivation via signed code)
   */
  offlineDeactivate(ctx, { outcome, reason, customerId, entitlementId, deviceId, jti, error }) {
    return auditLog("offline_deactivate", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId,
        deviceId: deviceId ? maskSensitive(deviceId, 8) : null,
        deactivationJti: jti ? jti.slice(0, 8) + "..." : null,
        error: error || null,
      },
    });
  },

  // -------------------------------------------------------------------------
  // Portal AI API audit events (Stage 1+)
  // -------------------------------------------------------------------------

  /**
   * Log AI token mint attempt
   */
  aiTokenMint(ctx, { outcome, reason, customerId, entitlementId, jti, error }) {
    return auditLog("ai_token_mint", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId: entitlementId || null,
        jti: jti ? jti.slice(0, 8) + "..." : null,
        error: error || null,
      },
    });
  },

  /**
   * Log Settings Assistant call
   * Never logs prompt content or settings values
   */
  aiSettingsAssistant(ctx, { outcome, reason, customerId, entitlementId, jti, latencyMs, error }) {
    return auditLog("ai_settings_assistant", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId: entitlementId || null,
        jti: jti ? jti.slice(0, 8) + "..." : null,
        latencyMs: latencyMs || null,
        error: error || null,
      },
    });
  },

  /**
   * Log Engrave Assistant call (image-based)
   * Never logs prompt or image content
   */
  aiEngraveAssistant(ctx, {
    outcome,
    reason,
    customerId,
    entitlementId,
    jti,
    latencyMs,
    imageBytes,
    imageType,
    promptLength,
    settingsKeysCount,
    error,
  }) {
    return auditLog("ai_engrave_assistant", {
      ctx,
      outcome,
      reason,
      customerId,
      metadata: {
        entitlementId: entitlementId || null,
        jti: jti ? jti.slice(0, 8) + "..." : null,
        latencyMs: latencyMs || null,
        imageBytes: imageBytes || null,
        imageType: imageType || null,
        promptLength: promptLength || null,
        settingsKeysCount: settingsKeysCount || null,
        error: error || null,
      },
    });
  },

  /**
   * Generic audit log
   */
  log: auditLog,
};

module.exports = {
  audit,
  auditLog,
  maskSensitive,
  sanitizeObject,
  getClientIp,
};
